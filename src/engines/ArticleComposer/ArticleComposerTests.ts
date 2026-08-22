import type { ArticleBoxModel, StoryImageSettings } from "@/types/editor";

class TestOffscreenCanvas {
  getContext() {
    return {
      font: "",
      measureText: (text: string) => {
        let width = 0;

        for (const character of Array.from(text)) {
          if (/\s/u.test(character)) {
            width += 4;
          } else if (/[\u0900-\u097F]/u.test(character)) {
            width += 9;
          } else if (/[A-Z]/u.test(character)) {
            width += 8;
          } else {
            width += 7;
          }
        }

        return { width };
      },
    };
  }
}

class ScaledTestOffscreenCanvas {
  private readonly context = {
    font: "",
    measureText(text: string) {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
      let width = 0;

      for (const character of Array.from(text)) {
        if (/\s/u.test(character)) {
          width += fontSize * 0.28;
        } else if (/[\u0900-\u097F]/u.test(character)) {
          width += fontSize * 0.62;
        } else if (/[A-Z]/u.test(character)) {
          width += fontSize * 0.58;
        } else {
          width += fontSize * 0.5;
        }
      }

      return { width };
    },
  };

  getContext() {
    return this.context;
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: TestOffscreenCanvas,
});

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const imageSettings: StoryImageSettings = {
  imageEnabled: true,
  imageAlignment: "top-right",
  imageColumnSpan: 1,
  imageHeight: 96,
  imageHeightMode: "auto",
  imageHeightPreset: "small",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
};

