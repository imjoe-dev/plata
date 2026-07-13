import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, parseQuery, requireUser } from "@/lib/api/http";
import { Transaction, TransactionListQuery } from "@/lib/schemas/transactions";
import { createTransaction, listTransactions } from "@/lib/services/transactions";

export const Route = createFileRoute("/api/transactions/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const {
          page: rawPage,
          limit: rawLimit,
          ...filters
        } = parseQuery(TransactionListQuery, request);
        const page = rawPage ?? 1;
        const limit = rawLimit ?? 20;
        const { rows, total } = await listTransactions(userId, filters, { page, limit });
        return {
          data: rows,
          meta: { count: rows.length, page, limit, total, hasMore: page * limit < total },
        };
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(Transaction, request);
          return createTransaction(userId, body);
        },
        { status: 201 },
      ),
    },
  },
});
