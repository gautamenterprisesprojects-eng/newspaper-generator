import type {
  EditorialJustifyMode,
  EditorialJustifyEngineMode,
  EditorialTextAlignment,
  EditorialVerticalAlignment,
  HyphenationJustificationOptimizationLevel,
  HyphenationJustificationPresetName,
  UniversalTypographyControls,
} from "@/types/editor";

export const DEFAULT_BODY_JUSTIFY_ENGINE: EditorialJustifyEngineMode = "browser";
const DEFAULT_DISPLAY_JUSTIFY_ENGINE: EditorialJustifyEngineMode = "newspaper";

type HyphenationJustificationPreset = Pick<
  UniversalTypographyControls,
  | "hjWordSpacingMin"
  | "hjWordSpacingMax"
  | "hjTrackingMin"
  | "hjTrackingMax"
  | "hjHyphenation"
  | "hjMaximumConsecutiveHyphens"
  | "hjMinimumWordLength"
  | "hjMinimumBeforeHyphen"
  | "hjMinimumAfterHyphen"
  | "hjOptimizationLevel"
>;

export const hyphenationJustificationPresets: Record<
  HyphenationJustificationPresetName,
  HyphenationJustificationPreset
> = {
  "newspaper-hindi-body": {
    hjWordSpacingMin: 96,
    hjWordSpacingMax: 108,
    hjTrackingMin: 0,
    hjTrackingMax: 0,
    hjHyphenation: false,
    hjMaximumConsecutiveHyphens: 0,
    hjMinimumWordLength: 8,
    hjMinimumBeforeHyphen: 3,
    hjMinimumAfterHyphen: 3,
    hjOptimizationLevel: "balanced",
  },
  "newspaper-english-body": {
    hjWordSpacingMin: 92,
    hjWordSpacingMax: 175,
    hjTrackingMin: -1,
    hjTrackingMax: 1,
    hjHyphenation: true,
    hjMaximumConsecutiveHyphens: 2,
    hjMinimumWordLength: 7,
    hjMinimumBeforeHyphen: 3,
    hjMinimumAfterHyphen: 3,
    hjOptimizationLevel: "balanced",
  },
  "compact-narrow-column": {
    hjWordSpacingMin: 90,
    hjWordSpacingMax: 116,
    hjTrackingMin: -1.5,
    hjTrackingMax: 1,
    hjHyphenation: true,
    hjMaximumConsecutiveHyphens: 2,
    hjMinimumWordLength: 6,
    hjMinimumBeforeHyphen: 3,
    hjMinimumAfterHyphen: 3,
    hjOptimizationLevel: "quality",
  },
  "relaxed-wide-column": {
    hjWordSpacingMin: 96,
    hjWordSpacingMax: 110,
    hjTrackingMin: -0.5,
    hjTrackingMax: 0.5,
    hjHyphenation: true,
    hjMaximumConsecutiveHyphens: 1,
    hjMinimumWordLength: 8,
    hjMinimumBeforeHyphen: 3,
    hjMinimumAfterHyphen: 4,
    hjOptimizationLevel: "balanced",
  },
  custom: {
    hjWordSpacingMin: 95,
    hjWordSpacingMax: 105,
    hjTrackingMin: -2,
    hjTrackingMax: 2,
    hjHyphenation: true,
    hjMaximumConsecutiveHyphens: 2,
    hjMinimumWordLength: 7,
    hjMinimumBeforeHyphen: 3,
    hjMinimumAfterHyphen: 3,
    hjOptimizationLevel: "balanced",
  },
};

export const defaultUniversalTypographyControls: UniversalTypographyControls = {
  headlineAlignment: "left",
  headlineVerticalAlignment: "top",
  subheadlineAlignment: "left",
  subheadlineVerticalAlignment: "top",
  bodyAlignment: "justify",
  justifyMode: "justify-except-last",
  justifyEngineMode: "newspaper",
  subheadlineJustifyMode: "justify-except-last",
  subheadlineJustifyEngineMode: "newspaper",
  bodyJustifyMode: "justify-except-last",
  bodyJustifyEngineMode: DEFAULT_BODY_JUSTIFY_ENGINE,
  hjWordSpacingMin: 96,
  hjWordSpacingMax: 108,
  hjTrackingMin: 0,
  hjTrackingMax: 0,
  hjHyphenation: false,
  hjMaximumConsecutiveHyphens: 0,
  hjMinimumWordLength: 8,
  hjMinimumBeforeHyphen: 3,
  hjMinimumAfterHyphen: 3,
  hjOptimizationLevel: "balanced",
  hjPreset: "newspaper-hindi-body",
  captionJustifyMode: "justify-except-last",
  captionJustifyEngineMode: "newspaper",
  creditJustifyMode: "justify-except-last",
  creditJustifyEngineMode: "newspaper",
  sourceJustifyMode: "justify-except-last",
  sourceJustifyEngineMode: "newspaper",
  factBoxContentJustifyMode: "justify-except-last",
  factBoxContentJustifyEngineMode: "newspaper",
  wordSpacing: 0,
  headlineTracking: 0,
  subheadlineTracking: 0,
  bodyTracking: 0,
  captionTracking: 0,
  headlineLetterSpacing: 0,
  subheadlineLetterSpacing: 0,
  bodyLetterSpacing: 0,
  captionLetterSpacing: 0,
  paragraphGap: 0,
  firstLineIndent: 0,
  paragraphIndent: 0,
  captionAlignment: "left",
  creditAlignment: "left",
  sourceAlignment: "left",
  factBoxHeadlineAlignment: "left",
  factBoxContentAlignment: "left",
  pullQuoteAlignment: "center",
  pullQuoteVerticalAlignment: "top",
  factBoxVerticalAlignment: "top",
};

