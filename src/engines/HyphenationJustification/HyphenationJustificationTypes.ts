import type {
  ArticleTextStyle,
  EditorialJustifyEngineMode,
  EditorialJustifyMode,
  HyphenationJustificationOptimizationLevel,
  UniversalTypographyControls,
} from "@/types/editor";
import type {
  NewspaperCompositionLineInput,
  NewspaperCompositionResult,
} from "@/engines/NewspaperComposition/NewspaperCompositionEngine";

export type HyphenationJustificationSettings = {
  wordSpacingMin: number;
  wordSpacingMax: number;
  trackingMin: number;
  trackingMax: number;
  hyphenation: boolean;
  maximumConsecutiveHyphens: number;
  minimumWordLength: number;
  minimumBeforeHyphen: number;
  minimumAfterHyphen: number;
  optimizationLevel: HyphenationJustificationOptimizationLevel;
};

export type HyphenationJustificationInput = {
  lines: NewspaperCompositionLineInput[];
  style: ArticleTextStyle;
  justifyMode: EditorialJustifyMode;
  engineMode: EditorialJustifyEngineMode;
  settings: HyphenationJustificationSettings;
  targetMinFill?: number;
};

export type HyphenationJustificationDiagnostics = {
  paragraphQuality: number;
  riverScore: number;
  grayValue: number;
  grayBalanceScore: number;
  averageWordSpacing: number;
  averageTracking: number;
  trackingVariance: number;
  gapVariance: number;
  hyphenCount: number;
  optimizationPasses: number;
  rejectedCandidates: number;
  acceptedCandidates: number;
  paragraphCandidates: number;
  beamWidth: number;
  cacheHit: boolean;
  cacheKey: string;
  optimizationTimeMs: number;
  compositionTimeMs: number;
  selectedCandidate: string;
  finalBadness: number;
};

export type HyphenationJustificationResult = NewspaperCompositionResult & {
  diagnostics: NewspaperCompositionResult["diagnostics"] & HyphenationJustificationDiagnostics;
};

export const getHyphenationJustificationSettings = (
  typography: UniversalTypographyControls,
): HyphenationJustificationSettings => ({
  wordSpacingMin: typography.hjWordSpacingMin,
  wordSpacingMax: typography.hjWordSpacingMax,
  trackingMin: typography.hjTrackingMin,
  trackingMax: typography.hjTrackingMax,
  hyphenation: typography.hjHyphenation,
  maximumConsecutiveHyphens: typography.hjMaximumConsecutiveHyphens,
  minimumWordLength: typography.hjMinimumWordLength,
  minimumBeforeHyphen: typography.hjMinimumBeforeHyphen,
  minimumAfterHyphen: typography.hjMinimumAfterHyphen,
  optimizationLevel: typography.hjOptimizationLevel,
});
