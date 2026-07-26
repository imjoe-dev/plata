import { categoryServerTools } from "./categories";
import { recurringTemplateServerTools } from "./recurring-templates";
import { transactionServerTools } from "./transactions";
import { userPreferencesServerTools } from "./user-preferences";

export const allToolDefinitions = [
  ...categoryServerTools,
  ...transactionServerTools,
  ...recurringTemplateServerTools,
  ...userPreferencesServerTools,
] as const;
