/**
 * Geometry for CliffFrontEditorRail8A's left furniture rail: editor photo,
 * name + place plate, then a vertical Hindi designation on a red ground.
 *
 * Front-page path only — do not import EditorialPageStyle here. Type uses the
 * same Hindi stacks as the rest of the news pages (Noto Sans / Noto Serif
 * Devanagari).
 */

import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

export const EDITOR_RAIL_FRONT_COLORS = {
  background: "#E30613",
  namePlate: "#4A1018",
  accentBar: "#E30613",
  plateStroke: "#FFFFFF",
  type: "#FFFFFF",
} as const;

export const EDITOR_RAIL_FRONT_DEFAULT_NAME = "संपादक";
export const EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION = "ब्यूरो चीफ";

export type EditorRailFrontRect = { x: number; y: number; width: number; height: number };

export type EditorRailFrontGeometry = {
  box: EditorRailFrontRect;
  photo: EditorRailFrontRect;
  namePlate: EditorRailFrontRect;
  accent: EditorRailFrontRect;
  accentPoints: number[];
  plateStrokeWidth: number;
  name: EditorRailFrontRect & { text: string; fontSize: number };
  place: EditorRailFrontRect & { text: string; fontSize: number };
  designation: EditorRailFrontRect & { text: string; fontSize: number };
};

export type EditorRailFrontContent = {
  imageUrl: string;
  name: string;
  place: string;
  designation: string;
};

const HAS_DEVANAGARI = /[\u0900-\u097F]/;

export const formatEditorRailFrontLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return HAS_DEVANAGARI.test(trimmed) ? trimmed : trimmed.toUpperCase();
};

export const resolveEditorRailFrontContent = ({
  name,
  imageUrl,
  place,
  designation,
}: {
  name?: string | null;
  imageUrl?: string | null;
  place?: string | null;
  designation?: string | null;
}): EditorRailFrontContent => ({
  imageUrl: (imageUrl ?? "").trim(),
  name: formatEditorRailFrontLabel(name ?? "") || EDITOR_RAIL_FRONT_DEFAULT_NAME,
  place: formatEditorRailFrontLabel(place ?? ""),
  designation: (designation ?? "").trim() || EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION,
});

export const editorRailFrontImageHasAlpha = (image: HTMLImageElement) => {
  if (typeof document === "undefined") return false;
  const sampleWidth = Math.max(1, Math.min(48, image.naturalWidth));
  const sampleHeight = Math.max(1, Math.min(48, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d");
  if (!context) return false;
  try {
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 250) return true;
    }
  } catch {
    return false;
  }
  return false;
};

export const getEditorRailFrontCoverCrop = (
  naturalWidth: number,
  naturalHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  const sourceRatio = naturalWidth / Math.max(1, naturalHeight);
  const targetRatio = targetWidth / Math.max(1, targetHeight);
  if (sourceRatio > targetRatio) {
    const cropWidth = naturalHeight * targetRatio;
    return {
      x: (naturalWidth - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height: naturalHeight,
    };
  }
  const cropHeight = naturalWidth / targetRatio;
  return {
    x: 0,
    y: 0,
    width: naturalWidth,
    height: cropHeight,
  };
};

/** Bottom-centred contain: a cut-out portrait sits on the red ground and on the name plate. */
export const getEditorRailFrontContainRect = (
  naturalWidth: number,
  naturalHeight: number,
  box: EditorRailFrontRect,
): EditorRailFrontRect => {
  const scale = Math.min(box.width / Math.max(1, naturalWidth), box.height / Math.max(1, naturalHeight));
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + box.height - height,
    width,
    height,
  };
};

const measureWidth = (text: string, font: string) => {
  if (typeof document === "undefined") {
    return text.length * 8;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 8;
  context.font = font;
  return context.measureText(text).width;
};

const fitFontSize = (text: string, maxWidth: number, maxSize: number, minSize: number, fontFamily: string) => {
  let size = maxSize;
  while (size > minSize && measureWidth(text, `700 ${size}px ${fontFamily}`) > maxWidth) {
    size -= 0.5;
  }
  return size;
};

export const getEditorRailFrontGeometry = (
  box: EditorRailFrontRect,
  content: EditorRailFrontContent,
): EditorRailFrontGeometry => {
  const sans = getNewspaperFontStack("sans");
  const namePlateHeight = Math.max(46, Math.min(box.width * 0.52, box.height * 0.2));
  const photoHeight = Math.max(48, Math.min(box.width * 1.12, box.height - namePlateHeight - box.height * 0.38));
  const designationTop = box.y + photoHeight + namePlateHeight;
  const designationHeight = Math.max(1, box.y + box.height - designationTop);
  const plateStrokeWidth = Math.max(1.15, box.width * 0.018);
  const accentWidth = Math.max(10, box.width * 0.16);
  const textLeft = box.x + accentWidth + Math.max(4, box.width * 0.06);
  const textWidth = Math.max(1, box.x + box.width - textLeft - Math.max(4, box.width * 0.05));
  const nameFontSize = fitFontSize(
    content.name,
    textWidth,
    Math.max(10, namePlateHeight * (content.place ? 0.34 : 0.42)),
    7,
    sans,
  );
  const placeFontSize = content.place
    ? fitFontSize(content.place, textWidth, Math.max(8, namePlateHeight * 0.28), 6, sans)
    : 0;
  const nameBlockHeight = content.place ? nameFontSize + placeFontSize + Math.max(2, namePlateHeight * 0.06) : nameFontSize;
  const nameTop = box.y + photoHeight + Math.max(3, (namePlateHeight - nameBlockHeight) / 2);
  const designationFontSize = fitFontSize(
    content.designation,
    designationHeight * 0.92,
    Math.max(18, box.width * 0.78),
    12,
    sans,
  );
  const plateY = box.y + photoHeight;
  const accentPoints = [
    box.x,
    plateY,
    box.x + accentWidth * 0.42,
    plateY,
    box.x + accentWidth,
    plateY + namePlateHeight,
    box.x,
    plateY + namePlateHeight,
  ];

  return {
    box,
    photo: { x: box.x, y: box.y, width: box.width, height: photoHeight },
    namePlate: {
      x: box.x,
      y: plateY,
      width: box.width,
      height: namePlateHeight,
    },
    accent: {
      x: box.x,
      y: plateY,
      width: accentWidth,
      height: namePlateHeight,
    },
    accentPoints,
    plateStrokeWidth,
    name: {
      x: textLeft,
      y: nameTop,
      width: textWidth,
      height: nameFontSize,
      text: content.name,
      fontSize: nameFontSize,
    },
    place: {
      x: textLeft,
      y: nameTop + nameFontSize + (content.place ? Math.max(2, namePlateHeight * 0.06) : 0),
      width: textWidth,
      height: placeFontSize,
      text: content.place,
      fontSize: placeFontSize,
    },
    designation: {
      x: box.x,
      y: designationTop,
      width: box.width,
      height: designationHeight,
      text: content.designation,
      fontSize: designationFontSize,
    },
  };
};
