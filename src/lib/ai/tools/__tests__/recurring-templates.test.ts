import { describe, expect, it } from "vite-plus/test";

import {
  RecurringTemplateRow,
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
} from "@/lib/ai/tools/recurring-templates";

describe("recurring-templates tool definitions", () => {
  it("exposes seven tools with stable names", () => {
    expect(listRecurringTemplatesDef.name).toBe("list_recurring_templates");
    expect(createRecurringTemplateDef.name).toBe("create_recurring_template");
    expect(getRecurringTemplateDef.name).toBe("get_recurring_template");
    expect(updateRecurringTemplateDef.name).toBe("update_recurring_template");
    expect(deleteRecurringTemplateDef.name).toBe("delete_recurring_template");
    expect(activateRecurringTemplateDef.name).toBe("activate_recurring_template");
    expect(pauseRecurringTemplateDef.name).toBe("pause_recurring_template");
  });

  it("create_recurring_template accepts a positive amount in major units (no cents transform)", () => {
    const parsed = createRecurringTemplateDef.inputSchema!.safeParse({
      amount: 12.5,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(12.5);
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("list_recurring_templates accepts an optional status filter", () => {
    expect(listRecurringTemplatesDef.inputSchema!.safeParse({ status: "active" }).success).toBe(
      true,
    );
    expect(listRecurringTemplatesDef.inputSchema!.safeParse({ status: "nope" }).success).toBe(
      false,
    );
  });

  it("activate/pause/get/delete require only an id", () => {
    const id = { id: "r1" };
    expect(activateRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(pauseRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(getRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(deleteRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
  });

  it("RecurringTemplateRow validates a row with amount in major units", () => {
    const row = {
      id: "r1",
      amount: 12.5,
      currency: "USD",
      type: "expense",
      description: "Rent",
      category_id: null,
      cadence: "monthly",
      next_due_date: "2026-08-01T00:00:00.000Z",
      last_insertion_date: null,
      status: "active",
      start_date: null,
      end_date: null,
      user_id: "u1",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(RecurringTemplateRow.safeParse(row).success).toBe(true);
  });
});
