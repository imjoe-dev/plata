import { categoryServerTools } from "./categories";
import { recurringTemplateToolDefs } from "./recurring-templates";
import { transactionToolDefs } from "./transactions";

export const allToolDefinitions = [
  ...categoryServerTools,
  ...transactionToolDefs,
  ...recurringTemplateToolDefs,
] as const;
