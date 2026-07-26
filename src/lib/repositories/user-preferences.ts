import { eq } from "drizzle-orm";

import { getDB } from "@/db";
import { user_preferences } from "@/db/schema";

type UserPreferencesRow = typeof user_preferences.$inferSelect;
type UserPreferencesInsert = typeof user_preferences.$inferInsert;

export async function createUserPreferences(
  input: UserPreferencesInsert,
): Promise<UserPreferencesRow> {
  const [row] = await getDB().insert(user_preferences).values(input).returning();
  return row;
}

export async function getUserPreferencesByUserId(
  userId: string,
): Promise<UserPreferencesRow | null> {
  const [row] = await getDB()
    .select()
    .from(user_preferences)
    .where(eq(user_preferences.user_id, userId));
  return row ?? null;
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPreferencesInsert>,
): Promise<UserPreferencesRow | null> {
  const [row] = await getDB()
    .update(user_preferences)
    .set(patch)
    .where(eq(user_preferences.user_id, userId))
    .returning();
  return row ?? null;
}
