import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    DO $$ BEGIN
      CREATE TYPE question_type AS ENUM ('multiple_choice', 'free_text');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // Old Clerk-era `users` table conflicts with Auth0 users — archive it once.
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'clerk_user_id'
      ) THEN
        ALTER TABLE users RENAME TO users_clerk_legacy;
      END IF;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth0_sub text NOT NULL,
      email text NOT NULL DEFAULT '',
      name text NOT NULL DEFAULT '',
      picture_url text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_auth0_sub_uidx ON users (auth0_sub)`;

  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL,
      code_normalized text NOT NULL,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS groups_code_normalized_uidx ON groups (code_normalized)`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS group_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      sort_order integer NOT NULL DEFAULT 0,
      prompt text NOT NULL,
      question_type question_type NOT NULL DEFAULT 'multiple_choice',
      options jsonb NOT NULL DEFAULT '[]'::jsonb,
      required boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS group_questions_group_idx ON group_questions (group_id, sort_order)`;

  await sql`
    CREATE TABLE IF NOT EXISTS biomes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      style_summary text NOT NULL,
      theme_key text NOT NULL DEFAULT 'forest',
      centroid_embedding vector(768),
      embedding_model text NOT NULL DEFAULT 'gemini-embedding-001',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS biomes_group_idx ON biomes (group_id)`;
  await sql`
    DO $$ BEGIN
      CREATE INDEX biomes_centroid_idx ON biomes USING hnsw (centroid_embedding vector_cosine_ops);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      biome_id uuid REFERENCES biomes(id) ON DELETE SET NULL,
      official_name text NOT NULL,
      session_token text NOT NULL,
      free_text text NOT NULL DEFAULT '',
      working_style_text text NOT NULL DEFAULT '',
      embedding vector(768),
      embedding_model text NOT NULL DEFAULT 'gemini-embedding-001',
      quiz_completed_at timestamptz,
      reused_answers boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE participants ADD COLUMN IF NOT EXISTS reused_answers boolean NOT NULL DEFAULT false`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS participants_session_token_uidx ON participants (session_token)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS participants_group_user_uidx ON participants (group_id, user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS participants_group_idx ON participants (group_id)`;
  await sql`CREATE INDEX IF NOT EXISTS participants_biome_idx ON participants (biome_id)`;
  await sql`CREATE INDEX IF NOT EXISTS participants_user_idx ON participants (user_id)`;
  await sql`
    DO $$ BEGIN
      CREATE INDEX participants_embedding_idx ON participants USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS participant_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES group_questions(id) ON DELETE CASCADE,
      selected_option_id text,
      free_text_answer text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS participant_answers_unique_uidx
    ON participant_answers (participant_id, question_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_answer_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint text NOT NULL,
      answers jsonb NOT NULL DEFAULT '[]'::jsonb,
      working_style_text text NOT NULL DEFAULT '',
      embedding vector(768),
      embedding_model text NOT NULL DEFAULT 'gemini-embedding-001',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_answer_profiles_user_fp_uidx ON user_answer_profiles (user_id, fingerprint)`;
  await sql`CREATE INDEX IF NOT EXISTS user_answer_profiles_user_idx ON user_answer_profiles (user_id)`;

  console.log("Auth + group / quiz / biome schema ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
