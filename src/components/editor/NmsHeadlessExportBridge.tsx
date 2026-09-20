"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import {
  NEWSWIRE_SUBHEADING_PRESETS,
  getPaletteInlineAccent,
  getPaletteSubheadingStyle,
  getPaletteTintColor,
  type NewswireStory,
  type NewswireSubheadingPreset,
} from "@/lib/newswire";
import type { PageType } from "@/types/page";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import type { NmsBundleArticle, NmsBundlePayload } from "@/lib/nms/nmsBundleTypes";
import { pickNmsArticleImageUrl, textValue } from "@/lib/nms/nmsBundleTypes";
import { EDITOR_RAIL_FRONT_TEMPLATE_ID } from "@/engines/MasterPage/YouthUpdateConfig";
import { editorialAuthorsFromNmsPayload } from "@/lib/nms/nmsBundleEditorialAuthors";
import { usePublisherEditorialAuthorStore } from "@/store/publisherEditorialAuthorStore";
import {
  assertCliffDemo3DisplayFontsEngaged,
  type CliffDemo3FontProofReport,
  primeNewspaperFontsOnCanvas,
  waitUntilAllNewspaperFontsLoaded,
  waitUntilNewspaperFontsLoaded,
} from "@/engines/FontManager/FontManagerEngine";
import { isCliffDemo3PortalSession, isCliffDemo3PublisherIdentity } from "@/lib/nms/cliffDemo3Publisher";
import {
  buildCliffDemo3PaletteSeedBase,
  createCliffDemo3DeterministicPalettePicker,
} from "@/lib/nms/cliffDemo3DeterministicPalette";
import {
  findNewswirePresetById,
  resolveCliffDemo3CarriedPaletteFromPayload,
} from "@/lib/nms/cliffDemo3CarriedPalette";
import {
  resolvePageMintRecipeFromPayload,
  setActivePageMintRecipe,
  type CliffDemo3PageMintRecipe,
} from "@/lib/nms/cliffDemo3ManualRecipe";
import { buildPublicationProfilePatchFromPortal } from "@/lib/nms/cliffDemo3PortalPublicationProfile";
import { sampleImageColorsAt } from "@/lib/sampleImageColors";
import { getHeaderMaskSamplePoints } from "@/engines/HeaderSystem/HeaderSlotGeometry";
import { clearTextMeasurementCache } from "@/engines/TypographyEngine/TextMeasure";

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

const limitWords = (text: string, limit: number) => {
  const parts = words(text);
  return parts.length > limit ? parts.slice(0, limit).join(" ") : text;
};

const cleanNmsBody = (body: string, headline: string) => {
  const lines = body
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const cleaned: string[] = [];
  const labelOnly = /^(?:इमेज कैप्शन|हेडलाइन|सबहेडिंग\s*\d*|फोटो कैप्शन|कैप्शन)\s*:?\s*$/u;
  const headlineText = headline.replace(/\s+/gu, " ").trim();

  for (const line of lines) {
    if (labelOnly.test(line)) continue;
    if (line.replace(/\s+/gu, " ").trim() === headlineText) continue;
    cleaned.push(line.replace(/^(?:इमेज कैप्शन|हेडलाइन|सबहेडिंग\s*\d*|फोटो कैप्शन|कैप्शन)\s*:\s*/u, ""));
  }

  return cleaned.join("\n\n").trim() || body;
};

type EditorStorySnapshot = ReturnType<typeof useEditorStore.getState>["stories"];

const getPrintableImageSource = (source: string) =>
  source.startsWith("http") ? `/api/print-image?url=${encodeURIComponent(source)}` : source;

const extractNmsSubheadings = (article: NmsBundleArticle): string[] => {
  if (Array.isArray(article.subheadings)) {
    return article.subheadings.map((value) => textValue(value)).filter(Boolean).slice(0, 3);
  }
  const nested = article.ui_hindi || article.ui_english || article.article;
  if (nested && Array.isArray(nested.subheadings)) {
    return nested.subheadings.map((value) => textValue(value)).filter(Boolean).slice(0, 3);
  }
  return [];
};

const extractNmsSubheadline = (article: NmsBundleArticle, subheadings: string[]) =>
  textValue(article.subheadline) ||
  textValue(article.secondary_headline) ||
  textValue(article.ui_hindi?.secondary_headline) ||
  textValue(article.ui_english?.secondary_headline) ||
  textValue(article.article?.secondary_headline) ||
  subheadings[0] ||
  "";

