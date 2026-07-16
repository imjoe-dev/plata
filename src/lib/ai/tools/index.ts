import { categoryToolDefs } from "./categories";
import { recurringTemplateToolDefs } from "./recurring-templates";
import { transactionServerTools } from "./transactions";

export const allToolDefinitions = [
  ...categoryToolDefs,
  ...transactionServerTools,
  ...recurringTemplateToolDefs,
] as const;
