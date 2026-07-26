import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

import { CURRENCY_VALUES } from "@/lib/currency";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  email_verified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ip_address: text("ip_address"),
    user_agent: text("user_agent"),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.user_id)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    provider_id: text("provider_id").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    id_token: text("id_token"),
    access_token_expires_at: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refresh_token_expires_at: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.user_id)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type", { enum: ["expense", "income", "both"] }).notNull(),
    color: text("color"),
    icon: text("icon"),
    user_id: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("categories_user_id_idx").on(table.user_id),
    unique("categories_name_user_id_unique").on(table.name, table.user_id),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    currency: text("currency", { enum: [...CURRENCY_VALUES] })
      .notNull()
      .default("USD"),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    description: text("description").notNull(),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    category_id: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recurring_template_id: text("recurring_template_id").references(() => recurring_templates.id, {
      onDelete: "set null",
    }),
    source: text("source", {
      enum: ["manual", "chat", "csv_import"],
    }).notNull(),
    notes: text("notes"),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("transactions_user_id_idx").on(table.user_id),
    index("transactions_user_id_date_idx").on(table.user_id, table.date),
    index("transactions_user_id_created_at_idx").on(table.user_id, table.created_at),
    index("transactions_user_id_category_id_idx").on(table.user_id, table.category_id),
    uniqueIndex("transactions_recurring_template_due_unique")
      .on(table.recurring_template_id, table.date)
      .where(sql`${table.recurring_template_id} IS NOT NULL`),
  ],
);

export const recurring_templates = sqliteTable(
  "recurring_templates",
  {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    currency: text("currency", { enum: [...CURRENCY_VALUES] })
      .notNull()
      .default("USD"),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    description: text("description").notNull(),
    category_id: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    cadence: text("cadence", {
      enum: ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"],
    }).notNull(),
    next_due_date: integer("next_due_date", { mode: "timestamp_ms" }),
    last_insertion_date: integer("last_insertion_date", {
      mode: "timestamp_ms",
    }),
    status: text("status", {
      enum: ["active", "paused", "completed", "failed"],
    }).notNull(),
    start_date: integer("start_date", { mode: "timestamp_ms" }),
    end_date: integer("end_date", { mode: "timestamp_ms" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("recurring_templates_user_id_idx").on(table.user_id),
    index("recurring_templates_user_id_status_idx").on(table.user_id, table.status),
    index("recurring_templates_status_next_due_date_idx").on(table.status, table.next_due_date),
  ],
);

export const chat_sessions = sqliteTable(
  "chat_sessions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("chat_sessions_user_id_idx").on(table.user_id),
    // Serves the History list query: sessions by user, ordered by most recent Activity.
    index("chat_sessions_user_id_updated_at_idx").on(table.user_id, table.updated_at),
  ],
);

export const chat_messages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    session_id: text("session_id")
      .notNull()
      .references(() => chat_sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("chat_messages_session_id_idx").on(table.session_id),
    index("chat_messages_session_id_created_at_idx").on(table.session_id, table.created_at),
  ],
);

export const user_preferences = sqliteTable("user_preferences", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  default_currency: text("default_currency", { enum: [...CURRENCY_VALUES] })
    .notNull()
    .default("USD"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const users_relations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
  chat_sessions: many(chat_sessions),
  preferences: one(user_preferences, {
    fields: [users.id],
    references: [user_preferences.user_id],
  }),
}));

export const user_preferences_relations = relations(user_preferences, ({ one }) => ({
  user: one(users, {
    fields: [user_preferences.user_id],
    references: [users.id],
  }),
}));

export const sessions_relations = relations(sessions, ({ one }) => ({
  users: one(users, {
    fields: [sessions.user_id],
    references: [users.id],
  }),
}));

export const accounts_relations = relations(accounts, ({ one }) => ({
  users: one(users, {
    fields: [accounts.user_id],
    references: [users.id],
  }),
}));

export const categories_relations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.user_id],
    references: [users.id],
  }),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
}));

export const transactions_relations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.user_id],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.category_id],
    references: [categories.id],
  }),
  recurring_template: one(recurring_templates, {
    fields: [transactions.recurring_template_id],
    references: [recurring_templates.id],
  }),
}));

export const recurring_templates_relations = relations(recurring_templates, ({ one, many }) => ({
  user: one(users, {
    fields: [recurring_templates.user_id],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [recurring_templates.category_id],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));

export const chat_sessions_relations = relations(chat_sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chat_sessions.user_id],
    references: [users.id],
  }),
  messages: many(chat_messages),
}));

export const chat_messages_relations = relations(chat_messages, ({ one }) => ({
  session: one(chat_sessions, {
    fields: [chat_messages.session_id],
    references: [chat_sessions.id],
  }),
}));
