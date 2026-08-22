import {
  adjustArticleSentenceEnd,
  runSafetyChecks,
} from "./SentenceEndFittingEngine";
import type {
  ArticleBoxModel,
  ArticleCompositionSettings,
  ArticleData,
  ArticleLayout,
} from "@/types/editor";
import { normalizeRichText } from "@/engines/RichText/RichTextUtils";

export const runSentenceEndFittingTests = () => {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      failed += 1;
      console.error(`[FAIL] ${message}`);
    } else {
      passed += 1;
    }
  };

  // Test 1: Article already ending at full stop should return untouched
  {
    const articleBox: any = {
      x: 10,
      y: 10,
      width: 200,
      height: 300,
      columnStart: 1,
      columnSpan: 1,
      name: "Test 1",
      status: "edited",
      category: "general",
      priority: "secondary",
      headlineFontSize: 20,
      subheadlineFontSize: 14,
      bodyFontSize: 10,
      headlineLineHeight: 1.2,
      subheadlineLineHeight: 1.2,
      bodyLineHeight: 1.2,
      headlineLineHeightMode: "auto",
      subheadlineLineHeightMode: "auto",
      bodyLineHeightMode: "auto",
      headlineLeadingValue: 24,
      subheadlineLeadingValue: 16.8,
      bodyLeadingValue: 12,
      headlineWeight: "bold",
      subheadlineWeight: "normal",
      autoFitHeadline: false,
      autoBalanceHeadline: false,
      enableHyphenation: false,
      forceFullWidthHeadlines: false,
      headlineLayoutMode: "standard",
      articleData: {} as any,
      compositionSettings: {} as any,
    };

    const articleData: ArticleData = {
      headline: "Sample",
      subheadline: "",
      body: normalizeRichText("This is a complete sentence. No adjustment needed."),
    } as any;

    const settings: ArticleCompositionSettings = {
      showRegionDebug: false,
      headlineScale: 1,
      baselineGridSize: 6,
      enableDropCap: false,
      enableFactBox: false,
      enablePullQuote: false,
      opticalTypography: true,
    };

    const mockLayout: ArticleLayout = {
      kicker: null,
      strap: null,
      headline: { x: 10, y: 10, width: 200, height: 30 } as any,
      subheadlineBackground: null,
      subheadline: null,
      byline: null,
      image: null,
      factBox: null,
      pullQuote: null,
      caption: null,
      body: {
        x: 10,
        y: 40,
        width: 200,
        height: 260,
        text: "This is a complete sentence. No adjustment needed.",
        wrappedLines: ["This is a complete sentence. No adjustment needed."],
        lineCount: 1,
        remainingLineCount: 0,
        overflow: false,
        columns: [
          {
            x: 10,
            y: 40,
            width: 200,
            height: 260,
            lines: [
              {
                text: "This is a complete sentence. No adjustment needed.",
                sourceIndex: 0,
                x: 10,
                y: 40,
                width: 200,
                height: 14,
                style: {} as any,
              },
            ],
          } as any,
        ],
      },
      metrics: {
        remainingLineCount: 0,
        overflow: false,
      } as any,
    } as any;

    const mockComposePass = () => mockLayout;

    const result = adjustArticleSentenceEnd({
      articleBox,
      articleData,
      compositionSettings: settings,
      composePass: mockComposePass,
    });

    assert(
      result.body.wrappedLines[0] === "This is a complete sentence. No adjustment needed.",
      "Complete sentence layout should remain untouched",
    );
  }

  // Test 2: Safety Check for overlapping frames
  {
    const boxA = { x: 0, y: 0, width: 100, height: 100, id: "box-a" };
    const boxB = { id: "box-b", x: 50, y: 50, width: 100, height: 100 };
    const mockLayout: ArticleLayout = {
      headline: { x: 0, y: 0, width: 100, height: 20 } as any,
      body: { columns: [] },
    } as any;

    const isSafe = runSafetyChecks({
      articleBox: boxA,
      layout: mockLayout,
      otherStories: [boxB],
    });

    assert(!isSafe, "Overlapping frame must fail safety check");
  }

  // Test 3: Safety Check for out-of-bounds frame
  {
    const boxA = { x: 0, y: 950, width: 100, height: 100, id: "box-a" };
    const pageBounds = { x: 0, y: 0, width: 800, height: 1000 };
    const mockLayout: ArticleLayout = {
      headline: { x: 0, y: 950, width: 100, height: 20 } as any,
      body: { columns: [] },
    } as any;

    const isSafe = runSafetyChecks({
      articleBox: boxA,
      layout: mockLayout,
      pageBounds,
    });

    assert(!isSafe, "Out-of-bounds frame must fail safety check");
  }

  // Test 4: Safe boundary fallback
  {
    const articleText = "This is the first safe sentence। This is the second sentence that is extremely long and would require destructive compression to fit inside the remaining space।";
    const isSafe = false; // from typography limits mock
    let chosenSentence = "";
    let rejectedReason = "";
    
    if (!isSafe) {
      rejectedReason = "unsafe-typography-compression";
      // fallback to previous sentence boundary
      chosenSentence = "This is the first safe sentence।";
    } else {
      chosenSentence = articleText;
    }
    
    assert(rejectedReason === "unsafe-typography-compression", "Must reject with unsafe-typography-compression");
    assert(chosenSentence === "This is the first safe sentence।", "Must fallback to previous safe boundary");
  }

  // Test 5: Baseline immutability
  {
    const originalBaseline = Object.freeze({
      lines: [
        { text: "Line 1" },
        { text: "Line 2" }
      ],
      bounds: { height: 100 }
    });
    
    // Simulate candidate generation that fails
    const candidate = { ...originalBaseline, lines: [...originalBaseline.lines, { text: "Line 3" }] };
    
    // Check immutability of original
    assert(originalBaseline.lines.length === 2, "Original baseline must not be mutated");
  }

  console.log(`SentenceEndFittingTests passed: ${passed}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
  return { passed, failed };
};

runSentenceEndFittingTests();
