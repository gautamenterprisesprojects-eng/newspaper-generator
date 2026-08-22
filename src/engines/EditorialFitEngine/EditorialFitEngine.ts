import type { StoryImageHeightPreset } from "@/types/editor";

export type EditorialFitStatus = "PERFECT" | "GOOD" | "NEEDS_FIT" | "POOR";

export type EditorialFitCandidateSettings = {
  bodyFontSize: number;
  bodyLineHeight: number;
  captionSpacingAdjustment: number;
  imageHeight: number;
  imageHeightPreset: StoryImageHeightPreset;
  pullQuoteHeightAdjustment: number;
  factBoxHeightAdjustment: number;
};

export type EditorialFitCandidateMetrics = {
  storyArea: number;
  usedArea: number;
  textArea: number;
  imageArea: number;
  fillPercentage: number;
  whitespacePercentage: number;
  overflowPercentage: number;
  overflow: boolean;
};

export type EditorialFitCandidate = {
  id: string;
  settings: EditorialFitCandidateSettings;
  metrics: EditorialFitCandidateMetrics;
  score: number;
  status: EditorialFitStatus;
  rejected: boolean;
  reason: string;
};

export type EditorialFitConstraints = {
  minBodyFontSize: number;
  maxBodyFontSize: number;
  minBodyLineHeight: number;
  maxBodyLineHeight: number;
  maxImageHeight: number;
  imageEnabled: boolean;
  allowImageGrowth: boolean;
};

export type EditorialFitInput = {
  baseSettings: EditorialFitCandidateSettings;
  baseMetrics: EditorialFitCandidateMetrics;
  constraints: EditorialFitConstraints;
  evaluateCandidate: (settings: EditorialFitCandidateSettings) => EditorialFitCandidateMetrics;
};

export type EditorialFitResult = {
  selectedCandidate: EditorialFitCandidate;
  candidates: EditorialFitCandidate[];
  editorialFitScore: number;
  fillPercentage: number;
  whitespacePercentage: number;
  overflowPercentage: number;
  fitStatus: EditorialFitStatus;
};

const TARGET_FILL_MIN = 95;
const TARGET_FILL_MAX = 98;
const TARGET_FILL_CENTER = 96.5;
const TARGET_WHITESPACE_MAX = 5;

const BODY_FONT_STEP = 0.25;
const BODY_FONT_MAX_DELTA = 1;
const BODY_LINE_HEIGHT_DELTAS = [0, 0.02, 0.04];
const IMAGE_HEIGHT_DELTAS = [0, 24, 48];
const IMAGE_PRESETS: StoryImageHeightPreset[] = ["tiny", "small", "medium", "large", "xl", "custom"];

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const roundHundredth = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getEditorialFitStatus = ({
  fillPercentage,
  whitespacePercentage,
  overflow,
}: Pick<EditorialFitCandidateMetrics, "fillPercentage" | "whitespacePercentage" | "overflow">): EditorialFitStatus => {
  if (!overflow && fillPercentage >= 95 && whitespacePercentage <= 5) {
    return "PERFECT";
  }

  if (!overflow && fillPercentage >= 92 && whitespacePercentage <= 8) {
    return "GOOD";
  }

  if (!overflow && fillPercentage >= 85) {
    return "NEEDS_FIT";
  }

  return "POOR";
};

const getPresetStepUp = (preset: StoryImageHeightPreset): StoryImageHeightPreset => {
  const index = IMAGE_PRESETS.indexOf(preset);

  if (index < 0 || index >= IMAGE_PRESETS.length - 2) {
    return preset;
  }

  return IMAGE_PRESETS[index + 1];
};

const createSettingsKey = (settings: EditorialFitCandidateSettings) =>
  [
    settings.bodyFontSize,
    settings.bodyLineHeight,
    settings.captionSpacingAdjustment,
    settings.imageHeight,
    settings.imageHeightPreset,
    settings.pullQuoteHeightAdjustment,
    settings.factBoxHeightAdjustment,
  ].join(":");

const scoreCandidate = (
  metrics: EditorialFitCandidateMetrics,
  settings: EditorialFitCandidateSettings,
  baseSettings: EditorialFitCandidateSettings,
) => {
  if (metrics.overflow || metrics.overflowPercentage > 0) {
    return {
      score: -1_000_000 - metrics.overflowPercentage * 1_000,
      rejected: true,
      reason: "rejected: overflow",
    };
  }

  const fillDistance =
    metrics.fillPercentage < TARGET_FILL_MIN
      ? TARGET_FILL_MIN - metrics.fillPercentage
      : metrics.fillPercentage > TARGET_FILL_MAX
        ? metrics.fillPercentage - TARGET_FILL_MAX
        : 0;
  const whitespacePenalty = Math.max(0, metrics.whitespacePercentage - TARGET_WHITESPACE_MAX) * 3.2;
  const readabilityPenalty =
    Math.abs(settings.bodyFontSize - baseSettings.bodyFontSize) * 1.4 +
    Math.abs(settings.bodyLineHeight - baseSettings.bodyLineHeight) * 18 +
    Math.max(0, settings.imageHeight - baseSettings.imageHeight) * 0.015;
  const score =
    100 -
    Math.abs(TARGET_FILL_CENTER - metrics.fillPercentage) * 2.2 -
    fillDistance * 6 -
    whitespacePenalty -
    readabilityPenalty;
  const reason =
    metrics.fillPercentage >= TARGET_FILL_MIN && metrics.whitespacePercentage <= TARGET_WHITESPACE_MAX
      ? "selected: target newspaper fill achieved"
      : "selected: best safe whitespace reduction without overflow";

  return {
    score: roundHundredth(score),
    rejected: false,
    reason,
  };
};

