import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "@/lib/embeddings";

export type EmbeddingSide = "self" | "seeking";

export async function regenerateEmbedding(userId: string, side: EmbeddingSide) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new Error("Profile not found");
  }

  const text = side === "self" ? profile.selfText : profile.seekingText;
  if (!text.trim()) {
    throw new Error(`Cannot embed empty ${side} profile`);
  }

  const embedding = await embedText(text);
  const model = getEmbeddingModel();
  const literal = vectorToSqlLiteral(embedding);

  if (side === "self") {
    await db.execute(sql`
      UPDATE user_profiles
      SET
        self_embedding = ${literal}::vector,
        embedding_model = ${model},
        updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);
  } else {
    await db.execute(sql`
      UPDATE user_profiles
      SET
        seeking_embedding = ${literal}::vector,
        embedding_model = ${model},
        updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);
  }

  return { model, dimensions: embedding.length };
}

export async function regenerateBothEmbeddings(userId: string) {
  await regenerateEmbedding(userId, "self");
  await regenerateEmbedding(userId, "seeking");
}
