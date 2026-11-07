import { getGemini } from "@/lib/gemini/client";

const DEFAULT_MODEL = "gemini-embedding-001";
const DEFAULT_DIMENSIONS = 768;

export function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_MODEL;
}

export function getEmbeddingDimensions() {
  const raw = process.env.GEMINI_EMBEDDING_DIMENSIONS;
  const parsed = raw ? Number(raw) : DEFAULT_DIMENSIONS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DIMENSIONS;
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed empty text");
  }

  const ai = getGemini();
  const model = getEmbeddingModel();
  const dimensions = getEmbeddingDimensions();

  const response = await ai.models.embedContent({
    model,
    contents: trimmed,
    config: {
      outputDimensionality: dimensions,
      taskType: "SEMANTIC_SIMILARITY",
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding provider returned an empty vector");
  }

  return embedding;
}

export function vectorToSqlLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
