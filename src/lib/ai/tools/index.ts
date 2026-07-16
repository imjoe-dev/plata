import { categoryServerTools } from "./categories";
import { recurringTemplateToolDefs } from "./recurring-templates";
import { transactionServerTools } from "./transactions";

export const allToolDefinitions = [
  ...categoryServerTools,
  ...transactionServerTools,
  ...recurringTemplateToolDefs,
] as const;
