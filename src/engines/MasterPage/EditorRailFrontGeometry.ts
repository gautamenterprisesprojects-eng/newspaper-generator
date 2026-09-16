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

/**
 * Page chrome for CliffFrontEditorRail8A's news boxes — a Hindi-paper brick
 * red, not the rail's own fire-engine fill. Kickers, lead ink and light tints
 * read as the same family as the rail without painting the whole sheet red.
 */
export const EDITOR_RAIL_FRONT_THEME = {
  accent: "#A32035",
  leadHeadline: "#5C1520",
  tint: "#C45A63",
  boxRule: "#8B3340",
} as const;

export const EDITOR_RAIL_FRONT_DEFAULT_NAME = "विकास तिवारी";
export const EDITOR_RAIL_FRONT_DEFAULT_PLACE = "जबलपुर";
export const EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION = "ब्यूरो चीफ";
export const EDITOR_RAIL_FRONT_DEFAULT_IMAGE_URL = "/editor-rail/vikash-tiwari.png";

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
  imageUrl: (imageUrl ?? "").trim() || EDITOR_RAIL_FRONT_DEFAULT_IMAGE_URL,
  name: formatEditorRailFrontLabel(name ?? "") || formatEditorRailFrontLabel(EDITOR_RAIL_FRONT_DEFAULT_NAME),
  place: formatEditorRailFrontLabel(place ?? "") || formatEditorRailFrontLabel(EDITOR_RAIL_FRONT_DEFAULT_PLACE),
  designation: (designation ?? "").trim() || EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION,
});

export const getEditorRailFrontOpaqueCrop = (image: HTMLImageElement) => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || typeof document === "undefined") {
    return { x: 0, y: 0, width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return { x: 0, y: 0, width, height };
  try {
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] < 24) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX <= minX || maxY <= minY) {
      return { x: 0, y: 0, width, height };
    }
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  } catch {
    return { x: 0, y: 0, width, height };
  }
};

export type EditorRailFrontPhotoDraw = {
  crop: EditorRailFrontRect;
  dest: EditorRailFrontRect;
};

/** Fill the rail photo band with the cut-out bust, sitting on the name plate. */
export const getEditorRailFrontPhotoDraw = (
  image: HTMLImageElement,
  photo: EditorRailFrontRect,
): EditorRailFrontPhotoDraw => {
  const crop = getEditorRailFrontOpaqueCrop(image);
  const scale = photo.width / Math.max(1, crop.width);
  const fittedHeight = crop.height * scale;
  if (fittedHeight >= photo.height) {
    const sourceHeight = photo.height / scale;
    return {
      crop: { x: crop.x, y: crop.y, width: crop.width, height: sourceHeight },
      dest: { ...photo },
    };
  }
  return {
    crop,
    dest: {
      x: photo.x,
      y: photo.y + photo.height - fittedHeight,
      width: photo.width,
      height: fittedHeight,
    },
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
  const namePlateHeight = Math.max(32, Math.min(box.width * 0.36, box.height * 0.14));
  const photoHeight = Math.max(48, Math.min(box.width * 1.12, box.height - namePlateHeight - box.height * 0.38));
  const designationTop = box.y + photoHeight + namePlateHeight;
  const designationHeight = Math.max(1, box.y + box.height - designationTop);
  const plateStrokeWidth = Math.max(0.9, box.width * 0.014);
  const accentWidth = Math.max(8, box.width * 0.14);
  const textLeft = box.x + accentWidth + Math.max(3, box.width * 0.05);
  const textWidth = Math.max(1, box.x + box.width - textLeft - Math.max(3, box.width * 0.04));
  const nameFontSize = fitFontSize(
    content.name,
    textWidth,
    Math.max(7.5, namePlateHeight * (content.place ? 0.32 : 0.4)),
    6,
    sans,
  );
  const placeFontSize = content.place
    ? fitFontSize(content.place, textWidth, Math.max(6, namePlateHeight * 0.24), 5.5, sans)
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
