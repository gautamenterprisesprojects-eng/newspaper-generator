export type RendererType = "composition" | "canvas" | "konva" | "pdf";

export type TypographyAdjustments = {
  trackingEm?: number;
  wordSpacingEm?: number;
  fontSize: number;
  renderer: RendererType;
};

export const bodyTypographySafety = {
  minTrackingEm: -0.01,
  minWordSpacingEm: 0, // Never permit word space compression or negative word spacing
  minFontScale: 0.98,
  minLineHeightScale: 0.97,
  allowHorizontalGlyphScale: false,
};

export const resolveTypographyAdjustments = ({
  trackingEm = 0,
  wordSpacingEm = 0,
  fontSize,
  renderer,
}: TypographyAdjustments) => {
  // Ensure we don't exceed safety limits
  const safeTrackingEm = Math.max(trackingEm, bodyTypographySafety.minTrackingEm);
  const safeWordSpacingEm = Math.max(wordSpacingEm, bodyTypographySafety.minWordSpacingEm);

  // Note: All engines currently expect spacing in pixels or explicit em units.
  // We return absolute pixel adjustments that can be safely applied across renderers.
  return {
    letterSpacingPx: safeTrackingEm * fontSize,
    wordSpacingPx: safeWordSpacingEm * fontSize,
    safeTrackingEm,
    safeWordSpacingEm,
  };
};

export const getCondensationCompensationRatio = (fontScale: number = 1, trackingEm: number = 0): number => {
  let absoluteNegativeTrackingRatio = 0;
  if (trackingEm < 0) {
    absoluteNegativeTrackingRatio = Math.min(0.25, Math.abs(trackingEm) * 10);
  }
  let fontScaleReduction = 0;
  if (fontScale < 1.0) {
    fontScaleReduction = Math.max(0.05, (1 - fontScale) * 2.5);
  }
  const condensationAmount = Math.max(0, fontScaleReduction, absoluteNegativeTrackingRatio);
  const boundedCompensation = Math.min(0.20, condensationAmount);
  return 1 + boundedCompensation;
};

export const validateReadableWordGap = (
  measuredWordGapPx: number,
  fontSize: number,
  naturalSpaceWidthPx: number,
  fontScale: number = 1,
  trackingEm: number = 0,
) => {
  const configuredMinimumSpaceRatio = 1.0; // Ensure 100% of natural space width is the absolute floor
  const compensation = getCondensationCompensationRatio(fontScale, trackingEm);
  const minimumVisibleWordGap = naturalSpaceWidthPx * configuredMinimumSpaceRatio * compensation;
  return measuredWordGapPx >= minimumVisibleWordGap;
};

