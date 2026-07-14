# Hand-written Row schemas instead of Drizzle-derived ones

Status: accepted

`CategoryRow`/`TransactionRow`/`RecurringTemplateRow` in `src/lib/ai/tools/*.ts` hand-redeclare every DB column as a bare zod type, with no compile-time link to Drizzle's `$inferSelect` — a migration could silently desync the LLM-facing schema from the DB schema. We considered deriving them from the Drizzle table definitions instead, but Drizzle's bundled schema generation (`createSelectSchema` from `drizzle-orm/zod`, which supports the `.meta()` field descriptions the LLM reads as tool documentation) only ships starting at `drizzle-orm@1.0.0-beta.15+`. This repo pins the stable `drizzle-orm@^0.45.2` line, so the only way to get it today is either the separate, now-deprecated `drizzle-zod` package, or an unplanned jump onto Drizzle's pre-1.0 beta line touching every repository file and `drizzle-kit`.

We're accepting the hand-written duplication and its drift risk rather than pay either cost now.

**Revisit when:** `drizzle-orm` ships its zod schema generation on a stable (non-beta/rc) release this project can adopt as a normal upgrade.
