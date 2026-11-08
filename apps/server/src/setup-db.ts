import { setupDatabase, sql } from "./db";

if (!sql) {
  console.error("DATABASE_URL is not set. Add it to .env first.");
  process.exit(1);
}

try {
  await setupDatabase(sql);
  const [row] = await sql<{ version: string }[]>`
    SELECT extversion AS version FROM pg_extension WHERE extname = 'vector'
  `;
  console.log(`Database ready (pgvector ${row?.version ?? "missing"}).`);
} catch (err) {
  console.error("Database setup failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
