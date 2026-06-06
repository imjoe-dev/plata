# Financial Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add financial tables (categories, transactions, recurring_templates, chat_sessions, chat_messages) to the Drizzle schema and rename existing auth table TS variables from camelCase to snake_case.

**Architecture:** Single-file change to `src/db/schema.ts`. The schema is imported as a namespace in `src/db/index.ts`, so no consumer code needs updating. All tables follow the existing conventions: `text` PKs, `integer({ mode: "timestamp_ms" })` for dates, `integer({ mode: "boolean" })` for booleans, soft deletes via `deleted_at`, and Drizzle `relations()` for type-safe joins.

**Tech Stack:** Drizzle ORM (sqlite-core), Cloudflare D1

---

### Task 1: Rename auth table TS variable names to snake_case

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Rename `emailVerified` to `email_verified`**

In `src/db/schema.ts`, line 8, change:

```ts
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
```

To:

```ts
  email_verified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
```

- [ ] **Step 2: Rename `createdAt` to `created_at` in `users` table**

In `src/db/schema.ts`, lines 10-12, change:

```ts
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
```

To:

```ts
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
```

- [ ] **Step 3: Rename `updatedAt` to `updated_at` in `users` table**

In `src/db/schema.ts`, lines 13-16, change:

```ts
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
```

To:

```ts
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
```

- [ ] **Step 4: Rename session columns**

In `src/db/schema.ts`, rename the following in the `sessions` table:

- `expiresAt` (line 23) → `expires_at`
- `createdAt` (line 25) → `created_at`
- `updatedAt` (line 28) → `updated_at`
- `ipAddress` (line 31) → `ip_address`
- `userAgent` (line 32) → `user_agent`
- `userId` (line 33) → `user_id`

Also update the index reference on line 37 from `table.userId` to `table.user_id`:

```ts
  (table) => [index("sessions_userId_idx").on(table.user_id)],
```

And update the relation fields on line 95 from `sessions.userId` to `sessions.user_id`:

```ts
    fields: [sessions.user_id],
```

- [ ] **Step 5: Rename account columns**

In `src/db/schema.ts`, rename the following in the `accounts` table:

- `accountId` (line 44) → `account_id`
- `providerId` (line 45) → `provider_id`
- `userId` (line 46) → `user_id`
- `accessToken` (line 49) → `access_token`
- `refreshToken` (line 50) → `refresh_token`
- `idToken` (line 51) → `id_token`
- `accessTokenExpiresAt` (line 52) → `access_token_expires_at`
- `refreshTokenExpiresAt` (line 55) → `refresh_token_expires_at`
- `createdAt` (line 60) → `created_at`
- `updatedAt` (line 63) → `updated_at`

Also update the index reference on line 67 from `table.userId` to `table.user_id`:

```ts
  (table) => [index("accounts_userId_idx").on(table.user_id)],
```

And update the relation fields on line 102 from `accounts.userId` to `accounts.user_id`:

```ts
    fields: [accounts.user_id],
```

- [ ] **Step 6: Rename verification columns**

In `src/db/schema.ts`, rename the following in the `verifications` table:

- `expiresAt` (line 75) → `expires_at`
- `createdAt` (line 77) → `created_at`
- `updatedAt` (line 80) → `updated_at`

- [ ] **Step 7: Rename relation exports**

Rename relation export names:

- `usersRelations` (line 88) → `users_relations`
- `sessionsRelations` (line 93) → `sessions_relations`
- `accountsRelations` (line 100) → `accounts_relations`

- [ ] **Step 8: Run `vp check` to verify**

```bash
vp check
```

Expected: no type errors, no lint errors, formatting passes.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts
git commit -m "refactor: rename auth schema TS variables to snake_case"
```

---

### Task 2: Add categories table

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `categories` table definition**

Append after the existing tables, before the relations section. Add:

```ts
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
  (table) => [index("categories_user_id_idx").on(table.user_id)],
);
```

- [ ] **Step 2: Add `categories` relations**

Append after the existing relations:

```ts
export const categories_relations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.user_id],
    references: [users.id],
  }),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
}));
```

Note: this references `transactions` and `recurring_templates` which don't exist yet. Skip this step and come back after Task 3 and 4 to add the relations.

Actually, add just the `user` relation now (since `users` exists):

```ts
export const categories_relations = relations(categories, ({ one }) => ({
  user: one(users, {
    fields: [categories.user_id],
    references: [users.id],
  }),
}));
```

- [ ] **Step 3: Run `vp check` to verify**

```bash
vp check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add categories table"
```

---

### Task 3: Add transactions table

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `transactions` table definition**

Append after the `categories` table definition:

```ts
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
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
    index("transactions_user_id_category_id_idx").on(table.user_id, table.category_id),
  ],
);
```

- [ ] **Step 2: Add `transactions` relations**

Append after the categories relations:

```ts
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
```

Note: references `recurring_templates` which doesn't exist yet. Add the user and category relations now, and add the `recurring_template` relation in Task 4.

```ts
export const transactions_relations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.user_id],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.category_id],
    references: [categories.id],
  }),
}));
```

- [ ] **Step 3: Run `vp check` to verify**

```bash
vp check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add transactions table"
```

---

### Task 4: Add recurring_templates table

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `recurring_templates` table definition**

```ts
export const recurring_templates = sqliteTable(
  "recurring_templates",
  {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
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
  ],
);
```

- [ ] **Step 2: Add `recurring_templates` relations and backfill missing relations**

Add the recurring_templates relations:

```ts
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
```

Now update `transactions_relations` to include the `recurring_template` relation (replacing the one from Task 3):

```ts
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
```

Now update `categories_relations` to include `many` relations (replacing the one from Task 2):

```ts
export const categories_relations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.user_id],
    references: [users.id],
  }),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
}));
```

Also update `users_relations` to include the new tables:

```ts
export const users_relations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
  chat_sessions: many(chat_sessions),
}));
```

Note: `chat_sessions` doesn't exist yet — add it in Task 5. Leave it out for now.

- [ ] **Step 3: Run `vp check` to verify**

```bash
vp check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add recurring_templates table"
```

---

### Task 5: Add chat_sessions and chat_messages tables

**Files:**

- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `chat_sessions` table definition**

```ts
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
  (table) => [index("chat_sessions_user_id_idx").on(table.user_id)],
);
```

- [ ] **Step 2: Add `chat_messages` table definition**

```ts
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
  (table) => [index("chat_messages_session_id_idx").on(table.session_id)],
);
```

- [ ] **Step 3: Add chat relations**

```ts
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
```

- [ ] **Step 4: Update `users_relations` to include chat_sessions**

Update the `users_relations` to include `chat_sessions`:

```ts
export const users_relations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  recurring_templates: many(recurring_templates),
  chat_sessions: many(chat_sessions),
}));
```

- [ ] **Step 5: Run `vp check` to verify**

```bash
vp check
```

Expected: no type errors, no lint errors, formatting passes.

- [ ] **Step 6: Final commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add chat_sessions and chat_messages tables"
```

---

## Verification

After all tasks complete, run:

```bash
vp check
```

This will run formatting, linting (including type-aware), and type checking. All should pass.
