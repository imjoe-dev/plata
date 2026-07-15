import { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

describe("Database Migration - Recurring Materialization Indexes", () => {
  let sqlite: Database.Database;

  beforeAll(() => {
    sqlite = new Database(":memory:");
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(() => {
    sqlite.close();
  });

  it("creates partial unique index on transactions(recurring_template_id, date)", () => {
    const indexInfo = sqlite
      .prepare(
        `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name='transactions_recurring_template_due_unique'`,
      )
      .all() as Array<{ name: string; tbl_name: string }>;

    expect(indexInfo).toHaveLength(1);
    expect(indexInfo[0].name).toBe("transactions_recurring_template_due_unique");
    expect(indexInfo[0].tbl_name).toBe("transactions");
  });

  it("creates composite index on recurring_templates(status, next_due_date)", () => {
    const indexInfo = sqlite
      .prepare(
        `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name='recurring_templates_status_next_due_date_idx'`,
      )
      .all() as Array<{ name: string; tbl_name: string }>;

    expect(indexInfo).toHaveLength(1);
    expect(indexInfo[0].name).toBe("recurring_templates_status_next_due_date_idx");
    expect(indexInfo[0].tbl_name).toBe("recurring_templates");
  });

  it("verifies index uses correct columns", () => {
    const transactionIndexInfo = sqlite
      .prepare(`PRAGMA index_info(transactions_recurring_template_due_unique)`)
      .all() as Array<{ seqno: number; cid: number; name: string }>;

    expect(transactionIndexInfo).toHaveLength(2);
    expect(transactionIndexInfo[0].name).toBe("recurring_template_id");
    expect(transactionIndexInfo[1].name).toBe("date");

    const templateIndexInfo = sqlite
      .prepare(`PRAGMA index_info(recurring_templates_status_next_due_date_idx)`)
      .all() as Array<{ seqno: number; cid: number; name: string }>;

    expect(templateIndexInfo).toHaveLength(2);
    expect(templateIndexInfo[0].name).toBe("status");
    expect(templateIndexInfo[1].name).toBe("next_due_date");
  });

  it("enforces unique constraint on transactions index", () => {
    sqlite.exec(`INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
                 VALUES ('test_user', 'Test', 'test@example.com', 0, 0, 0)`);

    sqlite.exec(`INSERT INTO recurring_templates
                 (id, user_id, amount, currency, type, description, cadence, status, created_at, updated_at, next_due_date)
                 VALUES ('tpl_1', 'test_user', 1000, 'USD', 'expense', 'Test', 'monthly', 'active', 0, 0, 1000000)`);

    const now = Date.now();
    sqlite.exec(`INSERT INTO transactions
                 (id, user_id, amount, currency, type, description, date, source, recurring_template_id, created_at, updated_at)
                 VALUES ('txn_1', 'test_user', 1000, 'USD', 'expense', 'Test', ${now}, 'manual', 'tpl_1', ${now}, ${now})`);

    expect(() => {
      sqlite.exec(`INSERT INTO transactions
                   (id, user_id, amount, currency, type, description, date, source, recurring_template_id, created_at, updated_at)
                   VALUES ('txn_2', 'test_user', 1000, 'USD', 'expense', 'Test', ${now}, 'manual', 'tpl_1', ${now}, ${now})`);
    }).toThrow();
  });
});