const textAlignments: EditorialTextAlignment[] = ["left", "center", "right", "justify"];
const verticalAlignments: EditorialVerticalAlignment[] = ["top", "middle", "bottom"];
const justifyModes: EditorialJustifyMode[] = ["justify-except-last", "justify-all-lines"];
const justifyEngineModes: EditorialJustifyEngineMode[] = ["browser", "newspaper"];
const hjOptimizationLevels: HyphenationJustificationOptimizationLevel[] = ["fast", "balanced", "quality"];
const hjPresetNames = Object.keys(hyphenationJustificationPresets) as HyphenationJustificationPresetName[];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ensureTextAlignment = (value: unknown, fallback: EditorialTextAlignment): EditorialTextAlignment =>
  textAlignments.includes(value as EditorialTextAlignment)
    ? (value as EditorialTextAlignment)
    : fallback;

const ensureHorizontalAlignment = (
  value: unknown,
  fallback: Exclude<EditorialTextAlignment, "justify">,
): Exclude<EditorialTextAlignment, "justify"> => {
  const alignment = ensureTextAlignment(value, fallback);

  return alignment === "justify" ? fallback : alignment;
};

const ensureVerticalAlignment = (
  value: unknown,
  fallback: EditorialVerticalAlignment,
): EditorialVerticalAlignment =>
  verticalAlignments.includes(value as EditorialVerticalAlignment)
    ? (value as EditorialVerticalAlignment)
    : fallback;

const ensureJustifyMode = (value: unknown): EditorialJustifyMode =>
  justifyModes.includes(value as EditorialJustifyMode)
    ? (value as EditorialJustifyMode)
    : "justify-except-last";

const ensureJustifyEngineMode = (
  value: unknown,
  fallback: EditorialJustifyEngineMode = DEFAULT_DISPLAY_JUSTIFY_ENGINE,
): EditorialJustifyEngineMode =>
  justifyEngineModes.includes(value as EditorialJustifyEngineMode)
    ? (value as EditorialJustifyEngineMode)
    : fallback;

const ensureHjOptimizationLevel = (value: unknown): HyphenationJustificationOptimizationLevel =>
  hjOptimizationLevels.includes(value as HyphenationJustificationOptimizationLevel)
    ? (value as HyphenationJustificationOptimizationLevel)
    : "balanced";

const ensureHjPreset = (value: unknown): HyphenationJustificationPresetName =>
  hjPresetNames.includes(value as HyphenationJustificationPresetName)
    ? (value as HyphenationJustificationPresetName)
    : "newspaper-hindi-body";

