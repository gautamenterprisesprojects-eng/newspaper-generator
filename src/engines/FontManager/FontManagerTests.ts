import assert from "node:assert/strict";
import {
  getNewspaperFontStack,
  NEWSPAPER_FONT_DEFINITIONS,
  NEWSPAPER_FONT_FAMILIES,
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
  NEWSPAPER_FONT_DEFINITIONS.filter(
    (font) =>
      font.weight === 400 ||
      font.id === "cliff-noto-serif-devanagari-extra-condensed-medium",
  ).length,
  4,
  "PDF pipeline should receive one regular font per text role",
);

console.log("FontManager tests passed");
