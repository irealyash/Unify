import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getParticipantToken, setParticipantToken } from "@/lib/session";
import { joinGroup } from "@/services/quiz.service";

const bodySchema = z.object({
  code: z.string().min(4).max(12),
  officialName: z.string().min(2).max(120),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const existingToken = await getParticipantToken();
    const { group, participant } = await joinGroup({
      code: body.code,
      officialName: body.officialName,
      existingToken,
    });
    await setParticipantToken(participant.sessionToken);

    return jsonOk({
      group: {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
      },
      participant: {
        id: participant.id,
        officialName: participant.officialName,
        biomeId: participant.biomeId,
        quizCompletedAt: participant.quizCompletedAt,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
