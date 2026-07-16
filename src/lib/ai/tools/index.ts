import { categoryToolDefs } from "./categories";
import { recurringTemplateServerTools } from "./recurring-templates";
import { transactionToolDefs } from "./transactions";

export const allToolDefinitions = [
  ...categoryToolDefs,
  ...transactionToolDefs,
  ...recurringTemplateServerTools,
] as const;
