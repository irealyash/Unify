import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  biomes,
  groupQuestions,
  groups,
  participantAnswers,
  participants,
  userAnswerProfiles,
  type SavedAnswer,
  type User,
} from "@/lib/db/schema";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "@/lib/embeddings";
import {
  buildSavedAnswers,
  fingerprintQuestions,
  mapSavedAnswersToGroup,
} from "@/lib/groups/fingerprint";
import { normalizeGroupCode } from "@/lib/groups/defaults";
import { newSessionToken } from "@/lib/session";

async function assignNearestBiome(params: {
  groupId: string;
  participantId: string;
  embeddingLiteral: string;
  embeddingModel: string;
}) {
  const nearest = await db.execute(sql`
    SELECT id, name, (centroid_embedding <=> ${params.embeddingLiteral}::vector) AS distance
    FROM biomes
    WHERE group_id = ${params.groupId}::uuid
      AND centroid_embedding IS NOT NULL
      AND embedding_model = ${params.embeddingModel}
    ORDER BY distance ASC
    LIMIT 1
  `);

  const nearestRows = (
    Array.isArray(nearest)
      ? nearest
      : ((nearest as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [])
  ) as Array<{ id: string; name: string }>;

  const biomeId = nearestRows[0]?.id;
  if (!biomeId) throw new Error("No biomes available for this group yet");

  await db
    .update(participants)
    .set({ biomeId, updatedAt: new Date() })
    .where(eq(participants.id, params.participantId));

  return { biomeId, biomeName: nearestRows[0]!.name };
}

async function applyReusableProfile(params: {
  group: typeof groups.$inferSelect;
  participant: typeof participants.$inferSelect;
  questions: Array<typeof groupQuestions.$inferSelect>;
  profile: typeof userAnswerProfiles.$inferSelect;
}) {
  const mapped = mapSavedAnswersToGroup({
    questions: params.questions,
    saved: params.profile.answers,
  });
  if (!mapped || !params.profile.embedding) return null;

  await db
    .delete(participantAnswers)
    .where(eq(participantAnswers.participantId, params.participant.id));

  if (mapped.length) {
    await db.insert(participantAnswers).values(
      mapped.map((a) => ({
        participantId: params.participant.id,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        freeTextAnswer: a.freeTextAnswer,
      })),
    );
  }

  const freeText = mapped
    .map((a) => a.freeTextAnswer?.trim() || "")
    .filter(Boolean)
    .join("\n");

  // Copy embedding vector from the saved profile via SQL
  await db.execute(sql`
    UPDATE participants p
    SET
      free_text = ${freeText},
      working_style_text = ${params.profile.workingStyleText},
      embedding = uap.embedding,
      embedding_model = ${params.profile.embeddingModel},
      quiz_completed_at = NOW(),
      reused_answers = TRUE,
      updated_at = NOW()
    FROM user_answer_profiles uap
    WHERE p.id = ${params.participant.id}::uuid
      AND uap.id = ${params.profile.id}::uuid
  `);

  const embRow = await db.execute(sql`
    SELECT embedding::text AS emb
    FROM participants
    WHERE id = ${params.participant.id}::uuid
  `);
  const embRows = (
    Array.isArray(embRow)
      ? embRow
      : ((embRow as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [])
  ) as Array<{ emb: string }>;
  const embLiteral = embRows[0]?.emb;
  if (!embLiteral) return null;

  const biome = await assignNearestBiome({
    groupId: params.group.id,
    participantId: params.participant.id,
    embeddingLiteral: embLiteral,
    embeddingModel: params.profile.embeddingModel,
  });

  const [updated] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, params.participant.id))
    .limit(1);

  return {
    participant: updated!,
    biomeId: biome.biomeId,
    biomeName: biome.biomeName,
    reusedAnswers: true as const,
  };
}

