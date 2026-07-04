import {
  createRecurringTemplate as repoCreate,
  getRecurringTemplateById as repoGetById,
  listRecurringTemplates as repoList,
  softDeleteRecurringTemplate as repoSoftDelete,
  updateRecurringTemplate as repoUpdate,
} from "@/lib/repositories/recurring-templates";
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
