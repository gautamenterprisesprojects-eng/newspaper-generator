import type { RichTextContent } from "./RichText";

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type StoryFrameId = string;

export type StoryPriority = "lead" | "major" | "secondary" | "brief" | "filler";
export type EditorObjectType =
  | "headline"
  | "subheadline"
  | "byline"
  | "location"
  | "body"
  | "image"
  | "caption"
  | "credit"
  | "source"
  | "kicker"
  | "strap"
  | "factBox"
  | "factBoxHeading"
  | "factBoxContent"
  | "pullQuote"
  | "pageHeader"
  | "pageFooter"
  | "pageNumber"
  | "advertisement"
  | "editorName";

export type EditorTextRange = {
  start: number;
  end: number;
};

export type EditorSelectionBounds = Point & Size;

export type EditorEditingMode = "none" | "text";

export type EditorSelectedObject = {
  storyId: StoryFrameId;
  objectType: EditorObjectType;
  bounds: EditorSelectionBounds | null;
};

export type StoryWorkflowStatus =
  | "ready"
  | "draft"
  | "needs-image"
  | "needs-caption"
  | "overflow"
  | "incomplete"
  | "edited"
  | "locked";

export type StoryColumnSpan = 1 | 2 | 3 | 4 | 5 | 6;

export type StoryHierarchyVisualStyle = {
  headlineSize: number;
  subheadlineSize: number;
  bodySize: number;
  showSubheadline: boolean;
  minimumHeight: number;
};

export type StoryImageAlignment =
  | "top"
  | "top-left"
  | "top-right"
  // Genuinely centred at the top — distinct from "top", which
  // getNewspaperAlignment (EditorialLayoutQualityEngine) rewrites into
  // top-left/top-right by priority. This one is never rewritten, so a
  // deliberately centred hero image (e.g. a full-width 6-column box) stays
  // centred instead of being redirected to a side.
  | "top-center"
  | "bottom"
  | "left"
  | "right"
  | "center";

export type StoryImageWrapMode = "none" | "rectangular" | "newspaper" | "contour";

export type StoryImageHeightMode = "auto" | "fixed";

export type StoryImageHeightPreset = "tiny" | "small" | "medium" | "large" | "xl" | "custom";

export type StoryImageShapeType = "rectangle" | "ellipse" | "star" | "heart" | "polygon" | "custom-path";

export type StoryImageShapePoint = {
  x: number;
  y: number;
};

export type StoryImageCropSettings = {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  opacity: number;
};

export type StoryImageSettings = {
  imageEnabled: boolean;
  imageAlignment: StoryImageAlignment;
  imageColumnSpan: number;
  imageHeight: number;
  imageHeightMode: StoryImageHeightMode;
  imageHeightPreset: StoryImageHeightPreset;
  imageHeightProtection: boolean;
  autoSizeImage: boolean;
  imageWrapMode: StoryImageWrapMode;
  imageShapeType?: StoryImageShapeType;
  imageShapePoints?: StoryImageShapePoint[];
  imageCrop?: StoryImageCropSettings;
  wrapContourPoints?: StoryImageShapePoint[];
  wrapTextOffset?: number;
  /** When true, dynamic image balancing must not modify this image. */
  imageSizeLocked?: boolean;
  /** Source image pixel width (for aspect-ratio and resolution checks). */
  sourceWidth?: number;
  /** Source image pixel height (for aspect-ratio and resolution checks). */
  sourceHeight?: number;
};

export type StoryTypographyWeight = "400" | "500" | "600" | "700" | "800" | "900";

export type HeadlineLayoutMode = "balanced" | "newspaper-fill";
export type HeadlineCandidateType = "balanced" | "newspaper-fill" | "hyphenated";
export type EditorialFitStatus = "PERFECT" | "GOOD" | "NEEDS_FIT" | "POOR";
export type StoryLeadingMode = "auto" | "exactly" | "at-least" | "percentage";
export type StoryLineHeightMode = StoryLeadingMode;

export type HeadlineCandidateScore = {
  type: HeadlineCandidateType;
  lines: string[];
  line1FillPercent: number;
  line2FillPercent: number;
  unusedPixels: number;
  score: number;
  reason: string;
};

export type StoryTypographySettings = {
  headlineFontSize: number;
  subheadlineFontSize: number;
  bodyFontSize: number;
  headlineLineHeight: number;
  subheadlineLineHeight: number;
  bodyLineHeight: number;
  headlineLineHeightMode?: StoryLineHeightMode;
  subheadlineLineHeightMode?: StoryLineHeightMode;
  bodyLineHeightMode?: StoryLineHeightMode;
  headlineLeadingValue?: number;
  subheadlineLeadingValue?: number;
  bodyLeadingValue?: number;
  headlineWeight: StoryTypographyWeight;
  subheadlineWeight: StoryTypographyWeight;
  autoFitHeadline: boolean;
  autoBalanceHeadline: boolean;
  enableHyphenation: boolean;
  forceFullWidthHeadlines: boolean;
  headlineLayoutMode: HeadlineLayoutMode;
};

export type EditorialAlignment = "left" | "center" | "right";
export type EditorialTextAlignment = "left" | "center" | "right" | "justify";
export type EditorialVerticalAlignment = "top" | "middle" | "bottom";
export type EditorialJustifyMode = "justify-except-last" | "justify-all-lines";
export type EditorialJustifyEngineMode = "browser" | "newspaper";
export type HyphenationJustificationOptimizationLevel = "fast" | "balanced" | "quality";
export type HyphenationJustificationPresetName =
  | "newspaper-hindi-body"
  | "newspaper-english-body"
  | "compact-narrow-column"
  | "relaxed-wide-column"
  | "custom";
