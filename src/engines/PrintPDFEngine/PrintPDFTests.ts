import { existsSync, readFileSync } from "node:fs";
import type {
  ArticleBoxModel,
  ArticleLayout,
  ArticleLayoutTextBlock,
  ArticleTextStyle,
} from "@/types/editor";
import { generatePrintPDF, parsePrintColor, sanitizePdfRenderedText } from "./PrintPDFEngine";
import type { PrintPDFFontAsset, PrintPDFImageAsset } from "./PrintPDFTypes";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const articleBox: ArticleBoxModel = {
  x: 72,
  y: 90,
  width: 360,
  height: 540,
};

const headlineStyle: ArticleTextStyle = {
  fill: "#11100d",
  fontFamily: "Noto Serif Devanagari, Mangal, serif",
  fontSize: 24,
  fontStyle: "bold",
  lineHeight: 1.1,
  wrap: "none",
};

const bodyStyle: ArticleTextStyle = {
  fill: "#3d382f",
  fontFamily: "Noto Sans Devanagari, Mangal, sans-serif",
  fontSize: 12,
  lineHeight: 1.35,
  wrap: "none",
};

const createTextBlock = (
  x: number,
  y: number,
  width: number,
  text: string,
  style: ArticleTextStyle,
): ArticleLayoutTextBlock => {
  const height = style.fontSize * style.lineHeight;

  return {
    x,
    y,
    width,
    text,
    wrappedLines: [text],
    lineCount: 1,
    height,
    overflow: false,
    style,
    lineBoxes: [
      {
        x,
        y,
        width,
        height,
        text,
        style,
      },
    ],
  };
};

