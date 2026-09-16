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
  namePlate: "#1C070A",
  accentBar: "#E30613",
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
  const photoHeight = Math.min(box.width * 1.18, box.height * 0.36);
  const namePlateHeight = Math.max(32, Math.min(box.width * 0.48, box.height * 0.12));
  const designationTop = box.y + photoHeight + namePlateHeight;
  const designationHeight = Math.max(1, box.y + box.height - designationTop);
  const accentWidth = Math.max(5, box.width * 0.09);
  const textLeft = box.x + accentWidth + Math.max(3, box.width * 0.05);
  const textWidth = Math.max(1, box.x + box.width - textLeft - Math.max(3, box.width * 0.04));
  const nameFontSize = fitFontSize(
    content.name,
    textWidth,
    Math.max(8, namePlateHeight * (content.place ? 0.36 : 0.42)),
    6,
    sans,
  );
  const placeFontSize = content.place
    ? fitFontSize(content.place, textWidth, Math.max(6, namePlateHeight * 0.26), 5, sans)
    : 0;
  const nameBlockHeight = content.place ? nameFontSize + placeFontSize + 3 : nameFontSize;
  const nameTop = box.y + photoHeight + Math.max(2, (namePlateHeight - nameBlockHeight) / 2);
  const designationFontSize = fitFontSize(
    content.designation,
    designationHeight * 0.92,
    Math.max(18, box.width * 0.78),
    12,
    sans,
  );

  return {
    box,
    photo: { x: box.x, y: box.y, width: box.width, height: photoHeight },
    namePlate: {
      x: box.x,
      y: box.y + photoHeight,
      width: box.width,
      height: namePlateHeight,
    },
    accent: {
      x: box.x,
      y: box.y + photoHeight,
      width: accentWidth,
      height: namePlateHeight,
    },
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
      y: nameTop + nameFontSize + (content.place ? 2 : 0),
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
