import type {
  NewspaperCompositionDiagnostics,
  NewspaperCompositionLineInput,
  NewspaperCompositionResult,
} from "@/engines/NewspaperComposition/NewspaperCompositionEngine";
import { composeHyphenationJustification } from "@/engines/HyphenationJustification/HyphenationJustificationEngine";
import type {
  HyphenationJustificationResult,
  HyphenationJustificationSettings,
} from "@/engines/HyphenationJustification/HyphenationJustificationTypes";
import type {
  ArticleTextStyle,
  EditorialJustifyEngineMode,
  EditorialJustifyMode,
} from "@/types/editor";

export type StoryComposerInput = {
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  justifyMode: EditorialJustifyMode;
  engineMode: EditorialJustifyEngineMode;
  totalCapacity: number;
  visibleLineCount: number;
  remainingLineCount: number;
  lineHeight: number;
  hyphenationJustificationSettings: HyphenationJustificationSettings;
  maxIterations?: number;
};

export type StoryComposerDiagnostics = NewspaperCompositionDiagnostics & {
  storyScore: number;
  paragraphScores: number[];
  storyFillPercent: number;
  bottomWhitespace: number;
  storyCompositionIterations: number;
  storyOptimizationPasses: number;
  averageParagraphScore: number;
  bestCandidateScore: number;
  rejectedCandidates: number;
  finalStoryQuality: number;
  grayValue: number;
  averageWordSpacing: number;
  averageTracking: number;
  hyphenCount: number;
  optimizationPasses: number;
  acceptedCandidates: number;
  paragraphCandidates: number;
  beamWidth: number;
  cacheHit: boolean;
  cacheKey: string;
  optimizationTimeMs: number;
  compositionTimeMs: number;
  finalBadness: number;
};

export type StoryComposerResult = NewspaperCompositionResult & {
  diagnostics: StoryComposerDiagnostics;
};

type StoryCandidate = {
  id: string;
  result: HyphenationJustificationResult;
  targetMinFill: number;
};

type StoryScore = {
  storyScore: number;
  paragraphScores: number[];
  storyFillPercent: number;
  bottomWhitespace: number;
  averageParagraphScore: number;
  rejectedCandidates: number;
  finalStoryQuality: number;
};

const TARGET_STORY_FILL_PERCENT = 98;
const MAX_ITERATIONS = 100;
const MIN_CONVERGENCE_DELTA_RATIO = 0.005;

const candidateTargetFills = [0.88, 0.9, 0.92, 0.94, 0.96, 0.86, 0.89, 0.91, 0.93, 0.95, 0.97];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const scoreStoryCandidate = (
  candidate: StoryCandidate,
  input: StoryComposerInput,
): StoryScore => {
  const totalCapacity = Math.max(1, input.totalCapacity);
  const storyFillPercent = clamp((input.visibleLineCount / totalCapacity) * 100, 0, 100);
  const bottomWhitespaceLines =
    input.remainingLineCount > 0 ? 0 : Math.max(0, input.totalCapacity - input.visibleLineCount);
  const bottomWhitespace = bottomWhitespaceLines * input.lineHeight;
  const bottomWhitespacePenalty =
    input.remainingLineCount > 0
      ? input.remainingLineCount * 1000
      : Math.abs(TARGET_STORY_FILL_PERCENT - storyFillPercent) * 28 + bottomWhitespaceLines * 45;
  const grayPenalty = candidate.result.diagnostics.spacingVariance * 18;
  const riverPenalty = candidate.result.diagnostics.riverScore * 0.9;
  const widowPenalty = candidate.result.diagnostics.widowScore * 0.8;
  const orphanPenalty = candidate.result.diagnostics.orphanScore * 0.8;
  const paragraphScores = [candidate.result.diagnostics.paragraphQuality];
  const averageParagraphScore =
    paragraphScores.reduce((sum, score) => sum + score, 0) / Math.max(1, paragraphScores.length);
  const rejectedCandidates = candidate.result.lines.filter((line) => line.rejected).length;
  const rejectedPenalty = rejectedCandidates * 200;
  const shortFinalLinePenalty = (() => {
    const lastLine = candidate.result.lines.at(-1);

    if (!lastLine || candidate.result.lines.length <= 1) {
      return 0;
    }

    return lastLine.fillPercent < 25 ? (25 - lastLine.fillPercent) * 14 : 0;
  })();
  const storyScore =
    candidate.result.diagnostics.badnessScore +
    bottomWhitespacePenalty +
    grayPenalty +
    riverPenalty +
    widowPenalty +
    orphanPenalty +
    rejectedPenalty +
    shortFinalLinePenalty +
    Math.max(0, 92 - averageParagraphScore) * 20;

  return {
    storyScore,
    paragraphScores,
    storyFillPercent,
    bottomWhitespace,
    averageParagraphScore,
    rejectedCandidates,
    finalStoryQuality: clamp(100 - storyScore / 120, 0, 100),
  };
};

