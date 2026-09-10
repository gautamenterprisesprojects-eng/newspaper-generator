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
  bodySerifCondensed: "Cliff Noto Serif Devanagari ExtraCondensed",
  headlineRozha: "Rozha One",
  headlineRanga: "Ranga",
  headlineKalam: "Kalam",
  headlineAmita: "Amita",
} as const;

export const NEWSPAPER_FONT_STACKS = {
  sans: `${NEWSPAPER_FONT_FAMILIES.sans}, sans-serif`,
  serif: `${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  editorialHeadline: `${NEWSPAPER_FONT_FAMILIES.editorialHeadline}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  bodySerifCondensed: `${NEWSPAPER_FONT_FAMILIES.bodySerifCondensed}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  headlineRozha: `${NEWSPAPER_FONT_FAMILIES.headlineRozha}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  headlineRanga: `${NEWSPAPER_FONT_FAMILIES.headlineRanga}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  headlineKalam: `${NEWSPAPER_FONT_FAMILIES.headlineKalam}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
  headlineAmita: `${NEWSPAPER_FONT_FAMILIES.headlineAmita}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
} as const;

type HeadlineFontSelectionInput = {
  text: string;
  priority: string;
  columnSpan: number;
  contentLanguage?: "hindi" | "english";
};

export type NewspaperHeadlineFontSelection = {
  fontFamily: string;
  fontStyle: "400" | "700";
};

const headlineDisplayFonts: NewspaperHeadlineFontSelection[] = [
  { fontFamily: NEWSPAPER_FONT_STACKS.headlineRozha, fontStyle: "400" },
  { fontFamily: NEWSPAPER_FONT_STACKS.headlineRanga, fontStyle: "700" },
  { fontFamily: NEWSPAPER_FONT_STACKS.headlineAmita, fontStyle: "700" },
  { fontFamily: NEWSPAPER_FONT_STACKS.headlineKalam, fontStyle: "700" },
];

const hashStableText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const selectNewspaperHeadlineFont = ({
  text,
  priority,
  columnSpan,
  contentLanguage,
}: HeadlineFontSelectionInput): NewspaperHeadlineFontSelection => {
  if (contentLanguage === "english") {
    return { fontFamily: NEWSPAPER_FONT_STACKS.serif, fontStyle: priority === "lead" ? "700" : "700" };
  }

  if (priority === "lead" || priority === "major" || columnSpan >= 4) {
    return headlineDisplayFonts[0];
  }

  const safeColumnSpan = Number.isFinite(columnSpan) ? Math.max(1, Math.round(columnSpan)) : 2;
  const palette =
    safeColumnSpan <= 1
      ? headlineDisplayFonts.slice(0, 2)
      : safeColumnSpan === 2
        ? headlineDisplayFonts.slice(0, 3)
        : headlineDisplayFonts;
  const index = hashStableText(`${priority}|${safeColumnSpan}|${text}`) % palette.length;

  return palette[index];
};

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
  {
    id: "cliff-noto-serif-devanagari-extra-condensed-regular",
    role: "bodySerifCondensed",
    family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed,
    cssFamily: NEWSPAPER_FONT_STACKS.bodySerifCondensed,
    source: "/fonts/NotoSerifDevanagari-ExtraCondensed.ttf",
    weight: 400,
    style: "normal",
    pdfRole: "bodySerifCondensed",
  },
  {
    id: "cliff-noto-serif-devanagari-extra-condensed-medium",
    role: "bodySerifCondensed",
    family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed,
    cssFamily: NEWSPAPER_FONT_STACKS.bodySerifCondensed,
    source: "/fonts/NotoSerifDevanagari-ExtraCondensedMedium.ttf",
    weight: 550,
    style: "normal",
    pdfRole: "bodySerifCondensed",
  },
  {
    id: "cliff-noto-serif-devanagari-extra-condensed-semibold",
    role: "bodySerifCondensed",
    family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed,
    cssFamily: NEWSPAPER_FONT_STACKS.bodySerifCondensed,
    source: "/fonts/NotoSerifDevanagari-ExtraCondensedSemiBold.ttf",
    weight: 600,
    style: "normal",
    pdfRole: "bodySerifCondensed",
  },
  {
    id: "tiro-devanagari-hindi-regular",
    role: "editorialHeadline",
    family: NEWSPAPER_FONT_FAMILIES.editorialHeadline,
    cssFamily: NEWSPAPER_FONT_STACKS.editorialHeadline,
    source: "/fonts/TiroDevanagariHindi-Regular.ttf",
    weight: 400,
    style: "normal",
    pdfRole: "editorialHeadline",
  },
  {
    id: "rozha-one-regular",
    role: "headlineRozha",
    family: NEWSPAPER_FONT_FAMILIES.headlineRozha,
    cssFamily: NEWSPAPER_FONT_STACKS.headlineRozha,
    source: "/fonts/RozhaOne-Regular.ttf",
    weight: 400,
    style: "normal",
    pdfRole: "headlineRozha",
  },
  {
    id: "ranga-bold",
    role: "headlineRanga",
    family: NEWSPAPER_FONT_FAMILIES.headlineRanga,
    cssFamily: NEWSPAPER_FONT_STACKS.headlineRanga,
    source: "/fonts/Ranga-Bold.ttf",
    weight: 700,
    style: "normal",
    pdfRole: "headlineRanga",
  },
  {
    id: "kalam-bold",
    role: "headlineKalam",
    family: NEWSPAPER_FONT_FAMILIES.headlineKalam,
    cssFamily: NEWSPAPER_FONT_STACKS.headlineKalam,
    source: "/fonts/Kalam-Bold.ttf",
    weight: 700,
    style: "normal",
    pdfRole: "headlineKalam",
  },
  {
    id: "amita-bold",
    role: "headlineAmita",
    family: NEWSPAPER_FONT_FAMILIES.headlineAmita,
    cssFamily: NEWSPAPER_FONT_STACKS.headlineAmita,
    source: "/fonts/Amita-Bold.ttf",
    weight: 700,
    style: "normal",
    pdfRole: "headlineAmita",
  },
];

const REQUIRED_FONT_DEFINITIONS = NEWSPAPER_FONT_DEFINITIONS.filter(
  (font) =>
    font.weight === 400 ||
    font.id === "cliff-noto-serif-devanagari-extra-condensed-medium" ||
    font.id === "ranga-bold" ||
    font.id === "kalam-bold" ||
    font.id === "amita-bold",
);

const toFontCheckString = (font: NewspaperFontDefinition) =>
  `${font.style} ${font.weight} 16px "${font.family}"`;

const getBrowserFontEntries = (): FontFace[] => {
  if (typeof document === "undefined" || !document.fonts) {
    return [];
  }

  // FontFaceSet is Set-like, and the engines disagree about what entries()
  // yields: Chromium gives [key, value] pairs, WebKit gives the FontFace
  // itself. So `.map(([font]) => font)` -- destructuring the pair -- threw
  // "TypeError: {} is not iterable" on WebKit. Verified against real WebKit:
  // entries()[0] is [object FontFace], Array.isArray false, not iterable.
  //
  // That mattered far out of proportion to its size. This runs from
  // createInitialFontManagerState, which is a useState initialiser in
  // EditorCanvas, so it threw during the editor's very first render and took
  // the whole page down -- Safari showed its "This page couldn't load"
  // process-crash screen. Chrome on iOS is WebKit too, which is why both iOS
  // browsers failed while Android was fine.
  //
  // forEach is on FontFaceSet in both engines and hands back the FontFace
  // directly, with no pair shape to disagree about.
  const fonts: FontFace[] = [];
  try {
    document.fonts.forEach((font) => {
      if (font) fonts.push(font);
    });
  } catch {
    return [];
  }

  return fonts;
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

  if (typeof document.fonts.forEach !== "function") {
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
