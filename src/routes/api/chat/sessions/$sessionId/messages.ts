import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { listMessages } from "@/lib/services/chat";

export const Route = createFileRoute("/api/chat/sessions/$sessionId/messages")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return listMessages(userId, params!.sessionId);
      }),
    },
  },
});
