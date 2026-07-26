import { createUserPreferences } from "@/lib/repositories/user-preferences";

/**
 * Wired into `databaseHooks.user.create.after` (see shared-config.ts) but kept as a plain,
 * directly-callable function so it's testable without a real sign-up/OAuth flow.
 */
export async function createDefaultUserPreferences(userId: string): Promise<void> {
  await createUserPreferences({ user_id: userId });
}
