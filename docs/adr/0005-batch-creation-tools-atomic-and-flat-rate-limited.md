# Batch-creation tools are two separate, all-or-nothing, single-rate-limit-unit tools

Status: accepted

`create_transactions` and `create_recurring_templates` let the LLM create several rows in one user-approved action instead of one `create_transaction`/`create_recurring_template` call (and approval) per row. Three decisions here would otherwise surprise a future reader.

**Two tools, not one unified batch tool.** A single tool taking a discriminated-union array (`{kind: "transaction" | "recurring_template", ...}`) was considered and rejected: the two resources have diverging shapes (cadence, start/end dates vs. a plain date) and the motivating scenario — several one-time transactions described in one chat message — never needs to mix in a recurring template within the same call. Two tools mirror the existing 1:1 split between the singular `create_transaction`/`create_recurring_template` tools instead of introducing a new shape.

**All-or-nothing, not best-effort partial success.** Both tools validate every item up front (the same existence checks the singular services already run) before inserting anything, then insert all rows in one atomic operation via the existing `runBatch` helper (`src/lib/db/transaction.ts`, previously used only by the recurring-template materialization sweep). A batch is a single approved action from the user's perspective; silently creating 4 of 5 approved rows because the 5th referenced a bad category is a worse surprise than the whole call failing loudly with an error identifying which item was invalid, which the LLM can fix and retry.

**Rate limiting costs one unit per call, not one unit per item.** `checkRateLimit` guards burst _tool-invocation_ volume, not row count — a legitimate "log my 8 receipts from today" batch shouldn't cost 8x what one manual entry costs. This means a 20-item batch and a 1-item batch cost the same as each other and the same as a single `create_transaction` call.

Because `created_at`/`updated_at` are SQL-side defaults (`unixepoch()`), returning full rows from the atomic insert required extending `runBatch` to add `.returning()` to its statements and return the array of per-statement results instead of `{ success: true }`. This is a signature change to a shared helper, but its only other caller (the materialization sweep) never used the return value, so it's additive rather than breaking.

**Revisit when:** a scenario emerges where partial success is actually desirable (e.g. importing a large, untrusted list where losing the whole batch to one bad row is worse than skipping it) — at that point the all-or-nothing guarantee here would need to be relaxed deliberately, not assumed away.
