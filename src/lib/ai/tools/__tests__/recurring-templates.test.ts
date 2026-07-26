import { describe, expect, it, vi } from "vite-plus/test";

// Importing this module now pulls in the `.server()` handlers alongside the tool defs, which
// transitively reach `cloudflare:workers` via the service/repository/db chain. Nothing here
// reads an env property at module load time, so an empty stub is enough to make the module
// loadable — this file only asserts against the raw tool-def schemas below.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  RecurringTemplateRow,
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  createRecurringTemplatesDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
} from "@/lib/ai/tools/recurring-templates";

describe("recurring-templates tool definitions", () => {
  it("exposes eight tools with stable names", () => {
    expect(listRecurringTemplatesDef.name).toBe("list_recurring_templates");
    expect(createRecurringTemplateDef.name).toBe("create_recurring_template");
    expect(createRecurringTemplatesDef.name).toBe("create_recurring_templates");
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

  it("create_recurring_templates accepts a batch of 1-20 items and rejects 0 or 21 items", () => {
    const item = {
      amount: 12.5,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    };
    expect(createRecurringTemplatesDef.inputSchema!.safeParse({ templates: [item] }).success).toBe(
      true,
    );
    expect(
      createRecurringTemplatesDef.inputSchema!.safeParse({
        templates: Array.from({ length: 20 }, () => item),
      }).success,
    ).toBe(true);
    expect(createRecurringTemplatesDef.inputSchema!.safeParse({ templates: [] }).success).toBe(
      false,
    );
    expect(
      createRecurringTemplatesDef.inputSchema!.safeParse({
        templates: Array.from({ length: 21 }, () => item),
      }).success,
    ).toBe(false);
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

  it("mutating tools (create, create_recurring_templates, update, delete, activate, pause) have needsApproval set to true", () => {
    expect(createRecurringTemplateDef.needsApproval).toBe(true);
    expect(createRecurringTemplatesDef.needsApproval).toBe(true);
    expect(updateRecurringTemplateDef.needsApproval).toBe(true);
    expect(deleteRecurringTemplateDef.needsApproval).toBe(true);
    expect(activateRecurringTemplateDef.needsApproval).toBe(true);
    expect(pauseRecurringTemplateDef.needsApproval).toBe(true);
  });

  it("read-only tools (list, get) have no needsApproval field", () => {
    expect(listRecurringTemplatesDef.needsApproval).toBeUndefined();
    expect(getRecurringTemplateDef.needsApproval).toBeUndefined();
  });
});