const mergeDiagnostics = ({
  candidate,
  score,
  iterations,
  optimizationPasses,
}: {
  candidate: StoryCandidate;
  score: StoryScore;
  iterations: number;
  optimizationPasses: number;
}): StoryComposerDiagnostics => ({
  ...candidate.result.diagnostics,
  storyScore: score.storyScore,
  paragraphScores: score.paragraphScores,
  storyFillPercent: score.storyFillPercent,
  bottomWhitespace: score.bottomWhitespace,
  storyCompositionIterations: iterations,
  storyOptimizationPasses: optimizationPasses,
  averageParagraphScore: score.averageParagraphScore,
  bestCandidateScore: score.storyScore,
  rejectedCandidates: score.rejectedCandidates,
  finalStoryQuality: score.finalStoryQuality,
});

export const composeStoryBody = (input: StoryComposerInput): StoryComposerResult => {
  const maxIterations = Math.min(Math.max(input.maxIterations ?? MAX_ITERATIONS, 1), MAX_ITERATIONS);
  let bestCandidate: StoryCandidate | null = null;
  let bestScore: StoryScore | null = null;
  let previousBestScore = Number.POSITIVE_INFINITY;
  let iterations = 0;

  for (const targetMinFill of candidateTargetFills) {
    if (iterations >= maxIterations) {
      break;
    }

    iterations += 1;

    const result = composeHyphenationJustification({
      lines: input.lines,
      style: input.style,
      justifyMode: input.justifyMode,
      engineMode: input.engineMode,
      settings: input.hyphenationJustificationSettings,
      targetMinFill,
    });
    const candidate: StoryCandidate = {
      id: `story-fill-${Math.round(targetMinFill * 100)}`,
      result,
      targetMinFill,
    };
    const score = scoreStoryCandidate(candidate, input);

    if (!bestScore || score.storyScore < bestScore.storyScore) {
      bestCandidate = candidate;
      bestScore = score;

      if (
        Number.isFinite(previousBestScore) &&
        Math.abs(previousBestScore - score.storyScore) / Math.max(1, previousBestScore) <
          MIN_CONVERGENCE_DELTA_RATIO
      ) {
        break;
      }

      previousBestScore = score.storyScore;
    }
  }

  const selectedCandidate =
    bestCandidate ??
    {
      id: "story-base",
      targetMinFill: 0.92,
      result: composeHyphenationJustification({
        lines: input.lines,
        style: input.style,
        justifyMode: input.justifyMode,
        engineMode: input.engineMode,
        settings: input.hyphenationJustificationSettings,
      }),
    };
  const selectedScore = bestScore ?? scoreStoryCandidate(selectedCandidate, input);

  return {
    ...selectedCandidate.result,
    diagnostics: mergeDiagnostics({
      candidate: selectedCandidate,
      score: selectedScore,
      iterations,
      optimizationPasses: iterations,
    }),
  };
};

export const StoryComposerEngine = {
  composeStoryBody,
};