export type TypographyEditingScope = "story" | "paragraph" | "selection";

export type ArticleParagraphFormatting = {
  fontFamily: string;
  fontSize: number;
  fontWeight: StoryTypographyWeight;
  color: string;
  alignment: EditorialTextAlignment;
  leadingMode: StoryLeadingMode;
  leadingValue: number;
  tracking: number;
  horizontalScale: number;
  verticalScale: number;
  characterSpacing: number;
  firstLineIndent: number;
  leftIndent: number;
  rightIndent: number;
  spaceBefore: number;
  spaceAfter: number;
  paragraphGap: number;
  language: "hi" | "en" | "mixed";
  hyphenation: boolean;
  widowControl: boolean;
  orphanControl: boolean;
  keepTogether: boolean;
  paragraphBackground: string;
  paragraphBorder: string;
  dropCap: boolean;
  rulesAbove: boolean;
  rulesBelow: boolean;
};

export type ArticleParagraphTypography = {
  id: string;
  index: number;
  textStart: number;
  textEnd: number;
  preview: string;
  formatting: ArticleParagraphFormatting;
};

export type UniversalTypographyControls = {
  headlineAlignment: Exclude<EditorialTextAlignment, "justify">;
  headlineVerticalAlignment: EditorialVerticalAlignment;
  subheadlineAlignment: EditorialTextAlignment;
  subheadlineVerticalAlignment: EditorialVerticalAlignment;
  bodyAlignment: EditorialTextAlignment;
  justifyMode: EditorialJustifyMode;
  justifyEngineMode: EditorialJustifyEngineMode;
  subheadlineJustifyMode: EditorialJustifyMode;
  subheadlineJustifyEngineMode: EditorialJustifyEngineMode;
  bodyJustifyMode: EditorialJustifyMode;
  bodyJustifyEngineMode: EditorialJustifyEngineMode;
  hjWordSpacingMin: number;
  hjWordSpacingMax: number;
  hjTrackingMin: number;
  hjTrackingMax: number;
  hjHyphenation: boolean;
  hjMaximumConsecutiveHyphens: number;
  hjMinimumWordLength: number;
  hjMinimumBeforeHyphen: number;
  hjMinimumAfterHyphen: number;
  hjOptimizationLevel: HyphenationJustificationOptimizationLevel;
  hjPreset: HyphenationJustificationPresetName;
  captionJustifyMode: EditorialJustifyMode;
  captionJustifyEngineMode: EditorialJustifyEngineMode;
  creditJustifyMode: EditorialJustifyMode;
  creditJustifyEngineMode: EditorialJustifyEngineMode;
  sourceJustifyMode: EditorialJustifyMode;
  sourceJustifyEngineMode: EditorialJustifyEngineMode;
  factBoxContentJustifyMode: EditorialJustifyMode;
  factBoxContentJustifyEngineMode: EditorialJustifyEngineMode;
  wordSpacing: number;
  headlineTracking: number;
  subheadlineTracking: number;
  bodyTracking: number;
  captionTracking: number;
  headlineLetterSpacing: number;
  subheadlineLetterSpacing: number;
  bodyLetterSpacing: number;
  captionLetterSpacing: number;
  paragraphGap: number;
  firstLineIndent: number;
  paragraphIndent: number;
  captionAlignment: EditorialTextAlignment;
  creditAlignment: EditorialTextAlignment;
  sourceAlignment: EditorialTextAlignment;
  factBoxHeadlineAlignment: Exclude<EditorialTextAlignment, "justify">;
  factBoxContentAlignment: EditorialTextAlignment;
  pullQuoteAlignment: Exclude<EditorialTextAlignment, "justify">;
  pullQuoteVerticalAlignment: EditorialVerticalAlignment;
  factBoxVerticalAlignment: EditorialVerticalAlignment;
};

export type EditorialInlineLabelStyle = {
  color: string;
  backgroundColor: string;
  padding: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: number;
  alignment: EditorialAlignment;
};

export type EditorialInlineLabelData = {
  enabled: boolean;
  text: RichTextContent;
  style: EditorialInlineLabelStyle;
};

export type SubheadlineBannerMode = "none" | "solid" | "rounded" | "banner";

export type SubheadlineBannerStyle = {
  mode: SubheadlineBannerMode;
  textColor: string;
  backgroundColor: string;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  backgroundOpacity?: number;
};

export type FactBoxThemeName =
  | "classic-gray"
  | "red"
  | "blue"
  | "green"
  | "orange"
  | "custom";

export type FactBoxTheme = {
  name: FactBoxThemeName;
  background: string;
  border: string;
  headerColor: string;
  bulletColor: string;
  textColor: string;
};

export type PullQuoteThemeName =
  | "classic"
  | "modern"
  | "magazine"
  | "breaking"
  | "minimal";

export type PullQuoteTheme = {
  name: PullQuoteThemeName;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  quoteMarkColor: string;
};

export type EditorialStylePresetName =
  | "none"
  | "breaking-news"
  | "political"
  | "sports"
  | "business"
  | "feature"
  | "magazine"
  | "editorial"
  | "opinion";

export type CaptionPosition =
  | "below-image"
  | "above-image"
  | "overlay-bottom"
  | "overlay-top"
  | "overlay-bottom-gradient"
  | "overlay-left"
  | "overlay-right";

export type CaptionCreditPosition =
  | "below-caption"
  | "right-side"
  | "top-right-overlay"
  | "bottom-right-overlay";

