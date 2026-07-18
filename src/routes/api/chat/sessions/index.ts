import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { apiHandler, parseQuery, requireUser } from "@/lib/api/http";
import { listSessions } from "@/lib/services/chat";

const listSessionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/api/chat/sessions/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const query = parseQuery(listSessionsQuerySchema, request);
        return listSessions(userId, query);
      }),
    },
  },
});
