/**
 * cliffdemo3 manual PageMint recipe — must match NMS cliffDemo3PageMintRecipe.js
 */
import type { NmsBundlePayload } from "./nmsBundleTypes";
import { isCliffDemo3PublisherIdentity, isCliffDemo3PortalSession } from "./cliffDemo3Publisher";

export type PageMintHeadlineFontSpec = {
  family: string;
  weight: "400" | "700";
};

export type CliffDemo3PageMintRecipe = {
  schemaVersion: string;
  publisherId: string;
  newspaperName: string;
  newspaperNameHi: string;
  layout: {
    frontTemplateId: string;
    frontTemplateLabel: string;
    insideDefaultTemplateId: string;
    railAuthorSource: string;
    story1Role: string;
    story2Role: string;
  };
  importOptions: {
    languageMode: "hindi" | "english";
    colouredHeadings: boolean;
    tintedStoryBackground: boolean;
    inlineColumnSubheadings: boolean;
    bodyAlignment: "justify" | "left";
    professionalJustification: boolean;
    isBatchGeneration: boolean;
    nmsBylinePortrait: boolean;
    subheadingBandOpacity: number;
    paletteMode: string;
    /** "newspaper_name" -> byline shows the publication name (wizard default); otherwise the bundle sender. */
    bylineSource?: string;
    /** NMS-only opt-in: print the article reporter on a compact line above that byline. */
    reporterNameAboveByline?: boolean;
  };
  fonts: {
    primaryOnlyNoStackFallback: boolean;
    blockExportIfDisplayMatchesNoto: boolean;
    headlineByPriority: Record<string, PageMintHeadlineFontSpec>;
    body: { hindi: string; english: string };
    subhead: string;
    byline: string;
    caption: string;
  };
  typographyFit: {
    stretchDisplayHeadlines: boolean;
    maxHeadlineScaleX: number;
    sentenceEndFitting: boolean;
    justifyBody: boolean;
    professionalJustification: boolean;
  };
  subheads: {
    inlineColumnSubheadings: boolean;
    stripSubheadingBands: boolean;
    bandBackgroundOpacity: number;
    useManualBatchPaletteRotation: boolean;
    maxSubheadingsPerStory: number;
  };
  images: {
    preferCoverImage: boolean;
    drawStoryImages: boolean;
    bylinePortraitInArticleBox: boolean;
    railPortraitFromEditorialAuthors: boolean;
  };
  pdfEngine: {
    renderer: string;
    burnPath: string;
    dpi: number;
    embed: string;
    waitFontsBeforeComposeMs: number;
    waitFontsBeforeBurn: boolean;
    attachCanvasForFontFace: boolean;
    clearTextMeasurementCacheBeforeBurn: boolean;
  };
  textEngine: {
    contentLanguageFromDevanagariHeadline: boolean;
    forceHindiWhenDevanagari: boolean;
    cleanNmsBodyLabels: boolean;
  };
};

export const CLIFFDEMO3_MANUAL_RECIPE: CliffDemo3PageMintRecipe = {
  schemaVersion: "nms-pagemint-manual-recipe-v1",
  publisherId: "cliffdemo3",
  newspaperName: "THE CLIFF NEWS",
  newspaperNameHi: "द क्लिफ न्यूज़",
  layout: {
    frontTemplateId: "CliffFrontEditorRail8A",
    frontTemplateLabel: "एडिटर रेल फ्रंट पेज (8 बॉक्स)",
    insideDefaultTemplateId: "IndianFront6A",
    railAuthorSource: "bundle_sender",
    story1Role: "editorial_rail",
    story2Role: "page_lead",
  },
  importOptions: {
    languageMode: "hindi",
    colouredHeadings: false,
    tintedStoryBackground: true,
    inlineColumnSubheadings: true,
    bodyAlignment: "justify",
    professionalJustification: true,
    isBatchGeneration: true,
    nmsBylinePortrait: false,
    subheadingBandOpacity: 0.6,
    paletteMode: "rotate_unused_manual_batch",
  },
  fonts: {
    primaryOnlyNoStackFallback: true,
    blockExportIfDisplayMatchesNoto: true,
    headlineByPriority: {
      lead: { family: "Rozha One", weight: "400" },
      major: { family: "Amita", weight: "700" },
      secondary: { family: "Kalam", weight: "700" },
      brief: { family: "Ranga", weight: "700" },
      filler: { family: "Ranga", weight: "700" },
    },
    body: {
      hindi: "Cliff Noto Serif Devanagari ExtraCondensed",
      english: "Tinos",
    },
    subhead: "Cliff Noto Sans Devanagari",
    byline: "Cliff Noto Sans Devanagari",
    caption: "Cliff Noto Sans Devanagari",
  },
  typographyFit: {
    stretchDisplayHeadlines: false,
    maxHeadlineScaleX: 1.0,
    sentenceEndFitting: true,
    justifyBody: true,
    professionalJustification: true,
  },
  subheads: {
    inlineColumnSubheadings: true,
    stripSubheadingBands: true,
    bandBackgroundOpacity: 0.6,
    useManualBatchPaletteRotation: true,
    maxSubheadingsPerStory: 3,
  },
  images: {
    preferCoverImage: true,
    drawStoryImages: true,
    bylinePortraitInArticleBox: false,
    railPortraitFromEditorialAuthors: true,
  },
  pdfEngine: {
    renderer: "pagemint-editor-headless",
    burnPath: "buildDocumentPdfBytes/renderDocumentPageToDataUrl",
    dpi: 300,
    embed: "png",
    waitFontsBeforeComposeMs: 45000,
    waitFontsBeforeBurn: true,
    attachCanvasForFontFace: true,
    clearTextMeasurementCacheBeforeBurn: true,
  },
  textEngine: {
    contentLanguageFromDevanagariHeadline: true,
    forceHindiWhenDevanagari: true,
    cleanNmsBodyLabels: true,
  },
};