export const runArticleComposerTests = async () => {
  const { prototypeArticle } = await import("@/data/prototypeArticle");
  const { getDefaultStoryTypographySettings } = await import(
    "@/engines/StoryHierarchy/StoryHierarchyEngine"
  );
  const { composeArticleBox } = await import("./composeArticleBox");
  const typographySettings = getDefaultStoryTypographySettings("secondary");
  const compositionSettings = {
    showRegionDebug: false,
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  };
  const createStoryBox = (width: number): ArticleBoxModel &
    StoryImageSettings &
    typeof typographySettings & { priority: "secondary" } => ({
    x: 0,
    y: 0,
    width,
    height: 360,
    priority: "secondary",
    ...imageSettings,
    ...typographySettings,
    forceFullWidthHeadlines: true,
  });

  for (const storyWidth of [260, 390, 520]) {
    const storyBox = createStoryBox(storyWidth);
    const layout = composeArticleBox(storyBox, prototypeArticle, compositionSettings);
    const expectedContentWidth = storyWidth - 18 - 18;
    const expectedHeadlineMeasureWidth = expectedContentWidth;

    assert(layout.headline.width === expectedContentWidth, "headline must use full content width");
    assert(layout.metrics.storyWidth === expectedContentWidth, "metrics story width must equal content width");
    assert(
      Math.abs(layout.metrics.headlineMeasureWidth - expectedHeadlineMeasureWidth) < 0.0001,
      "headline measure width must use story content width",
    );
    assert(
      layout.metrics.renderedHeadlineWidth === expectedContentWidth,
      "rendered headline width must equal story content width",
    );
    assert(layout.subheadline.width === expectedContentWidth, "subheadline must use full content width");
    assert(layout.byline.width === expectedContentWidth, "dateline must use full content width");
    assert(
      layout.headline.lineBoxes.every((line) => line.width === expectedContentWidth),
      "headline line boxes must use full story content width",
    );
    assert(
      layout.headline.overflow ||
        layout.metrics.headlineLineWidths.every((width) => width <= layout.metrics.headlineLineAvailableWidth),
      "headline selected lines must fit measured available width",
    );
    assert(
      layout.headline.lineBoxes.length === layout.headline.wrappedLines.length,
      "headline wrapped lines must be renderer lines",
    );
  }

  const hyphenatedHeadline =
    "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915, \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
  const hyphenatedLayout = composeArticleBox(
    {
      ...createStoryBox(366),
      imageEnabled: false,
      imageWrapMode: "none",
      headlineFontSize: 20,
      headlineLineHeight: 1,
      autoFitHeadline: false,
      autoBalanceHeadline: true,
      enableHyphenation: true,
      forceFullWidthHeadlines: true,
    },
    {
      ...prototypeArticle,
      headline: hyphenatedHeadline,
      columnCount: 2,
    },
    compositionSettings,
  );
  const expectedHyphenatedLines = [
    "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915, \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932-",
    "\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c",
  ];

  assert(
    hyphenatedLayout.headline.wrappedLines.join("|") === expectedHyphenatedLines.join("|"),
    "ArticleComposer should choose the expected full-width Hindi newspaper-fill candidate",
  );
  assert(
    hyphenatedLayout.metrics.headlineLineOverflowPx.every((overflow) => overflow === 0),
    "headline diagnostics should report no measured overflow",
  );
  assert(
    hyphenatedLayout.headline.lineBoxes.map((line) => line.text).join("|") === expectedHyphenatedLines.join("|"),
    "rendered headline line boxes must match the chosen hyphenated candidate",
  );
  assert(
    hyphenatedLayout.metrics.headlineChosenCandidate.join("|") === expectedHyphenatedLines.join("|"),
    "headline diagnostics must expose the chosen candidate",
  );
  assert(
    hyphenatedLayout.metrics.headlineRenderedLines.join("|") === expectedHyphenatedLines.join("|"),
    "headline diagnostics must expose renderer input lines",
  );

  for (const columnCount of [2, 3, 4, 5, 6]) {
    const storyWidth = 18 + 18 + columnCount * 130 + (columnCount - 1) * 14;
    const storyBox = {
      ...createStoryBox(storyWidth),
      imageColumnSpan: 1,
    };
    const layout = composeArticleBox(
      storyBox,
      {
        ...prototypeArticle,
        body: Array.from({ length: 120 }).map((_, index) => `Body line source ${index + 1}`).join(" "),
        columnCount,
      },
      compositionSettings,
    );

    assert(layout.metrics.columnCount === columnCount, `${columnCount}-column story should preserve column count`);
    assert(layout.metrics.unusedColumns === 0, `${columnCount}-column story should not leave unused columns`);
    assert(
      layout.metrics.usedColumns === columnCount,
      `${columnCount}-column story should generate usable text regions for all columns`,
    );
  }

  const naturalWordLayout = composeArticleBox(
    {
      ...createStoryBox(420),
      imageEnabled: false,
      imageWrapMode: "none",
      bodyFontSize: 12,
      bodyLineHeight: 1.08,
    },
    {
      ...prototypeArticle,
      headline: "Natural body word width",
      subheadline: "",
      body: "\u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0905\u0927\u093f\u0915\u093e\u0930\u093f\u092f\u094b\u0902 \u0928\u0917\u0930 \u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e \u0938\u094d\u0935\u091a\u094d\u091b\u0924\u093e \u092a\u094d\u0930\u0936\u093e\u0938\u0928",
      columnCount: 2,
    },
    compositionSettings,
  );
  const bodySegments = naturalWordLayout.body.columns.flatMap((column) =>
    column.lines.flatMap((line) => line.segments ?? []),
  );
  const protectedWords = [
    "\u0938\u092e\u0940\u0915\u094d\u0937\u093e",
    "\u0905\u0927\u093f\u0915\u093e\u0930\u093f\u092f\u094b\u0902",
    "\u0928\u0917\u0930",
    "\u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e",
  ];

  for (const word of protectedWords) {
    const segment = bodySegments.find((candidate) => candidate.text === word);

    assert(Boolean(segment), `${word} must render as a complete body word segment`);
    assert(segment?.measuredWidth === segment?.renderedWidth, `${word} measured width must equal rendered width`);
    assert(segment?.width === segment?.measuredWidth, `${word} segment width must be natural measured width`);
    assert(segment?.scaleX === 1, `${word} body word scaleX must be 1`);
    assert(segment?.constrainWidth === false, `${word} body word must render without a forced Text width`);
    assert((segment?.style.letterSpacing ?? 0) === 0, `${word} must not apply glyph-level letter spacing`);
  }

  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: ScaledTestOffscreenCanvas,
  });

  const shortHeadlineLayout = composeArticleBox(
    {
      ...createStoryBox(480),
      imageEnabled: false,
      imageWrapMode: "none",
      headlineFontSize: 37,
      headlineLineHeight: 1.08,
      autoFitHeadline: true,
      autoBalanceHeadline: true,
      forceFullWidthHeadlines: true,
      headlineLayoutMode: "newspaper-fill",
    },
    {
      ...prototypeArticle,
      headline: "City schools reopen after rain",
      subheadline: "",
      body: "Body copy ".repeat(80),
      columnCount: 2,
    },
    compositionSettings,
  );

  assert(
    shortHeadlineLayout.headline.wrappedLines.length === 1,
    "ArticleComposer should reduce a short headline into one clean line when the second line would be weak",
  );
  assert(
    shortHeadlineLayout.headline.wrappedLines[0] === "City schools reopen after rain",
    "ArticleComposer should preserve short headline text while fitting it",
  );
  assert(
    shortHeadlineLayout.metrics.headlineLineWidths.every(
      (width) => width <= shortHeadlineLayout.metrics.headlineLineAvailableWidth,
    ),
    "ArticleComposer short headline should fit inside the measured headline width",
  );

  const verticalJustifiedLayout = composeArticleBox(
    {
      ...createStoryBox(400),
      height: 380,
      imageEnabled: false,
      imageWrapMode: "none",
      bodyFontSize: 12,
      bodyLineHeight: 1.1,
    },
    {
      ...prototypeArticle,
      headline: "Vertical Justification Test Article",
      subheadline: "",
      body: "First sentence of the article text. Second sentence explaining the details. Third sentence providing context. Fourth sentence concluding the paragraph. Fifth sentence starting a new point.",
      columnCount: 2,
    },
    compositionSettings,
  );

  assert(
    /[.।!?]$/u.test(verticalJustifiedLayout.body.text.trim()),
    "composed article must end at a complete sentence",
  );
  assert(
    !verticalJustifiedLayout.body.overflow,
    "composed article must not overflow",
  );

  return {
    passed: 37,
  };
};

if (require.main === module) {
  runArticleComposerTests().then((result) => {
    console.log(`ArticleComposerTests passed: ${result.passed}`);
  });
}