export type CaptionPresetName =
  | "classic-newspaper"
  | "modern-newspaper"
  | "magazine"
  | "photo-story"
  | "breaking-news"
  | "minimal";

export type CaptionLabelStyle = {
  color: string;
  backgroundColor: string;
  fontWeight: number;
  padding: number;
  borderRadius: number;
};

export type CaptionTextStyle = {
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
};

export type ContainerBackgroundMode =
  | "none"
  | "text-only"
  | "frame"
  | "container"
  | "full-width"
  | "pill"
  | "rounded-rectangle"
  | "banner"
  | "transparent";

export type FrameBackgroundMode = "none" | "text-only" | "frame" | "full-width" | "banner";
export type FrameBorderStyle = "solid" | "dashed" | "dotted";

export type ObjectContainerStyle = {
  mode: ContainerBackgroundMode;
  frameMode: FrameBackgroundMode;
  contentHorizontalAlignment: EditorialTextAlignment;
  contentVerticalAlignment: EditorialVerticalAlignment;
  minimumFrameHeight: number;
  minimumFrameWidth: number;
  autoFrameHeight: boolean;
  framePaddingTop: number;
  framePaddingBottom: number;
  framePaddingLeft: number;
  framePaddingRight: number;
  frameBorderWidth: number;
  frameBorderColor: string;
  frameBorderStyle: FrameBorderStyle;
  frameBackgroundColor: string;
  frameRadius: number;
  frameOpacity: number;
  containerPaddingTop: number;
  containerPaddingBottom: number;
  containerPaddingLeft: number;
  containerPaddingRight: number;
  containerBorderRadius: number;
  containerBorderWidth: number;
  containerBorderColor: string;
  containerBackgroundColor: string;
  containerOpacity: number;
};

export type ArticleObjectContainerStyles = {
  article?: ObjectContainerStyle;
  headline: ObjectContainerStyle;
  subheadline: ObjectContainerStyle;
  caption: ObjectContainerStyle;
  credit: ObjectContainerStyle;
  source: ObjectContainerStyle;
  kicker: ObjectContainerStyle;
  strap: ObjectContainerStyle;
  factBoxHeading: ObjectContainerStyle;
  factBoxContent: ObjectContainerStyle;
  pullQuote: ObjectContainerStyle;
  bodyCallout: ObjectContainerStyle;
};

export type ArticleCaptionData = {
  enabled: boolean;
  text: RichTextContent;
  creditText: RichTextContent;
  photographer: string;
  agency: string;
  source: string;
  showCredit: boolean;
  showSource: boolean;
  alignment: EditorialAlignment;
  position: CaptionPosition;
  creditPosition: CaptionCreditPosition;
  preset: CaptionPresetName;
  captionStyle: CaptionTextStyle;
  creditStyle: CaptionTextStyle;
  labelStyle: CaptionLabelStyle;
  labels: {
    caption: string;
    credit: string;
    source: string;
    agency: string;
  };
};

export type ArticleBoxModel = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StoryDirtyFlags = {
  geometryDirty: boolean;
  textDirty: boolean;
  imageDirty: boolean;
  styleDirty: boolean;
  typographyDirty: boolean;
  compositionDirty: boolean;
  renderDirty: boolean;
};

export type EditorPerformanceDiagnostics = {
  compositionTimeMs: number;
  renderTimeMs: number;
  fps: number;
  dirtyStories: number;
  cacheHitPercent: number;
  cacheMissPercent: number;
  storiesRecomposed: number;
  storiesRepainted: number;
  storyComposeTimeMs: number;
  paragraphComposeTimeMs: number;
  headlineComposeTimeMs: number;
  imagePlacementTimeMs: number;
  richTextTimeMs: number;
  opticalTypographyTimeMs: number;
  konvaDrawTimeMs: number;
  storeUpdateTimeMs: number;
  inspectorUpdateTimeMs: number;
  cacheLookupTimeMs: number;
  dirtyRegionCount: number;
  averageFrameTimeMs: number;
  worstFrameTimeMs: number;
  averageFps: number;
  minimumFps: number;
  maximumFps: number;
  memoryUsageMb: number;
  konvaNodes: number;
  visibleStories: number;
  averageStoryComposeMs: number;
  slowestStoryMs: number;
  storiesCached: number;
  cacheSize: number;
  cacheEvictions: number;
  largestCache: string;
  mostRecomposedStoryId: string;
  hotPathOperations: {
    name: string;
    durationMs: number;
    count: number;
  }[];
  slowReactComponents: {
    name: string;
    renderCount: number;
    averageRenderTimeMs: number;
    longestRenderTimeMs: number;
    whyRendered: string;
  }[];
  slowStories: {
    storyId: string;
    renderTimeMs: number;
    nodeCount: number;
  }[];
  renderStageBreakdown: {
    stage: string;
    durationMs: number;
  }[];
  editorCanvasRenderTimeMs: number;
  canvasLayerRenderTimeMs: number;
  storyRenderTimeMs: number;
  articleBoxRenderTimeMs: number;
  headlineRenderTimeMs: number;
  subheadlineRenderTimeMs: number;
  bodyRenderTimeMs: number;
  imageRenderTimeMs: number;
  captionRenderTimeMs: number;
  factBoxRenderTimeMs: number;
  pullQuoteRenderTimeMs: number;
  selectionRenderTimeMs: number;
  guidesRenderTimeMs: number;
  gridRenderTimeMs: number;
  reactRenderTimeMs: number;
  reactCommitTimeMs: number;
  konvaBatchDrawTimeMs: number;
  stageCount: number;
  layerCount: number;
  fastLayerCount: number;
  groupCount: number;
  textNodeCount: number;
  rectCount: number;
  imageNodeCount: number;
  lineCount: number;
  guideCount: number;
  transformerCount: number;
  selectionNodeCount: number;
  totalNodes: number;
  visibleNodes: number;
  hiddenNodes: number;
  destroyedNodes: number;
  createdNodes: number;
  renderCacheHitPercent: number;
  renderCacheMissPercent: number;
  timeline: {
    stage: string;
    durationMs: number;
  }[];
};

