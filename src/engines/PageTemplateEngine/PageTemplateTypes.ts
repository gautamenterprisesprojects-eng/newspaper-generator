export type PageTemplateRole = "lead" | "secondary" | "brief";

export type PageTemplateSlot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: PageTemplateRole;
};

export type PageTemplate = {
  storyCount: number;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
  slots: PageTemplateSlot[];
};
