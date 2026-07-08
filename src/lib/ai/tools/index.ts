import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
} from "./categories";
import {
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
} from "./recurring-templates";
import {
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
} from "./transactions";

export const allToolDefinitions = [
  listCategoriesDef,
  createCategoryDef,
  getCategoryDef,
  updateCategoryDef,
  deleteCategoryDef,
  listTransactionsDef,
  createTransactionDef,
  getTransactionDef,
  updateTransactionDef,
  deleteTransactionDef,
  listRecurringTemplatesDef,
  createRecurringTemplateDef,
  getRecurringTemplateDef,
  updateRecurringTemplateDef,
  deleteRecurringTemplateDef,
  activateRecurringTemplateDef,
  pauseRecurringTemplateDef,
] as const;
