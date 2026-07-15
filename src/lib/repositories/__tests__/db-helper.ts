import { vi } from "vite-plus/test";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

// Hoisted handle so the vi.mock factory (which runs before top-level imports
// resolve) can close over a stable reference. The actual DB is assigned in
// setupTestDB, so repo calls during tests see the real test DB.
const testDB = vi.hoisted<{ db: BetterSQLite3Database<typeof schema> | null }>(() => ({
  db: null,
}));

vi.mock("@/db", () => ({
  getDB: () => {
    if (!testDB.db) throw new Error("testDB not initialized — call setupTestDB() in beforeAll");
    return testDB.db;
  },
}));

let sqlite: Database.Database | null = null;

export async function setupTestDB() {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  // better-sqlite3's drizzle driver has no native `.batch()` (unlike D1), so
  // `runBatch` (which calls `getDB().batch(...)`) can't run against this test
  // DB out of the box. Shim it by executing each statement sequentially and
  // stopping at the first failure — enough to exercise `runBatch`'s real
  // error path (e.g. a genuine unique-constraint violation) against this
  // in-memory DB; it doesn't need D1's cross-statement atomicity to do that.
  (db as unknown as { batch: (stmts: unknown[]) => Promise<unknown[]> }).batch = async (
    stmts: unknown[],
  ) => {
    const results: unknown[] = [];
    for (const stmt of stmts) results.push(await stmt);
    return results;
  };
  testDB.db = db;
}

export function resetTestDB() {
  if (!testDB.db) throw new Error("testDB not initialized");
  testDB.db.run(sql`DELETE FROM transactions`);
  testDB.db.run(sql`DELETE FROM recurring_templates`);
  testDB.db.run(sql`DELETE FROM categories`);
  testDB.db.run(sql`DELETE FROM chat_messages`);
  testDB.db.run(sql`DELETE FROM chat_sessions`);
  testDB.db.run(sql`DELETE FROM users`);
}

export function seedUser(id = "user_1") {
  if (!testDB.db) throw new Error("testDB not initialized");
  const email = `${id}@test.com`;
  testDB.db.run(
    sql`INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES (${id}, 'Test', ${email}, 0, 0, 0)`,
  );
}

export function closeTestDB() {
  sqlite?.close();
}
