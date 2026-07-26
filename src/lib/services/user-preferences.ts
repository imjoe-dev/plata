import {
  getUserPreferencesByUserId as repoGetByUserId,
  updateUserPreferences as repoUpdate,
} from "@/lib/repositories/user-preferences";
import { NotFoundError } from "@/lib/errors";
import type { Currency } from "@/lib/currency";

export async function getUserPreferences(userId: string) {
  const row = await repoGetByUserId(userId);
  if (!row) throw new NotFoundError("user_preferences", userId);
  return row;
}

export async function updateUserPreferences(userId: string, defaultCurrency: Currency) {
  const row = await repoUpdate(userId, { default_currency: defaultCurrency });
  if (!row) throw new NotFoundError("user_preferences", userId);
  return row;
}
