import assert from "node:assert/strict";
import { composeNewspaperBodyLines } from "./NewspaperCompositionEngine";
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
  lineHeight: 1.1,
  wrap: "none",
};

const result = composeNewspaperBodyLines({
  lines: [
    { text: "नगर निगम ने विशेष अभियान", width: 245, justify: true },
    { text: "शुरू किया है और टीम", width: 245, justify: true },
    { text: "लगातार सफाई कर रही है", width: 245, justify: false },
  ],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
});

assert.equal(result.lines.length, 3);
assert.ok(result.lines[0].words.length > 0);
assert.ok(result.lines[0].words.every((word) => !word.text.includes(" ")));
assert.ok(result.diagnostics.maximumSpacing <= 6 * 1.75);
assert.equal(result.lines.at(-1)?.justified, false);
assert.ok(result.diagnostics.finalLineWidths.every((width) => width <= 245));
assert.ok(result.diagnostics.paragraphCandidatesTested > 1);
assert.ok(result.diagnostics.paragraphQuality >= 0);

const browserResult = composeNewspaperBodyLines({
  lines: [{ text: "नगर निगम ने अभियान", width: 245, justify: true }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "browser",
});

assert.ok(browserResult.diagnostics.maximumSpacing > result.diagnostics.maximumSpacing);

const assertNaturalWordGaps = (line: (typeof result.lines)[number], label: string) => {
  assert.equal(line.horizontalScale, 1, `${label}: horizontal scale stays at 1`);
  assert.ok(line.resolvedWordGap >= line.naturalSpaceWidth, `${label}: resolved gap is at least natural space`);

  for (let index = 0; index < line.words.length - 1; index += 1) {
    const current = line.words[index];
    const next = line.words[index + 1];
    const gap = next.x - (current.x + current.width);

    assert.ok(gap >= line.naturalSpaceWidth, `${label}: gap ${index + 1} is at least natural space`);
    assert.ok(next.x >= current.x + current.width, `${label}: adjacent words do not overlap`);
  }
};

const failingPhrases = [
  "लाइव मॉडल दिखाए",
  "एफआईआर वापस लेने का अनुरोध",
  "प्रधानमंत्री ने जवाब दिया",
  "शोधकर्ताओं को एक डायनासोर की पिछली",
  "सोमली जानकारी के अनुसार",
  "क्रिकेट की बारीकियों को जल्दी समझा",
  "क्रिकेट की बारीकियों को जल्दी समझा।",
];

for (const phrase of failingPhrases) {
  const phraseResult = composeNewspaperBodyLines({
    lines: [{ text: phrase, width: 1000, justify: true }],
    style,
    justifyMode: "justify-all-lines",
    engineMode: "newspaper",
  });
  const line = phraseResult.lines[0];

  assert.equal(line.words.length, phrase.split(/\s+/u).filter(Boolean).length, `${phrase}: word tokens stay separate`);
  assertNaturalWordGaps(line, phrase);
}

const tightTrackingPhrase = "क्रिकेट की बारीकियों को जल्दी समझा।";
const tightTrackingWords = tightTrackingPhrase.split(/\s+/u).filter(Boolean);
const tightTrackingNatural = composeNewspaperBodyLines({
  lines: [{ text: tightTrackingPhrase, width: 1000, justify: false }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "newspaper",
}).lines[0];
const tightTrackingWidth =
  tightTrackingNatural.naturalWidth +
  tightTrackingNatural.naturalSpaceWidth * 0.1 * Math.max(0, tightTrackingWords.length - 1);
const tightTrackingResult = composeNewspaperBodyLines({
  lines: [{ text: tightTrackingPhrase, width: tightTrackingWidth, justify: true }],
  style: {
    ...style,
    letterSpacing: -0.4,
  },
  justifyMode: "justify-all-lines",
  engineMode: "newspaper",
  maxExpansionRatio: 0.12,
});

assert.ok(
  tightTrackingResult.lines[0].resolvedWordGap >= tightTrackingResult.lines[0].naturalSpaceWidth * 1.1,
  "negative tracking raises the minimum resolved body word gap",
);
assertNaturalWordGaps(tightTrackingResult.lines[0], "negative tracking compensation");

const unsafeJustification = composeNewspaperBodyLines({
  lines: [{ text: "AAAA BBBB CCCC DDDD", width: 132, justify: true }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "newspaper",
});

assert.equal(unsafeJustification.lines[0].justified, false, "unsafe compressed justification is not accepted");
assert.equal(unsafeJustification.lines[0].rejected, true, "unsafe compressed justification is rejected");
assertNaturalWordGaps(unsafeJustification.lines[0], "unsafe justification fallback");

const looseFewWords = composeNewspaperBodyLines({
  lines: [{ text: "दो शब्द", width: 500, justify: true }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "newspaper",
});

assert.equal(looseFewWords.lines[0].justified, false, "few-word lines are left aligned instead of stretched");
assert.ok(looseFewWords.lines[0].renderedWidth < looseFewWords.lines[0].targetWidth, "few-word line keeps trailing space");

console.log("Newspaper composition tests passed");