const extractNmsImageCaption = (article: NmsBundleArticle) =>
  textValue(article.imageCaption) ||
  textValue(article.image_caption) ||
  textValue(article.caption) ||
  textValue(article.ui_hindi?.image_caption) ||
  textValue(article.ui_english?.image_caption) ||
  textValue(article.article?.image_caption) ||
  "";

const snapshotNmsPageStories = (pageId: string, stories: EditorStorySnapshot) => {
  const store = (window as typeof window & {
    __NMS_PAGE_STORIES__?: Map<string, EditorStorySnapshot>;
  });
  if (!store.__NMS_PAGE_STORIES__) {
    store.__NMS_PAGE_STORIES__ = new Map();
  }
  store.__NMS_PAGE_STORIES__.set(pageId, stories.map((story) => ({ ...story })));
};

const snapshotNmsPageImageSources = (pageId: string, sources: Record<string, string>) => {
  const store = window as typeof window & {
    __NMS_PAGE_IMAGE_SOURCES__?: Map<string, Record<string, string>>;
  };
  if (!store.__NMS_PAGE_IMAGE_SOURCES__) {
    store.__NMS_PAGE_IMAGE_SOURCES__ = new Map();
  }
  store.__NMS_PAGE_IMAGE_SOURCES__.set(pageId, { ...sources });
};

const buildNmsPageImageSources = (
  stories: EditorStorySnapshot,
  chunk: NewswireStory[],
): Record<string, string> => {
  const state = useEditorStore.getState();
  const sources: Record<string, string> = {};
  stories.forEach((story, index) => {
    const documentStory = state.document.stories[story.id];
    const photoAssetId = documentStory?.photo ?? null;
    const asset = photoAssetId ? state.document.assets[photoAssetId] : null;
    const fromAsset = textValue(asset?.previewUrl || asset?.source || "");
    const fromWire = textValue(chunk[index]?.imageUrl || "");
    const raw = fromAsset || fromWire;
    if (raw) {
      sources[story.id] = getPrintableImageSource(raw);
    }
  });
  return sources;
};

const namespaceActivePageStories = (pageIndex: number) => {
  const prefix = `nms-p${pageIndex + 1}-`;
  useEditorStore.setState((state) => {
    const pageId = state.activePageId;
    const idMap = new Map(state.stories.map((story) => [story.id, `${prefix}${story.id}`]));
    if (idMap.size === 0) return {};

    const stories = state.stories.map((story) => ({
      ...story,
      id: idMap.get(story.id) ?? story.id,
    }));
    const documentStories = { ...state.document.stories };
    idMap.forEach((newId, oldId) => {
      const story = documentStories[oldId];
      if (story) {
        documentStories[newId] = { ...story, id: newId };
        delete documentStories[oldId];
      }
    });

    // importNewswireStories always writes story-1 / story-1-frame. Renaming
    // stories alone left those frame keys free for page 2 to occupy, so the
    // front page's frameIds still pointed at inside-page boxes laid out from
    // the folio strip (~54pt) instead of below the 6.1cm masthead — the
    // header printed on top of the first row. Frame ids have to move too.
    const frameIdMap = new Map<string, string>();
    const nextFrames: typeof state.document.frames = {};
    for (const [frameId, frame] of Object.entries(state.document.frames)) {
      if (frame.pageId === pageId && frame.storyId && idMap.has(frame.storyId)) {
        const nextStoryId = idMap.get(frame.storyId) ?? frame.storyId;
        const nextFrameId = `${prefix}${frameId}`;
        frameIdMap.set(frameId, nextFrameId);
        nextFrames[nextFrameId] = { ...frame, id: nextFrameId, storyId: nextStoryId };
      } else {
        nextFrames[frameId] = frame;
      }
    }

    return {
      stories,
      selectedStoryId: state.selectedStoryId ? idMap.get(state.selectedStoryId) ?? state.selectedStoryId : state.selectedStoryId,
      selectedFrameId: state.selectedFrameId ? frameIdMap.get(state.selectedFrameId) ?? state.selectedFrameId : state.selectedFrameId,
      selectedFrameIds: state.selectedFrameIds.map((frameId) => frameIdMap.get(frameId) ?? frameId),
      selectedObjects: state.selectedObjects.map((selection) => ({
        ...selection,
        storyId: idMap.get(selection.storyId) ?? selection.storyId,
      })),
      document: {
        ...state.document,
        stories: documentStories,
        frames: nextFrames,
        pages: state.document.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                frameIds: page.frameIds.map((frameId) => frameIdMap.get(frameId) ?? frameId),
                stories: page.stories.map((placement) => ({
                  ...placement,
                  storyId: idMap.get(placement.storyId) ?? placement.storyId,
                })),
              }
            : page,
        ),
      },
    };
  });
};

