import { categoryServerTools, categoryServerToolsApproved } from "./categories";
import {
  recurringTemplateServerTools,
  recurringTemplateServerToolsApproved,
} from "./recurring-templates";
import { transactionServerTools, transactionServerToolsApproved } from "./transactions";
import { userPreferencesServerTools, userPreferencesServerToolsApproved } from "./user-preferences";

export const allToolDefinitions = [
  ...categoryServerTools,
  ...transactionServerTools,
  ...recurringTemplateServerTools,
  ...userPreferencesServerTools,
] as const;

/**
 * Session Approval (docs/adr/0006) variant of `allToolDefinitions`: resources that have been
 * given the Session Approval twin-array treatment substitute their ungated array here. Both
 * arrays are built once at module scope from already-built per-resource arrays — selecting
 * between them per request (see the chat route) is just picking a reference, not constructing
 * tool definitions.
 */
export const approvedToolDefinitions = [
  ...categoryServerToolsApproved,
  ...transactionServerToolsApproved,
  ...recurringTemplateServerToolsApproved,
  ...userPreferencesServerToolsApproved,
] as const;

export function selectToolDefinitions(sessionApproved: boolean) {
  return sessionApproved ? approvedToolDefinitions : allToolDefinitions;
}
