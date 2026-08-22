import type { NewswireStory } from "@/lib/newswire";
import {
  ensureEndsWithFullStop,
  normalizeArticleBodyText,
  trimToNearestFullStop,
} from "@/lib/newswire";
import { flowBodyLines } from "@/engines/BodyFlowEngine/BodyFlowEngine";
import { reflowArticleBoxes } from "@/engines/AutoReflowEngine/AutoReflowEngine";
import type { ArticleBoxModel, StoryFrame, StoryColumnSpan, StoryPriority } from "@/types/editor";
import type { LayoutColumn, LayoutRect } from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";
import { normalizeRichText, richTextToPlainText } from "@/engines/RichText/RichTextUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Article Size Class System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five standard article module sizes.
 * Each maps to a precise word range and a calibrated frame height.
 */
export type ArticleSizeClass = "XS" | "S" | "M" | "L" | "XL";

export type ArticleSizeClassConfig = {
  /** Label for display / debugging. */
  label: string;
  /** Minimum word count for this class (inclusive). */
  minWords: number;
  /** Maximum word count for this class (inclusive). */
  maxWords: number;
  /** Midpoint word count — used to calibrate the frame height target. */
  targetWords: number;
  /** Story priority level assigned to frames of this class. */
  priority: StoryPriority;
  /** Default column span for this class. */
  defaultColumnSpan: number;
  /**
   * Target frame height in points for a single-column layout at the standard
   * body font size (12pt, 1.38 leading, 36px horizontal padding).
   * Scaled proportionally for multi-column spans.
   */
  baseFrameHeight: number;
};

/**
 * Canonical configuration for every article size class.
 * Heights are calibrated so the body text fills ≥95% of the printable area
 * for the class's target word count at 12pt body / 16.56pt leading.
 *
 * Approximation formula used during calibration:
 *   printableBodyHeight = (targetWords / wordsPerLine / columnCount) * lineHeight
 *   frameHeight = printableBodyHeight + headlineHeight + subheadlineHeight + topPad
 */
export const ARTICLE_SIZE_CLASS_CONFIG: Record<ArticleSizeClass, ArticleSizeClassConfig> = {
  XS: {
    label: "Extra Small",
    minWords: 0,
    maxWords: 135,
    targetWords: 100,
    priority: "brief",
    defaultColumnSpan: 1,
    baseFrameHeight: 200,
  },
  S: {
    label: "Small",
    minWords: 136,
    maxWords: 245,
    targetWords: 185,
    priority: "secondary",
    defaultColumnSpan: 2,
    baseFrameHeight: 300,
  },
  M: {
    label: "Medium",
    minWords: 246,
    maxWords: 430,
    targetWords: 305,
    priority: "secondary",
    defaultColumnSpan: 2,
    baseFrameHeight: 420,
  },
  L: {
    label: "Large",
    minWords: 431,
    maxWords: 530,
    targetWords: 445,
    priority: "major",
    defaultColumnSpan: 3,
    baseFrameHeight: 520,
  },
  XL: {
    label: "Extra Large",
    minWords: 531,
    maxWords: Infinity,
    targetWords: 620,
    priority: "lead",
    defaultColumnSpan: 4,
    baseFrameHeight: 640,
  },
};

/** Ordered from smallest to largest for boundary lookups. */
const SIZE_CLASS_ORDER: ArticleSizeClass[] = ["XS", "S", "M", "L", "XL"];

/**
 * Classifies a single article by its word count into one of the five
 * standard size classes.
 */
export const classifyArticle = (item: NewswireStory): ArticleSizeClass => {
  const text = item.body || item.longBody || item.mediumBody || item.shortBody || item.subheadline || item.headline || "";
  const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;

  for (const sizeClass of SIZE_CLASS_ORDER) {
    const config = ARTICLE_SIZE_CLASS_CONFIG[sizeClass];
    if (wordCount <= config.maxWords) {
      return sizeClass;
    }
  }

  return "XL";
};

/**
 * Classifies an array of articles, returning each article paired with its
 * size class and word count.
 */
export const classifyArticles = (
  articles: NewswireStory[],
): { article: NewswireStory; sizeClass: ArticleSizeClass; wordCount: number }[] =>
  articles.map((article) => {
    const sizeClass = classifyArticle(article);
    const text = article.body || article.longBody || article.mediumBody || article.shortBody || article.subheadline || article.headline || "";
    const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
    return { article, sizeClass, wordCount };
  });

/**
 * Returns a calibrated frame height (in points) for a given article size class
 * and column span.
 *
 * The height is scaled from the single-column `baseFrameHeight` using a
 * sub-linear factor: wider frames can hold more words per line, so they need
 * proportionally less vertical height for the same word count.
 *
 * @param sizeClass - The article size class.
 * @param columnSpan - Number of grid columns the frame occupies (1–6).
 * @returns Frame height in points.
 */
