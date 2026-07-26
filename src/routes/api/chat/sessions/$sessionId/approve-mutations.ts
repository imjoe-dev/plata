import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { approveSessionMutations } from "@/lib/services/chat";

export const Route = createFileRoute("/api/chat/sessions/$sessionId/approve-mutations")({
  server: {
    handlers: {
      POST: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return approveSessionMutations(userId, params!.sessionId);
      }),
    },
  },
});
