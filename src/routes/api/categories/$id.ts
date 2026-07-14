import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { CategoryPatch } from "@/lib/schemas/categories";
import { deleteCategory, getCategory, updateCategory } from "@/lib/services/categories";

export const Route = createFileRoute("/api/categories/$id")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getCategory(userId, params!.id);
      }),
      PATCH: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          const patch = await parseBody(CategoryPatch, request);
          return updateCategory(userId, params!.id, patch);
        },
        { rateLimit: true },
      ),
      DELETE: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          return deleteCategory(userId, params!.id);
        },
        { rateLimit: true },
      ),
    },
  },
});
