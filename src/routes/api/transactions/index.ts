import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, parseQuery, requireUser } from "@/lib/api/http";
import { Transaction, TransactionListQuery } from "@/lib/schemas/transactions";
import { createTransaction, listTransactions } from "@/lib/services/transactions";

export const Route = createFileRoute("/api/transactions/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const query = parseQuery(TransactionListQuery, request);
        return listTransactions(userId, query);
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
