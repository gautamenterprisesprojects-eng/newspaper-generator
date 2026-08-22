import type { PrintPDFFontAsset } from "@/engines/PrintPDFEngine/PrintPDFTypes";
import { createCanvasFontString } from "@/engines/TypographyEngine/TextMeasure";
import type {
  FontAvailabilityDiagnostic,
  FontManagerState,
  NewspaperFontDefinition,
  NewspaperFontRole,
} from "./FontManagerTypes";

export const FONT_VERSION = "Noto Devanagari static TTF 2026-07";

export const NEWSPAPER_FONT_FAMILIES = {
  sans: "Cliff Noto Sans Devanagari",
  serif: "Cliff Noto Serif Devanagari",
  editorialHeadline: "Tiro Devanagari Hindi",
} as const;

export const NEWSPAPER_FONT_STACKS = {
  sans: `${NEWSPAPER_FONT_FAMILIES.sans}, sans-serif`,
  serif: `${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  editorialHeadline: `${NEWSPAPER_FONT_FAMILIES.editorialHeadline}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
} as const;

export const NEWSPAPER_FONT_DEFINITIONS: NewspaperFontDefinition[] = [
  {
    id: "cliff-noto-sans-devanagari-regular",
    role: "sans",
    family: NEWSPAPER_FONT_FAMILIES.sans,
    cssFamily: NEWSPAPER_FONT_STACKS.sans,
    source: "/fonts/NotoSansDevanagari-Regular.ttf",
    weight: 400,
    style: "normal",
    pdfRole: "sans",
  },
  {
    id: "cliff-noto-sans-devanagari-bold",
    role: "sans",
    family: NEWSPAPER_FONT_FAMILIES.sans,
    cssFamily: NEWSPAPER_FONT_STACKS.sans,
    source: "/fonts/NotoSansDevanagari-Bold.ttf",
    weight: 700,
    style: "normal",
    pdfRole: "sans",
  },
  {
    id: "cliff-noto-serif-devanagari-regular",
    role: "serif",
    family: NEWSPAPER_FONT_FAMILIES.serif,
    cssFamily: NEWSPAPER_FONT_STACKS.serif,
    source: "/fonts/NotoSerifDevanagari-Regular.ttf",
    weight: 400,
    style: "normal",
    pdfRole: "serif",
  },
  {
    id: "cliff-noto-serif-devanagari-bold",
    role: "serif",
    family: NEWSPAPER_FONT_FAMILIES.serif,
    cssFamily: NEWSPAPER_FONT_STACKS.serif,
    source: "/fonts/NotoSerifDevanagari-Bold.ttf",
    weight: 700,
    style: "normal",
    pdfRole: "serif",
  },
];

const REQUIRED_FONT_DEFINITIONS = NEWSPAPER_FONT_DEFINITIONS.filter(
  (font) => font.weight === 400,
);

const toFontCheckString = (font: NewspaperFontDefinition) =>
  `${font.style} ${font.weight} 16px "${font.family}"`;

const getBrowserFontEntries = () => {
  if (typeof document === "undefined" || !document.fonts?.entries) {
    return [];
  }

  return Array.from(document.fonts.entries()).map(([font]) => font);
};

export const getNewspaperFontStack = (role: NewspaperFontRole) =>
  NEWSPAPER_FONT_STACKS[role];

export const getNewspaperFontFamily = (role: NewspaperFontRole) =>
  NEWSPAPER_FONT_FAMILIES[role];

export const getFontDefinitionsForRole = (role: NewspaperFontRole) =>
  NEWSPAPER_FONT_DEFINITIONS.filter((font) => font.role === role);

