import { embedText, getEmbeddingModel } from "./ai/embeddings";
import { errorMessage, geminiLimit, withRetry } from "./ai/gemini";
import { templateProfile, writeProfile, type Profile } from "./ai/profile";
import { persist } from "./db";
import type { Player, Room } from "./rooms";

/**
 * Turns a submitted questionnaire into a profile + self vector, in the background.
 *
 *   answers → Gemini profile (template if Gemini fails) → embedding → status "ready"
 *
 * Status changes are reported through `onChange` so the room sees progress live.
 * If embedding fails the status becomes "error"; phase 3's LLM fallback can still sort
 * that student from their profile text.
 */
export async function buildProfile(room: Room, player: Player, onChange: () => void) {
  const answers = player.answers;
  if (!answers) return;
  const label = `${room.code}/${player.name}`;
  const started = Date.now();

  player.quiz = "processing";
  player.profile = undefined;
  player.embedding = undefined;
  onChange();

  let profile: Profile;
  try {
    profile = await geminiLimit(() =>
      withRetry(() => writeProfile(answers), { label: `profile ${label}` }),
    );
  } catch (err) {
    console.warn(`[quiz] ${label}: Gemini profile failed, using template: ${errorMessage(err)}`);
    profile = templateProfile(answers);
  }

  // The player may have resubmitted while we were waiting; drop stale results.
  if (player.answers !== answers) return;
  player.profile = profile;

  try {
    const embedding = await geminiLimit(() =>
      withRetry(() => embedText(profile.text), { label: `embed ${label}` }),
    );
    if (player.answers !== answers) return;
    player.embedding = embedding;
    player.quiz = "ready";
  } catch (err) {
    console.error(`[quiz] ${label}: embedding failed: ${errorMessage(err)}`);
    player.quiz = "error";
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[quiz] ${label}: ${player.quiz} in ${seconds}s (${profile.source}, ${profile.effort})`);

  persist.profile(room.id, player.id, {
    status: player.quiz,
    profile,
    embedding: player.embedding,
    embeddingModel: player.embedding ? getEmbeddingModel() : undefined,
  });
  onChange();
}
