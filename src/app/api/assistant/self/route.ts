import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { assistantMessageSchema } from "@/lib/validators/profile";
import {
  getAssistantHistory,
  sendAssistantMessage,
  undoAssistantUpdate,
} from "@/services/assistant.service";

export async function GET() {
  try {
    const user = await requireOnboardedUser();
    const history = await getAssistantHistory(user.id, "self");
    return jsonOk({
      history,
      profileText: user.profile?.selfText ?? "",
      version: user.profile?.selfVersion ?? 0,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const body = assistantMessageSchema.parse(await req.json());
    const result = await sendAssistantMessage({
      userId: user.id,
      side: "self",
      message: body.message,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireOnboardedUser();
    const action = z
      .object({ action: z.literal("undo").default("undo") })
      .parse(await req.json().catch(() => ({ action: "undo" })));
    void action;
    const result = await undoAssistantUpdate(user.id, "self");
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
