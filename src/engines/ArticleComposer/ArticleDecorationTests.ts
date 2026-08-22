import type { ArticleBoxModel, StoryImageSettings } from "@/types/editor";

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
  value: ScaledTestOffscreenCanvas,
});

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const runArticleDecorationTests = async () => {
  const { prototypeArticle } = await import("@/data/prototypeArticle");
  const { getDefaultStoryTypographySettings } = await import(
    "@/engines/StoryHierarchy/StoryHierarchyEngine"
  );
  const { composeArticleBox } = await import("./composeArticleBox");
  const typographySettings = getDefaultStoryTypographySettings("secondary");
  const imageSettings: StoryImageSettings = {
    imageEnabled: false,
    imageAlignment: "top",
    imageColumnSpan: 1,
    imageHeight: 120,
    imageHeightMode: "auto",
    imageHeightPreset: "small",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "none",
  };
  const storyBox: ArticleBoxModel & StoryImageSettings & typeof typographySettings & { priority: "secondary" } = {
    x: 0,
    y: 0,
    width: 420,
    height: 420,
    priority: "secondary",
    ...imageSettings,
    ...typographySettings,
    bodyFontSize: 12,
    bodyLineHeight: 1.1,
    forceFullWidthHeadlines: true,
  };
  const article = {
    ...prototypeArticle,
    headline: "Editorial breathing room",
    subheadline: "Small safety inset should not disturb the story frame",
    body: Array.from({ length: 18 })
      .map(
        (_, index) =>
          `Complete sentence ${index + 1} gives the story enough dense body matter for a normal newspaper layout.`,
      )
      .join(" "),
    columnCount: 2,
  };
  const compositionSettings = {
    showRegionDebug: false,
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  };

  const noBreathingLayout = composeArticleBox(storyBox, article, {
    ...compositionSettings,
    articleEndBreathingSpaceEnabled: false,
  });
  const breathingLayout = composeArticleBox(storyBox, article, {
    ...compositionSettings,
    articleEndBreathingSpaceEnabled: true,
    articleEndBreathingSpaceMm: 2,
  });

  assert(
    noBreathingLayout.body.height - breathingLayout.body.height >= 5,
    "2mm article end breathing space should reserve about 5.67pt when safe",
  );
  assert(
    /[.\u0964!?]$/u.test(breathingLayout.body.text.trim()),
    "breathing space must preserve complete-sentence article endings",
  );
  assert(!breathingLayout.body.overflow, "breathing space must not create body overflow");

  const dividerLayout = composeArticleBox(storyBox, article, {
    ...compositionSettings,
    selectiveDividerLinesEnabled: true,
    selectiveDividerLineRatio: 1 / 3,
    storyDecorationIndex: 0,
    storyDecorationCount: 3,
  });
  const skippedDividerLayout = composeArticleBox(storyBox, article, {
    ...compositionSettings,
    selectiveDividerLinesEnabled: true,
    selectiveDividerLineRatio: 0,
    storyDecorationIndex: 0,
    storyDecorationCount: 3,
  });

  assert(
    (dividerLayout.decorativeDividers?.length ?? 0) >= 1,
    "selected dense stories should receive a subtle internal divider",
  );
  assert(
    dividerLayout.decorativeDividers?.every(
      (divider) =>
        (divider.style === "solid" && divider.strokeWidth <= 0.5) ||
        (divider.style === "dotted" && divider.strokeWidth <= 0.8),
    ) ?? false,
    "decorative dividers must stay thin and newspaper-like",
  );
  assert(
    !(skippedDividerLayout.decorativeDividers ?? []).some((divider) => divider.style === "solid"),
    "a zero divider ratio should disable selective dividers",
  );

  const imageDividerLayout = composeArticleBox(
    {
      ...storyBox,
      imageEnabled: true,
      imageAlignment: "top",
      imageHeight: 140,
      imageWrapMode: "none",
    },
    {
      ...article,
      caption: {
        ...article.caption,
        enabled: true,
      },
    },
    {
      ...compositionSettings,
      selectiveDividerLinesEnabled: true,
      selectiveDividerLineRatio: 1 / 3,
      storyDecorationIndex: 0,
      storyDecorationCount: 3,
    },
  );
  const image = imageDividerLayout.image;

  if (!image) {
    throw new Error("image divider fixture should include an image");
  }

  assert(
    imageDividerLayout.decorativeDividers?.every(
      (divider) =>
        !(
          divider.x < image.x + image.width &&
          divider.x + divider.width > image.x &&
          divider.y - 3 < image.y + image.height &&
          divider.y + 3 > image.y
        ),
    ) ?? true,
    "decorative dividers must never overlap image pixels",
  );

  console.log("ArticleDecoration tests passed");
};

if (require.main === module) {
  runArticleDecorationTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