export async function joinGroup(params: {
  code: string;
  officialName: string;
  user: User;
  existingToken?: string | null;
}) {
  const officialName = params.officialName.trim();
  if (officialName.length < 2) throw new Error("Enter your official name");

  const normalized = normalizeGroupCode(params.code);
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.codeNormalized, normalized))
    .limit(1);
  if (!group) throw new Error("No group found for that code");

  const questions = await db
    .select()
    .from(groupQuestions)
    .where(eq(groupQuestions.groupId, group.id))
    .orderBy(asc(groupQuestions.sortOrder));

  const fingerprint = fingerprintQuestions(questions);

  let participant =
    (
      await db
        .select()
        .from(participants)
        .where(
          and(eq(participants.groupId, group.id), eq(participants.userId, params.user.id)),
        )
        .limit(1)
    )[0] ?? null;

  if (!participant && params.existingToken) {
    const [byToken] = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.sessionToken, params.existingToken),
          eq(participants.groupId, group.id),
        ),
      )
      .limit(1);
    if (byToken) {
      const [linked] = await db
        .update(participants)
        .set({
          userId: params.user.id,
          officialName,
          updatedAt: new Date(),
        })
        .where(eq(participants.id, byToken.id))
        .returning();
      participant = linked;
    }
  }

  if (participant) {
    const [updated] = await db
      .update(participants)
      .set({ officialName, userId: params.user.id, updatedAt: new Date() })
      .where(eq(participants.id, participant.id))
      .returning();
    participant = updated;
  } else {
    const token = newSessionToken();
    const [created] = await db
      .insert(participants)
      .values({
        groupId: group.id,
        userId: params.user.id,
        officialName,
        sessionToken: token,
      })
      .returning();
    participant = created;
  }

  // Already finished this group's quiz
  if (participant.quizCompletedAt && participant.biomeId) {
    return {
      group,
      participant,
      reusedAnswers: Boolean(participant.reusedAnswers),
      skippedQuiz: true,
    };
  }

  // Reuse prior answers when this group's questions match a saved fingerprint
  const [profile] = await db
    .select()
    .from(userAnswerProfiles)
    .where(
      and(
        eq(userAnswerProfiles.userId, params.user.id),
        eq(userAnswerProfiles.fingerprint, fingerprint),
      ),
    )
    .limit(1);

  if (profile?.embedding) {
    const applied = await applyReusableProfile({
      group,
      participant,
      questions,
      profile,
    });
    if (applied) {
      return {
        group,
        participant: applied.participant,
        reusedAnswers: true,
        skippedQuiz: true,
        biomeId: applied.biomeId,
        biomeName: applied.biomeName,
      };
    }
  }

  return {
    group,
    participant,
    reusedAnswers: false,
    skippedQuiz: false,
    fingerprint,
  };
}

export async function getParticipantByToken(token: string) {
  const [row] = await db
    .select({
      participant: participants,
      group: groups,
    })
    .from(participants)
    .innerJoin(groups, eq(groups.id, participants.groupId))
    .where(eq(participants.sessionToken, token))
    .limit(1);
  return row ?? null;
}

function buildWorkingStyleText(params: {
  officialName: string;
  answers: Array<{
    prompt: string;
    questionType: "multiple_choice" | "free_text";
    selectedOptionId?: string | null;
    freeTextAnswer?: string | null;
    options: Array<{ id: string; label: string; embeddingHint: string }>;
  }>;
  freeText: string;
}) {
  const lines: string[] = [
    `Student working style for a UBC classroom group project.`,
    `Name: ${params.officialName}.`,
  ];

  for (const answer of params.answers) {
    if (answer.questionType === "multiple_choice") {
      const option = answer.options.find((o) => o.id === answer.selectedOptionId);
      if (option) {
        lines.push(`Q: ${answer.prompt}`);
        lines.push(`A: ${option.label}. ${option.embeddingHint}`);
      }
    } else if (answer.freeTextAnswer?.trim()) {
      lines.push(`Q: ${answer.prompt}`);
      lines.push(`A: ${answer.freeTextAnswer.trim()}`);
    }
  }

  if (params.freeText.trim()) {
    lines.push(`Additional notes: ${params.freeText.trim()}`);
  }

  return lines.join("\n");
}

