import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT
      u.id,
      u.username,
      u.clerk_user_id,
      u.display_name,
      u.created_at,
      p.onboarding_completed_at,
      length(p.self_text) as self_len,
      length(p.seeking_text) as seeking_len,
      p.self_embedding IS NOT NULL as has_self_emb,
      p.seeking_embedding IS NOT NULL as has_seeking_emb,
      p.embedding_model
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT 20
  `;
  console.log(JSON.stringify(rows, null, 2));
}
main().catch(console.error);
