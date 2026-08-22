import type { StoryPriority, StoryTypographyWeight } from "@/types/editor";

export type HeadlineHierarchyLevel =
  | "hero"
  | "secondary-lead"
  | "strong"
  | "medium"
  | "small"
  | "brief";

export type HeadlineHierarchyConfig = {
  level: HeadlineHierarchyLevel;
  label: string;
  minFontSize: number;
  maxFontSize: number;
  headlineWeight: StoryTypographyWeight;
  lineHeight: number;
  letterSpacing: number;
  showSubheadline: boolean;
  subheadlineSizeRatio: number;
};

export const HEADLINE_HIERARCHY_LEVELS: Record<HeadlineHierarchyLevel, HeadlineHierarchyConfig> = {
  "hero": {
    level: "hero",
    label: "Hero Lead",
    minFontSize: 48,
    maxFontSize: 72,
    headlineWeight: "800",
    lineHeight: 1.34,
    letterSpacing: -0.02,
    showSubheadline: true,
    subheadlineSizeRatio: 0.55,
  },
  "secondary-lead": {
    level: "secondary-lead",
    label: "Secondary Lead",
    minFontSize: 36,
    maxFontSize: 48,
    headlineWeight: "700",
    lineHeight: 1.35,
    letterSpacing: -0.015,
    showSubheadline: true,
    subheadlineSizeRatio: 0.55,
  },
  "strong": {
    level: "strong",
    label: "Strong Story",
    minFontSize: 28,
    maxFontSize: 36,
    headlineWeight: "700",
    lineHeight: 1.37,
    letterSpacing: -0.01,
    showSubheadline: true,
    subheadlineSizeRatio: 0.6,
  },
  "medium": {
    level: "medium",
    label: "Medium Story",
    minFontSize: 20,
    maxFontSize: 28,
    headlineWeight: "600",
    lineHeight: 1.39,
    letterSpacing: 0,
    showSubheadline: true,
    subheadlineSizeRatio: 0.62,
  },
  "small": {
    level: "small",
    label: "Small Story",
    minFontSize: 16,
    maxFontSize: 22,
    headlineWeight: "600",
    lineHeight: 1.39,
    letterSpacing: 0,
    showSubheadline: false,
    subheadlineSizeRatio: 0.65,
  },
  "brief": {
    level: "brief",
    label: "Brief",
    minFontSize: 12,
    maxFontSize: 16,
    headlineWeight: "500",
    lineHeight: 1.4,
    letterSpacing: 0,
    showSubheadline: false,
    subheadlineSizeRatio: 0.7,
  },
};

export type HeadlineImportanceInput = {
  priority: StoryPriority;
  width: number;
  height: number;
  columnSpan: number;
  hasImage: boolean;
  imageArea?: number;
  positionX?: number;
  positionY?: number;
};

export const calculateHeadlineImportanceScore = (input: HeadlineImportanceInput): number => {
  const priorityWeight: Record<StoryPriority, number> = {
    lead: 50,
    major: 38,
    secondary: 26,
    brief: 14,
    filler: 6,
  };

  const pScore = priorityWeight[input.priority] ?? 20;
  const colScore = Math.min(6, Math.max(1, input.columnSpan)) * 8;
  const areaInInches = ((input.width / 72) * (input.height / 72));
  const areaScore = Math.min(25, areaInInches * 1.5);
  const imageScore = input.hasImage ? 12 + Math.min(10, ((input.imageArea ?? 0) / 72 / 72) * 1.2) : 0;
  const positionScore = typeof input.positionY === "number" && input.positionY < 200 ? 12 : 0;

  return pScore + colScore + areaScore + imageScore + positionScore;
};

export const determineHeadlineHierarchyLevel = (
  importanceScore: number,
  priority: StoryPriority,
  columnSpan: number,
): HeadlineHierarchyLevel => {
  if (importanceScore >= 95 || (priority === "lead" && columnSpan >= 4)) {
    return "hero";
  }
  if (importanceScore >= 75 || (priority === "lead" && columnSpan >= 3)) {
    return "secondary-lead";
  }
  if (importanceScore >= 58 || (priority === "major" && columnSpan >= 3)) {
    return "strong";
  }
  if (importanceScore >= 40 || priority === "secondary") {
    return "medium";
  }
  if (importanceScore >= 24 || priority === "brief") {
    return "small";
  }
  return "brief";
};

export const interpolateHeadlineFontSize = (
  levelConfig: HeadlineHierarchyConfig,
  headlineText: string,
  availableWidth: number,
  columnSpan: number,
): number => {
  const { minFontSize, maxFontSize } = levelConfig;
  const charLength = headlineText.trim().length;

  const colFactor = (Math.min(6, Math.max(1, columnSpan)) - 1) / 5;
  const lengthFactor = charLength <= 25 ? 1.0 : charLength >= 75 ? 0.0 : (75 - charLength) / 50;
  const widthFactor = Math.min(1.0, Math.max(0.0, (availableWidth - 100) / 400));

  const blendedFactor = colFactor * 0.45 + lengthFactor * 0.35 + widthFactor * 0.20;
  const interpolated = minFontSize + (maxFontSize - minFontSize) * blendedFactor;

  return Math.round(Math.min(maxFontSize, Math.max(minFontSize, interpolated)));
};
