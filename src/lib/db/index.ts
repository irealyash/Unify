import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type MutualDb = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

declare global {
  var __mutualDb: MutualDb | undefined;
}

function getDb(): MutualDb {
  if (globalThis.__mutualDb) return globalThis.__mutualDb;
  const instance = createDb();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__mutualDb = instance;
  }
  return instance;
}

export const db = new Proxy({} as MutualDb, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Database = MutualDb;
