import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { activateTemplate } from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/activate")({
  server: {
    handlers: {
      POST: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return activateTemplate(userId, params!.id);
      }),
    },
  },
});
