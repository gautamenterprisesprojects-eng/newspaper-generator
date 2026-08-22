import type { NewspaperPageTemplate, TemplateAdvertisementZone, TemplateRect } from "./Template";

export type TemplateValidationIssue = {
  code:
    | "invalid-page-size"
    | "invalid-margins"
    | "invalid-column-count"
    | "overlapping-advertisement-zones"
    | "missing-folio";
  severity: "error" | "warning";
  templateId: string;
  message: string;
};

export type TemplateValidationResult = {
  valid: boolean;
  issues: TemplateValidationIssue[];
};

const right = (rect: TemplateRect) => rect.x + rect.width;
const bottom = (rect: TemplateRect) => rect.y + rect.height;
const overlaps = (first: TemplateRect, second: TemplateRect) =>
  Math.max(first.x, second.x) < Math.min(right(first), right(second)) &&
  Math.max(first.y, second.y) < Math.min(bottom(first), bottom(second));

const validateAdvertisementZones = (template: NewspaperPageTemplate, issues: TemplateValidationIssue[]) => {
  const zones = template.advertisementZones;

  for (let firstIndex = 0; firstIndex < zones.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < zones.length; secondIndex += 1) {
      const first: TemplateAdvertisementZone = zones[firstIndex];
      const second: TemplateAdvertisementZone = zones[secondIndex];

      if (overlaps(first, second)) {
        issues.push({
          code: "overlapping-advertisement-zones",
          severity: "error",
          templateId: template.id,
          message: `Advertisement zones '${first.id}' and '${second.id}' overlap.`,
        });
      }
    }
  }
};

/** Validates reusable template metadata without computing story geometry. */
export const validateTemplate = (template: NewspaperPageTemplate): TemplateValidationResult => {
  const issues: TemplateValidationIssue[] = [];

  if (template.pageSize.width <= 0 || template.pageSize.height <= 0) {
    issues.push({
      code: "invalid-page-size",
      severity: "error",
      templateId: template.id,
      message: "Page size must be positive.",
    });
  }

  if (
    template.margins.top < 0 ||
    template.margins.right < 0 ||
    template.margins.bottom < 0 ||
    template.margins.left < 0 ||
    template.margins.left + template.margins.right >= template.pageSize.width ||
    template.margins.top + template.margins.bottom >= template.pageSize.height
  ) {
    issues.push({
      code: "invalid-margins",
      severity: "error",
      templateId: template.id,
      message: "Margins must be non-negative and smaller than the page size.",
    });
  }

  if (!Number.isInteger(template.columns.count) || template.columns.count < 1) {
    issues.push({
      code: "invalid-column-count",
      severity: "error",
      templateId: template.id,
      message: "Column count must be a positive integer.",
    });
  }

  if (!template.folio.enabled || !template.folio.content?.trim()) {
    issues.push({
      code: "missing-folio",
      severity: "error",
      templateId: template.id,
      message: "Template must define an enabled folio label.",
    });
  }

  validateAdvertisementZones(template, issues);

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};

/** Validates a complete template collection. */
export const validateTemplateLibrary = (templates: NewspaperPageTemplate[]): TemplateValidationResult => {
  const issues = templates.flatMap((template) => validateTemplate(template).issues);

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};

