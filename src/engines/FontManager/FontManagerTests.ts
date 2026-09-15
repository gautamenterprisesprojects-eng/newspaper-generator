import assert from "node:assert/strict";
import {
  getNewspaperFontStack,
  NEWSPAPER_FONT_DEFINITIONS,
  NEWSPAPER_FONT_FAMILIES,
  resolveNewspaperFontFamily,
} from "./FontManagerEngine";

assert.equal(getNewspaperFontStack("sans"), `${NEWSPAPER_FONT_FAMILIES.sans}, sans-serif`);
assert.equal(getNewspaperFontStack("serif"), `${NEWSPAPER_FONT_FAMILIES.serif}, serif`);
assert.equal(
  getNewspaperFontStack("bodySerifCondensed"),
  `${NEWSPAPER_FONT_FAMILIES.bodySerifCondensed}, ${NEWSPAPER_FONT_FAMILIES.serif}, serif`,
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some(
    (font) => font.role === "sans" && font.source.endsWith("NotoSansDevanagari-Regular.ttf"),
  ),
  "sans Devanagari regular font must be registered",
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some(
    (font) => font.role === "serif" && font.source.endsWith("NotoSerifDevanagari-Regular.ttf"),
  ),
  "serif Devanagari regular font must be registered",
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some(
    (font) =>
      font.role === "bodySerifCondensed" &&
      font.source.endsWith("NotoSerifDevanagari-ExtraCondensed.ttf") &&
      font.pdfRole === "bodySerifCondensed",
  ),
  "body ExtraCondensed Devanagari regular font must be registered",
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some(
    (font) =>
      font.role === "bodySerifCondensed" &&
      font.source.endsWith("NotoSerifDevanagari-ExtraCondensedMedium.ttf") &&
      font.weight === 550 &&
      font.pdfRole === "bodySerifCondensed",
  ),
  "body ExtraCondensed Devanagari 550 font must be registered",
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some(
    (font) =>
      font.role === "bodySerifCondensed" &&
      font.source.endsWith("NotoSerifDevanagari-ExtraCondensedSemiBold.ttf") &&
      font.weight === 600 &&
      font.pdfRole === "bodySerifCondensed",
  ),
  "body ExtraCondensed Devanagari semibold font must be registered",
);

assert.equal(
  resolveNewspaperFontFamily("Cliff Noto Devanagari"),
  getNewspaperFontStack("bodySerifCondensed"),
  "unknown umbrella family must become ExtraCondensed body",
);
assert.equal(
  resolveNewspaperFontFamily("Noto Serif Devanagari, Mangal, serif"),
  getNewspaperFontStack("serif"),
);
assert.equal(
  resolveNewspaperFontFamily("Rozha One, serif"),
  getNewspaperFontStack("headlineRozha"),
);
assert.equal(
  resolveNewspaperFontFamily("Ranga, Cliff Noto Serif Devanagari, serif"),
  getNewspaperFontStack("headlineRanga"),
);
assert.equal(
  resolveNewspaperFontFamily("Amita"),
  getNewspaperFontStack("headlineAmita"),
);
assert.equal(
  resolveNewspaperFontFamily("Kalam, serif"),
  getNewspaperFontStack("headlineKalam"),
);
assert.equal(
  resolveNewspaperFontFamily("Cliff Noto Sans Devanagari, sans-serif"),
  getNewspaperFontStack("sans"),
);
assert.equal(
  resolveNewspaperFontFamily('"Tinos", Georgia, "Times New Roman", serif'),
  '"Tinos", Georgia, "Times New Roman", serif',
);

assert(
  NEWSPAPER_FONT_DEFINITIONS.some((font) => font.id === "cliff-noto-serif-devanagari-bold"),
  "serif 700 must be registered so NMS headlines can fall back to Cliff Noto",
);
assert(
  NEWSPAPER_FONT_DEFINITIONS.some((font) => font.id === "cliff-noto-sans-devanagari-bold"),
  "sans 700 must be registered for kickers and datelines",
);

console.log("FontManager tests passed");
