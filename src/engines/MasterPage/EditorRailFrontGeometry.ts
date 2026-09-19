/**
 * Geometry for CliffFrontEditorRail8A's left furniture rail: the Cliff
 * Sandesh artwork template (contain-fit) plus four live overlays — photo,
 * name, place, designation — on fixed slots of that artwork.
 *
 * Front-page path only — do not import EditorialPageStyle here. Type uses the
 * same Hindi stacks as the rest of the news pages (Noto Sans / Noto Serif
 * Devanagari).
 */

import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

export const EDITOR_RAIL_FRONT_COLORS = {
  background: "#FFFFFF",
  namePlate: "#940308",
  accentBar: "#E30613",
  plateStroke: "#FFFFFF",
  type: "#FFFFFF",
  placeType: "#1A1A1A",
  designationType: "#7A1218",
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

export const EDITOR_RAIL_FRONT_DEFAULT_NAME = "राज बड़खाने";
export const EDITOR_RAIL_FRONT_DEFAULT_PLACE = "जबलपुर";
export const EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION = "ब्यूरो चीफ";
// Served under /api so the launch-token nginx gate cannot 403 Konva Image().
export const EDITOR_RAIL_FRONT_DEFAULT_IMAGE_URL = "/api/editor-rail/portrait?v=2";
export const EDITOR_RAIL_FRONT_ARTWORK_URL = "/api/editor-rail/artwork?v=2";
// "sub editor rail.svg" viewBox is 144x360 (a 2in x 5in card at its own
// 72pt/in). Row 1 of CliffFrontEditorRail8A is sized (see TemplateRegistry)
// so box 1's own aspect ratio matches this exactly -- keep the two in step.
export const EDITOR_RAIL_FRONT_ARTWORK_SIZE = { width: 144, height: 360 } as const;

/**
 * Overlay slots as fractions of the contain-fitted 341×1024 artwork dest.
 * Photo sits on the name plate; क्लिफ संदेश / slogans / nib stay baked.
 */
export const EDITOR_RAIL_FRONT_ARTWORK_SLOTS = {
  photo: { x: 0.14, y: 0.01, width: 0.72, height: 0.238 },
  name: { x: 0.08, y: 0.249, width: 0.84, height: 0.030 },
  place: { x: 0.27, y: 0.278, width: 0.50, height: 0.026 },
  designation: { x: 0.18, y: 0.306, width: 0.64, height: 0.02 },
} as const;

export type EditorRailFrontRect = { x: number; y: number; width: number; height: number };

export type EditorRailFrontGeometry = {
  box: EditorRailFrontRect;
  artwork: EditorRailFrontRect;
  photo: EditorRailFrontRect;
  nameCover: EditorRailFrontRect;
  placeCover: EditorRailFrontRect;
  name: EditorRailFrontRect & { text: string; fontSize: number };
  place: EditorRailFrontRect & { text: string; fontSize: number };
  designation: EditorRailFrontRect & { text: string; fontSize: number };
};

export type EditorRailFrontContent = {
  imageUrl: string;
  name: string;
  place: string;
  designation: string;
  overlayPhoto: boolean;
  overlayName: boolean;
  overlayPlace: boolean;
  overlayDesignation: boolean;
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
}): EditorRailFrontContent => {
  const liveName = formatEditorRailFrontLabel(name ?? "");
  const livePlace = formatEditorRailFrontLabel(place ?? "");
  const liveImage = (imageUrl ?? "").trim();
  const liveDesignation = (designation ?? "").trim();
  return {
    // Only a real live photo swaps the portrait -- when none is supplied,
    // imageUrl stays empty and the substitution step leaves the artwork's
    // own baked-in default photo alone (see substituteEditorRailFrontSvg),
    // rather than forcing in some other default image of unknown crop/pose.
    imageUrl: liveImage,
    name: liveName || formatEditorRailFrontLabel(EDITOR_RAIL_FRONT_DEFAULT_NAME),
    place: livePlace || formatEditorRailFrontLabel(EDITOR_RAIL_FRONT_DEFAULT_PLACE),
    designation: liveDesignation || EDITOR_RAIL_FRONT_DEFAULT_DESIGNATION,
    overlayPhoto: Boolean(liveImage),
    overlayName: true,
    // Place/designation always resolve to a real string above (live value or
    // the default), so they should always be substituted in -- gating these
    // on the *pre-fallback* live value (as before) meant the computed
    // default was silently never written, leaving whatever text happened to
    // already be baked into the artwork file at the time of the last deploy.
    overlayPlace: true,
    overlayDesignation: true,
  };
};

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

export const getEditorRailFrontContainDest = (
  box: EditorRailFrontRect,
  imageWidth = EDITOR_RAIL_FRONT_ARTWORK_SIZE.width,
  imageHeight = EDITOR_RAIL_FRONT_ARTWORK_SIZE.height,
): EditorRailFrontRect => {
  const scale = Math.min(box.width / Math.max(1, imageWidth), box.height / Math.max(1, imageHeight));
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
};

