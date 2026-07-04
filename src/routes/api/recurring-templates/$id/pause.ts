import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { pauseTemplate } from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/pause")({
  server: {
    handlers: {
      POST: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return pauseTemplate(userId, params!.id);
      }),
    },
  },
});
