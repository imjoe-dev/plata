import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { auth } from "@/lib/auth/server";
import { checkRateLimit, toErrorResponse } from "@/lib/api/http";

async function handleAuthRequest(request: Request): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    await checkRateLimit(env.AUTH_RATE_LIMITER, ip);
  } catch (error) {
    return toErrorResponse(error);
  }
  return auth().handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
