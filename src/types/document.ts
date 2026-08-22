import type {
  ArticleCompositionMetrics,
  ArticleData,
  ArticleBoxModel,
  StoryColumnSpan,
  StoryFrame,
  StoryImageSettings,
  StoryPriority,
  StoryWorkflowStatus,
  StoryTypographySettings,
} from "@/types/editor";
import type { HeaderSystemState } from "@/types/header";
import type { PageLanguageMode } from "@/lib/newswire";
import type { PageMaster, PageType } from "@/types/page";

export type NewspaperDocumentId = string;
export type NewspaperPageId = string;
export type NewspaperStoryId = string;
export type NewspaperAssetId = string;
export type NewspaperAdvertisementId = string;
export type NewspaperFrameId = string;
export type NewspaperMasterPageId = string;
export type NewspaperLayerId = string;
export type NewspaperPageTemplateId = string;
export type NewspaperMasterElementId = string;
export type NewspaperStyleId = string;

export type EditionPageStatus =
  | "draft"
  | "in-progress"
  | "ready"
  | "needs-review"
  | "overflow"
  | "locked";

export type EditionPageColorLabel =
  | "none"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray";

export type EditionCanvasMode =
  | "single"
  | "facing"
  | "continuous-vertical"
  | "continuous-horizontal"
  | "presentation";

export type NewspaperLayer = {
  id: NewspaperLayerId;
  name: string;
  visible: boolean;
  locked: boolean;
  print: boolean;
  export: boolean;
  opacity: number;
  color: string;
  zIndex: number;
};

export type NewspaperGuideKind =
  | "horizontal"
  | "vertical"
  | "baseline"
  | "column"
  | "margin"
  | "safe-area"
  | "bleed"
  | "slug"
  | "snap";

export type NewspaperMasterElementType =
  | "page-header"
  | "page-footer"
  | "running-header"
  | "running-footer"
  | "masthead"
  | "edition-name"
  | "publication-date"
  | "page-number"
  | "section-name"
  | "guide-frame"
  | "advertisement-zone"
  | "logo"
  | "color-bar"
  | "registration-mark"
  | "crop-mark"
  | "watermark";

export type NewspaperMasterElement = {
  id: NewspaperMasterElementId;
  type: NewspaperMasterElementType;
  layerId: NewspaperLayerId;
  bounds: ArticleBoxModel;
  locked: boolean;
  hidden: boolean;
  print: boolean;
  export: boolean;
  zIndex: number;
  content?: string;
  style: Record<string, unknown>;
  metadata: {
    name: string;
    token?: "publication" | "edition" | "date" | "pageNumber" | "section";
    createdAt?: string;
    updatedAt?: string;
  } & Record<string, unknown>;
};

