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

/**
 * Builds a per-call currency resolver: pass through an explicit currency unchanged, otherwise
 * fall back to the user's default — fetched at most once per resolver, no matter how many times
 * it's called, so a batch create with several currency-less items only hits user_preferences once.
 */
export function createCurrencyResolver(userId: string) {
  let defaultCurrency: Currency | undefined;

  // Relies on callers awaiting each resolveCurrency() call before the next (as the
  // create-batch loops do) rather than firing them concurrently — a Promise.all over
  // pending calls could still race and fetch more than once.
  async function resolveCurrency(explicit: Currency | undefined): Promise<Currency> {
    if (explicit) return explicit;
    if (defaultCurrency === undefined) {
      defaultCurrency = (await getUserPreferences(userId)).default_currency;
    }
    return defaultCurrency;
  }

  return resolveCurrency;
}
