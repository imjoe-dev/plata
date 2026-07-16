import { categoryServerTools } from "./categories";
import { recurringTemplateServerTools } from "./recurring-templates";
import { transactionServerTools } from "./transactions";

export const allToolDefinitions = [
  ...categoryServerTools,
  ...transactionServerTools,
  ...recurringTemplateServerTools,
] as const;
