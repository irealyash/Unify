import {
  cosineDistanceToDisplayScore,
  mutualDisplayScore,
  mutualHarmonicMean,
} from "./scores";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(cosineDistanceToDisplayScore(0) === 100, "distance 0 => 100%");
assert(cosineDistanceToDisplayScore(1) === 0, "distance 1 => 0%");
assert(cosineDistanceToDisplayScore(0.25) === 75, "distance 0.25 => 75%");

assert(mutualHarmonicMean(0.9, 0.9) > mutualHarmonicMean(0.95, 0.2), "balanced > one-sided");
assert(mutualHarmonicMean(0, 0) === 0, "zero-safe");
assert(mutualDisplayScore(1, 1) === 100, "perfect mutual");

console.log("score tests passed");
