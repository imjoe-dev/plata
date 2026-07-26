import { and, eq, isNull, lte } from "drizzle-orm";

import { getDB } from "@/db";
import { recurring_templates } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type TemplateRow = typeof recurring_templates.$inferSelect;
type TemplateInsert = typeof recurring_templates.$inferInsert;

type Status = "active" | "paused" | "completed" | "failed";

const recurringTemplateRepo = createSoftDeleteRepo(recurring_templates);

export function createRecurringTemplate(input: TemplateInsert) {
  return recurringTemplateRepo.create(input);
}
export function getRecurringTemplateById(userId: string, id: string) {
  return recurringTemplateRepo.getById(userId, id);
}
export function updateRecurringTemplate(
  userId: string,
  id: string,
  patch: Partial<TemplateInsert>,
) {
  return recurringTemplateRepo.update(userId, id, patch);
}
export function softDeleteRecurringTemplate(userId: string, id: string) {
  return recurringTemplateRepo.softDelete(userId, id);
}

export async function listRecurringTemplates(
  userId: string,
  opts: { status?: Status } = {},
): Promise<TemplateRow[]> {
  const conds = [eq(recurring_templates.user_id, userId), isNull(recurring_templates.deleted_at)];
  if (opts.status) conds.push(eq(recurring_templates.status, opts.status));
  return getDB()
    .select()
    .from(recurring_templates)
    .where(and(...conds));
}

export async function listDueTemplates(userId: string, now: Date): Promise<TemplateRow[]> {
  return getDB()
    .select()
    .from(recurring_templates)
    .where(
      and(
        eq(recurring_templates.user_id, userId),
        eq(recurring_templates.status, "active"),
        lte(recurring_templates.next_due_date, now),
        isNull(recurring_templates.deleted_at),
      ),
    );
}

export function buildInsertTemplate(input: TemplateInsert) {
  return getDB().insert(recurring_templates).values(input).returning();
}

export function buildUpdateTemplate(userId: string, id: string, patch: Partial<TemplateInsert>) {
  return getDB()
    .update(recurring_templates)
    .set(patch)
    .where(
      and(
        eq(recurring_templates.id, id),
        eq(recurring_templates.user_id, userId),
        isNull(recurring_templates.deleted_at),
      ),
    );
}

// Cross-user: no user_id filter, unlike listDueTemplates above.
export async function listAllDueTemplates(now: Date): Promise<TemplateRow[]> {
  return getDB()
    .select()
    .from(recurring_templates)
    .where(
      and(
        eq(recurring_templates.status, "active"),
        lte(recurring_templates.next_due_date, now),
        isNull(recurring_templates.deleted_at),
      ),
    );
}
