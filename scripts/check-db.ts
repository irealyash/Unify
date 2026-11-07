import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = neon(url);

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log(
    "tables:",
    tables.map((t) => t.table_name).join(", "),
  );

  const enums = await sql`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e'
    ORDER BY typname
  `;
  console.log(
    "enums:",
    enums.map((e) => e.typname).join(", "),
  );

  const cols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'profile_versions'
    ORDER BY ordinal_position
  `;
  console.log("profile_versions cols:", cols);

  try {
    await sql`
      INSERT INTO profile_versions (user_id, assistant_type, profile_text, version)
      SELECT id, 'self', 'probe', 999999
      FROM users
      LIMIT 1
    `;
    await sql`DELETE FROM profile_versions WHERE version = 999999`;
    console.log("insert probe: ok");
  } catch (e) {
    console.log("insert probe failed:", e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
