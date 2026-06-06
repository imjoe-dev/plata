# Financial Schema Design

**Date:** 2026-06-05
**Status:** Approved

## Overview

Core financial data model for Plata — a multi-user personal finance tracker. Tables for categories, transactions, recurring templates, and LLM chat history. Follows the existing Drizzle ORM + D1 conventions (text PKs, `timestamp_ms` integers, `boolean` integers, soft deletes via `deleted_at`).

## Tables

### `categories`

User-defined and system-default transaction categories.

| Column       | Type                     | Notes                                                    |
| ------------ | ------------------------ | -------------------------------------------------------- |
| `id`         | `text`                   | PK                                                       |
| `name`       | `text` NOT NULL          | e.g. "Groceries", "Salary"                               |
| `type`       | `text` NOT NULL          | `expense`, `income`, `both`                              |
| `color`      | `text`                   | Hex color for UI                                         |
| `icon`       | `text`                   | Lucide icon name                                         |
| `user_id`    | `text`                   | FK → `users.id` ON DELETE CASCADE; NULL = system default |
| `created_at` | `integer` (timestamp_ms) | NOT NULL, auto-set                                       |
| `updated_at` | `integer` (timestamp_ms) | NOT NULL, auto-on-update                                 |
| `deleted_at` | `integer` (timestamp_ms) | NULLABLE, soft delete                                    |

Indexes: `categories_userId_idx` on `user_id`.

### `transactions`

Every expense or income entry, regardless of source.

| Column                  | Type                     | Notes                                                                                                       |
| ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `id`                    | `text`                   | PK                                                                                                          |
| `amount`                | `integer` NOT NULL       | Signed integer in cents (positive = income, negative = expense). Sign tracks direction; `type` is semantic. |
| `currency`              | `text` NOT NULL          | ISO 4217, default `"USD"`                                                                                   |
| `type`                  | `text` NOT NULL          | `expense`, `income` (semantic, mirrors sign)                                                                |
| `description`           | `text` NOT NULL          | e.g. "Netflix subscription"                                                                                 |
| `date`                  | `integer` NOT NULL       | When the transaction occurred (timestamp_ms)                                                                |
| `category_id`           | `text`                   | FK → `categories.id` ON DELETE SET NULL                                                                     |
| `user_id`               | `text` NOT NULL          | FK → `users.id` ON DELETE CASCADE                                                                           |
| `recurring_template_id` | `text`                   | FK → `recurring_templates.id` ON DELETE SET NULL; tracks origin for template-generated txns                 |
| `source`                | `text` NOT NULL          | `manual`, `chat`, `csv_import`                                                                              |
| `notes`                 | `text`                   | Optional additional detail                                                                                  |
| `created_at`            | `integer` (timestamp_ms) | NOT NULL, auto-set                                                                                          |
| `updated_at`            | `integer` (timestamp_ms) | NOT NULL, auto-on-update                                                                                    |
| `deleted_at`            | `integer` (timestamp_ms) | NULLABLE, soft delete                                                                                       |

Indexes: `transactions_userId_idx` on `user_id`, `transactions_userId_date_idx` on `(user_id, date)`, `transactions_userId_categoryId_idx` on `(user_id, category_id)`.

### `recurring_templates`

Defines recurrence patterns that generate transactions.

