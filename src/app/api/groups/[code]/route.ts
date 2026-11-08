import { jsonError, jsonOk } from "@/lib/api";
import { getGroupByCode } from "@/services/group.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await ctx.params;
    const group = await getGroupByCode(code);
    if (!group) {
      return jsonError(new Error("No group found for that code"));
    }
    return jsonOk({
      group: {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        questions: group.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          questionType: q.questionType,
          options: q.options,
          required: q.required,
          sortOrder: q.sortOrder,
        })),
        biomes: group.biomes,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
