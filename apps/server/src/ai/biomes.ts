import { BIOMES, type BiomeId } from "@unify/shared";
import { sql } from "../db";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "./embeddings";
import { errorMessage, geminiLimit, withRetry } from "./gemini";

export type BiomeVectors = Map<BiomeId, number[]>;

let loading: Promise<BiomeVectors> | null = null;

/**
 * Embedding of each biome's ideal-member profile. Cached in memory and in the `biomes`
 * table, and only re-embedded when a biome's text or the embedding model changes.
 */
export function getBiomeVectors(): Promise<BiomeVectors> {
  loading ??= loadBiomeVectors().catch((err: unknown) => {
    loading = null; // let the next sort try again
    throw err;
  });
  return loading;
}

async function loadBiomeVectors(): Promise<BiomeVectors> {
  const model = getEmbeddingModel();
  const vectors: BiomeVectors = new Map();
  const cached = await readCached(model);

  for (const biome of BIOMES) {
    const hit = cached.get(biome.id);
    if (hit && hit.profile === biome.profile) {
      vectors.set(biome.id, hit.embedding);
      continue;
    }
    const embedding = await geminiLimit(() =>
      withRetry(() => embedText(biome.profile), { label: `embed biome ${biome.id}` }),
    );
    vectors.set(biome.id, embedding);
    await saveCached(biome.id, biome.name, biome.profile, embedding, model);
  }

  console.log(`[biomes] vectors ready for ${[...vectors.keys()].join(", ")}`);
  return vectors;
}

async function readCached(model: string) {
  const out = new Map<string, { profile: string; embedding: number[] }>();
  if (!sql) return out;
  try {
    const rows = await sql<{ id: string; profile: string; embedding: string }[]>`
      SELECT id, profile, embedding::text AS embedding
      FROM biomes WHERE embedding_model = ${model} AND embedding IS NOT NULL
    `;
    for (const row of rows) {
      out.set(row.id, { profile: row.profile, embedding: JSON.parse(row.embedding) as number[] });
    }
  } catch (err) {
    console.warn(`[biomes] couldn't read cached vectors: ${errorMessage(err)}`);
  }
  return out;
}

async function saveCached(
  id: string,
  name: string,
  profile: string,
  embedding: number[],
  model: string,
) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO biomes (id, name, profile, embedding, embedding_model)
      VALUES (${id}, ${name}, ${profile}, ${vectorToSqlLiteral(embedding)}::vector, ${model})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, profile = EXCLUDED.profile, embedding = EXCLUDED.embedding,
        embedding_model = EXCLUDED.embedding_model, updated_at = now()
    `;
  } catch (err) {
    console.warn(`[biomes] couldn't cache vector for ${id}: ${errorMessage(err)}`);
  }
}
