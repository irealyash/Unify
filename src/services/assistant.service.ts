import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { profileAssistantMessages, userProfiles } from "@/lib/db/schema";
import { generateJson } from "@/lib/gemini/client";
import { assistantResponseSchema } from "@/lib/validators/profile";
import { updateOwnedProfileText, undoLastProfileUpdate } from "@/services/profile.service";

export type AssistantSide = "self" | "seeking";

const HISTORY_LIMIT = 24;

function systemPrompt(side: AssistantSide, currentProfile: string) {
  if (side === "self") {
    return `You are "About Me", a personal AI profile assistant for Mutual.
Your only job is to help the user refine their WHO I AM profile.
Never invent personal facts. Never assume details the user did not provide.
Preserve existing information unless the user asks to change or remove it.
You may ask a clarifying question instead of updating.
When ready to update, return the COMPLETE revised profile text.

Current profile text:
"""
${currentProfile}
"""

Respond ONLY with JSON matching:
{
  "assistant_message": string,
  "should_update": boolean,
  "updated_profile": string | null,
  "changes_summary": string[]
}`;
  }

  return `You are "My Ideal People", a personal AI profile assistant for Mutual.
Your only job is to help the user refine their WHO I'M LOOKING FOR profile.
Never invent preferences they did not express. Never modify their self-description.
Preserve existing information unless the user asks to change or remove it.
You may ask a clarifying question instead of updating.
When ready to update, return the COMPLETE revised seeking profile text.

Current seeking profile text:
"""
${currentProfile}
"""

Respond ONLY with JSON matching:
{
  "assistant_message": string,
  "should_update": boolean,
  "updated_profile": string | null,
  "changes_summary": string[]
}`;
}

export async function getAssistantHistory(userId: string, side: AssistantSide) {
  return db
    .select()
    .from(profileAssistantMessages)
    .where(
      and(
        eq(profileAssistantMessages.userId, userId),
        eq(profileAssistantMessages.assistantType, side),
      ),
    )
    .orderBy(asc(profileAssistantMessages.createdAt))
    .limit(100);
}

export async function sendAssistantMessage(params: {
  userId: string;
  side: AssistantSide;
  message: string;
}) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, params.userId))
    .limit(1);

  if (!profile) throw new Error("Profile not found");

  const currentText = params.side === "self" ? profile.selfText : profile.seekingText;
  const expectedVersion = params.side === "self" ? profile.selfVersion : profile.seekingVersion;

  await db.insert(profileAssistantMessages).values({
    userId: params.userId,
    assistantType: params.side,
    role: "user",
    content: params.message,
  });

  const history = await db
    .select()
    .from(profileAssistantMessages)
    .where(
      and(
        eq(profileAssistantMessages.userId, params.userId),
        eq(profileAssistantMessages.assistantType, params.side),
      ),
    )
    .orderBy(desc(profileAssistantMessages.createdAt))
    .limit(HISTORY_LIMIT);

  const chronological = history.reverse();

  const raw = await generateJson({
    system: systemPrompt(params.side, currentText),
    temperature: 0.3,
    messages: chronological.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  });

  let parsed: z.infer<typeof assistantResponseSchema>;
  try {
    parsed = assistantResponseSchema.parse(JSON.parse(raw));
  } catch {
    parsed = {
      assistant_message:
        "I couldn't structure that update cleanly. Could you rephrase what you'd like changed?",
      should_update: false,
      updated_profile: null,
      changes_summary: [],
    };
  }

  let updated = false;
  let newVersion = expectedVersion;
  let publicSummary = profile.publicSummary;

  if (parsed.should_update && parsed.updated_profile?.trim()) {
    const result = await updateOwnedProfileText({
      userId: params.userId,
      side: params.side,
      profileText: parsed.updated_profile.trim(),
      expectedVersion,
    });
    updated = true;
    newVersion = result.version;
    publicSummary = result.publicSummary;
  }

  await db.insert(profileAssistantMessages).values({
    userId: params.userId,
    assistantType: params.side,
    role: "assistant",
    content: parsed.assistant_message,
  });

  return {
    assistantMessage: parsed.assistant_message,
    shouldUpdate: updated,
    changesSummary: parsed.changes_summary,
    version: newVersion,
    publicSummary,
    side: params.side,
    updatedProfile: updated ? parsed.updated_profile : null,
  };
}

export async function undoAssistantUpdate(userId: string, side: AssistantSide) {
  const result = await undoLastProfileUpdate(userId, side);
  await db.insert(profileAssistantMessages).values({
    userId,
    assistantType: side,
    role: "assistant",
    content: "I've restored your previous profile version.",
  });
  return result;
}
