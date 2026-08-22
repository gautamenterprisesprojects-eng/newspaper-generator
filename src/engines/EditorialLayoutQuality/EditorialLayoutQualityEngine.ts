import type { StoryImageHeightPreset, StoryImageSettings, StoryPriority } from "@/types/editor";

export type EditorialImageQualityInput = {
  priority: StoryPriority;
  imageSettings: StoryImageSettings;
  storyHeight: number;
  bodyHeight: number;
  columnCount: number;
  bodyText: string;
};

export type BodyWhitespaceInput = {
  totalCapacity: number;
  visibleLineCount: number;
  remainingLineCount: number;
};

export type EditorialImageQualityResult = {
  imageSettings: StoryImageSettings;
  imageWhitespaceRisk: number;
  adjusted: boolean;
  adjustments: string[];
};

const WHITESPACE_LIMIT = 0.15;
const IMAGE_SAFETY_MARGIN = 1;
const STORY_SAFETY_MARGIN = 36;
const NEWSPAPER_WRAP_MAX_HEIGHT_RATIO = 0.4;

export const IMAGE_HEIGHT_PRESET_VALUES: Record<StoryImageHeightPreset, number | null> = {
  tiny: 80,
  small: 120,
  medium: 180,
  large: 240,
  xl: 300,
  custom: null,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getMaxImageHeightRatio = (priority: StoryPriority) => {
  if (priority === "lead") {
    return 0.34;
  }

  if (priority === "major") {
    return 0.28;
  }

  if (priority === "secondary") {
    return 0.2;
  }

  return 0.14;
};

const getAutoImageHeightRatio = (priority: StoryPriority) => {
  if (priority === "lead") {
    return 0.3;
  }

  if (priority === "major") {
    return 0.24;
  }

  if (priority === "secondary") {
    return 0.17;
  }

  return 0.1;
};

const getWordCount = (text: string) => text.split(/\s+/u).filter(Boolean).length;

const getTextDensity = ({
  bodyText,
  bodyHeight,
  columnCount,
}: Pick<EditorialImageQualityInput, "bodyText" | "bodyHeight" | "columnCount">) => {
  const editorialCapacityProxy = Math.max(1, (bodyHeight * Math.max(1, columnCount)) / 58);

  return clamp(getWordCount(bodyText) / editorialCapacityProxy, 0, 1);
};

const getNewspaperAlignment = (
  priority: StoryPriority,
  alignment: StoryImageSettings["imageAlignment"],
) => {
  if (alignment === "top") {
    return priority === "lead" || priority === "major" ? "top-right" : "top-left";
  }

  return alignment;
};

export const getBodyWhitespaceRatio = ({
  totalCapacity,
  visibleLineCount,
  remainingLineCount,
}: BodyWhitespaceInput) => {
  if (totalCapacity <= 0 || remainingLineCount > 0) {
    return 0;
  }

  return clamp((totalCapacity - visibleLineCount) / totalCapacity, 0, 1);
};

export const optimizeImageForEditorialQuality = ({
  priority,
  imageSettings,
  storyHeight,
  bodyHeight,
  columnCount,
  bodyText,
}: EditorialImageQualityInput): EditorialImageQualityResult => {
  if (!imageSettings.imageEnabled) {
    return {
      imageSettings,
      imageWhitespaceRisk: 0,
      adjusted: false,
      adjustments: [],
    };
  }

  const adjustments: string[] = [];
  const maxSpan = Math.max(1, Math.floor(columnCount));
  const boundedColumnSpan = clamp(Math.round(imageSettings.imageColumnSpan), 1, maxSpan);
  const storyBoundedMaxHeight = Math.max(1, Math.floor(storyHeight - STORY_SAFETY_MARGIN));
  const bodyBoundedMaxHeight = Math.max(1, Math.floor(bodyHeight - IMAGE_SAFETY_MARGIN));
  const hardMaxImageHeight = Math.min(storyBoundedMaxHeight, bodyBoundedMaxHeight);
  const protectedMaxImageHeight =
    imageSettings.imageWrapMode === "newspaper" && imageSettings.imageHeightProtection
      ? Math.max(1, Math.floor(storyHeight * NEWSPAPER_WRAP_MAX_HEIGHT_RATIO))
      : hardMaxImageHeight;
  const effectiveMaxImageHeight = Math.min(hardMaxImageHeight, protectedMaxImageHeight);
  const presetHeight = IMAGE_HEIGHT_PRESET_VALUES[imageSettings.imageHeightPreset];
  const requestedFixedHeight =
    imageSettings.imageHeightPreset === "custom" || presetHeight === null
      ? imageSettings.imageHeight
      : presetHeight;
  const textDensity = getTextDensity({
    bodyText,
    bodyHeight,
    columnCount,
  });
  const spanRatio = boundedColumnSpan / Math.max(1, maxSpan);
  const spanAdjustment = clamp(1 - Math.max(0, spanRatio - 0.5) * 0.22, 0.84, 1.08);
  const densityAdjustment = clamp(1 - textDensity * 0.18, 0.82, 1);
  const autoImageHeight = Math.round(
    storyHeight * getAutoImageHeightRatio(priority) * spanAdjustment * densityAdjustment,
  );
  const requestedImageHeight =
    imageSettings.imageHeightMode === "auto" ? autoImageHeight : requestedFixedHeight;
  const boundedImageHeight = clamp(Math.round(requestedImageHeight), 1, effectiveMaxImageHeight);

  if (!imageSettings.autoSizeImage) {
    if (boundedColumnSpan !== imageSettings.imageColumnSpan) {
      adjustments.push("image-span-bounded-to-story");
    }

    if (boundedImageHeight !== requestedImageHeight) {
      adjustments.push("image-height-bounded-to-story");
    }

    return {
      imageSettings: {
        ...imageSettings,
        imageColumnSpan: boundedColumnSpan,
        imageHeight: boundedImageHeight,
      },
      imageWhitespaceRisk: 0,
      adjusted: adjustments.length > 0,
      adjustments,
    };
  }

  const imageHeight = boundedImageHeight;
  const imageAlignment = getNewspaperAlignment(priority, imageSettings.imageAlignment);
  const imageWhitespaceRisk = clamp(
    requestedImageHeight / Math.max(1, bodyHeight) - getMaxImageHeightRatio(priority),
    0,
    1,
  );

  if (boundedColumnSpan !== imageSettings.imageColumnSpan) {
    adjustments.push("image-span-bounded-to-story");
  }

  if (imageHeight !== requestedImageHeight) {
    adjustments.push("image-height-rebalanced");
  }

  if (imageAlignment !== imageSettings.imageAlignment) {
    adjustments.push("image-alignment-newspaper-safe");
  }

  return {
    imageSettings: {
      ...imageSettings,
      imageAlignment,
      imageColumnSpan: boundedColumnSpan,
      imageHeight,
    },
    imageWhitespaceRisk,
    adjusted: adjustments.length > 0 || imageWhitespaceRisk > WHITESPACE_LIMIT,
    adjustments,
  };
};

export const EditorialLayoutQualityEngine = {
  getBodyWhitespaceRatio,
  optimizeImageForEditorialQuality,
};
