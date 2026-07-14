import { z } from "zod";

import { dollarsToCentsSchema } from "@/lib/currency";

export const Transaction = z.object({
  amount: dollarsToCentsSchema,
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  date: z.coerce.date(),
  categoryId: z.string().nullable().optional(),
  recurringTemplateId: z.string().nullable().optional(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof Transaction>;

export const TransactionPatch = Transaction.omit({ currency: true })
  .partial()
  .extend({ currency: z.string().length(3).optional() });

export type TransactionPatch = z.infer<typeof TransactionPatch>;

/**
 * Wraps a schema so `null` and `""` are treated as "not provided" (normalized to `undefined`)
 * before the schema's own validation runs — e.g. the LLM chat tool sends explicit `null` for
 * filters it isn't using, and a bare `.optional()` field rejects that outright.
 *
 * Implemented with `z.preprocess`, but the returned schema's static type is recast to
 * `ZodOptional<ZodType<Output, Input | null | "">>`: Zod 4.4.3's `z.preprocess()` collapses
 * `z.input<>` to `unknown` once embedded inside a `z.object()` shape, which broke downstream
 * consumers (e.g. `ListTransactionsInput.shape.type` reused by the AI tool client) that rely on
 * `z.input<>` for their handler parameter types. The `ZodOptional` wrapper in the cast (rather
 * than a bare `ZodType`) is required too — without it, `z.object()` no longer recognizes the
 * key as optional and demands the property be present. The runtime behavior is untouched by
 * the cast — only the compile-time type is restored.
 *
 * Exported so schemas that independently redeclare a field (rather than reusing
 * `TransactionListQuery.shape.*`) — e.g. `ListTransactionsInput.from`/`.to` in
 * `src/lib/ai/tools/transactions.ts` — can apply the same null/empty handling. Verified
 * (via `z.toJSONSchema` and `@tanstack/ai`'s `convertSchemaToJsonSchema`) that wrapping an
 * enum in `z.preprocess` this way does not degrade its generated JSON Schema to a generic
 * string — the `enum` constraint survives, so the LLM tool-calling contract is unaffected.
 */
export function nullishAsAbsent<S extends z.ZodTypeAny>(
  schema: S,
): z.ZodOptional<z.ZodType<z.output<S>, z.input<S> | null | "">> {
  return z.preprocess(
    (val: z.input<S> | null | "" | undefined) => (val === null || val === "" ? undefined : val),
    schema,
  ) as unknown as z.ZodOptional<z.ZodType<z.output<S>, z.input<S> | null | "">>;
}

export const TransactionListQuery = z.object({
  from: nullishAsAbsent(z.coerce.date().optional()),
  to: nullishAsAbsent(z.coerce.date().optional()),
  type: nullishAsAbsent(z.enum(["expense", "income"]).optional()),
  categoryId: nullishAsAbsent(z.string().optional()),
  // Genuinely optional — no `.default()` here. Defaults (page=1, limit=20) are applied by the
  // route handler, not the schema, so the AI tool's generated documentation accurately reflects
  // these as optional fields with route-level defaults (see plan.md § Data Models).
  page: nullishAsAbsent(z.coerce.number().int().positive().optional()),
  limit: nullishAsAbsent(z.coerce.number().int().min(1).max(100).optional()),
});

export type TransactionListQuery = z.infer<typeof TransactionListQuery>;

/**
 * Resolved pagination values for use between the route handler, service, and repository layers.
 * These represent the actual pagination parameters in use after defaults have been applied.
 * - page: 1-based page number (≥ 1)
 * - limit: number of rows per page (1–100)
 *
 * Not a Zod schema — validation of these constraints happens at the HTTP boundary
 * (TransactionListQuery), and defaults are applied by the route handler before passing
 * these values downstream.
 */
export interface Pagination {
  page: number;
  limit: number;
}

/**
 * Generic result type for paginated repository/service responses.
 * Represents a single page of results plus metadata needed to compute pagination metadata.
 * - rows: the page's results (already filtered and ordered)
 * - total: total count of rows matching filters, across all pages (ignoring pagination)
 *
 * The route handler derives additional fields (hasMore, count, page, limit) from this
 * and the applied pagination parameters before building the HTTP response envelope.
 */
export interface PaginatedListResult<T> {
  rows: T[];
  total: number;
}
