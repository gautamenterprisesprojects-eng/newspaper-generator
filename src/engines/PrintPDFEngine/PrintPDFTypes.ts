import type {
  ArticleBoxModel,
  ArticleLayout,
  ArticleLayoutLine,
  ArticleLayoutRegion,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  FactBoxLayout,
  PullQuoteLayout,
} from "@/types/editor";

export type PrintPDFColor = {
  cyan: number;
  magenta: number;
  yellow: number;
  key: number;
};

export type PrintPDFFontRole = "serif" | "sans" | "mono";

export type PrintPDFFontAsset = {
  id: string;
  role: PrintPDFFontRole;
  familyNames: string[];
  data: Uint8Array | ArrayBuffer;
};

export type PrintPDFImageAsset = {
  id: string;
  data: Uint8Array | ArrayBuffer;
  mimeType: "image/jpeg" | "image/png";
  pixelWidth: number;
  pixelHeight: number;
};

export type PrintPDFArticle = {
  articleBox: ArticleBoxModel;
  layout: ArticleLayout;
  imageAssetId?: string;
};

export type PrintPDFPage = {
  width: number;
  height: number;
  articles: PrintPDFArticle[];
};

export type PrintPDFOptions = {
  bleed: number;
  cropMarkLength: number;
  cropMarkOffset: number;
  cropMarkStrokeWidth: number;
  minimumImageDpi: number;
  subsetFonts: boolean;
  allowStandardFontFallback?: boolean;
};

export type PrintPDFDocumentInput = {
  pages: PrintPDFPage[];
  fonts: PrintPDFFontAsset[];
  images?: PrintPDFImageAsset[];
  options?: Partial<PrintPDFOptions>;
};

export type PrintPDFPreflightIssue = {
  code:
    | "missing-font"
    | "missing-image"
    | "low-image-dpi"
    | "empty-document"
    | "page-boundary";
  severity: "error" | "warning";
  message: string;
};

export type PrintPDFImageMetric = {
  imageId: string;
  effectiveDpiX: number;
  effectiveDpiY: number;
  placedWidth: number;
  placedHeight: number;
};

export type PrintPDFResult = {
  pdfBytes: Uint8Array;
  pageCount: number;
  trimSize: {
    width: number;
    height: number;
  };
  mediaSize: {
    width: number;
    height: number;
  };
  preflight: {
    printReady: boolean;
    issues: PrintPDFPreflightIssue[];
    embeddedFontIds: string[];
    imageMetrics: PrintPDFImageMetric[];
  };
};

export type PrintPDFRenderContext = {
  pageHeight: number;
  trimOffset: number;
};

export type PrintableTextPrimitive = ArticleLayoutTextBlock | ArticleLayoutTextLine;
export type PrintableRegionPrimitive =
  | ArticleLayoutRegion
  | FactBoxLayout
  | PullQuoteLayout;
export type PrintableLinePrimitive = ArticleLayoutLine;
export type PrintableTextStyle = ArticleTextStyle;
