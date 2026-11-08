import { getGemini } from "./gemini";

/** Must match the vector(768) columns in the database. */
export const EMBEDDING_DIMENSIONS = 768;

export function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}

/** Embeds text into a unit-length vector, so cosine similarity is a plain dot product. */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot embed empty text");

  const response = await getGemini().models.embedContent({
    model: getEmbeddingModel(),
    contents: trimmed,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: "SEMANTIC_SIMILARITY",
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Embedding provider returned an unexpected vector");
  }
  return normalize(values);
}

/** Truncated Gemini embeddings aren't unit length; normalize before comparing. */
export function normalize(vector: number[]) {
  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((v) => v / length);
}

/** Cosine similarity of two unit-length vectors. */
export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

export function vectorToSqlLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
