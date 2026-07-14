import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Lazily-initialized Neon + Drizzle client. Lazy so that `next build` (which
 * imports route modules without env configured) doesn't crash; the first
 * actual query throws a clear error when DATABASE_URL is missing.
 */

type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and configure your Neon connection string.",
    );
  }
  _db = drizzle(neon(connectionString), { schema });
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Database = Db;
export * as schema from "./schema";
