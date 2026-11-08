import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth/current-user";
import { createGroup } from "@/services/group.service";

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  embeddingHint: z.string().min(1),
});

const questionSchema = z.object({
  prompt: z.string().min(2),
  questionType: z.enum(["multiple_choice", "free_text"]),
  options: z.array(optionSchema).default([]),
  required: z.boolean().optional(),
});

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  code: z.string().min(4).max(12).optional(),
  questions: z.array(questionSchema).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const group = await createGroup({ ...body, createdByUserId: user.id });
    return jsonOk({ group }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