export const getModuleFrameHeight = (
  sizeClass: ArticleSizeClass,
  columnSpan: number,
): number => {
  const config = ARTICLE_SIZE_CLASS_CONFIG[sizeClass];
  const safeSpan = Math.max(1, Math.round(columnSpan));

  if (safeSpan <= 1) {
    return config.baseFrameHeight;
  }

  // Wider frames fit more words per line → less vertical height needed.
  // Scale factor: each additional column reduces required height by ~15%.
  const scaleFactor = 1 / (1 + (safeSpan - 1) * 0.15);
  return Math.round(config.baseFrameHeight * scaleFactor);
};

/**
 * Returns the word capacity of a classified article (target words for its class).
 * This is used to pre-trim body text before passing it to the compositor.
 */
export const getClassWordCapacity = (sizeClass: ArticleSizeClass): number =>
  ARTICLE_SIZE_CLASS_CONFIG[sizeClass].targetWords;


export type MultiPassOptimizationInput = {
  pageBounds: LayoutRect;
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  stories: StoryFrame[];
  articlePool: NewswireStory[];
  subheadingStyle?: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    backgroundOpacity: number;
  };
};

export type MultiPassOptimizationResult = {
  stories: StoryFrame[];
  unusedArticles: NewswireStory[];
  placedCount: number;
  addedStoriesCount: number;
  whitespaceArea: number;
};

/**
 * Estimates the word capacity of a story frame box based on actual rendered dimensions,
 * font size, leading, margins, image area, captions, subheadline, and headline height.
 */
export const estimateStoryWordCapacity = (story: StoryFrame): number => {
  // Horizontal margins / padding inside frame (18px left + 18px right)
  const paddingX = 36;
  const availableWidth = Math.max(40, story.width - paddingX);

  // Headline height estimate from font size & leading
  const headlineFontSize = story.headlineFontSize ?? 24;
  const headlineLeading = story.headlineLeadingValue ?? (headlineFontSize * 1.1);
  const headlineLines = story.columnSpan >= 4 ? 2 : story.columnSpan === 3 ? 2 : 1;
  const headlineHeight = headlineLines * headlineLeading + 8;

  // Subheadline height estimate
  let subheadlineHeight = 0;
  if (story.articleData?.subheadline) {
    const subFontSize = story.subheadlineFontSize ?? 14;
    const subLeading = story.subheadlineLeadingValue ?? (subFontSize * 1.2);
    subheadlineHeight = subLeading + 10;
  }

  // Image & caption area estimate
  let imageAreaHeight = 0;
  if (story.imageEnabled) {
    const imgH = story.imageHeight ?? 120;
    const captionH = story.articleData?.caption?.enabled ? 30 : 10;
    imageAreaHeight = imgH + captionH;
  }

  // Vertical body space available
  const verticalPadding = 16;
  const availableBodyHeight = Math.max(
    0,
    story.height - headlineHeight - subheadlineHeight - imageAreaHeight - verticalPadding,
  );

  // Body font & leading
  const bodyFontSize = story.bodyFontSize ?? 12;
  const bodyLeading = story.bodyLeadingValue ?? (bodyFontSize * 1.38);

  // Lines per column & total body lines across columns
  const columnCount = Math.max(1, story.columnSpan ?? 1);
  const linesPerCol = Math.floor(availableBodyHeight / Math.max(1, bodyLeading));
  const totalBodyLines = linesPerCol * columnCount;

  // Words per line calculation based on column width and average word character width
  const columnGap = 14;
  const columnWidth = Math.max(20, (availableWidth - (columnCount - 1) * columnGap) / columnCount);
  const wordsPerLine = columnWidth / (bodyFontSize * 2.7);

  const estimatedWords = Math.round(totalBodyLines * wordsPerLine);
  return Math.max(20, estimatedWords);
};

/**
 * Gets the actual word count of an article.
 */
export const getArticleWordCount = (item: NewswireStory): number => {
  const text = item.body || item.subheadline || item.headline || "";
  return text.trim().split(/\s+/u).filter(Boolean).length;
};

/**
 * Min-cost bipartite matching algorithm (Hungarian / Kuhn-Munkres) for n x m cost matrix (n <= m).
 * Returns array assignment of length n where assignment[i] is index of matched article (0..m-1).
 */
export const solveMinCostMatching = (costMatrix: number[][]): number[] => {
  const n = costMatrix.length;
  if (n === 0) return [];
  const m = costMatrix[0].length;
  if (m < n) return [];

  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] !== 0) {
      result[p[j] - 1] = j - 1;
    }
  }
  return result;
};

/**
 * Selects the best-matching article from the pool for each story box to minimize word length mismatch
 * using global Hungarian optimization without altering frame geometry.
 */
