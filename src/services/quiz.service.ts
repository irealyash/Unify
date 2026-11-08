import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  biomes,
  groupQuestions,
  groups,
  participantAnswers,
  participants,
} from "@/lib/db/schema";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "@/lib/embeddings";
import { normalizeGroupCode } from "@/lib/groups/defaults";
import { newSessionToken } from "@/lib/session";

export async function joinGroup(params: {
  code: string;
  officialName: string;
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

  if (params.existingToken) {
    const [existing] = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.sessionToken, params.existingToken),
          eq(participants.groupId, group.id),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(participants)
        .set({ officialName, updatedAt: new Date() })
        .where(eq(participants.id, existing.id))
        .returning();
      return { group, participant: updated };
    }
  }

  const token = newSessionToken();
  const [participant] = await db
    .insert(participants)
    .values({
      groupId: group.id,
      officialName,
      sessionToken: token,
    })
    .returning();

  return { group, participant };
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
  answers: Array<{
    questionId: string;
    selectedOptionId?: string | null;
    freeTextAnswer?: string | null;
  }>;
  freeText?: string;
}) {
  const session = await getParticipantByToken(params.sessionToken);
  if (!session) throw new Error("Session expired. Re-enter your group code.");

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

  // Replace prior answers for idempotent resubmits
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

  await db.execute(sql`
    UPDATE participants
    SET
      free_text = ${freeText},
      working_style_text = ${workingStyleText},
      embedding = ${literal}::vector,
      embedding_model = ${model},
      quiz_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${session.participant.id}::uuid
  `);

  // Assign nearest biome by cosine distance to centroid
  const nearest = await db.execute(sql`
    SELECT id, name, (centroid_embedding <=> ${literal}::vector) AS distance
    FROM biomes
    WHERE group_id = ${session.group.id}::uuid
      AND centroid_embedding IS NOT NULL
      AND embedding_model = ${model}
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
    .where(eq(participants.id, session.participant.id));

  return {
    participantId: session.participant.id,
    groupCode: session.group.code,
    biomeId,
    biomeName: nearestRows[0]!.name,
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
    .where(and(eq(participants.biomeId, biomeId), sql`${participants.quizCompletedAt} IS NOT NULL`))
    .orderBy(asc(participants.officialName));

  return { biome, group, members };
}
