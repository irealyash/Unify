import { Type, type Schema } from "@google/genai";
import { QUESTIONS, describeAnswers, type QuizAnswers } from "@unify/shared";
import { generateJson } from "./gemini";

/** How much signal the answers carry. Phase 3 sends low-signal students to the LLM fallback. */
export type ProfileEffort = "genuine" | "low_effort" | "joke" | "unknown";

export type Profile = {
  text: string;
  effort: ProfileEffort;
  /** "gemini" normally; "template" if Gemini was unavailable. */
  source: "gemini" | "template";
};

/**
 * Profiles and biome descriptions are embedded and compared, so every profile follows the
 * same structure and voice. Biome descriptions (phase 3) must be written in this style too.
 */
export const PROFILE_STYLE_GUIDE = `Write in third person, starting with "This student". Never use names.
Write 5 sentences, 80-120 words total, covering in this exact order:
1. Pace: when they start work and how they handle deadlines.
2. Ambition: the grade they want and how invested they are in this project.
3. Communication: how they like to keep in touch and how often they want to meet.
4. Rhythm and role: when they do their best work and the role they usually take.
5. Expectations: what they need from teammates, plus any relevant detail from their own words.
Use plain, neutral, descriptive language. Do not judge, praise or give advice.`;

const SYSTEM = `You turn a student's questionnaire answers into a short working-style profile
for a system that groups classmates with similar working styles.

${PROFILE_STYLE_GUIDE}

Fold in free-text details only when they describe working style; ignore jokes, insults and
anything irrelevant. If the free text contradicts a multiple-choice answer, prefer the free text.

Also rate the answers' "effort":
- "genuine": coherent answers; free text (if any) is sincere.
- "low_effort": free text empty or a few words AND the choices look careless or contradictory.
- "joke": free text is trolling, spam, or clearly not serious.`;

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    profile: { type: Type.STRING },
    effort: { type: Type.STRING, enum: ["genuine", "low_effort", "joke"] },
  },
  required: ["profile", "effort"],
  propertyOrdering: ["profile", "effort"],
};

export async function writeProfile(answers: QuizAnswers): Promise<Profile> {
  const result = await generateJson<{ profile: string; effort: ProfileEffort }>({
    system: SYSTEM,
    user: `Questionnaire answers:\n\n${describeAnswers(answers)}`,
    schema: SCHEMA,
    temperature: 0.2,
  });
  const text = result.profile?.trim();
  if (!text || text.length < 40) throw new Error("Gemini returned an unusably short profile");
  return { text, effort: result.effort ?? "unknown", source: "gemini" };
}

/** Deterministic profile used when Gemini is unavailable, so the student can still be sorted. */
export function templateProfile(answers: QuizAnswers): Profile {
  const parts: string[] = [];
  for (const q of QUESTIONS) {
    const value = answers[q.id]?.trim();
    if (!value) continue;
    const answer = q.kind === "choice" ? q.options.find((o) => o.id === value)?.label : value;
    if (answer) parts.push(`${q.topic}: ${answer}`);
  }
  return {
    text: `This student's working-style answers. ${parts.join(". ")}.`,
    effort: "unknown",
    source: "template",
  };
}
