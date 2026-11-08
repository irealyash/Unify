import { asc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { biomes, groupQuestions } from "@/lib/db/schema";
import { getParticipantToken } from "@/lib/session";
import { getParticipantByToken } from "@/services/quiz.service";

export async function GET() {
  try {
    const token = await getParticipantToken();
    if (!token) {
      return jsonOk({ session: null });
    }

    const row = await getParticipantByToken(token);
    if (!row) {
      return jsonOk({ session: null });
    }

    const questions = await db
      .select()
      .from(groupQuestions)
      .where(eq(groupQuestions.groupId, row.group.id))
      .orderBy(asc(groupQuestions.sortOrder));

    let biome = null;
    if (row.participant.biomeId) {
      const [b] = await db
        .select({
          id: biomes.id,
          name: biomes.name,
          description: biomes.description,
          themeKey: biomes.themeKey,
        })
        .from(biomes)
        .where(eq(biomes.id, row.participant.biomeId))
        .limit(1);
      biome = b ?? null;
    }

    return jsonOk({
      session: {
        participant: {
          id: row.participant.id,
          officialName: row.participant.officialName,
          biomeId: row.participant.biomeId,
          quizCompletedAt: row.participant.quizCompletedAt,
        },
        group: {
          id: row.group.id,
          code: row.group.code,
          name: row.group.name,
          description: row.group.description,
        },
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          questionType: q.questionType,
          options: q.options,
          required: q.required,
          sortOrder: q.sortOrder,
        })),
        biome,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
