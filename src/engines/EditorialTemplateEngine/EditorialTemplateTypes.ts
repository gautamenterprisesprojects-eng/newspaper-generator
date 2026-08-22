export type EditorialTemplateRole = "lead" | "major" | "medium" | "brief";

export type EditorialTemplateVariant = "A" | "B" | "C";

export type EditorialTemplateCell = {
  slotId: string;
  columnStart: number;
  columnSpan: number;
};

export type EditorialTemplateSlotDefinition = EditorialTemplateCell & {
  yPercent: number;
  heightPercent: number;
  hasImage: boolean;
};

export type EditorialTemplateDefinition = {
  storyCount: number;
  variant: EditorialTemplateVariant;
  name: string;
  slots: EditorialTemplateSlotDefinition[];
};

export type EditorialTemplateSlot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: EditorialTemplateRole;
  hasImage: boolean;
};

export type EditorialTemplate = {
  storyCount: number;
  variant: EditorialTemplateVariant;
  name: string;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
  slots: EditorialTemplateSlot[];
};
