import assert from "node:assert/strict";
import { composeHyphenationJustification } from "@/engines/HyphenationJustification/HyphenationJustificationEngine";
import type { HyphenationJustificationSettings } from "@/engines/HyphenationJustification/HyphenationJustificationTypes";
import type { ArticleTextStyle } from "@/types/editor";
import { measureWordBasedBodyParagraph, tokenizeBodyWords } from "./DevanagariLineBreakEngine";

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
  lineHeight: 1.08,
  wrap: "none",
};

const settings: HyphenationJustificationSettings = {
  wordSpacingMin: 98,
  wordSpacingMax: 102,
  trackingMin: -1,
  trackingMax: 1,
  hyphenation: false,
  maximumConsecutiveHyphens: 0,
  minimumWordLength: 7,
  minimumBeforeHyphen: 3,
  minimumAfterHyphen: 3,
  optimizationLevel: "fast",
};

const protectedWords = [
  "समीक्षा",
  "वार्डों",
  "व्यवस्था",
  "अधिकारियों",
  "नगरपालिका",
  "स्वच्छता",
  "जनप्रतिनिधि",
  "प्रशासन",
];

const paragraph = `${protectedWords.join(" ")} Hindi-English 2026 नगरपालिका-क्षेत्र`;
const tokens = tokenizeBodyWords(paragraph, style);

assert.deepEqual(
  tokens.map((token) => token.text),
  [...protectedWords, "Hindi-English", "2026", "नगरपालिका-क्षेत्र"],
  "Unicode body tokenizer must preserve complete words",
);

const wrapped = measureWordBasedBodyParagraph({
  text: paragraph,
  width: 64,
  style,
});

for (const word of protectedWords) {
  assert.ok(
    wrapped.wrappedLines.some((line) => line.split(/\s+/u).includes(word)),
    `${word} must remain intact in wrapped body lines`,
  );
  assert.ok(!wrapped.wrappedLines.some((line) => word.startsWith(line) && line !== word), `${word} must not be split`);
}

const composition = composeHyphenationJustification({
  lines: wrapped.wrappedLines.map((line, index) => ({
    text: line,
    width: 64,
    justify: index < wrapped.wrappedLines.length - 1,
  })),
  style,
  justifyMode: "justify-except-last",
  engineMode: "newspaper",
  settings,
});

const renderedWords = composition.lines.flatMap((line) => line.words.map((word) => word.text));

for (const word of protectedWords) {
  assert.ok(renderedWords.includes(word), `${word} must remain intact after H&J composition`);
}

assert.ok(
  composition.lines.flatMap((line) => line.words).every((word) => word.tracking === 0),
  "body H&J must never apply tracking inside Devanagari words",
);
assert.ok(
  composition.lines.every((line) => line.words.every((word) => !word.text.includes(" "))),
  "justification must only position complete word tokens",
);

const noInventedHyphenation = composeHyphenationJustification({
  lines: [{ text: "नगरपालिका", width: 24, justify: true }],
  style,
  justifyMode: "justify-all-lines",
  engineMode: "newspaper",
  settings: {
    ...settings,
    hyphenation: true,
    maximumConsecutiveHyphens: 2,
  },
});

assert.equal(noInventedHyphenation.lines[0].text, "नगरपालिका", "H&J must not invent Devanagari hyphen breaks");

console.log("Devanagari line break tests passed: 14");