export type StoryFrame = ArticleBoxModel & {
  id: StoryFrameId;
  /**
   * The slot this box came from in its layout template, one-based.
   *
   * Carried so page furniture can be keyed to a named position rather than to
   * whatever data happens to be present. The editorial page uses it to put a
   * writer's rail on its two signed pieces and nothing else; every other page
   * ignores it.
   */
  templateStoryNumber?: number;
  name?: string;
  category?: string;
  tags?: string[];
  status?: StoryWorkflowStatus;
  locked?: boolean;
  hidden?: boolean;
  role?: "lead" | "major" | "medium" | "brief";
  priority: StoryPriority;
  columnStart: StoryColumnSpan;
  columnSpan: StoryColumnSpan;
  imageEnabled: boolean;
  imageAlignment: StoryImageAlignment;
  imageColumnSpan: number;
  imageHeight: number;
  imageHeightMode: StoryImageHeightMode;
  imageHeightPreset: StoryImageHeightPreset;
  imageHeightProtection: boolean;
  autoSizeImage: boolean;
  imageWrapMode: StoryImageWrapMode;
  imageShapeType?: StoryImageShapeType;
  imageShapePoints?: StoryImageShapePoint[];
  imageCrop?: StoryImageCropSettings;
  wrapContourPoints?: StoryImageShapePoint[];
  wrapTextOffset?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  headlineFontSize: number;
  subheadlineFontSize: number;
  bodyFontSize: number;
  headlineLineHeight: number;
  subheadlineLineHeight: number;
  bodyLineHeight: number;
  headlineLineHeightMode?: StoryLineHeightMode;
  subheadlineLineHeightMode?: StoryLineHeightMode;
  bodyLineHeightMode?: StoryLineHeightMode;
  headlineLeadingValue?: number;
  subheadlineLeadingValue?: number;
  bodyLeadingValue?: number;
  headlineWeight: StoryTypographyWeight;
  subheadlineWeight: StoryTypographyWeight;
  autoFitHeadline: boolean;
  autoBalanceHeadline: boolean;
  enableHyphenation: boolean;
  forceFullWidthHeadlines: boolean;
  headlineLayoutMode: HeadlineLayoutMode;
  articleData: ArticleData;
  compositionSettings: ArticleCompositionSettings;
  dirtyFlags?: StoryDirtyFlags;
  /**
   * The language the story's own text content was fetched/composed in --
   * distinct from ArticleParagraphFormatting's own "language" field (which
   * drives justification/hyphenation rules, not font choice). Optional and
   * unset by every existing caller except the newswire import path, so this
   * has no effect anywhere it isn't explicitly threaded through.
   */
  contentLanguage?: "hindi" | "english";
};

export type ArticleData = {
  kicker: EditorialInlineLabelData;
  strap: EditorialInlineLabelData;
  headline: RichTextContent;
  subheadline: RichTextContent;
  subheadlineBanner: SubheadlineBannerStyle;
  summaryBullets?: string[];
  inlineSubheadingEnabled?: boolean;
  /**
   * Opts this story into the narrow-column badge treatment (kicker rendered as
   * a pill straddling a rounded outline). It is a page-level accent granted to
   * a single story per page, so it is decided during page generation rather
   * than derived from the box's own geometry.
   */
  badgeKickerEnabled?: boolean;
  inlineSubheadingColor?: string;
  author: string;
  /**
   * Editorial-page author block: the writer's portrait and the short summary
   * printed under their name.
   *
   * Optional and read only on editorial pages — the name itself comes from
   * `author`, which every story already carries. News pages ignore both.
   */
  editorPortraitUrl?: string;
  editorSummary?: string;
  letterAuthor?: string;
  letterLocation?: string;
  letterEmail?: string;
  letterPhone?: string;
  /**
   * The writer's name for the author block.
   *
   * Held apart from `author` because that field is blanked whenever the byline
   * is suppressed — which is every box on an editorial page. Reading the name
   * from `author` there would always find it empty.
   */
  editorName?: string;
  location: string;
  agency: string;
  factBox: ArticleFactBoxData;
  factBoxTheme: FactBoxTheme;
  pullQuote: ArticlePullQuoteData;
  pullQuoteTheme: PullQuoteTheme;
  editorialPreset: EditorialStylePresetName;
  typography: UniversalTypographyControls;
  containerStyles: ArticleObjectContainerStyles;
  caption: ArticleCaptionData;
  body: RichTextContent;
  bodyParagraphs?: ArticleParagraphTypography[];
  columnCount: number;
  headlineColor?: string;
  /**
   * Extra points of clearance inserted between the headline block and
   * whatever flows under it (byline, or subheadline/body when present).
   * Purely additive on top of the box's normal spacing rules — undefined
   * everywhere except stories that opt in, so it changes nothing by default.
   */
  headlineToBylineExtraGap?: number;
  /**
   * Overrides the kicker label's colour (everything through the colon, e.g.
   * "बड़ा प्रशासनिक कदम:") for a two-toned kicker. Undefined everywhere
   * except stories that opt in, which fall back to the standard kicker red.
   * Narrow/badge-style kickers ignore this — they're solid white-on-colour
   * by design.
   */
  kickerLabelColor?: string;
};

