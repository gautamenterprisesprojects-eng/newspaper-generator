import assert from "node:assert/strict";
import {
  editorialStylePresets,
  getEditorialStylePreset,
  getFactBoxTheme,
  getPullQuoteTheme,
  newsroomColorPalette,
} from "./EditorialStylingEngine";

assert.ok(newsroomColorPalette.length >= 14);
assert.equal(getFactBoxTheme("red").headerColor, "#9f1d17");
assert.equal(getPullQuoteTheme("breaking").textColor, "#ffffff");
assert.equal(getEditorialStylePreset("breaking-news").subheadlineBanner.mode, "banner");
assert.equal(getEditorialStylePreset("none").name, "none");
assert.ok(editorialStylePresets.some((preset) => preset.name === "sports"));

console.log("Editorial styling tests passed: 6");