const slotRect = (
  dest: EditorRailFrontRect,
  slot: { x: number; y: number; width: number; height: number },
): EditorRailFrontRect => ({
  x: dest.x + dest.width * slot.x,
  y: dest.y + dest.height * slot.y,
  width: dest.width * slot.width,
  height: dest.height * slot.height,
});

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
  if (!text) return 0;
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
  const artwork = getEditorRailFrontContainDest(box);
  const photo = slotRect(artwork, EDITOR_RAIL_FRONT_ARTWORK_SLOTS.photo);
  const nameCover = slotRect(artwork, EDITOR_RAIL_FRONT_ARTWORK_SLOTS.name);
  const placeCover = slotRect(artwork, EDITOR_RAIL_FRONT_ARTWORK_SLOTS.place);
  const designationSlot = slotRect(artwork, EDITOR_RAIL_FRONT_ARTWORK_SLOTS.designation);
  const namePad = Math.max(2, nameCover.width * 0.04);
  const placePad = Math.max(2, placeCover.width * 0.06);
  const nameFontSize = fitFontSize(
    content.name,
    Math.max(1, nameCover.width - namePad * 2),
    Math.max(7, nameCover.height * 0.72),
    6,
    sans,
  );
  const placeFontSize = content.place
    ? fitFontSize(
        content.place,
        Math.max(1, placeCover.width - placePad * 2),
        Math.max(6, placeCover.height * 0.7),
        5.5,
        sans,
      )
    : 0;
  const designationFontSize = content.designation
    ? fitFontSize(
        content.designation,
        Math.max(1, designationSlot.width * 0.92),
        Math.max(6, designationSlot.height * 0.78),
        5,
        sans,
      )
    : 0;

  return {
    box,
    artwork,
    photo,
    nameCover,
    placeCover,
    name: {
      ...nameCover,
      text: content.name,
      fontSize: nameFontSize,
    },
    place: {
      ...placeCover,
      text: content.place,
      fontSize: placeFontSize,
    },
    designation: {
      ...designationSlot,
      text: content.designation,
      fontSize: designationFontSize,
    },
  };
};

/**
 * Live substitution for "sub editor rail.svg" (served at
 * EDITOR_RAIL_FRONT_ARTWORK_URL) -- the same pattern as the front/inside
 * header SVGs (see HeaderSvgTemplate.ts): the artwork's own <text> nodes and
 * portrait <image> carry the live values directly, instead of a flattened
 * PNG with canvas-drawn overlays that can drift from the artwork's own font/
 * position. Targeted by the artwork's own stable <g id="..."> wrapper IDs
 * (kept by the exporter regardless of the text content inside), not by
 * whatever placeholder name/place/designation the file currently holds.
 */
const escapeXmlText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const replaceGroupText = (svgText: string, groupId: string, value: string): string => {
  const pattern = new RegExp(`(<g id="${groupId}">\\s*<text[^>]*>)[\\s\\S]*?(</text>)`);
  return svgText.replace(pattern, (_match, open: string, close: string) => `${open}${escapeXmlText(value)}${close}`);
};

/** dataUrl must be a full "data:<mime>;base64,<payload>" string -- the whole URI is swapped in, not just the payload, so a non-PNG replacement photo keeps its correct declared mime type. */
const replacePortraitImage = (svgText: string, dataUrl: string): string =>
  svgText.replace(
    /id="image_xA0_Image" xlink:href="data:image\/[a-zA-Z0-9+.-]+;base64,[^"]+"/,
    `id="image_xA0_Image" xlink:href="${dataUrl}"`,
  );

/** Applies name/place/designation text and (optionally) a new portrait into the raw artwork SVG. */
export const substituteEditorRailFrontSvg = (
  svgText: string,
  content: { name: string; place: string; designation: string; photoDataUrl?: string },
): string => {
  let next = svgText;
  if (content.name) next = replaceGroupText(next, "विकास_तिवारी", content.name);
  if (content.place) next = replaceGroupText(next, "जबलपुर", content.place);
  if (content.designation) next = replaceGroupText(next, "ब्यूरो_चीफ", content.designation);
  if (content.photoDataUrl) next = replacePortraitImage(next, content.photoDataUrl);
  return next;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof window === "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
};

const rawEditorRailSvgCache = new Map<string, Promise<string>>();

/** Fetches (and caches) the raw artwork SVG's text -- the un-substituted template. */
export const fetchRawEditorRailFrontSvg = (url: string): Promise<string> => {
  const cached = rawEditorRailSvgCache.get(url);
  if (cached) return cached;
  const request = fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch editor rail artwork: ${url} (${response.status})`);
    }
    return response.text();
  });
  rawEditorRailSvgCache.set(url, request);
  return request;
};

/**
 * Fetches the raw artwork, substitutes the live values in, and returns a
 * data: URL ready to hand to an <img>/Konva Image/canvas drawImage -- the
 * one thing both the browser preview (EditorRailFront.tsx) and the PDF
 * export path (drawEditorRailFrontToCanvas) need, kept in one place so they
 * cannot drift from each other.
 */
export const resolveEditorRailFrontSvgSource = async (
  artworkUrl: string,
  content: { name: string; place: string; designation: string; photoDataUrl?: string },
): Promise<string> => {
  const raw = await fetchRawEditorRailFrontSvg(artworkUrl);
  const substituted = substituteEditorRailFrontSvg(raw, content);
  const bytes = new TextEncoder().encode(substituted);
  return `data:image/svg+xml;base64,${bytesToBase64(bytes)}`;
};
