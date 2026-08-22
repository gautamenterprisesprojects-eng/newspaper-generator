import { YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL } from "./YouthUpdateConfig";

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

/**
 * Paints Youth UPDATE's hardcoded editor photo + "EDITORIAL" banner onto a
 * 2D canvas -- the export-side twin of YouthUpdateEditorialRailImage.tsx.
 * The PDF export builds its own canvas rather than rasterising the Konva
 * layer tree, so this has to be drawn here as well, with the same
 * "contain" fit (full image, no top/bottom crop, letterboxed in the box's
 * own blue) or the sheet and the screen would crop differently.
 *
 * Async because the image has to decode before it can be drawn -- matches
 * drawAuthorBlockToCanvas's own pattern, which the export already awaits.
 */
export const drawYouthUpdateEditorialRailToCanvas = async (
  context: CanvasRenderingContext2D,
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
) => {
  context.fillStyle = "#1d5fa8";
  context.fillRect(x, y, width, height);

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = getPrintableImageSource(YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL);
  });

  if (!image) {
    return;
  }

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};
