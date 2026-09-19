import {
  EDITOR_RAIL_FRONT_ARTWORK_URL,
  EDITOR_RAIL_FRONT_COLORS,
  getEditorRailFrontContainDest,
  resolveEditorRailFrontSvgSource,
  type EditorRailFrontContent,
  type EditorRailFrontRect,
} from "./EditorRailFrontGeometry";

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

const loadImage = (source: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    const printable = getPrintableImageSource(source);
    if (/^https?:/i.test(printable)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = printable;
  });

const imageToDataUrl = async (source: string): Promise<string | undefined> => {
  const image = await loadImage(source);
  if (!image || image.naturalWidth <= 0) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(image, 0, 0);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
};

/**
 * PDF-export twin of EditorRailFront.tsx. Both resolve the same live-
 * substituted SVG via resolveEditorRailFrontSvgSource, so the screen and the
 * sheet cannot drift -- the artwork's own name/place/designation <text> and
 * portrait <image> carry the live values, drawn as one contain-fitted image
 * rather than a flattened background plus separate canvas-drawn overlays.
 */
export const drawEditorRailFrontToCanvas = async (
  context: CanvasRenderingContext2D,
  box: EditorRailFrontRect,
  content: EditorRailFrontContent,
) => {
  context.save();
  context.fillStyle = EDITOR_RAIL_FRONT_COLORS.background;
  context.fillRect(box.x, box.y, box.width, box.height);

  const photoDataUrl = content.overlayPhoto && content.imageUrl
    ? await imageToDataUrl(content.imageUrl)
    : undefined;

  try {
    const svgSource = await resolveEditorRailFrontSvgSource(EDITOR_RAIL_FRONT_ARTWORK_URL, {
      name: content.name,
      place: content.overlayPlace ? content.place : "",
      designation: content.overlayDesignation ? content.designation : "",
      photoDataUrl,
    });
    const artworkImage = await loadImage(svgSource);
    if (artworkImage && artworkImage.naturalWidth > 0) {
      const dest = getEditorRailFrontContainDest(box);
      context.drawImage(artworkImage, dest.x, dest.y, dest.width, dest.height);
    }
  } catch {
    // No artwork this render -- leave the background fill rather than a
    // broken/partial draw.
  }

  context.restore();
};
