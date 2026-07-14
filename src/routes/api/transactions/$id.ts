import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { TransactionPatch } from "@/lib/schemas/transactions";
import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/services/transactions";

export const Route = createFileRoute("/api/transactions/$id")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getTransaction(userId, params!.id);
      }),
      PATCH: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          const patch = await parseBody(TransactionPatch, request);
          return updateTransaction(userId, params!.id, patch);
        },
        { rateLimit: true },
      ),
      DELETE: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          return deleteTransaction(userId, params!.id);
        },
        { rateLimit: true },
      ),
    },
  },
});
