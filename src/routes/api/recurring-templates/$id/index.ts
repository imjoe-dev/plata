import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { RecurringTemplatePatch } from "@/lib/schemas/recurring-templates";
import {
  deleteRecurringTemplate,
  getRecurringTemplate,
  updateRecurringTemplate,
} from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getRecurringTemplate(userId, params!.id);
      }),
      PATCH: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          const patch = await parseBody(RecurringTemplatePatch, request);
          return updateRecurringTemplate(userId, params!.id, patch);
        },
        { rateLimit: true },
      ),
      DELETE: apiHandler(
        async ({ request, params }) => {
          const userId = await requireUser(request);
          return deleteRecurringTemplate(userId, params!.id);
        },
        { rateLimit: true },
      ),
    },
  },
});
