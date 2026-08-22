import { YOUTH_UPDATE_SHORT_NEWS_IMAGE_URL } from "./YouthUpdateConfig";

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

/**
 * Paints Youth UPDATE's "SHORT NEWS" section banner onto a 2D canvas -- the
 * export-side twin of YouthUpdateShortNewsBanner.tsx. The PDF export builds
 * its own canvas rather than rasterising the Konva layer tree, so this has
 * to be drawn here as well, at the same x/y/width/height (already sized to
 * the banner's own aspect ratio by the caller, so no crop is needed).
 *
 * Async because the image has to decode before it can be drawn -- matches
 * drawYouthUpdateEditorialRailToCanvas's own pattern, which the export
 * already awaits.
 */
export const drawYouthUpdateShortNewsBannerToCanvas = async (
  context: CanvasRenderingContext2D,
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
) => {
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = getPrintableImageSource(YOUTH_UPDATE_SHORT_NEWS_IMAGE_URL);
  });

  if (!image) return;

  context.drawImage(image, x, y, width, height);
};