export type ArticleFactBoxData = {
  headline: RichTextContent;
  bullets: RichTextContent[];
};

export type ArticlePullQuoteData = {
  text: RichTextContent;
};

/**
 * The typographic rules a front page composes under.
 *
 * A front page runs shorter boxes than an inside page — a mid-band brief is a
 * ~10% strip of the sheet — and the generic hierarchy sizes a headline from the
 * box's importance without asking how much room the body still needs. Left alone
 * that produces a display headline over two lines of text. These budgets cap the
 * headline and the photo against the box's own height so every box keeps a
 * readable column of copy, and the rest strips furniture a front page does not
 * carry.
 */
export type FrontPageArticleStyle = {
  /** Largest share of the box height the headline block may consume. */
  headlineHeightBudget: number;
  /** Largest share of the box height the photo may consume. */
  imageHeightBudget: number;
  /** Box padding in points. Small, but never zero — text must not touch an edge. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Front pages carry no photo captions. */
  suppressCaptions: boolean;
  /**
   * Drop in-paragraph subheadings in boxes with this many internal text columns
   * or fewer — they read as noise in a narrow measure.
   */
  suppressInlineSubheadingsAtOrBelowColumns: number;
  /**
   * A photo never spans every internal column: at least one column of text always
   * runs beside it, so a 2-column box gets a 1-column photo.
   */
  alwaysLeaveTextColumnBesideImage: boolean;
  /**
   * Pin every box's body text to one page-wide baseline grid instead of letting
   * each box start its own grid at its own top edge, so lines in adjacent
   * columns sit on the same rungs across the whole page.
   *
   * Front-page-only, like the rest of this style: switching it on shifts body
   * text by up to a rung, and inside pages are meant to compose unchanged.
   */
  alignBodyToPageBaselineGrid: boolean;
  /**
   * One body size and leading for every box on the page, overriding the
   * per-priority body sizes the story hierarchy would otherwise hand out.
   *
   * Snapping alone cannot make columns line up while the boxes are set at
   * different sizes. The grid snaps the *top* of a text block, but a line's
   * baseline sits one ascent below that top, and ascent scales with font size —
   * so a 9.3pt column and an 8.8pt column starting on the same rung still print
   * their baselines a fraction apart, and the gap compounds down the page. A
   * printed newspaper avoids this by setting every column of body copy in one
   * size and one leading, which is what this pins.
   *
   * `lineHeight` is a multiple of the font size; pick the pair so that their
   * product lands on a whole number of baseline rungs.
   */
  bodyType: { fontSizePt: number; lineHeight: number };
  /**
   * Share of the headline block's trailing leading to reclaim, 0–1.
   *
   * A headline line box is `fontSize * lineHeight` tall, so the block ends well
   * below the last row of glyphs — at a 1.28 line height a 36pt headline hangs
   * about 10pt of empty leading under itself. Whatever follows is positioned
   * off the bottom of that box, so the flat inter-element gaps (1.5–3pt) sit on
   * top of the slack rather than replacing it, and the headline reads as
   * floating well clear of its story. Display type on a printed page is set
   * tight to its glyphs instead.
   *
   * This reclaims that trailing leading for the following element only; the
   * headline's own box is untouched, so nothing reflows or reshapes. Keep it
   * below 1 — the remainder, plus the inter-element gap, is what stops a
   * descender from touching the line beneath.
   */
  headlineTrailingLeadingTrim: number;
  /**
   * How a one-column box titles itself.
   *
   * Such a box gets two lines of a very narrow measure, which a full headline
   * does not fit. Trimming the headline to make it fit cuts it mid-phrase and
   * leaves the reclaimed space empty below. Each record carries three
   * title-length fields — kicker, headline, subheadline — and the subheadline
   * is both the shortest and written to stand alone, so a narrow box uses that
   * and prints no subheadline underneath.
   */
  narrowBoxTitle: {
    /** Title a narrow box with its subheadline rather than its headline. */
    useSubheadline: boolean;
    /**
     * Trailing-leading trim for a narrow box's title, replacing
     * `headlineTrailingLeadingTrim` there. A one-column box has the least room
     * to spare, so it reclaims all of the slack rather than most of it.
     */
    trailingLeadingTrim: number;
    /**
     * Set the title edge to edge on every line, growing it to fill the measure.
     * A short line in a one-column measure leaves an obvious notch of white at
     * the right, and the depth the type does not take collects as the gap under
     * the headline — filling the measure closes both at once.
     */
    fillMeasure: boolean;
  };
  /**
   * Set the subheadline banner as a single ruled line, shrinking the type until
   * the whole line fits rather than cutting the words that overrun.
   *
   * A two-line banner reads as a black block rather than a rule under the
   * headline, which is not how a printed page uses one.
   */
  subheadlineBannerSingleLine: boolean;
  /**
   * Hard ceiling on how many lines a headline may run to.
   *
   * Left undefined the composer uses its own rule — two lines for a brief, a
   * filler or a one-column box, three for a "secondary" story and four
   * otherwise. A front page rarely reaches those because it caps its two-column
   * boxes separately; an inside page's boxes are deeper, so the same rule let
   * its headlines run to a third line.
   */
  headlineMaxLines?: number;
  /**
   * Points between the headline and the first line of copy.
   *
   * Left undefined the composer scales the gap with the headline's own size — a
   * rule that suits a page where a byline or a banner sits between the two. The
   * body's start is then snapped UP to the 6pt baseline grid, and the two
   * compound into roughly a blank line under every headline. A page that states
   * its own figure here may go negative, letting the snap land on the previous
   * grid line instead; the headline's frame carries the descender room, so
   * nothing collides.
   */
  headlineToBodyGap?: number;
};