export const matchArticlesToStoriesByCapacity = (
  stories: StoryFrame[],
  articlePool: NewswireStory[],
): {
  matchedStories: { story: StoryFrame; article: NewswireStory; wordCapacity: number }[];
  remainingArticles: NewswireStory[];
} => {
  if (stories.length === 0 || articlePool.length === 0) {
    return { matchedStories: [], remainingArticles: [...articlePool] };
  }

  const pool = [...articlePool];
  const capacities = stories.map((story) => estimateStoryWordCapacity(story));
  const wordCounts = pool.map((item) => getArticleWordCount(item));

  const n = stories.length;
  const m = pool.length;

  const costMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const cap = capacities[i];
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      const len = wordCounts[j];
      let diff = Math.abs(len - cap);
      if (len < cap) {
        // Slightly penalize shorter stories when larger stories are available,
        // preferring nearest larger story that can be cleanly truncated to capacity.
        diff += (cap - len) * 0.25;
      }
      row.push(diff);
    }
    costMatrix.push(row);
  }

  let assignment: number[];
  if (m >= n) {
    assignment = solveMinCostMatching(costMatrix);
  } else {
    // Fewer articles than stories: pad cost matrix to n x n
    const paddedMatrix = costMatrix.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < n) {
        paddedRow.push(1e6);
      }
      return paddedRow;
    });
    assignment = solveMinCostMatching(paddedMatrix);
  }

  const matchedStories: { story: StoryFrame; article: NewswireStory; wordCapacity: number }[] = [];
  const assignedIndices = new Set<number>();

  for (let i = 0; i < n; i++) {
    const articleIdx = assignment[i];
    if (articleIdx >= 0 && articleIdx < m) {
      assignedIndices.add(articleIdx);
      matchedStories.push({
        story: stories[i],
        article: pool[articleIdx],
        wordCapacity: capacities[i],
      });
    }
  }

  const remainingArticles = pool.filter((_, idx) => !assignedIndices.has(idx));

  return {
    matchedStories,
    remainingArticles,
  };
};

/**
 * Executes capacity-based story assignment without modifying frame layout geometry.
 */
export const optimizeMultiPassLayout = ({
  pageBounds,
  contentBounds,
  columns,
  stories,
  articlePool,
  subheadingStyle = {
    backgroundColor: "#111111",
    textColor: "#ffffff",
    borderColor: "#111111",
    backgroundOpacity: 1,
  },
}: MultiPassOptimizationInput): MultiPassOptimizationResult => {
  if (stories.length === 0) {
    return {
      stories: [],
      unusedArticles: articlePool,
      placedCount: 0,
      addedStoriesCount: 0,
      whitespaceArea: contentBounds.width * contentBounds.height,
    };
  }

  const { matchedStories, remainingArticles } = matchArticlesToStoriesByCapacity(stories, articlePool);
  const matchedMap = new Map(matchedStories.map((m) => [m.story.id, m]));

  const optimizedStories: StoryFrame[] = stories.map((story) => {
    const match = matchedMap.get(story.id);
    if (!match) return story;

    const item = match.article;
    const capacity = match.wordCapacity;

    let rawBody = item.body || item.longBody || item.mediumBody || item.shortBody || "";
    if (capacity <= 150 && item.shortBody) {
      rawBody = item.shortBody;
    } else if (capacity <= 400 && item.mediumBody) {
      rawBody = item.mediumBody;
    } else if (capacity > 400 && item.longBody) {
      rawBody = item.longBody;
    } else if (rawBody) {
      rawBody = trimToNearestFullStop(rawBody, capacity);
    }

    const headlineText = typeof item.headline === "string" ? item.headline : richTextToPlainText(story.articleData.headline);
    const subheadlineText =
      typeof item.subheadline === "string"
        ? item.subheadline
        : item.subheadline
          ? richTextToPlainText(item.subheadline)
          : richTextToPlainText(story.articleData.subheadline as any);
    const sanitizedBodyText = normalizeArticleBodyText(rawBody, headlineText, subheadlineText);
    const cleanBody = normalizeRichText(sanitizedBodyText);

    return {
      ...story,
      name: item.headline || story.name,
      category: item.category || story.category,
      imageEnabled: Boolean(item.imageUrl) || story.imageEnabled,
      articleData: {
        ...story.articleData,
        headline: item.headline || story.articleData.headline,
        subheadline: ensureEndsWithFullStop(richTextToPlainText(item.subheadline || story.articleData.subheadline)),
        subheadlineBanner: {
          ...story.articleData.subheadlineBanner,
          backgroundColor: subheadingStyle.backgroundColor,
          textColor: subheadingStyle.textColor,
          borderColor: subheadingStyle.borderColor,
          backgroundOpacity: subheadingStyle.backgroundOpacity,
        },
        body: cleanBody,
      },
    };
  });

  const totalStoryArea = optimizedStories.reduce((sum, s) => sum + s.width * s.height, 0);
  const totalContentArea = contentBounds.width * contentBounds.height;
  const whitespaceArea = Math.max(0, totalContentArea - totalStoryArea);

  return {
    stories: optimizedStories,
    unusedArticles: remainingArticles,
    placedCount: optimizedStories.length,
    addedStoriesCount: 0,
    whitespaceArea,
  };
};

export const EditorialSpaceOptimizer = {
  estimateStoryWordCapacity,
  getArticleWordCount,
  solveMinCostMatching,
  matchArticlesToStoriesByCapacity,
  optimizeMultiPassLayout,
  // Article size classification system
  classifyArticle,
  classifyArticles,
  getModuleFrameHeight,
  getClassWordCapacity,
  ARTICLE_SIZE_CLASS_CONFIG,
  SIZE_CLASS_ORDER,
};
