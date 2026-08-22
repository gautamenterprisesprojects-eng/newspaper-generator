export type {
  NewspaperPageTemplate,
  NewspaperTemplatePageType,
  TemplateAdvertisementZone,
  TemplateBaselineGrid,
  TemplateChrome,
  TemplateColumnGrid,
  TemplateImageSlot,
  TemplateImportPayload,
  TemplateMargins,
  TemplateRect,
  TemplateStorySlot,
} from "./Template";
export { cloneTemplate } from "./Template";
export { BUILT_IN_TEMPLATES, findBuiltInTemplate, loadBuiltInTemplates } from "./TemplateLibrary";
export type { TemplateValidationIssue, TemplateValidationResult } from "./TemplateValidator";
export { validateTemplate, validateTemplateLibrary } from "./TemplateValidator";
export type { TemplateManagerState } from "./TemplateManager";
export {
  createTemplateManagerState,
  deleteTemplate,
  duplicateTemplate,
  exportTemplates,
  importTemplates,
  loadTemplates,
  renameTemplate,
  saveTemplate,
  validateTemplates,
} from "./TemplateManager";
