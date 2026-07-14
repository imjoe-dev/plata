import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { Category } from "@/lib/schemas/categories";
import { createCategory, listCategories } from "@/lib/services/categories";

export const Route = createFileRoute("/api/categories/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        return listCategories(userId);
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(Category, request);
          return createCategory(userId, body);
        },
        { status: 201, rateLimit: true },
      ),
    },
  },
});
