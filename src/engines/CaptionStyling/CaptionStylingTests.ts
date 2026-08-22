import assert from "node:assert/strict";
import {
  applyCaptionPreset,
  captionPresets,
  createDefaultCaptionData,
  getCaptionPreset,
} from "./CaptionStylingEngine";

const caption = createDefaultCaptionData("चित्र: टेस्ट");
assert.equal(caption.enabled, true);
assert.equal(caption.labels.caption, "चित्र:");
assert.equal(getCaptionPreset("breaking-news").captionStyle.backgroundColor, "#b42318");
assert.equal(captionPresets.length, 6);

const magazine = applyCaptionPreset(caption, "magazine");
assert.equal(magazine.preset, "magazine");
assert.equal(magazine.labelStyle.backgroundColor, "#6a1b9a");

console.log("Caption styling tests passed: 6");
