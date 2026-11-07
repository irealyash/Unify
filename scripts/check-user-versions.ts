import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT pv.user_id, pv.assistant_type, pv.version, u.username, u.clerk_user_id
    FROM profile_versions pv
    JOIN users u ON u.id = pv.user_id
    WHERE pv.user_id = '78dd0c7e-012f-4b1a-9625-c9b31dfda1e3'
    ORDER BY pv.assistant_type, pv.version
  `;
  console.log(rows);

  const profile = await sql`
    SELECT user_id, self_version, seeking_version, onboarding_completed_at,
           left(self_text, 40) as self_preview,
           left(seeking_text, 40) as seeking_preview,
           self_embedding IS NOT NULL as has_self_emb,
           seeking_embedding IS NOT NULL as has_seeking_emb
    FROM user_profiles
    WHERE user_id = '78dd0c7e-012f-4b1a-9625-c9b31dfda1e3'
  `;
  console.log(profile);
}

main().catch(console.error);
