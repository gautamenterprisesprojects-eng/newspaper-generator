import assert from "node:assert/strict";
import {
  justifyNewspaperLine,
  recomposeLinesForNewspaperJustification,
} from "./NewspaperJustificationEngine";
import { composeNewspaperBodyLines } from "@/engines/NewspaperComposition/NewspaperCompositionEngine";
import type { ArticleTextStyle } from "@/types/editor";

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    getContext() {
      return {
        font: "",
        measureText: (text: string) => ({
          width: Array.from(text).reduce((sum, char) => sum + (char === " " ? 4 : 8), 0),
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

const browserLine = justifyNewspaperLine({
  text: "नगर निगम ने अभियान शुरू किया",
  targetWidth: 420,
  style,
  justify: true,
  engineMode: "browser",
});

const newspaperLine = justifyNewspaperLine({
  text: "नगर निगम ने अभियान शुरू किया",
  targetWidth: 420,
  style,
  justify: true,
  engineMode: "newspaper",
});

assert.equal(browserLine.expanded, false);
assert.equal(browserLine.rejected, false);
assert.equal(browserLine.reason, "browser native justification");
assert.equal(newspaperLine.expanded, false);
assert.equal(newspaperLine.rejected, true);
assert.ok(newspaperLine.expansionRatio > 0.75);

const compactNewspaperLine = justifyNewspaperLine({
  text: "नगर निगम ने विशेष अभियान शुरू किया है",
  targetWidth: 250,
  style,
  justify: true,
  engineMode: "newspaper",
});

assert.ok(compactNewspaperLine.expansionRatio <= 0.75 || compactNewspaperLine.rejected);
assert.equal(compactNewspaperLine.text.includes("नग"), true);

const recomposed = recomposeLinesForNewspaperJustification({
  wrappedLines: ["प्रदेश में मानसून की दस्तक", "शहरों में जलभराव की तैयारी तेज"],
  targetWidth: 270,
  style,
});

assert.ok(recomposed[0].split(" ").length >= 5);
assert.equal(recomposed.join(" ").includes("जलभराव"), true);

// Test exemption for scientific names and low word counts
const scientificNameLine = justifyNewspaperLine({
  text: "Musango matusadonaensis species",
  targetWidth: 500,
  style,
  justify: true,
  engineMode: "newspaper",
});
assert.equal(scientificNameLine.expanded, false, "Scientific names should not be stretched across wide columns");

const shortLine = justifyNewspaperLine({
  text: "दो शब्द",
  targetWidth: 300,
  style,
  justify: true,
  engineMode: "newspaper",
});
assert.equal(shortLine.expanded, false, "Lines with 2 words or fewer should remain naturally aligned");

// Test specific phrase for Hindi body word spacing preservation
const testPhrase = "क्रिकेट की बारीकियों को जल्दी समझा।";
const testPhraseWords = testPhrase.split(" ").filter(Boolean);
const phraseComposition = composeNewspaperBodyLines({
  lines: [{ text: testPhrase, width: 280, justify: true }],
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
});

const firstLine = phraseComposition.lines[0];
assert.equal(testPhraseWords.length, 6, "It remains separate words (words.length === 6)");
assert.equal(firstLine.words.length, 6, "Composed words contain 6 distinct word objects");
assert.equal(firstLine.words.length - 1, 5, "Visible spaces remain between words (spaces === 5)");
assert.ok(firstLine.resolvedWordGap >= firstLine.naturalSpaceWidth * 1.0, "Measured word gap meets or exceeds naturalSpaceWidth * 1.0");
assert.ok(firstLine.tracking >= -0.01, "Tracking stays within the safe minimum (>= -0.01em)");
assert.equal(firstLine.horizontalScale, 1, "Horizontal scale equals 1.0");
assert.ok(firstLine.renderedWidth <= firstLine.targetWidth, "The line does not overflow the column width");

// Test English newspaper body line justification with numbers, acronyms, and 3 words
const englishText = "CWG 2026 Day 11 Judoka";
const baseWidth = justifyNewspaperLine({ text: englishText, targetWidth: 10, style, justify: false }).naturalWidth;
const englishNumberLine = justifyNewspaperLine({
  text: englishText,
  targetWidth: baseWidth + 5,
  style,
  justify: true,
  engineMode: "newspaper",
});
assert.equal(englishNumberLine.rejected, false, "English lines containing acronyms (CWG) and numbers (2026) must not be rejected from justification");
assert.equal(englishNumberLine.expanded, true, "English lines containing numbers and acronyms should expand to justify column width");

const threeWordText = "Association President Amarashree";
const threeWordBaseWidth = justifyNewspaperLine({ text: threeWordText, targetWidth: 10, style, justify: false }).naturalWidth;
const englishThreeWordLine = justifyNewspaperLine({
  text: threeWordText,
  targetWidth: threeWordBaseWidth + 5,
  style,
  justify: true,
  engineMode: "newspaper",
});
assert.equal(englishThreeWordLine.rejected, false, "3-word English lines must not be rejected from justification");
assert.equal(englishThreeWordLine.expanded, true, "3-word English lines should expand to fill column width cleanly");

console.log("Newspaper justification tests passed!");
