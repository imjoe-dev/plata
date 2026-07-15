import type { ZodType } from "zod";
import { ZodError } from "zod";

import { auth } from "@/lib/auth/server";
import { AppError, RateLimitedError, UnauthorizedError, ValidationError } from "@/lib/errors";

export type HandlerCtx = { request: Request; params?: Record<string, string> };

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json({ error: error.toJSON(), message: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: { name: "ValidationError", status: 400, fieldErrors: error.flatten().fieldErrors },
        message: "Validation failed",
      },
      400,
    );
  }
  return json(
    { error: { name: "InternalError", status: 500 }, message: "Internal server error" },
    500,
  );
}

export function apiHandler(
  fn: (ctx: HandlerCtx) => Promise<unknown>,
  opts: { status?: number; rateLimit?: boolean } = {},
) {
  return async (ctx: HandlerCtx): Promise<Response> => {
    try {
      if (opts.rateLimit) {
        // Dynamic import so routes that never opt into rateLimit never touch `cloudflare:workers`.
        const { env } = await import("cloudflare:workers");
        // fn also re-resolves userId itself — an accepted duplicate lookup to keep fn's signature unchanged.
        const userId = await requireUser(ctx.request);
        await checkRateLimit(env.MUTATION_RATE_LIMITER, userId);
      }
      const result = await fn(ctx);
      // If the handler returns an object with both data and meta fields already set,
      // pass it through unchanged (paginated envelope case, built by the route).
      if (
        typeof result === "object" &&
        result !== null &&
        !Array.isArray(result) &&
        "data" in result &&
        "meta" in result
      ) {
        return json(result, opts.status ?? 200);
      }
      const body = Array.isArray(result)
        ? { data: result, meta: { count: result.length } }
        : { data: result };
      return json(body, opts.status ?? 200);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  const raw = await request.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export async function requireUser(request: Request): Promise<string> {
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function checkRateLimit(binding: RateLimit, key: string): Promise<void> {
  try {
    const result = await binding.limit({ key });
    if (!result.success) {
      throw new RateLimitedError();
    }
  } catch (error) {
    // Fail closed: a throwing binding is treated the same as a rejected limit check.
    if (error instanceof RateLimitedError) {
      throw error;
    }
    throw new RateLimitedError();
  }
}
