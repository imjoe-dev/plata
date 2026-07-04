import {
  buildUpdateTemplate,
  createRecurringTemplate as repoCreate,
  getRecurringTemplateById as repoGetById,
  listDueTemplates,
  listRecurringTemplates as repoList,
  softDeleteRecurringTemplate as repoSoftDelete,
  updateRecurringTemplate as repoUpdate,
} from "@/lib/repositories/recurring-templates";
import { buildInsertTransaction } from "@/lib/repositories/transactions";
import { runBatch } from "@/lib/db/transaction";
import { getCategoryById } from "@/lib/repositories/category";
import { InternalError, NotFoundError } from "@/lib/errors";
import type { RecurringTemplate } from "@/lib/schemas/recurring-templates";

export async function createRecurringTemplate(userId: string, input: RecurringTemplate) {
  if (input.categoryId) {
    const cat = await getCategoryById(userId, input.categoryId);
    if (!cat) throw new NotFoundError("category", input.categoryId);
  }

  const payload = {
    id: crypto.randomUUID(),
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    description: input.description,
    category_id: input.categoryId ?? null,
    cadence: input.cadence,
    next_due_date: input.nextDueDate ?? null,
    status: input.status,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    user_id: userId,
  };

  const row = await repoCreate(userId, payload);
  if (!row) throw new InternalError("createRecurringTemplate returned no row");
  return row;
}

export async function getRecurringTemplate(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("recurring_template", id);
  return row;
}

export async function listRecurringTemplates(
  userId: string,
  opts?: { status?: "active" | "paused" | "completed" | "failed" },
) {
  return repoList(userId, opts ?? {});
}

export async function updateRecurringTemplate(
  userId: string,
  id: string,
  patch: Partial<RecurringTemplate>,
) {
  const row = await repoUpdate(userId, id, patch as Record<string, unknown>);
  if (!row) throw new NotFoundError("recurring_template", id);
  return row;
}

export async function deleteRecurringTemplate(userId: string, id: string) {
  const row = await repoSoftDelete(userId, id);
  if (!row) throw new NotFoundError("recurring_template", id);
  return row;
}

export async function pauseTemplate(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("recurring_template", id);
  if (row.status !== "active") {
    throw new InternalError(`cannot pause a template in status "${row.status}"`);
  }
  const updated = await repoUpdate(userId, id, { status: "paused" });
  if (!updated) throw new InternalError("pauseTemplate returned no row");
  return updated;
}

export async function activateTemplate(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("recurring_template", id);
  if (row.status !== "paused") {
    throw new InternalError(`cannot activate a template in status "${row.status}"`);
  }
  const updated = await repoUpdate(userId, id, { status: "active" });
  if (!updated) throw new InternalError("activateTemplate returned no row");
  return updated;
}

type Cadence = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

function advanceDueDate(current: Date, cadence: Cadence): Date {
  const next = new Date(current);
  switch (cadence) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "biweekly":
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

export function computeNextDue(
  current: Date,
  cadence: Cadence,
  endDate: Date | null,
): { nextDue: Date; completed: boolean } {
  const nextDue = advanceDueDate(current, cadence);
  return { nextDue, completed: endDate ? nextDue > endDate : false };
}

export async function processDueRecurring(userId: string, now: Date) {
  const templates = await listDueTemplates(userId, now);
  let processed = 0;

  for (const tpl of templates) {
    if (
      tpl.last_insertion_date &&
      tpl.next_due_date &&
      tpl.last_insertion_date >= tpl.next_due_date
    ) {
      continue;
    }

    const currentDue = tpl.next_due_date ?? now;
    const { nextDue, completed } = computeNextDue(currentDue, tpl.cadence, tpl.end_date ?? null);

    const txnPayload = {
      id: crypto.randomUUID(),
      amount: tpl.amount,
      currency: tpl.currency,
      type: tpl.type,
      description: tpl.description,
      date: currentDue,
      category_id: tpl.category_id,
      recurring_template_id: tpl.id,
      user_id: userId,
      source: "manual" as const,
      notes: null,
    };

    const tplPatch: Record<string, unknown> = {
      next_due_date: nextDue,
      last_insertion_date: now,
    };
    if (completed) tplPatch.status = "completed";

    await runBatch([
      buildInsertTransaction(txnPayload),
      buildUpdateTemplate(userId, tpl.id, tplPatch),
    ]);

    processed += 1;
  }

  return { processed };
}
