import {
  BIOMES,
  BIOME_BY_ID,
  type BiomeId,
  type Placement,
  type QuizAnswers,
  type SortMethod,
} from "@unify/shared";
import { cosineSimilarity } from "./ai/embeddings";
import type { ProfileEffort } from "./ai/profile";

export type SortCandidate = {
  id: string;
  name: string;
  answers?: QuizAnswers;
  profile?: { text: string; effort: ProfileEffort };
  embedding?: number[];
};

export type SortOptions = {
  biomeVectors: Map<BiomeId, number[]> | null;
  /** Gemini fallback. Omit to never call the LLM (tests, or no API key). */
  chooseBiome?: (c: SortCandidate) => Promise<{ biome: BiomeId; reason: string }>;
  /** Top-two gap (in z-score units) below which a student counts as a close call. */
  closeCallMargin?: number;
  /** Share of the room the LLM may handle (beyond students it must handle). */
  llmShare?: number;
  /** Biome cap = ceil(students / biomes × slack). */
  balanceSlack?: number;
};

export type SortResult = {
  placements: Map<string, Placement>;
  /** Per-student scores for logging and the host view. */
  details: Array<{ name: string; method: SortMethod; biome: BiomeId; margin: number | null }>;
};

/** Below this many students, z-scores are meaningless; fall back to raw similarity. */
const MIN_FOR_CALIBRATION = 4;
/** Close-call threshold used on raw cosine similarity for tiny rooms. */
const RAW_CLOSE_CALL = 0.015;
const MIN_LLM_BUDGET = 3;

type Entry = {
  id: string;
  name: string;
  /** Biomes in order of preference. Empty for students with no answers. */
  prefs: BiomeId[];
  method: SortMethod;
  reason: string;
  /** Higher = more clear-cut = placed earlier during balancing. */
  priority: number;
  margin: number | null;
};

/**
 * Sorts students into biomes:
 *  1. Cosine similarity of each self vector to each biome vector.
 *  2. Calibrated within the room (z-score per biome), so the split is relative to this class.
 *  3. Close calls, low-effort/joke answers and students without a vector go to the LLM,
 *     capped to a small share of the room.
 *  4. Balancing: biomes are capped; clear-cut students are placed first, so borderline
 *     students are the ones who move to their next-best biome.
 */
