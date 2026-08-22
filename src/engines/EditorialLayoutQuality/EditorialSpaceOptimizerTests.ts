import { prototypeArticle } from "@/data/prototypeArticle";
import type { NewswireStory } from "@/lib/newswire";
import type { StoryFrame } from "@/types/editor";
import {
  estimateStoryWordCapacity,
  matchArticlesToStoriesByCapacity,
  optimizeMultiPassLayout,
} from "./EditorialSpaceOptimizer";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createMockStory = (id: string, width: number, height: number, span = 2): StoryFrame => ({
  id,
  x: 36,
  y: 54,
  width,
  height,
  priority: "major",
  columnStart: 1,
  columnSpan: span as any,
  imageEnabled: false,
  imageAlignment: "right",
  imageColumnSpan: 2,
  imageHeight: 120,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  headlineFontSize: 24,
  subheadlineFontSize: 14,
  bodyFontSize: 12,
  headlineLineHeight: 1.1,
  subheadlineLineHeight: 1.2,
  bodyLineHeight: 1.3,
  headlineLineHeightMode: "auto",
  subheadlineLineHeightMode: "auto",
  bodyLineHeightMode: "auto",
  headlineLeadingValue: 26,
  subheadlineLeadingValue: 16,
  bodyLeadingValue: 16,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: false,
  forceFullWidthHeadlines: false,
  headlineLayoutMode: "newspaper-fill",
  articleData: prototypeArticle,
  compositionSettings: {
    showRegionDebug: false,
    bodyRendererMode: "line",
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  },
});

const createMockArticles = (): NewswireStory[] => [
  {
    id: "news-1",
    category: "Sports",
    headline: "Sports Headline Short",
    subheadline: "Subheadline for short story",
    body: "Short body sentence one. Short body sentence two.",
    shortBody: "Short body sentence one. Short body sentence two.",
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
  },
  {
    id: "news-2",
    category: "Sports",
    headline: "Sports Headline Medium",
    subheadline: "Subheadline medium story",
    body: Array.from({ length: 300 }).map((_, i) => `word${i}`).join(" ") + ".",
    mediumBody: Array.from({ length: 300 }).map((_, i) => `word${i}`).join(" ") + ".",
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
  },
  {
    id: "news-3",
    category: "Sports",
    headline: "Sports Headline Long",
    subheadline: "Subheadline long story",
    body: Array.from({ length: 600 }).map((_, i) => `word${i}`).join(" ") + ".",
    longBody: Array.from({ length: 600 }).map((_, i) => `word${i}`).join(" ") + ".",
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
  },
];

const runTests = () => {
  const smallStory = createMockStory("small", 180, 240, 1);
  const mediumStory = createMockStory("medium", 360, 360, 3);
  const largeStory = createMockStory("large", 800, 600, 6);

  // Test 1: Capacity Estimation
  const smallCap = estimateStoryWordCapacity(smallStory);
  const medCap = estimateStoryWordCapacity(mediumStory);
  const largeCap = estimateStoryWordCapacity(largeStory);

  assert(smallCap >= 30 && smallCap <= 160, `Small box capacity should be around 30-160, got ${smallCap}`);
  assert(medCap > smallCap && medCap >= 120 && medCap <= 380, `Medium box capacity should be around 120-380, got ${medCap}`);
  assert(largeCap > medCap && largeCap >= 400 && largeCap <= 800, `Large box capacity should be around 400-800, got ${largeCap}`);

  // Test 2: Best Story Assignment by Capacity & Global Optimization
  const articles = createMockArticles();
  const matchResult = matchArticlesToStoriesByCapacity([smallStory, mediumStory, largeStory], articles);
  assert(matchResult.matchedStories.length === 3, "Should match 3 stories");

  const smallMatch = matchResult.matchedStories.find((m) => m.story.id === "small");
  const medMatch = matchResult.matchedStories.find((m) => m.story.id === "medium");
  const largeMatch = matchResult.matchedStories.find((m) => m.story.id === "large");

  assert(smallMatch?.article.id === "news-1", "Small frame should be assigned the short article (news-1)");
  assert(medMatch?.article.id === "news-2", "Medium frame should be assigned the medium article (news-2)");
  assert(largeMatch?.article.id === "news-3", "Large frame should be assigned the long article (news-3)");

  // Test 3: Multi-Pass Layout & Frame Geometry Preservation
  const multiPassResult = optimizeMultiPassLayout({
    pageBounds: { x: 0, y: 0, width: 936, height: 1512 },
    contentBounds: { x: 36, y: 54, width: 864, height: 1404 },
    columns: [],
    stories: [smallStory, mediumStory, largeStory],
    articlePool: articles,
  });

  assert(multiPassResult.stories.length === 3, "Multi-pass should keep exact 3 stories");
  assert(multiPassResult.stories[0].width === smallStory.width, "Small frame width must remain unchanged");
  assert(multiPassResult.stories[0].height === smallStory.height, "Small frame height must remain unchanged");
  assert(multiPassResult.stories[1].width === mediumStory.width, "Medium frame width must remain unchanged");
  assert(multiPassResult.stories[1].height === mediumStory.height, "Medium frame height must remain unchanged");
  assert(multiPassResult.stories[2].width === largeStory.width, "Large frame width must remain unchanged");
  assert(multiPassResult.stories[2].height === largeStory.height, "Large frame height must remain unchanged");

  console.log("EditorialSpaceOptimizerTests passed!");
};

runTests();

