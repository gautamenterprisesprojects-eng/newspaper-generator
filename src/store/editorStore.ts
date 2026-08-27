import { create } from "zustand";
import { prototypeArticle } from "@/data/prototypeArticle";
import {
  addAdvertisement,
  autoPlaceAdvertisements,
  createAdvertisementFrame,
  placeAdvertisementInFrame,
  replaceAdvertisementArtwork,
  updateAdvertisementStatus,
} from "@/engines/AdvertisementManager/AdvertisementManagerEngine";
import type { AdvertisementBookingInput } from "@/engines/AdvertisementManager/AdvertisementManagerTypes";
import {
  buildPageAdvertisementsLayout,
  type PageAdvertisement,
} from "@/engines/AdvertisementManager/PageAdvertisementPlacement";
import {
  createAssetRecord,
  deleteAsset as deleteDocumentAsset,
  importAssets as importDocumentAssets,
  placeAssetInFrame,
  relinkAsset as relinkDocumentAsset,
  setAssetLinkStatus,
} from "@/engines/AssetManager/AssetManagerEngine";
import type { AssetImportDescriptor } from "@/engines/AssetManager/AssetManagerTypes";
import { cloneRichText, normalizeRichText, richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  addPage,
  createArticleDataFromStoryObject,
  createDocumentFromStoryFrames,
  deleteFrame,
  deletePage,
  duplicateFrame,
  duplicatePage,
  getStoryFramesForPage,
  movePage,
  setDocumentCanvasMode,
  updatePageProperties,
  updateDocumentPageFromStoryFrames,
} from "@/engines/DocumentEngine/DocumentEngine";
import {
  groupFrames,
  moveFrameBefore,
  reorderFrameLayer,
  ungroupFrames,
  updateFrameProperties as updateFrameManagerProperties,
} from "@/engines/FrameManager/FrameManagerEngine";
import {
  applyMasterToPage,
  createMasterPage as createDocumentMasterPage,
  deleteMasterPage as deleteDocumentMasterPage,
  detachMasterFromPage,
  duplicateMasterPage as duplicateDocumentMasterPage,
  overrideMasterElementOnPage,
  renameMasterPage as renameDocumentMasterPage,
} from "@/engines/MasterPage/MasterPageEngine";
import { normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import { composeArticleBox } from "@/engines/ArticleComposer/composeArticleBox";
import { createDefaultCaptionData } from "@/engines/CaptionStyling/CaptionStylingEngine";
import { composeEditorialPage } from "@/engines/EditorialPageComposer/EditorialPageComposer";
import {
  ARTICLE_SIZE_CLASS_CONFIG,
  classifyArticles,
  estimateStoryWordCapacity,
  getClassWordCapacity,
} from "@/engines/EditorialLayoutQuality/EditorialSpaceOptimizer";
import { generateTemplateLayout } from "@/engines/TemplateLayout/TemplateLayoutEngine";
import { getTemplateColumnCount } from "@/engines/TemplateLayout/TemplateRegistry";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import {
  selectOptimisticNewswireWordTier,
  determineInternalTextColumnCount as computePhysicalTextColumns,
} from "@/engines/CustomLayoutGenerator";
import {
  shouldApplyEditorialHeadlineStyle,
  createStyledHeadlineRichText,
} from "@/engines/EditorialDesignEngine/EditorialHeadlineStylingEngine";
import {
  convertColorToLightTintRgba,
  convertColorToTintBorder,
} from "@/engines/EditorialDesignEngine/EditorialBackgroundTintEngine";
import {
  BOXED_STYLE_SPEC,
  selectStoryVisualStyle,
  type StoryVisualStyle,
} from "@/engines/EditorialDesignEngine/StoryVisualStyleEngine";

import {
  createCompositionSessionManager,
  createGeometrySnapshot,
} from "@/engines/CompositionSession";
import {
  frontHeaderLayouts,
  activateHeaderSet,
  deleteHeaderSet,
  duplicateActiveHeaderSet,
  exportActiveHeaderSetJson,
  importHeaderSetJson,
  insideHeaderLayouts,
  normalizeHeaderSystemState,
  FRONT_HEADER_HEIGHT_PT,
  INSIDE_HEADER_HEIGHT_PT,
  removePageHeaderOverride,
  removeSectionHeaderOverride,
  renameHeaderSet,
  resolveHeaderReservedContentBounds,
  saveHeaderSetAs,
  setActiveHeaderHidden,
  setActiveHeaderLocked,
  setDefaultHeaderSet,
  resetActiveHeaderLayouts,
  setPageInsideHeaderOverride,
  setSectionInsideHeaderOverride,
} from "@/engines/HeaderSystem";
import { YOUTH_UPDATE_MASTHEAD_HEIGHT_PT, YOUTH_UPDATE_COLORS } from "@/engines/MasterPage/YouthUpdateMastheadGeometry";
import {
  YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_PT,
  YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_PT,
} from "@/engines/MasterPage/YouthUpdateInsideHeaderGeometry";
import {
  isYouthUpdateFrontTemplateId,
  isYouthUpdateHeaderOnlyInsideTemplateId,
  isYouthUpdateInsideTemplateId,
} from "@/engines/MasterPage/YouthUpdateConfig";
import { useYouthUpdateInsideRailStore } from "@/store/youthUpdateInsideRailStore";
import { useYouthUpdateInsideTeaserLiveStore } from "@/store/youthUpdateInsideTeaserLiveStore";
import { commitLayoutSolution } from "@/engines/LayoutTransactionEngine/LayoutCommitEngine";
import { analyzeLayoutSnapshot } from "@/engines/LayoutTransactionEngine/LayoutSnapshotAnalyzer";
import { buildLayoutSolution } from "@/engines/LayoutTransactionEngine/TransactionBuilder";
import {
  createLiveResizeController,
  type LiveResizeHandle,
  type LiveResizePointer,
} from "@/engines/LayoutTransactionEngine/LiveResizeController";
import { runLayoutKernelShadowResize } from "@/engines/LayoutTransactionEngine/LayoutKernelAdapter";
import type { PreviewDrawCommand } from "@/engines/LayoutTransactionEngine/PreviewRenderer";
import { normalizeParagraphTypography } from "@/engines/ParagraphTypography/ParagraphTypographyEngine";
import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import {
  createCleanDirtyFlags,
  mergeDirtyFlags,
} from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import {
  getDefaultStoryColumnSpan,
} from "@/engines/StorySpan/StorySpanEngine";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import { rebalanceStorySpans } from "@/engines/StorySpan/StorySpanRebalanceEngine";
import {
  findStoryPlacement,
  getDefaultStorySize,
} from "@/engines/StoryPlacementEngine/StoryPlacementEngine";
import {
  applyStyle,
  clearStyleOverrides,
  createStyle,
  deleteStyle,
  duplicateStyle,
  exportStyles,
  importStyles,
  markStyleOverride,
  renameStyle,
  updateStyle,
} from "@/engines/StyleManager/StyleManagerEngine";
import type { StyleCreateInput, StyleExportFormat, StyleImportFormat, StyleUpdateInput } from "@/engines/StyleManager/StyleManagerTypes";
import { generateModularStoryLayout, generateRandomStoryLayout } from "@/engines/TemplateLayout/TemplateLayoutEngine";

import type {
  ArticleBoxModel,
  ArticleCompositionSettings,
  FrontPageArticleStyle,
  EditorialPageArticleStyle,
  ArticleData,
  CaptionPosition,
  EditorEditingMode,
  EditorObjectType,
  EditorSelectedObject,
  Point,
  EditorSelectionBounds,
  EditorTextRange,
  Size,
  StoryColumnSpan,
  StoryFrame,
  StoryFrameId,
  StoryDirtyFlags,
  StoryImageSettings,
  StoryTypographySettings,
  TypographyEditingScope,
} from "@/types/editor";
import type { HeaderLayoutKind, InsideHeaderLayoutKind, PublicationProfile } from "@/types/header";
import type {
  EditionCanvasMode,
  EditionPageColorLabel,
  EditionPageStatus,
  NewspaperAsset,
  NewspaperAssetId,
  NewspaperAdvertisementId,
  NewspaperAdvertisementStatus,
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperMasterPageId,
  NewspaperMasterElementId,
  NewspaperPageId,
  NewspaperPageObject,
  NewspaperStyleId,
  NewspaperStoryObject,
} from "@/types/document";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import {
  cleanNewswireText,
  ensureEndsWithFullStop,
  getLocalizedArticleContent,
  getSlotLanguage,
  hasMeaningfulLocalizedContent,
  getPaletteHeadlineAccent,
  normalizeArticleBodyText,
  trimToNearestFullStop,
  type ArticleLanguage,
  type NewswireSubheadingPreset,
  type NewswireStory,
  type PageLanguageMode,
} from "@/lib/newswire";
import type { RichTextDocument } from "@/types/RichText";
import type { PageKind, PageType } from "@/types/page";
import { clamp, snapPoint, snapSize, snapValue } from "@/utils/grid";
import { POINTS_PER_INCH } from "@/utils/page";
import {
  getAuthorRailReservation,
  isEditorialAuthorSlot,
} from "@/engines/MasterPage/AuthorBlockGeometry";
// Editorial-page-only styling. Read exclusively under `pageKind === "editorial"`
// branches, so nothing here can reach a front-page or inside-page layout.
import {
  EDITORIAL_ARTICLE_STYLE,
  EDITORIAL_COLOURS,
  EDITORIAL_FILL_MIN_COLUMN_SPAN,
  EDITORIAL_FILL_TO_FOOT,
  EDITORIAL_FILL_WORD_TIER,
  EDITORIAL_IMAGE,
  EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
  getEditorialTextColumnCount,
} from "@/engines/MasterPage/EditorialPageStyle";

const MIN_STORY_SIZE: Size = {
  width: 180,
  height: 240,
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const PAGE_BOUNDS = {
  width: toPoints(DEFAULT_PAGE_MASTER.width),
  height: toPoints(DEFAULT_PAGE_MASTER.height),
};

const PAGE_RECT = {
  x: 0,
  y: 0,
  width: PAGE_BOUNDS.width,
  height: PAGE_BOUNDS.height,
};
const liveResizeController = createLiveResizeController();
const multiSelectionSessionManager = createCompositionSessionManager({
  idPrefix: "multi-selection",
});

type HeaderDocumentTransaction = {
  id: string;
  label: string;
  before: NewspaperDocument;
  after: NewspaperDocument;
};

type HeaderDocumentHistory = {
  transactions: HeaderDocumentTransaction[];
  cursor: number;
  maxEntries: number;
};

const headerDocumentHistory: HeaderDocumentHistory = {
  transactions: [],
  cursor: -1,
  maxEntries: 100,
};

const pushHeaderDocumentTransaction = (
  label: string,
  before: NewspaperDocument,
  after: NewspaperDocument,
) => {
  if (JSON.stringify(before.headerSystem) === JSON.stringify(after.headerSystem) && JSON.stringify(before.assets) === JSON.stringify(after.assets)) {
    return;
  }

  const retained = headerDocumentHistory.transactions.slice(0, headerDocumentHistory.cursor + 1);

  headerDocumentHistory.transactions = [
    ...retained,
    {
      id: `header-tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      before,
      after,
    },
  ].slice(-headerDocumentHistory.maxEntries);
  headerDocumentHistory.cursor = headerDocumentHistory.transactions.length - 1;
};

const undoHeaderDocumentTransaction = () => {
  if (headerDocumentHistory.cursor < 0) {
    return null;
  }

  const transaction = headerDocumentHistory.transactions[headerDocumentHistory.cursor];
  headerDocumentHistory.cursor -= 1;

  return transaction;
};

const redoHeaderDocumentTransaction = () => {
  const nextCursor = headerDocumentHistory.cursor + 1;

  if (nextCursor >= headerDocumentHistory.transactions.length) {
    return null;
  }

  headerDocumentHistory.cursor = nextCursor;

  return headerDocumentHistory.transactions[nextCursor];
};

const commitHeaderDocumentChange = (
  label: string,
  before: NewspaperDocument,
  after: NewspaperDocument,
) => {
  pushHeaderDocumentTransaction(label, before, after);

  return {
    document: after,
    placementWarning: label,
  };
};

const isDebugSmartLayoutEnabled = () =>
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DEBUG_SMART_LAYOUT === "true" &&
  typeof console !== "undefined" &&
  typeof console.debug === "function";

const logSmartResize = (stage: string, payload: Record<string, unknown> | (() => Record<string, unknown>)) => {
  if (isDebugSmartLayoutEnabled()) {
    console.debug(`[SmartLayout:smart-resize] ${stage}`, typeof payload === "function" ? payload() : payload);
  }
};

const logSmartDelete = (stage: string, payload: Record<string, unknown> | (() => Record<string, unknown>)) => {
  if (isDebugSmartLayoutEnabled()) {
    console.debug(`[SmartLayout:smart-delete] ${stage}`, typeof payload === "function" ? payload() : payload);
  }
};

const CONTENT_BOUNDS = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};

/**
 * Content box a generated page is laid out inside.
 *
 * A front page carries the ~6.1cm masthead band across the top, so its stories
 * have to start below it. Inside pages keep the box they have always used —
 * their thin folio strip fits inside the existing top margin.
 */
/**
 * Air between the foot of the folio strip and the first story on an INSIDE page.
 *
 * The strip's artwork runs to its own edge, so without this the first headline
 * begins on the pixel the band ends — the kicker printed hard against the red.
 *
 * 10pt. Copying the front page's own figure (18.6pt) was wrong: that clearance
 * follows a 172.8pt decorative masthead, where it reads as the foot of the
 * band. The inside strip is only 54pt, so the same gap is a third of the
 * strip's own height again and opens a hole between the folio and the first
 * headline. The gap has to be judged against the band it follows, not copied
 * from a much taller one.
 *
 * Inside pages only — the front page's and the editorial page's figures are
 * left exactly as they were.
 */
const PAGE_HEADER_CLEARANCE_PT = 4;

/**
 * Copy requested for a news box, and the width at which the boost applies.
 *
 * Mirrors the editorial page's own figures, so a box of a given width is asked
 * for the same amount of copy whichever page it sits on.
 */
const NEWS_FILL_WORD_TIER = 1000;
const NEWS_FILL_MIN_COLUMN_SPAN = 2;

const AKHAND_EDITORIAL_5A_TEMPLATE_ID: TemplateId = "AkhandEditorial5A";
const AKHAND_EDITORIAL_5A_BOUNDS = {
  x: 36,
  y: 46,
  width: 864,
  height: 1424,
};
const AKHAND_EDITORIAL_5A_SLOT_STYLES: Record<number, { fill: string; border: string; headline: string }> = {
  1: { fill: "#fff5f2", border: "#cc0010", headline: "#c8102e" },
  2: { fill: "#fff5cd", border: "#4d4dff", headline: "#155f9d" },
  3: { fill: "#f9e7fd", border: "#0000ff", headline: "#111111" },
  4: { fill: "#f3fae9", border: "#ffcc00", headline: "#188038" },
  5: { fill: "#eff9fc", border: "#cc0010", headline: "#111111" },
};

const AKHAND_VICHAR_MANTHAN_6A_TEMPLATE_ID: TemplateId = "AkhandVicharManthan6A";
// Story 1 (मप्र) and 2/5 (the two author-rail pieces) keep the page's plain
// ground -- only the boxes that print with their own tint on the real page
// get an entry here. Story 7 (राशिफल, nested into story 6's foot) is left
// off too: its container is irrelevant once parseRashifalReadings swaps
// its content for the grid.
const AKHAND_VICHAR_MANTHAN_6A_SLOT_STYLES: Record<number, { fill: string; border: string; headline: string }> = {
  3: { fill: "#f6ecd9", border: "#8a1f2b", headline: "#111111" }, // सुनी सुनाई -- cream ground, maroon rule
  4: { fill: "#ffffff", border: "#231f20", headline: "#111111" }, // नमो घाट + बात मुद्दे की, merged -- plain ink border
  6: { fill: "#f7dde1", border: "#d9b7c2", headline: "#111111" }, // आध्यात्मिक ज्ञान -- rose ground, no header bar
};
const AKHAND_EDITORIAL_IMAGE_PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22520%22%20viewBox%3D%220%200%20800%20520%22%3E%3Crect%20width%3D%22800%22%20height%3D%22520%22%20fill%3D%22%23dfddd6%22%2F%3E%3Crect%20x%3D%2220%22%20y%3D%2220%22%20width%3D%22760%22%20height%3D%22480%22%20fill%3D%22none%22%20stroke%3D%22%23b9b5aa%22%20stroke-width%3D%226%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22278%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2256%22%20letter-spacing%3D%228%22%20fill%3D%22%236b665c%22%3EIMAGE%3C%2Ftext%3E%3C%2Fsvg%3E";

const createAkhandEditorialContainerStyle = (fill: string, border: string) => ({
  mode: "frame" as const,
  frameMode: "frame" as const,
  contentHorizontalAlignment: "left" as const,
  contentVerticalAlignment: "top" as const,
  minimumFrameHeight: 0,
  minimumFrameWidth: 0,
  autoFrameHeight: true,
  framePaddingTop: 0,
  framePaddingBottom: 0,
  framePaddingLeft: 0,
  framePaddingRight: 0,
  frameBorderWidth: 0,
  frameBorderColor: "transparent",
  frameBorderStyle: "solid" as const,
  frameBackgroundColor: fill,
  frameRadius: 0,
  frameOpacity: 1,
  containerPaddingTop: 0,
  containerPaddingBottom: 0,
  containerPaddingLeft: 0,
  containerPaddingRight: 0,
  containerBorderRadius: 5,
  containerBorderWidth: 1.5,
  containerBorderColor: border,
  containerBackgroundColor: fill,
  containerOpacity: 1,
});

const getPageKindContentBounds = (pageKind: PageKind | undefined, templateId?: TemplateId) => {
  if (pageKind === "editorial" && templateId === AKHAND_EDITORIAL_5A_TEMPLATE_ID) {
    return AKHAND_EDITORIAL_5A_BOUNDS;
  }

  // Every page starts its stories below whatever band its header occupies: the
  // ~6.1cm masthead on a front page, the ~1.9cm folio strip everywhere else.
  //
  // Only the INSIDE-page figure changes here. It used to return the bare
  // content box on the theory that the thin strip fitted inside the existing
  // top margin. It does not — CONTENT_BOUNDS.y is 27.4pt and the strip is 54pt,
  // so the top row of stories printed into the band carrying the masthead, the
  // URL and the page number: the header "sticking" to the copy below it.
  //
  // The front page and the editorial page keep their existing figures EXACTLY.
  // Both are signed off, and adding clearance to either would move every box on
  // them down the sheet.
  //
  // The optional `templateId` override exists for exactly one case: Youth
  // UPDATE's publisher-exclusive front page (see YouthUpdateConfig.ts), whose
  // real masthead is taller than the standard 6.1cm band. Every other
  // template never passes this argument, so `templateId` is undefined and
  // this whole branch is skipped — the front-page/editorial figures above
  // stay byte-for-byte what they always were for every other publisher.
  const frontHeaderHeight =
    isYouthUpdateFrontTemplateId(templateId) ? YOUTH_UPDATE_MASTHEAD_HEIGHT_PT : FRONT_HEADER_HEIGHT_PT;
  // Same reasoning as the front-page override above, for Youth UPDATE's own
  // inside page: its compact header + 4-box teaser strip together reserve
  // more than the generic folio strip. Every other template never passes
  // this templateId, so this branch is skipped for everyone else.
  const insideHeaderHeight =
    isYouthUpdateHeaderOnlyInsideTemplateId(templateId)
      ? YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_PT
      : isYouthUpdateInsideTemplateId(templateId)
        ? YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_PT
        : INSIDE_HEADER_HEIGHT_PT + PAGE_HEADER_CLEARANCE_PT;
  const y =
    pageKind === "front"
      ? Math.max(CONTENT_BOUNDS.y, frontHeaderHeight)
      : pageKind === "editorial"
        ? Math.max(CONTENT_BOUNDS.y, INSIDE_HEADER_HEIGHT_PT)
        : Math.max(CONTENT_BOUNDS.y, insideHeaderHeight);

  return {
    x: CONTENT_BOUNDS.x,
    y,
    width: CONTENT_BOUNDS.width,
    height: Math.max(0, CONTENT_BOUNDS.y + CONTENT_BOUNDS.height - y),
  };
};

/**
 * How a front page composes its article boxes.
 *
 * A front page runs much shorter boxes than an inside page — a mid-band brief is
 * a ~10% strip of the sheet — and the generic hierarchy sizes headlines from a
 * box's importance without asking how much room the body still needs. Unbudgeted,
 * that gives a 28pt display headline over two lines of copy. These caps are
 * expressed as shares of each box's own height so they hold whatever depth a band
 * ends up with.
 *
 * Carried on `compositionSettings.frontPageStyle`, which is only ever set for
 * front-page generation — inside pages compose exactly as they did before.
 */
const FRONT_PAGE_ARTICLE_STYLE: FrontPageArticleStyle = {
  // A third of the box for the headline block leaves a readable column of copy
  // even in the mid band's short boxes.
  headlineHeightBudget: 0.32,
  // A photo may take at most 40% of the depth, so it never fills the box.
  imageHeightBudget: 0.4,
  // Small but never zero: enough that no line lands on a box edge or tint
  // outline. The foot is tighter than the head: measured on the page, the white
  // under a column is the sum of this padding, the tail of the last line's own
  // slot and whatever the sentence rollback left — about 14pt in total, of
  // which this was the only part safely recoverable.
  padding: { top: 5, right: 8, bottom: 0, left: 8 },
  suppressCaptions: true,
  suppressInlineSubheadingsAtOrBelowColumns: 2,
  alwaysLeaveTextColumnBesideImage: true,
  // Every box shares the page's baseline grid, so body lines in adjacent
  // columns sit on the same rungs the way they do on a printed page.
  alignBodyToPageBaselineGrid: true,
  // 9.3pt on 12pt: the leading is exactly two 6pt rungs, so every column
  // advances by the same whole number of rungs and the page keeps one rhythm.
  bodyType: { fontSizePt: 9.3, lineHeight: 12 / 9.3 },
  // Reclaim most of the headline's trailing leading. The quarter left behind,
  // plus the inter-element gap, keeps a descender clear of the line beneath.
  headlineTrailingLeadingTrim: 0.75,
  // A one-column box gets two lines of a very narrow measure; the subheadline
  // is the one title-length field short enough to land complete in them.
  narrowBoxTitle: {
    useSubheadline: true,
    trailingLeadingTrim: 1,
    // Centres the title so neither row shows a notch. Deliberately does not
    // grow the type — an earlier attempt raised the size ceiling to fill the
    // measure, which made the headline bigger without closing the gap under it.
    fillMeasure: true,
  },
  // One ruled line under the headline, never a two-line black block.
  subheadlineBannerSingleLine: true,
};

/**
 * Inside-page house style.
 *
 * The same rules the front page uses, so a section page reads as part of the
 * same newspaper: capped headline block, one page-wide baseline grid, the same
 * body size and leading, the same box padding, the same trimmed headline
 * leading, a single ruled line under a headline rather than a two-line black
 * block.
 *
 * Left un-capped, an inside headline grew to 49pt against the front page's 30
 * — the generic hierarchy sizes a headline from the box's importance without
 * asking how much room the copy still needs.
 *
 * Two deliberate differences from the front page:
 *  - captions are KEPT. The front page suppresses them because its picture sits
 *    inside the story package and the copy carries the context; a section page
 *    runs stand-alone photographs that need a caption.
 *  - it is carried on `insidePageStyle`, not `frontPageStyle`, so none of the
 *    front page's band-specific geometry switches on. See the note on the type.
 */
const INSIDE_PAGE_ARTICLE_STYLE: FrontPageArticleStyle = {
  ...FRONT_PAGE_ARTICLE_STYLE,
  suppressCaptions: false,
  // Two lines, never three. The front page holds to two because it caps its
  // two-column boxes explicitly; an inside page's boxes are deeper, so without
  // this its headlines ran to a third line while the front page's did not.
  headlineMaxLines: 2,
  // Straight from the headline into the copy. Negative on purpose: the body's
  // start is snapped up to the 6pt baseline grid afterwards, so a positive gap
  // and the snap together opened roughly a blank line under every inside-page
  // headline. Same figure the editorial page uses, for the same reason.
  headlineToBodyGap: -5,
};

/**
 * Editorial-page house style.
 *
 * Traced off page 8 of the printed edition: the comment pages carry no byline
 * and no in-paragraph subheadings. The writer is identified by a portrait and
 * name block beside the text, and a signed comment reads as one continuous
 * argument rather than a report chopped into sections.
 *
 * Carried on `compositionSettings.editorialPageStyle`, which is only ever set
 * for editorial-page generation — news pages compose exactly as before.
 */
const EDITORIAL_PAGE_ARTICLE_STYLE: EditorialPageArticleStyle = {
  ...EDITORIAL_ARTICLE_STYLE,
};

const STORY_SPAN_BOUNDS = {
  pageWidth: PAGE_BOUNDS.width,
  contentX: CONTENT_BOUNDS.x,
  contentY: CONTENT_BOUNDS.y,
  contentWidth: CONTENT_BOUNDS.width,
  contentHeight: CONTENT_BOUNDS.height,
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
};

const initialCompositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  bodyRendererMode: "line",
  headlineScale: 0.8,
  baselineGridSize: 6,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
};

const markStoryDirty = (
  story: StoryFrame,
  dirtyFlags: Partial<StoryDirtyFlags>,
): StoryFrame => ({
  ...story,
  dirtyFlags: mergeDirtyFlags(story.dirtyFlags, dirtyFlags),
});

const valuesEqual = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);

const isRichTextLike = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { spans?: unknown }).spans);

const PAINT_ONLY_CONTAINER_KEYS = new Set([
  "containerBackgroundColor",
  "containerBorderColor",
  "containerOpacity",
  "frameBackgroundColor",
  "frameBorderColor",
  "frameOpacity",
  "framePaddingTop",
  "framePaddingBottom",
  "framePaddingLeft",
  "framePaddingRight",
  "frameBorderWidth",
  "frameBorderStyle",
  "frameRadius",
  "containerPaddingTop",
  "containerPaddingBottom",
  "containerPaddingLeft",
  "containerPaddingRight",
  "containerBorderWidth",
  "containerBorderRadius",
  "contentHorizontalAlignment",
  "contentVerticalAlignment",
  "minimumFrameHeight",
  "minimumFrameWidth",
  "autoFrameHeight",
]);

const stripRichTextPaint = (value: unknown): unknown => {
  if (typeof value === "string") {
    return {
      spans: [{ text: value }],
    };
  }

  if (isRichTextLike(value)) {
    return {
      spans: normalizeRichText(value).spans.map((span) => ({
        text: span.text,
        bold: span.bold,
        italic: span.italic,
        fontSize: span.fontSize,
        fontWeight: span.fontWeight,
      })),
    };
  }

  if (Array.isArray(value)) {
    return value.map(stripRichTextPaint);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        PAINT_ONLY_CONTAINER_KEYS.has(key) ? undefined : stripRichTextPaint(child),
      ]),
    );
  }

  return value;
};

const isPaintOnlyArticleDataChange = (previous: unknown, next: unknown) =>
  valuesEqual(stripRichTextPaint(previous), stripRichTextPaint(next));

const getArticleDataDirtyFlags = (key: keyof ArticleData): Partial<StoryDirtyFlags> => {
  if (key === "typography" || key === "editorialPreset") {
    return {
      styleDirty: true,
      typographyDirty: true,
      compositionDirty: true,
      renderDirty: true,
    };
  }

  return {
    textDirty: true,
    typographyDirty: true,
    compositionDirty: true,
    renderDirty: true,
  };
};

const getArticleDataChangeDirtyFlags = (
  key: keyof ArticleData,
  previous: ArticleData[keyof ArticleData],
  next: ArticleData[keyof ArticleData],
): Partial<StoryDirtyFlags> => {
  if (key !== "typography" && key !== "editorialPreset" && isPaintOnlyArticleDataChange(previous, next)) {
    return {
      styleDirty: true,
      renderDirty: true,
    };
  }

  return getArticleDataDirtyFlags(key);
};

const getCompositionDirtyFlags = (
  key: keyof ArticleCompositionSettings,
): Partial<StoryDirtyFlags> => {
  if (
    key === "showRegionDebug" ||
    key === "productionView" ||
    key === "opticalTypography" ||
    key === "bodyRendererMode"
  ) {
    return {
      renderDirty: true,
    };
  }

  return {
    typographyDirty: true,
    compositionDirty: true,
    renderDirty: true,
  };
};

const defaultImageCropSettings = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
  opacity: 0.45,
};

const defaultImageSettings: StoryImageSettings = {
  imageEnabled: true,
  imageAlignment: "top-right",
  imageColumnSpan: 2,
  imageHeight: 144,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  imageShapeType: "rectangle",
  imageShapePoints: [],
  imageCrop: defaultImageCropSettings,
  wrapContourPoints: [],
  wrapTextOffset: 1,
};

const getDefaultImageSettingsForPriority = (priority: StoryFrame["priority"]): StoryImageSettings => {
  if (priority === "lead") {
    return {
      imageEnabled: true,
      imageAlignment: "top-right",
      imageColumnSpan: 3,
      imageHeight: 180,
      imageHeightMode: "auto",
      imageHeightPreset: "medium",
      imageHeightProtection: true,
      autoSizeImage: true,
      imageWrapMode: "newspaper",
      imageShapeType: "rectangle",
      imageShapePoints: [],
      imageCrop: { ...defaultImageCropSettings },
      wrapContourPoints: [],
      wrapTextOffset: 1,
    };
  }

  if (priority === "major") {
    return {
      imageEnabled: true,
      imageAlignment: "top-right",
      imageColumnSpan: 2,
      imageHeight: 132,
      imageHeightMode: "auto",
      imageHeightPreset: "small",
      imageHeightProtection: true,
      autoSizeImage: true,
      imageWrapMode: "newspaper",
      imageShapeType: "rectangle",
      imageShapePoints: [],
      imageCrop: { ...defaultImageCropSettings },
      wrapContourPoints: [],
      wrapTextOffset: 1,
    };
  }

  if (priority === "secondary") {
    return {
      imageEnabled: true,
      imageAlignment: "top-left",
      imageColumnSpan: 1,
      imageHeight: 72,
      imageHeightMode: "auto",
      imageHeightPreset: "tiny",
      imageHeightProtection: true,
      autoSizeImage: true,
      imageWrapMode: "rectangular",
      imageShapeType: "rectangle",
      imageShapePoints: [],
      imageCrop: { ...defaultImageCropSettings },
      wrapContourPoints: [],
      wrapTextOffset: 1,
    };
  }

  if (priority === "brief" || priority === "filler") {
    return {
      imageEnabled: false,
      imageAlignment: "top-left",
      imageColumnSpan: 1,
      imageHeight: 80,
      imageHeightMode: "auto",
      imageHeightPreset: "tiny",
      imageHeightProtection: true,
      autoSizeImage: true,
      imageWrapMode: "none",
      imageShapeType: "rectangle",
      imageShapePoints: [],
      imageCrop: { ...defaultImageCropSettings },
      wrapContourPoints: [],
      wrapTextOffset: 1,
    };
  }

  return defaultImageSettings;
};

const typographyFontSizeToLineHeightKey = {
  headlineFontSize: "headlineLineHeight",
  subheadlineFontSize: "subheadlineLineHeight",
  bodyFontSize: "bodyLineHeight",
} as const;

const typographyLineHeightToModeKey = {
  headlineLineHeight: "headlineLineHeightMode",
  subheadlineLineHeight: "subheadlineLineHeightMode",
  bodyLineHeight: "bodyLineHeightMode",
} as const;

const typographyFontSizeToLeadingValueKey = {
  headlineFontSize: "headlineLeadingValue",
  subheadlineFontSize: "subheadlineLeadingValue",
  bodyFontSize: "bodyLeadingValue",
} as const;

const typographyModeToLineHeightKey = {
  headlineLineHeightMode: "headlineLineHeight",
  subheadlineLineHeightMode: "subheadlineLineHeight",
  bodyLineHeightMode: "bodyLineHeight",
} as const;

const typographyModeToFontSizeKey = {
  headlineLineHeightMode: "headlineFontSize",
  subheadlineLineHeightMode: "subheadlineFontSize",
  bodyLineHeightMode: "bodyFontSize",
} as const;

const typographyModeToLeadingValueKey = {
  headlineLineHeightMode: "headlineLeadingValue",
  subheadlineLineHeightMode: "subheadlineLeadingValue",
  bodyLineHeightMode: "bodyLeadingValue",
} as const;

const typographyLeadingValueToModeKey = {
  headlineLeadingValue: "headlineLineHeightMode",
  subheadlineLeadingValue: "subheadlineLineHeightMode",
  bodyLeadingValue: "bodyLineHeightMode",
} as const;

const typographyLeadingValueToFontSizeKey = {
  headlineLeadingValue: "headlineFontSize",
  subheadlineLeadingValue: "subheadlineFontSize",
  bodyLeadingValue: "bodyFontSize",
} as const;

const typographyLeadingValueToLineHeightKey = {
  headlineLeadingValue: "headlineLineHeight",
  subheadlineLeadingValue: "subheadlineLineHeight",
  bodyLeadingValue: "bodyLineHeight",
} as const;

const resolveLeadingMultiplier = ({
  fontSize,
  mode,
  value,
}: {
  fontSize: number;
  mode: StoryTypographySettings["headlineLineHeightMode"];
  value: number;
}) => {
  const safeFontSize = Math.max(1, fontSize);
  const loadedMode = mode as string | undefined;
  const safeMode = loadedMode === "manual" ? "exactly" : mode ?? "auto";

  if (safeMode === "auto") {
    return 1;
  }

  if (safeMode === "percentage") {
    return Math.max(0.5, value / 100);
  }

  if (safeMode === "at-least") {
    return Math.max(safeFontSize, value) / safeFontSize;
  }

  return Math.max(1, value) / safeFontSize;
};

const cloneArticleData = (articleData: ArticleData): ArticleData => {
  const body = cloneRichText(articleData.body);

  return {
    ...articleData,
    kicker: {
      ...articleData.kicker,
      style: {
        ...articleData.kicker.style,
      },
      text: cloneRichText(articleData.kicker.text),
    },
    strap: {
      ...articleData.strap,
      style: {
        ...articleData.strap.style,
      },
      text: cloneRichText(articleData.strap.text),
    },
    headline: cloneRichText(articleData.headline),
    subheadline: cloneRichText(articleData.subheadline),
    subheadlineBanner: {
      ...articleData.subheadlineBanner,
    },
    summaryBullets: articleData.summaryBullets ? [...articleData.summaryBullets] : undefined,
    inlineSubheadingEnabled: articleData.inlineSubheadingEnabled,
    inlineSubheadingColor: articleData.inlineSubheadingColor,
    caption: {
      ...articleData.caption,
      text: cloneRichText(articleData.caption.text),
      creditText: cloneRichText(articleData.caption.creditText),
      captionStyle: {
        ...articleData.caption.captionStyle,
      },
      creditStyle: {
        ...articleData.caption.creditStyle,
      },
      labelStyle: {
        ...articleData.caption.labelStyle,
      },
      labels: {
        ...articleData.caption.labels,
      },
    },
    body,
    bodyParagraphs: normalizeParagraphTypography({
      content: body,
      existing: articleData.bodyParagraphs,
    }),
    factBox: {
      ...articleData.factBox,
      headline: cloneRichText(articleData.factBox.headline),
      bullets: articleData.factBox.bullets.map(cloneRichText),
    },
    factBoxTheme: {
      ...articleData.factBoxTheme,
    },
    pullQuote: {
      ...articleData.pullQuote,
      text: cloneRichText(articleData.pullQuote.text),
    },
    pullQuoteTheme: {
      ...articleData.pullQuoteTheme,
    },
    typography: {
      ...articleData.typography,
    },
    containerStyles: normalizeContainerStyles(articleData.containerStyles),
  };
};

export const cleanSubheadlineText = (text?: string) => {
  if (!text) return "";
  const cleaned = text.replace(/\bSubheadings?\s*[:-]\s*/gi, "").trim();
  if (cleaned === "• ... •" || cleaned === "• • •" || cleaned === "•" || /^[\s•.*_-]+$/u.test(cleaned)) {
    return "";
  }
  return cleaned;
};

const extractNewswireDatelinePlace = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const text = cleanNewswireText(value);
    const match = /^([^:：।.]{2,48})\s*[:：]/u.exec(text);
    if (!match) {
      continue;
    }

    const place = cleanNewswireText(match[1])
      .replace(/^[-–—\s]+|[-–—\s]+$/gu, "")
      .trim();
    if (place && !/[!?؟]/u.test(place)) {
      return place;
    }
  }

  return "";
};

const resolveNewswireBylineName = (value: string, language: ArticleLanguage) => {
  const cleaned = value.replace(/\s+/gu, " ").trim();

  if (language === "hindi") {
    return cleaned && /[\u0900-\u097F]/u.test(cleaned) ? cleaned : "सिटी रिपोर्टर";
  }

  return cleaned || "Agency";
};

const determineInternalTextColumnCount = (widthPt: number, defaultSpan: number, templateId?: string, isCustomLayout?: boolean): number => {
  // Enforce locked-in rule: Automatic Internal Text Column Determination based on physical width
  // Applies to both specific templates and custom generated layouts (like Advertisement Page)
  if (templateId === "ProfessionalNews10A" || isCustomLayout || !templateId) {
    return computePhysicalTextColumns(widthPt, defaultSpan);
  }
  return Math.min(Math.max(defaultSpan, 1), 6);
};

// Deterministic string hash used to pick per-story visual variants (e.g. caption
// placement) so a given document regenerates the same layout every time.
const hashStringToInt = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/**
 * Groups a long, unbroken block of body copy into paragraphs (every 3
 * sentences) by inserting real "\n\n" breaks -- composeArticleBox.ts's own
 * splitBodyParagraphs/isParagraphLastLine logic already exists and already
 * exempts a paragraph's last line from full justification, it just never
 * gets to do that today because live newswire body text arrives as one
 * giant single-paragraph string. This doesn't change that (or any other)
 * composer rule -- it only gives the unmodified rule real paragraph breaks
 * to work with, which is what was actually stretching word-spacing so
 * visibly across a long, entirely-justified block.
 *
 * English only (see contentLanguage's own reasoning elsewhere): the
 * Devanagari body-copy metrics this was tuned against don't show the same
 * excessive word-gap issue, so Hindi/default content is intentionally left
 * exactly as it already renders. A plain sentence split, not meant to
 * handle every abbreviation edge case.
 */
const SENTENCES_PER_PARAGRAPH = 3;
const paragraphizeEnglishBody = (text: string): string => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= SENTENCES_PER_PARAGRAPH) {
    return text;
  }

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" "));
  }
  return paragraphs.join("\n\n");
};

const createArticleDataFromNewswireStory = (
  story: StoryFrame,
  item: NewswireStory,
  language: ArticleLanguage,
  bylineName: string,
  subheadingStyle: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    backgroundOpacity: number;
  },
  capacity?: number,
  inlineSubheadings?: boolean,
  inlineSubheadingColor?: string,
): ArticleData => {
  const baseCapacity = capacity ?? estimateStoryWordCapacity(story);
  const targetTier = selectOptimisticNewswireWordTier(baseCapacity);
  const localized = getLocalizedArticleContent(item, language, targetTier);

  if (!localized) {
    throw new Error(`Not enough ${language === "english" ? "English" : "Hindi"} articles are available to generate this page.`);
  }

  const headlineText = localized.headline || "Untitled";
  const cleanedSubheadline = ensureEndsWithFullStop(cleanSubheadlineText(localized.subheadline));
  // The newswire's subheadings endpoint returns three per story, shortest last.
  // A one-column box titles itself with the third — it is the only one of the
  // title-length fields that lands complete in two lines of so narrow a
  // measure. Falls back to the subheadline for any story that ships fewer than
  // three (older records carry only two summary lines).
  const thirdSubheading = ensureEndsWithFullStop(
    cleanSubheadlineText(localized.subheadings[2] ?? ""),
  );
  const fullText = localized.body || localized.longBody || localized.mediumBody || localized.shortBody || "";
  // Use 1.5x buffer so we always supply more text than the frame needs.
  // The layout engine stops naturally at the frame's printable bottom edge.
  const targetCapacity = Math.round(baseCapacity * 1.5);
  const wordCount = fullText.trim().split(/\s+/u).filter(Boolean).length;

  // Always supply full text body to allow composeArticleBox to fill to the printable bottom edge.
  let rawBodyText = fullText;

  // Fallback: If the selected text falls short of the target capacity, 
  // default to the absolute longest text available (longBody or body) to prevent blank space.
  if (wordCount < targetCapacity) {
    const fallbackText = localized.longBody || localized.body || item.longBody || item.body || fullText;
    if (fallbackText.length > rawBodyText.length) {
      rawBodyText = fallbackText;
    }
  }

  let sanitizedBodyText = normalizeArticleBodyText(rawBodyText, headlineText, cleanedSubheadline);
  // Narrow (1-2 column) boxes stay exactly as they already render -- there's
  // no room for a paragraph break to read as anything but a ragged, mostly
  // -empty line in so narrow a measure.
  if (language === "english" && story.columnSpan >= 3) {
    sanitizedBodyText = paragraphizeEnglishBody(sanitizedBodyText);
  }
  // A small image (<= 1 internal image-column) tucked at the start of a
  // narrow (2-3 col) box has no real room for a caption to sit underneath
  // or beside it without looking cramped — always skip the caption for this
  // shape rather than let it squeeze in.
  const isSmallStartImageInNarrowBox = story.columnSpan <= 3 && story.imageColumnSpan <= 1;
  const caption = {
    ...createDefaultCaptionData(localized.imageCaption || localized.caption),
    enabled: !isSmallStartImageInNarrowBox,
  };
  const cleanBody: RichTextDocument = normalizeRichText(sanitizedBodyText);
  // The upstream feed leaves `place` empty on most records, and the local city
  // desk used to be applied as a blanket fallback — which datelined foreign and
  // national wire copy "भोपाल / सिटी रिपोर्टर", something no real paper prints
  // (a Bhutan or WHO story credited to the Bhopal city desk). Only stories in a
  // genuinely local category may inherit the local desk; everything else falls
  // back to an agency credit with no city dateline, which is how wire copy is
  // actually attributed.
  const isLocalDeskCategory =
    String(item.category) === "Madhya Pradesh" || String(item.category) === "National";
  const suppliedPlace = (localized.place || item.place || "").trim();
  const datelinePlace = extractNewswireDatelinePlace(
    localized.kicker,
    item.kicker,
    localized.body,
    item.body,
  );
  const localDeskPlace = language === "hindi" ? "भोपाल" : "Bhopal";
  const bylinePlace = suppliedPlace || datelinePlace || (isLocalDeskCategory ? localDeskPlace : "");
  // An explicit byline typed into the wizard always wins — the agency default
  // only stands in where the desk is genuinely unknown.
  const hasExplicitByline = bylineName.replace(/\s+/gu, " ").trim().length > 0;
  const agencyByline = language === "hindi" ? "एजेंसी" : "Agency";
  const resolvedBylineName =
    hasExplicitByline || suppliedPlace || datelinePlace || isLocalDeskCategory
      ? resolveNewswireBylineName(bylineName, language)
      : agencyByline;

  // ── Priority-based suppression (Phase 1.6) ─────────────────────────────────
  // News is separated by importance: lead / major carry full chrome (byline,
  // subheadline banner, inline subheadings, image). Secondary carries chrome
  // only when the box is wide enough. Brief and filler strip chrome so small
  // side stories don't compete visually with the main story.
  //
  //   • filler → suppress everything (byline, subheadline banner, inline subs)
  //   • brief  → suppress byline + inline subheadings unconditionally;
  //              suppress subheadline banner unless the box is ≥ 2 columns
  //   • secondary → allow subheadline only when ≥ 2 columns wide
  //   • major / lead → allow everything (subject to genuine layout safeguards
  //                    below, which stay as a fallback catch)
  const isNarrowSpan = story.columnSpan < 2;
  const priorityBasedSuppressSubheadline =
    story.priority === "filler" ||
    (story.priority === "brief" && isNarrowSpan) ||
    (story.priority === "secondary" && isNarrowSpan);
  const priorityBasedSuppressInlineSubheadings =
    story.priority === "filler" || story.priority === "brief";

  // Height/width fallbacks catch genuinely broken layouts (e.g. a "major"
  // slot the template rendered too small) — kept as a safety net, but
  // priority is now the primary decision.
  const isCompactHeight = story.height < 200;
  const isTinyHeight   = story.height < 170;
  const isNarrowWidth  = story.width  < 130;
  // Editorial-page house rules, when this story is being composed for one.
  // Absent on news pages, so nothing below changes there.
  const editorialPageStyle = story.compositionSettings?.editorialPageStyle;
  // Byline is mandatory on every article regardless of size/priority — except
  // on an editorial page, where the author block carries the name instead and
  // a byline as well would print it twice.
  const suppressByline = Boolean(editorialPageStyle?.suppressByline);
  // The house rules this story is composed under — the front page's, or an
  // inside page's, which carries the same shape through its own field so the
  // front page's band geometry stays off. Absent on the editorial page, which
  // has a house style of its own, so nothing below changes there.
  const frontPageStyle =
    story.compositionSettings?.frontPageStyle ?? story.compositionSettings?.insidePageStyle;
  // A one-column front-page box titles itself with its subheadline rather than
  // its headline (see `FrontPageArticleStyle.narrowBoxTitle`), so the text has
  // to survive this suppression — blanking it here left the composer nothing to
  // promote and the box fell back to a word-truncated headline. Suppression is
  // about not printing a *subheadline block*, which the composer still decides
  // separately: once the text is promoted to the title it is cleared there, so
  // it can never print twice.
  const keepSubheadlineAsNarrowTitle =
    isNarrowSpan && Boolean(frontPageStyle?.narrowBoxTitle.useSubheadline);
  const suppressSubheadline =
    // The editorial page has no subheadline banner at all — page 8 goes from
    // headline straight into the copy, with no reversed bar anywhere on it.
    Boolean(editorialPageStyle?.suppressSubheadline) ||
    (!keepSubheadlineAsNarrowTitle &&
      (priorityBasedSuppressSubheadline || isTinyHeight || isNarrowWidth));
  const internalTextColumns = story.articleData?.columnCount ?? 1;
  // In-paragraph subheadings read as noise in a narrow measure, so a front page
  // drops them from any box of 2 internal columns or fewer.
  const frontPageSuppressInlineSubheadings = Boolean(
    frontPageStyle &&
      internalTextColumns <= frontPageStyle.suppressInlineSubheadingsAtOrBelowColumns,
  );
  // In-paragraph sub-headings are noise on small article boxes — skip them
  // there in addition to the existing filler/brief priority suppression.
  const suppressInlineSubheadings =
    priorityBasedSuppressInlineSubheadings ||
    isCompactHeight ||
    isNarrowWidth ||
    frontPageSuppressInlineSubheadings ||
    // A signed comment runs as one continuous argument on an editorial page,
    // never chopped into sections.
    Boolean(editorialPageStyle?.suppressInlineSubheadings);

  // ── Per-story chrome from newswire item ─────────────────────────────────
  // Kicker + strap + pull-quote + fact-box are only enabled when the source
  // item explicitly carries them (real API upstream data can). Earlier auto-
  // backfill of these on every fallback story caused visible overlap with
  // body text and repetitive "खेल"/"भास्कर स्पोर्ट्स" ribbons users don't want.
  //
  // Kicker (secondary heading above the headline) word count is trimmed to
  // the story's *actual rendered width* in composeArticleBox — not here,
  // since story.columnSpan at generation time isn't guaranteed to match the
  // box's final on-page width. Kicker is mandated on ~70% of articles (the
  // fraction of the newswire pool that carries kicker text), so it only gets
  // a much smaller, kicker-specific height floor than the 200pt used for
  // byline/subheadline crowding — a single label line needs far less room.
  const isTooShortForKicker = story.height < 90;
  // localized.kicker (resolved above for the page's actual language) is the
  // source of truth — item.kicker is only ever the "legacy" Hindi-first
  // value normalizeDeliveryRecord picks as a top-level default, so reading
  // it directly here showed Hindi kicker text under an English headline.
  const resolvedKickerText = localized.kicker || item.kicker || "";
  const wantsKicker = !isTooShortForKicker && Boolean(resolvedKickerText);
  const wantsStrap = !isCompactHeight && Boolean(item.strap);
  const kickerText = resolvedKickerText;
  const strapText = item.strap ?? "";
  const wantsFactBox = !isCompactHeight && Boolean(item.factBoxRows && item.factBoxRows.length > 0);
  const wantsPullQuote = !isCompactHeight && !isNarrowWidth && Boolean(item.pullQuoteText);

  // Caption placement: always a light inset panel across the bottom of the
  // photo, for a consistent look everywhere. A narrow image has no room for
  // that panel without crowding it, so those stories skip the caption
  // entirely rather than falling back to a different placement.
  const autoCaptionPosition: CaptionPosition = "overlay-bottom";

  return {
    ...cloneArticleData(story.articleData),
    kicker: {
      ...story.articleData.kicker,
      enabled: wantsKicker,
      text: wantsKicker ? normalizeRichText(kickerText) : story.articleData.kicker.text,
    },
    strap: {
      ...story.articleData.strap,
      enabled: wantsStrap,
      text: wantsStrap ? normalizeRichText(strapText) : story.articleData.strap.text,
    },
    headline: localized.headline || "Untitled",
    // Compact box: clear subheadline text and disable subheadline banner + inline sub-heads.
    subheadline: suppressSubheadline
      ? ""
      : keepSubheadlineAsNarrowTitle && thirdSubheading
        ? thirdSubheading
        : cleanedSubheadline,
    subheadlineBanner: suppressSubheadline
      ? { mode: "none" as const, backgroundColor: subheadingStyle.backgroundColor, textColor: subheadingStyle.textColor, borderColor: subheadingStyle.borderColor, backgroundOpacity: 0, borderWidth: 0, borderRadius: 0, padding: 0 }
      : {
          mode: "rounded",
          backgroundColor: subheadingStyle.backgroundColor,
          textColor: subheadingStyle.textColor,
          borderColor: subheadingStyle.borderColor,
          backgroundOpacity: subheadingStyle.backgroundOpacity,
          borderWidth: 0.8,
          borderRadius: 3,
          padding: 5,
        },
    summaryBullets: suppressSubheadline
      ? []
      : (item.summary && item.summary.length > 0 ? item.summary : [cleanedSubheadline]).filter(Boolean).slice(0, 2),
    inlineSubheadingEnabled: (suppressSubheadline || suppressInlineSubheadings)
      ? false
      : (inlineSubheadings ?? true),
    inlineSubheadingColor: item.inlineSubheadingColor ?? inlineSubheadingColor ?? "#18181b",
    badgeKickerEnabled: item.badgeKickerEnabled ?? story.articleData.badgeKickerEnabled,
    // Compact box: blank out author and location so byline row is not rendered.
    author: suppressByline ? "" : resolvedBylineName,
    // Author-block fields, carried whether or not the byline prints: on an
    // editorial page the byline is suppressed and the portrait rail identifies
    // the writer instead, so the name has to survive that suppression.
    editorName: resolvedBylineName,
    editorPortraitUrl: item?.editorPortraitUrl ?? "",
    editorSummary: item?.editorSummary ?? "",
    letterAuthor: item?.letterAuthor ?? "",
    letterLocation: item?.letterLocation ?? "",
    letterEmail: item?.letterEmail ?? "",
    letterPhone: item?.letterPhone ?? "",
    kickerLabelColor: item?.kickerLabelColor ?? story.articleData.kickerLabelColor,
    agency: "",
    location: suppressByline ? "" : bylinePlace,
    typography: {
      ...story.articleData.typography,
      subheadlineAlignment: "center",
    },
    caption: {
      ...caption,
      // Front pages carry no photo captions — the picture sits inside the story
      // package and the copy carries the context.
      enabled: frontPageStyle?.suppressCaptions || isNarrowWidth
        ? false
        : Boolean(localized.imageCaption || localized.caption),
      position: autoCaptionPosition,
      // Populate photo credit from the newswire item so every photo caption has attribution.
      creditText: item.photoCredit ? normalizeRichText(item.photoCredit) : caption.creditText,
      source: item.photoCredit ?? "",
      showSource: false,
      showCredit: Boolean(item.photoCredit),
    },
    factBox: wantsFactBox
      ? {
          headline: normalizeRichText(item.factBoxHeading ?? ""),
          // Render each fact-box row as a bullet in "label — value" format,
          // matching the label:value strip pattern in DB/TOI fact boxes.
          bullets: (item.factBoxRows ?? []).map((row) =>
            normalizeRichText(`${row.label} — ${row.value}`),
          ),
        }
      : { headline: "", bullets: [] },
    pullQuote: wantsPullQuote
      ? {
          text: normalizeRichText(
            item.pullQuoteAttribution
              ? `${item.pullQuoteText} — ${item.pullQuoteAttribution}`
              : (item.pullQuoteText ?? ""),
          ),
        }
      : { text: cloneRichText(story.articleData.pullQuote.text) },
    body: cleanBody,
    bodyParagraphs: normalizeParagraphTypography({
      content: cleanBody,
      existing: story.articleData.bodyParagraphs,
    }),
  };
};

const NEWSWIRE_BODY_TIERS = [250, 500, 1000] as const;
// LOCKED RULE (see selectOptimisticNewswireWordTier above): no empty white space should
// ever be left blank at the bottom of a story. These were previously 2 lines / 18% — loose
// enough that the loop below would return as soon as a smaller word tier (e.g. 500) cleared
// the bar, without ever trying the next tier (1000) even though it usually has real API text
// left over and would have closed the gap further. Tightened to near-zero tolerance so the
// loop keeps requesting more real content up through the largest tier before settling,
// consistent with the locked rule instead of contradicting it.
const MAX_ACCEPTABLE_EMPTY_BODY_LINES = 0;
const MAX_ACCEPTABLE_BODY_WHITESPACE_PERCENT = 2;

const applyNewswireImportTypography = (
  articleData: ArticleData,
  language: ArticleLanguage,
  options: NewswireImportOptions | undefined,
  /**
   * Set by a story that must not be justified.
   *
   * Justification stretches inter-word gaps to reach the right edge. In a wide
   * measure that is invisible; in a narrow one — a horoscope column, three
   * columns wide with long Hindi compounds and two or three words to a line —
   * one or two gaps absorb all the slack and the type visibly pulls apart. A
   * printed horoscope is set ragged right for exactly this reason.
   *
   * Deliberately an explicit opt-in from the story rather than a fall-through to
   * `articleData.typography.bodyAlignment`: that field is normalised with a
   * default for every story, so reading it here would stop being an override and
   * start inheriting, silently changing alignment across every page.
   */
  raggedRight = false,
): ArticleData => ({
  ...articleData,
  typography: {
    ...articleData.typography,
    headlineAlignment: options?.headlineAlignment ?? articleData.typography.headlineAlignment,
    bodyAlignment: raggedRight ? "left" : (options?.bodyAlignment ?? "justify"),
    bodyJustifyMode: language === "english"
      ? "justify-all-lines" as const
      : articleData.typography.bodyJustifyMode,
    justifyMode: language === "english"
      ? "justify-all-lines" as const
      : articleData.typography.justifyMode,
    bodyJustifyEngineMode: language === "english" && options?.professionalJustification
      ? "newspaper" as const
      : articleData.typography.bodyJustifyEngineMode,
    hjWordSpacingMax: language === "english" ? 175 : articleData.typography.hjWordSpacingMax,
    hjOptimizationLevel: language === "english" ? "quality" as const : articleData.typography.hjOptimizationLevel,
  },
});

const applyYouthUpdateEnglishBodyTypography = (articleData: ArticleData): ArticleData => ({
  ...articleData,
  typography: {
    ...articleData.typography,
    bodyAlignment: "justify",
    // Every line justified except the one that ends a paragraph, which is the
    // way a printed column is set -- "justify-all-lines" stretches that last
    // short line across the full measure too, which reads as a row of
    // scattered words. The composer's own per-line `justify` flag is what
    // both renderers now key off (see composeArticleBox's body line map), so
    // this is the single place the rule is stated.
    bodyJustifyMode: "justify-except-last",
    justifyMode: "justify-except-last",
    bodyJustifyEngineMode: "browser",
    hjWordSpacingMax: 175,
    hjOptimizationLevel: "quality",
    bodyTracking: -18,
    bodyLetterSpacing: -0.04,
  },
});

/**
 * Whether a story sets ragged right rather than justified.
 *
 * Only what the story itself asks for. The editorial leader used to be forced
 * ragged here: its copy wraps around a passport portrait, and the composer
 * wrapped every line to the narrowest region's width while justifying it to the
 * region it landed in — so the copy below the picture, broken to a third of the
 * measure and stretched to the whole of it, pulled apart into scattered words.
 * The composer now re-wraps per region on this page, so each line is broken to
 * the measure it is actually set in and justification is sound again.
 */
const usesRaggedRightBody = (_story: StoryFrame, item: NewswireStory) =>
  Boolean(item.raggedRight);

const chooseLayoutFittedNewswireArticleData = ({
  baseStory,
  item,
  language,
  bylineName,
  subheadingStyle,
  initialCapacity,
  finalSubheadlineBanner,
  finalContainerStyles,
  finalHeadlineColor,
  options,
  typographyTransform,
}: {
  baseStory: StoryFrame;
  item: NewswireStory;
  language: ArticleLanguage;
  bylineName: string;
  subheadingStyle: NewswireImportOptions["subheadingStyle"];
  initialCapacity: number;
  finalSubheadlineBanner: ArticleData["subheadlineBanner"];
  finalContainerStyles: ArticleData["containerStyles"];
  finalHeadlineColor?: string;
  options?: NewswireImportOptions;
  typographyTransform?: (articleData: ArticleData) => ArticleData;
}) => {
  const optimisticTier = selectOptimisticNewswireWordTier(initialCapacity);
  const requestedTiers = Array.from(
    new Set([
      ...NEWSWIRE_BODY_TIERS.filter((tier) => tier >= optimisticTier),
      NEWSWIRE_BODY_TIERS[NEWSWIRE_BODY_TIERS.length - 1],
    ]),
  );

  let bestCandidate: {
    articleData: ArticleData;
    emptyLines: number;
    fillPercent: number;
    hiddenLines: number;
    whitespacePercent: number;
  } | null = null;
  const transformTypography = (articleData: ArticleData) =>
    typographyTransform ? typographyTransform(articleData) : articleData;

  for (const requestedWords of requestedTiers) {
    const candidateData = transformTypography(
      applyNewswireImportTypography(
        {
          ...createArticleDataFromNewswireStory(
            baseStory,
            item,
            language,
            bylineName,
            subheadingStyle,
            requestedWords,
            options?.inlineColumnSubheadings,
            options?.inlineSubheadingColor,
          ),
          headlineColor: finalHeadlineColor,
          subheadlineBanner: finalSubheadlineBanner,
          containerStyles: finalContainerStyles,
        },
        language,
        options,
        usesRaggedRightBody(baseStory, item),
      ),
    );

    const candidateStory: StoryFrame = {
      ...baseStory,
      articleData: candidateData,
      contentLanguage: language,
    };
    const candidateLayout = composeArticleBox(candidateStory, candidateData, baseStory.compositionSettings);
    const emptyLines = Math.max(0, candidateLayout.metrics.hiddenLines === 0 ? candidateLayout.body.remainingLineCount : 0);
    const hiddenLines = Math.max(0, candidateLayout.metrics.hiddenLines);
    const fillPercent = candidateLayout.metrics.bodyFillPercent;
    const whitespacePercent = candidateLayout.metrics.bodyWhitespacePercent;
    const candidate = { articleData: candidateData, emptyLines, fillPercent, hiddenLines, whitespacePercent };

    if (emptyLines <= MAX_ACCEPTABLE_EMPTY_BODY_LINES && whitespacePercent <= MAX_ACCEPTABLE_BODY_WHITESPACE_PERCENT) {
      return candidateData;
    }

    if (
      !bestCandidate ||
      whitespacePercent < bestCandidate.whitespacePercent ||
      (whitespacePercent === bestCandidate.whitespacePercent && hiddenLines < bestCandidate.hiddenLines) ||
      (hiddenLines === bestCandidate.hiddenLines && whitespacePercent === bestCandidate.whitespacePercent && fillPercent > bestCandidate.fillPercent) ||
      (
        whitespacePercent === bestCandidate.whitespacePercent &&
        hiddenLines === bestCandidate.hiddenLines &&
        fillPercent === bestCandidate.fillPercent &&
        emptyLines < bestCandidate.emptyLines
      )
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate?.articleData ?? transformTypography(
    applyNewswireImportTypography(
      createArticleDataFromNewswireStory(baseStory, item, language, bylineName, subheadingStyle, initialCapacity, options?.inlineColumnSubheadings, options?.inlineSubheadingColor),
      language,
      options,
      usesRaggedRightBody(baseStory, item),
    ),
  );
};

type NewswireImportOptions = {
  templateId?: TemplateId;
  /**
   * Which kind of page the wizard is generating. "front" reserves the masthead
   * band and marks the page as the front page so the canvas draws the masthead
   * instead of the folio strip. Defaults to "inside".
   */
  pageKind?: PageKind;
  languageMode?: PageLanguageMode;
  bylineName?: string;
  editorialAuthorDefaults?: {
    name: string;
    imageUrl: string;
  } | null;
  editorialAuthorSelections?: Array<{
    name: string;
    imageUrl: string;
  } | null>;
  colouredHeadings?: boolean;
  tintedStoryBackground?: boolean;
  tintColor?: string;
  inlineColumnSubheadings?: boolean;
  inlineSubheadingColor?: string;
  palettePreset?: NewswireSubheadingPreset;
  subheadingStyle: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    backgroundOpacity: number;
  };
  headlineAlignment?: ArticleData["typography"]["headlineAlignment"];
  bodyAlignment?: ArticleData["typography"]["bodyAlignment"];
  professionalJustification?: boolean;
  customLayout?: { slots: any[] };
  customStories?: StoryFrame[];
  /** One or more advertisements to embed within this page (front/inside/editorial), shelf-packed from the bottom-right corner, with real stories filling the rest — see PageAdvertisementPlacement. Ignored when customLayout is already set (the dedicated Advertisement Page tab supplies its own). */
  pageAdvertisements?: PageAdvertisement[];
};

const getMissingLanguageMessage = (languageMode: PageLanguageMode, language: ArticleLanguage) => {
  if (languageMode === "bilingual") {
    return "Not enough bilingual articles are available for the selected page layout.";
  }

  return `Not enough ${language === "english" ? "English" : "Hindi"} articles are available to generate this page.`;
};

const selectUnusedNewswireArticle = (
  articles: NewswireStory[],
  usedIds: Set<string>,
  language: ArticleLanguage,
  requestedWords: number,
) => articles.find((article) =>
  !usedIds.has(article.id) &&
  hasMeaningfulLocalizedContent(article, language, requestedWords),
);

const isFrontPageLeadCategoryArticle = (article: NewswireStory): boolean => {
  const category = String(article.category ?? "").trim().toLowerCase();
  return category === "national" || category === "international";
};

const isFrontPageTopStorySlot = (slot: any, topY: number, options?: NewswireImportOptions): boolean =>
  options?.pageKind === "front" && Math.abs(Number(slot.y ?? 0) - topY) <= 12;

const getActiveContentBounds = (document: NewspaperDocument, pageId: NewspaperPageId) =>
  resolveHeaderReservedContentBounds(document, pageId) ?? CONTENT_BOUNDS;

const normalizeAssetIdPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";

const createNewswireImageAsset = (
  item: NewswireStory,
  fallbackIndex: number,
  imageUrl: string = item.imageUrl,
): NewspaperAsset | null => {
  if (!imageUrl) {
    return null;
  }

  const id = `newswire-${normalizeAssetIdPart(item.id || item.headline || imageUrl)}-${fallbackIndex + 1}`;
  const now = new Date().toISOString();

  return {
    id,
    type: "image",
    name: item.headline || `Newswire image ${fallbackIndex + 1}`,
    filename: imageUrl.split("/").pop()?.split("?")[0] || `${id}.jpg`,
    originalFilename: imageUrl,
    colorSpace: "RGB",
    createdAt: now,
    modifiedAt: now,
    credit: "",
    photographer: "",
    caption: item.imageCaption || item.caption,
    keywords: [],
    section: item.category,
    tags: ["newswire", item.category].filter(Boolean),
    usageCount: 0,
    linkedFrames: [],
    linkMode: "linked",
    linkStatus: "ok",
    thumbnailUrl: imageUrl,
    previewUrl: imageUrl,
    source: imageUrl,
    metadata: {
      newswireId: item.id,
      sourceUrl: item.sourceUrl,
    },
  };
};

export const createStoryFrame = ({
  id,
  templateStoryNumber,
  name,
  category = "city",
  tags = [],
  status = "draft",
  locked = false,
  hidden = false,
  x,
  y,
  width,
  height,
  role,
  priority = "secondary",
  columnStart = 1,
  columnSpan = getDefaultStoryColumnSpan(priority),
  imageEnabled = getDefaultImageSettingsForPriority(priority).imageEnabled,
  imageAlignment = getDefaultImageSettingsForPriority(priority).imageAlignment,
  imageColumnSpan = getDefaultImageSettingsForPriority(priority).imageColumnSpan,
  imageHeight = getDefaultImageSettingsForPriority(priority).imageHeight,
  imageHeightMode = getDefaultImageSettingsForPriority(priority).imageHeightMode,
  imageHeightPreset = getDefaultImageSettingsForPriority(priority).imageHeightPreset,
  imageHeightProtection = getDefaultImageSettingsForPriority(priority).imageHeightProtection,
  autoSizeImage = getDefaultImageSettingsForPriority(priority).autoSizeImage,
  imageWrapMode = getDefaultImageSettingsForPriority(priority).imageWrapMode,
  imageShapeType = getDefaultImageSettingsForPriority(priority).imageShapeType,
  imageShapePoints = getDefaultImageSettingsForPriority(priority).imageShapePoints,
  imageCrop = getDefaultImageSettingsForPriority(priority).imageCrop,
  wrapContourPoints = getDefaultImageSettingsForPriority(priority).wrapContourPoints,
  wrapTextOffset = getDefaultImageSettingsForPriority(priority).wrapTextOffset,
  sourceWidth,
  sourceHeight,
  headlineFontSize = getDefaultStoryTypographySettings(priority).headlineFontSize,
  subheadlineFontSize = getDefaultStoryTypographySettings(priority).subheadlineFontSize,
  bodyFontSize = getDefaultStoryTypographySettings(priority).bodyFontSize,
  headlineLineHeight = getDefaultStoryTypographySettings(priority).headlineLineHeight,
  subheadlineLineHeight = getDefaultStoryTypographySettings(priority).subheadlineLineHeight,
  bodyLineHeight = getDefaultStoryTypographySettings(priority).bodyLineHeight,
  headlineLineHeightMode = getDefaultStoryTypographySettings(priority).headlineLineHeightMode,
  subheadlineLineHeightMode = getDefaultStoryTypographySettings(priority).subheadlineLineHeightMode,
  bodyLineHeightMode = getDefaultStoryTypographySettings(priority).bodyLineHeightMode,
  headlineLeadingValue = getDefaultStoryTypographySettings(priority).headlineLeadingValue,
  subheadlineLeadingValue = getDefaultStoryTypographySettings(priority).subheadlineLeadingValue,
  bodyLeadingValue = getDefaultStoryTypographySettings(priority).bodyLeadingValue,
  headlineWeight = getDefaultStoryTypographySettings(priority).headlineWeight,
  subheadlineWeight = getDefaultStoryTypographySettings(priority).subheadlineWeight,
  autoFitHeadline = getDefaultStoryTypographySettings(priority).autoFitHeadline,
  autoBalanceHeadline = getDefaultStoryTypographySettings(priority).autoBalanceHeadline,
  enableHyphenation = getDefaultStoryTypographySettings(priority).enableHyphenation,
  forceFullWidthHeadlines = getDefaultStoryTypographySettings(priority).forceFullWidthHeadlines,
  headlineLayoutMode = getDefaultStoryTypographySettings(priority).headlineLayoutMode,
  articleData = prototypeArticle,
  compositionSettings = initialCompositionSettings,
}: ArticleBoxModel & {
  id: StoryFrameId;
  templateStoryNumber?: StoryFrame["templateStoryNumber"];
  name?: StoryFrame["name"];
  category?: StoryFrame["category"];
  tags?: StoryFrame["tags"];
  status?: StoryFrame["status"];
  locked?: StoryFrame["locked"];
  hidden?: StoryFrame["hidden"];
  role?: StoryFrame["role"];
  priority?: StoryFrame["priority"];
  columnStart?: StoryColumnSpan;
  columnSpan?: StoryColumnSpan;
} & Partial<StoryImageSettings> & Partial<StoryTypographySettings> & {
  articleData?: ArticleData;
  compositionSettings?: ArticleCompositionSettings;
}): StoryFrame => ({
  id,
  templateStoryNumber,
  name,
  category,
  tags,
  status,
  locked,
  hidden,
  x,
  y,
  width,
  height,
  role,
  priority,
  columnStart,
  columnSpan,
  imageEnabled,
  imageAlignment,
  imageColumnSpan,
  imageHeight,
  imageHeightMode,
  imageHeightPreset,
  imageHeightProtection,
  autoSizeImage,
  imageWrapMode,
  imageShapeType,
  imageShapePoints,
  imageCrop,
  wrapContourPoints,
  wrapTextOffset,
  sourceWidth,
  sourceHeight,
  headlineFontSize,
  subheadlineFontSize,
  bodyFontSize,
  headlineLineHeight,
  subheadlineLineHeight,
  bodyLineHeight,
  headlineLineHeightMode,
  subheadlineLineHeightMode,
  bodyLineHeightMode,
  headlineLeadingValue,
  subheadlineLeadingValue,
  bodyLeadingValue,
  headlineWeight,
  subheadlineWeight,
  autoFitHeadline,
  autoBalanceHeadline,
  enableHyphenation,
  forceFullWidthHeadlines,
  headlineLayoutMode,
  articleData: cloneArticleData(articleData),
  compositionSettings: {
    ...compositionSettings,
  },
  dirtyFlags: createCleanDirtyFlags(),
});

const initialStories: StoryFrame[] = [
  createStoryFrame({
    id: "story-1",
    x: 72,
    y: 90,
    width: 360,
    height: 540,
  }),
];
const initialDocument = createDocumentFromStoryFrames(initialStories);
const initialActivePageId = initialDocument.pages[0]?.id ?? "page-1";

const createStoryFrameFromDocumentPlacement = (
  story: NewspaperStoryObject,
  placement: NewspaperPageObject["stories"][number],
  document: NewspaperDocument,
): StoryFrame => {
  const photoAsset = story.photo ? document.assets[story.photo] : null;
  return createStoryFrame({
    id: story.id,
    name: story.name,
    category: story.category,
    tags: story.tags,
    status: story.status,
    locked: placement.locked ?? story.locked,
    hidden: placement.hidden ?? story.hidden,
    role: placement.role,
    priority: placement.priority,
    columnStart: placement.columnStart,
    columnSpan: placement.columnSpan,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    articleData: createArticleDataFromStoryObject(story),
    compositionSettings: initialCompositionSettings,
    ...story.imageSettings,
    sourceWidth: photoAsset?.width ?? story.imageSettings?.sourceWidth,
    sourceHeight: photoAsset?.height ?? story.imageSettings?.sourceHeight,
    ...story.typography,
  });
};

const withSyncedDocument = (
  document: NewspaperDocument,
  stories: StoryFrame[],
  pageId: NewspaperPageId = document.settings.activePageId ?? document.pages[0]?.id ?? "page-1",
) => ({
  stories,
  document: updateDocumentPageFromStoryFrames(document, stories, pageId),
});

export const loadStoriesForPage = (document: NewspaperDocument, pageId: NewspaperPageId): StoryFrame[] =>
  getStoryFramesForPage(document, pageId, createStoryFrameFromDocumentPlacement).filter(
    (story, index, allStories) => allStories.findIndex((candidate) => candidate.id === story.id) === index,
  );

const refreshActivePageStories = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  selectedFrameId: NewspaperFrameId | null,
) => {
  const stories = loadStoriesForPage(document, pageId);
  const selectedFrame = selectedFrameId ? document.frames[selectedFrameId] : null;
  const selectedStoryId =
    selectedFrame?.storyId && stories.some((story) => story.id === selectedFrame.storyId)
      ? selectedFrame.storyId
      : stories[0]?.id ?? null;

  return {
    stories,
    selectedStoryId,
    selectedObjects: selectedStoryId
      ? [{ storyId: selectedStoryId, objectType: "headline" as const, bounds: null }]
      : [],
  };
};

const findFrameIdForStory = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  storyId: StoryFrameId | null,
) => {
  if (!storyId) {
    return null;
  }

  const page = document.pages.find((candidate) => candidate.id === pageId);

  return (
    page?.frameIds.find((frameId) => document.frames[frameId]?.storyId === storyId) ??
    page?.stories.find((placement) => placement.storyId === storyId)?.id ??
    null
  );
};

type EditorActions = {
  selectFrame: (frameId: NewspaperFrameId, additive?: boolean) => void;
  renameFrame: (frameId: NewspaperFrameId, name: string) => void;
  setFrameLocked: (frameId: NewspaperFrameId, locked: boolean) => void;
  setFrameHidden: (frameId: NewspaperFrameId, hidden: boolean) => void;
  reorderFrameLayer: (frameId: NewspaperFrameId, action: "bring-forward" | "send-backward" | "bring-to-front" | "send-to-back") => void;
  moveFrameBefore: (sourceFrameId: NewspaperFrameId, targetFrameId: NewspaperFrameId) => void;
  duplicateSelectedFrame: () => void;
  deleteSelectedFrame: () => void;
  groupSelectedFrames: () => void;
  ungroupSelectedFrames: () => void;
  soloFrame: (frameId: NewspaperFrameId) => void;
  setActivePage: (pageId: NewspaperPageId) => void;
  addEditionPage: (position?: "end" | "before" | "after") => void;
  duplicateActivePage: () => void;
  deleteActivePage: () => void;
  moveActivePage: (direction: "up" | "down") => void;
  updateActivePageProperties: (
    update: Partial<{
      sectionName: string;
      status: EditionPageStatus;
      colorLabel: EditionPageColorLabel;
      locked: boolean;
      hidden: boolean;
      masterPageId: NewspaperMasterPageId | "none";
    }>,
  ) => void;
  createMasterPage: () => void;
  duplicateMasterPage: (masterId: NewspaperMasterPageId) => void;
  renameMasterPage: (masterId: NewspaperMasterPageId, name: string) => void;
  deleteMasterPage: (masterId: NewspaperMasterPageId) => void;
  applyMasterToActivePage: (masterId: NewspaperMasterPageId | null) => void;
  detachActivePageMaster: () => void;
  overrideActivePageMasterElement: (elementId: NewspaperMasterElementId) => void;
  setCanvasMode: (canvasMode: EditionCanvasMode) => void;
  createStory: () => void;
  generateStoryLayout: (storyCount?: number) => void;
  generateFiveStoryLayout: () => void;
  importNewswireStories: (
    category: string,
    articles: NewswireStory[],
    options: NewswireImportOptions,
  ) => void;
  replaceStoryArticleFromNewswire: (
    storyId: StoryFrameId,
    article: NewswireStory,
    options: NewswireImportOptions,
  ) => void;
  clearPlacementWarning: () => void;
  selectStory: (storyId: StoryFrameId, additive?: boolean) => void;
  selectStories: (storyIds: StoryFrameId[]) => void;
  selectStoriesInRect: (bounds: ArticleBoxModel, additive?: boolean) => void;
  selectAllStories: () => void;
  selectObject: (
    storyId: StoryFrameId,
    objectType: EditorObjectType,
    selectionBounds?: EditorSelectionBounds | null,
    additive?: boolean,
  ) => void;
  setSelectedObjectType: (objectType: EditorObjectType) => void;
  setSelectedRichTextRange: (range: EditorTextRange | null) => void;
  setSelectedParagraphIndex: (index: number) => void;
  setTypographyEditingScope: (scope: TypographyEditingScope) => void;
  setEditingMode: (mode: EditorEditingMode) => void;
  setCaretPosition: (position: number | null) => void;
  clearSelection: () => void;
  moveSelectedStories: (delta: Point) => void;
  resizeSelectedStoriesUniform: (scale: number) => void;
  deleteSelectedStories: () => void;
  setSelectedStoriesLocked: (locked: boolean) => void;
  duplicateSelectedStories: () => void;
  groupSelectedStories: () => void;
  ungroupSelectedStories: () => void;
  alignSelectedStories: (alignment: "left" | "right" | "top" | "bottom" | "center-horizontal" | "center-vertical") => void;
  distributeSelectedStories: (
    distribution: "horizontal-spacing" | "vertical-spacing" | "equal-width" | "equal-height" | "match-largest" | "match-smallest",
  ) => void;
  undoMultiSelectionOperation: () => void;
  redoMultiSelectionOperation: () => void;
  importAssets: (assets: AssetImportDescriptor[]) => void;
  placeAssetInSelectedFrame: (assetId: NewspaperAssetId) => void;
  replaceStoryImage: (storyId: string, descriptor: AssetImportDescriptor) => void;
  deleteAsset: (assetId: NewspaperAssetId) => void;
  relinkAsset: (assetId: NewspaperAssetId, source: string) => void;
  setAssetStatus: (assetId: NewspaperAssetId, status: "ok" | "missing" | "broken" | "moved" | "renamed") => void;
  createAdvertisementBooking: (input: AdvertisementBookingInput) => void;
  updateAdvertisementLifecycle: (adId: NewspaperAdvertisementId, status: NewspaperAdvertisementStatus) => void;
  createAdvertisementFrame: (adId?: NewspaperAdvertisementId | null) => void;
  autoPlaceAdvertisements: () => void;
  placeAdvertisementInSelectedFrame: (adId: NewspaperAdvertisementId) => void;
  replaceAdvertisementArtwork: (adId: NewspaperAdvertisementId, assetId: NewspaperAssetId | null) => void;
  createDocumentStyle: (input: StyleCreateInput) => void;
  duplicateDocumentStyle: (styleId: NewspaperStyleId) => void;
  renameDocumentStyle: (styleId: NewspaperStyleId, name: string) => void;
  updateDocumentStyle: (styleId: NewspaperStyleId, patch: StyleUpdateInput) => void;
  deleteDocumentStyle: (styleId: NewspaperStyleId) => void;
  applyDocumentStyle: (targetId: string, styleId: NewspaperStyleId) => void;
  markDocumentStyleOverride: (targetId: string) => void;
  clearDocumentStyleOverrides: (targetId: string) => void;
  importDocumentStyles: (source: string, format: StyleImportFormat) => void;
  exportDocumentStyles: (format: StyleExportFormat) => string;
  updateSelectedStoryArticleData: <Key extends keyof ArticleData>(
    key: Key,
    value: ArticleData[Key],
  ) => void;
  updateSelectedStoryCompositionSettings: <Key extends keyof ArticleCompositionSettings>(
    key: Key,
    value: ArticleCompositionSettings[Key],
  ) => void;
  updateSelectedStoryImageSettings: <Key extends keyof StoryImageSettings>(
    key: Key,
    value: StoryImageSettings[Key],
  ) => void;
  updateSelectedStoryTypographySettings: <Key extends keyof StoryTypographySettings>(
    key: Key,
    value: StoryTypographySettings[Key],
  ) => void;
  resetSelectedStoryTypographyToPriorityDefaults: () => void;
  updateSelectedStoryPriority: (priority: StoryFrame["priority"]) => void;
  renameStory: (storyId: StoryFrameId, name: string) => void;
  duplicateStory: (storyId: StoryFrameId) => void;
  deleteStory: (storyId: StoryFrameId) => void;
  confirmSmartDelete: () => void;
  cancelSmartDelete: () => void;
  reorderStory: (storyId: StoryFrameId, direction: "up" | "down") => void;
  setStoryLocked: (storyId: StoryFrameId, locked: boolean) => void;
  setStoryHidden: (storyId: StoryFrameId, hidden: boolean) => void;
  updateStoryPriority: (storyId: StoryFrameId, priority: StoryFrame["priority"]) => void;
  updateSelectedStoryColumnSpan: (columnSpan: StoryColumnSpan) => void;
  setPageType: (pageType: PageType) => void;
  applyHeaderSetDraft: (draft: {
    profileId: string;
    profile: PublicationProfile;
    frontLayout: HeaderLayoutKind;
    insideLayout: InsideHeaderLayoutKind;
  }) => void;
  updatePublicationProfile: (profileId: string, patch: Partial<PublicationProfile>) => void;
  setHeaderBannerImage: (kind: "front" | "inside", url: string, maskColors?: string[]) => void;
  setHeaderAccentColor: (color: string) => void;
  setFrontTeaserImageOverride: (url: string) => void;
  setFrontTeaserAutoPick: (headline: string, imageUrl: string) => void;
  setFrontHeaderLayout: (layout: HeaderLayoutKind) => void;
  setInsideHeaderLayout: (layout: InsideHeaderLayoutKind) => void;
  saveActiveHeaderSetAs: (name: string) => void;
  duplicateActiveHeaderSet: () => void;
  renameActiveHeaderSet: (name: string) => void;
  deleteActiveHeaderSet: () => void;
  activateHeaderSet: (headerSetId: string) => void;
  setActiveHeaderSetAsDefault: () => void;
  exportActiveHeaderSet: () => string;
  importHeaderSet: (payload: string) => void;
  importHeaderLogoAsset: (
    profileId: string,
    role: "color" | "monochrome",
    descriptor: AssetImportDescriptor,
  ) => void;
  setActiveHeaderLocked: (locked: boolean) => void;
  setActiveHeaderHidden: (hidden: boolean) => void;
  resetActiveHeaderLayouts: () => void;
  setActiveHeaderSectionOverride: (input: {
    sectionName: string;
    displayName?: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
    websiteSlug?: string;
  }) => void;
  removeActiveHeaderSectionOverride: (sectionName: string) => void;
  overrideActivePageHeader: (input: {
    sectionName: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
  }) => void;
  returnActivePageToMasterHeader: () => void;
  undoHeaderOperation: () => void;
  redoHeaderOperation: () => void;
  toggleProductionView: () => void;
  togglePerformanceProfiler: () => void;
  moveStory: (storyId: StoryFrameId, position: Point) => void;
  resizeStory: (storyId: StoryFrameId, articleBox: ArticleBoxModel) => void;
  beginLiveResize: (
    storyId: StoryFrameId,
    articleBox: ArticleBoxModel,
    handle: LiveResizeHandle,
    pointer: LiveResizePointer,
  ) => void;
  updateLiveResize: (pointer: LiveResizePointer) => void;
  endLiveResize: () => void;
  cancelLiveResize: () => void;
  beginLiveMove: (storyId: StoryFrameId, articleBox: ArticleBoxModel, pointer: LiveResizePointer) => void;
  updateLiveMove: (pointer: LiveResizePointer) => void;
  endLiveMove: () => void;
  cancelLiveMove: () => void;
  setSmartLayoutEnabled: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type EditorStore = {
  document: NewspaperDocument;
  activePageId: NewspaperPageId;
  canvasMode: EditionCanvasMode;
  stories: StoryFrame[];
  selectedFrameId: string | null;
  selectedFrameIds: NewspaperFrameId[];
  selectedStoryId: StoryFrameId | null;
  selectedObjectType: EditorObjectType;
  selectedObjects: EditorSelectedObject[];
  selectedRichTextRange: EditorTextRange | null;
  selectedParagraphIndex: number;
  typographyEditingScope: TypographyEditingScope;
  editingMode: EditorEditingMode;
  caretPosition: number | null;
  selectionBounds: EditorSelectionBounds | null;
  pageType: PageType;
  placementWarning: string | null;
  productionView: boolean;
  performanceProfilerEnabled: boolean;
  zoom: number;
  smartLayout: {
    enabled: boolean;
  };
  liveResizePreviewDrawCommands: PreviewDrawCommand[];
} & EditorActions;

const clampStoryPosition = (position: Point, size: Size): Point => ({
  x: clamp(position.x, CONTENT_BOUNDS.x, CONTENT_BOUNDS.x + CONTENT_BOUNDS.width - size.width),
  y: clamp(position.y, CONTENT_BOUNDS.y, CONTENT_BOUNDS.y + CONTENT_BOUNDS.height - size.height),
});

const clampStoryPositionToBounds = (
  position: Point,
  size: Size,
  contentBounds: typeof CONTENT_BOUNDS = CONTENT_BOUNDS,
): Point => ({
  x: clamp(position.x, contentBounds.x, contentBounds.x + contentBounds.width - size.width),
  y: clamp(position.y, contentBounds.y, contentBounds.y + contentBounds.height - size.height),
});

const normalizeStoryGeometry = (
  articleBox: ArticleBoxModel,
  contentBounds: typeof CONTENT_BOUNDS = CONTENT_BOUNDS,
): ArticleBoxModel => {
  const snappedPosition = snapPoint({
    x: articleBox.x,
    y: articleBox.y,
  });
  const boundedPosition = {
    x: clamp(
      snappedPosition.x,
      contentBounds.x,
      contentBounds.x + contentBounds.width - MIN_STORY_SIZE.width,
    ),
    y: clamp(
      snappedPosition.y,
      contentBounds.y,
      contentBounds.y + contentBounds.height - MIN_STORY_SIZE.height,
    ),
  };
  const maxSizeFromPosition = {
    width: contentBounds.x + contentBounds.width - boundedPosition.x,
    height: contentBounds.y + contentBounds.height - boundedPosition.y,
  };
  const snappedSize = snapSize({
    width: Math.max(articleBox.width, MIN_STORY_SIZE.width),
    height: Math.max(articleBox.height, MIN_STORY_SIZE.height),
  });

  return {
    x: snapValue(boundedPosition.x),
    y: snapValue(boundedPosition.y),
    width: Math.min(snappedSize.width, maxSizeFromPosition.width),
    height: Math.min(snappedSize.height, maxSizeFromPosition.height),
  };
};

const updateStory = (
  stories: StoryFrame[],
  storyId: StoryFrameId,
  update: (story: StoryFrame) => StoryFrame,
) => stories.map((story) => (story.id === storyId ? update(story) : story));

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const rectsOverlap = (
  first: ArticleBoxModel,
  second: ArticleBoxModel,
) =>
  rangesOverlap(first.x, first.x + first.width, second.x, second.x + second.width) &&
  rangesOverlap(first.y, first.y + first.height, second.y, second.y + second.height);

const storyOverlapsAnother = (
  stories: StoryFrame[],
  storyId: StoryFrameId,
  candidate: ArticleBoxModel,
) =>
  stories.some((story) => story.id !== storyId && rectsOverlap(candidate, story));

const rectContains = (bounds: ArticleBoxModel, story: StoryFrame) =>
  story.x >= bounds.x &&
  story.y >= bounds.y &&
  story.x + story.width <= bounds.x + bounds.width &&
  story.y + story.height <= bounds.y + bounds.height;

const getStoryIdsFromFrameIds = (
  document: NewspaperDocument,
  frameIds: NewspaperFrameId[],
) =>
  frameIds
    .map((frameId) => document.frames[frameId]?.storyId)
    .filter((storyId): storyId is StoryFrameId => Boolean(storyId));

const getSelectedStoryIds = (state: EditorStore) => {
  const ids = new Set<StoryFrameId>(getStoryIdsFromFrameIds(state.document, state.selectedFrameIds));

  if (state.selectedStoryId) {
    ids.add(state.selectedStoryId);
  }

  return [...ids].filter((storyId) => state.stories.some((story) => story.id === storyId)).sort();
};

const getSelectionFrameIds = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  storyIds: StoryFrameId[],
) =>
  storyIds
    .map((storyId) => findFrameIdForStory(document, pageId, storyId))
    .filter((frameId): frameId is NewspaperFrameId => Boolean(frameId));

const getSelectionBounds = (stories: StoryFrame[]) => {
  const left = Math.min(...stories.map((story) => story.x));
  const top = Math.min(...stories.map((story) => story.y));
  const right = Math.max(...stories.map((story) => story.x + story.width));
  const bottom = Math.max(...stories.map((story) => story.y + story.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const cloneStoryWithOffset = (story: StoryFrame, id: StoryFrameId, offset: number): StoryFrame => ({
  ...story,
  id,
  name: `${story.name ?? (richTextToPlainText(story.articleData.headline) || story.id)} Copy`,
  x: snapValue(story.x + offset),
  y: snapValue(story.y + offset),
  articleData: cloneArticleData(story.articleData),
  tags: [...(story.tags ?? [])],
  locked: false,
  hidden: false,
  status: "draft",
  dirtyFlags: mergeDirtyFlags(createCleanDirtyFlags(), {
    geometryDirty: true,
    compositionDirty: true,
    renderDirty: true,
  }),
});

const buildPreviewCommandsFromUpdates = (
  updates: { storyId: string; after: ArticleBoxModel }[],
): PreviewDrawCommand[] =>
  updates.map((update, index) => ({
    id: ["preview-command", "multi-selection", update.storyId, index].join(":"),
    kind: "frame-outline",
    frameId: update.storyId,
    rect: { ...update.after },
    stroke: "#247a48",
    fill: "rgba(36, 122, 72, 0.08)",
    opacity: 1,
    dash: [4, 4],
    zIndex: index,
  }));

const commitMultiStoryGeometry = ({
  state,
  operation,
  rects,
}: {
  state: EditorStore;
  operation: "move-story" | "resize-story";
  rects: Record<string, ArticleBoxModel>;
}) => {
  const selectedIds = Object.keys(rects).filter((storyId) => state.stories.some((story) => story.id === storyId));

  if (selectedIds.length === 0) {
    return {
      placementWarning: "No selected stories",
    };
  }

  const frames = createLayoutFrameSnapshots(state.stories, state.activePageId);
  const snapshot = analyzeLayoutSnapshot({
    pageId: state.activePageId,
    pageBounds: PAGE_RECT,
    contentBounds: CONTENT_BOUNDS,
    columns: createLayoutColumns(),
    frames,
  });
  const proposed = new Map(
    snapshot.visibleFrames.map((frame) => [
      frame.id,
      {
        x: rects[frame.id]?.x ?? frame.x,
        y: rects[frame.id]?.y ?? frame.y,
        width: rects[frame.id]?.width ?? frame.width,
        height: rects[frame.id]?.height ?? frame.height,
      },
    ]),
  );
  const solution = buildLayoutSolution({
    snapshot,
    proposed,
    unresolvedCollisionCount: 0,
    warnings: [],
    errors: [],
  });

  multiSelectionSessionManager.begin({
    pageId: state.activePageId,
    operation,
    beforePageSnapshot: createGeometrySnapshot(frames),
  });
  const previewUpdates = solution.geometryChanges
    .filter((change) => change.changed)
    .map((change) => ({ storyId: change.frameId, after: change.after }));
  multiSelectionSessionManager.preview({
    preview: {
      id: ["preview-layout", "multi-selection", Date.now()].join(":"),
      sequence: 1,
      sourceFrameId: selectedIds[0],
      resizeDirection: operation === "move-story" ? "horizontal" : "vertical",
      requiredSpace: 0,
      status: "ready",
      frames: solution.geometryChanges.map((change) => ({
        frameId: change.frameId,
        role: selectedIds.includes(change.frameId) ? "source" : "affected",
        before: change.before,
        after: change.after,
        changed: change.changed,
      })),
      warnings: [],
      constraintViolations: [],
      solution,
      metrics: {
        snapshotTimeMs: 0,
        constraintTimeMs: 0,
        neighborTimeMs: 0,
        spaceTimeMs: 0,
        patchTimeMs: 0,
        solveTimeMs: 0,
        diffTimeMs: 0,
        totalTimeMs: 0,
      },
    },
    force: true,
  });
  const commit = commitLayoutSolution({
    stories: state.stories,
    document: state.document,
    pageId: state.activePageId,
    solution,
  });

  if (!commit.committed) {
    multiSelectionSessionManager.rollback();

    return {
      placementWarning: commit.errors[0] ?? "Multi-selection operation rolled back",
    };
  }

  multiSelectionSessionManager.commit({
    afterPageSnapshot: createGeometrySnapshot(commit.stories),
    commitTimeMs: 0,
    transaction: {
      layoutSolution: solution,
    },
  });

  return {
    stories: commit.stories,
    document: commit.document,
    selectedFrameIds: getSelectionFrameIds(commit.document, state.activePageId, selectedIds),
    selectedStoryId: selectedIds.at(-1) ?? null,
    selectedObjects: selectedIds.map((storyId) => ({ storyId, objectType: "headline" as const, bounds: null })),
    liveResizePreviewDrawCommands: buildPreviewCommandsFromUpdates(previewUpdates),
    placementWarning: commit.warnings[0] ?? null,
  };
};

const createLayoutFrameSnapshots = (
  stories: StoryFrame[],
  pageId: NewspaperPageId,
) =>
  stories.map((story, index) => ({
    id: story.id,
    pageId,
    storyId: story.id,
    kind: "story" as const,
    locked: Boolean(story.locked),
    hidden: Boolean(story.hidden),
    pinned: false,
    priority: story.priority,
    columnStart: story.columnStart,
    columnSpan: story.columnSpan,
    zIndex: index,
    x: story.x,
    y: story.y,
    width: story.width,
    height: story.height,
  }));

const createLayoutColumns = () =>
  createColumnGrid({
    pageWidth: DEFAULT_PAGE_MASTER.width,
    contentX: DEFAULT_PAGE_MASTER.contentX,
    contentWidth: DEFAULT_PAGE_MASTER.contentWidth,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: DEFAULT_PAGE_MASTER.gutter,
  }).map((column) => ({
    index: column.index + 1,
    x: toPoints(column.x),
    y: CONTENT_BOUNDS.y,
    width: toPoints(column.width),
    height: CONTENT_BOUNDS.height,
  }));

const markRebalancedStoriesDirty = (
  previousStories: StoryFrame[],
  nextStories: StoryFrame[],
): StoryFrame[] => {
  const previousById = new Map(previousStories.map((story) => [story.id, story]));

  return nextStories.map((story) => {
    const previous = previousById.get(story.id);
    const geometryChanged =
      !previous ||
      previous.width !== story.width ||
      previous.height !== story.height ||
      previous.columnStart !== story.columnStart ||
      previous.columnSpan !== story.columnSpan;

    if (!geometryChanged) {
      return story;
    }

    return markStoryDirty(story, {
      geometryDirty: true,
      compositionDirty: true,
      renderDirty: true,
    });
  });
};

const getRoleFromPriority = (priority: StoryFrame["priority"]): StoryFrame["role"] => {
  if (priority === "secondary") {
    return "medium";
  }

  if (priority === "filler") {
    return "brief";
  }

  return priority;
};

const applyPageCompositionToStories = (stories: StoryFrame[]): StoryFrame[] => {
  const composition = composeEditorialPage({
    storyCount: stories.length,
    pageWidth: PAGE_BOUNDS.width,
    pageHeight: PAGE_BOUNDS.height,
    contentX: CONTENT_BOUNDS.x,
    contentY: CONTENT_BOUNDS.y,
    contentWidth: CONTENT_BOUNDS.width,
    contentHeight: CONTENT_BOUNDS.height,
  });

  if (!composition) {
    return stories;
  }

  return stories.map((story, index) => {
    const slot = composition.slots[index];

    return {
      ...story,
      role: slot.role,
      priority: slot.role === "medium" ? "secondary" : slot.role,
      columnStart: slot.columnStart as StoryColumnSpan,
      columnSpan: slot.columnSpan as StoryColumnSpan,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      imageEnabled: story.imageEnabled,
      compositionSettings: {
        ...story.compositionSettings,
      },
      dirtyFlags: mergeDirtyFlags(story.dirtyFlags, {
        geometryDirty: true,
        compositionDirty: true,
        renderDirty: true,
      }),
    };
  });
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  document: initialDocument,
  activePageId: initialActivePageId,
  canvasMode: "single",
  stories: initialStories,
  selectedFrameId: findFrameIdForStory(initialDocument, initialActivePageId, initialStories[0].id),
  selectedFrameIds: [findFrameIdForStory(initialDocument, initialActivePageId, initialStories[0].id)].filter(
    (frameId): frameId is NewspaperFrameId => Boolean(frameId),
  ),
  selectedStoryId: initialStories[0].id,
  selectedObjectType: "headline",
  selectedObjects: [{ storyId: initialStories[0].id, objectType: "headline", bounds: null }],
  selectedRichTextRange: null,
  selectedParagraphIndex: 0,
  typographyEditingScope: "story",
  editingMode: "none",
  caretPosition: null,
  selectionBounds: null,
  pageType: "city",
  placementWarning: null,
  productionView: false,
  performanceProfilerEnabled: false,
  smartLayout: {
    enabled: false,
  },
  liveResizePreviewDrawCommands: [],
  zoom: 0.45,

  selectFrame: (frameId, additive = false) =>
    set((state) => {
      const frame = state.document.frames[frameId];

      if (!frame) {
        return state;
      }

      const selectedFrameIds = additive
        ? state.selectedFrameIds.includes(frameId)
          ? state.selectedFrameIds.filter((selectedId) => selectedId !== frameId)
          : [...state.selectedFrameIds, frameId]
        : [frameId];

      if (frame.pageId !== state.activePageId) {
        const syncedDocument = updateDocumentPageFromStoryFrames(
          state.document,
          state.stories,
          state.activePageId,
        );
        const targetStories = loadStoriesForPage(syncedDocument, frame.pageId);
        const selectedStoryId =
          frame.storyId && targetStories.some((story) => story.id === frame.storyId)
            ? frame.storyId
            : targetStories[0]?.id ?? null;
        const targetPage = syncedDocument.pages.find((page) => page.id === frame.pageId);

        return {
          document: {
            ...syncedDocument,
            settings: {
              ...syncedDocument.settings,
              activePageId: frame.pageId,
            },
          },
          activePageId: frame.pageId,
          pageType: targetPage?.pageType ?? state.pageType,
          stories: targetStories,
          selectedFrameId: frameId,
          selectedFrameIds,
          selectedStoryId,
          selectedObjectType: "headline",
          selectedObjects: [],
          selectedRichTextRange: null,
          editingMode: "none",
          caretPosition: null,
          selectionBounds: null,
        };
      }

      const selectedStoryId =
        frame.storyId && state.stories.some((story) => story.id === frame.storyId)
          ? frame.storyId
          : state.selectedStoryId;

      return {
        selectedFrameId: frameId,
        selectedFrameIds,
        selectedStoryId,
        selectedObjectType: "headline",
        selectedObjects: [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
      };
    }),

  renameFrame: (frameId, name) =>
    set((state) => ({
      document: updateFrameManagerProperties(state.document, frameId, { name }),
    })),

  setFrameLocked: (frameId, locked) =>
    set((state) => {
      const document = updateFrameManagerProperties(state.document, frameId, { locked });
      const refreshed = refreshActivePageStories(document, state.activePageId, state.selectedFrameId);

      return {
        document,
        ...refreshed,
      };
    }),

  setFrameHidden: (frameId, hidden) =>
    set((state) => {
      const document = updateFrameManagerProperties(state.document, frameId, { hidden });
      const refreshed = refreshActivePageStories(document, state.activePageId, state.selectedFrameId);

      return {
        document,
        ...refreshed,
      };
    }),

  reorderFrameLayer: (frameId, action) =>
    set((state) => ({
      document: reorderFrameLayer(state.document, frameId, action),
      selectedFrameId: frameId,
      selectedFrameIds: [frameId],
    })),

  moveFrameBefore: (sourceFrameId, targetFrameId) =>
    set((state) => ({
      document: moveFrameBefore(state.document, sourceFrameId, targetFrameId),
      selectedFrameId: sourceFrameId,
      selectedFrameIds: [sourceFrameId],
    })),

  duplicateSelectedFrame: () =>
    set((state) => {
      if (!state.selectedFrameId) {
        return state;
      }

      const document = duplicateFrame(state.document, state.selectedFrameId);

      return {
        document,
        placementWarning: "Frame duplicated. Shared-story frame previews remain synchronized in Layers.",
      };
    }),

  deleteSelectedFrame: () =>
    set((state) => {
      if (!state.selectedFrameId) {
        return state;
      }

      const document = deleteFrame(state.document, state.selectedFrameId);
      const nextSelectedFrameId =
        document.pages
          .find((page) => page.id === state.activePageId)
          ?.frameIds.find((frameId) => frameId !== state.selectedFrameId) ?? null;
      const refreshed = refreshActivePageStories(document, state.activePageId, nextSelectedFrameId);

      return {
        document,
        selectedFrameId: nextSelectedFrameId,
        selectedFrameIds: nextSelectedFrameId ? [nextSelectedFrameId] : [],
        ...refreshed,
      };
    }),

  groupSelectedFrames: () =>
    set((state) => ({
      document: groupFrames(state.document, state.selectedFrameIds),
    })),

  ungroupSelectedFrames: () =>
    set((state) => ({
      document: ungroupFrames(state.document, state.selectedFrameIds),
    })),

  soloFrame: (frameId) =>
    set((state) => {
      const frame = state.document.frames[frameId];

      if (!frame) {
        return state;
      }

      const page = state.document.pages.find((candidate) => candidate.id === frame.pageId);
      const pageFrameIds = page?.frameIds ?? [];
      const shouldUnsolo = pageFrameIds
        .filter((candidateFrameId) => candidateFrameId !== frameId)
        .every((candidateFrameId) => state.document.frames[candidateFrameId]?.hidden);
      const frames = Object.fromEntries(
        Object.entries(state.document.frames).map(([candidateFrameId, candidateFrame]) => [
          candidateFrameId,
          pageFrameIds.includes(candidateFrameId)
            ? {
                ...candidateFrame,
                hidden: shouldUnsolo ? false : candidateFrameId !== frameId,
                metadata: {
                  ...candidateFrame.metadata,
                  updatedAt: new Date().toISOString(),
                },
              }
            : candidateFrame,
        ]),
      );
      const document = {
        ...state.document,
        frames,
      };
      const refreshed = refreshActivePageStories(document, state.activePageId, frameId);

      return {
        document,
        selectedFrameId: frameId,
        selectedFrameIds: [frameId],
        ...refreshed,
      };
    }),

  setActivePage: (pageId) =>
    set((state) => {
      if (pageId === state.activePageId) {
        return {};
      }

      const syncedDocument = updateDocumentPageFromStoryFrames(
        state.document,
        state.stories,
        state.activePageId,
      );
      const targetStories = loadStoriesForPage(syncedDocument, pageId);
      const targetPage = syncedDocument.pages.find((page) => page.id === pageId);
      const selectedStoryId = targetStories[0]?.id ?? null;

      return {
        document: {
          ...syncedDocument,
          settings: {
            ...syncedDocument.settings,
            activePageId: pageId,
          },
        },
        activePageId: pageId,
        stories: targetStories,
        pageType: targetPage?.pageType ?? state.pageType,
        selectedStoryId,
        selectedFrameId: findFrameIdForStory(syncedDocument, pageId, selectedStoryId),
        selectedFrameIds: [findFrameIdForStory(syncedDocument, pageId, selectedStoryId)].filter(
          (frameId): frameId is NewspaperFrameId => Boolean(frameId),
        ),
        selectedObjectType: "headline",
        selectedObjects: selectedStoryId
          ? [{ storyId: selectedStoryId, objectType: "headline", bounds: null }]
          : [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: null,
      };
    }),

  addEditionPage: (position = "end") =>
    set((state) => {
      const syncedDocument = updateDocumentPageFromStoryFrames(
        state.document,
        state.stories,
        state.activePageId,
      );
      const activeIndex = syncedDocument.pages.findIndex((page) => page.id === state.activePageId);
      const insertIndex =
        position === "before"
          ? Math.max(activeIndex, 0)
          : position === "after"
            ? Math.max(activeIndex + 1, 0)
            : syncedDocument.pages.length;
      const nextDocument = addPage(syncedDocument, insertIndex);
      const activePageId = nextDocument.settings.activePageId ?? nextDocument.pages.at(-1)?.id ?? state.activePageId;

      return {
        document: nextDocument,
        activePageId,
        stories: [],
        selectedStoryId: null,
        selectedFrameId: null,
        selectedFrameIds: [],
        selectedObjects: [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: null,
      };
    }),

  duplicateActivePage: () =>
    set((state) => {
      const syncedDocument = updateDocumentPageFromStoryFrames(
        state.document,
        state.stories,
        state.activePageId,
      );
      const nextDocument = duplicatePage(syncedDocument, state.activePageId);
      const activePageId = nextDocument.settings.activePageId ?? nextDocument.pages.at(-1)?.id ?? state.activePageId;
      const stories = loadStoriesForPage(nextDocument, activePageId);
      const selectedStoryId = stories[0]?.id ?? null;

      return {
        document: nextDocument,
        activePageId,
        stories,
        selectedStoryId,
        selectedFrameId: findFrameIdForStory(nextDocument, activePageId, selectedStoryId),
        selectedFrameIds: [findFrameIdForStory(nextDocument, activePageId, selectedStoryId)].filter(
          (frameId): frameId is NewspaperFrameId => Boolean(frameId),
        ),
        selectedObjects: selectedStoryId
          ? [{ storyId: selectedStoryId, objectType: "headline", bounds: null }]
          : [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: null,
      };
    }),

  deleteActivePage: () =>
    set((state) => {
      const syncedDocument = updateDocumentPageFromStoryFrames(
        state.document,
        state.stories,
        state.activePageId,
      );
      const activeIndex = syncedDocument.pages.findIndex((page) => page.id === state.activePageId);
      const nextDocument = deletePage(syncedDocument, state.activePageId);
      const nextPage =
        nextDocument.pages[Math.min(Math.max(activeIndex, 0), nextDocument.pages.length - 1)] ??
        nextDocument.pages[0];
      const activePageId = nextPage?.id ?? state.activePageId;
      const stories = loadStoriesForPage(nextDocument, activePageId);
      const selectedStoryId = stories[0]?.id ?? null;

      return {
        document: {
          ...nextDocument,
          settings: {
            ...nextDocument.settings,
            activePageId,
          },
        },
        activePageId,
        stories,
        selectedStoryId,
        selectedFrameId: findFrameIdForStory(nextDocument, activePageId, selectedStoryId),
        selectedFrameIds: [findFrameIdForStory(nextDocument, activePageId, selectedStoryId)].filter(
          (frameId): frameId is NewspaperFrameId => Boolean(frameId),
        ),
        selectedObjects: selectedStoryId
          ? [{ storyId: selectedStoryId, objectType: "headline", bounds: null }]
          : [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: nextDocument.pages.length === syncedDocument.pages.length ? "Cannot delete the last page" : null,
      };
    }),

  moveActivePage: (direction) =>
    set((state) => {
      const syncedDocument = updateDocumentPageFromStoryFrames(
        state.document,
        state.stories,
        state.activePageId,
      );
      const activeIndex = syncedDocument.pages.findIndex((page) => page.id === state.activePageId);

      if (activeIndex < 0) {
        return {};
      }

      const nextIndex = direction === "up" ? activeIndex - 1 : activeIndex + 1;
      const nextDocument = movePage(syncedDocument, state.activePageId, nextIndex);

      return {
        document: nextDocument,
        placementWarning: null,
      };
    }),

  updateActivePageProperties: (update) =>
    set((state) => {
      const nextDocument = updatePageProperties(state.document, state.activePageId, update);
      const activePage = nextDocument.pages.find((page) => page.id === state.activePageId);

      return {
        document: nextDocument,
        pageType: activePage?.pageType ?? state.pageType,
      };
    }),

  createMasterPage: () =>
    set((state) => ({
      document: createDocumentMasterPage(state.document, `Master ${Object.keys(state.document.masters ?? {}).length + 1}`),
      placementWarning: null,
    })),

  duplicateMasterPage: (masterId) =>
    set((state) => ({
      document: duplicateDocumentMasterPage(state.document, masterId),
      placementWarning: null,
    })),

  renameMasterPage: (masterId, name) =>
    set((state) => ({
      document: renameDocumentMasterPage(state.document, masterId, name),
      placementWarning: null,
    })),

  deleteMasterPage: (masterId) =>
    set((state) => ({
      document: deleteDocumentMasterPage(state.document, masterId),
      placementWarning: null,
    })),

  applyMasterToActivePage: (masterId) =>
    set((state) => ({
      document: applyMasterToPage(state.document, state.activePageId, masterId),
      placementWarning: null,
    })),

  detachActivePageMaster: () =>
    set((state) => ({
      document: detachMasterFromPage(state.document, state.activePageId),
      placementWarning: null,
    })),

  overrideActivePageMasterElement: (elementId) =>
    set((state) => ({
      document: overrideMasterElementOnPage(state.document, state.activePageId, elementId),
      placementWarning: "Master element overridden locally. It is now editable on this page.",
    })),

  setCanvasMode: (canvasMode) =>
    set((state) => ({
      canvasMode,
      document: setDocumentCanvasMode(state.document, canvasMode),
    })),

  createStory: () =>
    set((state) => {
      const nextStoryNumber = Object.keys(state.document.stories).length + 1;
      const nextId = `story-${nextStoryNumber}`;
      const firstStory = state.stories[0] ?? initialStories[0];
      const targetComposition = composeEditorialPage({
        storyCount: state.stories.length + 1,
        pageWidth: PAGE_BOUNDS.width,
        pageHeight: PAGE_BOUNDS.height,
        contentX: CONTENT_BOUNDS.x,
        contentY: CONTENT_BOUNDS.y,
        contentWidth: CONTENT_BOUNDS.width,
        contentHeight: CONTENT_BOUNDS.height,
      });

      if (state.stories.length + 1 > 13) {
        return {
          placementWarning: "Page is full",
        };
      }

      if (targetComposition) {
        const nextSlot = targetComposition.slots[targetComposition.slots.length - 1];
        const nextStory = createStoryFrame({
          id: nextId,
          role: nextSlot.role,
          priority: nextSlot.role === "medium" ? "secondary" : nextSlot.role,
          columnStart: Math.min(Math.max(nextSlot.columnStart, 1), 6) as StoryColumnSpan,
          columnSpan: Math.min(Math.max(nextSlot.columnSpan, 1), 6) as StoryColumnSpan,
          x: nextSlot.x,
          y: nextSlot.y,
          width: nextSlot.width,
          height: nextSlot.height,
          articleData: {
            ...prototypeArticle,
            headline: `${richTextToPlainText(prototypeArticle.headline)} ${state.stories.length + 1}`,
          },
          compositionSettings: {
            ...firstStory.compositionSettings,
          },
        });
        const composedStories = applyPageCompositionToStories([...state.stories, nextStory]);

        return {
          ...withSyncedDocument(state.document, composedStories, state.activePageId),
          selectedStoryId: nextStory.id,
          selectedFrameId: findFrameIdForStory(
            updateDocumentPageFromStoryFrames(state.document, composedStories, state.activePageId),
            state.activePageId,
            nextStory.id,
          ),
          selectedFrameIds: [
            findFrameIdForStory(
              updateDocumentPageFromStoryFrames(state.document, composedStories, state.activePageId),
              state.activePageId,
              nextStory.id,
            ),
          ].filter((frameId): frameId is NewspaperFrameId => Boolean(frameId)),
          selectedObjectType: "headline",
          selectedObjects: [{ storyId: nextStory.id, objectType: "headline", bounds: null }],
          selectedRichTextRange: null,
          editingMode: "none",
          caretPosition: null,
          selectionBounds: null,
          placementWarning: null,
        };
      }

      const placement = findStoryPlacement({
        stories: state.stories,
        preferredSize: getDefaultStorySize(),
        pageWidth: PAGE_BOUNDS.width,
        pageHeight: PAGE_BOUNDS.height,
        contentX: CONTENT_BOUNDS.x,
        contentY: CONTENT_BOUNDS.y,
        contentWidth: CONTENT_BOUNDS.width,
        contentHeight: CONTENT_BOUNDS.height,
      });

      if (!placement.storyFrame) {
        return {
          placementWarning: placement.warning,
        };
      }

      const nextStory = createStoryFrame({
        id: nextId,
        x: placement.storyFrame.x,
        y: placement.storyFrame.y,
        width: placement.storyFrame.width,
        height: placement.storyFrame.height,
        articleData: {
          ...prototypeArticle,
          headline: `${richTextToPlainText(prototypeArticle.headline)} ${state.stories.length + 1}`,
        },
        compositionSettings: firstStory.compositionSettings,
      });

      const nextStories = [...state.stories, nextStory];

      return {
        ...withSyncedDocument(state.document, nextStories, state.activePageId),
        selectedStoryId: nextStory.id,
        selectedFrameId: findFrameIdForStory(
          updateDocumentPageFromStoryFrames(state.document, nextStories, state.activePageId),
          state.activePageId,
          nextStory.id,
        ),
        selectedFrameIds: [
          findFrameIdForStory(
            updateDocumentPageFromStoryFrames(state.document, nextStories, state.activePageId),
            state.activePageId,
            nextStory.id,
          ),
        ].filter((frameId): frameId is NewspaperFrameId => Boolean(frameId)),
        selectedObjectType: "headline",
        selectedObjects: [{ storyId: nextStory.id, objectType: "headline", bounds: null }],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: null,
      };
    }),

  generateStoryLayout: (storyCount = 5) =>
    set((state) => {
      const layout = generateRandomStoryLayout({
        storyCount,
        pageWidth: PAGE_BOUNDS.width,
        contentX: CONTENT_BOUNDS.x,
        contentY: CONTENT_BOUNDS.y,
        contentWidth: CONTENT_BOUNDS.width,
        contentHeight: CONTENT_BOUNDS.height,
        columnCount: DEFAULT_PAGE_MASTER.columns,
        gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
      });
      const storyNumberOffset = Object.keys(state.document.stories).length;
      const stories = layout.slots.map((slot) =>
        createStoryFrame({
          id: `story-${storyNumberOffset + slot.storyNumber}`,
          templateStoryNumber: slot.storyNumber,
          role: getRoleFromPriority(slot.priority),
          priority: slot.priority,
          columnStart: Math.min(Math.max(slot.columnStart, 1), 6) as StoryColumnSpan,
          columnSpan: Math.min(Math.max(slot.columnSpan, 1), 6) as StoryColumnSpan,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          articleData: {
            ...prototypeArticle,
            headline:
              slot.storyNumber === 1
                ? prototypeArticle.headline
                : `${richTextToPlainText(prototypeArticle.headline)} ${slot.storyNumber}`,
            columnCount: Math.min(Math.max(slot.columnSpan, 1), 6),
          },
          compositionSettings: {
            ...initialCompositionSettings,
          },
        }),
      );

      return {
        ...withSyncedDocument(state.document, stories, state.activePageId),
        selectedStoryId: stories[0]?.id ?? null,
        selectedFrameId: findFrameIdForStory(
          updateDocumentPageFromStoryFrames(state.document, stories, state.activePageId),
          state.activePageId,
          stories[0]?.id ?? null,
        ),
        selectedFrameIds: [
          findFrameIdForStory(
            updateDocumentPageFromStoryFrames(state.document, stories, state.activePageId),
            state.activePageId,
            stories[0]?.id ?? null,
          ),
        ].filter((frameId): frameId is NewspaperFrameId => Boolean(frameId)),
        selectedObjectType: "headline",
        selectedObjects: stories[0] ? [{ storyId: stories[0].id, objectType: "headline", bounds: null }] : [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: null,
      };
    }),

  generateFiveStoryLayout: () => get().generateStoryLayout(5),

  importNewswireStories: (category, articles, options) =>
    set((state) => {
      if (articles.length === 0) {
        return {
          placementWarning: "No news articles found for this category",
        };
      }
      const hasAnyNewswireImage = articles.some((a) => Boolean(a.imageUrl));

      // ── Step 1: Classify every incoming article by word count ──────────────
      const classified = classifyArticles(articles);

      // ── Step 2: Build a modular layout calibrated to the article classes ───
      // Assign a column span from each class's default, capped to page columns.
      // The page master's six columns, unless the chosen template states its
      // own. Only the editorial page does — it is traced off a printed sheet
      // set on four — so every news layout resolves to exactly what it did
      // before.
      const pageColumnCount = options?.templateId
        ? getTemplateColumnCount(options.templateId, DEFAULT_PAGE_MASTER.columns)
        : DEFAULT_PAGE_MASTER.columns;
      const classifiedForLayout = classified.map(({ sizeClass }) => {
        const defaultSpan = ARTICLE_SIZE_CLASS_CONFIG[sizeClass].defaultColumnSpan;
        return {
          sizeClass,
          columnSpan: Math.min(defaultSpan, pageColumnCount),
        };
      });

      // Front-page generation starts below the masthead band; inside pages use
      // the full content box exactly as before.
      const layoutBounds = getPageKindContentBounds(options?.pageKind, options?.templateId);

      // An advertisement embedded in a regular page (as opposed to the
      // dedicated, ad-only Advertisement Page tab, which builds its own
      // explicit customLayout) — computed against this exact page kind's own
      // layoutBounds so it's placed and the residual editorial space is
      // carved out consistently with whatever layout would otherwise run
      // here. Only takes effect when the caller didn't already pass an
      // explicit customLayout, so the dedicated Advertisement Page path
      // (which always does) is completely unaffected.
      const pageAdvertisementResult =
        options?.pageAdvertisements?.length && !options?.customLayout
          ? buildPageAdvertisementsLayout(options.pageAdvertisements, layoutBounds, Math.max(1, articles.length))
          : null;
      const resolvedCustomLayout = options?.customLayout ?? pageAdvertisementResult?.customLayout;
      const resolvedCustomStories = pageAdvertisementResult
        ? [
            ...(options?.customStories ?? []),
            ...pageAdvertisementResult.adStoryFrameParamsList.map((params) => createStoryFrame(params)),
          ]
        : options?.customStories;

      const layout = resolvedCustomLayout
        ? resolvedCustomLayout
        : options?.templateId
        ? generateTemplateLayout({
            templateId: options.templateId,
            pageWidth: PAGE_BOUNDS.width,
            contentX: layoutBounds.x,
            contentY: layoutBounds.y,
            contentWidth: layoutBounds.width,
            contentHeight: layoutBounds.height,
            columnCount: pageColumnCount,
            gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
          })
        : generateModularStoryLayout({
            classifiedArticles: classifiedForLayout,
            pageWidth: PAGE_BOUNDS.width,
            contentX: layoutBounds.x,
            contentY: layoutBounds.y,
            contentWidth: layoutBounds.width,
            contentHeight: layoutBounds.height,
            columnCount: pageColumnCount,
            gutter: toPoints(DEFAULT_PAGE_MASTER.gutter),
          });

      const storyNumberOffset = 0; // Replace existing stories entirely.
      const layoutSlots = layout.slots;
      // A nested sidebar (a slot placed inside another slot rather than beside
      // it) has to be carved out of its parent's body, or the two overprint.
      // Collect those rectangles against the parent's story number.
      const insetSlotsByParent = new Map<number, any[]>();
      for (const insetSlot of layoutSlots as any[]) {
        const parentStoryNumber = insetSlot?.insetParentStoryNumber;

        if (typeof parentStoryNumber !== "number") {
          continue;
        }

        insetSlotsByParent.set(parentStoryNumber, [
          ...(insetSlotsByParent.get(parentStoryNumber) ?? []),
          insetSlot,
        ]);
      }
      const languageMode = options.languageMode ?? "hindi";
      const bylineName = options.bylineName?.trim() ?? "";
      const usedNewswireIds = new Set<string>();
      // Route articles by image availability to slot width: a story with no
      // image reads cleanest in a narrow (1-2 col) box that has no room for a
      // photo anyway, while a story WITH an image is wasted there — reserve
      // those for wider (3-6 col) slots where the image actually renders.
      // Two pools, tried before falling back to the full unrestricted pool
      // (so a category with too few image/no-image stories to go around
      // still fills every slot instead of failing).
      const imageArticles = articles.filter((article) => Boolean(article.imageUrl));
      const noImageArticles = articles.filter((article) => !article.imageUrl);

      // ── Step 2.5: Pair the longest available articles with the biggest slots ──
      // A fixed template's slots (generateTemplateLayout) are sized entirely by
      // template design, independent of the articles being imported — pairing
      // `classified[slotIndex]` to `layoutSlots[slotIndex]` by raw feed order (the
      // previous behaviour) meant a naturally short wire brief could land in a
      // tall narrow slot sized for a long story, leaving unavoidable white space
      // no amount of text-fitting/leading-stretch could close (that content
      // simply doesn't exist). Ranking slots by estimated capacity and articles
      // by real word count, then pairing rank-for-rank, ensures the longest
      // article goes to the slot that needs the most words. `preferred` below is
      // still only a preference — the existing fallback chain (used-check,
      // language, image-match, hasMeaningfulLocalizedContent) still applies, so
      // this never forces a mismatched article into a slot it doesn't qualify for.
      const slotCapacityEstimates = layoutSlots.map((slot: any) => {
        if (resolvedCustomLayout) {
          const dummyFrame = createStoryFrame({
            id: "capacity-estimate",
            x: slot.x,
            y: slot.y,
            width: slot.width,
            height: slot.height,
            columnStart: slot.columnStart,
            columnSpan: slot.columnSpan,
            priority: slot.priority,
          });
          return estimateStoryWordCapacity(dummyFrame);
        }
        return slot.width * slot.height;
      });
      const slotRankOrder = slotCapacityEstimates
        .map((estimate, slotIndex) => ({ slotIndex, estimate }))
        .sort((a, b) => b.estimate - a.estimate)
        .map(({ slotIndex }) => slotIndex);
      const articleRankOrder = classified
        .map((entry, articleIndex) => ({ articleIndex, wordCount: entry.wordCount }))
        .sort((a, b) => b.wordCount - a.wordCount)
        .map(({ articleIndex }) => articleIndex);
      const slotToPreferredArticleIndex = new Map<number, number>();

      if (options?.pageKind === "editorial") {
        // The editorial page has already decided what goes where: the caller
        // builds its stories slot by slot, with आज का राशिफल in the slot the
        // template reserves for it. Ranking slots by size and articles by
        // length — right for a news page, where the longest copy should find
        // the biggest hole — shuffles that, and the horoscope ends up wherever
        // its word count happens to rank. Pair them straight through instead.
        layoutSlots.forEach((_: unknown, slotIndex: number) => {
          slotToPreferredArticleIndex.set(slotIndex, slotIndex);
        });
      } else {
        slotRankOrder.forEach((slotIndex, rank) => {
          const articleIndex = articleRankOrder[rank];
          if (articleIndex !== undefined) {
            slotToPreferredArticleIndex.set(slotIndex, articleIndex);
          }
        });

        // A manual box entry from the wizard's split-screen seeder was
        // word-limit-checked against one specific slot's real width — the
        // rank-by-word-count pairing above has no idea that promise was made
        // and can happily send it somewhere else. Force it back to the slot
        // it was written for, after first freeing that slot from whatever the
        // ranking gave it and freeing this article from whichever OTHER slot
        // ranking may have also matched it to, so the mapping stays 1:1
        // regardless of iteration order below.
        //
        // Matched by storyNumber (the "बॉक्स N" label the seeder actually
        // showed the publisher), not the raw array index it was captured
        // with: the seeder computes its box preview against a fixed
        // reference content area, while this real layoutSlots array comes
        // from the page's own real content bounds. When those bounds
        // differ (a taller custom header, different margins), the template
        // layout engine can legitimately return slots in a different array
        // order between the two calls, silently sending a manual entry to
        // the wrong box (the one at the same array position, not the one
        // with the same storyNumber the publisher actually filled in for)
        // even though the code "successfully" forced *some* slot. storyNumber
        // is stable across both calls; falls back to the old array-index
        // field for callers that never set it (e.g. FrameManagerPanel.tsx).
        articles.forEach((article, articleIndex) => {
          if (!article.manualPinned) {
            return;
          }
          const targetStoryNumber = article.manualTargetStoryNumber;
          const targetSlotIndex = typeof targetStoryNumber === "number"
            ? layoutSlots.findIndex((slot: any) => slot.storyNumber === targetStoryNumber)
            : article.manualTargetSlotIndex;
          if (
            typeof targetSlotIndex === "number" &&
            targetSlotIndex >= 0 &&
            targetSlotIndex < layoutSlots.length
          ) {
            for (const [slotIndex, mappedArticleIndex] of slotToPreferredArticleIndex.entries()) {
              if (mappedArticleIndex === articleIndex && slotIndex !== targetSlotIndex) {
                slotToPreferredArticleIndex.delete(slotIndex);
              }
            }
            slotToPreferredArticleIndex.set(targetSlotIndex, articleIndex);
          }
        });
      }

      const frontTopStoryY = Math.min(...layoutSlots.map((slot: any) => Number(slot.y ?? 0)));
      const slotAssignments = layoutSlots.map((slot: any, slotIndex: number) => {
        const language = getSlotLanguage(languageMode, slotIndex);
        let capacity = getClassWordCapacity("M");
        let sizeClass: any = "M";
        let preferred: NewswireStory | undefined;

        if (resolvedCustomLayout) {
          // Rule: Optimistic Word Range Matching for Custom Layouts
          // Provide a dummy StoryFrame to estimate capacity of the layout slot
          const dummyFrame = createStoryFrame({
            id: `dummy-${slotIndex}`,
            x: slot.x,
            y: slot.y,
            width: slot.width,
            height: slot.height,
            columnStart: slot.columnStart,
            columnSpan: slot.columnSpan,
            priority: slot.priority,
          });
          const estimated = estimateStoryWordCapacity(dummyFrame);
          capacity = selectOptimisticNewswireWordTier(estimated);
          const matchedArticleIndex = slotToPreferredArticleIndex.get(slotIndex);
          // A manual-pinned article must only ever land via its own explicit
          // force-target slot (slotToPreferredArticleIndex, set above) --
          // never by coincidentally sharing an array index with a slot it
          // wasn't written for. Manual entries always occupy the first few
          // array indices (see articles = [...manualResult.stories, ...
          // liveStories]), so an earlier, otherwise-unmapped slot could
          // "steal" one meant for a later slot purely by array position --
          // marking it used before its real target's turn came, so that
          // slot found it already used and silently fell back to a wire
          // article instead. Two manual boxes with distinct targets could
          // therefore each correctly compute the right slot and still not
          // end up there.
          const positionalFallback = articles[slotIndex];
          const safePositionalFallback = positionalFallback?.manualPinned ? undefined : positionalFallback;
          preferred = (matchedArticleIndex !== undefined ? articles[matchedArticleIndex] : undefined) ?? safePositionalFallback;
        } else {
          const matchedArticleIndex = slotToPreferredArticleIndex.get(slotIndex);
          const positionalFallback = classified[slotIndex];
          const safePositionalFallback = positionalFallback?.article?.manualPinned ? undefined : positionalFallback;
          const classifiedItem = (matchedArticleIndex !== undefined ? classified[matchedArticleIndex] : undefined) ?? safePositionalFallback;
          sizeClass = classifiedItem?.sizeClass ?? "M";
          capacity = getClassWordCapacity(sizeClass);
          preferred = classifiedItem?.article;
        }

        // Big (4+ col) boxes have real room for a long article — always
        // request the API's largest available word tier (1000 words)
        // instead of trusting a capacity estimate that can undershoot for
        // wide boxes, so there's enough real text to fill the box rather
        // than leaving a blank column at the end.
        // Ask for enough copy to reach the foot of the box.
        //
        // This is the lever that actually closes end-of-box white space. The
        // composer can compress and vertically justify what it is given, but it
        // cannot invent sentences: a box sized for 900 words and handed 500 ends
        // short however it is set. Requesting the longest tier and letting the
        // composer trim at a sentence boundary fills the box instead.
        //
        // Front pages boosted only their 4-column-and-wider boxes, so every
        // narrower box on the page still ran out early — measured at 17.6pt of
        // white against the editorial page's 7.7pt, which boosts from 2 columns
        // up. Both news page kinds now use the same threshold.
        if (
          (options?.pageKind === "front" || options?.pageKind === "inside" || !options?.pageKind) &&
          slot.columnSpan >= NEWS_FILL_MIN_COLUMN_SPAN
        ) {
          capacity = Math.max(capacity, NEWS_FILL_WORD_TIER);
        }

        // Same reasoning on the editorial page, at its own threshold: a
        // two-column box on a five-column sheet is already a large hole, and
        // asking for the largest tier is what stops it running out of copy and
        // leaving white space above its bottom rule.
        //
        // Except when the box hosts nested boxes. The signed comment has the
        // feature and the horoscope sitting in its lower half, so its usable
        // area is roughly the top half of its rectangle — sized off the whole
        // rectangle it was handed about twice the copy it could hold, and the
        // overflow printed straight through the nested feature's headline.
        const hostsNestedBoxes = (insetSlotsByParent.get(slot.storyNumber) ?? []).length > 0;

        if (
          options?.pageKind === "editorial" &&
          slot.columnSpan >= EDITORIAL_FILL_MIN_COLUMN_SPAN &&
          !hostsNestedBoxes
        ) {
          capacity = Math.max(capacity, EDITORIAL_FILL_WORD_TIER);
        }

        // And scale it back for a box that hosts nested children. Capacity is
        // estimated from the box's rectangle, but the signed comment only owns
        // the band above the feature and the horoscope — a little over half its
        // depth. Asked for a full box's worth of copy it overran, and the
        // overflow printed through the nested feature's headline. The fitter
        // only tries tiers at or above the one this implies, so lowering it is
        // what lets a shorter tier be chosen at all.
        if (options?.pageKind === "editorial" && hostsNestedBoxes) {
          capacity = Math.max(
            1,
            Math.round(capacity * EDITORIAL_MIDDLE_BAND_TOP_FRACTION),
          );
        }

        const wantsImage = !resolvedCustomLayout && slot.columnSpan >= 3;
        const isFrontTopStorySlot = isFrontPageTopStorySlot(slot, frontTopStoryY, options);
        const frontTopImagePool = (wantsImage ? imageArticles : noImageArticles).filter(isFrontPageLeadCategoryArticle);
        const frontTopAnyImagePool = articles.filter(isFrontPageLeadCategoryArticle);
        const preferredMatchesFrontTop =
          !isFrontTopStorySlot ||
          (preferred ? isFrontPageLeadCategoryArticle(preferred) : false);
        // The editorial page's stories are chosen per slot before they get
        // here — the desk's leader in the leader's box, the signed comment in
        // the comment's, आज का राशिफल in the box the template reserves for it.
        // Keep them there.
        //
        // The newswire rule below also requires a wide box's story to carry a
        // photograph. The editorial feed ships no images at all, so every box
        // of three columns or more failed that test and was swapped out for a
        // generic newswire article: the comment box printed a sports story with
        // a stadium picture instead of the leader, and the writer's rail came up
        // empty because a newswire story has no editor's summary to print.
        const editorialPinned =
          options?.pageKind === "editorial" &&
          preferred &&
          !usedNewswireIds.has(preferred.id) &&
          hasMeaningfulLocalizedContent(preferred, language, capacity);
        // A publisher-supplied manual article is a guaranteed slot, not a
        // best-effort wire pick — there's no larger pool to fall back to if
        // its own photo doesn't match this slot's usual image convention,
        // so (unlike wire content) that aesthetic preference is skipped for
        // it specifically. Everything else — unused, has real content —
        // still applies.
        const manualPinned =
          preferred?.manualPinned &&
          !usedNewswireIds.has(preferred.id) &&
          hasMeaningfulLocalizedContent(preferred, language, capacity);
        const item = resolvedCustomLayout
          ? preferred
          : editorialPinned || manualPinned
          ? preferred
          : preferredMatchesFrontTop && preferred
            && !usedNewswireIds.has(preferred.id)
            && hasMeaningfulLocalizedContent(preferred, language, capacity)
            && Boolean(preferred.imageUrl) === wantsImage
            ? preferred
            : isFrontTopStorySlot
              ? selectUnusedNewswireArticle(frontTopImagePool, usedNewswireIds, language, capacity)
                ?? selectUnusedNewswireArticle(frontTopAnyImagePool, usedNewswireIds, language, capacity)
                ?? selectUnusedNewswireArticle(wantsImage ? imageArticles : noImageArticles, usedNewswireIds, language, capacity)
                ?? selectUnusedNewswireArticle(articles, usedNewswireIds, language, capacity)
            : selectUnusedNewswireArticle(wantsImage ? imageArticles : noImageArticles, usedNewswireIds, language, capacity)
              ?? selectUnusedNewswireArticle(articles, usedNewswireIds, language, capacity);

        if (!item) {
          throw new Error(getMissingLanguageMessage(languageMode, language));
        }

        usedNewswireIds.add(item.id);

        return {
          item,
          language,
          sizeClass,
          capacity,
        };
      });

      // ── Step 3: Create StoryFrame objects from the layout slots ──────────
      let isPreviousStyled = false;
      let isPreviousStoryTinted = false;
      let previousVisualStyle: StoryVisualStyle | null = null;
      const activeBannerSlots: { y: number; columnStart: number; columnSpan: number; priority: string }[] = [];

      const newStories: StoryFrame[] = layoutSlots.map((slot: any, slotIndex: number) => {
        const assignment = slotAssignments[slotIndex];
        const item = assignment?.item;
        const capacity = assignment?.capacity ?? getClassWordCapacity("M");
        const language = assignment?.language ?? "hindi";

        const isProfessional10A = options?.templateId === "ProfessionalNews10A";
        const imageAllowed = isProfessional10A ? [1, 2, 9].includes(slot.storyNumber) : true;
        // Priority-based image rule (Phase 1.6): very small stories never show
        // images regardless of what the source item has. filler = never.
        // brief = only when the slot is at least 2 columns wide (a 1-col brief
        // box has no room to place both text and photo readably).
        const priorityForbidsImage =
          slot.priority === "filler" ||
          (slot.priority === "brief" && slot.columnSpan < 2);
        // Even when a "brief" (very small) story is otherwise eligible, only
        // let ~20% of them actually carry an image — most tiny boxes read
        // cleaner as text-only, and squeezing a small photo into every one
        // competes with the text for very little payoff. Deterministic per
        // story so the same document always regenerates identically.
        const verySmallImageRoll =
          hashStringToInt(`${item?.id ?? "no-item"}-${storyNumberOffset + slot.storyNumber}-image-roll`) % 100;
        const verySmallImageDenied = slot.priority === "brief" && verySmallImageRoll >= 20;
        // Publisher-exclusive: Youth UPDATE's own "SHORT NEWS" rail (story 3)
        // always carries its fixed section banner -- drawn as a hardcoded
        // overlay (see youthUpdateEditorialRailBox's own pattern in
        // EditorCanvas.tsx), not through this generic photo pipeline, which
        // has no "image caps the box, text starts below it" layout for a
        // single-column box (its headline always sits at a fixed top inset,
        // independent of any image). This flag only reserves the headline's
        // own top padding, below where that overlay paints. Every other
        // template's story 3 (or any story on any other publisher's page)
        // is completely unaffected, since this only fires when both the
        // template id and the slot number match exactly.
        const isYouthUpdateShortNewsSlot =
          isYouthUpdateFrontTemplateId(options?.templateId) && slot.storyNumber === 3;
        // This template is never offered to any other publisher (see
        // CliffFrontYouthUpdate1A's doc comment in TemplateRegistry.ts), so
        // gating purely on templateId here is already publisher-exclusive —
        // no storyNumber check needed like the short-news slot above.
        const isYouthUpdateFrontStory = isYouthUpdateFrontTemplateId(options?.templateId);
        // Same reasoning, for the inside page's own exclusive template --
        // its 7 real story slots pick up the same cyan theme as the front
        // page's stories.
        const isYouthUpdateInsideStory = isYouthUpdateInsideTemplateId(options?.templateId);
        const isAkhandEditorial5A = options?.templateId === AKHAND_EDITORIAL_5A_TEMPLATE_ID;
        const isAkhandVicharManthan6A = options?.templateId === AKHAND_VICHAR_MANTHAN_6A_TEMPLATE_ID;
        const isAkhandVicharManthanImageSlot =
          isAkhandVicharManthan6A && [2, 3, 4, 5, 6].includes(slot.storyNumber);
        const youthUpdateInsideCompactSlot = isYouthUpdateInsideStory && slot.columnSpan <= 2;
        const resolvedImageEnabled = isAkhandEditorial5A || isAkhandVicharManthanImageSlot
          ? true
          : priorityForbidsImage || verySmallImageDenied || youthUpdateInsideCompactSlot
          ? false
          : isProfessional10A
            ? imageAllowed && (Boolean(item?.imageUrl) || hasAnyNewswireImage)
            : item ? Boolean(item.imageUrl) : false;
        let resolvedColumnCount = determineInternalTextColumnCount(slot.width, slot.columnSpan, options?.templateId, Boolean(resolvedCustomLayout));
        // A full-width (6-col) box defaults to whatever its priority's image
        // preset says — often a small, side-aligned thumbnail, which reads
        // as unprofessional next to that much headline/body width. Force a
        // prominent, centred top image instead, with no side wrap (text
        // starts cleanly below it rather than trying to wrap around a
        // centred image, which only makes sense for a side-aligned one).
        const isFullWidthBox = slot.columnSpan >= 6;
        const frontPageTwoColumnImageAlignment =
          options?.pageKind === "front" && slot.columnSpan === 2 && resolvedImageEnabled
            ? hashStringToInt(`${item?.id ?? "no-item"}-${storyNumberOffset + slot.storyNumber}-image-side`) % 2 === 0
              ? ("top-left" as const)
              : ("top-right" as const)
            : null;
        const isFrontPageBottomThreeColumn =
          options?.pageKind === "front" &&
          slot.columnSpan === 3 &&
          slot.y > toPoints(DEFAULT_PAGE_MASTER.height) * 0.6;
        // A box hosting a nested sidebar keeps its full headline measure, but its
        // photo has to stay clear of the sidebar — reservedRegions only steer body
        // text. Pin the image left and cap it to the columns the sidebar leaves.
        const nestedSlots = insetSlotsByParent.get(slot.storyNumber) ?? [];
        const nestedColumnSpan = nestedSlots.reduce(
          (total: number, nested: any) => total + Math.max(1, nested.columnSpan ?? 1),
          0,
        );
        const imageColumnsClearOfNested = Math.max(1, slot.columnSpan - nestedColumnSpan);

        // The writer's rail on a signed editorial comment: portrait, name and a
        // short summary down the left of the box.
        //
        // Resolved here rather than only inside the composition settings because
        // the photograph has to know about it too. With a rail holding the left
        // column, a top-left photo lands directly under the portrait in the same
        // narrow column; page 8 sets it in the top centre instead, with the copy
        // running either side.
        const authorRail =
          options?.pageKind === "editorial"
            ? getAuthorRailReservation({
                x: slot.x,
                y: slot.y,
                width: slot.width,
                height: slot.height,
                columnSpan: slot.columnSpan,
                // Only page 8's two signed pieces carry a rail; the reservation
                // is keyed off the slot, not off whether a name happens to be
                // present.
                storyNumber: slot.storyNumber,
                compositionSettings: {
                  editorialTemplateId: options?.templateId,
                },
              })
            : null;
        // Page 8 sets a signed comment's photograph exactly ONE text column
        // wide, in the middle column of the article portion, with copy running
        // down both sides — measured off the printed sheet, where the picture
        // occupies the column between the two outer text columns.
        //
        // Deliberately not capped by `imageColumnsClearOfNested`: that cap is
        // for a sidebar nested *beside* the box, whereas the editorial
        // template nests its two boxes in a band *below* the comment.
        const editorialImageColumnSpan = Math.max(
          1,
          Math.min(EDITORIAL_IMAGE.columnSpan, slot.columnSpan - 1),
        );

        // A box with a writer's rail is composed on one extra column, so the
        // rail occupies a whole column rather than part of one. See
        // `getEditorialTextColumnCount` — a partial column leaves a sliver that
        // the line breaker fills and the justifier then stretches, which is what
        // strung the comment's copy out into isolated words.
        if (options?.pageKind === "editorial" && isEditorialAuthorSlot(slot.storyNumber, options?.templateId)) {
          resolvedColumnCount =
            isAkhandEditorial5A && slot.storyNumber === 4
              ? Math.max(3, Math.min(slot.columnSpan, 4))
              // Same pixel width as story 2 (both columnStart 2, columnSpan 4),
              // but the printed page sets this one's copy in 3 columns instead
              // of 4 -- the whole reason this template exists. See
              // AKHAND_VICHAR_MANTHAN_6A's doc comment in TemplateRegistry.ts.
              : isAkhandVicharManthan6A && (slot.storyNumber === 2 || slot.storyNumber === 5)
                ? 3
                : getEditorialTextColumnCount(slot.columnSpan);
        }
        if (isYouthUpdateShortNewsSlot) {
          resolvedColumnCount = 1;
        }

        const defaultTypography = getDefaultStoryTypographySettings(slot.priority);
        const isAkhandEditorial5AMiddleBand = isAkhandEditorial5A && slot.storyNumber === 3;
        const isWideShallowNewsBand =
          (options?.pageKind === "front" || options?.pageKind === "inside") &&
          slot.priority !== "lead" &&
          slot.columnSpan >= 4 &&
          slot.height <= 310;

        const baseStory = createStoryFrame({
          id: `story-${storyNumberOffset + slot.storyNumber}`,
          templateStoryNumber: slot.storyNumber,
          role: getRoleFromPriority(slot.priority),
          priority: slot.priority,
          columnStart: Math.min(Math.max(slot.columnStart, 1), 6) as StoryColumnSpan,
          columnSpan: Math.min(Math.max(slot.columnSpan, 1), 6) as StoryColumnSpan,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          ...(isAkhandEditorial5AMiddleBand
            ? {
                headlineFontSize: Math.max(20, defaultTypography.headlineFontSize - 7),
                headlineLineHeight: 0.82,
                headlineLineHeightMode: "percentage" as const,
              }
            : {}),
          ...(isAkhandEditorial5A && slot.storyNumber === 4
            ? {
                headlineFontSize: Math.max(18, defaultTypography.headlineFontSize - 16),
                headlineLineHeight: 0.78,
                headlineLineHeightMode: "percentage" as const,
              }
            : {}),
          ...(isWideShallowNewsBand
            ? {
                headlineFontSize: Math.max(18, defaultTypography.headlineFontSize - 4),
                headlineLineHeight: 0.92,
                headlineLineHeightMode: "percentage" as const,
              }
            : {}),
          ...(isAkhandVicharManthan6A && (slot.storyNumber === 2 || slot.storyNumber === 5)
            ? {
                headlineFontSize: Math.max(
                  18,
                  defaultTypography.headlineFontSize - (slot.storyNumber === 2 ? 16 : 9),
                ),
                headlineLineHeight: slot.storyNumber === 2 ? 0.76 : 0.84,
                headlineLineHeightMode: "percentage" as const,
              }
            : {}),
          bodyFontSize:
            isAkhandEditorial5A
              ? Math.max(8, defaultTypography.bodyFontSize - 0.6)
              : language === "english"
              ? Math.max(8, defaultTypography.bodyFontSize - 1)
              : defaultTypography.bodyFontSize,
          ...(isYouthUpdateInsideStory
            ? {
                bodyLineHeight: 1.25,
                bodyLineHeightMode: "percentage" as const,
              }
            : {}),
          imageEnabled: resolvedImageEnabled,
          // "top" is NOT what we want here — EditorialLayoutQualityEngine's
          // getNewspaperAlignment rewrites it into top-left/top-right by
          // priority (a deliberate, tested behavior for the normal case),
          // which is exactly why this looked unchanged (still left-aligned)
          // last time. "top-center" is a distinct value that engine never
          // rewrites, so it stays genuinely centred.
          ...(isFullWidthBox
            ? { imageAlignment: "top-center" as const, imageColumnSpan: 3, imageWrapMode: "none" as const }
            : {}),
          ...(frontPageTwoColumnImageAlignment
            ? { imageAlignment: frontPageTwoColumnImageAlignment, imageColumnSpan: 1 as StoryColumnSpan }
            : {}),
          ...(isFrontPageBottomThreeColumn && resolvedImageEnabled
            ? { imageAlignment: "top-right" as const, imageColumnSpan: 1 as StoryColumnSpan }
            : {}),
          ...(isYouthUpdateInsideStory && resolvedImageEnabled
            ? {
                imageAlignment: "top-center" as const,
                imageColumnSpan: Math.min(2, slot.columnSpan) as StoryColumnSpan,
                imageHeight: slot.priority === "lead" ? 118 : 86,
                imageHeightMode: "fixed" as const,
                autoSizeImage: false,
                imageWrapMode: "none" as const,
              }
            : {}),
          ...(nestedSlots.length > 0
            ? {
                imageAlignment: "top-left" as const,
                imageColumnSpan: imageColumnsClearOfNested as StoryColumnSpan,
              }
            : {}),
          // Last, so it wins over both rules above: a signed editorial comment
          // sets its photograph in the top centre, clear of the writer's rail.
          // Editorial pages only — every other page keeps the alignment above.
          ...(authorRail
            ? {
                imageAlignment: EDITORIAL_IMAGE.alignment,
                imageColumnSpan: editorialImageColumnSpan as StoryColumnSpan,
                // Held down explicitly: the priority preset sizes a lead box's
                // picture far taller than page 8 prints it, which squeezes the
                // copy into thin bands down either side.
                imageHeight: EDITORIAL_IMAGE.height,
                imageHeightMode: "fixed" as const,
                autoSizeImage: false,
              }
            : {}),
          ...(isAkhandEditorial5A && resolvedImageEnabled
            ? {
                imageAlignment: "top-center" as const,
                imageColumnSpan: Math.min(slot.columnSpan, slot.columnSpan >= 4 ? 2 : 1) as StoryColumnSpan,
                imageHeight:
                  slot.storyNumber === 1
                    ? 210
                    : slot.storyNumber === 2
                      ? 176
                    : slot.storyNumber === 4
                      ? 165
                      : slot.storyNumber === 5
                        ? 156
                      : slot.columnSpan === 1
                        ? 150
                        : 118,
                imageHeightMode: "fixed" as const,
                autoSizeImage: false,
                imageWrapMode: slot.columnSpan >= 4 ? ("rectangular" as const) : ("none" as const),
              }
            : {}),
          // Stories 2 (मुख्य संपादकीय) and 5 (गांधी) mirror AkhandEditorial5A's
          // own story 1 and story 4 exactly -- both are 4-column author-rail
          // boxes there too, and the printed Vichar-Manthan page places its
          // photos the same way theirs does: centred across two of the four
          // columns, not the narrow single-column rail portrait the generic
          // `authorRail` block above would otherwise give them.
          ...(isAkhandVicharManthan6A && (slot.storyNumber === 2 || slot.storyNumber === 5) && resolvedImageEnabled
            ? {
                imageAlignment: "top-center" as const,
                imageColumnSpan: Math.min(slot.columnSpan, 2) as StoryColumnSpan,
                imageHeight: slot.storyNumber === 2 ? 210 : 165,
                imageHeightMode: "fixed" as const,
                autoSizeImage: false,
                imageWrapMode: slot.storyNumber === 2 ? ("none" as const) : ("rectangular" as const),
              }
            : {}),
          // Stories 3 (सुनी सुनाई) and 6 (आध्यात्मिक ज्ञान) each carry one inset
          // photo in their single narrow column; story 4 (नमो घाट + बात मुद्दे
          // की, merged) prints its picture larger since the photo is the
          // box's own lead image, not just an accent. None of these three are
          // author-rail slots, so the `authorRail` block above never fires for
          // them -- sized here instead, same pattern as AkhandEditorial5A's
          // own per-story image block just above.
          ...(isAkhandVicharManthan6A && resolvedImageEnabled && !authorRail
            ? {
                imageAlignment: "top-center" as const,
                imageColumnSpan: Math.min(slot.columnSpan, 1) as StoryColumnSpan,
                imageHeight: slot.storyNumber === 4 ? 170 : 90,
                imageHeightMode: "fixed" as const,
                autoSizeImage: false,
                imageWrapMode: "none" as const,
              }
            : {}),
          articleData: {
            ...prototypeArticle,
            headline: item?.headline ?? `Article ${slot.storyNumber}`,
            columnCount: resolvedColumnCount,
            // Youth UPDATE's "SHORT NEWS" banner is painted as a hardcoded
            // overlay above this box (see youthUpdateShortNewsBanner in
            // EditorCanvas.tsx) -- the headline's own top inset is normally
            // fixed regardless of any image (composeArticleBox.ts places it
            // at `topInset` unconditionally), so pushing it down via its own
            // frame padding is what actually reserves the banner's space,
            // rather than fighting the generic photo pipeline for a
            // "image caps the box" layout it doesn't support on a single
            // narrow column.
            ...(isYouthUpdateShortNewsSlot
              ? {
                  containerStyles: {
                    ...prototypeArticle.containerStyles,
                    headline: {
                      ...prototypeArticle.containerStyles.headline,
                      // Small gap under the banner before the headline starts.
                      framePaddingTop: slot.width * (551 / 1600) + 3,
                    },
                  },
                }
              : {}),
            // Every box on this template's headline sits flush (or near it)
            // against whatever flows under it -- byline, or an inline bullet
            // summary -- because composeArticleBox.ts's default gaps for
            // narrow/badge-kicker boxes are flat and small by design for the
            // boxes they were tuned on. This template's own kicker badges and
            // larger headlines make that read as touching. Scoped to every
            // story here (never any other publisher -- see
            // isYouthUpdateFrontStory above), not just the short-news slot.
            // The inside page's own exclusive template carries the same
            // theme (isYouthUpdateInsideStory).
            ...(isYouthUpdateFrontStory || isYouthUpdateInsideStory ? { headlineToBylineExtraGap: 6 } : {}),
            ...(isAkhandEditorial5A && slot.storyNumber === 4 ? { headlineToBylineExtraGap: 7 } : {}),
            ...(isAkhandVicharManthan6A && slot.storyNumber === 2 ? { headlineToBylineExtraGap: -2 } : {}),
            // This template's kicker label (the part through the colon)
            // matches the page's own cyan theme instead of the standard
            // kicker red. Narrow/badge kickers ignore this field by design
            // (solid white-on-colour), so it only affects the two-toned
            // kicker style.
            ...(isYouthUpdateFrontStory || isYouthUpdateInsideStory
              ? { kickerLabelColor: YOUTH_UPDATE_COLORS.bodyDivider }
              : {}),
          },
          compositionSettings: {
            ...initialCompositionSettings,
            bodyRendererMode: "segmented" as const,
            // Enable fact-box / pull-quote gating based on whether the newswire
            // item actually carries the data — Phase 1 chrome plumbing.
            enableFactBox: Boolean(item?.factBoxRows && item.factBoxRows.length > 0),
            enablePullQuote: Boolean(item?.pullQuoteText),
            ...(options?.pageKind === "front" ? { frontPageStyle: FRONT_PAGE_ARTICLE_STYLE } : {}),
            // Inside pages take the same typography through their own field, so
            // the front page's band geometry stays off. Editorial pages take
            // neither — they have a house style of their own.
            ...(options?.pageKind !== "front" && options?.pageKind !== "editorial"
              ? { insidePageStyle: INSIDE_PAGE_ARTICLE_STYLE }
              : {}),
            ...(isYouthUpdateShortNewsSlot ||
            ((isYouthUpdateFrontStory || isYouthUpdateInsideStory) && language === "english")
              ? {
                  suppressBodySegments: true,
                  nativeBodyJustifyText:
                    (isYouthUpdateFrontStory || isYouthUpdateInsideStory) && language === "english",
                }
              : {}),
            ...(isYouthUpdateInsideStory ? { suppressColumnRules: true } : {}),
            ...(isYouthUpdateFrontStory || isYouthUpdateInsideStory
              ? {
                  englishBodyHyphenation: true,
                  bodyColumnEdgeInsetPt: language === "english" ? 2 : 0,
                  youthUpdateEnglishBodyFontFamily: `"Times New Roman", Times, serif`,
                  // English only: the headline slack model is sized for
                  // Devanagari ink, which leaves a white band under a Latin
                  // headline. Hindi stories on this same page keep the
                  // existing behaviour untouched.
                  reclaimUnusedHeadlineDescender: language === "english",
                  // Both languages: the byline-to-body gap is a grid rounding
                  // artefact, not a script metric, so it is wrong in Hindi too
                  // wherever the image sits on the right.
                  tightBylineToBodyGap: true,
                }
              : {}),
            ...(options?.pageKind === "editorial"
              ? {
                  editorialPageStyle: EDITORIAL_PAGE_ARTICLE_STYLE,
                  editorialTemplateId: options?.templateId,
                  // Editorial pages use a house drop cap on every story box.
                  // The DropCapEngine owns the two-row geometry, so canvas and
                  // PDF export share the same text flow.
                  enableDropCap: true,
                  // No white space at the foot of an editorial box: the copy is
                  // justified down to the bottom rule, as the sub-editor sets it.
                  ...EDITORIAL_FILL_TO_FOOT,
                }
              : {}),
            // No deliberate white at the end of an article, on any news page.
            // The composer otherwise reserves a margin at the foot of EVERY
            // box, which is what left a gap under each story rather than only
            // at the page foot. The editorial page switches it off through
            // EDITORIAL_FILL_TO_FOOT.
            ...(options?.pageKind !== "editorial"
              ? { articleEndBreathingSpaceEnabled: false }
              : {}),
            ...(() => {
              const nested = nestedSlots.map((slot: any) => ({
                x: slot.x,
                y: slot.y,
                width: slot.width,
                height: slot.height,
              }));
              // On an editorial page a signed comment leaves a column free down
              // its left for the writer's rail, so the copy sets beside the
              // portrait rather than running underneath it.
              const regions = authorRail ? [...nested, ...authorRail] : nested;

              return regions.length > 0 ? { reservedRegions: regions } : {};
            })(),
          },
          category,
        });

        if (!item) {
          return baseStory;
        }

        const initialArticleData = createArticleDataFromNewswireStory(
          baseStory,
          item,
          language,
          bylineName,
          options.subheadingStyle,
          capacity,
          options.inlineColumnSubheadings,
          options.inlineSubheadingColor,
        );

        // Prevent subheading background box collisions on adjacent/consecutive stories
        const isAdjacentToActiveBanner = activeBannerSlots.some((prev) => {
          const yDistance = Math.abs(slot.y - prev.y);
          const isHorizontallyAdjacent =
            slot.columnStart === prev.columnStart + prev.columnSpan ||
            prev.columnStart === slot.columnStart + slot.columnSpan ||
            (slot.columnStart <= prev.columnStart + prev.columnSpan &&
              slot.columnStart + slot.columnSpan >= prev.columnStart);

          return yDistance < 180 && isHorizontallyAdjacent;
        });

        let finalSubheadlineBanner = initialArticleData.subheadlineBanner;

        if (isAdjacentToActiveBanner) {
          // Skip subheading background box for adjacent smaller story to prevent colliding boxes
          finalSubheadlineBanner = {
            ...initialArticleData.subheadlineBanner,
            mode: "none",
          };
        } else if ((initialArticleData.subheadlineBanner.backgroundOpacity ?? 1) > 0 && initialArticleData.subheadlineBanner.mode !== "none") {
          activeBannerSlots.push({
            y: slot.y,
            columnStart: slot.columnStart,
            columnSpan: slot.columnSpan,
            priority: slot.priority,
          });
        }

        let finalHeadlineColor: string | undefined;
        const paletteImpliesHeadlineAccent = Boolean(
          options?.palettePreset &&
            options.palettePreset.id !== "classic",
        );
        if ((options?.colouredHeadings || paletteImpliesHeadlineAccent) && item.headline) {
          const applyStyle = shouldApplyEditorialHeadlineStyle(slotIndex, slot.priority, isPreviousStyled);
          if (applyStyle) {
            finalHeadlineColor = options.palettePreset
              ? getPaletteHeadlineAccent(options.palettePreset, slotIndex)
              : options.subheadingStyle.backgroundColor;
            isPreviousStyled = true;
          } else {
            isPreviousStyled = false;
          }
        } else {
          isPreviousStyled = false;
        }

        // Page 8 sets its two signed pieces — सम्पादकीय and विचार मंथन — in the
        // masthead red, and everything else in black. Applied last so it wins
        // over the palette rotation above, which is a news-page device.
        if (
          options?.pageKind === "editorial" &&
          isEditorialAuthorSlot(slot.storyNumber, options?.templateId)
        ) {
          finalHeadlineColor = EDITORIAL_COLOURS.accent;
        }
        if (isAkhandEditorial5A) {
          finalHeadlineColor = AKHAND_EDITORIAL_5A_SLOT_STYLES[slot.storyNumber]?.headline ?? finalHeadlineColor;
        }
        if (isAkhandVicharManthan6A) {
          finalHeadlineColor = AKHAND_VICHAR_MANTHAN_6A_SLOT_STYLES[slot.storyNumber]?.headline ?? finalHeadlineColor;
        }

        let finalContainerStyles = initialArticleData.containerStyles;
        // ── Story visual personality ────────────────────────────────────────
        // Every story gets one of three styles (plain / tinted / boxed). The
        // selector guarantees variety across the page and forbids two adjacent
        // stories sharing the same non-plain treatment. When the wizard's
        // "Tinted Story Background" checkbox is off, we still assign boxed
        // to some stories (plain vs boxed only) so the page has hierarchy
        // contrast even without tint.
        const isLead = slot.priority === "lead";
        let visualStyle = selectStoryVisualStyle({
          slotIndex,
          priority: slot.priority,
          previousStyle: previousVisualStyle,
          isLeadStory: isLead,
        });
        if (!options?.tintedStoryBackground && visualStyle === "tinted") {
          // Wizard tint disabled → downgrade tinted picks to plain
          // (leave boxed picks intact — they don't depend on the tint toggle).
          visualStyle = "plain";
        }

        if (visualStyle === "tinted") {
          const tintSourceColor = options.tintColor || options.subheadingStyle.backgroundColor;
          const tintRgba = convertColorToLightTintRgba(tintSourceColor, 0.25);
          const tintBorderColor = convertColorToTintBorder(tintSourceColor, 0.6);
          finalContainerStyles = normalizeContainerStyles({
            ...initialArticleData.containerStyles,
            article: {
              mode: "frame",
              frameMode: "frame",
              contentHorizontalAlignment: "left",
              contentVerticalAlignment: "top",
              minimumFrameHeight: 0,
              minimumFrameWidth: 0,
              autoFrameHeight: true,
              framePaddingTop: 0,
              framePaddingBottom: 0,
              framePaddingLeft: 0,
              framePaddingRight: 0,
              frameBorderWidth: 0,
              frameBorderColor: "transparent",
              frameBorderStyle: "solid",
              frameBackgroundColor: tintRgba,
              frameRadius: 0,
              frameOpacity: 1,
              containerPaddingTop: 0,
              containerPaddingBottom: 0,
              containerPaddingLeft: 0,
              containerPaddingRight: 0,
              containerBorderRadius: 0,
              containerBorderWidth: 2,
              containerBorderColor: tintBorderColor,
              containerBackgroundColor: tintRgba,
              containerOpacity: 1,
            },
          });
          isPreviousStoryTinted = true;
        } else if (visualStyle === "boxed") {
          // Thin dark hairline border + inner padding. The frame-border fields
          // are model+render supported via `ContainerBackgroundEngine` but no
          // engine ever assigned them before — this is the first "boxed story"
          // treatment in the codebase.
          finalContainerStyles = normalizeContainerStyles({
            ...initialArticleData.containerStyles,
            article: {
              mode: "frame",
              frameMode: "frame",
              contentHorizontalAlignment: "left",
              contentVerticalAlignment: "top",
              minimumFrameHeight: 0,
              minimumFrameWidth: 0,
              autoFrameHeight: true,
              framePaddingTop: BOXED_STYLE_SPEC.framePadding,
              framePaddingBottom: BOXED_STYLE_SPEC.framePadding,
              framePaddingLeft: BOXED_STYLE_SPEC.framePadding,
              framePaddingRight: BOXED_STYLE_SPEC.framePadding,
              frameBorderWidth: BOXED_STYLE_SPEC.frameBorderWidth,
              frameBorderColor: BOXED_STYLE_SPEC.frameBorderColor,
              frameBorderStyle: "solid",
              frameBackgroundColor: "transparent",
              frameRadius: BOXED_STYLE_SPEC.frameRadius,
              frameOpacity: 1,
              containerPaddingTop: 0,
              containerPaddingBottom: 0,
              containerPaddingLeft: 0,
              containerPaddingRight: 0,
              containerBorderRadius: 0,
              containerBorderWidth: 0,
              containerBorderColor: "transparent",
              containerBackgroundColor: "transparent",
              containerOpacity: 1,
            },
          });
          isPreviousStoryTinted = false;
        } else {
          isPreviousStoryTinted = false;
        }
        previousVisualStyle = visualStyle;

        if (isAkhandEditorial5A) {
          const style = AKHAND_EDITORIAL_5A_SLOT_STYLES[slot.storyNumber];
          if (style) {
            finalContainerStyles = normalizeContainerStyles({
              ...initialArticleData.containerStyles,
              article: createAkhandEditorialContainerStyle(style.fill, style.border),
            });
          }
        }
        if (isAkhandVicharManthan6A) {
          const style = AKHAND_VICHAR_MANTHAN_6A_SLOT_STYLES[slot.storyNumber];
          if (style) {
            finalContainerStyles = normalizeContainerStyles({
              ...initialArticleData.containerStyles,
              article: createAkhandEditorialContainerStyle(style.fill, style.border),
            });
          }
        }

        // ── Layout 16 Specific Overrides ────────────────────────────────────
        if (options?.templateId === "Layout16") {
          // 1. Eclips images (rounded corners) for all stories
          baseStory.imageShapeType = "ellipse";

          // 2. Round corner subheading boxes
          if (finalSubheadlineBanner.mode !== "none") {
            finalSubheadlineBanner = {
              ...finalSubheadlineBanner,
              mode: "rounded",
              backgroundOpacity: 1,
              backgroundColor: options.subheadingStyle.backgroundColor,
              textColor: options.subheadingStyle.textColor,
              borderColor: options.subheadingStyle.borderColor,
              borderWidth: 0,
            };
          }

          if (slotIndex === 0) {
            // Top Lead Story: Force Fact Box
            baseStory.compositionSettings.enableFactBox = true;
          } else if (slotIndex === 1) {
            // Side article: Left side text inside image box (contour wrap)
            baseStory.imageAlignment = "left";
            baseStory.imageWrapMode = "contour";
            baseStory.imageColumnSpan = Math.min(2, baseStory.columnSpan);
          } else if (slotIndex >= 4) {
            // Bottom stories: News box ribbons / Kickers
            initialArticleData.kicker.enabled = true;
            initialArticleData.kicker.text = initialArticleData.kicker.text || "SPECIAL REPORT";
            finalContainerStyles = {
              ...finalContainerStyles,
              kicker: {
                ...finalContainerStyles.kicker,
                mode: "frame",
                containerBackgroundColor: options.palettePreset
                  ? getPaletteHeadlineAccent(options.palettePreset, slotIndex)
                  : options.subheadingStyle.backgroundColor,
                containerBorderRadius: 4,
                containerPaddingTop: 4,
                containerPaddingBottom: 4,
                containerPaddingLeft: 8,
                containerPaddingRight: 8,
              },
            };
          }
        }
        // ────────────────────────────────────────────────────────────────────

        let articleData = chooseLayoutFittedNewswireArticleData({
          baseStory,
          item: isYouthUpdateShortNewsSlot ? { ...item, raggedRight: true } : item,
          language,
          bylineName,
          subheadingStyle: options.subheadingStyle,
          initialCapacity: capacity,
          finalSubheadlineBanner,
          finalContainerStyles,
          finalHeadlineColor,
          options,
          typographyTransform:
            (isYouthUpdateFrontStory || isYouthUpdateInsideStory) && language === "english"
              ? applyYouthUpdateEnglishBodyTypography
              : undefined,
        });
        if (isYouthUpdateFrontStory || isYouthUpdateInsideStory) {
          articleData.caption = {
            ...articleData.caption,
            enabled: false,
            text: "",
            creditText: "",
            photographer: "",
            agency: "",
            source: "",
            showCredit: false,
            showSource: false,
          };
        }

        // ── Layout 16 Specific Overrides (Post-Generation) ──────────────────
        if (options?.templateId === "Layout16") {
          if (slotIndex === 0) {
            // Force dummy fact box data if the item didn't have any
            if (articleData.factBox.bullets.length === 0 || typeof articleData.factBox.bullets[0] === "string") {
              articleData.factBoxTheme = {
                name: "custom",
                background: "#4f2b5a",
                border: "#4f2b5a",
                headerColor: "#ffffff",
                bulletColor: "#f4c430",
                textColor: "#ffffff",
              };
              articleData.factBox = {
                headline: "",
                bullets: [
                  {
                    spans: [
                      { text: "1888\n", color: "#fbb847", fontSize: 24, bold: true },
                      { text: "से अब तक की खोज\nयात्राओं को समर्पित है\nयह म्यूजियम।", color: "#ffffff", fontSize: 9 },
                    ]
                  },
                  {
                    spans: [
                      { text: "05\n", color: "#fbb847", fontSize: 24, bold: true },
                      { text: "मुख्य कक्ष हैं जहां\nप्रदर्शनियां चलेंगी", color: "#ffffff", fontSize: 9 },
                    ]
                  },
                  {
                    spans: [
                      { text: "138\n", color: "#fbb847", fontSize: 24, bold: true },
                      { text: "साल पुरानी चीजें हैं\nइस म्यूजियम में।", color: "#ffffff", fontSize: 9 },
                    ]
                  }
                ],
              };
            }
          } else if (slotIndex >= 4) {
            articleData.kicker.enabled = true;
            articleData.kicker.text = articleData.kicker.text || "SPECIAL REPORT";
          }
        }
        // ────────────────────────────────────────────────────────────────────

        // Every Youth UPDATE story's inline bullet markers read cyan
        // (wordmarkLight, the masthead's own cyan), not the shared default
        // near-black -- only when the story didn't already ask for a
        // specific colour of its own, so the badge-kicker override above
        // (and any future explicit per-story colour) still wins.
        if (
          (isYouthUpdateFrontTemplateId(options?.templateId) || isYouthUpdateInsideTemplateId(options?.templateId)) &&
          articleData.inlineSubheadingColor === "#18181b"
        ) {
          articleData.inlineSubheadingColor = YOUTH_UPDATE_COLORS.wordmarkLight;
        }

        if (options?.pageKind === "editorial" && isEditorialAuthorSlot(slot.storyNumber, options?.templateId)) {
          const authorIndex =
            options?.templateId === AKHAND_EDITORIAL_5A_TEMPLATE_ID
              ? slot.storyNumber === 4 ? 1 : 0
              : slot.storyNumber === 2 ? 1 : 0;
          const authorDefaults =
            options.editorialAuthorSelections?.[authorIndex] ??
            options.editorialAuthorDefaults;
          if (authorDefaults?.name) {
            articleData.editorName = authorDefaults.name;
          }
          if (authorDefaults?.imageUrl) {
            articleData.editorPortraitUrl = authorDefaults.imageUrl;
          }
        }

        return {
          ...markStoryDirty(baseStory, {
            textDirty: true,
            compositionDirty: true,
            renderDirty: true,
          }),
          name: item.headline || baseStory.name,
          status: "edited" as StoryFrame["status"],
          articleData,
          contentLanguage: language,
        };
      });

      // ── Narrow-column badge kicker: exactly one per page ───────────────────
      // The pill-on-a-bordered-box treatment is a page accent. Applying it to
      // every eligible narrow story put several competing boxes on one page, so
      // the most prominent eligible story is granted it and the rest fall back
      // to the ordinary kicker. Must mirror composeArticleBox's own narrow test:
      // the badge only renders when the box is narrow enough for the treatment
      // but still wide enough to be allotted kicker words.
      {
        const badgePriorityRank: Record<string, number> = {
          lead: 0,
          major: 1,
          secondary: 2,
          brief: 3,
          filler: 4,
        };
        const pageContentWidthPt = CONTENT_BOUNDS.width;
        const badgeCandidates = newStories.filter((story) => {
          const widthRatio = story.width / pageContentWidthPt;
          const hasKickerText = richTextToPlainText(story.articleData.kicker.text).trim().length > 0;

          return (
            story.articleData.kicker.enabled &&
            hasKickerText &&
            widthRatio >= 0.3 &&
            widthRatio < 0.45 &&
            story.height < 800
          );
        });
        const badgeStory = badgeCandidates.sort((first, second) => {
          const rankDelta =
            (badgePriorityRank[first.priority] ?? 9) - (badgePriorityRank[second.priority] ?? 9);
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return first.y - second.y || first.x - second.x;
        })[0];

        if (badgeStory) {
          badgeStory.articleData.badgeKickerEnabled = true;
          // The badge pill's fill is storyAccentColor (articleData.inline
          // SubheadingColor, falling back to headline/red) -- Youth UPDATE's
          // own bullet points read cyan (wordmarkLight, the same cyan as
          // "UPDATE" in the masthead), not the generic near-black default or
          // bodyDivider's blue (visually distinct from true cyan despite the
          // name this line used to reuse it under).
          if (
            isYouthUpdateFrontTemplateId(options?.templateId) ||
            isYouthUpdateInsideTemplateId(options?.templateId)
          ) {
            badgeStory.articleData.inlineSubheadingColor = YOUTH_UPDATE_COLORS.wordmarkLight;
          }
        }
      }

      // ── Youth UPDATE inside page: "SHORT NEWS" rail content ────────────────
      // The wizard's catalogue entry for this template requests more articles
      // (storyCount: 10) than the template has real slots (7) specifically so
      // there is a real leftover pool here. articleRankOrder ranks every
      // fetched article longest-to-shortest; slotRankOrder only consumes the
      // first `layoutSlots.length` of that ranking (the longest, matched to
      // the biggest slots -- see Step 2.5 above), so
      // articleRankOrder.slice(layoutSlots.length) is exactly the shortest
      // leftover articles, unused by any real slot -- naturally right for a
      // "SHORT NEWS" rail. Populated fresh on every generation; not gated
      // behind a used/unused check the way slot assignment is, since a
      // repeat here is harmless page furniture, not a duplicated composed
      // story.
      if (isYouthUpdateInsideTemplateId(options?.templateId) && !isYouthUpdateHeaderOnlyInsideTemplateId(options?.templateId)) {
        const getRailBodyText = (article: NewswireStory) =>
          article.longBody || article.body || article.mediumBody || article.shortBody || "";
        const getWordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
        const railWordTarget = 165;
        const railMinimumWords = 135;
        const assignedArticleSet = new Set(slotAssignments.map((assignment: any) => assignment.item as NewswireStory));
        const railCandidates = articles
          .filter((article) => !assignedArticleSet.has(article))
          .map((article) => {
            const body = getRailBodyText(article);
            const wordCount = getWordCount(body);
            return { article, body, wordCount };
          })
          .filter(({ wordCount }) => wordCount >= railMinimumWords)
          .sort((a, b) => {
            const aPenalty = a.wordCount < railWordTarget ? (railWordTarget - a.wordCount) * 2 : a.wordCount - railWordTarget;
            const bPenalty = b.wordCount < railWordTarget ? (railWordTarget - b.wordCount) * 2 : b.wordCount - railWordTarget;
            return aPenalty - bPenalty;
          });
        const leftoverArticles = articleRankOrder
          .slice(layoutSlots.length)
          .map((articleIndex) => articles[articleIndex])
          .filter((article): article is NewswireStory => Boolean(article));
        // Split the leftover pool so the rail and the teaser-strip cards
        // below never show the same article: the rail's own render caps at
        // 3 boxes regardless of how many items this store holds, so the
        // first 3 go there and the *next* 2 (not reused) go to the teaser
        // cards. The wizard catalogue's storyCount was raised specifically
        // to keep both pools non-empty (see GenerationWizardModal.tsx).
        const railArticles = [
          ...railCandidates.map(({ article }) => article),
          ...leftoverArticles,
        ].filter((article, index, list) => list.indexOf(article) === index).slice(0, 3);
        const railArticleSet = new Set(railArticles);
        const teaserArticles = leftoverArticles.filter((article) => !railArticleSet.has(article)).slice(0, 2);
        useYouthUpdateInsideRailStore.getState().setItems(
          railArticles.map((article) => ({
            // Same narrow single-column rule used elsewhere: the third
            // summary bullet the API sends (article.summary) reads as a
            // punchier "headline" for a small box than the full original
            // headline, which is what usually overran a 2-line cap. Falls
            // back to the real headline when a third bullet isn't there.
            headline: article.summary?.[2] || article.headline,
            // Prefer the longer body tiers so the fixed-height box actually
            // fills instead of leaving a run of white space under a short
            // excerpt -- measureParagraph's own maxHeight still clips it to
            // the box, so this never overflows.
            body: getRailBodyText(article),
          })),
        );
        useYouthUpdateInsideTeaserLiveStore.getState().setItems(
          teaserArticles.map((article) => ({
            imageUrl: article.imageUrl || "",
            // Same third-summary-bullet convention as the rail's own title,
            // for the same reason: punchier and shorter than the real
            // headline in a small card.
            title: article.summary?.[2] || article.headline,
            // Shortest tier first here (unlike the rail) -- this card's body
            // column is much narrower than the rail's, so even the "short"
            // tier reads as plenty of copy; ellipsis still clips it to
            // whatever the card actually has room for.
            body: article.shortBody || article.mediumBody || article.body || article.longBody || "",
          })),
        );
      }

      // ── Step 4: Register image assets ──────────────────────────────────────
      const assignedArticles = slotAssignments.map((assignment: any) => assignment.item as NewswireStory);
      const reserveAkhandEditorialImageFields =
        options?.templateId === AKHAND_EDITORIAL_5A_TEMPLATE_ID ||
        options?.templateId === AKHAND_VICHAR_MANTHAN_6A_TEMPLATE_ID;
      const fallbackImageUrl = reserveAkhandEditorialImageFields
        ? ""
        : assignedArticles.find((a: NewswireStory) => a.imageUrl)?.imageUrl ?? "";
      const effectiveImageUrls = assignedArticles.map((a: NewswireStory, index: number) =>
        a.imageUrl ||
        (reserveAkhandEditorialImageFields && newStories[index]?.imageEnabled
          ? AKHAND_EDITORIAL_IMAGE_PLACEHOLDER_URL
          : fallbackImageUrl),
      );
      const imageAssets = assignedArticles
        .map((item: NewswireStory, index: number) => createNewswireImageAsset(item, index, effectiveImageUrls[index]))
        .filter((asset): asset is NewspaperAsset => Boolean(asset));
      const assetIdsByUrl = new Map(
        [
          ...Object.values(state.document.assets),
          ...imageAssets,
        ]
          .filter((asset: any) => asset.source)
          .map((asset: any) => [asset.source as string, asset.id]),
      );

      if (resolvedCustomStories) {
        newStories.push(...resolvedCustomStories);
        // Create synthetic assets for custom stories (Ads)
        resolvedCustomStories.forEach((story: StoryFrame, idx: number) => {
          const adData = story.articleData as any;
          effectiveImageUrls.push(adData.imageUrl || "");
          if (adData.imageUrl) {
            const syntheticAsset = {
              id: `asset-custom-${Date.now()}-${idx}`,
              type: "image" as const,
              source: adData.imageUrl,
              name: `Custom Ad ${idx + 1}`,
              width: story.width,
              height: story.height,
              aspectRatio: story.width / Math.max(1, story.height),
              createdAt: new Date().toISOString(),
            };
            imageAssets.push(syntheticAsset);
            assetIdsByUrl.set(adData.imageUrl, syntheticAsset.id);
            adData.photo = syntheticAsset.id;
          }
        });
      }

      const importCount = newStories.length;

      const syncedDocument = updateDocumentPageFromStoryFrames(
        {
          ...state.document,
          assets: {
            ...state.document.assets,
            ...Object.fromEntries(imageAssets.map((asset) => [asset.id, asset])),
          },
        },
        newStories,
        state.activePageId,
      );
      const nextDocument = {
        ...syncedDocument,
        settings: {
          ...syncedDocument.settings,
          languageMode,
          bylineName,
        },
        stories: Object.fromEntries(
          Object.entries(syncedDocument.stories).map(([storyId, storyObject]) => {
            const storyIndex = newStories.findIndex((story) => story.id === storyId);
            const storyFrame = storyIndex >= 0 ? newStories[storyIndex] : null;
            const imageUrl = (storyIndex >= 0 && storyFrame?.imageEnabled) ? effectiveImageUrls[storyIndex] : "";
            const assetId = imageUrl ? assetIdsByUrl.get(imageUrl) ?? null : null;
            const hasValidImage = Boolean(assetId);
            const allowReservedImageFrame =
              options?.templateId === AKHAND_EDITORIAL_5A_TEMPLATE_ID &&
              Boolean(storyFrame?.imageEnabled);

            return [
              storyId,
              {
                ...storyObject,
                role: (storyFrame as any)?.role ?? (storyObject as any).role,
                photo: assetId,
                imageSettings: {
                  ...storyObject.imageSettings,
                  ...(storyFrame
                    ? {
                        imageAlignment: storyFrame.imageAlignment,
                        imageColumnSpan: storyFrame.imageColumnSpan,
                        imageHeightMode: storyFrame.imageHeightMode,
                        imageHeight: storyFrame.imageHeight,
                        autoSizeImage: storyFrame.autoSizeImage,
                      }
                    : {}),
                  imageEnabled: (hasValidImage || allowReservedImageFrame) && storyObject.imageSettings.imageEnabled,
                },
              },
            ];
          }),
        ),
        pages: syncedDocument.pages.map((page) =>
          page.id === state.activePageId
            ? {
                ...page,
                photos: [
                  ...new Set([
                    ...page.photos,
                    ...assignedArticles
                      .slice(0, importCount)
                      .map((_, index) => (effectiveImageUrls[index] && newStories[index]?.imageEnabled) ? assetIdsByUrl.get(effectiveImageUrls[index]) : null)
                      .filter((assetId): assetId is NewspaperAssetId => Boolean(assetId)),
                  ]),
                ],
              }
            : page,
        ),
      };
      const selectedStoryId = newStories[0]?.id ?? null;
      const selectedFrameId = findFrameIdForStory(nextDocument, state.activePageId, selectedStoryId);
      // Retype the page so the canvas draws the right header band. Regenerating
      // a front-typed page from any non-front tab has to drop it back to an
      // inside type, otherwise the page would keep the 6.1cm masthead while its
      // stories are laid out from the inside-page content box and collide with
      // it. Non-front section types (sports, editorial, …) are left alone.
      const activePageType = state.document.pages.find(
        (page) => page.id === state.activePageId,
      )?.pageType;
      const nextPageType: PageType | null =
        options?.pageKind === "front"
          ? "front"
          // A page built from the Editorial tab is typed as one. Without this it
          // kept whatever section it had, and the page-level furniture that asks
          // "is this the editorial page?" — the folio strip's अभिव्यक्ति and
          // dateline — never fired.
          : options?.pageKind === "editorial"
            ? "editorial"
            : activePageType === "front"
              ? "city"
              : null;
      const typedDocument = nextPageType
        ? updatePageProperties(nextDocument, state.activePageId, { pageType: nextPageType })
        : nextDocument;
      const importMessage =
        options?.pageKind === "editorial"
          ? `Loaded ${importCount} Editorial stor${importCount === 1 ? "y" : "ies"}`
          : `Loaded ${importCount} ${category} article${importCount === 1 ? "" : "s"} (${classified.map((c) => c.sizeClass).join(", ")})`;

      return {
        stories: newStories,
        document: typedDocument,
        ...(nextPageType ? { pageType: nextPageType } : {}),
        selectedStoryId,
        selectedFrameId,
        selectedFrameIds: selectedFrameId ? [selectedFrameId] : [],
        selectedObjectType: "headline",
        selectedObjects: selectedStoryId ? [{ storyId: selectedStoryId, objectType: "headline", bounds: null }] : [],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: importMessage,
      };
    }),

  replaceStoryArticleFromNewswire: (storyId, article, options) =>
    set((state) => {
      const story = state.stories.find((candidate) => candidate.id === storyId);

      if (!story) {
        return { placementWarning: "Story box not found" };
      }

      if (story.locked) {
        return { placementWarning: "Locked story cannot be replaced" };
      }

      const languageMode = options.languageMode ?? state.document.settings.languageMode ?? "hindi";
      const language = story.contentLanguage ?? (languageMode === "english" ? "english" : "hindi");
      const bylineName = options.bylineName?.trim() ?? state.document.settings.bylineName ?? "";
      const capacity =
        options.pageKind === "editorial" && story.columnSpan >= EDITORIAL_FILL_MIN_COLUMN_SPAN
          ? Math.max(estimateStoryWordCapacity(story), EDITORIAL_FILL_WORD_TIER)
          : estimateStoryWordCapacity(story);

      let articleData: ArticleData;

      try {
        articleData = chooseLayoutFittedNewswireArticleData({
          baseStory: story,
          item: article,
          language,
          bylineName,
          subheadingStyle: options.subheadingStyle,
          initialCapacity: capacity,
          finalSubheadlineBanner: story.articleData.subheadlineBanner,
          finalContainerStyles: story.articleData.containerStyles,
          finalHeadlineColor: story.articleData.headlineColor,
          options,
          typographyTransform:
            options.templateId && isYouthUpdateInsideTemplateId(options.templateId)
              ? applyYouthUpdateEnglishBodyTypography
              : undefined,
        });
      } catch (error) {
        return {
          placementWarning: error instanceof Error ? error.message : "Replacement article could not fit this box",
        };
      }

      const previousStoryObjects = state.document.stories;
      const previousSelectedStoryObject = previousStoryObjects[storyId];
      const previousSelectedPhotoAsset = previousSelectedStoryObject?.photo
        ? state.document.assets[previousSelectedStoryObject.photo]
        : null;
      const replacementImageUrl = article.imageUrl?.trim() ?? "";
      const previousSelectedPhotoUrl =
        previousSelectedPhotoAsset?.source ??
        previousSelectedPhotoAsset?.previewUrl ??
        previousSelectedPhotoAsset?.thumbnailUrl ??
        "";
      const replacementUsesNewImage = Boolean(
        replacementImageUrl && replacementImageUrl !== previousSelectedPhotoUrl,
      );
      const existingAsset = replacementImageUrl
        ? Object.values(state.document.assets).find((asset) =>
            asset.source === replacementImageUrl ||
            asset.previewUrl === replacementImageUrl ||
            asset.thumbnailUrl === replacementImageUrl,
          )
        : null;
      const imageAsset = story.imageEnabled && replacementImageUrl && !existingAsset
        ? createNewswireImageAsset(
            article,
            state.stories.findIndex((candidate) => candidate.id === storyId),
            replacementImageUrl,
          )
        : null;
      const assetId = replacementImageUrl
        ? existingAsset?.id ?? imageAsset?.id ?? previousSelectedStoryObject?.photo ?? null
        : previousSelectedStoryObject?.photo ?? null;
      const nextStories = updateStory(state.stories, storyId, (currentStory) =>
        markStoryDirty(
          {
            ...currentStory,
            name: article.headline || currentStory.name,
            category: article.category || currentStory.category,
            status: "edited",
            contentLanguage: language,
            articleData,
          },
          {
            textDirty: true,
            compositionDirty: true,
            renderDirty: true,
          },
        ),
      );
      const synced = withSyncedDocument(
        {
          ...state.document,
          assets: imageAsset
            ? {
                ...state.document.assets,
                [imageAsset.id]: imageAsset,
              }
            : state.document.assets,
        },
        nextStories,
        state.activePageId,
      );
      const nextStoryObject = synced.document.stories[storyId];
      const restoredStoryObjects = Object.fromEntries(
        Object.entries(synced.document.stories).map(([currentStoryId, storyObject]) => {
          const previousStoryObject = previousStoryObjects[currentStoryId];

          if (!previousStoryObject) {
            return [currentStoryId, storyObject];
          }

          if (currentStoryId !== storyId) {
            return [
              currentStoryId,
              {
                ...storyObject,
                photo: previousStoryObject.photo,
                imageSettings: previousStoryObject.imageSettings,
              },
            ];
          }

          return [
            currentStoryId,
            {
              ...storyObject,
              photo: assetId,
              imageSettings: replacementUsesNewImage
                ? {
                    ...storyObject.imageSettings,
                    imageEnabled: Boolean(assetId) && storyObject.imageSettings.imageEnabled,
                  }
                : previousStoryObject.imageSettings,
            },
          ];
        }),
      );
      const nextDocument = {
        ...synced.document,
        stories: restoredStoryObjects,
        pages: synced.document.pages.map((page) =>
          page.id === state.activePageId && assetId
            ? {
                ...page,
                photos: [...new Set([...page.photos, assetId])],
              }
            : page,
        ),
      };
      const selectedFrameId = findFrameIdForStory(nextDocument, state.activePageId, storyId);

      return {
        stories: nextStories,
        document: nextDocument,
        selectedStoryId: storyId,
        selectedFrameId,
        selectedFrameIds: selectedFrameId ? [selectedFrameId] : [],
        selectedObjectType: "headline",
        selectedObjects: [{ storyId, objectType: "headline", bounds: null }],
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
        placementWarning: "Story article replaced",
      };
    }),


  clearPlacementWarning: () => set({ placementWarning: null }),

  selectStory: (storyId, additive = false) =>
    set((state) => {
      const frameId = findFrameIdForStory(state.document, state.activePageId, storyId);
      const selectedFrameIds = additive
        ? frameId
          ? state.selectedFrameIds.includes(frameId)
            ? state.selectedFrameIds.filter((selectedId) => selectedId !== frameId)
            : [...state.selectedFrameIds, frameId]
          : state.selectedFrameIds
        : [frameId].filter((selectedId): selectedId is NewspaperFrameId => Boolean(selectedId));
      const storyIds = getStoryIdsFromFrameIds(state.document, selectedFrameIds);
      const selectedStoryId = storyIds.at(-1) ?? (additive ? state.selectedStoryId : storyId);

      return {
        selectedStoryId,
        selectedFrameId: selectedFrameIds.at(-1) ?? null,
        selectedFrameIds,
        selectedObjectType: "headline",
        selectedObjects: storyIds.map((selectedId) => ({ storyId: selectedId, objectType: "headline" as const, bounds: null })),
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
      };
    }),

  selectStories: (storyIds) =>
    set((state) => {
      const selectedFrameIds = getSelectionFrameIds(state.document, state.activePageId, storyIds);
      const selectedStoryId = storyIds.at(-1) ?? null;

      return {
        selectedStoryId,
        selectedFrameId: selectedFrameIds.at(-1) ?? null,
        selectedFrameIds,
        selectedObjectType: "headline",
        selectedObjects: storyIds.map((storyId) => ({ storyId, objectType: "headline" as const, bounds: null })),
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
      };
    }),

  selectStoriesInRect: (bounds, additive = false) =>
    set((state) => {
      const containedIds = state.stories
        .filter((story) => !story.hidden && rectContains(bounds, story))
        .map((story) => story.id);
      const currentIds = additive ? getSelectedStoryIds(state) : [];
      const storyIds = [...new Set([...currentIds, ...containedIds])].sort();
      const selectedFrameIds = getSelectionFrameIds(state.document, state.activePageId, storyIds);

      return {
        selectedStoryId: storyIds.at(-1) ?? null,
        selectedFrameId: selectedFrameIds.at(-1) ?? null,
        selectedFrameIds,
        selectedObjectType: "headline",
        selectedObjects: storyIds.map((storyId) => ({ storyId, objectType: "headline" as const, bounds: null })),
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: bounds,
      };
    }),

  selectAllStories: () =>
    set((state) => {
      const storyIds = state.stories.filter((story) => !story.hidden).map((story) => story.id).sort();
      const selectedFrameIds = getSelectionFrameIds(state.document, state.activePageId, storyIds);

      return {
        selectedStoryId: storyIds.at(-1) ?? null,
        selectedFrameId: selectedFrameIds.at(-1) ?? null,
        selectedFrameIds,
        selectedObjectType: "headline",
        selectedObjects: storyIds.map((storyId) => ({ storyId, objectType: "headline" as const, bounds: null })),
        selectedRichTextRange: null,
        editingMode: "none",
        caretPosition: null,
        selectionBounds: null,
      };
    }),

  selectObject: (storyId, objectType, selectionBounds = null, additive = false) =>
    set((state) => {
      const nextObject = { storyId, objectType, bounds: selectionBounds };
      const selectedObjects = additive
        ? state.selectedObjects.some(
            (selected) => selected.storyId === storyId && selected.objectType === objectType,
          )
          ? state.selectedObjects.filter(
              (selected) => !(selected.storyId === storyId && selected.objectType === objectType),
            )
          : [...state.selectedObjects, nextObject]
        : [nextObject];

      return {
        selectedStoryId: storyId,
        selectedFrameId: findFrameIdForStory(state.document, state.activePageId, storyId),
        selectedFrameIds: [findFrameIdForStory(state.document, state.activePageId, storyId)].filter(
          (frameId): frameId is NewspaperFrameId => Boolean(frameId),
        ),
        selectedObjectType: objectType,
        selectedObjects,
        selectedRichTextRange: null,
        selectedParagraphIndex: objectType === "body" ? state.selectedParagraphIndex : 0,
        typographyEditingScope: objectType === "body" ? state.typographyEditingScope : "story",
        editingMode: "none",
        caretPosition: null,
        selectionBounds,
      };
    }),

  setSelectedObjectType: (objectType) =>
    set((state) => ({
      selectedObjectType: objectType,
      selectedObjects: state.selectedStoryId
        ? [{ storyId: state.selectedStoryId, objectType, bounds: null }]
        : [],
      selectedRichTextRange: null,
      selectedParagraphIndex: objectType === "body" ? state.selectedParagraphIndex : 0,
      typographyEditingScope: objectType === "body" ? state.typographyEditingScope : "story",
      editingMode: "none",
      caretPosition: null,
      selectionBounds: null,
    })),

  setSelectedRichTextRange: (range) => set({ selectedRichTextRange: range }),

  setSelectedParagraphIndex: (index) =>
    set({
      selectedParagraphIndex: Math.max(0, Math.floor(index)),
      selectedObjectType: "body",
      typographyEditingScope: "paragraph",
    }),

  setTypographyEditingScope: (scope) => set({ typographyEditingScope: scope }),

  setEditingMode: (mode) => set({ editingMode: mode }),

  setCaretPosition: (position) => set({ caretPosition: position }),

  clearSelection: () =>
    set({
      selectedStoryId: null,
      selectedFrameId: null,
      selectedFrameIds: [],
      selectedObjects: [],
      selectedRichTextRange: null,
      editingMode: "none",
      caretPosition: null,
      selectionBounds: null,
    }),

  moveSelectedStories: (delta) =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const rects = Object.fromEntries(
        state.stories
          .filter((story) => storyIds.includes(story.id) && !story.locked)
          .map((story) => [
            story.id,
            normalizeStoryGeometry({
              ...story,
              x: story.x + delta.x,
              y: story.y + delta.y,
            }),
          ]),
      );

      return commitMultiStoryGeometry({ state, operation: "move-story", rects });
    }),

  resizeSelectedStoriesUniform: (scale) =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const selectedStories = state.stories.filter((story) => storyIds.includes(story.id) && !story.locked);

      if (selectedStories.length === 0) {
        return { placementWarning: "No selected stories" };
      }

      const bounds = getSelectionBounds(selectedStories);
      const factor = Math.max(0.05, scale);
      const rects = Object.fromEntries(
        selectedStories.map((story) => {
          const relativeX = story.x - bounds.x;
          const relativeY = story.y - bounds.y;

          return [
            story.id,
            normalizeStoryGeometry({
              x: bounds.x + relativeX * factor,
              y: bounds.y + relativeY * factor,
              width: story.width * factor,
              height: story.height * factor,
            }),
          ];
        }),
      );

      return commitMultiStoryGeometry({ state, operation: "resize-story", rects });
    }),

  deleteSelectedStories: () =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const deletableIds = storyIds.filter((storyId) => {
        const story = state.stories.find((item) => item.id === storyId);

        return story && !story.locked;
      });

      if (deletableIds.length === 0 || state.stories.length - deletableIds.length < 1) {
        return { placementWarning: "Selected stories cannot be deleted" };
      }

      multiSelectionSessionManager.begin({
        pageId: state.activePageId,
        operation: "delete-story",
        beforePageSnapshot: createGeometrySnapshot(state.stories),
      });
      const nextStories = state.stories.filter((story) => !deletableIds.includes(story.id));
      const nextDocument = updateDocumentPageFromStoryFrames(state.document, nextStories, state.activePageId);
      const sessionResult = multiSelectionSessionManager.commit({
        afterPageSnapshot: createGeometrySnapshot(nextStories),
        commitTimeMs: 0,
      });

      return {
        stories: nextStories,
        document: nextDocument,
        selectedStoryId: nextStories[0]?.id ?? null,
        selectedFrameId: nextStories[0] ? findFrameIdForStory(nextDocument, state.activePageId, nextStories[0].id) : null,
        selectedFrameIds: nextStories[0]
          ? [findFrameIdForStory(nextDocument, state.activePageId, nextStories[0].id)].filter((frameId): frameId is NewspaperFrameId => Boolean(frameId))
          : [],
        selectedObjects: nextStories[0] ? [{ storyId: nextStories[0].id, objectType: "headline" as const, bounds: null }] : [],
        liveResizePreviewDrawCommands: [],
        placementWarning: sessionResult.transaction ? null : "Delete transaction was not recorded",
      };
    }),

  setSelectedStoriesLocked: (locked) =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const nextStories = state.stories.map((story) =>
        storyIds.includes(story.id)
          ? {
              ...story,
              locked,
              dirtyFlags: mergeDirtyFlags(story.dirtyFlags, { renderDirty: true }),
            }
          : story,
      );

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  duplicateSelectedStories: () =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const selectedStories = state.stories.filter((story) => storyIds.includes(story.id));
      const copies = selectedStories.map((story, index) =>
        cloneStoryWithOffset(story, `${story.id}-copy-${Date.now().toString(36)}-${index}`, 24),
      );
      const nextStories = [...state.stories, ...copies];
      const document = updateDocumentPageFromStoryFrames(state.document, nextStories, state.activePageId);
      const copyIds = copies.map((story) => story.id);

      multiSelectionSessionManager.begin({
        pageId: state.activePageId,
        operation: "insert-story",
        beforePageSnapshot: createGeometrySnapshot(state.stories),
      });
      multiSelectionSessionManager.commit({
        afterPageSnapshot: createGeometrySnapshot(nextStories),
        commitTimeMs: 0,
      });

      return {
        stories: nextStories,
        document,
        selectedStoryId: copyIds.at(-1) ?? state.selectedStoryId,
        selectedFrameIds: getSelectionFrameIds(document, state.activePageId, copyIds),
        selectedObjects: copyIds.map((storyId) => ({ storyId, objectType: "headline" as const, bounds: null })),
        placementWarning: null,
      };
    }),

  groupSelectedStories: () =>
    set((state) => ({
      document: groupFrames(state.document, getSelectionFrameIds(state.document, state.activePageId, getSelectedStoryIds(state))),
      placementWarning: null,
    })),

  ungroupSelectedStories: () =>
    set((state) => ({
      document: ungroupFrames(state.document, getSelectionFrameIds(state.document, state.activePageId, getSelectedStoryIds(state))),
      placementWarning: null,
    })),

  alignSelectedStories: (alignment) =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const selectedStories = state.stories.filter((story) => storyIds.includes(story.id) && !story.locked);

      if (selectedStories.length < 2) {
        return { placementWarning: "Select at least two stories to align" };
      }

      const bounds = getSelectionBounds(selectedStories);
      const rects = Object.fromEntries(
        selectedStories.map((story) => {
          const next = { x: story.x, y: story.y, width: story.width, height: story.height };

          if (alignment === "left") next.x = bounds.x;
          if (alignment === "right") next.x = bounds.x + bounds.width - story.width;
          if (alignment === "top") next.y = bounds.y;
          if (alignment === "bottom") next.y = bounds.y + bounds.height - story.height;
          if (alignment === "center-horizontal") next.x = bounds.x + (bounds.width - story.width) / 2;
          if (alignment === "center-vertical") next.y = bounds.y + (bounds.height - story.height) / 2;

          return [story.id, normalizeStoryGeometry(next)];
        }),
      );

      return commitMultiStoryGeometry({ state, operation: "move-story", rects });
    }),

  distributeSelectedStories: (distribution) =>
    set((state) => {
      const storyIds = getSelectedStoryIds(state);
      const selectedStories = state.stories.filter((story) => storyIds.includes(story.id) && !story.locked);

      if (selectedStories.length < 2) {
        return { placementWarning: "Select at least two stories to distribute" };
      }

      const bounds = getSelectionBounds(selectedStories);
      const horizontal = [...selectedStories].sort((first, second) => first.x - second.x || first.id.localeCompare(second.id));
      const vertical = [...selectedStories].sort((first, second) => first.y - second.y || first.id.localeCompare(second.id));
      const largestWidth = Math.max(...selectedStories.map((story) => story.width));
      const largestHeight = Math.max(...selectedStories.map((story) => story.height));
      const smallestWidth = Math.min(...selectedStories.map((story) => story.width));
      const smallestHeight = Math.min(...selectedStories.map((story) => story.height));
      const legalLargestHeight = Math.min(
        largestHeight,
        ...selectedStories.map((story) => normalizeStoryGeometry({ ...story, height: largestHeight }).height),
      );
      const rects: Record<string, ArticleBoxModel> = {};

      if (distribution === "horizontal-spacing") {
        const totalWidth = horizontal.reduce((sum, story) => sum + story.width, 0);
        const gap = horizontal.length > 1 ? (bounds.width - totalWidth) / (horizontal.length - 1) : 0;
        let x = bounds.x;
        for (const story of horizontal) {
          rects[story.id] = normalizeStoryGeometry({ ...story, x });
          x += story.width + gap;
        }
      } else if (distribution === "vertical-spacing") {
        const totalHeight = vertical.reduce((sum, story) => sum + story.height, 0);
        const gap = vertical.length > 1 ? (bounds.height - totalHeight) / (vertical.length - 1) : 0;
        let y = bounds.y;
        for (const story of vertical) {
          rects[story.id] = normalizeStoryGeometry({ ...story, y });
          y += story.height + gap;
        }
      } else {
        for (const story of selectedStories) {
          rects[story.id] = normalizeStoryGeometry({
            ...story,
            width: distribution === "equal-width" || distribution === "match-largest"
              ? largestWidth
              : distribution === "match-smallest"
                ? smallestWidth
                : story.width,
            height: distribution === "equal-height" || distribution === "match-largest"
              ? legalLargestHeight
              : distribution === "match-smallest"
                ? smallestHeight
                : story.height,
          });
        }
      }

      return commitMultiStoryGeometry({ state, operation: distribution.includes("spacing") ? "move-story" : "resize-story", rects });
    }),

  undoMultiSelectionOperation: () =>
    set((state) => {
      const transaction = multiSelectionSessionManager.undo();

      if (!transaction) {
        return { placementWarning: "Nothing to undo" };
      }

      const nextStories = state.stories.map((story) => ({
        ...story,
        ...(transaction.beforeGeometry[story.id] ?? {}),
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  redoMultiSelectionOperation: () =>
    set((state) => {
      const transaction = multiSelectionSessionManager.redo();

      if (!transaction) {
        return { placementWarning: "Nothing to redo" };
      }

      const nextStories = state.stories.map((story) => ({
        ...story,
        ...(transaction.afterGeometry[story.id] ?? {}),
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  importAssets: (assets) =>
    set((state) => ({
      document: importDocumentAssets(state.document, assets),
      placementWarning: assets.length > 0 ? `${assets.length} asset${assets.length === 1 ? "" : "s"} imported` : null,
    })),

  placeAssetInSelectedFrame: (assetId) =>
    set((state) => {
      if (!state.selectedFrameId) {
        return {
          placementWarning: "Select an image or story frame before placing an asset",
        };
      }

      const document = placeAssetInFrame({
        document: state.document,
        assetId,
        frameId: state.selectedFrameId,
      });

      return {
        document,
        placementWarning: "Asset linked to selected frame",
      };
    }),

  replaceStoryImage: (storyId, descriptor) =>
    set((state) => {
      const frameId = findFrameIdForStory(state.document, state.activePageId, storyId);

      if (!frameId) {
        return { placementWarning: "No image frame found for this story" };
      }

      const asset = createAssetRecord(descriptor);
      const documentWithAsset = {
        ...state.document,
        assets: { ...state.document.assets, [asset.id]: asset },
      };
      const document = placeAssetInFrame({
        document: documentWithAsset,
        assetId: asset.id,
        frameId,
      });

      return {
        document,
        placementWarning: "Image replaced",
      };
    }),

  deleteAsset: (assetId) =>
    set((state) => ({
      document: deleteDocumentAsset(state.document, assetId),
      placementWarning: "Asset deleted and usages cleared",
    })),

  relinkAsset: (assetId, source) =>
    set((state) => ({
      document: relinkDocumentAsset(state.document, assetId, source),
      placementWarning: "Asset relinked",
    })),

  setAssetStatus: (assetId, status) =>
    set((state) => ({
      document: setAssetLinkStatus(state.document, assetId, status),
      placementWarning: status === "ok" ? null : `Asset marked ${status}`,
    })),

  createAdvertisementBooking: (input) =>
    set((state) => ({
      document: addAdvertisement(state.document, input),
      placementWarning: "Advertisement booking created",
    })),

  updateAdvertisementLifecycle: (adId, status) =>
    set((state) => ({
      document: updateAdvertisementStatus(state.document, adId, status),
      placementWarning: `Advertisement marked ${status}`,
    })),

  createAdvertisementFrame: (adId = null) =>
    set((state) => {
      const document = createAdvertisementFrame({
        document: state.document,
        pageId: state.activePageId,
        adId,
        bounds: {
          x: CONTENT_BOUNDS.x,
          y: CONTENT_BOUNDS.y + CONTENT_BOUNDS.height - 180,
          width: Math.min(300, CONTENT_BOUNDS.width),
          height: 160,
        },
      });
      const activePage = document.pages.find((page) => page.id === state.activePageId);
      const frameId = activePage?.frameIds.at(-1) ?? null;

      return {
        document,
        selectedFrameId: frameId,
        selectedFrameIds: frameId ? [frameId] : [],
        placementWarning: "Advertisement frame created",
      };
    }),

  autoPlaceAdvertisements: () =>
    set((state) => ({
      document: autoPlaceAdvertisements(state.document),
      placementWarning: "Reserved advertisements auto-placed into matching ad frames",
    })),

  placeAdvertisementInSelectedFrame: (adId) =>
    set((state) => {
      if (!state.selectedFrameId) {
        return {
          placementWarning: "Select an advertisement frame first",
        };
      }

      return {
        document: placeAdvertisementInFrame(state.document, adId, state.selectedFrameId),
        placementWarning: "Advertisement placed in selected frame",
      };
    }),

  replaceAdvertisementArtwork: (adId, assetId) =>
    set((state) => ({
      document: replaceAdvertisementArtwork(state.document, adId, assetId),
      placementWarning: assetId ? "Advertisement artwork replaced" : "Advertisement artwork cleared",
    })),

  createDocumentStyle: (input) =>
    set((state) => ({
      document: createStyle(state.document, input),
      placementWarning: `${input.kind} style created`,
    })),

  duplicateDocumentStyle: (styleId) =>
    set((state) => ({
      document: duplicateStyle(state.document, styleId),
      placementWarning: "Style duplicated",
    })),

  renameDocumentStyle: (styleId, name) =>
    set((state) => ({
      document: renameStyle(state.document, styleId, name),
      placementWarning: "Style renamed",
    })),

  updateDocumentStyle: (styleId, patch) =>
    set((state) => ({
      document: updateStyle(state.document, styleId, patch),
      placementWarning: "Style updated",
    })),

  deleteDocumentStyle: (styleId) =>
    set((state) => ({
      document: deleteStyle(state.document, styleId),
      placementWarning: "Style deleted",
    })),

  applyDocumentStyle: (targetId, styleId) =>
    set((state) => {
      const result = applyStyle(state.document, targetId, styleId);

      return {
        document: result.document,
        placementWarning: `Style applied to ${targetId}`,
      };
    }),

  markDocumentStyleOverride: (targetId) =>
    set((state) => ({
      document: markStyleOverride(state.document, targetId),
      placementWarning: "Style override marked",
    })),

  clearDocumentStyleOverrides: (targetId) =>
    set((state) => ({
      document: clearStyleOverrides(state.document, targetId),
      placementWarning: "Style overrides cleared",
    })),

  importDocumentStyles: (source, format) =>
    set((state) => ({
      document: importStyles(state.document, source, format),
      placementWarning: "Styles imported",
    })),

  exportDocumentStyles: (format) => exportStyles(get().document, format),

  updateSelectedStoryArticleData: (key, value) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory || valuesEqual(selectedStory.articleData[key], value)) {
        return state;
      }

      const nextStories = updateStory(state.stories, state.selectedStoryId, (story) => {
        const nextArticleData = {
          ...story.articleData,
          [key]: value,
        };

        if (key === "body") {
          nextArticleData.bodyParagraphs = normalizeParagraphTypography({
            content: value as ArticleData["body"],
            existing: story.articleData.bodyParagraphs,
          });
        }

        return {
          ...markStoryDirty(story, getArticleDataChangeDirtyFlags(key, story.articleData[key], value)),
          articleData: nextArticleData,
        };
      });

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  updateSelectedStoryPriority: (priority) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory) {
        return state;
      }

      const storiesWithPriority = updateStory(state.stories, selectedStory.id, (story) => ({
        ...markStoryDirty(story, {
          styleDirty: true,
          typographyDirty: true,
          compositionDirty: true,
          renderDirty: true,
        }),
        priority,
        ...getDefaultStoryTypographySettings(priority),
      }));
      const rebalanced = rebalanceStorySpans({
        selectedStoryId: selectedStory.id,
        stories: storiesWithPriority,
        requestedColumnSpan: getDefaultStoryColumnSpan(priority),
        bounds: STORY_SPAN_BOUNDS,
      });

      if (!rebalanced.success) {
        return {
          ...withSyncedDocument(state.document, storiesWithPriority),
          placementWarning: rebalanced.message,
        };
      }

      const nextStories = markRebalancedStoriesDirty(storiesWithPriority, rebalanced.stories);

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  renameStory: (storyId, name) =>
    set((state) => {
      const nextStories = updateStory(state.stories, storyId, (story) => ({
        ...markStoryDirty(story, {
          renderDirty: true,
        }),
        name: name.trim() || undefined,
        status: story.locked ? "locked" : "edited",
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  duplicateStory: (storyId) =>
    set((state) => {
      const source = state.stories.find((story) => story.id === storyId);

      if (!source) {
        return state;
      }

      const nextId = `story-${state.stories.length + 1}-${Date.now().toString(36)}`;
      const placement = findStoryPlacement({
        stories: state.stories,
        preferredSize: {
          width: source.width,
          height: source.height,
        },
        pageWidth: PAGE_BOUNDS.width,
        pageHeight: PAGE_BOUNDS.height,
        contentX: CONTENT_BOUNDS.x,
        contentY: CONTENT_BOUNDS.y,
        contentWidth: CONTENT_BOUNDS.width,
        contentHeight: CONTENT_BOUNDS.height,
      });
      const fallbackPosition = clampStoryPosition(
        {
          x: source.x + 24,
          y: source.y + 24,
        },
        {
          width: source.width,
          height: source.height,
        },
      );
      const sourceName = source.name ?? (richTextToPlainText(source.articleData.headline) || source.id);
      const nextStory: StoryFrame = {
        ...source,
        id: nextId,
        name: `${sourceName} Copy`,
        x: placement.storyFrame?.x ?? fallbackPosition.x,
        y: placement.storyFrame?.y ?? fallbackPosition.y,
        width: placement.storyFrame?.width ?? source.width,
        height: placement.storyFrame?.height ?? source.height,
        articleData: cloneArticleData(source.articleData),
        compositionSettings: {
          ...source.compositionSettings,
        },
        tags: [...(source.tags ?? [])],
        locked: false,
        hidden: false,
        status: "draft",
        dirtyFlags: mergeDirtyFlags(createCleanDirtyFlags(), {
          geometryDirty: true,
          compositionDirty: true,
          renderDirty: true,
        }),
      };
      const nextStories = [...state.stories, nextStory];

      return {
        ...withSyncedDocument(state.document, nextStories),
        selectedStoryId: nextStory.id,
        placementWarning: placement.storyFrame ? null : "Duplicated story placed at next logical position",
      };
    }),

  deleteStory: (storyId) =>
    set((state) => {
      if (state.stories.length <= 1) {
        return {
          placementWarning: "At least one story is required",
        };
      }

      const storyIndex = state.stories.findIndex((story) => story.id === storyId);
      const story = state.stories[storyIndex];

      if (!story) {
        return state;
      }

      if (state.smartLayout.enabled) {
        if (story.locked) {
          logSmartDelete("begin-skipped", {
            deletedStoryId: storyId,
            reason: "locked story",
          });

          return {
            placementWarning: "Locked story cannot be deleted",
          };
        }

        liveResizeController.beginDelete({
          pageId: state.activePageId,
          pageBounds: PAGE_RECT,
          contentBounds: CONTENT_BOUNDS,
          columns: createLayoutColumns(),
          frames: createLayoutFrameSnapshots(state.stories, state.activePageId),
          sourceFrameId: storyId,
          baselineGridSize: story.compositionSettings.baselineGridSize,
          commitContext: {
            stories: state.stories,
            document: state.document,
            pageId: state.activePageId,
          },
        });
        const result = liveResizeController.updateDelete({ force: true });

        logSmartDelete("preview", {
          deletedStoryId: storyId,
          affectedClusterId: result?.preview.solution.warnings.find((warning) => warning.includes("Delete cluster")) ?? null,
          affectedStories: result?.preview.frames.filter((frame) => frame.changed).map((frame) => frame.frameId) ?? [],
          whitespaceRemoved: Math.max(0, -(result?.preview.solution.metrics.totalChangedArea ?? 0)),
          compositionIterations: result?.preview.sequence ?? 0,
          commitTime: 0,
          violations: result?.preview.constraintViolations ?? [],
        });

        return {
          liveResizePreviewDrawCommands: result?.drawCommands ?? [],
          placementWarning: result?.preview.status === "ready"
            ? "Smart delete preview ready. Confirm delete to commit."
            : result?.preview.constraintViolations[0] ?? "Smart delete could not repair the page",
        };
      }

      const nextStories = state.stories.filter((story) => story.id !== storyId);
      const nextSelectedStoryId =
        state.selectedStoryId === storyId
          ? nextStories[Math.min(storyIndex, nextStories.length - 1)]?.id ?? null
          : state.selectedStoryId;

      return {
        ...withSyncedDocument(state.document, nextStories),
        selectedStoryId: nextSelectedStoryId,
        placementWarning: null,
      };
    }),

  confirmSmartDelete: () => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const result = liveResizeController.endDelete();
    const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;

    logSmartDelete("commit", {
      deletedStoryId: result.preview?.sourceFrameId ?? null,
      affectedClusterId: result.preview?.solution.warnings.find((warning) => warning.includes("Delete cluster")) ?? null,
      affectedStories: result.commit?.updatedStoryIds ?? [],
      whitespaceRemoved: Math.max(0, -(result.preview?.solution.metrics.totalChangedArea ?? 0)),
      compositionIterations: result.session?.iterationCount ?? result.preview?.sequence ?? 0,
      commitTime: elapsedMs,
      committed: result.committed,
      errors: result.commit?.errors ?? [],
    });

    if (result.committed && result.commit) {
      set((state) => ({
        stories: result.commit!.stories,
        document: result.commit!.document,
        selectedStoryId: result.commit!.stories[0]?.id ?? null,
        liveResizePreviewDrawCommands: [],
        placementWarning: result.commit!.warnings[0] ?? null,
      }));
      return;
    }

    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: result.commit?.errors[0] ?? result.preview?.constraintViolations[0] ?? "Smart delete rolled back",
    });
  },

  cancelSmartDelete: () => {
    const result = liveResizeController.cancelDelete();

    logSmartDelete("cancel", {
      deletedStoryId: result.preview?.sourceFrameId ?? null,
      affectedStories: result.preview?.frames.filter((frame) => frame.changed).map((frame) => frame.frameId) ?? [],
      whitespaceRemoved: 0,
      compositionIterations: result.session?.iterationCount ?? 0,
      commitTime: 0,
    });
    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: null,
    });
  },

  reorderStory: (storyId, direction) =>
    set((state) => {
      const storyIndex = state.stories.findIndex((story) => story.id === storyId);

      if (storyIndex < 0) {
        return state;
      }

      const targetIndex = direction === "up" ? storyIndex - 1 : storyIndex + 1;

      if (targetIndex < 0 || targetIndex >= state.stories.length) {
        return state;
      }

      const nextStories = [...state.stories];
      const [story] = nextStories.splice(storyIndex, 1);
      nextStories.splice(targetIndex, 0, story);

      return {
        ...withSyncedDocument(state.document, nextStories),
        selectedStoryId: storyId,
      };
    }),

  setStoryLocked: (storyId, locked) =>
    set((state) => {
      const nextStories = updateStory(state.stories, storyId, (story) => ({
        ...markStoryDirty(story, {
          renderDirty: true,
        }),
        locked,
        status: locked ? "locked" : "edited",
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  setStoryHidden: (storyId, hidden) =>
    set((state) => {
      const nextStories = updateStory(state.stories, storyId, (story) => ({
        ...markStoryDirty(story, {
          renderDirty: true,
        }),
        hidden,
        status: hidden ? "edited" : story.status,
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  updateStoryPriority: (storyId, priority) =>
    set((state) => {
      const nextStories = updateStory(state.stories, storyId, (story) => ({
        ...markStoryDirty(story, {
          styleDirty: true,
          typographyDirty: true,
          compositionDirty: true,
          renderDirty: true,
        }),
        priority,
        role: getRoleFromPriority(priority),
        status: story.locked ? "locked" : "edited",
        ...getDefaultStoryTypographySettings(priority),
      }));

      return {
        ...withSyncedDocument(state.document, nextStories),
        selectedStoryId: storyId,
      };
    }),

  updateSelectedStoryColumnSpan: (columnSpan) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory) {
        return state;
      }

      const rebalanced = rebalanceStorySpans({
        selectedStoryId: selectedStory.id,
        stories: state.stories,
        requestedColumnSpan: columnSpan,
        bounds: STORY_SPAN_BOUNDS,
      });

      if (!rebalanced.success) {
        return {
          placementWarning: rebalanced.message,
        };
      }

      const nextStories = markRebalancedStoriesDirty(state.stories, rebalanced.stories);

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  updateSelectedStoryImageSettings: (key, value) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory || valuesEqual(selectedStory[key as keyof typeof selectedStory], value)) {
        return state;
      }

      const nextStories = updateStory(state.stories, state.selectedStoryId, (story) => ({
          ...markStoryDirty(story, {
            imageDirty: true,
            compositionDirty: true,
            renderDirty: true,
          }),
          [key]: value,
        }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  updateSelectedStoryTypographySettings: (key, value) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory || valuesEqual(selectedStory[key], value)) {
        return state;
      }

      const nextStories = updateStory(state.stories, state.selectedStoryId, (story) => {
        const nextStory = {
          ...markStoryDirty(story, {
            typographyDirty: true,
            compositionDirty: true,
            renderDirty: true,
          }),
          [key]: value,
        };

        if (key in typographyFontSizeToLineHeightKey) {
          const lineHeightKey =
            typographyFontSizeToLineHeightKey[key as keyof typeof typographyFontSizeToLineHeightKey];
          const modeKey = typographyLineHeightToModeKey[lineHeightKey];
          const leadingValueKey =
            typographyFontSizeToLeadingValueKey[key as keyof typeof typographyFontSizeToLeadingValueKey];
          const fontSize = Number(value);
          const mode = story[modeKey] ?? "auto";
          const leadingValue =
            mode === "auto" ? fontSize : Number(story[leadingValueKey] ?? fontSize * story[lineHeightKey]);

          return {
            ...nextStory,
            [leadingValueKey]: mode === "auto" ? fontSize : leadingValue,
            [lineHeightKey]: resolveLeadingMultiplier({
              fontSize,
              mode,
              value: leadingValue,
            }),
          };
        }

        if (key in typographyLineHeightToModeKey) {
          const modeKey = typographyLineHeightToModeKey[key as keyof typeof typographyLineHeightToModeKey];
          const leadingValueKey = typographyModeToLeadingValueKey[modeKey];
          const fontSizeKey = typographyModeToFontSizeKey[modeKey];
          const nextMode = "exactly";
          const fontSize = Number(story[fontSizeKey]);
          const leadingValue = fontSize * Number(value);

          return {
            ...nextStory,
            [modeKey]: nextMode,
            [leadingValueKey]: leadingValue,
          };
        }

        if (key in typographyModeToLineHeightKey) {
          const lineHeightKey = typographyModeToLineHeightKey[key as keyof typeof typographyModeToLineHeightKey];
          const fontSizeKey = typographyModeToFontSizeKey[key as keyof typeof typographyModeToFontSizeKey];
          const leadingValueKey = typographyModeToLeadingValueKey[key as keyof typeof typographyModeToLeadingValueKey];
          const fontSize = Number(story[fontSizeKey]);
          const loadedMode = value as string;
          const nextMode =
            loadedMode === "manual"
              ? "exactly"
              : (value as StoryTypographySettings["headlineLineHeightMode"]);
          const fallbackValue =
            nextMode === "percentage"
              ? Math.round(Number(story[lineHeightKey]) * 100)
              : fontSize * Number(story[lineHeightKey]);
          const leadingValue = nextMode === "auto" ? fontSize : Number(story[leadingValueKey] ?? fallbackValue);

          return {
            ...nextStory,
            [key]: nextMode,
            [leadingValueKey]: nextMode === "auto" ? fontSize : leadingValue,
            [lineHeightKey]: resolveLeadingMultiplier({
              fontSize,
              mode: nextMode,
              value: leadingValue,
            }),
          };
        }

        if (key in typographyLeadingValueToLineHeightKey) {
          const lineHeightKey =
            typographyLeadingValueToLineHeightKey[key as keyof typeof typographyLeadingValueToLineHeightKey];
          const modeKey = typographyLeadingValueToModeKey[key as keyof typeof typographyLeadingValueToModeKey];
          const fontSizeKey =
            typographyLeadingValueToFontSizeKey[key as keyof typeof typographyLeadingValueToFontSizeKey];
          const mode = story[modeKey] ?? "exactly";

          return {
            ...nextStory,
            [modeKey]: mode === "auto" ? "exactly" : mode,
            [lineHeightKey]: resolveLeadingMultiplier({
              fontSize: Number(story[fontSizeKey]),
              mode: mode === "auto" ? "exactly" : mode,
              value: Number(value),
            }),
          };
        }

        return nextStory;
      });

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  resetSelectedStoryTypographyToPriorityDefaults: () =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory) {
        return state;
      }
      
      const defaultTypography = getDefaultStoryTypographySettings(selectedStory.priority);

      if (
        valuesEqual(
          {
            headlineFontSize: selectedStory.headlineFontSize,
            subheadlineFontSize: selectedStory.subheadlineFontSize,
            bodyFontSize: selectedStory.bodyFontSize,
            headlineLineHeight: selectedStory.headlineLineHeight,
            subheadlineLineHeight: selectedStory.subheadlineLineHeight,
            bodyLineHeight: selectedStory.bodyLineHeight,
            headlineLineHeightMode: selectedStory.headlineLineHeightMode,
            subheadlineLineHeightMode: selectedStory.subheadlineLineHeightMode,
            bodyLineHeightMode: selectedStory.bodyLineHeightMode,
            headlineLeadingValue: selectedStory.headlineLeadingValue,
            subheadlineLeadingValue: selectedStory.subheadlineLeadingValue,
            bodyLeadingValue: selectedStory.bodyLeadingValue,
            headlineWeight: selectedStory.headlineWeight,
            subheadlineWeight: selectedStory.subheadlineWeight,
            autoFitHeadline: selectedStory.autoFitHeadline,
            autoBalanceHeadline: selectedStory.autoBalanceHeadline,
            enableHyphenation: selectedStory.enableHyphenation,
            forceFullWidthHeadlines: selectedStory.forceFullWidthHeadlines,
            headlineLayoutMode: selectedStory.headlineLayoutMode,
          },
          defaultTypography,
        )
      ) {
        return state;
      }

      const nextStories = updateStory(state.stories, state.selectedStoryId, (story) => ({
          ...markStoryDirty(story, {
            typographyDirty: true,
            compositionDirty: true,
            renderDirty: true,
          }),
          ...getDefaultStoryTypographySettings(story.priority),
        }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  setPageType: (pageType) =>
    set((state) => ({
      pageType,
      document: updatePageProperties(state.document, state.activePageId, { pageType }),
    })),

  applyHeaderSetDraft: (draft) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId || !headerSystem.headerSets[activeHeaderSetId]) {
        return state;
      }

      const nextDocument = {
          ...state.document,
          headerSystem: {
            ...headerSystem,
            publicationProfiles: {
              ...headerSystem.publicationProfiles,
              [draft.profileId]: draft.profile,
            },
            headerSets: {
              ...headerSystem.headerSets,
              [activeHeaderSetId]: {
                ...headerSystem.headerSets[activeHeaderSetId],
                front: frontHeaderLayouts[draft.frontLayout],
                inside: insideHeaderLayouts[draft.insideLayout],
                updatedAt: new Date().toISOString(),
              },
            },
          },
          metadata: {
            ...state.document.metadata,
            newspaperName: draft.profile.publicationName,
            edition: draft.profile.editionName,
            date: draft.profile.date,
            language: draft.profile.language,
          },
        };

      return commitHeaderDocumentChange("Header Set applied", state.document, nextDocument);
    }),

  updatePublicationProfile: (profileId, patch) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const profile = headerSystem.publicationProfiles[profileId];

      if (!profile) {
        return state;
      }

      const nextDocument = {
          ...state.document,
          headerSystem: {
            ...headerSystem,
            publicationProfiles: {
              ...headerSystem.publicationProfiles,
              [profileId]: {
                ...profile,
                ...patch,
              },
            },
          },
          metadata: {
            ...state.document.metadata,
            newspaperName: patch.publicationName ?? state.document.metadata.newspaperName,
            edition: patch.editionName ?? state.document.metadata.edition,
            date: patch.date ?? state.document.metadata.date,
            language: patch.language ?? state.document.metadata.language,
          },
        };

      return commitHeaderDocumentChange("Publication profile updated", state.document, nextDocument);
    }),

  setHeaderBannerImage: (kind, url, maskColors) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
          ...state.document,
          headerSystem: {
            ...headerSystem,
            headerSets: {
              ...headerSystem.headerSets,
              [activeHeaderSetId]: {
                ...headerSet,
                [kind]: {
                  ...headerSet[kind],
                  headerImageUrl: url,
                  maskColors: maskColors ?? headerSet[kind].maskColors,
                },
                updatedAt: new Date().toISOString(),
              },
            },
          },
        };

      return commitHeaderDocumentChange(
        kind === "front" ? "Front header image updated" : "Inside header image updated",
        state.document,
        nextDocument,
      );
    }),

  // Seeds the inside header's accent colour from the publisher's one-time
  // theme_color setting (see PortalLaunchBootstrap.tsx) -- a starting point
  // only, same as setHeaderBannerImage above. Fully editable afterward
  // through HeaderManagerPanel's own accent colour picker.
  setHeaderAccentColor: (color) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
        ...state.document,
        headerSystem: {
          ...headerSystem,
          headerSets: {
            ...headerSystem.headerSets,
            [activeHeaderSetId]: {
              ...headerSet,
              inside: {
                ...headerSet.inside,
                accentColor: color,
              },
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };

      return commitHeaderDocumentChange("Header accent colour updated", state.document, nextDocument);
    }),

  // Publisher-picked replacement for the front masthead's own promo teaser
  // photo (Akhand Doot's live SVG template only) -- overrides the "first
  // front-page story with both an image and a headline" auto-pick in both
  // the live preview (EditorCanvas.tsx's frontHeaderTeaser) and PDF export
  // (HeaderPrintModel.ts's resolveFrontHeaderTeaser).
  setFrontTeaserImageOverride: (url) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
        ...state.document,
        headerSystem: {
          ...headerSystem,
          headerSets: {
            ...headerSystem.headerSets,
            [activeHeaderSetId]: {
              ...headerSet,
              front: {
                ...headerSet.front,
                teaserImageOverrideUrl: url,
              },
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };

      return commitHeaderDocumentChange("Front teaser image replaced", state.document, nextDocument);
    }),

  // Persists the live-fetched "fresh news" teaser (see the async fetch in
  // EditorCanvas.tsx around `frontTeaserFetchedArticle`) into the document
  // itself, so `resolveFrontHeaderTeaser`'s PDF-export pass can read the
  // exact same headline+image the live preview is already showing instead
  // of falling back to picking a different story from this page's own
  // frames. Silent no-op if there's no active header set yet, same as
  // setFrontTeaserImageOverride above.
  setFrontTeaserAutoPick: (headline, imageUrl) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
        ...state.document,
        headerSystem: {
          ...headerSystem,
          headerSets: {
            ...headerSystem.headerSets,
            [activeHeaderSetId]: {
              ...headerSet,
              front: {
                ...headerSet.front,
                autoTeaserHeadline: headline,
                autoTeaserImageUrl: imageUrl,
              },
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };

      return commitHeaderDocumentChange("Front teaser auto-pick saved", state.document, nextDocument);
    }),

  setFrontHeaderLayout: (layout) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
          ...state.document,
          headerSystem: {
            ...headerSystem,
            headerSets: {
              ...headerSystem.headerSets,
              [activeHeaderSetId]: {
                ...headerSet,
                front: frontHeaderLayouts[layout],
                updatedAt: new Date().toISOString(),
              },
            },
          },
        };

      return commitHeaderDocumentChange("Front header layout changed", state.document, nextDocument);
    }),

  setInsideHeaderLayout: (layout) =>
    set((state) => {
      const headerSystem = normalizeHeaderSystemState(state.document.headerSystem, state.document.metadata, {
        enableDefaultHeader: true,
      });
      const activeHeaderSetId = headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const headerSet = headerSystem.headerSets[activeHeaderSetId];

      const nextDocument = {
          ...state.document,
          headerSystem: {
            ...headerSystem,
            headerSets: {
              ...headerSystem.headerSets,
              [activeHeaderSetId]: {
                ...headerSet,
                inside: insideHeaderLayouts[layout],
                updatedAt: new Date().toISOString(),
              },
            },
          },
        };

      return commitHeaderDocumentChange("Inside header layout changed", state.document, nextDocument);
    }),

  saveActiveHeaderSetAs: (name) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: saveHeaderSetAs(state.document.headerSystem, name),
      };

      return commitHeaderDocumentChange("Header Set saved as", state.document, nextDocument);
    }),

  duplicateActiveHeaderSet: () =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: duplicateActiveHeaderSet(state.document.headerSystem),
      };

      return commitHeaderDocumentChange("Header Set duplicated", state.document, nextDocument);
    }),

  renameActiveHeaderSet: (name) =>
    set((state) => {
      const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const nextDocument = {
          ...state.document,
          headerSystem: renameHeaderSet(state.document.headerSystem, activeHeaderSetId, name),
        };

      return commitHeaderDocumentChange("Header Set renamed", state.document, nextDocument);
    }),

  deleteActiveHeaderSet: () =>
    set((state) => {
      const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const nextDocument = {
          ...state.document,
          headerSystem: deleteHeaderSet(state.document.headerSystem, activeHeaderSetId),
        };

      return commitHeaderDocumentChange("Header Set deleted", state.document, nextDocument);
    }),

  activateHeaderSet: (headerSetId) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: activateHeaderSet(state.document.headerSystem, headerSetId),
      };

      return commitHeaderDocumentChange("Header Set activated", state.document, nextDocument);
    }),

  setActiveHeaderSetAsDefault: () =>
    set((state) => {
      const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;

      if (!activeHeaderSetId) {
        return state;
      }

      const nextDocument = {
          ...state.document,
          headerSystem: setDefaultHeaderSet(state.document.headerSystem, activeHeaderSetId),
        };

      return commitHeaderDocumentChange("Default Header Set changed", state.document, nextDocument);
    }),

  exportActiveHeaderSet: () => exportActiveHeaderSetJson(get().document.headerSystem),

  importHeaderSet: (payload) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: importHeaderSetJson(state.document.headerSystem, payload),
      };

      return commitHeaderDocumentChange("Header Set imported", state.document, nextDocument);
    }),

  importHeaderLogoAsset: (profileId, role, descriptor) =>
    set((state) => {
      const documentWithAsset = importDocumentAssets(state.document, [{
        ...descriptor,
        tags: [...new Set([...(descriptor.tags ?? []), "header", "logo"])],
      }]);
      const headerSystem = normalizeHeaderSystemState(documentWithAsset.headerSystem, documentWithAsset.metadata, {
        enableDefaultHeader: true,
      });
      const profile = headerSystem.publicationProfiles[profileId];

      if (!profile) {
        return commitHeaderDocumentChange("Header logo imported", state.document, documentWithAsset);
      }

      const nextDocument = {
          ...documentWithAsset,
          headerSystem: {
            ...headerSystem,
            publicationProfiles: {
              ...headerSystem.publicationProfiles,
              [profileId]: {
                ...profile,
                logoAssetId: role === "color" ? descriptor.id ?? profile.logoAssetId : profile.logoAssetId,
                monochromeLogoAssetId: role === "monochrome" ? descriptor.id ?? profile.monochromeLogoAssetId : profile.monochromeLogoAssetId,
              },
            },
          },
        };

      return commitHeaderDocumentChange("Header logo imported", state.document, nextDocument);
    }),

  setActiveHeaderLocked: (locked) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: setActiveHeaderLocked(state.document.headerSystem, locked),
      };

      return commitHeaderDocumentChange(locked ? "Header locked" : "Header unlocked", state.document, nextDocument);
    }),

  setActiveHeaderHidden: (hidden) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: setActiveHeaderHidden(state.document.headerSystem, hidden),
      };

      return commitHeaderDocumentChange(hidden ? "Header hidden" : "Header shown", state.document, nextDocument);
    }),

  resetActiveHeaderLayouts: () =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: resetActiveHeaderLayouts(state.document.headerSystem, "classic-centered", "classic-rule-folio"),
      };

      return commitHeaderDocumentChange("Header layouts reset", state.document, nextDocument);
    }),

  setActiveHeaderSectionOverride: (input) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: setSectionInsideHeaderOverride(
          state.document.headerSystem,
          input.sectionName,
          input,
        ),
      };

      return commitHeaderDocumentChange("Section header override applied", state.document, nextDocument);
    }),

  removeActiveHeaderSectionOverride: (sectionName) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: removeSectionHeaderOverride(state.document.headerSystem, sectionName),
      };

      return commitHeaderDocumentChange("Section header override removed", state.document, nextDocument);
    }),

  overrideActivePageHeader: (input) =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: setPageInsideHeaderOverride(state.document.headerSystem, state.activePageId, input),
      };

      return commitHeaderDocumentChange("Page header override applied", state.document, nextDocument);
    }),

  returnActivePageToMasterHeader: () =>
    set((state) => {
      const nextDocument = {
        ...state.document,
        headerSystem: removePageHeaderOverride(state.document.headerSystem, state.activePageId),
      };

      return commitHeaderDocumentChange("Page returned to master header", state.document, nextDocument);
    }),

  undoHeaderOperation: () =>
    set(() => {
      const transaction = undoHeaderDocumentTransaction();

      if (!transaction) {
        return {
          placementWarning: "No header operation to undo",
        };
      }

      return {
        document: transaction.before,
        placementWarning: `Undid ${transaction.label}`,
      };
    }),

  redoHeaderOperation: () =>
    set(() => {
      const transaction = redoHeaderDocumentTransaction();

      if (!transaction) {
        return {
          placementWarning: "No header operation to redo",
        };
      }

      return {
        document: transaction.after,
        placementWarning: `Redid ${transaction.label}`,
      };
    }),

  toggleProductionView: () =>
    set((state) => ({
      productionView: !state.productionView,
    })),

  togglePerformanceProfiler: () =>
    set((state) => ({
      performanceProfilerEnabled: !state.performanceProfilerEnabled,
    })),

  updateSelectedStoryCompositionSettings: (key, value) =>
    set((state) => {
      if (!state.selectedStoryId) {
        return state;
      }

      const selectedStory = state.stories.find((story) => story.id === state.selectedStoryId);

      if (!selectedStory || valuesEqual(selectedStory.compositionSettings[key], value)) {
        return state;
      }

      const nextStories = updateStory(state.stories, state.selectedStoryId, (story) => ({
          ...markStoryDirty(story, getCompositionDirtyFlags(key)),
          compositionSettings: {
            ...story.compositionSettings,
            [key]: value,
          },
        }));

      return {
        ...withSyncedDocument(state.document, nextStories),
      };
    }),

  moveStory: (storyId, position) =>
    set((state) => {
      const story = state.stories.find((candidate) => candidate.id === storyId);

      if (!story) {
        return state;
      }

      if (story.locked) {
        return {
          placementWarning: "Locked story cannot be moved",
        };
      }

      const activeContentBounds = getActiveContentBounds(state.document, state.activePageId);
      const nextPosition = clampStoryPositionToBounds(
        snapPoint(position),
        {
          width: story.width,
          height: story.height,
        },
        activeContentBounds,
      );
      const candidate = {
        ...story,
        x: snapValue(nextPosition.x),
        y: snapValue(nextPosition.y),
      };

      if (storyOverlapsAnother(state.stories, storyId, candidate)) {
        return {
          placementWarning: "Story move would overlap another story",
        };
      }

      const nextStories = updateStory(state.stories, storyId, (currentStory) => ({
          ...markStoryDirty(currentStory, {
            renderDirty: true,
          }),
          x: candidate.x,
          y: candidate.y,
        }));

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  resizeStory: (storyId, articleBox) =>
    set((state) => {
      const story = state.stories.find((candidate) => candidate.id === storyId);

      if (!story) {
        return state;
      }

      if (story.locked) {
        return {
          placementWarning: "Locked story cannot be resized",
        };
      }

      const activeContentBounds = getActiveContentBounds(state.document, state.activePageId);
      const nextGeometry = normalizeStoryGeometry(articleBox, activeContentBounds);
      const candidate = {
        ...story,
        ...nextGeometry,
      };

      if (state.smartLayout.enabled) {
        const layoutDiff = runLayoutKernelShadowResize({
          pageId: state.activePageId,
          pageBounds: PAGE_RECT,
          contentBounds: activeContentBounds,
          columns: createLayoutColumns(),
          frames: createLayoutFrameSnapshots(state.stories, state.activePageId),
          sourceFrameId: storyId,
          before: {
            x: story.x,
            y: story.y,
            width: story.width,
            height: story.height,
          },
          requested: nextGeometry,
          minSize: MIN_STORY_SIZE,
          baselineGridSize: story.compositionSettings.baselineGridSize,
        });
        const commit = commitLayoutSolution({
          stories: state.stories,
          document: state.document,
          pageId: state.activePageId,
          solution: layoutDiff.solution,
        });

        if (commit.committed && commit.updatedStoryIds.length > 0) {
          return {
            stories: commit.stories,
            document: commit.document,
            placementWarning: commit.warnings[0] ?? null,
          };
        }

        if (!commit.committed) {
          return {
            placementWarning: commit.errors[0] ?? "Smart layout resize was rolled back",
          };
        }
      }

      if (storyOverlapsAnother(state.stories, storyId, candidate)) {
        return {
          placementWarning: "Story resize would overlap another story",
        };
      }

      const nextStories = updateStory(state.stories, storyId, (currentStory) => ({
          ...markStoryDirty(currentStory, {
            geometryDirty: true,
            compositionDirty: true,
            renderDirty: true,
          }),
          ...nextGeometry,
        }));

      return {
        ...withSyncedDocument(state.document, nextStories),
        placementWarning: null,
      };
    }),

  beginLiveResize: (storyId, articleBox, handle, pointer) => {
    const state = get();

    if (!state.smartLayout.enabled) {
      return;
    }

    const story = state.stories.find((item) => item.id === storyId);

    if (!story) {
      logSmartResize("begin-skipped", {
        storyId,
        reason: "missing story",
      });
      return;
    }

    liveResizeController.beginResize({
      pageId: state.activePageId,
      pageBounds: PAGE_RECT,
      contentBounds: CONTENT_BOUNDS,
      columns: createLayoutColumns(),
      frames: createLayoutFrameSnapshots(state.stories, state.activePageId),
      sourceFrameId: storyId,
      before: {
        x: articleBox.x,
        y: articleBox.y,
        width: articleBox.width,
        height: articleBox.height,
      },
      handle,
      startPointer: pointer,
      minSize: MIN_STORY_SIZE,
      baselineGridSize: story.compositionSettings.baselineGridSize,
      commitContext: {
        stories: state.stories,
        document: state.document,
        pageId: state.activePageId,
      },
    });
    logSmartResize("begin", {
      storyId,
      handle,
      before: articleBox,
      pointer,
      frameCount: state.stories.length,
    });
    set({ liveResizePreviewDrawCommands: [] });
  },

  updateLiveResize: (pointer) => {
    const result = liveResizeController.updateResize({
      pointer,
    });

    if (!result) {
      return;
    }

    logSmartResize("preview", () => ({
      sourceFrameId: result.preview.sourceFrameId,
      sequence: result.preview.sequence,
      status: result.preview.status,
      changedFrames: result.preview.frames.filter((frame) => frame.changed).map((frame) => frame.frameId),
      warnings: result.preview.warnings,
      constraintViolations: result.preview.constraintViolations,
    }));
    set({
      liveResizePreviewDrawCommands: result.drawCommands,
      placementWarning: result.preview.constraintViolations[0] ?? null,
    });
  },

  endLiveResize: () => {
    const result = liveResizeController.endResize();

    logSmartResize("end", {
      committed: result.committed,
      discarded: result.discarded,
      updatedStoryIds: result.commit?.updatedStoryIds ?? [],
      errors: result.commit?.errors ?? [],
      warnings: result.commit?.warnings ?? result.preview?.warnings ?? [],
    });

    if (result.committed && result.commit) {
      set({
        stories: result.commit.stories,
        document: result.commit.document,
        liveResizePreviewDrawCommands: [],
        placementWarning: result.commit.warnings[0] ?? null,
      });
      return;
    }

    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: result.commit?.errors[0] ?? result.preview?.constraintViolations[0] ?? null,
    });
  },

  cancelLiveResize: () => {
    const result = liveResizeController.cancelResize();

    logSmartResize("cancel", {
      discarded: result.discarded,
      previewId: result.preview?.id ?? null,
    });
    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: null,
    });
  },

  beginLiveMove: (storyId, articleBox, pointer) => {
    const state = get();

    if (!state.smartLayout.enabled) {
      return;
    }

    const story = state.stories.find((item) => item.id === storyId);

    if (!story) {
      logSmartResize("move-begin-skipped", {
        storyId,
        reason: "missing story",
      });
      return;
    }

    if (story.locked) {
      set({ placementWarning: "Locked story cannot be moved" });
      return;
    }

    liveResizeController.beginMove({
      pageId: state.activePageId,
      pageBounds: PAGE_RECT,
      contentBounds: CONTENT_BOUNDS,
      columns: createLayoutColumns(),
      frames: createLayoutFrameSnapshots(state.stories, state.activePageId),
      sourceFrameId: storyId,
      before: {
        x: articleBox.x,
        y: articleBox.y,
        width: articleBox.width,
        height: articleBox.height,
      },
      startPointer: pointer,
      minSize: MIN_STORY_SIZE,
      baselineGridSize: story.compositionSettings.baselineGridSize,
      commitContext: {
        stories: state.stories,
        document: state.document,
        pageId: state.activePageId,
      },
    });
    logSmartResize("move-begin", {
      storyId,
      before: articleBox,
      pointer,
      frameCount: state.stories.length,
    });
    set({ liveResizePreviewDrawCommands: [], placementWarning: null });
  },

  updateLiveMove: (pointer) => {
    const result = liveResizeController.updateMove({
      pointer,
    });

    if (!result) {
      return;
    }

    logSmartResize("move-preview", () => ({
      sourceFrameId: result.preview.sourceFrameId,
      sequence: result.preview.sequence,
      status: result.preview.status,
      changedFrames: result.preview.frames.filter((frame) => frame.changed).map((frame) => frame.frameId),
      warnings: result.preview.warnings,
      constraintViolations: result.preview.constraintViolations,
    }));
    set({
      liveResizePreviewDrawCommands: result.drawCommands,
      placementWarning: result.preview.constraintViolations[0] ?? null,
    });
  },

  endLiveMove: () => {
    const result = liveResizeController.endMove();

    logSmartResize("move-end", {
      committed: result.committed,
      discarded: result.discarded,
      updatedStoryIds: result.commit?.updatedStoryIds ?? [],
      errors: result.commit?.errors ?? [],
      warnings: result.commit?.warnings ?? result.preview?.warnings ?? [],
    });

    if (result.committed && result.commit) {
      set({
        stories: result.commit.stories,
        document: result.commit.document,
        liveResizePreviewDrawCommands: [],
        placementWarning: result.commit.warnings[0] ?? null,
      });
      return;
    }

    if (!result.preview && !result.commit && !result.session) {
      return;
    }

    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: result.commit?.errors[0] ?? result.preview?.constraintViolations[0] ?? null,
    });
  },

  cancelLiveMove: () => {
    const result = liveResizeController.cancelMove();

    logSmartResize("move-cancel", {
      discarded: result.discarded,
      previewId: result.preview?.id ?? null,
    });
    set({
      liveResizePreviewDrawCommands: [],
      placementWarning: null,
    });
  },

  setSmartLayoutEnabled: (enabled) =>
    set(() => ({
      smartLayout: {
        enabled,
      },
    })),

  setZoom: (zoom) =>
    set({
      zoom: clamp(Math.round(zoom * 100) / 100, 0.35, 1.5),
    }),

  zoomIn: () =>
    set((state) => ({
      zoom: clamp(Math.round((state.zoom + 0.1) * 100) / 100, 0.35, 1.5),
    })),

  zoomOut: () =>
    set((state) => ({
      zoom: clamp(Math.round((state.zoom - 0.1) * 100) / 100, 0.35, 1.5),
    })),
}));