const RECIPE_WINDOW_KEY = "__NMS_PAGE_MINT_RECIPE__";

export const getActivePageMintRecipe = (): CliffDemo3PageMintRecipe | null => {
  if (typeof window === "undefined") return null;
  const fromWindow = (window as typeof window & { [RECIPE_WINDOW_KEY]?: CliffDemo3PageMintRecipe })[RECIPE_WINDOW_KEY];
  if (fromWindow?.schemaVersion) return fromWindow;
  if (isCliffDemo3PortalSession()) return CLIFFDEMO3_MANUAL_RECIPE;
  return null;
};

export const setActivePageMintRecipe = (recipe: CliffDemo3PageMintRecipe | null) => {
  if (typeof window === "undefined") return;
  (window as typeof window & { [RECIPE_WINDOW_KEY]?: CliffDemo3PageMintRecipe | null })[RECIPE_WINDOW_KEY] = recipe;
};

export const resolvePageMintRecipeFromPayload = (payload: NmsBundlePayload): CliffDemo3PageMintRecipe | null => {
  const target = String(payload.pagemint_user_id || payload.pagemint_target_id || "").trim();
  const isCliff = isCliffDemo3PublisherIdentity(target);
  if (!isCliff) return null;

  const fromPayload = (payload as NmsBundlePayload & { pageMintRecipe?: CliffDemo3PageMintRecipe }).pageMintRecipe;
  const fromMeta = (payload as NmsBundlePayload & { meta?: { pageMintRecipe?: CliffDemo3PageMintRecipe } }).meta?.pageMintRecipe;
  const candidate = fromPayload || fromMeta;
  if (candidate && typeof candidate === "object" && candidate.schemaVersion) {
    return {
      ...CLIFFDEMO3_MANUAL_RECIPE,
      ...candidate,
      importOptions: { ...CLIFFDEMO3_MANUAL_RECIPE.importOptions, ...(candidate.importOptions || {}) },
      fonts: {
        ...CLIFFDEMO3_MANUAL_RECIPE.fonts,
        ...(candidate.fonts || {}),
        headlineByPriority: {
          ...CLIFFDEMO3_MANUAL_RECIPE.fonts.headlineByPriority,
          ...(candidate.fonts?.headlineByPriority || {}),
        },
        body: { ...CLIFFDEMO3_MANUAL_RECIPE.fonts.body, ...(candidate.fonts?.body || {}) },
      },
      typographyFit: { ...CLIFFDEMO3_MANUAL_RECIPE.typographyFit, ...(candidate.typographyFit || {}) },
      subheads: { ...CLIFFDEMO3_MANUAL_RECIPE.subheads, ...(candidate.subheads || {}) },
      images: { ...CLIFFDEMO3_MANUAL_RECIPE.images, ...(candidate.images || {}) },
      pdfEngine: { ...CLIFFDEMO3_MANUAL_RECIPE.pdfEngine, ...(candidate.pdfEngine || {}) },
      textEngine: { ...CLIFFDEMO3_MANUAL_RECIPE.textEngine, ...(candidate.textEngine || {}) },
      layout: { ...CLIFFDEMO3_MANUAL_RECIPE.layout, ...(candidate.layout || {}) },
    };
  }
  return CLIFFDEMO3_MANUAL_RECIPE;
};

/** True only inside the headless NMS export page (?nmsExport=1). Wizard sessions are never NMS exports. */
export const isNmsExportSession = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nmsExport") === "1";

/**
 * The recipe for the CURRENT NMS export, or null in every wizard session.
 * Shared typography code (FontManager / composeArticleBox) must use this --
 * not getActivePageMintRecipe() -- so the manual wizard keeps its committed
 * behaviour for every publisher, cliffdemo3 included.
 */
export const getNmsExportRecipe = (): CliffDemo3PageMintRecipe | null =>
  isNmsExportSession() ? getActivePageMintRecipe() : null;