/**
 * Editorial-page house style.
 *
 * The comment pages are set differently from news pages: the copy carries no
 * byline and no in-paragraph subheadings, because the writer is identified by a
 * portrait and name block beside the text instead, and a signed comment reads
 * as one continuous argument rather than as a report broken into sections.
 *
 * Present only on stories composed for an editorial page, so news pages compose
 * exactly as they did before.
 */
export type EditorialPageArticleStyle = {
  /** No byline anywhere on the page — the author block carries the name. */
  suppressByline: boolean;
  /** No in-paragraph subheadings; a comment runs as continuous argument. */
  suppressInlineSubheadings: boolean;
  /**
   * No subheadline banner. Page 8 sets a headline and goes straight into the
   * copy; the reversed black bar the news pages use appears nowhere on it.
   */
  suppressSubheadline: boolean;
  /**
   * How much of the headline's trailing leading to reclaim, 0–1.
   *
   * A headline's frame carries the leftover of its line-height below the last
   * row of glyphs, plus the frame's own bottom padding. Left in place the two
   * print as a white gap between the headline and the first line of copy. The
   * front page reclaims them; without this the editorial page did not, and its
   * display headlines — the largest on any page — showed the gap most of all.
   */
  headlineTrailingLeadingTrim: number;
  /**
   * Points between the headline and the first line of copy.
   *
   * The news-page rule scales this with the headline's own size, which is right
   * where a byline or a banner sits between the two. The editorial page has
   * neither — its headline runs straight into the argument — so a display
   * headline was opening a 40pt hole under itself.
   */
  headlineToBodyGap: number;
};

export type ArticleCompositionSettings = {
  showRegionDebug: boolean;
  bodyRendererMode?: "line" | "segmented";
  headlineScale: number;
  baselineGridSize: number;
  articleEndBreathingSpaceEnabled?: boolean;
  articleEndBreathingSpaceMm?: number;
  selectiveDividerLinesEnabled?: boolean;
  selectiveDividerLineRatio?: number;
  storyDecorationIndex?: number;
  storyDecorationCount?: number;
  enableDropCap: boolean;
  enableFactBox: boolean;
  enablePullQuote: boolean;
  opticalTypography: boolean;
  productionView?: boolean;
  storyHierarchyStyle?: StoryHierarchyVisualStyle;
  pageBounds?: { x: number; y: number; width: number; height: number };
  otherStories?: { id: string; x: number; y: number; width: number; height: number }[];
  /**
   * Page-absolute rectangles this article's body must flow around, on top of the
   * obstacles it derives itself (image, fact box, pull quote). Used for a story
   * box nested inside this one — the front page's boxed sidebar — so the parent
   * keeps its full headline measure while its text divides around the sidebar.
   */
  reservedRegions?: { x: number; y: number; width: number; height: number }[];
  /**
   * Front-page house style. Present only on stories composed for a front page, so
   * every rule it carries is scoped to that page and inside pages compose exactly
   * as they did before.
   */
  frontPageStyle?: FrontPageArticleStyle;
  /**
   * Inside-page house style — the same rules as the front page's, tuned for a
   * section page.
   *
   * Separate from `frontPageStyle` on purpose. The composer branches on the
   * mere PRESENCE of `frontPageStyle` in a dozen places to switch on geometry
   * measured for the front page's own bands (its two- and three-column package
   * shapes, its lower-band rules). An inside page wants the typography — the
   * headline budget, the baseline grid, the body size, the trimmed leading —
   * without any of that band geometry, so it carries its own field and the
   * composer reads the shared fields from whichever of the two is set.
   */
  insidePageStyle?: FrontPageArticleStyle;
  /** Suppresses inside-page gutter hairlines for custom layouts that draw their own visual separation. */
  suppressColumnRules?: boolean;
  /** Draw body copy as natural lines instead of per-word positioned segments. */
  suppressBodySegments?: boolean;
  /** Render body columns through Konva Text's native justify path. */
  nativeBodyJustifyText?: boolean;
  /** Allow conservative English body hyphenation during wrapping. */
  englishBodyHyphenation?: boolean;
  /** Keep rendered body word segments inside their measured slots. */
  constrainBodySegments?: boolean;
  /** Inset body text from column/gutter edges before justification. */
  bodyColumnEdgeInsetPt?: number;
  /** Youth UPDATE English body face override; scoped by the page generator. */
  youthUpdateEnglishBodyFontFamily?: string;
  /**
   * Reclaim the part of the headline's descender band that its last line does
   * not actually use, so body copy starts under the real ink rather than under
   * a reserved depth sized for Devanagari.
   *
   * The composer's headline slack model assumes glyph ink fills a full em, which
   * holds for Devanagari (matras above, conjuncts below) but leaves a visible
   * white band under a Latin headline that ends without a descender. Off by
   * default and set only for Youth UPDATE's English stories, so every other
   * publisher — and this publisher's own Hindi copy — composes exactly as before.
   */
  reclaimUnusedHeadlineDescender?: boolean;
  /**
   * Removes the two places this composer pays for the same vertical space
   * twice above the body:
   *
   * 1. The byline's reserved height is already ceil-snapped to the baseline
   *    grid, and the lead-region total ceil-snaps it again — up to two empty
   *    rows, visible only when the image sits to the right (a left/first-column
   *    image measures the byline's real ink instead).
   * 2. A subheadline banner already carries its own framePaddingBottom, so
   *    adding `spacing.datelineToContent` on top repeats it — with a figure
   *    measured for the dateline step, not this one.
   *
   * Neither is a script or style choice; both are accounting mistakes. Off by
   * default and set only for Youth UPDATE, so no other publisher's boxes move.
   */
  tightBylineToBodyGap?: boolean;
  /**
   * Editorial-page house style. Present only on stories composed for an
   * editorial page, so every rule it carries is scoped to that page.
   */
  editorialPageStyle?: EditorialPageArticleStyle;
  /** Dynamic image balancing configuration. */
  dynamicImageBalancing?: Partial<{
    enabled: boolean;
    maxHeightIncreaseRatio: number;
    maxUpscaleRatio: number;
    minimumWhitespaceLines: number;
    maximumIterations: number;
  }>;
  /** Internal flag — prevents recursive balancer invocation during candidate passes. */
  _skipDynamicImageBalancing?: boolean;
};

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type EditorState = {
  stories: StoryFrame[];
  selectedStoryId: StoryFrameId | null;
  selectedObjectType: EditorObjectType;
  selectedObjects: EditorSelectedObject[];
  selectedRichTextRange: EditorTextRange | null;
  selectedParagraphIndex: number;
  typographyEditingScope: TypographyEditingScope;
  editingMode: EditorEditingMode;
  caretPosition: number | null;
  selectionBounds: EditorSelectionBounds | null;
  pageType: "front" | "state" | "city" | "national" | "sports" | "editorial";
  productionView: boolean;
  zoom: number;
};

