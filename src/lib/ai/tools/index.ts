import { categoryToolDefs } from "./categories";
import { recurringTemplateToolDefs } from "./recurring-templates";
import { transactionToolDefs } from "./transactions";

export const allToolDefinitions = [
  ...categoryToolDefs,
  ...transactionToolDefs,
  ...recurringTemplateToolDefs,
] as const;
