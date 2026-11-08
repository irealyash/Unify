import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth/current-user";
import { getParticipantToken } from "@/lib/session";
import { submitQuiz } from "@/services/quiz.service";

const bodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOptionId: z.string().nullable().optional(),
      freeTextAnswer: z.string().nullable().optional(),
    }),
  ),
  freeText: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const token = await getParticipantToken();
    if (!token) {
      return jsonError(new Error("Session expired. Re-enter your group code."));
    }

    const body = bodySchema.parse(await req.json());
    const result = await submitQuiz({
      sessionToken: token,
      user,
      answers: body.answers,
      freeText: body.freeText,
    });

    return jsonOk({ result });
  } catch (error) {
    return jsonError(error);
  }
}