export async function sortStudents(
  students: SortCandidate[],
  options: SortOptions,
): Promise<SortResult> {
  const {
    biomeVectors,
    chooseBiome,
    closeCallMargin = 0.3,
    llmShare = 0.25,
    balanceSlack = 1.25,
  } = options;
  const ids = BIOMES.map((b) => b.id);

  // 1–2. Scores for everyone with a usable vector.
  const vectorStudents = biomeVectors
    ? students.filter((s) => s.embedding && s.answers)
    : [];
  const raw = vectorStudents.map((s) =>
    ids.map((id) => cosineSimilarity(s.embedding!, biomeVectors!.get(id)!)),
  );
  const calibrated = vectorStudents.length >= MIN_FOR_CALIBRATION;
  const scores = calibrated ? zScoreColumns(raw) : raw;
  const threshold = calibrated ? closeCallMargin : RAW_CLOSE_CALL;

  const scored = new Map<string, { prefs: BiomeId[]; margin: number }>();
  vectorStudents.forEach((s, i) => {
    const row = scores[i]!;
    const order = ids.map((id, j) => ({ id, score: row[j]! })).sort((a, b) => b.score - a.score);
    scored.set(s.id, {
      prefs: order.map((o) => o.id),
      margin: order.length > 1 ? order[0]!.score - order[1]!.score : Infinity,
    });
  });

  // 3. Who goes to the LLM.
  const mustAsk = students.filter((s) => s.answers && !scored.has(s.id));
  const mayAsk = vectorStudents
    .map((s) => {
      const effort = s.profile?.effort;
      const lowSignal = effort === "low_effort" || effort === "joke";
      const margin = scored.get(s.id)!.margin;
      return { s, lowSignal, margin, close: margin < threshold };
    })
    .filter((x) => x.lowSignal || x.close)
    .sort((a, b) => Number(b.lowSignal) - Number(a.lowSignal) || a.margin - b.margin)
    .map((x) => x.s);
  const budget = Math.max(MIN_LLM_BUDGET, Math.ceil(students.length * llmShare));
  const askLlm = chooseBiome
    ? [...mustAsk, ...mayAsk.slice(0, Math.max(0, budget - mustAsk.length))]
    : [];

  const llmPicks = new Map<string, { biome: BiomeId; reason: string }>();
  await Promise.all(
    askLlm.map(async (s) => {
      try {
        llmPicks.set(s.id, await chooseBiome!(s));
      } catch (err) {
        console.warn(`[sort] LLM fallback failed for ${s.name}: ${String(err)}`);
      }
    }),
  );

  // Build each student's preference list and how they were decided.
  const entries: Entry[] = students.map((s) => {
    const vector = scored.get(s.id);
    const pick = llmPicks.get(s.id);
    if (pick) {
      const rest = (vector?.prefs ?? rulesPrefs(s.answers)).filter((id) => id !== pick.biome);
      return entry(s, [pick.biome, ...rest], "llm", pick.reason, 1, vector?.margin ?? null);
    }
    if (vector) {
      const first = BIOME_BY_ID.get(vector.prefs[0]!)!;
      return entry(
        s,
        vector.prefs,
        "vector",
        `Your working style lines up with ${first.name}: ${first.tagline.toLowerCase()}`,
        2 + vector.margin,
        vector.margin,
      );
    }
    if (s.answers) {
      const prefs = rulesPrefs(s.answers);
      const first = BIOME_BY_ID.get(prefs[0]!)!;
      return entry(s, prefs, "rules", `Your answers point toward ${first.name}: ${first.tagline.toLowerCase()}`, 0, null);
    }
    return entry(s, [], "filler", "", -1, null);
  });

  // 4. Balance: clear-cut first, then LLM-decided, then rules, then students with no answers.
  const cap = Math.max(1, Math.ceil((students.length / ids.length) * balanceSlack));
  const counts = new Map<BiomeId, number>(ids.map((id) => [id, 0]));
  const placements = new Map<string, Placement>();
  const details: SortResult["details"] = [];

  for (const e of [...entries].sort((a, b) => b.priority - a.priority)) {
    let biome = e.prefs.find((id) => counts.get(id)! < cap);
    let { method, reason } = e;

    if (!biome) {
      biome = smallest(ids, counts);
      if (method === "filler") {
        reason = `You joined ${BIOME_BY_ID.get(biome)!.name} to keep the groups balanced.`;
      } else {
        method = "rebalanced";
        reason = `The groups were full, so you joined ${BIOME_BY_ID.get(biome)!.name} to keep them balanced.`;
      }
    } else if (biome !== e.prefs[0]) {
      method = "rebalanced";
      reason = `${BIOME_BY_ID.get(e.prefs[0]!)!.name} filled up, and ${BIOME_BY_ID.get(biome)!.name} was your next-closest fit.`;
    }

    counts.set(biome, counts.get(biome)! + 1);
    placements.set(e.id, { biome, method, reason });
    details.push({ name: e.name, method, biome, margin: e.margin });
  }

  return { placements, details };
}

function entry(
  s: SortCandidate,
  prefs: BiomeId[],
  method: SortMethod,
  reason: string,
  priority: number,
  margin: number | null,
): Entry {
  return { id: s.id, name: s.name, prefs, method, reason, priority, margin };
}

/** Standardizes each biome's column so scores are relative to this room. */
function zScoreColumns(rows: number[][]): number[][] {
  const cols = rows[0]?.length ?? 0;
  const stats = Array.from({ length: cols }, (_, j) => {
    const values = rows.map((r) => r[j]!);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    return { mean, std: Math.max(Math.sqrt(variance), 1e-6) };
  });
  return rows.map((r) => r.map((v, j) => (v - stats[j]!.mean) / stats[j]!.std));
}

/** Last-resort preference order from multiple-choice answers alone. */
function rulesPrefs(answers: QuizAnswers | undefined): BiomeId[] {
  return BIOMES.map((b, index) => ({
    id: b.id,
    index,
    hits: Object.entries(b.answerHints).filter(([q, options]) =>
      options.includes(answers?.[q] ?? ""),
    ).length,
  }))
    .sort((a, b) => b.hits - a.hits || a.index - b.index)
    .map((x) => x.id);
}

function smallest(ids: BiomeId[], counts: Map<BiomeId, number>) {
  return ids.reduce((best, id) => (counts.get(id)! < counts.get(best)! ? id : best), ids[0]!);
}
