import { and, eq, isNull, lte } from "drizzle-orm";

import { getDB } from "@/db";
import { recurring_templates } from "@/db/schema";

type TemplateRow = typeof recurring_templates.$inferSelect;
type TemplateInsert = typeof recurring_templates.$inferInsert;

type Status = "active" | "paused" | "completed" | "failed";

export async function createRecurringTemplate(_userId: string, input: TemplateInsert) {
  const [row] = await getDB().insert(recurring_templates).values(input).returning();
  return row;
}

export async function getRecurringTemplateById(
  userId: string,
  id: string,
): Promise<TemplateRow | null> {
  const [row] = await getDB()
    .select()
    .from(recurring_templates)
    .where(
      and(
        eq(recurring_templates.id, id),
        eq(recurring_templates.user_id, userId),
        isNull(recurring_templates.deleted_at),
      ),
    );
  return row ?? null;
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

export async function updateRecurringTemplate(
  userId: string,
  id: string,
  patch: Partial<TemplateInsert>,
): Promise<TemplateRow | null> {
  const [row] = await getDB()
    .update(recurring_templates)
    .set(patch)
    .where(
      and(
        eq(recurring_templates.id, id),
        eq(recurring_templates.user_id, userId),
        isNull(recurring_templates.deleted_at),
      ),
    )
    .returning();
  return row ?? null;
}

export async function softDeleteRecurringTemplate(
  userId: string,
  id: string,
): Promise<TemplateRow | null> {
  const [row] = await getDB()
    .update(recurring_templates)
    .set({ deleted_at: new Date() })
    .where(
      and(
        eq(recurring_templates.id, id),
        eq(recurring_templates.user_id, userId),
        isNull(recurring_templates.deleted_at),
      ),
    )
    .returning();
  return row ?? null;
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
