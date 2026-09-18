import type { PrintPDFFontAsset } from "@/engines/PrintPDFEngine/PrintPDFTypes";
import { createCanvasFontString } from "@/engines/TypographyEngine/TextMeasure";
import { isCliffDemo3PortalSession } from "@/lib/nms/cliffDemo3Publisher";
import { getNmsExportRecipe } from "@/lib/nms/cliffDemo3ManualRecipe";
import type {
  FontAvailabilityDiagnostic,
  FontManagerState,
  NewspaperFontDefinition,
  NewspaperFontRole,
} from "./FontManagerTypes";

export const FONT_VERSION = "cliffdemo3 parity burn-gate 2026-09-17";

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
  slotKey?: string | number;
};

export type NewspaperHeadlineFontSelection = {
  fontFamily: string;
  fontStyle: "400" | "700";
};

const headlineDisplayFonts: NewspaperHeadlineFontSelection[] = [
  { fontFamily: NEWSPAPER_FONT_STACKS.headlineRozha, fontStyle: "700" },
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


export const resolveNewspaperCanvasFontStyle = (
  fontFamily: string,
  fontStyle?: string | null,
): string => {
  const weightMatch = String(fontStyle ?? "").match(/\b(400|500|550|600|700|800|900|bold)\b/i);
  const requested = weightMatch
    ? (weightMatch[1].toLowerCase() === "bold" ? 700 : Number(weightMatch[1]))
    : 400;

  const primaryFamily = fontFamily.split(",")[0]?.replace(/['"]/g, "").trim().toLowerCase() ?? "";
  const candidates = NEWSPAPER_FONT_DEFINITIONS.filter(
    (font) => font.family.replace(/['"]/g, "").trim().toLowerCase() === primaryFamily,
  );
  if (candidates.length === 0) {
    return String(requested);
  }

  const weights = [...new Set(candidates.map((font) => font.weight))].sort((a, b) => a - b);
  let best = weights[0];
  for (const weight of weights) {
    if (weight <= requested) {
      best = weight;
    }
  }
  return String(best);
};

export const isDevanagariNewspaperText = (text: string | null | undefined) =>
  /[\u0900-\u097F]/u.test(String(text ?? ""));

export const selectNewspaperHeadlineFont = ({
  text,
  priority,
  columnSpan,
  contentLanguage,
  slotKey,
}: HeadlineFontSelectionInput): NewspaperHeadlineFontSelection => {
  // NMS export only (?nmsExport=1 + bundle recipe): headline face per story
  // role from the recipe. Wizard sessions skip this and keep the committed
  // rotation below -- cliffdemo3 included.
  const recipePick = getNmsExportRecipe()?.fonts.headlineByPriority?.[priority];
  if (recipePick?.family && !(contentLanguage === "english" && !isDevanagariNewspaperText(text))) {
    return { fontFamily: recipePick.family, fontStyle: recipePick.weight };
  }
  if (contentLanguage === "english") {
    return { fontFamily: NEWSPAPER_FONT_STACKS.serif, fontStyle: "700" };
  }

  const safeColumnSpan = Number.isFinite(columnSpan) ? Math.max(1, Math.round(columnSpan)) : 2;
  const numericSlot = Number(slotKey);
  const index = Number.isFinite(numericSlot) && numericSlot > 0
    ? (Math.round(numericSlot) - 1) % headlineDisplayFonts.length
    : hashStableText(`${priority}|${safeColumnSpan}|${slotKey ?? ""}|${text}`) % headlineDisplayFonts.length;

  return headlineDisplayFonts[index];
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

export const getNewspaperFontStack = (role: NewspaperFontRole) => {
  // NMS export only: a recipe may ask for the primary face without the
  // Noto/serif chain behind it. Wizard sessions always get the full stack.
  if (getNmsExportRecipe()?.fonts.primaryOnlyNoStackFallback) {
    return NEWSPAPER_FONT_FAMILIES[role];
  }
  return NEWSPAPER_FONT_STACKS[role];
};

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


export const createAllFontDiagnostics = (): FontAvailabilityDiagnostic[] =>
  NEWSPAPER_FONT_DEFINITIONS.map((font) => {
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

export const waitForAllNewspaperFonts = async (): Promise<FontManagerState> => {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return {
      ready: true,
      status: "loaded",
      diagnostics: [],
      warning: null,
    };
  }

  await loadAllNewspaperFontFaces();
  await document.fonts.ready;

  const diagnostics = createAllFontDiagnostics();
  const fallback = diagnostics.some((font) => font.fallback);

  return {
    ready: !fallback,
    status: fallback ? "fallback" : "loaded",
    diagnostics,
    warning: fallback
      ? "One or more newspaper fonts are not loaded; export is blocked to avoid fallback metrics."
      : null,
  };
};

export const waitUntilAllNewspaperFontsLoaded = async (timeoutMs = 45000): Promise<FontManagerState> => {
  const deadline = Date.now() + Math.max(1000, timeoutMs);
  let last = await waitForAllNewspaperFonts();

  while (last.status !== "loaded" && Date.now() < deadline) {
    await loadAllNewspaperFontFaces();
    primeNewspaperFontsOnCanvas();
    await new Promise((resolve) => setTimeout(resolve, 250));
    last = await waitForAllNewspaperFonts();
  }

  return last;
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

/**
 * Asks the browser for every registered newspaper face, including the 700
 * Noto cuts that REQUIRED_FONT_DEFINITIONS skips. Canvas (unlike the DOM)
 * never starts @font-face on its own, so a headless Cliff News export that
 * only waited on the required regulars could still measure body copy against
 * Georgia and then paint headlines in Rozha once those files arrived.
 */
export const loadAllNewspaperFontFaces = async () => {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }

  await Promise.all(
    NEWSPAPER_FONT_DEFINITIONS.map(async (font) => {
      try {
        const sourceUrl =
          font.source.startsWith("http")
            ? font.source
            : `${window.location.origin}${font.source.startsWith("/") ? "" : "/"}${font.source}`;
        const face = new FontFace(font.family, `url("${sourceUrl}")`, {
          weight: String(font.weight),
          style: font.style || "normal",
        });
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        await document.fonts.load(toFontCheckString(font), "मानसून").catch(() => undefined);
      }
    }),
  );
  await Promise.all([
    document.fonts.load(`400 16px "Tinos"`).catch(() => undefined),
    document.fonts.load(`700 16px "Tinos"`).catch(() => undefined),
  ]);
  await document.fonts.ready;
};

export const primeNewspaperFontsOnCanvas = (target?: CanvasRenderingContext2D | null) => {
  if (typeof document === "undefined" && !target) {
    return;
  }

  const context =
    target ??
    document.createElement("canvas").getContext("2d");
  if (!context) {
    return;
  }

  for (const font of NEWSPAPER_FONT_DEFINITIONS) {
    context.font = `${font.weight} 16px "${font.family}"`;
    context.fillText("मानसून Aa", 0, 16);
  }
};

/**
 * Same gate the editor uses before a publisher is allowed to compose: every
 * required Devanagari face must actually be loaded, not merely requested.
 * Retries because Chromium headless often reports check()=false until the
 * face has been used on a canvas once.
 */

/**
 * cliffdemo3 only. Proves canvas will paint display faces, not Noto-as-Rozha.
 * Manual PageMint export uses the same DOM canvas path; if Rozha metrics match
 * Noto, headless fell back and we must not ship that PDF.
 */
export type CliffDemo3FontFaceProof = {
  role: string;
  family: string;
  weight: number;
  style: string;
  status: "loaded" | "missing" | "mismatch";
  checkOk: boolean;
  metricWidth?: number;
  referenceWidth?: number;
};

export type CliffDemo3FontProofReport = {
  engaged: boolean;
  faces: CliffDemo3FontFaceProof[];
};

/**
 * cliffdemo3 only. Proves canvas paints the same faces manual composition uses:
 * display headlines + ExtraCondensed body (400/550/600) + Sans (400/700) + Tinos 400.
 * Fail closed — never ship with silent Noto/system fallback.
 */
export const assertCliffDemo3DisplayFontsEngaged = async (): Promise<CliffDemo3FontProofReport> => {
  if (typeof window === "undefined" || !isCliffDemo3PortalSession()) {
    return { engaged: true, faces: [] };
  }
  if (typeof document === "undefined" || !document.fonts) {
    throw new Error("cliffdemo3 export blocked: document.fonts unavailable");
  }

  await loadAllNewspaperFontFaces();
  await document.fonts.ready;
  primeNewspaperFontsOnCanvas();

  // Explicit loads for faces that composition uses but soft-path may skip.
  await Promise.all([
    document.fonts.load(`550 16px "${NEWSPAPER_FONT_FAMILIES.bodySerifCondensed}"`).catch(() => undefined),
    document.fonts.load(`600 16px "${NEWSPAPER_FONT_FAMILIES.bodySerifCondensed}"`).catch(() => undefined),
    document.fonts.load(`400 16px "${NEWSPAPER_FONT_FAMILIES.sans}"`).catch(() => undefined),
    document.fonts.load(`700 16px "${NEWSPAPER_FONT_FAMILIES.sans}"`).catch(() => undefined),
    document.fonts.load(`400 16px "Tinos"`).catch(() => undefined),
    document.fonts.load(`700 16px "Tinos"`).catch(() => undefined),
  ]);
  primeNewspaperFontsOnCanvas();

  const required: Array<{ role: string; family: string; weight: number; style: string }> = [
    { role: "headline-lead", family: NEWSPAPER_FONT_FAMILIES.headlineRozha, weight: 400, style: "normal" },
    { role: "headline-major", family: NEWSPAPER_FONT_FAMILIES.headlineAmita, weight: 700, style: "normal" },
    { role: "headline-brief", family: NEWSPAPER_FONT_FAMILIES.headlineRanga, weight: 700, style: "normal" },
    { role: "headline-secondary", family: NEWSPAPER_FONT_FAMILIES.headlineKalam, weight: 700, style: "normal" },
    { role: "body-hindi-regular", family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed, weight: 400, style: "normal" },
    { role: "body-hindi", family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed, weight: 550, style: "normal" },
    { role: "inline-strip-bold", family: NEWSPAPER_FONT_FAMILIES.bodySerifCondensed, weight: 600, style: "normal" },
    { role: "subhead-caption-regular", family: NEWSPAPER_FONT_FAMILIES.sans, weight: 400, style: "normal" },
    { role: "subhead-byline-bold", family: NEWSPAPER_FONT_FAMILIES.sans, weight: 700, style: "normal" },
    { role: "body-english", family: "Tinos", weight: 400, style: "normal" },
  ];

  const faces: CliffDemo3FontFaceProof[] = [];
  const sampleHi = "जम्मू मानसून";
  const sampleEn = "Cliff News body";

  for (const font of required) {
    const check = `${font.weight} 48px "${font.family}"`;
    const probe = font.family === "Tinos" ? sampleEn : sampleHi;
    let ok = false;
    try {
      ok = document.fonts.check(check, probe);
    } catch {
      ok = false;
    }
    const proof: CliffDemo3FontFaceProof = {
      role: font.role,
      family: font.family,
      weight: font.weight,
      style: font.style,
      status: ok ? "loaded" : "missing",
      checkOk: ok,
    };
    faces.push(proof);
    if (!ok) {
      console.error("[cliffdemo3 fonts] face not engaged", proof);
      throw new Error(
        `cliffdemo3 export blocked: font not engaged (${font.family} ${font.weight} / ${font.role})`,
      );
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  canvas.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none;";
  document.body.appendChild(canvas);
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("cliffdemo3 export blocked: no 2d context for font proof");
    }
    const sample = "जम्मू जाने की बना रहे थे योजना";

    const measure = (spec: string) => {
      ctx.font = spec;
      return ctx.measureText(sample).width;
    };

    const rozha = measure(`400 48px "${NEWSPAPER_FONT_FAMILIES.headlineRozha}"`);
    const noto = measure(`400 48px "${NEWSPAPER_FONT_FAMILIES.serif}"`);
    const amita = measure(`700 48px "${NEWSPAPER_FONT_FAMILIES.headlineAmita}"`);
    const notoBold = measure(`700 48px "${NEWSPAPER_FONT_FAMILIES.serif}"`);
    const extra550 = measure(`550 48px "${NEWSPAPER_FONT_FAMILIES.bodySerifCondensed}"`);
    const noto550ish = measure(`400 48px "${NEWSPAPER_FONT_FAMILIES.serif}"`);
    const sans400 = measure(`400 48px "${NEWSPAPER_FONT_FAMILIES.sans}"`);
    const tinos = (() => {
      ctx.font = `400 48px "Tinos"`;
      return ctx.measureText(sampleEn).width;
    })();
    const georgia = (() => {
      ctx.font = `400 48px Georgia, serif`;
      return ctx.measureText(sampleEn).width;
    })();

    if (Math.abs(rozha - noto) < 0.75) {
      throw new Error(
        `cliffdemo3 export blocked: Rozha canvas metrics match Noto (${rozha.toFixed(2)}≈${noto.toFixed(2)}); display face not painting`,
      );
    }
    if (Math.abs(amita - notoBold) < 0.75) {
      throw new Error(
        `cliffdemo3 export blocked: Amita canvas metrics match Noto Bold (${amita.toFixed(2)}≈${notoBold.toFixed(2)}); display face not painting`,
      );
    }
    // ExtraCondensed Medium must not paint as generic serif.
    if (Math.abs(extra550 - noto550ish) < 0.75) {
      throw new Error(
        `cliffdemo3 export blocked: ExtraCondensed 550 metrics match Noto (${extra550.toFixed(2)}≈${noto550ish.toFixed(2)}); body face not painting`,
      );
    }
    // Sans must not paint as serif Noto.
    if (Math.abs(sans400 - noto) < 0.75) {
      throw new Error(
        `cliffdemo3 export blocked: Sans Devanagari metrics match Noto Serif (${sans400.toFixed(2)}≈${noto.toFixed(2)}); sans face not painting`,
      );
    }
    // Tinos must engage (not identical to empty/system failure → width 0).
    if (!(tinos > 1)) {
      throw new Error("cliffdemo3 export blocked: Tinos 400 did not measure on canvas");
    }

    for (const face of faces) {
      if (face.role === "headline-lead") {
        face.metricWidth = Number(rozha.toFixed(2));
        face.referenceWidth = Number(noto.toFixed(2));
      }
      if (face.role === "headline-major") {
        face.metricWidth = Number(amita.toFixed(2));
        face.referenceWidth = Number(notoBold.toFixed(2));
      }
      if (face.role === "body-hindi") {
        face.metricWidth = Number(extra550.toFixed(2));
        face.referenceWidth = Number(noto550ish.toFixed(2));
      }
      if (face.role === "subhead-caption-regular") {
        face.metricWidth = Number(sans400.toFixed(2));
        face.referenceWidth = Number(noto.toFixed(2));
      }
      if (face.role === "body-english") {
        face.metricWidth = Number(tinos.toFixed(2));
        face.referenceWidth = Number(georgia.toFixed(2));
      }
    }

    console.log("[cliffdemo3 fonts] canvas engagement ok", {
      rozha: Number(rozha.toFixed(2)),
      noto: Number(noto.toFixed(2)),
      amita: Number(amita.toFixed(2)),
      notoBold: Number(notoBold.toFixed(2)),
      extra550: Number(extra550.toFixed(2)),
      sans400: Number(sans400.toFixed(2)),
      tinos: Number(tinos.toFixed(2)),
      faces: faces.map((f) => ({
        role: f.role,
        family: f.family,
        weight: f.weight,
        style: f.style,
        status: f.status,
      })),
    });
  } finally {
    canvas.remove();
  }

  return { engaged: true, faces };
};

export const waitUntilNewspaperFontsLoaded = async (timeoutMs = 20000): Promise<FontManagerState> => {
  const deadline = Date.now() + Math.max(1000, timeoutMs);
  let last = await waitForNewspaperFonts();

  while (last.status !== "loaded" && Date.now() < deadline) {
    await loadAllNewspaperFontFaces();
    primeNewspaperFontsOnCanvas();
    await new Promise((resolve) => setTimeout(resolve, 250));
    last = await waitForNewspaperFonts();
  }

  return last;
};

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
      document.fonts.load(toFontCheckString(font), "मानसून").catch(() => undefined),
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
