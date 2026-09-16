import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  EDITOR_RAIL_FRONT_COLORS,
  editorRailFrontImageHasAlpha,
  getEditorRailFrontContainRect,
  getEditorRailFrontCoverCrop,
  getEditorRailFrontGeometry,
  type EditorRailFrontContent,
  type EditorRailFrontRect,
} from "./EditorRailFrontGeometry";

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

const fillPolygon = (context: CanvasRenderingContext2D, points: number[]) => {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
  context.closePath();
  context.fill();
};

/**
 * PDF-export twin of EditorRailFront.tsx. Both read getEditorRailFrontGeometry
 * so the screen and the sheet cannot drift.
 */
export const drawEditorRailFrontToCanvas = async (
  context: CanvasRenderingContext2D,
  box: EditorRailFrontRect,
  content: EditorRailFrontContent,
) => {
  const geometry = getEditorRailFrontGeometry(box, content);
  const sans = getNewspaperFontStack("sans");

  if (typeof document !== "undefined" && document.fonts?.load) {
    await document.fonts.load(`700 ${Math.ceil(geometry.designation.fontSize)}px ${sans}`).catch(() => undefined);
  }

  context.save();
  context.fillStyle = EDITOR_RAIL_FRONT_COLORS.background;
  context.fillRect(geometry.box.x, geometry.box.y, geometry.box.width, geometry.box.height);

  if (content.imageUrl) {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new window.Image();
      const source = getPrintableImageSource(content.imageUrl);
      if (/^https?:/i.test(source)) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = source;
    });
    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
      if (editorRailFrontImageHasAlpha(image)) {
        const contain = getEditorRailFrontContainRect(image.naturalWidth, image.naturalHeight, geometry.photo);
        context.drawImage(image, contain.x, contain.y, contain.width, contain.height);
      } else {
        const crop = getEditorRailFrontCoverCrop(
          image.naturalWidth,
          image.naturalHeight,
          geometry.photo.width,
          geometry.photo.height,
        );
        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          geometry.photo.x,
          geometry.photo.y,
          geometry.photo.width,
          geometry.photo.height,
        );
      }
    }
  }

  context.fillStyle = EDITOR_RAIL_FRONT_COLORS.namePlate;
  context.fillRect(
    geometry.namePlate.x,
    geometry.namePlate.y,
    geometry.namePlate.width,
    geometry.namePlate.height,
  );
  context.fillStyle = EDITOR_RAIL_FRONT_COLORS.accentBar;
  fillPolygon(context, geometry.accentPoints);
  context.strokeStyle = EDITOR_RAIL_FRONT_COLORS.plateStroke;
  context.lineWidth = geometry.plateStrokeWidth;
  context.strokeRect(
    geometry.namePlate.x + geometry.plateStrokeWidth / 2,
    geometry.namePlate.y + geometry.plateStrokeWidth / 2,
    geometry.namePlate.width - geometry.plateStrokeWidth,
    geometry.namePlate.height - geometry.plateStrokeWidth,
  );

  context.fillStyle = EDITOR_RAIL_FRONT_COLORS.type;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `700 ${geometry.name.fontSize}px ${sans}`;
  context.fillText(geometry.name.text, geometry.name.x, geometry.name.y, geometry.name.width);
  if (geometry.place.text) {
    context.font = `700 ${geometry.place.fontSize}px ${sans}`;
    context.fillText(geometry.place.text, geometry.place.x, geometry.place.y, geometry.place.width);
  }

  context.translate(
    geometry.designation.x + geometry.designation.width / 2,
    geometry.designation.y + geometry.designation.height / 2,
  );
  context.rotate(-Math.PI / 2);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${geometry.designation.fontSize}px ${sans}`;
  context.fillText(geometry.designation.text, 0, 0, geometry.designation.height);
  context.restore();
};