export type ArticleTextStyle = {
  fill: string;
  backgroundColor?: string;
  opacity?: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  align?: "left" | "center" | "right" | "justify";
  fontStyle?: string;
  letterSpacing?: number;
  wordSpacing?: number;
  textDecoration?: "underline" | "";
  wrap?: "word" | "char" | "none";
};

export type ArticleLayoutTextBlock = Point & {
  width: number;
  text: string;
  wrappedLines: string[];
  lineCount: number;
  height: number;
  overflow: boolean;
  style: ArticleTextStyle;
  lineBoxes: ArticleLayoutTextLine[];
  layoutBounds?: Point & Size;
  frameBounds?: Point & Size;
  containerStyle?: ObjectContainerStyle;
  containerBounds?: Point & Size;
};

export type BylineLayout = ArticleLayoutTextBlock;

export type ArticleLayoutTextLine = Point & {
  width: number;
  height: number;
  text: string;
  style: ArticleTextStyle;
  justify?: boolean;
  paragraphIndex?: number;
  measuredWidth?: number;
  renderedWidth?: number;
  measuredFontFamily?: string;
  measuredFontSize?: number;
  measuredFontStyle?: string;
  measuredFontWeight?: string;
  measuredFontString?: string;
  scaleX?: number;
  segments?: ArticleLayoutTextSegment[];
};

export type ArticleLayoutTextSegment = Point & {
  width: number;
  height: number;
  text: string;
  style: ArticleTextStyle;
  role?: "byline-dot";
  measuredWidth?: number;
  renderedWidth?: number;
  scaleX?: number;
  constrainWidth?: boolean;
  measuredFontFamily?: string;
  measuredFontSize?: number;
  measuredFontStyle?: string;
  measuredFontWeight?: string;
  measuredFontString?: string;
  renderedFontFamily?: string;
  renderedFontSize?: number;
  renderedFontStyle?: string;
  renderedFontWeight?: string;
  renderedFontVariant?: string;
};

export type DropCapLayout = Point &
  Size & {
    text: string;
    style: ArticleTextStyle;
  };

export type FactBoxLayout = Point &
  Size & {
    headline: ArticleLayoutTextBlock;
    bullets: ArticleLayoutTextBlock[];
    fill: string;
    stroke: string;
    strokeWidth: number;
    padding: number;
    borderRadius?: number;
  };

export type PullQuoteLayout = Point &
  Size & {
    textBlock: ArticleLayoutTextBlock;
    fill: string;
    stroke: string;
    strokeWidth: number;
    padding: number;
  };

export type CaptionLayout = Point &
  Size & {
    textBlock: ArticleLayoutTextBlock;
    creditBlock: ArticleLayoutTextBlock | null;
    sourceBlock: ArticleLayoutTextBlock | null;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
    position: CaptionPosition;
    creditPosition: CaptionCreditPosition;
  };

export type EditorialLabelLayout = Point &
  Size & {
    textBlock: ArticleLayoutTextBlock;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius: number;
    padding: number;
  };

