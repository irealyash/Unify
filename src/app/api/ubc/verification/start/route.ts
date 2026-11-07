import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAppUser } from "@/lib/auth/current-user";
import { startUbcVerification } from "@/services/verification.service";

export async function POST(req: Request) {
  try {
    const user = await requireAppUser();
    const body = z
      .object({ educationEmail: z.string().email() })
      .parse(await req.json());
    const result = await startUbcVerification({
      userId: user.id,
      educationEmail: body.educationEmail,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
