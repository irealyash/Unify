import { jsonError, jsonOk } from "@/lib/api";
import { getBiomeRoster } from "@/services/quiz.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const roster = await getBiomeRoster(id);
    if (!roster) {
      return jsonError(new Error("Biome not found"));
    }

    return jsonOk({
      biome: {
        id: roster.biome.id,
        name: roster.biome.name,
        description: roster.biome.description,
        themeKey: roster.biome.themeKey,
      },
      group: roster.group
        ? {
            id: roster.group.id,
            code: roster.group.code,
            name: roster.group.name,
          }
        : null,
      members: roster.members,
    });
  } catch (error) {
    return jsonError(error);
  }
}
