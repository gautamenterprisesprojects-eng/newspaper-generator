import assert from "node:assert/strict";
import {
  DEFAULT_BODY_JUSTIFY_ENGINE,
  applyHyphenationJustificationPreset,
  defaultUniversalTypographyControls,
  hyphenationJustificationPresets,
  normalizeUniversalTypographyControls,
} from "./UniversalTypographyEngine";

assert.equal(defaultUniversalTypographyControls.bodyAlignment, "justify");
assert.equal(defaultUniversalTypographyControls.justifyMode, "justify-except-last");
assert.equal(defaultUniversalTypographyControls.justifyEngineMode, "newspaper");
assert.equal(defaultUniversalTypographyControls.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE);
assert.equal(defaultUniversalTypographyControls.bodyJustifyEngineMode, "browser");
assert.equal(defaultUniversalTypographyControls.subheadlineJustifyEngineMode, "newspaper");
assert.equal(defaultUniversalTypographyControls.captionJustifyEngineMode, "newspaper");
assert.equal(defaultUniversalTypographyControls.hjPreset, "newspaper-hindi-body");
assert.equal(defaultUniversalTypographyControls.hjHyphenation, false);
assert.equal(defaultUniversalTypographyControls.hjTrackingMin, 0);
assert.equal(defaultUniversalTypographyControls.hjTrackingMax, 0);

const normalized = normalizeUniversalTypographyControls({
  bodyAlignment: "right",
  headlineAlignment: "justify" as never,
  justifyEngineMode: "browser",
  bodyJustifyEngineMode: "newspaper",
  wordSpacing: 50,
  headlineLetterSpacing: -10,
});

assert.equal(normalized.bodyAlignment, "right");
assert.equal(normalized.headlineAlignment, "left");
assert.equal(normalized.justifyEngineMode, "browser");
assert.equal(normalized.bodyJustifyEngineMode, "newspaper");
assert.equal(normalized.wordSpacing, 20);
assert.equal(normalized.headlineLetterSpacing, -2);

const explicitBrowser = normalizeUniversalTypographyControls({
  bodyJustifyEngineMode: "browser",
});

assert.equal(explicitBrowser.bodyJustifyEngineMode, "browser");

const missingLegacyBodyEngine = normalizeUniversalTypographyControls({
  justifyEngineMode: "newspaper",
});

assert.equal(missingLegacyBodyEngine.justifyEngineMode, "newspaper");
assert.equal(missingLegacyBodyEngine.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE);

const invalidLegacyBodyEngine = normalizeUniversalTypographyControls({
  bodyJustifyEngineMode: "print-composer" as never,
});

assert.equal(invalidLegacyBodyEngine.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE);

const invalidDisplayEngine = normalizeUniversalTypographyControls({
  justifyEngineMode: "print-composer" as never,
});

assert.equal(invalidDisplayEngine.justifyEngineMode, "newspaper");
assert.equal(invalidDisplayEngine.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE);

const englishPreset = applyHyphenationJustificationPreset(
  defaultUniversalTypographyControls,
  "newspaper-english-body",
);

assert.equal(englishPreset.hjPreset, "newspaper-english-body");
assert.equal(englishPreset.hjHyphenation, true);
assert.equal(englishPreset.hjTrackingMin, hyphenationJustificationPresets["newspaper-english-body"].hjTrackingMin);
assert.equal(englishPreset.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE);

const invalidPreset = normalizeUniversalTypographyControls({
  hjPreset: "tight-magazine" as never,
});

assert.equal(invalidPreset.hjPreset, "newspaper-hindi-body");

console.log("Universal typography tests passed: 28");