const getFontStatus = (font: NewspaperFontDefinition) => {
  if (typeof document === "undefined" || !document.fonts) {
    return false;
  }

  try {
    if (document.fonts.check && document.fonts.check(toFontCheckString(font), "मानसून")) {
      return true;
    }
  } catch {
    // ignore
  }

  if (!document.fonts.entries) {
    return false;
  }

  const cleanTarget = font.family.replace(/['"]/g, "").trim().toLowerCase();

  return getBrowserFontEntries().some(
    (entry) => {
      const cleanEntry = entry.family.replace(/['"]/g, "").trim().toLowerCase();
      const matchesFamily = cleanEntry === cleanTarget;
      const matchesStyle = entry.style === font.style || !entry.style;
      const weights = entry.weight ? entry.weight.split(" ").map((w) => Number(w)) : [];
      const matchesWeight = weights.length === 0 || weights.includes(font.weight) || (entry.weight === "normal" && font.weight === 400) || (entry.weight === "bold" && font.weight === 700);

      return matchesFamily && matchesStyle && matchesWeight && entry.status === "loaded";
    },
  );
};

export const createFontDiagnostics = (): FontAvailabilityDiagnostic[] =>
  REQUIRED_FONT_DEFINITIONS.map((font) => {
    const loaded = getFontStatus(font);
    const requestedFont = toFontCheckString(font);
    const measurementFont = createCanvasFontString(font.cssFamily, 16, `${font.weight}`);

    return {
      id: font.id,
      role: font.role,
      requestedFont,
      resolvedFont: font.family,
      measurementFont,
      renderFont: font.cssFamily,
      pdfFont: font.source,
      source: font.source,
      loaded,
      fallback: !loaded,
      status: loaded ? "loaded" : "fallback",
      version: FONT_VERSION,
    };
  });

export const waitForNewspaperFonts = async (): Promise<FontManagerState> => {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return {
      ready: true,
      status: "loaded",
      diagnostics: [],
      warning: null,
    };
  }

  await Promise.all([
    ...REQUIRED_FONT_DEFINITIONS.map((font) =>
      document.fonts.load(toFontCheckString(font), "मानसून"),
    ),
    // Tinos (English-language body copy, see EditorialStyleEngine.ts's
    // ENGLISH_NEWSPAPER_BODY_FONT_FAMILY) -- not in REQUIRED_FONT_DEFINITIONS
    // since it's conditional (English stories only) and its absence must
    // never block composition/fall back the way a missing Devanagari font
    // does. Canvas text (unlike DOM text) never triggers @font-face loading
    // on its own, so this fire-and-forget request is what makes sure the
    // file is actually loaded before any story measures/draws with it --
    // .catch swallows failure since a missing Tinos just means that font
    // falls back to its own CSS stack (Georgia/Times New Roman), not a
    // blocked page.
    document.fonts.load(`400 16px "Tinos"`).catch(() => undefined),
    document.fonts.load(`700 16px "Tinos"`).catch(() => undefined),
    document.fonts.load(`400 16px "${NEWSPAPER_FONT_FAMILIES.editorialHeadline}"`).catch(() => undefined),
  ]);
  await document.fonts.ready;

  const diagnostics = createFontDiagnostics();
  const fallback = diagnostics.some((font) => font.fallback);

  return {
    ready: !fallback,
    status: fallback ? "fallback" : "loaded",
    diagnostics,
    warning: fallback
      ? "Required Devanagari fonts are not loaded; composition is blocked to avoid fallback metrics."
      : null,
  };
};

export const createInitialFontManagerState = (): FontManagerState => ({
  ready: false,
  status: "loading",
  diagnostics: createFontDiagnostics(),
  warning: null,
});

export const loadPrintPDFFontAssets = async (): Promise<PrintPDFFontAsset[]> => {
  if (typeof fetch === "undefined") {
    return [];
  }

  const regularFonts = REQUIRED_FONT_DEFINITIONS;
  const assets = await Promise.all(
    regularFonts.map(async (font) => {
      const response = await fetch(font.source);

      if (!response.ok) {
        throw new Error(`Failed to load PDF font asset: ${font.source}`);
      }

      return {
        id: font.id,
        role: font.pdfRole,
        familyNames: [font.family],
        data: await response.arrayBuffer(),
      } satisfies PrintPDFFontAsset;
    }),
  );

  return assets;
};
