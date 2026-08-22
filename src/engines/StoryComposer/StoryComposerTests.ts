import assert from "node:assert/strict";
import { composeStoryBody } from "./StoryComposerEngine";
import type { ArticleTextStyle } from "@/types/editor";
import type { HyphenationJustificationSettings } from "@/engines/HyphenationJustification/HyphenationJustificationTypes";

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
  lineHeight: 1.1,
  wrap: "none",
};

const hyphenationJustificationSettings: HyphenationJustificationSettings = {
  wordSpacingMin: 95,
  wordSpacingMax: 105,
  trackingMin: -2,
  trackingMax: 2,
  hyphenation: true,
  maximumConsecutiveHyphens: 2,
  minimumWordLength: 7,
  minimumBeforeHyphen: 3,
  minimumAfterHyphen: 3,
  optimizationLevel: "balanced",
};

const result = composeStoryBody({
  lines: [
    { text: "नगर निगम ने विशेष अभियान", width: 245, justify: true },
    { text: "शुरू किया है और टीम", width: 245, justify: true },
    { text: "लगातार सफाई कर रही है", width: 245, justify: true },
    { text: "लोगों से सहयोग मांगा", width: 245, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  totalCapacity: 5,
  visibleLineCount: 4,
  remainingLineCount: 0,
  lineHeight: 14,
  hyphenationJustificationSettings,
});

assert.equal(result.lines.length, 4);
assert.ok(result.diagnostics.storyCompositionIterations >= 1);
assert.ok(result.diagnostics.storyOptimizationPasses >= 1);
assert.ok(result.diagnostics.storyScore >= 0);
assert.ok(result.diagnostics.storyFillPercent === 80);
assert.ok(result.diagnostics.bottomWhitespace === 14);
assert.ok(result.diagnostics.bestCandidateScore === result.diagnostics.storyScore);
assert.ok(result.diagnostics.finalStoryQuality >= 0);

const overflowResult = composeStoryBody({
  lines: [{ text: "एक छोटी पंक्ति", width: 245, justify: false }],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  totalCapacity: 1,
  visibleLineCount: 1,
  remainingLineCount: 3,
  lineHeight: 14,
  hyphenationJustificationSettings,
});

assert.equal(overflowResult.diagnostics.bottomWhitespace, 0);
assert.ok(overflowResult.diagnostics.storyScore > 0);
assert.ok(overflowResult.diagnostics.finalStoryQuality < 100);

console.log("Story composer tests passed: 10");
