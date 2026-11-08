import type { MatchSummary } from "@unify/shared";
import { errorMessage, geminiLimit } from "./ai/gemini";
import { templateMatchSummary, writeMatchSummary } from "./ai/match";
import type { Player, Room } from "./rooms";

/** Longest a student waits for Gemini before getting the plain comparison instead. */
const GEMINI_WAIT_MS = 15_000;

/**
 * Why `target` suits `viewer`, written the first time they look and reused after that. Only
 * Gemini's summaries are kept, so a temporary failure gets another try on the next click.
 */
export function matchSummary(room: Room, viewer: Player, target: Player): Promise<MatchSummary> {
  const key = `${viewer.id}:${target.id}`;
  const existing = room.matchSummaries.get(key);
  if (existing) return existing;

  const job = buildSummary(room, viewer, target);
  room.matchSummaries.set(key, job);
  void job.then((summary) => {
    if (summary.source !== "gemini") room.matchSummaries.delete(key);
  });
  return job;
}

async function buildSummary(room: Room, viewer: Player, target: Player): Promise<MatchSummary> {
  if (!viewer.answers || !target.answers) {
    const missing = target.answers ? "You haven't" : `${target.name} hasn't`;
    return { text: `${missing} filled in the questionnaire, so there's nothing to compare yet.`, source: "template" };
  }
  const fallback = () => templateMatchSummary(viewer.answers!, target.answers!, target.name);
  if (!process.env.GEMINI_API_KEY) return fallback();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([
      geminiLimit(() =>
        writeMatchSummary(
          { answers: viewer.answers!, placement: viewer.placement },
          { name: target.name, answers: target.answers! },
        ),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timed out")), GEMINI_WAIT_MS);
      }),
    ]);
    return { text, source: "gemini" };
  } catch (err) {
    console.warn(`[match ${room.code}] using the plain comparison: ${errorMessage(err)}`);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