type NmsBylineOptions = {
  useNewspaperByline: boolean;
  reporterNameAboveByline: boolean;
};

const toNewswireStory = (
  article: NmsBundleArticle,
  index: number,
  bylineOptions: NmsBylineOptions = {
    useNewspaperByline: false,
    reporterNameAboveByline: false,
  },
): NewswireStory => {
  const headline = textValue(article.headline) || textValue(article.originalHeadline) || `NMS Story ${index + 1}`;
  const body = cleanNmsBody(textValue(article.body) || textValue(article.originalBody) || "", headline);
  const imageUrl = pickNmsArticleImageUrl(article);
  const subheadings = extractNmsSubheadings(article);
  const subheadline = extractNmsSubheadline(article, subheadings);
  const imageCaption = extractNmsImageCaption(article);
  const category = textValue(article.category) || "National";
  const explicitReporterName = textValue(article.reporter?.nameHi) || textValue(article.reporter?.name);
  const reporterName = explicitReporterName || "द क्लिफ न्यूज़";
  const bylineObj =
    article.byline && typeof article.byline === "object" ? (article.byline as { designation?: unknown; place?: unknown }) : null;
  const reporterDesignation =
    textValue(article.reporter?.printDesignation) ||
    textValue(article.reporter?.designation) ||
    textValue(bylineObj?.designation);
  const reporterPlace =
    textValue(article.reporter?.printPlaceName) ||
    textValue(article.reporter?.place) ||
    textValue(bylineObj?.place) ||
    textValue(article.reporterPlace) ||
    textValue(article.place);
  const bylineName = [reporterName, reporterDesignation].filter(Boolean).join(", ");

  return {
    id: String(article.newsId ?? `nms-${index + 1}`),
    language: /[\u0900-\u097F]/.test(`${headline}\n${body}`) ? "hindi" : "english",
    category,
    headline,
    subheadline,
    body,
    shortBody: limitWords(body, 220),
    mediumBody: limitWords(body, 420),
    longBody: body,
    summary: subheadings,
    caption: imageCaption,
    imageUrl,
    imageCaption,
    place: reporterPlace,
    sourceTitle: "NMS",
    sourceUrl: "",
    publishedAt: null,
    // When the recipe keeps the publication byline, leave this empty so the
    // import's page-level byline remains authoritative. The original reporter
    // is carried separately and becomes a compact line above it.
    bylineName: bylineOptions.useNewspaperByline ? "" : bylineName,
    ...(bylineOptions.reporterNameAboveByline && explicitReporterName
      ? { nmsReporterNameAboveByline: explicitReporterName }
      : {}),
    photoCredit: "",
  } as NewswireStory;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Blocks until the Devanagari @font-face files are really loaded, then throws
 * away every width this page measured before that happened.
 *
 * Canvas text never triggers @font-face loading on its own, so composition
 * measures whatever face is resolvable at the moment it runs. In a publisher's
 * own browser the files are warm and that is always the real face. In the
 * headless container this bridge runs in they arrive over HTTP on a cold cache,
 * and composition — which starts the instant the bundle payload lands — used to
 * win the race: lines were broken and justified against fallback metrics, then
 * drawn with the real face, so every word after the first landed at an x
 * computed for glyphs of a different width and the copy printed on top of
 * itself. Gating composition on the fonts is what makes the headless sheet
 * identical to the one the editor exports by hand.
 */
let lastCliffDemo3FontProof: CliffDemo3FontProofReport | null = null;
  const awaitNewspaperFontsBeforeComposing = async () => {
  const fontState = await waitUntilAllNewspaperFontsLoaded(45000);
  await document.fonts?.ready;
  primeNewspaperFontsOnCanvas();
  clearTextMeasurementCache();
  console.log("[NMS export bridge] fonts ready before composition", {
    status: fontState.status,
    ready: fontState.ready,
    fallbacks: fontState.diagnostics.filter((font) => font.fallback).map((font) => font.id),
  });
  if (fontState.status !== "loaded") {
    const missing = fontState.diagnostics.filter((font) => font.fallback).map((font) => font.id);
    throw new Error(
      `Cliff News NMS export blocked: newspaper fonts not loaded (${missing.join(", ") || "unknown"}).`,
    );
  }
  // cliffdemo3 only — prove canvas paints Rozha/Amita, not Noto fallbacks
  if (isCliffDemo3PortalSession()) {
    lastCliffDemo3FontProof = await assertCliffDemo3DisplayFontsEngaged();
    if (lastCliffDemo3FontProof?.faces?.length) {
      console.log("[NMS export bridge] cliffdemo3 font proof", lastCliffDemo3FontProof.faces);
    }
  }
  return fontState;
};

/**
 * The same palette rotation, tint and justification settings the manual
 * "generate all pages" run uses (see EditorCanvas.tsx's buildOptions) — one
 * unused palette per page, 60% background behind the subheading bands.
 */
const NMS_PALETTE_BACKGROUND_OPACITY = 0.6;

/** Legacy random picker — retained for non-cliffdemo3 NMS paths only. */
const createNmsPalettePickerLegacy = () => {
  const pool = NEWSWIRE_SUBHEADING_PRESETS.filter((preset) => preset.id !== "custom");
  const used = new Set<string>();

  return (): NewswireSubheadingPreset => {
    const unused = pool.filter((preset) => !used.has(preset.id));
    const candidates = unused.length > 0 ? unused : pool;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(picked.id);
    return picked;
  };
};

if (typeof window !== "undefined") {
  (window as unknown as {
    __PAGEMINT_CLIFFDEMO3_DETERMINISTIC_PALETTE__?: {
      buildSeed: typeof buildCliffDemo3PaletteSeedBase;
      createPicker: typeof createCliffDemo3DeterministicPalettePicker;
      getPaletteTintColor: typeof getPaletteTintColor;
      getPaletteInlineAccent: typeof getPaletteInlineAccent;
      getPaletteSubheadingStyle: typeof getPaletteSubheadingStyle;
      opacity: number;
    };
  }).__PAGEMINT_CLIFFDEMO3_DETERMINISTIC_PALETTE__ = {
    buildSeed: buildCliffDemo3PaletteSeedBase,
    createPicker: createCliffDemo3DeterministicPalettePicker,
    getPaletteTintColor,
    getPaletteInlineAccent,
    getPaletteSubheadingStyle,
    opacity: NMS_PALETTE_BACKGROUND_OPACITY,
  };
}

const resizeDocumentToPageCount = (pageCount: number) => {
  while (useEditorStore.getState().document.pages.length < pageCount) {
    useEditorStore.getState().addEditionPage("end");
  }
  while (useEditorStore.getState().document.pages.length > pageCount && useEditorStore.getState().document.pages.length > 1) {
    const pages = useEditorStore.getState().document.pages;
    useEditorStore.getState().setActivePage(pages[pages.length - 1].id);
    useEditorStore.getState().deleteActivePage();
  }
};

export function NmsHeadlessExportBridge() {
  const searchParams = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (searchParams.get("nmsExport") !== "1" || started.current) return;
    started.current = true;

    (async () => {
      try {
        await awaitNewspaperFontsBeforeComposing();

        const job = searchParams.get("job")?.trim() || "";
        console.log("[NMS export bridge] loading bundle payload", job);
        const response = await fetch(`/api/nms-bundle?includePayload=1${job ? `&job=${encodeURIComponent(job)}` : ""}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`NMS export payload fetch failed: ${response.status}`);
        const envelope = await response.json() as { payload?: NmsBundlePayload };
        const payload = envelope.payload;
        if (!payload || !Array.isArray(payload.articles)) throw new Error("NMS export payload missing articles.");

        const bundleAuthors = editorialAuthorsFromNmsPayload(payload);
        if (bundleAuthors.length > 0) {
          usePublisherEditorialAuthorStore.getState().setAuthors(bundleAuthors);
        }
        usePublisherEditorialAuthorStore.getState().setHydrated();

        const plannedPages = payload.editionPlan?.pages;
        if (!Array.isArray(plannedPages) || plannedPages.length === 0) {
          throw new Error("NMS export payload missing sequential edition plan.");
        }

        console.log("[NMS export bridge] sequential pages", plannedPages.map((page) => ({
          pageNumber: page.pageNumber,
          templateId: page.templateId,
          templateName: page.templateName,
          boxes: page.boxCount,
          nms: page.nmsArticleCount,
          fill: page.fillArticleCount,
        })));

        resizeDocumentToPageCount(plannedPages.length);

        useEditorStore.setState((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              newspaperName: "THE CLIFF NEWS",
            },
          },
        }));
        const recipe = resolvePageMintRecipeFromPayload(payload);
        setActivePageMintRecipe(recipe);

        // cliffdemo3 only: apply the same publication-profile patch PortalLaunchBootstrap
        // writes after /publisher/profile (city / volume / year / price). Other IDs skip.
        const portalProfile = (payload as NmsBundlePayload & {
          portalPublicationProfile?: {
            city?: string;
            cover_price?: string | number;
            publication_start_year?: number | string | null;
            last_volume_number?: number | string | null;
          };
        }).portalPublicationProfile
          || (payload as NmsBundlePayload & { meta?: { portalPublicationProfile?: unknown } }).meta?.portalPublicationProfile;
        const cliffDemo3Target = isCliffDemo3PublisherIdentity(
          String(payload.pagemint_user_id || payload.pagemint_target_id || "").trim(),
        );
        if (recipe && cliffDemo3Target) {
          const patch: {
            city?: string;
            price?: string;
            establishedText?: string;
            volumeLabel?: string;
          } = portalProfile
            ? buildPublicationProfilePatchFromPortal(portalProfile as {
                city?: string;
                cover_price?: string | number;
                publication_start_year?: number | string | null;
                last_volume_number?: number | string | null;
              })
            : {};
          // The masthead city should follow the specific API-enabled reporter
          // or sub-editor this bundle belongs to (their registered print
          // place name / district / city -- editorialAuthorsFromNmsPayload
          // above already resolved this the same way the byline does), not
          // the portal's single publisher-wide default. Falls back to the
          // portal's city when the bundle carries no resolvable place.
          const reporterLocation = bundleAuthors[0]?.location?.trim();
          if (reporterLocation) {
            patch.city = reporterLocation;
          }
          const headerState = useEditorStore.getState().document.headerSystem;
          const profileId = headerState.activeHeaderSetId
            ? headerState.headerSets[headerState.activeHeaderSetId]?.publicationProfileId
            : null;
          if (profileId && Object.keys(patch).length > 0) {
            useEditorStore.getState().updatePublicationProfile(profileId, patch);
            console.log("[NMS export bridge] applied cliffdemo3 publication profile", {
              ...patch,
              citySource: reporterLocation ? "nmsReporterPlace" : (portalProfile ? "portal" : "none"),
            });
          }
          // Same portal header artwork the manual wizard applies (edition[0] or legacy fields).
          if (portalProfile) {
            const portalFull = portalProfile as {
              city?: string;
              cover_price?: string | number;
              publication_start_year?: number | string | null;
              last_volume_number?: number | string | null;
              front_page_header_url?: string;
              remaining_page_header_url?: string;
              editions?: Array<{ front_header_url?: string; inside_header_url?: string }>;
              theme_color?: string;
            };
            const selectedEdition = Array.isArray(portalFull.editions) ? portalFull.editions[0] : undefined;
            const frontHeaderUrl = selectedEdition?.front_header_url || portalFull.front_page_header_url || "";
            const insideHeaderUrl = selectedEdition?.inside_header_url || portalFull.remaining_page_header_url || "";
            if (frontHeaderUrl || insideHeaderUrl) {
              const [frontMaskColors, insideMaskColors] = await Promise.all([
                frontHeaderUrl ? sampleImageColorsAt(frontHeaderUrl, getHeaderMaskSamplePoints("front")) : Promise.resolve(null),
                insideHeaderUrl ? sampleImageColorsAt(insideHeaderUrl, getHeaderMaskSamplePoints("inside")) : Promise.resolve(null),
              ]);
              if (frontHeaderUrl) {
                useEditorStore.getState().setHeaderBannerImage("front", frontHeaderUrl, frontMaskColors ?? undefined);
              }
              if (insideHeaderUrl) {
                useEditorStore.getState().setHeaderBannerImage("inside", insideHeaderUrl, insideMaskColors ?? undefined);
              }
              console.log("[NMS export bridge] applied cliffdemo3 portal header artwork", {
                hasFront: Boolean(frontHeaderUrl),
                hasInside: Boolean(insideHeaderUrl),
              });
            }
            if (portalFull.theme_color) {
              useEditorStore.getState().setHeaderAccentColor(portalFull.theme_color);
            }
          }
        }

        if (recipe) {
          console.log("[NMS export bridge] applying pageMintRecipe", {
            schemaVersion: recipe.schemaVersion,
            frontTemplateId: recipe.layout.frontTemplateId,
            primaryOnlyFonts: recipe.fonts.primaryOnlyNoStackFallback,
            stretchDisplayHeadlines: recipe.typographyFit.stretchDisplayHeadlines,
            inlineSubheads: recipe.subheads.inlineColumnSubheadings,
            dpi: recipe.pdfEngine.dpi,
          });
          (window as typeof window & { __NMS_EXPORT_DEBUG?: Record<string, unknown> }).__NMS_EXPORT_DEBUG = {
            ...((window as typeof window & { __NMS_EXPORT_DEBUG?: Record<string, unknown> }).__NMS_EXPORT_DEBUG || {}),
            pageMintRecipe: {
              schemaVersion: recipe.schemaVersion,
              layout: recipe.layout,
              fonts: recipe.fonts,
              typographyFit: recipe.typographyFit,
              subheads: recipe.subheads,
              images: recipe.images,
              pdfEngine: recipe.pdfEngine,
              importOptions: recipe.importOptions,
            },
          };
        }
        // Byline source is declared by the recipe (cliffdemo3 NMS profile):
        //   "newspaper_name" -> the publication name, like the wizard default
        //   anything else    -> the bundle sender (reporter) name, as before
        const bylineFromNewspaperName =
          (recipe?.importOptions as { bylineSource?: string } | undefined)?.bylineSource === "newspaper_name";
        const portalNewspaperName = textValue(
          (portalProfile as { newspaper_name?: unknown } | undefined)?.newspaper_name,
        );
        const bylineName = bylineFromNewspaperName
          ? portalNewspaperName || textValue(recipe?.newspaperNameHi) || "द क्लिफ न्यूज़"
          : textValue(payload.targetUser?.nameHi) || textValue(payload.targetUser?.fullName) || "द क्लिफ न्यूज़";
        const pageMintTarget = String(
          payload.pagemint_user_id || payload.pagemint_target_id || "",
        ).trim();
        const useDeterministicCliffDemo3Palette = isCliffDemo3PublisherIdentity(pageMintTarget);
        const reporterNameAboveByline = Boolean(
          useDeterministicCliffDemo3Palette &&
          bylineFromNewspaperName &&
          recipe?.importOptions.reporterNameAboveByline === true,
        );
        const carriedPalette = resolveCliffDemo3CarriedPaletteFromPayload(pageMintTarget, {
          cliffdemo3ManualPalette: (payload as { cliffdemo3ManualPalette?: unknown }).cliffdemo3ManualPalette,
          manualBatchPalette: (payload as { manualBatchPalette?: unknown }).manualBatchPalette,
          pageMintRecipe: recipe as { manualBatchPalette?: unknown; cliffdemo3ManualPalette?: unknown } | null,
          meta: (payload as { meta?: { cliffdemo3ManualPalette?: unknown; manualBatchPalette?: unknown } }).meta,
        });
        const paletteSource: "explicit" | "recipe-classic-fixed" | "deterministic" | "legacy-random" = carriedPalette
          ? "explicit"
          : recipe?.importOptions.paletteMode === "classic_fixed"
            ? "recipe-classic-fixed"
            : useDeterministicCliffDemo3Palette
              ? "deterministic"
              : "legacy-random";
        const paletteSeedBase = buildCliffDemo3PaletteSeedBase({
          jobId: textValue(payload.job_id),
          bundleId: textValue(payload.bundle_id),
          publicationDate: textValue(
            (payload as { publication_date?: unknown; publicationDate?: unknown }).publication_date
              ?? (payload as { publicationDate?: unknown }).publicationDate,
          ),
        });
        const pickPalette = useDeterministicCliffDemo3Palette
          ? createCliffDemo3DeterministicPalettePicker(paletteSeedBase)
          : createNmsPalettePickerLegacy();
        const selectedPalettes: Array<{
          pageNumber: number;
          paletteId: string;
          tintColor: string;
          inlineSubheadingColor: string;
          subheadingStyle: ReturnType<typeof getPaletteSubheadingStyle>;
          tintedStoryBackground: boolean;
          inlineColumnSubheadings: boolean;
          colouredHeadings: boolean;
          paletteSource: typeof paletteSource;
        }> = [];
        const recipeOpacity = recipe?.importOptions.subheadingBandOpacity ?? NMS_PALETTE_BACKGROUND_OPACITY;

        for (let pageIndex = 0; pageIndex < plannedPages.length; pageIndex += 1) {
          const planned = plannedPages[pageIndex];
          const page = useEditorStore.getState().document.pages[pageIndex];
          if (!page) throw new Error(`Queued page ${pageIndex + 1} is missing from the document.`);

          useEditorStore.getState().setActivePage(page.id);
          const maxSubheads = recipe?.subheads.maxSubheadingsPerStory;
          const chunk = (planned.articles ?? []).map((article, articleIndex) => {
            const story = toNewswireStory(article, pageIndex * 100 + articleIndex, {
              useNewspaperByline: reporterNameAboveByline,
              reporterNameAboveByline,
            });
            if (typeof maxSubheads === "number" && maxSubheads >= 0 && Array.isArray(story.summary)) {
              story.summary = story.summary.slice(0, maxSubheads);
              if (maxSubheads === 0) story.subheadline = "";
            }
            return story;
          });
          if (chunk.length === 0) {
            throw new Error(`Queued page ${planned.pageNumber} (${planned.templateName}) has no articles.`);
          }

          console.log("[NMS export bridge] generating queued page", {
            pageNumber: planned.pageNumber,
            pageKind: planned.pageKind,
            templateId: planned.templateId,
            templateName: planned.templateName,
            articleCount: chunk.length,
          });

          await awaitNewspaperFontsBeforeComposing();
          const opts = recipe?.importOptions;
          let palette;
          let tintColor: string;
          let inlineSubheadingColor: string;
          let subheadingStyle: ReturnType<typeof getPaletteSubheadingStyle>;
          let tintedStoryBackground = opts?.tintedStoryBackground ?? true;
          let inlineColumnSubheadings = opts?.inlineColumnSubheadings ?? true;
          let colouredHeadings = opts?.colouredHeadings ?? false;
          if (carriedPalette) {
            const preset = findNewswirePresetById(carriedPalette.paletteId);
            if (!preset) {
              throw new Error(
                `[cliffdemo3 carried palette] preset vanished for id ${carriedPalette.paletteId}`,
              );
            }
            palette = preset;
            tintColor = carriedPalette.tintColor;
            inlineSubheadingColor = carriedPalette.inlineSubheadingColor;
            subheadingStyle = { ...carriedPalette.subheadingStyle };
            tintedStoryBackground =
              carriedPalette.tintedStoryBackground ?? tintedStoryBackground;
            inlineColumnSubheadings =
              carriedPalette.inlineColumnSubheadings ?? inlineColumnSubheadings;
            colouredHeadings = carriedPalette.colouredHeadings ?? colouredHeadings;
          } else if (recipe?.importOptions.paletteMode === "classic_fixed") {
            // Wizard default palette (WIZARD_ACCENT_PRESETS[0] = "classic") at the
            // recipe's band opacity -- one fixed look for every cliffdemo3 NMS page.
            palette = NEWSWIRE_SUBHEADING_PRESETS.find((preset) => preset.id === "classic") ?? pickPalette();
            tintColor = getPaletteTintColor(palette);
            inlineSubheadingColor = getPaletteInlineAccent(palette);
            subheadingStyle = getPaletteSubheadingStyle(palette, recipeOpacity);
          } else {
            palette = pickPalette();
            tintColor = getPaletteTintColor(palette);
            inlineSubheadingColor = getPaletteInlineAccent(palette);
            subheadingStyle = getPaletteSubheadingStyle(palette, recipeOpacity);
          }
          selectedPalettes.push({
            pageNumber: planned.pageNumber,
            paletteId: String(palette.id),
            tintColor,
            inlineSubheadingColor,
            subheadingStyle,
            tintedStoryBackground,
            inlineColumnSubheadings,
            colouredHeadings,
            paletteSource,
          });
          console.log("[NMS export bridge] cliffdemo3 palette", {
            paletteSource,
            deterministic: useDeterministicCliffDemo3Palette && paletteSource !== "explicit",
            seedBase: paletteSeedBase,
            pageNumber: planned.pageNumber,
            paletteId: palette.id,
            tintColor,
            inlineSubheadingColor,
            subheadingStyle,
            tintedStoryBackground,
            inlineColumnSubheadings,
            colouredHeadings,
          });
          useEditorStore.getState().importNewswireStories(
            "NMS Bundle",
            chunk,
            {
              languageMode: opts?.languageMode ?? "hindi",
              bylineName,
              pageKind: planned.pageKind,
              templateId: planned.templateId as TemplateId,
              colouredHeadings,
              tintedStoryBackground,
              tintColor,
              inlineColumnSubheadings,
              inlineSubheadingColor,
              palettePreset: palette,
              subheadingStyle,
              bodyAlignment: opts?.bodyAlignment ?? "justify",
              professionalJustification: opts?.professionalJustification ?? true,
              isBatchGeneration: opts?.isBatchGeneration ?? true,
              // Reporter/editor photo prints on the left rail only, not in bylines.
              nmsBylinePortrait: opts?.nmsBylinePortrait ?? false,
            },
          );
          useEditorStore.setState((state) => ({
            stories: state.stories.map((story) => {
              const headlineBlob = JSON.stringify(story.articleData?.headline ?? "");
              return /[\u0900-\u097F]/u.test(headlineBlob)
                ? { ...story, contentLanguage: "hindi" as const }
                : story;
            }),
          }));
          namespaceActivePageStories(pageIndex);
          const snapPageId = useEditorStore.getState().activePageId;
          const snapStories = useEditorStore.getState().stories;
          if (snapPageId) {
            snapshotNmsPageStories(snapPageId, snapStories);
            snapshotNmsPageImageSources(snapPageId, buildNmsPageImageSources(snapStories, chunk));
          }
          useEditorStore.setState((state) => ({
            document: {
              ...state.document,
              pages: state.document.pages.map((documentPage, index) =>
                index === pageIndex
                  ? {
                      ...documentPage,
                      pageType: (planned.pageKind === "front" ? "front" : "city") as PageType,
                      sectionName: planned.pageKind === "front" ? "Front Page" : planned.templateName || "City",
                    }
                  : documentPage,
              ),
            },
          }));

          await document.fonts?.ready;
          await wait(750);
        }

        const finalPages = useEditorStore.getState().document.pages;
        useEditorStore.getState().setActivePage(finalPages[finalPages.length - 1]?.id ?? finalPages[0]?.id);

        await wait(2500);
        const finalState = useEditorStore.getState();
        const fontDebug = await waitUntilAllNewspaperFontsLoaded(45000).catch(() => null);
        const prevDebug = (window as typeof window & { __NMS_EXPORT_DEBUG?: Record<string, unknown> }).__NMS_EXPORT_DEBUG || {};
        (window as typeof window & { __NMS_EXPORT_DEBUG?: unknown }).__NMS_EXPORT_DEBUG = {
          ...prevDebug,
          cliffdemo3Palettes: selectedPalettes,
          cliffdemo3PaletteSeed: paletteSeedBase,
          cliffdemo3PaletteDeterministic: useDeterministicCliffDemo3Palette,
          cliffdemo3PaletteSource: paletteSource,
          cliffdemo3PaletteExplicit: paletteSource === "explicit",
          fonts: fontDebug
            ? {
                status: fontDebug.status,
                ready: fontDebug.ready,
                fallbacks: fontDebug.diagnostics.filter((font) => font.fallback).map((font) => font.id),
              }
            : null,
          activePageId: finalState.activePageId,
          pageType: finalState.pageType,
          pageCount: finalState.document.pages.length,
          pages: finalState.document.pages.map((page) => ({
            id: page.id,
            pageNumber: page.pageNumber,
            pageType: page.pageType,
            sectionName: page.sectionName,
            storyIds: page.stories.map((placement) => placement.storyId),
          })),
          editionPlan: plannedPages.map((page) => ({
            pageNumber: page.pageNumber,
            templateId: page.templateId,
            templateName: page.templateName,
            boxCount: page.boxCount,
            nmsArticleCount: page.nmsArticleCount,
            fillArticleCount: page.fillArticleCount,
          })),
          activeStoryIds: finalState.stories.map((story) => story.id),
          documentStoryCount: Object.keys(finalState.document.stories).length,
        };

        await document.fonts?.ready;
        await wait(400);
        if (isCliffDemo3PortalSession()) {
          await assertCliffDemo3DisplayFontsEngaged();
          clearTextMeasurementCache();
          console.log("[NMS export bridge] cliffdemo3 fonts asserted before export ready");
        }
        console.log("[NMS export bridge] ready for combined editor PDF export");
        (window as typeof window & { __NMS_EXPORT_READY?: boolean; __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_READY = true;
      } catch (error) {
        console.error("[NMS export bridge] failed", error);
        (window as typeof window & { __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_ERROR = error instanceof Error ? error.message : String(error);
      }
    })();
  }, [searchParams]);

  return null;
}
