import { z } from "zod";

import { currencySchema, dollarsToCentsSchema } from "@/lib/currency";

export const Transaction = z.object({
  amount: dollarsToCentsSchema,
  currency: currencySchema.default("USD"),
  type: z.enum(["expense", "income"]).meta({ description: "Transaction type: expense or income." }),
  description: z.string().min(1).meta({ description: "Human-readable description." }),
  date: z.coerce.date(),
  categoryId: z.string().nullable().optional().meta({ description: "Optional category id." }),
  recurringTemplateId: z
    .string()
    .nullable()
    .optional()
    .meta({ description: "Optional recurring template id." }),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable().optional().meta({ description: "Optional free-form notes." }),
});

export type Transaction = z.infer<typeof Transaction>;

export const TransactionPatch = z.object({
  ...Transaction.partial().shape,
  currency: currencySchema.optional(),
});

export type TransactionPatch = z.infer<typeof TransactionPatch>;

/**
 * Normalizes `null`/`""` to `undefined` before validation — the LLM chat tool sends explicit
 * `null` for unused filters, which a bare `.optional()` rejects. The return type is manually
 * cast because Zod 4.4.3's `z.preprocess()` collapses `z.input<>` to `unknown` inside a
 * `z.object()` shape; this only restores the compile-time type, runtime behavior is unaffected.
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
  type: nullishAsAbsent(z.enum(["expense", "income"]).optional()).meta({
    description: "Filter by expense or income.",
  }),
  categoryId: nullishAsAbsent(z.string().optional()).meta({
    description: "Filter by category id.",
  }),
  // Genuinely optional: defaults (page=1, limit=20) are applied by the route handler, not here.
  page: nullishAsAbsent(z.coerce.number().int().positive().optional()),
  limit: nullishAsAbsent(z.coerce.number().int().min(1).max(100).optional()),
});

export type TransactionListQuery = z.infer<typeof TransactionListQuery>;

/**
 * Resolved pagination values (post-defaults) shared across the route/service/repository layers.
 * `page` is 1-based; `limit` is 1–100. Not a Zod schema — validation happens at the HTTP
 * boundary (TransactionListQuery).
 */
export interface Pagination {
  page: number;
  limit: number;
}

/**
 * One page of repository/service results. `total` is the full matching count across all pages
 * (not just this page) — the route handler derives hasMore/count/page/limit from this.
 */
export interface PaginatedListResult<T> {
  rows: T[];
  total: number;
}
