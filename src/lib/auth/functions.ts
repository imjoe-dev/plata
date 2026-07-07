import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/server";
import { UnauthorizedError } from "@/lib/errors";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });

  return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });
  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
});
