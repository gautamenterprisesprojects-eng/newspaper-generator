import type { ArticleBoxModel, ArticleData, ArticleLayout, ArticleCompositionSettings, StoryTypographySettings } from "@/types/editor";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { SentenceEndFittingEngine } from "@/engines/TypographyEngine/SentenceEndFittingEngine";

export type LayoutQualityFlag =
  | "BODY_UNDERFILLED"
  | "BODY_OVERFLOW"
  | "BAD_SENTENCE_END"
  | "HEADLINE_OVERFLOW"
  | "IMAGE_COLLISION"
  | "ARTICLE_COLLISION"
  | "PAGE_OVERFLOW";

export type ArticleQualityReport = {
  storyId?: string;
  qualityScore: number;
  passed: boolean;
  flags: LayoutQualityFlag[];
  remainingLines: number;
  overflowAmountPx: number;
  sentenceEndingStatus: boolean;
  headlineOverflow: boolean;
  imageCollision: boolean;
  articleCollision: boolean;
  pageOverflow: boolean;
};

export type PageQualityReport = {
  totalScore: number;
  passed: boolean;
  articles: ArticleQualityReport[];
};

/**
 * Calculates rectangle collision.
 */
const rectsOverlap = (
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number },
  tolerance = 0.5,
): boolean => {
  return (
    r1.x < r2.x + r2.width - tolerance &&
    r1.x + r1.width > r2.x + tolerance &&
    r1.y < r2.y + r2.height - tolerance &&
    r1.y + r1.height > r2.y + tolerance
  );
};

/**
 * LayoutQualityValidator
 *
 * Additive quality engine that inspects completed page layouts and automatically
 * identifies and repairs individual failing articles without touching page geometry or neighbouring stories.
 */
export const inspectArticleQuality = (
  layout: ArticleLayout,
  articleBox: ArticleBoxModel & Partial<StoryTypographySettings> & { id?: string },
  articleData: ArticleData,
  compositionSettings?: ArticleCompositionSettings,
  otherStories: { id: string; x: number; y: number; width: number; height: number }[] = [],
): ArticleQualityReport => {
  const flags: LayoutQualityFlag[] = [];
  const fullText = richTextToPlainText(articleData.body).trim();
  const visibleLines = layout.body.columns.flatMap((col) => col.lines);

  // 1. Blank Space Check
  const remainingLines = layout.body.remainingLineCount;
  if (remainingLines > 1.0) {
    flags.push("BODY_UNDERFILLED");
  }

  // 2. Body Overflow Check
  const bodyOverflow = layout.body.overflow;
  let overflowAmountPx = 0;
  if (bodyOverflow) {
    flags.push("BODY_OVERFLOW");
    overflowAmountPx = Math.max(0, (layout.body.height ?? 0) - articleBox.height);
  }

  // 3. Sentence Ending Check
  const isEndsWithSentencePunctuation = (str: string) => /[।॥.!?]\s*$/u.test(str);
  let sentenceEndingStatus = false;
  if (visibleLines.length > 0) {
    const lastLineText = visibleLines[visibleLines.length - 1].text.trim();
    sentenceEndingStatus = isEndsWithSentencePunctuation(lastLineText);
  }
  if (!sentenceEndingStatus && fullText.length > 0) {
    flags.push("BAD_SENTENCE_END");
  }

  // 4. Headline Overflow Check
  const headlineOverflow = Boolean(
    layout.headline &&
      (layout.headline.lineBoxes.some((l) => l.width > articleBox.width + 2) ||
        layout.headline.height > articleBox.height * 0.6),
  );
  if (headlineOverflow) {
    flags.push("HEADLINE_OVERFLOW");
  }

  // 5. Image Collision Check
  let imageCollision = false;
  if (layout.image && layout.body.columns) {
    const imgRect = {
      x: layout.image.x,
      y: layout.image.y,
      width: layout.image.width,
      height: layout.image.height,
    };
    for (const col of layout.body.columns) {
      for (const line of col.lines) {
        const lineRect = {
          x: col.x + line.x,
          y: col.y + line.y,
          width: line.width,
          height: (articleBox.bodyFontSize ?? 10) * 1.2,
        };
        if (rectsOverlap(lineRect, imgRect, 1.0)) {
          imageCollision = true;
          break;
        }
      }
      if (imageCollision) break;
    }
  }
  if (imageCollision) {
    flags.push("IMAGE_COLLISION");
  }

  // 6. Article Collision Check
  let articleCollision = false;
  for (const other of otherStories) {
    if (other.id && articleBox.id && other.id === articleBox.id) continue;
    if (rectsOverlap(articleBox, other, 0.5)) {
      articleCollision = true;
      break;
    }
  }
  if (articleCollision) {
    flags.push("ARTICLE_COLLISION");
  }

  // 7. Page Overflow Check
  let pageOverflow = false;
  if (compositionSettings?.pageBounds) {
    const pb = compositionSettings.pageBounds;
    if (
      articleBox.x < pb.x - 2 ||
      articleBox.y < pb.y - 2 ||
      articleBox.x + articleBox.width > pb.x + pb.width + 2 ||
      articleBox.y + articleBox.height > pb.y + pb.height + 2
    ) {
      pageOverflow = true;
    }
  }
  if (pageOverflow) {
    flags.push("PAGE_OVERFLOW");
  }

  // Calculate Quality Score (Base 100)
  let qualityScore = 100;
  if (remainingLines > 1.0) qualityScore -= 20;
  if (bodyOverflow) qualityScore -= 100;
  if (!sentenceEndingStatus) qualityScore -= 40;
  if (headlineOverflow) qualityScore -= 40;
  if (imageCollision) qualityScore -= 100;
  if (articleCollision) qualityScore -= 100;
  if (pageOverflow) qualityScore -= 100;

  qualityScore = Math.max(0, qualityScore);
  const passed = qualityScore >= 95;

  return {
    storyId: articleBox.id,
    qualityScore,
    passed,
    flags,
    remainingLines,
    overflowAmountPx,
    sentenceEndingStatus,
    headlineOverflow,
    imageCollision,
    articleCollision,
    pageOverflow,
  };
};

