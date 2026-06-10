import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getAuthConfig } from "./shared-config";

export function auth() {
  return betterAuth({
    ...getAuthConfig(),
    plugins: [tanstackStartCookies()],
  });
}
