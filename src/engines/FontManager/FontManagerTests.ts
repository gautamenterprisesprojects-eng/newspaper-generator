import assert from "node:assert/strict";
import {
  getNewspaperFontStack,
  NEWSPAPER_FONT_DEFINITIONS,
  NEWSPAPER_FONT_FAMILIES,
} from "./FontManagerEngine";

assert.equal(getNewspaperFontStack("sans"), `${NEWSPAPER_FONT_FAMILIES.sans}, sans-serif`);
assert.equal(getNewspaperFontStack("serif"), `${NEWSPAPER_FONT_FAMILIES.serif}, serif`);

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

assert.equal(
  NEWSPAPER_FONT_DEFINITIONS.filter((font) => font.weight === 400).length,
  2,
  "PDF pipeline should receive one regular font per text role",
);

console.log("FontManager tests passed");