export type NewspaperMasterPage = {
  id: NewspaperMasterPageId;
  name: string;
  prefix: string;
  basedOnMasterId?: NewspaperMasterPageId | null;
  frames: NewspaperMasterElement[];
  guides: NewspaperGuide[];
  layerIds: NewspaperLayerId[];
  pageDecorations: NewspaperMasterElement[];
  runningElements: NewspaperMasterElement[];
  metadata: {
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type NewspaperPageNumberingStyle = "arabic" | "roman" | "alphabetic";

export type NewspaperPageNumbering = {
  style: NewspaperPageNumberingStyle;
  restartAt?: number | null;
  prefix?: string;
  sectionPrefix?: string;
};

export type NewspaperPageTemplate = {
  id: NewspaperPageTemplateId;
  name: string;
  pageType: PageType;
  masterId: NewspaperMasterPageId | null;
  guides: NewspaperGuide[];
  columns: number;
  gutter: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  framePlaceholders: {
    id: string;
    role: "lead" | "major" | "secondary" | "brief" | "filler" | "advertisement";
    bounds: ArticleBoxModel;
  }[];
};

export type NewspaperAdvertisementStatus =
  | "booked"
  | "reserved"
  | "artwork-received"
  | "approved"
  | "placed"
  | "printed"
  | "archived"
  | "cancelled"
  | "expired";

export type NewspaperAdvertisement = {
  id: NewspaperAdvertisementId;
  bookingId: string;
  client: string;
  agency?: string;
  brand?: string;
  campaign?: string;
  edition?: string;
  section?: string;
  pagePreference?: number | "any";
  width: number;
  height: number;
  columns: number;
  depth: number;
  colorMode: "cmyk" | "bw";
  premium: boolean;
  priority: "low" | "normal" | "high" | "premium";
  publishDate: string;
  expiryDate?: string;
  artworkAssetId?: NewspaperAssetId | null;
  status: NewspaperAdvertisementStatus;
  approved: boolean;
  reserved: boolean;
  placed: boolean;
  cancelled: boolean;
  expired: boolean;
  linkedFrameId?: NewspaperFrameId | null;
  revenue?: number;
  metadata?: Record<string, unknown>;
};

export type NewspaperStyleKind = "paragraph" | "character" | "object" | "frame" | "table" | "cell";

export type NewspaperStyleTheme = "hindi" | "english" | "magazine" | "tabloid" | "broadsheet";

export type NewspaperStyleBase = {
  id: NewspaperStyleId;
  name: string;
  kind: NewspaperStyleKind;
  basedOnId?: NewspaperStyleId | null;
  locked?: boolean;
  theme?: NewspaperStyleTheme;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type NewspaperParagraphStyleRole =
  | "headline"
  | "subheadline"
  | "body"
  | "caption"
  | "fact-box"
  | "pull-quote"
  | "byline"
  | "source"
  | "location"
  | "editorial"
  | "advertisement";

export type NewspaperParagraphStyleSettings = {
  role: NewspaperParagraphStyleRole;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  leading: number;
  leadingMode: "auto" | "exactly" | "at-least" | "percentage";
  leadingValue: number;
  tracking: number;
  characterSpacing: number;
  alignment: "left" | "center" | "right" | "justify";
  color: string;
  spaceBefore: number;
  spaceAfter: number;
  indent: {
    left: number;
    right: number;
    firstLine: number;
  };
  tabs: number[];
  dropCaps: {
    enabled: boolean;
    lines: number;
    characters: number;
  };
  rulesAbove: Record<string, unknown>;
  rulesBelow: Record<string, unknown>;
  background: string;
  border: Record<string, unknown>;
  hyphenation: boolean;
  justification: "browser" | "newspaper";
  keepOptions: Record<string, unknown>;
  widowOrphan: {
    widowLines: number;
    orphanLines: number;
  };
  baseline: {
    align: boolean;
    gridSize: number;
  };
};

export type NewspaperCharacterStyleSettings = {
  role: "bold" | "italic" | "highlight" | "link" | "quote" | "keyword" | "author" | "custom";
  overrides: Partial<{
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    fontStyle: "normal" | "italic";
    underline: boolean;
    color: string;
    backgroundColor: string;
    tracking: number;
    characterSpacing: number;
  }>;
};

export type NewspaperObjectStyleSettings = {
  role: "image-frame" | "advertisement-frame" | "fact-box" | "pull-quote" | "graphic" | "sidebar" | "custom";
  border: Record<string, unknown>;
  padding: Record<string, unknown>;
  shadow: Record<string, unknown>;
  opacity: number;
  cornerRadius: number;
  fill: string;
  stroke: string;
};

export type NewspaperFrameStyleSettings = {
  role: "body-frame" | "headline-frame" | "caption-frame" | "advertisement-frame" | "image-frame" | "custom";
  containerPadding: Record<string, unknown>;
  margins: Record<string, unknown>;
  background: string;
  border: Record<string, unknown>;
  grid: Record<string, unknown>;
};

export type NewspaperTableStyleSettings = {
  headerFill: string;
  bodyFill: string;
  border: Record<string, unknown>;
  alternateRows: boolean;
};

export type NewspaperCellStyleSettings = {
  padding: Record<string, unknown>;
  fill: string;
  border: Record<string, unknown>;
  alignment: "left" | "center" | "right";
};

export type NewspaperStyle =
  | (NewspaperStyleBase & { kind: "paragraph"; settings: NewspaperParagraphStyleSettings })
  | (NewspaperStyleBase & { kind: "character"; settings: NewspaperCharacterStyleSettings })
  | (NewspaperStyleBase & { kind: "object"; settings: NewspaperObjectStyleSettings })
  | (NewspaperStyleBase & { kind: "frame"; settings: NewspaperFrameStyleSettings })
  | (NewspaperStyleBase & { kind: "table"; settings: NewspaperTableStyleSettings })
  | (NewspaperStyleBase & { kind: "cell"; settings: NewspaperCellStyleSettings });

export type NewspaperStyleLibrary = {
  styles: Record<NewspaperStyleId, NewspaperStyle>;
  assignments: Record<string, NewspaperStyleId>;
  overrides: Record<string, boolean>;
  activeTheme: NewspaperStyleTheme;
};

export type NewspaperDocumentMetadata = {
  newspaperName: string;
  edition: string;
  date: string;
  language: string;
  version: string;
};

export type NewspaperStoryObject = {
  id: NewspaperStoryId;
  name?: string;
  category?: string;
  tags?: string[];
  status?: StoryWorkflowStatus;
  locked?: boolean;
  hidden?: boolean;
  headline: ArticleData["headline"];
  subheadline: ArticleData["subheadline"];
  body: ArticleData["body"];
  caption: ArticleData["caption"];
  photo: NewspaperAssetId | null;
  factBox: ArticleData["factBox"];
  pullQuote: ArticleData["pullQuote"];
  richText: {
    kicker: ArticleData["kicker"];
    strap: ArticleData["strap"];
  };
  imageSettings: StoryImageSettings;
  typography: StoryTypographySettings & {
    universal: ArticleData["typography"];
  };
  editorialStyling: {
    editorialPreset: ArticleData["editorialPreset"];
    factBoxTheme: ArticleData["factBoxTheme"];
    pullQuoteTheme: ArticleData["pullQuoteTheme"];
    subheadlineBanner: ArticleData["subheadlineBanner"];
    containerStyles: ArticleData["containerStyles"];
    /** Page-level accent granted to one story per page; see ArticleData. */
    badgeKickerEnabled?: ArticleData["badgeKickerEnabled"];
  };
  byline: {
    author: string;
    location: string;
    agency: string;
  };
  columnCount: number;
  compositionMetrics: ArticleCompositionMetrics | null;
};

export type NewspaperStoryPlacement = ArticleBoxModel & {
  id: string;
  storyId: NewspaperStoryId;
  role?: StoryFrame["role"];
  priority: StoryPriority;
  columnStart: StoryColumnSpan;
  columnSpan: StoryColumnSpan;
  locked?: boolean;
  hidden?: boolean;
};

export type NewspaperFrameType =
  | "article"
  | "headline"
  | "subheadline"
  | "body"
  | "image"
  | "caption"
  | "fact-box"
  | "pull-quote"
  | "graphic"
  | "advertisement"
  | "table"
  | "custom";

export type NewspaperFrameBounds = ArticleBoxModel;

export type NewspaperFrameObject = {
  id: NewspaperFrameId;
  pageId: NewspaperPageId;
  storyId?: NewspaperStoryId;
  frameType: NewspaperFrameType;
  bounds: NewspaperFrameBounds;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  selected: boolean;
  geometry: {
    columnStart?: StoryColumnSpan;
    columnSpan?: StoryColumnSpan;
    role?: StoryFrame["role"];
    priority?: StoryPriority;
  };
  style: Record<string, unknown>;
  containerStyle: Record<string, unknown>;
  frameStyle: Record<string, unknown>;
  baselineSettings: {
    enabled: boolean;
    start: number;
    increment: number;
  };
  snapSettings: {
    snapToGrid: boolean;
    snapToGuides: boolean;
    snapToBaseline: boolean;
  };
  metadata: {
    name?: string;
    createdAt?: string;
    updatedAt?: string;
  } & Record<string, unknown>;
};

export type NewspaperGrid = {
  columns: number;
  gutter: number;
};

export type NewspaperGuide = {
  id: string;
  x?: number;
  y?: number;
  label?: string;
  kind?: NewspaperGuideKind;
  locked?: boolean;
  visible?: boolean;
};

export type NewspaperBaselineGrid = {
  start: number;
  increment: number;
  color: string;
  snap: boolean;
  opacity: number;
  visible: boolean;
};

export type NewspaperPageSettings = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  columns: number;
  gutter: number;
  baselineGrid: NewspaperBaselineGrid;
  bleed: number;
  safeArea: number;
};

export type NewspaperPageThumbnail = {
  cacheKey: string;
  storyCount: number;
  overflow: boolean;
  missingAssets: boolean;
  updatedAt: string;
};

export type NewspaperPageObject = {
  id: NewspaperPageId;
  pageNumber: number;
  pageType: PageType;
  sectionName?: string;
  status?: EditionPageStatus;
  colorLabel?: EditionPageColorLabel;
  locked?: boolean;
  hidden?: boolean;
  masterPageId?: string;
  masterOverrides?: Record<NewspaperMasterElementId, NewspaperMasterElement>;
  numbering?: NewspaperPageNumbering;
  masterPage: PageMaster;
  grid: NewspaperGrid;
  guides: NewspaperGuide[];
  settings?: NewspaperPageSettings;
  thumbnail?: NewspaperPageThumbnail;
  updatedAt?: string;
  frameIds: NewspaperFrameId[];
  /** @deprecated Compatibility shadow. Pages own frames; frames reference stories. */
  stories: NewspaperStoryPlacement[];
  advertisements: NewspaperAdvertisementId[];
  photos: NewspaperAssetId[];
  notes: string[];
};

export type NewspaperAsset = {
  id: NewspaperAssetId;
  type: "image" | "logo" | "illustration" | "icon" | "advertisement" | "graphic" | "svg" | "pdf" | "font" | "other";
  name: string;
  filename?: string;
  originalFilename?: string;
  hash?: string;
  size?: number;
  width?: number;
  height?: number;
  resolution?: {
    width: number;
    height: number;
  };
  dpi?: number;
  colorSpace?: "RGB" | "CMYK" | "Grayscale" | "Unknown";
  format?: string;
  createdAt?: string;
  modifiedAt?: string;
  copyright?: string;
  credit?: string;
  photographer?: string;
  caption?: string;
  keywords?: string[];
  section?: string;
  tags?: string[];
  usageCount?: number;
  linkedFrames?: NewspaperFrameId[];
  linkMode?: "linked" | "embedded";
  linkStatus?: "ok" | "missing" | "broken" | "moved" | "renamed";
  thumbnailUrl?: string;
  previewUrl?: string;
  source?: string;
  folder?: string;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
};

export type NewspaperDocument = {
  id: NewspaperDocumentId;
  metadata: NewspaperDocumentMetadata;
  editionName: string;
  editionDate: string;
  publication: string;
  pages: NewspaperPageObject[];
  masters: Record<NewspaperMasterPageId, NewspaperMasterPage>;
  masterPages: PageMaster[];
  stories: Record<NewspaperStoryId, NewspaperStoryObject>;
  frames: Record<NewspaperFrameId, NewspaperFrameObject>;
  assets: Record<NewspaperAssetId, NewspaperAsset>;
  advertisements: Record<NewspaperAdvertisementId, NewspaperAdvertisement>;
  layers: Record<NewspaperLayerId, NewspaperLayer>;
  pageTemplates: Record<NewspaperPageTemplateId, NewspaperPageTemplate>;
  styles: NewspaperStyleLibrary;
  headerSystem: HeaderSystemState;
  settings: {
    activePageId?: NewspaperPageId;
    canvasMode: EditionCanvasMode;
    pageManagerVisible: boolean;
    languageMode?: PageLanguageMode;
    bylineName?: string;
  } & Record<string, unknown>;
};

export type EditionDocument = NewspaperDocument;
