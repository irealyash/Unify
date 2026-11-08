import postgres from "postgres";
import type { Placement, QuizAnswers, Stage } from "@unify/shared";
import type { Profile } from "./ai/profile";
import { vectorToSqlLiteral } from "./ai/embeddings";

/**
 * Write-through persistence to Postgres + pgvector.
 *
 * Live rooms are served from memory (fast, simple); every meaningful change is also written
 * here so results survive restarts and can be queried with pgvector. When DATABASE_URL is
 * unset, every call is a no-op and the app still runs.
 */

const url = process.env.DATABASE_URL;
export const sql = url ? postgres(url, { max: 5, onnotice: () => {} }) : null;
export const hasDatabase = sql !== null;

/** Writes for one room run in order (a player row can't be written before its room row). */
const chains = new Map<string, Promise<unknown>>();

function enqueue(roomId: string, label: string, write: (db: postgres.Sql) => Promise<unknown>) {
  const db = sql;
  if (!db) return;
  const previous = chains.get(roomId) ?? Promise.resolve();
  const next = previous
    .then(() => write(db))
    .catch((err: unknown) => {
      console.error(`[db] ${label} failed:`, err instanceof Error ? err.message : err);
    });
  chains.set(roomId, next);
  void next.finally(() => {
    if (chains.get(roomId) === next) chains.delete(roomId);
  });
}

type RoomRow = { id: string; code: string; stage: Stage };
type PlayerRow = { id: string; name: string; quiz: string };

export const persist = {
  room(room: RoomRow) {
    enqueue(room.id, `save room ${room.code}`, (db) =>
      db`
        INSERT INTO rooms (id, code, stage)
        VALUES (${room.id}, ${room.code}, ${room.stage})
        ON CONFLICT (id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()
      `,
    );
  },

  player(roomId: string, player: PlayerRow) {
    enqueue(roomId, `save player ${player.name}`, (db) =>
      db`
        INSERT INTO players (id, room_id, name, quiz_status)
        VALUES (${player.id}, ${roomId}, ${player.name}, ${player.quiz})
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name, quiz_status = EXCLUDED.quiz_status, updated_at = now()
      `,
    );
  },

  removePlayer(roomId: string, playerId: string) {
    enqueue(roomId, `remove player ${playerId}`, (db) =>
      db`DELETE FROM players WHERE id = ${playerId}`,
    );
  },

  answers(roomId: string, playerId: string, answers: QuizAnswers) {
    enqueue(roomId, `save answers ${playerId}`, (db) =>
      db`
        UPDATE players
        SET answers = ${db.json(answers)}, quiz_status = 'processing',
            submitted_at = now(), updated_at = now()
        WHERE id = ${playerId}
      `,
    );
  },

  placement(roomId: string, playerId: string, placement: Placement) {
    enqueue(roomId, `save placement ${playerId}`, (db) =>
      db`
        UPDATE players
        SET biome = ${placement.biome}, sort_method = ${placement.method},
            sort_reason = ${placement.reason}, updated_at = now()
        WHERE id = ${playerId}
      `,
    );
  },

  profile(
    roomId: string,
    playerId: string,
    data: { status: string; profile?: Profile; embedding?: number[]; embeddingModel?: string },
  ) {
    const vector = data.embedding ? vectorToSqlLiteral(data.embedding) : null;
    enqueue(roomId, `save profile ${playerId}`, (db) =>
      db`
        UPDATE players
        SET quiz_status = ${data.status},
            profile = ${data.profile?.text ?? null},
            profile_effort = ${data.profile?.effort ?? null},
            profile_source = ${data.profile?.source ?? null},
            embedding = ${vector}::vector,
            embedding_model = ${data.embeddingModel ?? null},
            updated_at = now()
        WHERE id = ${playerId}
      `,
    );
  },
};

/** Creates the pgvector extension and tables. Safe to run repeatedly. */
export async function setupDatabase(db: postgres.Sql) {
  await db`CREATE EXTENSION IF NOT EXISTS vector`;
  await db`
    CREATE TABLE IF NOT EXISTS rooms (
      id uuid PRIMARY KEY,
      code text NOT NULL,
      stage text NOT NULL DEFAULT 'lobby',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms (code)`;
  await db`
    CREATE TABLE IF NOT EXISTS players (
      id uuid PRIMARY KEY,
      room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name text NOT NULL,
      quiz_status text NOT NULL DEFAULT 'answering',
      answers jsonb,
      profile text,
      profile_effort text,
      profile_source text,
      embedding vector(768),
      embedding_model text,
      biome text,
      submitted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS players_room_idx ON players (room_id)`;
  await db`ALTER TABLE players ADD COLUMN IF NOT EXISTS sort_method text`;
  await db`ALTER TABLE players ADD COLUMN IF NOT EXISTS sort_reason text`;
  await db`
    CREATE TABLE IF NOT EXISTS biomes (
      id text PRIMARY KEY,
      name text NOT NULL,
      profile text NOT NULL,
      embedding vector(768),
      embedding_model text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text,
      name text,
      picture text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`;
}
