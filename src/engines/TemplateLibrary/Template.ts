export type NewspaperTemplatePageType =
  | "front-page"
  | "national"
  | "state"
  | "district"
  | "sports"
  | "business"
  | "editorial"
  | "entertainment"
  | "magazine"
  | "sunday";

export type TemplateRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TemplateColumnGrid = {
  count: number;
  gutter: number;
};

export type TemplateBaselineGrid = {
  enabled: boolean;
  increment: number;
};

export type TemplateAdvertisementZone = TemplateRect & {
  id: string;
  name: string;
  locked: boolean;
  priority: number;
};

export type TemplateStorySlot = {
  id: string;
  name: string;
  priority: "lead" | "major" | "secondary" | "brief" | "filler";
  minimumColumns: number;
  preferredColumns: number;
  maximumColumns: number;
};

export type TemplateImageSlot = {
  id: string;
  name: string;
  required: boolean;
  preferredStorySlotId?: string;
  minimumColumns: number;
  preferredColumns: number;
};

export type TemplateChrome = {
  enabled: boolean;
  height: number;
  content?: string;
};

export type NewspaperPageTemplate = {
  id: string;
  name: string;
  pageType: NewspaperTemplatePageType;
  sectionName: string;
  pageSize: {
    width: number;
    height: number;
  };
  margins: TemplateMargins;
  columns: TemplateColumnGrid;
  baselineGrid: TemplateBaselineGrid;
  advertisementZones: TemplateAdvertisementZone[];
  preferredStorySlots: TemplateStorySlot[];
  preferredImageSlots: TemplateImageSlot[];
  header: TemplateChrome;
  footer: TemplateChrome;
  folio: TemplateChrome;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
};

export type TemplateImportPayload = {
  templates: NewspaperPageTemplate[];
};

/** Clones a template so manager operations never expose mutable internals. */
export const cloneTemplate = (template: NewspaperPageTemplate): NewspaperPageTemplate => ({
  ...template,
  pageSize: { ...template.pageSize },
  margins: { ...template.margins },
  columns: { ...template.columns },
  baselineGrid: { ...template.baselineGrid },
  advertisementZones: template.advertisementZones.map((zone) => ({ ...zone })),
  preferredStorySlots: template.preferredStorySlots.map((slot) => ({ ...slot })),
  preferredImageSlots: template.preferredImageSlots.map((slot) => ({ ...slot })),
  header: { ...template.header },
  footer: { ...template.footer },
  folio: { ...template.folio },
  metadata: { ...template.metadata },
});