export async function submitQuiz(params: {
  sessionToken: string;
  user: User;
  answers: Array<{
    questionId: string;
    selectedOptionId?: string | null;
    freeTextAnswer?: string | null;
  }>;
  freeText?: string;
}) {
  const session = await getParticipantByToken(params.sessionToken);
  if (!session) throw new Error("Session expired. Re-enter your group code.");

  if (session.participant.userId && session.participant.userId !== params.user.id) {
    throw new Error("This quiz session belongs to another account");
  }

  // Ensure participant is linked to the signed-in user
  if (!session.participant.userId) {
    await db
      .update(participants)
      .set({ userId: params.user.id, updatedAt: new Date() })
      .where(eq(participants.id, session.participant.id));
  }

  const questions = await db
    .select()
    .from(groupQuestions)
    .where(eq(groupQuestions.groupId, session.group.id))
    .orderBy(asc(groupQuestions.sortOrder));

  const answerMap = new Map(params.answers.map((a) => [a.questionId, a]));

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    if (question.required) {
      if (question.questionType === "multiple_choice" && !answer?.selectedOptionId) {
        throw new Error(`Please answer: ${question.prompt}`);
      }
    }
  }

  await db
    .delete(participantAnswers)
    .where(eq(participantAnswers.participantId, session.participant.id));

  const rows = questions
    .map((question) => {
      const answer = answerMap.get(question.id);
      if (!answer) return null;
      if (
        question.questionType === "multiple_choice" &&
        !answer.selectedOptionId &&
        !answer.freeTextAnswer
      ) {
        return null;
      }
      return {
        participantId: session.participant.id,
        questionId: question.id,
        selectedOptionId: answer.selectedOptionId ?? null,
        freeTextAnswer: answer.freeTextAnswer?.trim() || null,
      };
    })
    .filter(Boolean) as Array<{
    participantId: string;
    questionId: string;
    selectedOptionId: string | null;
    freeTextAnswer: string | null;
  }>;

  if (rows.length) {
    await db.insert(participantAnswers).values(rows);
  }

  const freeText =
    params.freeText?.trim() ||
    questions
      .filter((q) => q.questionType === "free_text")
      .map((q) => answerMap.get(q.id)?.freeTextAnswer?.trim() || "")
      .filter(Boolean)
      .join("\n") ||
    "";

  const workingStyleText = buildWorkingStyleText({
    officialName: session.participant.officialName,
    freeText,
    answers: questions.map((q) => ({
      prompt: q.prompt,
      questionType: q.questionType,
      options: q.options,
      selectedOptionId: answerMap.get(q.id)?.selectedOptionId,
      freeTextAnswer: answerMap.get(q.id)?.freeTextAnswer,
    })),
  });

  const embedding = await embedText(workingStyleText);
  const model = getEmbeddingModel();
  const literal = vectorToSqlLiteral(embedding);
  const fingerprint = fingerprintQuestions(questions);
  const savedAnswers: SavedAnswer[] = buildSavedAnswers(
    questions,
    params.answers.map((a) => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      freeTextAnswer: a.freeTextAnswer,
    })),
  );

  await db.execute(sql`
    UPDATE participants
    SET
      free_text = ${freeText},
      working_style_text = ${workingStyleText},
      embedding = ${literal}::vector,
      embedding_model = ${model},
      quiz_completed_at = NOW(),
      reused_answers = FALSE,
      user_id = ${params.user.id}::uuid,
      updated_at = NOW()
    WHERE id = ${session.participant.id}::uuid
  `);

  // Upsert durable answer profile for future identical quizzes
  const [existingProfile] = await db
    .select()
    .from(userAnswerProfiles)
    .where(
      and(
        eq(userAnswerProfiles.userId, params.user.id),
        eq(userAnswerProfiles.fingerprint, fingerprint),
      ),
    )
    .limit(1);

  if (existingProfile) {
    await db.execute(sql`
      UPDATE user_answer_profiles
      SET
        answers = ${JSON.stringify(savedAnswers)}::jsonb,
        working_style_text = ${workingStyleText},
        embedding = ${literal}::vector,
        embedding_model = ${model},
        updated_at = NOW()
      WHERE id = ${existingProfile.id}::uuid
    `);
  } else {
    const [created] = await db
      .insert(userAnswerProfiles)
      .values({
        userId: params.user.id,
        fingerprint,
        answers: savedAnswers,
        workingStyleText,
        embeddingModel: model,
      })
      .returning();
    await db.execute(sql`
      UPDATE user_answer_profiles
      SET embedding = ${literal}::vector
      WHERE id = ${created.id}::uuid
    `);
  }

  const biome = await assignNearestBiome({
    groupId: session.group.id,
    participantId: session.participant.id,
    embeddingLiteral: literal,
    embeddingModel: model,
  });

  return {
    participantId: session.participant.id,
    groupCode: session.group.code,
    biomeId: biome.biomeId,
    biomeName: biome.biomeName,
    reusedAnswers: false,
  };
}

export async function getBiomeRoster(biomeId: string) {
  const [biome] = await db.select().from(biomes).where(eq(biomes.id, biomeId)).limit(1);
  if (!biome) return null;

  const [group] = await db.select().from(groups).where(eq(groups.id, biome.groupId)).limit(1);

  const members = await db
    .select({
      id: participants.id,
      officialName: participants.officialName,
      quizCompletedAt: participants.quizCompletedAt,
    })
    .from(participants)
    .where(
      and(eq(participants.biomeId, biomeId), sql`${participants.quizCompletedAt} IS NOT NULL`),
    )
    .orderBy(asc(participants.officialName));

  return { biome, group, members };
}
