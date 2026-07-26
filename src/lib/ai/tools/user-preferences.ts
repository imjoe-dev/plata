import { toolDefinition } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { checkRateLimit } from "@/lib/api/http";
import { currencySchema } from "@/lib/currency";
import { UserPreferences } from "@/lib/schemas/user-preferences";
import { getUserPreferences, updateUserPreferences } from "@/lib/services/user-preferences";
import type { ToolContext } from "./context";

export const UserPreferencesRow = z.object({
  user_id: z.string(),
  default_currency: currencySchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type UserPreferencesRow = z.infer<typeof UserPreferencesRow>;

export const GetUserPreferencesInput = z.object({});

export const UpdateUserPreferencesInput = UserPreferences;

export const getUserPreferencesDef = toolDefinition({
  name: "get_user_preferences",
  description:
    "Get the current user's preferences, including their default currency. Call this at the start of a new conversation, before doing anything else.",
  inputSchema: GetUserPreferencesInput,
  outputSchema: UserPreferencesRow,
});

const updateUserPreferencesBase = {
  name: "update_user_preferences",
  description:
    "Update the current user's preferences. Currently supports changing the default currency (USD or COP).",
  inputSchema: UpdateUserPreferencesInput,
  outputSchema: UserPreferencesRow,
} as const;

export const updateUserPreferencesDef = toolDefinition({
  ...updateUserPreferencesBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const updateUserPreferencesUngatedDef = toolDefinition(updateUserPreferencesBase);

// The service passes the Drizzle row through unchanged (Date timestamps). Previously such rows
// crossed a REST/JSON boundary, which serialized dates to ISO strings for free; calling the
// service in-process has no such boundary, so this maps the row to the tool's declared
// UserPreferencesRow shape.
type UserPreferencesServiceRow = Awaited<ReturnType<typeof getUserPreferences>>;

function toUserPreferencesRow(row: UserPreferencesServiceRow): UserPreferencesRow {
  return {
    user_id: row.user_id,
    default_currency: row.default_currency,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function getUserPreferencesExecute(
  _input: z.input<typeof GetUserPreferencesInput>,
  ctx: { context: ToolContext },
) {
  const row = await getUserPreferences(ctx.context.userId);
  return toUserPreferencesRow(row);
}

async function updateUserPreferencesExecute(
  input: z.input<typeof UpdateUserPreferencesInput>,
  ctx: { context: ToolContext },
) {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const row = await updateUserPreferences(ctx.context.userId, input.defaultCurrency);
  return toUserPreferencesRow(row);
}

export const userPreferencesServerTools = [
  getUserPreferencesDef.server<ToolContext>(getUserPreferencesExecute),
  updateUserPreferencesDef.server<ToolContext>(updateUserPreferencesExecute),
] as const;

/**
 * Session Approval (docs/adr/0006) variant: update_user_preferences ungated. Selected instead
 * of `userPreferencesServerTools` by the chat route when a Chat Session has granted Session
 * Approval — built once here at module scope, not per request. No delete tool exists for this
 * resource, so there's nothing to carve out.
 */
export const userPreferencesServerToolsApproved = [
  getUserPreferencesDef.server<ToolContext>(getUserPreferencesExecute),
  updateUserPreferencesUngatedDef.server<ToolContext>(updateUserPreferencesExecute),
] as const;
