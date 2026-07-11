import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { Transaction, TransactionListQuery, TransactionPatch } from "@/lib/schemas/transactions";

export const TransactionRow = z.object({
  id: z.string(),
  amount: z.number().meta({ description: "Amount in major currency units, e.g. 9.99 for $9.99." }),
  currency: z.string(),
  type: z.enum(["expense", "income"]),
  description: z.string(),
  date: z.string(),
  category_id: z.string().nullable(),
  user_id: z.string(),
  recurring_template_id: z.string().nullable(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type TransactionRow = z.infer<typeof TransactionRow>;

const AmountInput = z
  .number()
  .positive()
  .meta({ description: "Amount in major currency units, e.g. 9.99 for $9.99." });

export const ListTransactionsInput = z.object({
  from: z.string().optional().meta({
    description: "ISO date string, inclusive lower bound.",
  }),
  to: z.string().optional().meta({
    description: "ISO date string, inclusive upper bound.",
  }),
  type: TransactionListQuery.shape.type?.meta({ description: "Filter by expense or income." }),
  categoryId: TransactionListQuery.shape.categoryId?.meta({
    description: "Filter by category id.",
  }),
});

export const CreateTransactionInput = Transaction.omit({ amount: true, source: true }).extend({
  amount: AmountInput,
  source: z
    .enum(["manual", "chat", "csv_import"])
    .default("chat")
    .meta({ description: "Origin of the transaction. Defaults to 'chat' for AI-created rows." }),
  currency: Transaction.shape.currency.meta({ description: "ISO 4217 currency code, e.g. USD." }),
  type: Transaction.shape.type.meta({ description: "Transaction type: expense or income." }),
  description: Transaction.shape.description.meta({ description: "Human-readable description." }),
  date: z.string().meta({ description: "ISO date string." }),
  categoryId: Transaction.shape.categoryId?.meta({ description: "Optional category id." }),
  recurringTemplateId: Transaction.shape.recurringTemplateId?.meta({
    description: "Optional recurring template id.",
  }),
  notes: Transaction.shape.notes?.meta({ description: "Optional free-form notes." }),
});

export const IdInput = z.object({ id: z.string().meta({ description: "Transaction id." }) });

export const UpdateTransactionInput = TransactionPatch.omit({ amount: true, date: true }).extend({
  id: z.string().meta({ description: "Transaction id." }),
  amount: AmountInput.optional(),
  date: z.string().optional().meta({ description: "ISO date string." }),
});

export const listTransactionsDef = toolDefinition({
  name: "list_transactions",
  description:
    "List transactions for the current user, optionally filtered by date range, type, or category.",
  inputSchema: ListTransactionsInput,
  outputSchema: z.array(TransactionRow),
});

export const createTransactionDef = toolDefinition({
  name: "create_transaction",
  description: "Create a new transaction. Amount is in major currency units (e.g. 9.99 for $9.99).",
  inputSchema: CreateTransactionInput,
  outputSchema: TransactionRow,
  needsApproval: true,
});

export const getTransactionDef = toolDefinition({
  name: "get_transaction",
  description: "Get a single transaction by id.",
  inputSchema: IdInput,
  outputSchema: TransactionRow,
});

export const updateTransactionDef = toolDefinition({
  name: "update_transaction",
  description: "Update an existing transaction by id. Amount is in major currency units.",
  inputSchema: UpdateTransactionInput,
  outputSchema: TransactionRow,
  needsApproval: true,
});

export const deleteTransactionDef = toolDefinition({
  name: "delete_transaction",
  description: "Soft-delete a transaction by id.",
  inputSchema: IdInput,
  outputSchema: TransactionRow,
  needsApproval: true,
});
