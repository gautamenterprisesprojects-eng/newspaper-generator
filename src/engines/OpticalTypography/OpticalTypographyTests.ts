import assert from "node:assert/strict";
import { applyOpticalTypography } from "./OpticalTypographyEngine";
import type { ArticleLayout, ArticleLayoutTextBlock, ArticleTextStyle } from "@/types/editor";

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    getContext() {
      return {
        font: "",
        measureText: (text: string) => ({
          width: Array.from(text).reduce((sum, char) => sum + (char === " " ? 4 : 10), 0),
        }),
      };
    }
  },
});

const style: ArticleTextStyle = {
  fill: "#111111",
  fontFamily: "Arial",
  fontSize: 16,
  lineHeight: 1,
  align: "left",
  wrap: "none",
};

const createBlock = (x: number, y: number, width: number, text: string): ArticleLayoutTextBlock => ({
  x,
  y,
  width,
  text,
  wrappedLines: [text],
  lineCount: 1,
  height: 18,
  overflow: false,
  style,
  lineBoxes: [
    {
      x,
      y,
      width,
      height: 18,
      text,
      style,
    },
  ],
});

const createMetrics = (): ArticleLayout["metrics"] => ({
  headlineLines: 1,
  bodyLines: 1,
  visibleLines: 1,
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
  bodyFinalLineWidths: [160],
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
  storyWidth: 200,
  headlineMeasureWidth: 200,
  renderedHeadlineWidth: 200,
  headlineFillPercent: 80,
  headlineFillLine1Percent: 80,
  headlineFillLine2Percent: 0,
  selectedHeadlineCandidateScore: 0,
  selectedHeadlineCandidateType: "balanced",
  selectedHeadlineCandidateReason: "fixture",
  headlineTopCandidateScores: [],
  headlineOriginal: "\"भारत\"",
  headlineGeneratedCandidates: [["\"भारत\""]],
  headlineChosenCandidate: ["\"भारत\""],
  headlineRenderedLines: ["\"भारत\""],
  headlineRenderedLine1: "\"भारत\"",
  headlineRenderedLine2: "",
  headlineRenderedLine3: "",
  headlineLineWidths: [80],
  headlineLineAvailableWidth: 200,
  headlineLineOverflowPx: [0],
  headlineMaxOverflowPx: 0,
  headlineAverageFillPercent: 80,
  headlineUnusedPixels: 120,
  imageHeight: 0,
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
});

const headline = createBlock(20, 20, 200, "\"भारत\"");
const bodyLine = {
  x: 20,
  y: 80,
  width: 200,
  height: 18,
  text: "शहर बदला.",
  style,
  segments: [
    { x: 20, y: 80, width: 40, height: 18, text: "शहर", style },
    { x: 70, y: 80, width: 50, height: 18, text: "बदला.", style },
  ],
};

const layout: ArticleLayout = {
  kicker: null,
  strap: null,
  headline,
  subheadlineBackground: null,
  subheadline: createBlock(20, 44, 200, "उपशीर्षक"),
  byline: createBlock(20, 62, 200, "भोपाल | संवाददाता"),
  image: null,
  factBox: null,
  pullQuote: null,
  caption: {
    x: 20,
    y: 104,
    width: 200,
    height: 18,
    textBlock: createBlock(20, 104, 200, "चित्र: सफाई अभियान."),
    creditBlock: null,
    sourceBlock: null,
    position: "below-image",
    creditPosition: "below-caption",
  },
  body: {
    x: 20,
    y: 80,
    width: 200,
    height: 120,
    text: "शहर बदला.",
    wrappedLines: ["शहर बदला."],
    lineCount: 1,
    remainingLineCount: 0,
    overflow: false,
    dropCap: null,
    columns: [
      {
        id: "body-column-1",
        x: 20,
        y: 80,
        width: 200,
        height: 120,
        columnIndex: 0,
        capacity: 6,
        assignedLineCount: 1,
        remainingCapacity: 5,
        lines: [bodyLine],
        lineCount: 1,
        overflow: false,
      },
    ],
  },
  debugTextRegions: [],
  metrics: createMetrics(),
};

const result = applyOpticalTypography(layout, true);
const opticalHeadlineLine = result.layout.headline.lineBoxes[0];
const headlineSegments = opticalHeadlineLine.segments ?? [];

assert.equal(result.layout.headline.wrappedLines.join("\n"), layout.headline.wrappedLines.join("\n"));
assert.equal(result.layout.body.wrappedLines.join("\n"), layout.body.wrappedLines.join("\n"));
assert.equal(result.layout.body.columns[0].lines[0].text, bodyLine.text);
assert.ok(headlineSegments.length >= 2, "headline should render as optical segments");
assert.ok(headlineSegments[0].x < headline.lineBoxes[0].x, "opening quote should hang left");
assert.ok(headlineSegments.at(-1)!.x > headline.lineBoxes[0].x, "closing quote should hang right");

const opticalBodySegments = result.layout.body.columns[0].lines[0].segments ?? [];
assert.equal(opticalBodySegments.map((segment) => segment.text).join(""), "शहरबदला.");
assert.ok(opticalBodySegments.at(-1)!.text === ".", "right punctuation should be split into its own segment");
assert.ok(result.layout.metrics.opticalGlyphCount >= 4);
assert.ok(result.layout.metrics.leftHangingCount >= 1);
assert.ok(result.layout.metrics.rightHangingCount >= 3);
assert.ok(result.layout.metrics.averageHangPercent > 0);

const disabled = applyOpticalTypography(layout, false);
assert.equal(disabled.layout, layout);
assert.equal(disabled.diagnostics.opticalGlyphCount, 0);

console.log("Optical typography tests passed: 11");
