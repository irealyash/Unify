import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth/current-user";
import { getParticipantToken, setParticipantToken } from "@/lib/session";
import { joinGroup } from "@/services/quiz.service";

const bodySchema = z.object({
  code: z.string().min(4).max(12),
  officialName: z.string().min(2).max(120),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const existingToken = await getParticipantToken();
    const result = await joinGroup({
      code: body.code,
      officialName: body.officialName,
      user,
      existingToken,
    });
    await setParticipantToken(result.participant.sessionToken);

    return jsonOk({
      group: {
        id: result.group.id,
        code: result.group.code,
        name: result.group.name,
        description: result.group.description,
      },
      participant: {
        id: result.participant.id,
        officialName: result.participant.officialName,
        biomeId: result.participant.biomeId,
        quizCompletedAt: result.participant.quizCompletedAt,
        reusedAnswers: result.participant.reusedAnswers,
      },
      skippedQuiz: result.skippedQuiz,
      reusedAnswers: result.reusedAnswers,
      biomeId: "biomeId" in result ? result.biomeId : result.participant.biomeId,
      biomeName: "biomeName" in result ? result.biomeName : undefined,
    });
  } catch (error) {
    return jsonError(error);
  }
}