| Column                | Type                     | Notes                                                           |
| --------------------- | ------------------------ | --------------------------------------------------------------- |
| `id`                  | `text`                   | PK                                                              |
| `amount`              | `integer` NOT NULL       | Cents (positive for income, negative for expense)               |
| `currency`            | `text` NOT NULL          | ISO 4217, default `"USD"`                                       |
| `type`                | `text` NOT NULL          | `expense`, `income`                                             |
| `description`         | `text` NOT NULL          | e.g. "Netflix monthly"                                          |
| `category_id`         | `text`                   | FK → `categories.id` ON DELETE SET NULL                         |
| `cadence`             | `text` NOT NULL          | `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly` |
| `next_due_date`       | `integer` (timestamp_ms) | Next generation date                                            |
| `last_insertion_date` | `integer` (timestamp_ms) | When the last transaction was generated                         |
| `status`              | `text` NOT NULL          | `active`, `paused`, `completed`, `failed`                       |
| `start_date`          | `integer` (timestamp_ms) | When recurrence begins                                          |
| `end_date`            | `integer` (timestamp_ms) | NULLABLE; when recurrence ends (sets status → `completed`)      |
| `user_id`             | `text` NOT NULL          | FK → `users.id` ON DELETE CASCADE                               |
| `created_at`          | `integer` (timestamp_ms) | NOT NULL, auto-set                                              |
| `updated_at`          | `integer` (timestamp_ms) | NOT NULL, auto-on-update                                        |
| `deleted_at`          | `integer` (timestamp_ms) | NULLABLE, soft delete                                           |

Indexes: `recurring_templates_userId_idx` on `user_id`, `recurring_templates_userId_status_idx` on `(user_id, status)`.

### `chat_sessions`

LLM chat threads for transaction logging.

| Column       | Type                     | Notes                                        |
| ------------ | ------------------------ | -------------------------------------------- |
| `id`         | `text`                   | PK                                           |
| `title`      | `text` NOT NULL          | Auto-generated or user-provided session name |
| `user_id`    | `text` NOT NULL          | FK → `users.id` ON DELETE CASCADE            |
| `created_at` | `integer` (timestamp_ms) | NOT NULL, auto-set                           |
| `updated_at` | `integer` (timestamp_ms) | NOT NULL, auto-on-update                     |
| `deleted_at` | `integer` (timestamp_ms) | NULLABLE, soft delete                        |

Indexes: `chat_sessions_userId_idx` on `user_id`.

### `chat_messages`

Individual messages within a chat session.

| Column       | Type                     | Notes                                     |
| ------------ | ------------------------ | ----------------------------------------- |
| `id`         | `text`                   | PK                                        |
| `session_id` | `text` NOT NULL          | FK → `chat_sessions.id` ON DELETE CASCADE |
| `role`       | `text` NOT NULL          | `user`, `assistant`                       |
| `content`    | `text` NOT NULL          | Message body                              |
| `created_at` | `integer` (timestamp_ms) | NOT NULL, auto-set                        |
| `updated_at` | `integer` (timestamp_ms) | NOT NULL, auto-on-update                  |
| `deleted_at` | `integer` (timestamp_ms) | NULLABLE, soft delete                     |

Indexes: `chat_messages_sessionId_idx` on `session_id`.

## Relationships (Drizzle Relations)

```
categories.userId → users.id          CASCADE
transactions.userId → users.id        CASCADE
transactions.categoryId → categories.id  SET NULL
transactions.recurringTemplateId → recurring_templates.id  SET NULL
recurring_templates.userId → users.id CASCADE
recurring_templates.categoryId → categories.id  SET NULL
chat_sessions.userId → users.id       CASCADE
chat_messages.sessionId → chat_sessions.id  CASCADE
```

## Conventions

- **ID format:** `text` (nanoid/uuid), matching existing auth tables
- **Timestamps:** `integer` with `{ mode: "timestamp_ms" }`, default `(cast(unixepoch('subsecond') * 1000 as integer))`
- **Booleans:** `integer` with `{ mode: "boolean" }`, matching existing auth convention
- **Soft deletes:** `deleted_at` nullable timestamp
- **Amounts:** Signed integer cents (negative = expense, positive = income)
- **TS variable names:** camelCase; **DB column names:** snake_case
- **Table names:** snake_case plural

## What's Not Included

- Reports table (generated on-the-fly from transaction queries)
- Budgets / limits (out of scope for this schema)
- Accounts / payment methods (out of scope for v1)

## Test Strategy

- Verify all tables create successfully against a D1-compatible dialect
- Confirm cascading deletes and set-null behavior
- Validate that existing auth tables remain unchanged
