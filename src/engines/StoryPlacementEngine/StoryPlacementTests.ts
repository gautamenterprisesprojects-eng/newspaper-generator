import { prototypeArticle } from "@/data/prototypeArticle";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import type { ArticleCompositionSettings, ArticleBoxModel, StoryFrame } from "@/types/editor";
import { GUIDE_GUTTER } from "@/utils/grid";
import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import { findStoryPlacement, getDefaultStorySize } from "./StoryPlacementEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const compositionSettings: ArticleCompositionSettings = {
  showRegionDebug: false,
  headlineScale: 0.8,
  baselineGridSize: 12,
  enableDropCap: false,
  enableFactBox: false,
  enablePullQuote: false,
  opticalTypography: true,
};

const createStory = (id: string, frame: ArticleBoxModel): StoryFrame => ({
  id,
  ...frame,
  priority: "secondary",
  columnStart: 1,
  columnSpan: 2,
  imageEnabled: true,
  imageAlignment: "right",
  imageColumnSpan: 2,
  imageHeight: 144,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  ...getDefaultStoryTypographySettings("secondary"),
  articleData: prototypeArticle,
  compositionSettings,
});

const overlapsWithGap = (first: ArticleBoxModel, second: ArticleBoxModel, gap = 8) =>
  first.x < second.x + second.width + gap &&
  first.x + first.width + gap > second.x &&
  first.y < second.y + second.height + gap &&
  first.y + first.height + gap > second.y;

const getColumnStarts = () => {
  const columnCount = 6;
  const contentWidth = NEWSPAPER_PAGE.width - PAGE_MARGIN * 2;
  const columnWidth = (contentWidth - GUIDE_GUTTER * (columnCount - 1)) / columnCount;

  return Array.from({ length: columnCount }).map(
    (_, index) => Math.round(PAGE_MARGIN + index * (columnWidth + GUIDE_GUTTER)),
  );
};

const assertCreatesFourStoriesWithoutOverlap = () => {
  const stories: StoryFrame[] = [
    createStory("story-1", {
      x: 72,
      y: 90,
      width: 360,
      height: 540,
    }),
  ];

  while (stories.length < 4) {
    const placement = findStoryPlacement({
      stories,
      preferredSize: getDefaultStorySize(),
    });

    assert(placement.storyFrame !== null, "expected placement before template-driven story counts");
    if (!placement.storyFrame) {
      return;
    }

    assert(
      !stories.some((story) => overlapsWithGap(placement.storyFrame as ArticleBoxModel, story)),
      "new story overlaps an existing story",
    );

    stories.push(createStory(`story-${stories.length + 1}`, placement.storyFrame));
  }

  for (let firstIndex = 0; firstIndex < stories.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < stories.length; secondIndex += 1) {
      assert(
        !overlapsWithGap(stories[firstIndex], stories[secondIndex]),
        `stories ${stories[firstIndex].id} and ${stories[secondIndex].id} overlap`,
      );
    }
  }
};

const assertSnapsToColumnStarts = () => {
  const placement = findStoryPlacement({
    stories: [],
    preferredSize: getDefaultStorySize(),
  });
  const columnStarts = getColumnStarts();

  assert(placement.storyFrame !== null, "expected placement on empty page");
  if (!placement.storyFrame) {
    return;
  }

  assert(columnStarts.includes(placement.storyFrame.x), "story x should snap to a column start");
};

const assertReportsFullPage = () => {
  const placement = findStoryPlacement({
    stories: [
      createStory("full-page-story", {
        x: PAGE_MARGIN,
        y: PAGE_MARGIN,
        width: NEWSPAPER_PAGE.width - PAGE_MARGIN * 2,
        height: NEWSPAPER_PAGE.height - PAGE_MARGIN * 2,
      }),
    ],
    preferredSize: getDefaultStorySize(),
  });

  assert(placement.storyFrame === null, "full page should not receive another story");
  assert(placement.warning === "Page is full", "full page warning should be returned");
};

const tests: TestCase[] = [
  {
    name: "Creates pre-template stories without overlap",
    run: assertCreatesFourStoriesWithoutOverlap,
  },
  {
    name: "Snaps new stories to column starts",
    run: assertSnapsToColumnStarts,
  },
  {
    name: "Reports Page is full when no rectangle is available",
    run: assertReportsFullPage,
  },
];

export const runStoryPlacementTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runStoryPlacementTests();
  console.log(`Story placement tests passed: ${result.passed}`);
}
