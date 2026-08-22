import type { NewspaperPageTemplate, NewspaperTemplatePageType } from "./Template";
import { cloneTemplate } from "./Template";

const now = "2026-07-28T00:00:00.000Z";

const baseTemplate = (
  id: string,
  name: string,
  pageType: NewspaperTemplatePageType,
  sectionName: string,
  overrides: Partial<NewspaperPageTemplate> = {},
): NewspaperPageTemplate => ({
  id,
  name,
  pageType,
  sectionName,
  pageSize: { width: 13, height: 21 },
  margins: { top: 0.75, right: 0.25, bottom: 0.35, left: 0.25 },
  columns: { count: 6, gutter: 0.12 },
  baselineGrid: { enabled: true, increment: 6 },
  advertisementZones: [],
  preferredStorySlots: [
    { id: `${id}-lead`, name: "Lead", priority: "lead", minimumColumns: 3, preferredColumns: 4, maximumColumns: 6 },
    { id: `${id}-major`, name: "Major", priority: "major", minimumColumns: 2, preferredColumns: 3, maximumColumns: 4 },
    { id: `${id}-briefs`, name: "Briefs", priority: "brief", minimumColumns: 1, preferredColumns: 1, maximumColumns: 2 },
  ],
  preferredImageSlots: [],
  header: { enabled: true, height: 0.75, content: sectionName },
  footer: { enabled: true, height: 0.25 },
  folio: { enabled: true, height: 0.2, content: sectionName },
  metadata: { createdAt: now, updatedAt: now, version: 1 },
  ...overrides,
});

export const BUILT_IN_TEMPLATES: NewspaperPageTemplate[] = [
  baseTemplate("template-front-page", "Front Page", "front-page", "Front Page", {
    preferredImageSlots: [{ id: "front-dominant-photo", name: "Dominant Photo", required: true, minimumColumns: 3, preferredColumns: 4 }],
  }),
  baseTemplate("template-national", "National", "national", "National"),
  baseTemplate("template-state", "State", "state", "State"),
  baseTemplate("template-district", "District", "district", "District", {
    preferredStorySlots: [
      { id: "district-lead", name: "District Lead", priority: "major", minimumColumns: 2, preferredColumns: 3, maximumColumns: 4 },
      { id: "district-briefs", name: "Local Briefs", priority: "brief", minimumColumns: 1, preferredColumns: 1, maximumColumns: 2 },
    ],
  }),
  baseTemplate("template-sports", "Sports", "sports", "Sports", {
    preferredImageSlots: [{ id: "sports-action-photo", name: "Action Photo", required: true, minimumColumns: 2, preferredColumns: 3 }],
  }),
  baseTemplate("template-business", "Business", "business", "Business"),
  baseTemplate("template-editorial", "Editorial", "editorial", "Editorial", {
    preferredImageSlots: [],
    preferredStorySlots: [
      { id: "editorial-main", name: "Editorial", priority: "major", minimumColumns: 2, preferredColumns: 3, maximumColumns: 4 },
      { id: "letters", name: "Letters", priority: "secondary", minimumColumns: 1, preferredColumns: 2, maximumColumns: 3 },
    ],
  }),
  baseTemplate("template-entertainment", "Entertainment", "entertainment", "Entertainment"),
  baseTemplate("template-magazine", "Magazine", "magazine", "Magazine", {
    pageSize: { width: 10, height: 13 },
    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
    columns: { count: 4, gutter: 0.16 },
    preferredImageSlots: [{ id: "magazine-feature-image", name: "Feature Image", required: true, minimumColumns: 2, preferredColumns: 4 }],
  }),
  baseTemplate("template-sunday", "Sunday", "sunday", "Sunday", {
    preferredImageSlots: [{ id: "sunday-cover-image", name: "Cover Image", required: true, minimumColumns: 3, preferredColumns: 6 }],
  }),
  baseTemplate("template-ad-heavy", "Advertisement Heavy", "district", "District", {
    advertisementZones: [
      { id: "ad-bottom-left", name: "Bottom Left Ad", x: 0.25, y: 16, width: 3, height: 4, locked: true, priority: 0 },
      { id: "ad-bottom-right", name: "Bottom Right Ad", x: 9.75, y: 16, width: 3, height: 4, locked: true, priority: 1 },
    ],
  }),
];

/** Returns immutable copies of all built-in newspaper page templates. */
export const loadBuiltInTemplates = (): NewspaperPageTemplate[] =>
  BUILT_IN_TEMPLATES.map(cloneTemplate);

/** Finds a built-in template by id or page type. */
export const findBuiltInTemplate = (idOrType: string): NewspaperPageTemplate | null =>
  loadBuiltInTemplates().find((template) => template.id === idOrType || template.pageType === idOrType) ?? null;

