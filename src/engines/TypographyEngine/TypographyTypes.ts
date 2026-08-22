export type ScriptSystem = "unicode" | "kruti-dev" | "chanakya" | "4c-gandhi" | "english" | "mixed";

export type HeadlineLayoutMode = "balanced" | "newspaper-fill";

export type HeadlineCandidateType = "balanced" | "newspaper-fill" | "hyphenated";

export type HeadlineCandidateScore = {
  type: HeadlineCandidateType;
  lines: string[];
  line1FillPercent: number;
  line2FillPercent: number;
  unusedPixels: number;
  score: number;
  reason: string;
};

export type TypographyInput = {
  text: string;
  width: number;
  fontFamily: string;
  fontSize: number;
  fontStyle?: string;
  lineHeight: number;
  maxLines?: number;
  maxHeight?: number;
  script?: ScriptSystem;
  /** See TextMeasurementInput.letterSpacing. Defaults to 0. */
  letterSpacing?: number;
  /** See TextMeasurementInput.wordSpacing. Defaults to 0. */
  wordSpacing?: number;
  /** Body-only option; ignored by generic paragraph measurement. */
  enableEnglishHyphenation?: boolean;
};

export type HeadlineFitInput = {
  text: string;
  width: number;
  maxLines: number;
  fontFamily: string;
  maxFontSize: number;
  minFontSize: number;
  fontStyle?: string;
  lineHeight: number;
  script?: ScriptSystem;
  autoBalance?: boolean;
  enableHyphenation?: boolean;
  forceFullWidth?: boolean;
  headlineLayoutMode?: HeadlineLayoutMode;
};

export type HeadlineBalanceInput = {
  headline: string;
  availableWidth: number;
  fontSize: number;
  maxLines: number;
  fontFamily?: string;
  fontStyle?: string;
  autoBalance?: boolean;
  enableHyphenation?: boolean;
  forceFullWidth?: boolean;
  headlineLayoutMode?: HeadlineLayoutMode;
};

export type TypographyLine = {
  text: string;
  width: number;
  start: number;
  end: number;
};

export type TypographyResult = {
  lines: TypographyLine[];
  wrappedLines: string[];
  lineCount: number;
  consumedHeight: number;
  consumedWidth: number;
  paragraphWidth: number;
  paragraphHeight: number;
  overflow: boolean;
  fullLineCount: number;
};

export type HeadlineFitResult = TypographyResult & {
  fontSize: number;
  wrappedLines: string[];
  visualBalanceScore: number;
  balanceScore: number;
  selectedCandidateScore: number;
  selectedCandidateType: HeadlineCandidateType;
  selectedCandidateReason: string;
  selectedLayout: string[];
  candidateLayouts: string[][];
  topCandidateScores: HeadlineCandidateScore[];
};

export type HeadlineBalanceResult = {
  lines: TypographyLine[];
  wrappedLines: string[];
  lineCount: number;
  consumedWidth: number;
  overflow: boolean;
  score: number;
  visualBalanceScore: number;
  balanceScore: number;
  selectedCandidateScore: number;
  selectedCandidateType: HeadlineCandidateType;
  selectedCandidateReason: string;
  selectedLayout: string[];
  candidateLayouts: string[][];
  topCandidateScores: HeadlineCandidateScore[];
  candidateCount: number;
};

export type TextMetricsProvider = {
  measureText: (text: string) => Pick<TextMetrics, "width">;
};

export type TextMeasureOptions = {
  provider?: TextMetricsProvider;
};

export type TextMeasurementInput = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle?: string;
  /**
   * Extra space per character gap, in px. Canvas `measureText` cannot express
   * tracking, so it is applied arithmetically on top of the measured width —
   * without this, line breaking is blind to tracking and horizontal copyfitting
   * can never move a word onto another line. Defaults to 0 (no change).
   */
  letterSpacing?: number;
  /** Extra space per inter-word space, in px. Defaults to 0 (no change). */
  wordSpacing?: number;
};
