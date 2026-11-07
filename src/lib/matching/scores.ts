import { clamp } from "@/lib/utils";

/**
 * Centralized semantic score conversion.
 * cosine_similarity = 1 - cosine_distance
 * display_score = clamp(round(cosine_similarity * 100), 0, 100)
 *
 * These percentages are semantic compatibility scores, not calibrated probabilities.
 */
export function cosineDistanceToSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return 1 - distance;
}

export function similarityToDisplayScore(similarity: number): number {
  if (!Number.isFinite(similarity)) return 0;
  return clamp(Math.round(similarity * 100), 0, 100);
}

export function cosineDistanceToDisplayScore(distance: number): number {
  return similarityToDisplayScore(cosineDistanceToSimilarity(distance));
}

/**
 * Harmonic mean of two directional similarities.
 * Rewards balanced mutual compatibility over one-sided matches.
 */
export function mutualHarmonicMean(scoreAB: number, scoreBA: number): number {
  if (!Number.isFinite(scoreAB) || !Number.isFinite(scoreBA)) return 0;
  const a = Math.max(0, scoreAB);
  const b = Math.max(0, scoreBA);
  const sum = a + b;
  if (sum === 0) return 0;
  return (2 * a * b) / sum;
}

export function mutualDisplayScore(scoreAB: number, scoreBA: number): number {
  return similarityToDisplayScore(mutualHarmonicMean(scoreAB, scoreBA));
}
