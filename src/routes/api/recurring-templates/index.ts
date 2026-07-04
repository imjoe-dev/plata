import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, parseQuery, requireUser } from "@/lib/api/http";
import { RecurringTemplate, RecurringTemplateListQuery } from "@/lib/schemas/recurring-templates";
import {
  createRecurringTemplate,
  listRecurringTemplates,
} from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const query = parseQuery(RecurringTemplateListQuery, request);
        return listRecurringTemplates(userId, query);
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(RecurringTemplate, request);
          return createRecurringTemplate(userId, body);
        },
        { status: 201 },
      ),
    },
  },
});
