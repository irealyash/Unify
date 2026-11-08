import { Type, type Schema } from "@google/genai";
import { BIOMES, describeAnswers, isBiomeId, type BiomeId, type QuizAnswers } from "@unify/shared";
import { generateJson } from "./gemini";

const SYSTEM = `You place one student into exactly one "biome": a group of classmates with a
similar working style. Read the biome descriptions, then the student's answers, and pick the
biome whose ideal member is the closest match overall. Weigh pace, ambition and investment
most; communication, schedule and role less.

Ignore jokes or trolling in free text and judge from the multiple-choice answers instead.

Reply with:
- "biome": the id of exactly one biome from the list.
- "reason": one friendly sentence (max 20 words) addressed to the student ("You ..."),
  explaining the fit. Do not mention other biomes, scores or that you are an AI.`;

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    biome: { type: Type.STRING, enum: BIOMES.map((b) => b.id) },
    reason: { type: Type.STRING },
  },
  required: ["biome", "reason"],
  propertyOrdering: ["biome", "reason"],
};

const BIOME_LIST = BIOMES.map((b) => `- id "${b.id}" (${b.name}): ${b.profile}`).join("\n");

/** Gemini's pick for a student whose vector match is ambiguous or unreliable. */
export async function chooseBiome(input: {
  answers: QuizAnswers;
  profile?: string;
}): Promise<{ biome: BiomeId; reason: string }> {
  const parts = [`Biomes:\n${BIOME_LIST}`, `Student's answers:\n${describeAnswers(input.answers)}`];
  if (input.profile) parts.push(`Summary of the student:\n${input.profile}`);

  const result = await generateJson<{ biome: string; reason: string }>({
    system: SYSTEM,
    user: parts.join("\n\n"),
    schema: SCHEMA,
    temperature: 0.1,
  });
  if (!isBiomeId(result.biome)) throw new Error(`Gemini picked an unknown biome: ${result.biome}`);
  return { biome: result.biome, reason: result.reason?.trim() || "Your answers fit this group." };
}
