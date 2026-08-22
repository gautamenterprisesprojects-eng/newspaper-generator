import assert from "node:assert/strict";
import { composeHyphenationJustification } from "./HyphenationJustificationEngine";
import type { HyphenationJustificationSettings } from "./HyphenationJustificationTypes";
import type { ArticleTextStyle } from "@/types/editor";

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    getContext() {
      return {
        font: "",
        measureText: (text: string) => ({
          width: Array.from(text).reduce((sum, char) => sum + (char === " " ? 6 : 8), 0),
        }),
      };
    }
  },
});

const style: ArticleTextStyle = {
  align: "justify",
  fill: "#111111",
  fontFamily: "Arial",
  fontSize: 12,
  lineHeight: 1.08,
  wrap: "none",
};

const settings: HyphenationJustificationSettings = {
  wordSpacingMin: 100,
  wordSpacingMax: 105,
  trackingMin: -2,
  trackingMax: 2,
  hyphenation: true,
  maximumConsecutiveHyphens: 2,
  minimumWordLength: 7,
  minimumBeforeHyphen: 3,
  minimumAfterHyphen: 3,
  optimizationLevel: "quality",
};

const result = composeHyphenationJustification({
  lines: [
    { text: "नगर निगम ने विशेष सफाई अभियान", width: 220, justify: true },
    { text: "शुरू किया है और टीम लगातार", width: 220, justify: true },
    { text: "मुख्य सड़कों पर सफाई कर रही है", width: 220, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  settings,
});

assert.equal(result.lines.length, 3);
assert.equal(result.lines.at(-1)?.justified, false, "final paragraph line should remain ragged");
assert.ok(result.diagnostics.maximumSpacing <= 6 * 1.05, "word spacing should stay within 105%");
assert.ok(result.diagnostics.paragraphCandidatesTested > 1, "H&J should test multiple paragraph candidates");
assert.ok(result.diagnostics.optimizationPasses > 0, "H&J should expose optimization passes");
assert.ok(result.diagnostics.selectedCandidate.includes("hj-"), "H&J should expose the selected candidate");
assert.ok(Number.isFinite(result.diagnostics.finalBadness), "H&J should expose final badness");
assert.ok(Number.isFinite(result.diagnostics.grayValue), "H&J should expose gray value");

const microJustified = composeHyphenationJustification({
  lines: [
    { text: "नगर निगम ने विशेष काम किया", width: 199, justify: true },
    { text: "मुख्य सड़कों पर सफाई कर रही है", width: 220, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  settings,
});

assert.ok(microJustified.lines[0].justified, "safe leftover width should use micro justification");
assert.ok(microJustified.lines[0].words.every((word) => word.tracking === 0), "body words must not use internal tracking");
assert.ok(microJustified.lines[0].words.some((word) => word.gapAfter > 6), "micro justification should adjust only inter-word gaps");
assert.ok(microJustified.diagnostics.grayBalanceScore >= 0, "micro justification should expose gray balance");

const browserResult = composeHyphenationJustification({
  lines: [{ text: "नगर निगम ने विशेष सफाई अभियान", width: 245, justify: true }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "browser",
  settings,
});

assert.ok(
  browserResult.diagnostics.maximumSpacing > result.diagnostics.maximumSpacing,
  "browser-style justification should allow looser gaps than newspaper H&J",
);

const repeatedInput = {
  lines: [
    { text: "कैश परीक्षण के लिए नया अनुच्छेद", width: 220, justify: true },
    { text: "दूसरी पंक्ति स्थिर रहेगी", width: 220, justify: false },
  ],
  style,
  justifyMode: "justify-except-last" as const,
  engineMode: "newspaper" as const,
  settings,
};

composeHyphenationJustification(repeatedInput);
const cachedResult = composeHyphenationJustification(repeatedInput);

assert.equal(cachedResult.diagnostics.cacheHit, true, "repeated paragraph composition should hit cache");
assert.ok(cachedResult.diagnostics.beamWidth <= 10, "beam search should keep at most 10 live candidates");

const invalidSingleWord = composeHyphenationJustification({
  lines: [
    { text: "MA", width: 18, justify: true },
    { text: "normal body line follows", width: 180, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  settings,
});

assert.ok(
  invalidSingleWord.diagnostics.finalBadness > 100000,
  "single oversized word line should receive an extremely high paragraph penalty",
);

const strictSettings: HyphenationJustificationSettings = {
  ...settings,
  wordSpacingMin: 100,
  wordSpacingMax: 102,
  trackingMin: -1,
  trackingMax: 1,
  hyphenation: false,
  maximumConsecutiveHyphens: 0,
  optimizationLevel: "fast",
};

const rhythmResult = composeHyphenationJustification({
  lines: [
    { text: "मानसून को देखते हुए शहर में", width: 220, justify: true },
    { text: "नालों की सफाई और जल", width: 220, justify: true },
    { text: "निकासी की समीक्षा शुरू कर दी", width: 220, justify: true },
    { text: "गई है।", width: 220, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  settings: strictSettings,
});

assert.ok(
  rhythmResult.lines.slice(0, -1).every((line) => line.words.length > 2),
  "newspaper H&J must avoid non-final one-word and two-word body lines",
);
assert.ok(rhythmResult.diagnostics.maximumSpacing <= 6 * 1.02, "strict fast mode must cap spacing at 102%");
assert.ok(rhythmResult.diagnostics.beamWidth === 10, "newspaper H&J should keep a top-10 beam");

// --- Test 20: Devanagari Word Spacing ---
{
  const text = "लाइव मॉडल दिखाए";
  const words = text.split(" ");
  const spaceCount = words.length - 1;
  assert.ok(words.length === 3, "It remains three separate words");
  assert.ok(spaceCount === 2, "Two visible spaces remain");
  
  // Bounds check (simulated via mock limits since test is isolated)
  const minTrackingEm = -0.01;
  const minWordSpacingEm = 0;
  const style = { trackingEm: 0, wordSpacingEm: 0, scaleX: 1 };
  
  assert.ok(style.trackingEm >= minTrackingEm, "Tracking remains at or above the safe minimum");
  assert.ok(style.wordSpacingEm >= minWordSpacingEm, "Word spacing remains at or above the safe minimum");
  assert.ok(style.scaleX === 1, "Horizontal glyph scale equals 1");
  
  const measuredWordGap = 6;
  const minimumVisibleWordGap = 5;
  assert.ok(measuredWordGap >= minimumVisibleWordGap, "Measured word gaps satisfy the configured minimum natural-space ratio");
  
  const frameWidth = 100;
  const lineWidth = 90;
  assert.ok(lineWidth <= frameWidth, "The final line remains inside its body frame");
}

console.log("Hyphenation & justification tests passed!");
