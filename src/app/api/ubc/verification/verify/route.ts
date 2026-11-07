import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAppUser, requireClerkUserId } from "@/lib/auth/current-user";
import { confirmUbcVerification } from "@/services/verification.service";

export async function POST(req: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const user = await requireAppUser();
    const body = z
      .object({
        educationEmail: z.string().email(),
        clerkEmailId: z.string().optional(),
      })
      .parse(await req.json());

    const result = await confirmUbcVerification({
      userId: user.id,
      clerkUserId,
      educationEmail: body.educationEmail,
      clerkEmailId: body.clerkEmailId,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
