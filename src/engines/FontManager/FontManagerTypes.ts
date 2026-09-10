export type NewspaperFontRole =
  | "sans"
  | "serif"
  | "editorialHeadline"
  | "bodySerifCondensed"
  | "headlineRozha"
  | "headlineRanga"
  | "headlineKalam"
  | "headlineAmita";

export type NewspaperFontDefinition = {
  id: string;
  role: NewspaperFontRole;
  family: string;
  cssFamily: string;
  source: string;
  weight: number;
  style: "normal" | "italic";
  pdfRole: NewspaperFontRole;
};

export type FontAvailabilityStatus = "loading" | "loaded" | "fallback" | "error";

export type FontAvailabilityDiagnostic = {
  id: string;
  role: NewspaperFontRole;
  requestedFont: string;
  resolvedFont: string;
  measurementFont: string;
  renderFont: string;
  pdfFont: string;
  source: string;
  loaded: boolean;
  fallback: boolean;
  status: FontAvailabilityStatus;
  version: string;
};

export type FontManagerState = {
  ready: boolean;
  status: FontAvailabilityStatus;
  diagnostics: FontAvailabilityDiagnostic[];
  warning: string | null;
};
