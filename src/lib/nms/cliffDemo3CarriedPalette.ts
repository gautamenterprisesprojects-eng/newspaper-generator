/**
 * cliffdemo3 NMS-only: validate/resolve an explicit Manual-run palette
 * carried on the NMS bundle. Does not change Manual wizard selection.
 */
import {
  NEWSWIRE_SUBHEADING_PRESETS,
  type NewswireSubheadingPreset,
  type NewswireSubheadingPresetId,
} from "@/lib/newswire";
import { isCliffDemo3PublisherIdentity } from "@/lib/nms/cliffDemo3Publisher";

export type CliffDemo3CarriedSubheadingStyle = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  backgroundOpacity: number;
};

export type CliffDemo3CarriedPalette = {
  paletteId: string;
  tintColor: string;
  inlineSubheadingColor: string;
  subheadingStyle: CliffDemo3CarriedSubheadingStyle;
  tintedStoryBackground?: boolean;
  inlineColumnSubheadings?: boolean;
  colouredHeadings?: boolean;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const isHex = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value.trim());

const isOpacity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

export const findNewswirePresetById = (
  paletteId: string,
): NewswireSubheadingPreset | null => {
  const id = String(paletteId || "").trim();
  if (!id || id === "custom") return null;
  return NEWSWIRE_SUBHEADING_PRESETS.find((p) => p.id === id) ?? null;
};

/**
 * Validate explicit Manual palette for cliffdemo3 NMS.
 * Throws on malformed input (no silent fallback).
 * Returns null when field absent.
 */
export const resolveCliffDemo3CarriedPalette = (
  pageMintTarget: string,
  raw: unknown,
): CliffDemo3CarriedPalette | null => {
  if (raw === undefined || raw === null) return null;
  if (!isCliffDemo3PublisherIdentity(pageMintTarget)) {
    throw new Error(
      "[cliffdemo3 carried palette] rejected: pageMint target is not cliffdemo3",
    );
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("[cliffdemo3 carried palette] rejected: payload must be an object");
  }
  const obj = raw as Record<string, unknown>;
  const paletteId = String(obj.paletteId ?? obj.palettePresetId ?? "").trim();
  if (!paletteId) {
    throw new Error("[cliffdemo3 carried palette] rejected: paletteId required");
  }
  const preset = findNewswirePresetById(paletteId);
  if (!preset) {
    throw new Error(
      `[cliffdemo3 carried palette] rejected: unknown paletteId "${paletteId}"`,
    );
  }

  const styleRaw = obj.subheadingStyle;
  if (!styleRaw || typeof styleRaw !== "object" || Array.isArray(styleRaw)) {
    throw new Error("[cliffdemo3 carried palette] rejected: subheadingStyle object required");
  }
  const style = styleRaw as Record<string, unknown>;
  const subheadingStyle: CliffDemo3CarriedSubheadingStyle = {
    backgroundColor: String(style.backgroundColor || "").trim(),
    textColor: String(style.textColor || "").trim(),
    borderColor: String(style.borderColor || "").trim(),
    backgroundOpacity: style.backgroundOpacity as number,
  };
  if (!isHex(subheadingStyle.backgroundColor)) {
    throw new Error("[cliffdemo3 carried palette] rejected: subheadingStyle.backgroundColor");
  }
  if (!isHex(subheadingStyle.textColor)) {
    throw new Error("[cliffdemo3 carried palette] rejected: subheadingStyle.textColor");
  }
  if (!isHex(subheadingStyle.borderColor)) {
    throw new Error("[cliffdemo3 carried palette] rejected: subheadingStyle.borderColor");
  }
  if (!isOpacity(subheadingStyle.backgroundOpacity)) {
    throw new Error("[cliffdemo3 carried palette] rejected: subheadingStyle.backgroundOpacity");
  }

  const tintColor = String(obj.tintColor || "").trim();
  const inlineSubheadingColor = String(obj.inlineSubheadingColor || "").trim();
  if (!isHex(tintColor)) {
    throw new Error("[cliffdemo3 carried palette] rejected: tintColor");
  }
  if (!isHex(inlineSubheadingColor)) {
    throw new Error("[cliffdemo3 carried palette] rejected: inlineSubheadingColor");
  }

  const out: CliffDemo3CarriedPalette = {
    paletteId: preset.id,
    tintColor,
    inlineSubheadingColor,
    subheadingStyle,
  };
  if (typeof obj.tintedStoryBackground === "boolean") {
    out.tintedStoryBackground = obj.tintedStoryBackground;
  }
  if (typeof obj.inlineColumnSubheadings === "boolean") {
    out.inlineColumnSubheadings = obj.inlineColumnSubheadings;
  }
  if (typeof obj.colouredHeadings === "boolean") {
    out.colouredHeadings = obj.colouredHeadings;
  }
  // Ensure preset id is a real NewswireSubheadingPresetId
  void (preset.id as NewswireSubheadingPresetId);
  return out;
};

export const resolveCliffDemo3CarriedPaletteFromPayload = (
  pageMintTarget: string,
  payload: {
    cliffdemo3ManualPalette?: unknown;
    manualBatchPalette?: unknown;
    pageMintRecipe?: { manualBatchPalette?: unknown; cliffdemo3ManualPalette?: unknown } | null;
    meta?: { cliffdemo3ManualPalette?: unknown; manualBatchPalette?: unknown } | null;
  },
): CliffDemo3CarriedPalette | null => {
  const candidates = [
    payload.cliffdemo3ManualPalette,
    payload.manualBatchPalette,
    payload.pageMintRecipe?.cliffdemo3ManualPalette,
    payload.pageMintRecipe?.manualBatchPalette,
    payload.meta?.cliffdemo3ManualPalette,
    payload.meta?.manualBatchPalette,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return resolveCliffDemo3CarriedPalette(pageMintTarget, candidate);
    }
  }
  return null;
};
