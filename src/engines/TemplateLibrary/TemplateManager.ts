import { loadBuiltInTemplates } from "./TemplateLibrary";
import { cloneTemplate, type NewspaperPageTemplate, type TemplateImportPayload } from "./Template";
import { validateTemplate, validateTemplateLibrary, type TemplateValidationResult } from "./TemplateValidator";

export type TemplateManagerState = {
  templates: NewspaperPageTemplate[];
};

const timestamp = () => new Date().toISOString();

const withUpdatedMetadata = (template: NewspaperPageTemplate): NewspaperPageTemplate => ({
  ...template,
  metadata: {
    ...template.metadata,
    updatedAt: timestamp(),
    version: template.metadata.version + 1,
  },
});

export const createTemplateManagerState = (
  templates: NewspaperPageTemplate[] = loadBuiltInTemplates(),
): TemplateManagerState => ({
  templates: templates.map(cloneTemplate).sort((first, second) => first.id.localeCompare(second.id)),
});

/** Loads templates into immutable manager state. */
export const loadTemplates = (templates: NewspaperPageTemplate[]): TemplateManagerState =>
  createTemplateManagerState(templates);

/** Saves or replaces one template after validation succeeds. */
export const saveTemplate = (
  state: TemplateManagerState,
  template: NewspaperPageTemplate,
): { state: TemplateManagerState; validation: TemplateValidationResult } => {
  const validation = validateTemplate(template);

  if (!validation.valid) {
    return { state, validation };
  }

  const nextTemplate = withUpdatedMetadata(cloneTemplate(template));
  const templates = [
    ...state.templates.filter((candidate) => candidate.id !== template.id),
    nextTemplate,
  ].sort((first, second) => first.id.localeCompare(second.id));

  return { state: { templates }, validation };
};

/** Duplicates a template under a deterministic caller-provided id and name. */
export const duplicateTemplate = (
  state: TemplateManagerState,
  templateId: string,
  nextId: string,
  nextName: string,
): TemplateManagerState => {
  const source = state.templates.find((template) => template.id === templateId);

  if (!source || state.templates.some((template) => template.id === nextId)) {
    return state;
  }

  return createTemplateManagerState([
    ...state.templates,
    {
      ...cloneTemplate(source),
      id: nextId,
      name: nextName,
      metadata: { createdAt: timestamp(), updatedAt: timestamp(), version: 1 },
    },
  ]);
};

/** Renames a template without changing page structure. */
export const renameTemplate = (
  state: TemplateManagerState,
  templateId: string,
  name: string,
): TemplateManagerState => ({
  templates: state.templates.map((template) =>
    template.id === templateId ? withUpdatedMetadata({ ...cloneTemplate(template), name }) : cloneTemplate(template),
  ),
});

/** Deletes a template by id. */
export const deleteTemplate = (
  state: TemplateManagerState,
  templateId: string,
): TemplateManagerState => ({
  templates: state.templates.filter((template) => template.id !== templateId).map(cloneTemplate),
});

/** Exports templates as a stable JSON payload. */
export const exportTemplates = (state: TemplateManagerState): string =>
  JSON.stringify({ templates: state.templates.map(cloneTemplate) } satisfies TemplateImportPayload, null, 2);

/** Imports templates from a JSON payload after validating the collection. */
export const importTemplates = (
  payload: string,
): { state: TemplateManagerState; validation: TemplateValidationResult } => {
  const parsed = JSON.parse(payload) as TemplateImportPayload;
  const templates = Array.isArray(parsed.templates) ? parsed.templates : [];
  const validation = validateTemplateLibrary(templates);

  return {
    state: validation.valid ? createTemplateManagerState(templates) : createTemplateManagerState([]),
    validation,
  };
};

/** Validates all templates in manager state. */
export const validateTemplates = (state: TemplateManagerState): TemplateValidationResult =>
  validateTemplateLibrary(state.templates);

