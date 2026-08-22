export type CompositionSessionMetrics = {
  previewCount: number;
  previewFps: number;
  kernelTimeMs: number;
  compositionTimeMs: number;
  copyfitTimeMs: number;
  typographyTimeMs: number;
  commitTimeMs: number;
  totalSessionTimeMs: number;
  iterationCount: number;
  affectedStories: number;
  affectedColumns: number;
  whitespaceRemoved: number;
  overflowRemoved: number;
};

export const createEmptyCompositionMetrics = (): CompositionSessionMetrics => ({
  previewCount: 0,
  previewFps: 0,
  kernelTimeMs: 0,
  compositionTimeMs: 0,
  copyfitTimeMs: 0,
  typographyTimeMs: 0,
  commitTimeMs: 0,
  totalSessionTimeMs: 0,
  iterationCount: 0,
  affectedStories: 0,
  affectedColumns: 0,
  whitespaceRemoved: 0,
  overflowRemoved: 0,
});

/** Calculates a stable preview FPS estimate for a session window. */
export const calculatePreviewFps = ({
  previewCount,
  elapsedMs,
}: {
  previewCount: number;
  elapsedMs: number;
}) => {
  if (previewCount <= 1 || elapsedMs <= 0) {
    return 0;
  }

  return Math.round((previewCount / (elapsedMs / 1000)) * 10) / 10;
};

/** Adds timing and count deltas into immutable session metrics. */
export const mergeCompositionMetrics = (
  current: CompositionSessionMetrics,
  next: Partial<CompositionSessionMetrics>,
): CompositionSessionMetrics => ({
  ...current,
  ...next,
});