export const normalizeUniversalTypographyControls = (
  controls: Partial<UniversalTypographyControls> | undefined,
): UniversalTypographyControls => {
  const source = controls ?? {};

  return {
    headlineAlignment: ensureHorizontalAlignment(source.headlineAlignment, "left"),
    headlineVerticalAlignment: ensureVerticalAlignment(source.headlineVerticalAlignment, "top"),
    subheadlineAlignment: ensureTextAlignment(source.subheadlineAlignment, "left"),
    subheadlineVerticalAlignment: ensureVerticalAlignment(source.subheadlineVerticalAlignment, "top"),
    bodyAlignment: ensureTextAlignment(source.bodyAlignment, "justify"),
    justifyMode: ensureJustifyMode(source.justifyMode),
    justifyEngineMode: ensureJustifyEngineMode(source.justifyEngineMode),
    subheadlineJustifyMode: ensureJustifyMode(source.subheadlineJustifyMode ?? source.justifyMode),
    subheadlineJustifyEngineMode: ensureJustifyEngineMode(source.subheadlineJustifyEngineMode ?? source.justifyEngineMode),
    bodyJustifyMode: ensureJustifyMode(source.bodyJustifyMode ?? source.justifyMode),
    bodyJustifyEngineMode: ensureJustifyEngineMode(source.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE),
    hjWordSpacingMin: clamp(source.hjWordSpacingMin ?? defaultUniversalTypographyControls.hjWordSpacingMin, 80, 100),
    hjWordSpacingMax: clamp(source.hjWordSpacingMax ?? defaultUniversalTypographyControls.hjWordSpacingMax, 100, 140),
    hjTrackingMin: clamp(source.hjTrackingMin ?? defaultUniversalTypographyControls.hjTrackingMin, -10, 0),
    hjTrackingMax: clamp(source.hjTrackingMax ?? defaultUniversalTypographyControls.hjTrackingMax, 0, 10),
    hjHyphenation: source.hjHyphenation ?? defaultUniversalTypographyControls.hjHyphenation,
    hjMaximumConsecutiveHyphens: clamp(
      source.hjMaximumConsecutiveHyphens ?? defaultUniversalTypographyControls.hjMaximumConsecutiveHyphens,
      0,
      6,
    ),
    hjMinimumWordLength: clamp(source.hjMinimumWordLength ?? defaultUniversalTypographyControls.hjMinimumWordLength, 4, 24),
    hjMinimumBeforeHyphen: clamp(source.hjMinimumBeforeHyphen ?? 3, 2, 12),
    hjMinimumAfterHyphen: clamp(source.hjMinimumAfterHyphen ?? 3, 2, 12),
    hjOptimizationLevel: ensureHjOptimizationLevel(source.hjOptimizationLevel),
    hjPreset: ensureHjPreset(source.hjPreset),
    captionJustifyMode: ensureJustifyMode(source.captionJustifyMode ?? source.justifyMode),
    captionJustifyEngineMode: ensureJustifyEngineMode(source.captionJustifyEngineMode ?? source.justifyEngineMode),
    creditJustifyMode: ensureJustifyMode(source.creditJustifyMode ?? source.justifyMode),
    creditJustifyEngineMode: ensureJustifyEngineMode(source.creditJustifyEngineMode ?? source.justifyEngineMode),
    sourceJustifyMode: ensureJustifyMode(source.sourceJustifyMode ?? source.justifyMode),
    sourceJustifyEngineMode: ensureJustifyEngineMode(source.sourceJustifyEngineMode ?? source.justifyEngineMode),
    factBoxContentJustifyMode: ensureJustifyMode(source.factBoxContentJustifyMode ?? source.justifyMode),
    factBoxContentJustifyEngineMode: ensureJustifyEngineMode(source.factBoxContentJustifyEngineMode ?? source.justifyEngineMode),
    wordSpacing: clamp(source.wordSpacing ?? 0, 0, 20),
    headlineTracking: clamp(source.headlineTracking ?? 0, -200, 500),
    subheadlineTracking: clamp(source.subheadlineTracking ?? 0, -200, 500),
    bodyTracking: clamp(source.bodyTracking ?? 0, -200, 500),
    captionTracking: clamp(source.captionTracking ?? 0, -200, 500),
    headlineLetterSpacing: clamp(source.headlineLetterSpacing ?? 0, -2, 10),
    subheadlineLetterSpacing: clamp(source.subheadlineLetterSpacing ?? 0, -2, 10),
    bodyLetterSpacing: clamp(source.bodyLetterSpacing ?? 0, -2, 10),
    captionLetterSpacing: clamp(source.captionLetterSpacing ?? 0, -2, 10),
    paragraphGap: clamp(source.paragraphGap ?? 0, 0, 40),
    firstLineIndent: clamp(source.firstLineIndent ?? 0, 0, 40),
    paragraphIndent: clamp(source.paragraphIndent ?? 0, 0, 40),
    captionAlignment: ensureTextAlignment(source.captionAlignment, "left"),
    creditAlignment: ensureTextAlignment(source.creditAlignment, "left"),
    sourceAlignment: ensureTextAlignment(source.sourceAlignment, "left"),
    factBoxHeadlineAlignment: ensureHorizontalAlignment(source.factBoxHeadlineAlignment, "left"),
    factBoxContentAlignment: ensureTextAlignment(source.factBoxContentAlignment, "left"),
    pullQuoteAlignment: ensureHorizontalAlignment(source.pullQuoteAlignment, "center"),
    pullQuoteVerticalAlignment: ensureVerticalAlignment(source.pullQuoteVerticalAlignment, "top"),
    factBoxVerticalAlignment: ensureVerticalAlignment(source.factBoxVerticalAlignment, "top"),
  };
};

export const applyHyphenationJustificationPreset = (
  controls: UniversalTypographyControls,
  presetName: HyphenationJustificationPresetName,
): UniversalTypographyControls => ({
  ...controls,
  ...hyphenationJustificationPresets[presetName],
  hjPreset: presetName,
});

export const UniversalTypographyEngine = {
  applyHyphenationJustificationPreset,
  defaultUniversalTypographyControls,
  hyphenationJustificationPresets,
  normalizeUniversalTypographyControls,
};
