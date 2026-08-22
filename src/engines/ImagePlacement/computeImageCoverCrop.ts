/**
 * computeImageCoverCrop
 *
 * Shared pure utility that calculates the source-crop rectangle needed
 * to render an image proportionally inside a frame with "cover" behaviour.
 *
 * The image is scaled so the frame is completely filled, then centred
 * (or positioned at an explicit focal point), and the overflow is cropped.
 *
 * This utility must be consumed by:
 * - ArticleBox.tsx (Konva editor preview)
 * - EditorCanvas.tsx (offscreen canvas export)
 * - PrintPDFEngine.ts (PDF export)
 *
 * All three renderers must produce visually identical crops.
 */

export type ImageCoverCropInput = {
  /** Source image pixel width. */
  sourceWidth: number;
  /** Source image pixel height. */
  sourceHeight: number;
  /** Destination frame width (layout units). */
  frameWidth: number;
  /** Destination frame height (layout units). */
  frameHeight: number;
  /** Horizontal focal point 0‑1 (0.5 = centre). */
  focalPointX?: number;
  /** Vertical focal point 0‑1 (0.5 = centre). */
  focalPointY?: number;
};

export type ImageCoverCropResult = {
  /** X offset into the source image (pixels). */
  sourceX: number;
  /** Y offset into the source image (pixels). */
  sourceY: number;
  /** Width to sample from the source image (pixels). */
  sourceWidth: number;
  /** Height to sample from the source image (pixels). */
  sourceHeight: number;
  /** The proportional scale applied (source pixels → frame units). */
  scale: number;
};

/**
 * Compute a centre-crop (or focal-point-crop) rectangle that fills
 * `frameWidth × frameHeight` from a source of `sourceWidth × sourceHeight`.
 *
 * Behaviour:
 * 1. Scale proportionally so the frame is fully covered.
 * 2. Calculate which portion of the source is visible.
 * 3. Centre the crop (or bias toward the focal point).
 *
 * Returns source-pixel coordinates that can be passed directly to
 * `context.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` or
 * equivalent Konva / PDF crop parameters.
 */
export function computeImageCoverCrop(input: ImageCoverCropInput): ImageCoverCropResult {
  const { sourceWidth, sourceHeight, frameWidth, frameHeight } = input;
  const focalX = input.focalPointX ?? 0.5;
  const focalY = input.focalPointY ?? 0.5;

  // Guard against zero dimensions
  if (sourceWidth <= 0 || sourceHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: Math.max(1, sourceWidth),
      sourceHeight: Math.max(1, sourceHeight),
      scale: 1,
    };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = frameWidth / frameHeight;

  let cropWidth: number;
  let cropHeight: number;
  let scale: number;

  if (sourceRatio > frameRatio) {
    // Source is wider than the frame — crop horizontally
    cropHeight = sourceHeight;
    cropWidth = sourceHeight * frameRatio;
    scale = frameHeight / sourceHeight;
  } else {
    // Source is taller than the frame — crop vertically
    cropWidth = sourceWidth;
    cropHeight = sourceWidth / frameRatio;
    scale = frameWidth / sourceWidth;
  }

  // Clamp crop dimensions to source bounds
  cropWidth = Math.min(cropWidth, sourceWidth);
  cropHeight = Math.min(cropHeight, sourceHeight);

  // Position the crop using the focal point
  const maxOffsetX = Math.max(0, sourceWidth - cropWidth);
  const maxOffsetY = Math.max(0, sourceHeight - cropHeight);

  const sourceX = Math.round(clamp(focalX, 0, 1) * maxOffsetX);
  const sourceY = Math.round(clamp(focalY, 0, 1) * maxOffsetY);

  return {
    sourceX,
    sourceY,
    sourceWidth: Math.round(cropWidth),
    sourceHeight: Math.round(cropHeight),
    scale,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