export type ArticleLayoutLine = {
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type ArticleDebugRegion = Point &
  Size & {
    id: string;
    status: "usable" | "discarded";
    order: number;
    columnIndex: number;
    area: number;
    capacity: number;
    assignedLineCount: number;
    remainingCapacity: number;
    discardReasons: string[];
  };

export type ArticleParagraphLayoutBounds = Point &
  Size & {
    index: number;
    label: string;
    lineCount: number;
  };

export type ArticleLayoutRegion = Point &
  Size & {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    shapeType?: StoryImageShapeType;
    shapePoints?: StoryImageShapePoint[];
    crop?: StoryImageCropSettings;
    label?: ArticleLayoutTextBlock;
    lines?: ArticleLayoutLine[];
    /** Source-image crop X offset (pixels) for proportional cover crop. */
    coverCropX?: number;
    /** Source-image crop Y offset (pixels) for proportional cover crop. */
    coverCropY?: number;
    /** Source-image crop width (pixels) for proportional cover crop. */
    coverCropWidth?: number;
    /** Source-image crop height (pixels) for proportional cover crop. */
    coverCropHeight?: number;
    /** Source image aspect ratio (width / height). */
    sourceAspectRatio?: number;
    /** Corner radius (pt) the photo is clipped to; 0/undefined = square corners. */
    cornerRadius?: number;
  };

export type ArticleLayoutBodyColumn = Point &
  Size & {
    id: string;
    columnIndex: number;
    capacity: number;
    assignedLineCount: number;
    remainingCapacity: number;
    lines: ArticleLayoutTextLine[];
    nativeJustifyText?: boolean;
    lineCount: number;
    overflow: boolean;
  };

export type ArticleLayoutBodyRegion = ArticleLayoutRegion & {
  text: string;
  wrappedLines: string[];
  lineCount: number;
  remainingLineCount: number;
  overflow: boolean;
  dropCap: DropCapLayout | null;
  columns: ArticleLayoutBodyColumn[];
};

export type ArticleCompositionMetrics = {
  headlineLines: number;
  bodyLines: number;
  visibleLines: number;
  hiddenLines: number;
  overflow: boolean;
  editorialFitScore: number;
  fillPercentage: number;
  whitespacePercentage: number;
  overflowPercentage: number;
  fitStatus: EditorialFitStatus;
  storyDensityPercent: number;
  internalWhitespacePercent: number;
  bodyFillPercent: number;
  unusedVerticalSpace: number;
  bodyWhitespacePercent: number;
  averageSpacing: number;
  minimumSpacing: number;
  maximumSpacing: number;
  spacingVariance: number;
  compositionPasses: number;
  wordsMoved: number;
  bodyCompositionBadnessScore: number;
  bodyFinalLineWidths: number[];
  paragraphCandidatesTested: number;
  selectedParagraphCandidate: string;
  riverScore: number;
  widowScore: number;
  orphanScore: number;
  paragraphQuality: number;
  hjParagraphQuality: number;
  hjGrayValue: number;
  hjGrayBalanceScore: number;
  hjAverageTracking: number;
  hjTrackingVariance: number;
  hjGapVariance: number;
  hjHyphenCount: number;
  hjOptimizationPasses: number;
  hjRejectedCandidates: number;
  hjAcceptedCandidates: number;
  hjParagraphCandidates: number;
  hjBeamWidth: number;
  hjCacheHit: boolean;
  hjOptimizationTimeMs: number;
  hjCompositionTimeMs: number;
  hjFinalBadness: number;
  storyScore: number;
  paragraphScores: number[];
  storyFillPercent: number;
  bottomWhitespace: number;
  storyCompositionIterations: number;
  storyOptimizationPasses: number;
  averageParagraphScore: number;
  bestCandidateScore: number;
  rejectedCandidates: number;
  finalStoryQuality: number;
  opticalGlyphCount: number;
  leftHangingCount: number;
  rightHangingCount: number;
  averageHangPercent: number;
  storyWidth: number;
  headlineMeasureWidth: number;
  renderedHeadlineWidth: number;
  headlineFillPercent: number;
  headlineFillLine1Percent: number;
  headlineFillLine2Percent: number;
  selectedHeadlineCandidateScore: number;
  selectedHeadlineCandidateType: HeadlineCandidateType;
  selectedHeadlineCandidateReason: string;
  headlineTopCandidateScores: HeadlineCandidateScore[];
  headlineOriginal: string;
  headlineGeneratedCandidates: string[][];
  headlineChosenCandidate: string[];
  headlineRenderedLines: string[];
  headlineRenderedLine1: string;
  headlineRenderedLine2: string;
  headlineRenderedLine3: string;
  headlineLineWidths: number[];
  headlineLineAvailableWidth: number;
  headlineLineOverflowPx: number[];
  headlineMaxOverflowPx: number;
  headlineAverageFillPercent: number;
  headlineUnusedPixels: number;
  imageHeight: number;
  imageCoveragePercent: number;
  textCoveragePercent: number;
  generatedRegions: number;
  consumedRegions: number;
  remainingText: number;
  usedColumns: number;
  unusedColumns: number;
  regionCount: number;
  usableRegions: number;
  discardedRegions: number;
  columnCount: number;
};

export type ArticleDecorativeDivider = {
  x: number;
  y: number;
  width: number;
  strokeWidth: number;
  color: string;
  style?: "solid" | "dotted";
  /** dot spacing in pt */
  dotSpacing: number;
  /** dot size in pt */
  dotSize: number;
};

export type ArticleLayout = {
  kicker: EditorialLabelLayout | null;
  strap: EditorialLabelLayout | null;
  headline: ArticleLayoutTextBlock;
  subheadlineBackground: ArticleLayoutRegion | null;
  subheadline: ArticleLayoutTextBlock;
  inlineSubheadline?: ArticleLayoutTextBlock[] | null;
  byline: BylineLayout;
  image: ArticleLayoutRegion | null;
  editorialFloatImage?: (ArticleLayoutRegion & {
    source: "articleImage";
    opacity?: number;
  }) | null;
  factBox: FactBoxLayout | null;
  pullQuote: PullQuoteLayout | null;
  caption: CaptionLayout | null;
  body: ArticleLayoutBodyRegion;
  debugTextRegions: ArticleDebugRegion[];
  paragraphBounds?: ArticleParagraphLayoutBounds[];
  containerStyles?: ArticleObjectContainerStyles;
  decorativeDividers?: ArticleDecorativeDivider[];
  metrics: ArticleCompositionMetrics;
};