export const validateAndRepairPageLayout = ({
  storyLayouts,
  composePass,
}: {
  storyLayouts: Array<{
    story: ArticleBoxModel & Partial<StoryTypographySettings> & { id: string; priority?: any; articleData: ArticleData };
    layout: ArticleLayout;
  }>;
  composePass: (
    box: ArticleBoxModel & Partial<StoryTypographySettings> & { id?: string; priority?: any },
    data: ArticleData,
    fitOverrides?: any,
  ) => ArticleLayout;
}): {
  repairedStoryLayouts: Array<{
    story: ArticleBoxModel & Partial<StoryTypographySettings> & { id: string; priority?: any; articleData: ArticleData };
    layout: ArticleLayout;
  }>;
  pageReport: PageQualityReport;
} => {
  const otherStories = storyLayouts.map((s) => ({
    id: s.story.id,
    x: s.story.x,
    y: s.story.y,
    width: s.story.width,
    height: s.story.height,
  }));

  const repairedStoryLayouts = storyLayouts.map((item) => {
    let currentLayout = item.layout;
    const initialReport = inspectArticleQuality(
      currentLayout,
      item.story,
      item.story.articleData,
      undefined,
      otherStories,
    );

    if (initialReport.passed) {
      return { story: item.story, layout: currentLayout };
    }

    // Attempt targeted repair (Max 3 attempts)
    let bestLayout = currentLayout;
    let bestScore = initialReport.qualityScore;

    for (let attempt = 1; attempt <= 3; attempt++) {
      // Re-run SentenceEndFittingEngine with targeted pass
      const reFitted = SentenceEndFittingEngine.adjustArticleSentenceEnd({
        articleBox: item.story,
        articleData: item.story.articleData,
        compositionSettings: { otherStories } as any,
        composePass: (b, d, s, overrides) => composePass(b, d, overrides),
      });

      const rep = inspectArticleQuality(
        reFitted,
        item.story,
        item.story.articleData,
        undefined,
        otherStories,
      );

      if (rep.qualityScore > bestScore) {
        bestScore = rep.qualityScore;
        bestLayout = reFitted;
      }

      if (rep.passed) {
        break;
      }
    }

    return { story: item.story, layout: bestLayout };
  });

  const reports = repairedStoryLayouts.map((item) =>
    inspectArticleQuality(
      item.layout,
      item.story,
      item.story.articleData,
      undefined,
      otherStories,
    ),
  );

  const totalScore =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.qualityScore, 0) / reports.length)
      : 100;
  const passed = reports.every((r) => r.passed);

  return {
    repairedStoryLayouts,
    pageReport: {
      totalScore,
      passed,
      articles: reports,
    },
  };
};

export const LayoutQualityValidator = {
  inspectArticleQuality,
  validateAndRepairPageLayout,
};