const createFontSizes = (base: number, min: number, max: number) => {
  const values: number[] = [];
  const safeMax = Math.min(max, base + BODY_FONT_MAX_DELTA);

  for (let value = base; value <= safeMax + 0.0001; value += BODY_FONT_STEP) {
    values.push(roundHundredth(clamp(value, min, max)));
  }

  return Array.from(new Set(values));
};

const createLineHeights = (base: number, min: number, max: number) =>
  Array.from(
    new Set(
      BODY_LINE_HEIGHT_DELTAS.map((delta) => roundHundredth(clamp(base + delta, min, max))).concat([
        roundHundredth(clamp(1.08, min, max)),
        roundHundredth(clamp(1.1, min, max)),
        roundHundredth(clamp(1.12, min, max)),
      ]),
    ),
  ).sort((first, second) => first - second);

const createImageHeights = (
  baseSettings: EditorialFitCandidateSettings,
  constraints: EditorialFitConstraints,
) => {
  if (!constraints.imageEnabled || !constraints.allowImageGrowth) {
    return [{ height: baseSettings.imageHeight, preset: baseSettings.imageHeightPreset }];
  }

  return IMAGE_HEIGHT_DELTAS.map((delta) => ({
    height: Math.round(clamp(baseSettings.imageHeight + delta, 1, constraints.maxImageHeight)),
    preset: delta > 0 ? getPresetStepUp(baseSettings.imageHeightPreset) : baseSettings.imageHeightPreset,
  }));
};

export const createEditorialFitMetrics = ({
  storyArea,
  usedArea,
  textArea,
  imageArea,
  overflow,
  overflowPercentage = overflow ? 100 : 0,
}: {
  storyArea: number;
  usedArea: number;
  textArea: number;
  imageArea: number;
  overflow: boolean;
  overflowPercentage?: number;
}): EditorialFitCandidateMetrics => {
  const safeStoryArea = Math.max(1, storyArea);
  const fillPercentage = clamp((usedArea / safeStoryArea) * 100, 0, 100);

  return {
    storyArea: safeStoryArea,
    usedArea: clamp(usedArea, 0, safeStoryArea),
    textArea: Math.max(0, textArea),
    imageArea: Math.max(0, imageArea),
    fillPercentage: roundTenth(fillPercentage),
    whitespacePercentage: roundTenth(clamp(100 - fillPercentage, 0, 100)),
    overflowPercentage: roundTenth(Math.max(0, overflowPercentage)),
    overflow,
  };
};

export const optimizeEditorialFit = ({
  baseSettings,
  baseMetrics,
  constraints,
  evaluateCandidate,
}: EditorialFitInput): EditorialFitResult => {
  const fontSizes = createFontSizes(
    baseSettings.bodyFontSize,
    constraints.minBodyFontSize,
    constraints.maxBodyFontSize,
  );
  const lineHeights = createLineHeights(
    baseSettings.bodyLineHeight,
    constraints.minBodyLineHeight,
    constraints.maxBodyLineHeight,
  );
  const imageHeights = createImageHeights(baseSettings, constraints);
  const candidateSettings = new Map<string, EditorialFitCandidateSettings>();

  candidateSettings.set(createSettingsKey(baseSettings), baseSettings);

  for (const bodyFontSize of fontSizes) {
    for (const bodyLineHeight of lineHeights) {
      const settings = {
        ...baseSettings,
        bodyFontSize,
        bodyLineHeight,
      };

      candidateSettings.set(createSettingsKey(settings), settings);
    }
  }

  for (const imageHeight of imageHeights) {
    const settings = {
      ...baseSettings,
      imageHeight: imageHeight.height,
      imageHeightPreset: imageHeight.preset,
    };

    candidateSettings.set(createSettingsKey(settings), settings);
  }

  const candidates = Array.from(candidateSettings.values()).map((settings, index) => {
    const metrics =
      createSettingsKey(settings) === createSettingsKey(baseSettings)
        ? baseMetrics
        : evaluateCandidate(settings);
    const score = scoreCandidate(metrics, settings, baseSettings);

    return {
      id: `fit-${index + 1}`,
      settings,
      metrics,
      score: score.score,
      status: getEditorialFitStatus(metrics),
      rejected: score.rejected,
      reason: score.reason,
    };
  });
  const viableCandidates = candidates.filter((candidate) => !candidate.rejected);
  const sortedCandidates = (viableCandidates.length > 0 ? viableCandidates : candidates)
    .slice()
    .sort((first, second) => second.score - first.score);
  const selectedCandidate = sortedCandidates[0];

  return {
    selectedCandidate,
    candidates: candidates.sort((first, second) => second.score - first.score),
    editorialFitScore: roundTenth(Math.max(0, selectedCandidate.score)),
    fillPercentage: selectedCandidate.metrics.fillPercentage,
    whitespacePercentage: selectedCandidate.metrics.whitespacePercentage,
    overflowPercentage: selectedCandidate.metrics.overflowPercentage,
    fitStatus: selectedCandidate.status,
  };
};

export const EditorialFitEngine = {
  createEditorialFitMetrics,
  getEditorialFitStatus,
  optimizeEditorialFit,
};
