import assert from "node:assert/strict";
import type { RichTextContent } from "@/types/RichText";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  applyStyleToSelection,
  clearFormattingFromSelection,
  mapJoinedTextSelectionToBulletRanges,
  normalizeSelectionRange,
} from "./TextSelectionEngine";

const assertSpanCount = (content: RichTextContent, expected: number) => {
  assert.equal(typeof content === "string" ? 1 : content.spans.length, expected);
};

const bold = applyStyleToSelection("प्रदेश समाचार", { start: 0, end: 6 }, { bold: true });
assert.equal(bold.spans[0].bold, true);
assert.equal(richTextToPlainText(bold), "प्रदेश समाचार");

const italic = applyStyleToSelection("प्रदेश समाचार", { start: 7, end: 13 }, { italic: true });
assert.equal(italic.spans[1].italic, true);

const underline = applyStyleToSelection("headline", { start: 0, end: 8 }, { underline: true });
assert.equal(underline.spans[0].underline, true);

const color = applyStyleToSelection("headline", { start: 0, end: 4 }, { color: "#b42318" });
assert.equal(color.spans[0].color, "#b42318");

const background = applyStyleToSelection("headline", { start: 4, end: 8 }, { backgroundColor: "#fff4dc" });
assert.equal(background.spans[1].backgroundColor, "#fff4dc");

const fontSize = applyStyleToSelection("headline", { start: 0, end: 8 }, { fontSize: 28 });
assert.equal(fontSize.spans[0].fontSize, 28);

const fontWeight = applyStyleToSelection("headline", { start: 0, end: 8 }, { fontWeight: 800 });
assert.equal(fontWeight.spans[0].fontWeight, 800);

const cleared = clearFormattingFromSelection(
  {
    spans: [
      {
        text: "headline",
        bold: true,
        italic: true,
        underline: true,
        color: "#b42318",
        backgroundColor: "#fff4dc",
        fontSize: 28,
        fontWeight: 800,
      },
    ],
  },
  { start: 0, end: 8 },
);
assert.deepEqual(cleared.spans, [{ text: "headline" }]);

const merged = applyStyleToSelection(
  {
    spans: [
      { text: "new", bold: true },
      { text: "s", bold: true },
    ],
  },
  { start: 0, end: 4 },
  { bold: true },
);
assertSpanCount(merged, 1);

const mappedBullets = mapJoinedTextSelectionToBulletRanges(
  ["पहला बिंदु", "दूसरा बिंदु", "तीसरा बिंदु"],
  { start: 7, end: 19 },
);
assert.deepEqual(mappedBullets, [
  { bulletIndex: 0, range: { start: 7, end: 10 } },
  { bulletIndex: 1, range: { start: 0, end: 8 } },
]);

assert.deepEqual(normalizeSelectionRange({ start: 8, end: 2 }), { start: 2, end: 8 });

console.log("Text selection tests passed: 10");