const getSystemFont = () => {
  const candidates = [
    "C:\\Windows\\Fonts\\Nirmala.ttf",
    "C:\\Windows\\Fonts\\Mangal.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ];
  const fontPath = candidates.find((candidate) => existsSync(candidate));

  if (!fontPath) {
    throw new Error("No system font found for PrintPDFEngine tests");
  }

  return readFileSync(fontPath);
};

const getFonts = (): PrintPDFFontAsset[] => {
  const fontBytes = getSystemFont();

  return [
    {
      id: "test-serif",
      role: "serif",
      familyNames: ["Noto Serif Devanagari", "Mangal", "serif"],
      data: fontBytes,
    },
    {
      id: "test-sans",
      role: "sans",
      familyNames: ["Noto Sans Devanagari", "Mangal", "sans-serif"],
      data: fontBytes,
    },
    {
      id: "test-mono",
      role: "mono",
      familyNames: ["Arial", "monospace"],
      data: fontBytes,
    },
  ];
};

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const createTestImage = (): PrintPDFImageAsset => ({
  id: "photo-1",
  data: onePixelPng,
  mimeType: "image/png",
  pixelWidth: 1,
  pixelHeight: 1,
});

const createLayout = (): ArticleLayout => {
  const headline = createTextBlock(18, 18, 324, "Print PDF headline", headlineStyle);
  const subheadline = createTextBlock(18, 54, 324, "Subheadline stays vector", bodyStyle);
  const byline = createTextBlock(18, 78, 324, "Bhopal | Desk", bodyStyle);
  const captionTextBlock = createTextBlock(18, 236, 180, "Photo caption", {
    ...bodyStyle,
    fontSize: 10,
  });
  const caption: ArticleLayout["caption"] = {
    x: 18,
    y: 236,
    width: 180,
    height: captionTextBlock.height,
    textBlock: captionTextBlock,
    creditBlock: null,
    sourceBlock: null,
    position: "below-image",
    creditPosition: "below-caption",
  };
  const bodyLineHeight = 18;
  const bodyLines = ["Body line one", "Body line two", "Body line three"].map((text, index) => ({
    x: 18,
    y: 270 + index * bodyLineHeight,
    width: 140,
    height: bodyLineHeight,
    text,
    style: bodyStyle,
  }));

  return {
    kicker: null,
    strap: null,
    headline,
    subheadlineBackground: null,
    subheadline,
    byline,
    image: {
      x: 18,
      y: 108,
      width: 180,
      height: 120,
      fill: "#dfddd6",
      stroke: "#8a8377",
      strokeWidth: 1,
      lines: [
        {
          points: [18, 108, 198, 228],
          stroke: "#9a9387",
          strokeWidth: 1,
        },
      ],
      label: createTextBlock(18, 160, 180, "IMAGE", bodyStyle),
    },
    factBox: null,
    pullQuote: null,
    caption,
    body: {
      x: 18,
      y: 270,
      width: 324,
      height: 180,
      text: bodyLines.map((line) => line.text).join(" "),
      wrappedLines: bodyLines.map((line) => line.text),
      lineCount: bodyLines.length,
      remainingLineCount: 0,
      overflow: false,
      dropCap: null,
      columns: [
        {
          id: "body-column-1",
          x: 18,
          y: 270,
          width: 140,
          height: 180,
          columnIndex: 0,
          capacity: 10,
          assignedLineCount: bodyLines.length,
          remainingCapacity: 7,
          lines: bodyLines,
          lineCount: bodyLines.length,
          overflow: false,
        },
      ],
    },
    debugTextRegions: [],
    metrics: {
      headlineLines: 1,
      bodyLines: bodyLines.length,
      visibleLines: bodyLines.length,
      hiddenLines: 0,
      overflow: false,
      editorialFitScore: 100,
      fillPercentage: 100,
      whitespacePercentage: 0,
      overflowPercentage: 0,
      fitStatus: "PERFECT",
      storyDensityPercent: 100,
      internalWhitespacePercent: 0,
      bodyFillPercent: 100,
      unusedVerticalSpace: 0,
      bodyWhitespacePercent: 0,
      averageSpacing: 0,
      minimumSpacing: 0,
      maximumSpacing: 0,
      spacingVariance: 0,
      compositionPasses: 1,
      wordsMoved: 0,
      bodyCompositionBadnessScore: 0,
      bodyFinalLineWidths: bodyLines.map((line) => line.width),
      paragraphCandidatesTested: 1,
      selectedParagraphCandidate: "fixture",
      riverScore: 0,
      widowScore: 0,
      orphanScore: 0,
      paragraphQuality: 100,
      hjParagraphQuality: 100,
      hjGrayValue: 100,
      hjGrayBalanceScore: 100,
      hjAverageTracking: 0,
      hjTrackingVariance: 0,
      hjGapVariance: 0,
      hjHyphenCount: 0,
      hjOptimizationPasses: 1,
      hjRejectedCandidates: 0,
      hjAcceptedCandidates: 1,
      hjParagraphCandidates: 1,
      hjBeamWidth: 10,
      hjCacheHit: false,
      hjOptimizationTimeMs: 0,
      hjCompositionTimeMs: 0,
      hjFinalBadness: 0,
      storyScore: 0,
      paragraphScores: [100],
      storyFillPercent: 100,
      bottomWhitespace: 0,
      storyCompositionIterations: 1,
      storyOptimizationPasses: 1,
      averageParagraphScore: 100,
      bestCandidateScore: 0,
      rejectedCandidates: 0,
      finalStoryQuality: 100,
      opticalGlyphCount: 0,
      leftHangingCount: 0,
      rightHangingCount: 0,
      averageHangPercent: 0,
      storyWidth: 324,
      headlineMeasureWidth: 324,
      renderedHeadlineWidth: 324,
      headlineFillPercent: 100,
      headlineFillLine1Percent: 100,
      headlineFillLine2Percent: 0,
      selectedHeadlineCandidateScore: 0,
      selectedHeadlineCandidateType: "balanced",
      selectedHeadlineCandidateReason: "fixture",
      headlineTopCandidateScores: [],
      headlineOriginal: "Print headline",
      headlineGeneratedCandidates: [["Print headline"]],
      headlineChosenCandidate: ["Print headline"],
      headlineRenderedLines: ["Print headline"],
      headlineRenderedLine1: "Print headline",
      headlineRenderedLine2: "",
      headlineRenderedLine3: "",
      headlineLineWidths: [324],
      headlineLineAvailableWidth: 324,
      headlineLineOverflowPx: [0],
      headlineMaxOverflowPx: 0,
      headlineAverageFillPercent: 100,
      headlineUnusedPixels: 0,
      imageHeight: 120,
      imageCoveragePercent: 0,
      textCoveragePercent: 100,
      generatedRegions: 1,
      consumedRegions: 1,
      remainingText: 0,
      usedColumns: 1,
      unusedColumns: 0,
      regionCount: 1,
      usableRegions: 1,
      discardedRegions: 0,
      columnCount: 1,
    },
  };
};

const assertColorConversion = () => {
  const black = parsePrintColor("#000000");
  const white = parsePrintColor("#ffffff");

  assert(black !== null && black.key === 1, "black should convert to process key");
  assert(white !== null && white.key === 0, "white should not use process key");
};

const assertMissingFontsFailPreflight = async () => {
  const result = await generatePrintPDF({
    pages: [
      {
        width: 936,
        height: 1872,
        articles: [
          {
            articleBox,
            layout: createLayout(),
          },
        ],
      },
    ],
    fonts: [],
  });

  assert(!result.preflight.printReady, "missing fonts should fail print-ready preflight");
  assert(
    result.preflight.issues.some((issue) => issue.code === "missing-font"),
    "missing font issue should be reported",
  );
};

const assertMultiPagePdfOutput = async () => {
  const layout = createLayout();
  const result = await generatePrintPDF({
    pages: [
      {
        width: 936,
        height: 1872,
        articles: [
          {
            articleBox,
            layout,
          },
        ],
      },
      {
        width: 936,
        height: 1872,
        articles: [
          {
            articleBox: {
              ...articleBox,
              y: 72,
            },
            layout,
          },
        ],
      },
    ],
    fonts: getFonts(),
  });
  const pdfText = Buffer.from(result.pdfBytes).toString("latin1");

  assert(result.pageCount === 2, "PDF should contain two pages");
  assert(result.pdfBytes.length > 1000, "PDF should contain generated bytes");
  assert(pdfText.startsWith("%PDF-"), "output should be a PDF file");
  assert(pdfText.includes("/TrimBox"), "PDF should include TrimBox");
  assert(pdfText.includes("/BleedBox"), "PDF should include BleedBox");
  assert(result.preflight.embeddedFontIds.length === 3, "all font roles should be embedded");
  assert(result.preflight.printReady, "font-complete PDF should pass print-ready preflight");
};

const assertImageDpiPreflight = async () => {
  const image = createTestImage();
  const result = await generatePrintPDF({
    pages: [
      {
        width: 936,
        height: 1872,
        articles: [
          {
            articleBox,
            layout: createLayout(),
            imageAssetId: image.id,
          },
        ],
      },
    ],
    fonts: getFonts(),
    images: [image],
  });

  assert(result.preflight.imageMetrics.length === 1, "image metrics should be recorded");
  assert(
    result.preflight.issues.some((issue) => issue.code === "low-image-dpi"),
    "low image DPI should be reported",
  );
};

const assertBylineMarkerTextIsSanitized = () => {
  assert(
    sanitizePdfRenderedText("City Reporter __BYLINE_DOT__ Bhopal") === "City Reporter Bhopal",
    "PDF renderer should strip stale byline dot marker text",
  );
  assert(
    sanitizePdfRenderedText("City Reporter BYLINE DOT_ Bhopal") === "City Reporter Bhopal",
    "PDF renderer should strip spaced stale byline dot marker text",
  );
};

const tests: TestCase[] = [
  {
    name: "CMYK color conversion",
    run: assertColorConversion,
  },
  {
    name: "Missing fonts fail preflight",
    run: assertMissingFontsFailPreflight,
  },
  {
    name: "Multi-page PDF output includes trim and bleed boxes",
    run: assertMultiPagePdfOutput,
  },
  {
    name: "Image DPI preflight reports low-resolution assets",
    run: assertImageDpiPreflight,
  },
  {
    name: "Byline marker text is sanitized",
    run: assertBylineMarkerTextIsSanitized,
  },
];

export const runPrintPDFTests = async () => {
  for (const test of tests) {
    await test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  runPrintPDFTests().then((result) => {
    console.log(`Print PDF tests passed: ${result.passed}`);
  });
}
