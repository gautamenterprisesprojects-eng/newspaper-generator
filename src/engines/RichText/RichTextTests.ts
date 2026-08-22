import { parseRichText } from "./RichTextParser";
import { serializeRichTextToJSON, serializeRichTextToPlainText } from "./RichTextSerializer";
import {
  applyStyleToRange,
  cloneRichText,
  mergeAdjacentCompatibleSpans,
  normalizeRichText,
  normalizeRunBoundaries,
  plainTextToRichText,
  removeStyleFromRange,
  richTextToPlainText,
} from "./RichTextUtils";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const tests: TestCase[] = [
  {
    name: "Plain text conversion",
    run: () => {
      const document = plainTextToRichText("Headline text");

      assert(document.spans.length === 1, "plain text should create one span");
      assert(document.spans[0].text === "Headline text", "plain text span mismatch");
      assert(richTextToPlainText(document) === "Headline text", "plain text roundtrip mismatch");
    },
  },
  {
    name: "Serialization",
    run: () => {
      const document = {
        spans: [
          { text: "First ", bold: true },
          { text: "Second", color: "#aa0000" },
        ],
      };

      assert(serializeRichTextToPlainText(document) === "First Second", "plain serialization mismatch");
      assert(serializeRichTextToJSON(document).spans.length === 2, "JSON serialization should preserve spans");
    },
  },
  {
    name: "Cloning",
    run: () => {
      const original = {
        spans: [{ text: "Clone me", bold: true }],
      };
      const cloned = cloneRichText(original);

      cloned.spans[0].text = "Changed";

      assert(original.spans[0].text === "Clone me", "clone must not mutate original");
      assert(cloned.spans[0].bold === true, "clone should preserve style");
    },
  },
  {
    name: "Style application",
    run: () => {
      const document = applyStyleToRange("abcdef", 2, 5, { bold: true, color: "#123456" });

      assert(document.spans.length === 3, "range styling should split spans");
      assert(document.spans[1].text === "cde", "styled span text mismatch");
      assert(document.spans[1].bold === true, "bold style missing");
      assert(document.spans[1].color === "#123456", "color style missing");
      assert(richTextToPlainText(document) === "abcdef", "style application must preserve text");
    },
  },
  {
    name: "Style removal",
    run: () => {
      const styled = applyStyleToRange("abcdef", 0, 6, { bold: true, underline: true });
      const document = removeStyleFromRange(styled, 1, 4, ["bold"]);

      assert(document.spans.length === 3, "style removal should split spans");
      assert(document.spans[1].text === "bcd", "style removal target text mismatch");
      assert(document.spans[1].bold === undefined, "bold should be removed");
      assert(document.spans[1].underline === true, "unremoved styles should remain");
    },
  },
  {
    name: "Span merging",
    run: () => {
      const document = mergeAdjacentCompatibleSpans({
        spans: [
          { text: "A", bold: true },
          { text: "B", bold: true },
          { text: "C", italic: true },
        ],
      });

      assert(document.spans.length === 2, "compatible spans should merge");
      assert(document.spans[0].text === "AB", "merged span text mismatch");
      assert(document.spans[1].text === "C", "incompatible span should remain");
    },
  },
  {
    name: "Normalization",
    run: () => {
      const document = normalizeRichText({
        spans: [
          { text: "" },
          { text: "Valid", bold: true, fontSize: 12 },
          { text: " invalid weight", fontWeight: -1 },
          { text: "Valid", bold: true, fontSize: 12 },
          { broken: true },
        ],
      });

      assert(document.spans.length === 3, "normalization should drop invalid spans and preserve valid style runs");
      assert(document.spans[0].text === "Valid", "first normalized span mismatch");
      assert(document.spans[1].fontWeight === undefined, "invalid font weight should be removed");
    },
  },
  {
    name: "Backward compatibility",
    run: () => {
      const parsed = parseRichText("Legacy string");

      assert(parsed.spans.length === 1, "legacy string should parse as one span");
      assert(parsed.spans[0].text === "Legacy string", "legacy string text mismatch");
      assert(serializeRichTextToPlainText(parsed) === "Legacy string", "legacy string serialization mismatch");
    },
  },
  {
    name: "Normalize run boundaries (lexical spaces insertion)",
    run: () => {
      const doc = normalizeRunBoundaries({
        spans: [
          { text: "क्रिकेट", bold: true },
          { text: "की", italic: true },
          { text: "बारीकियों", bold: true },
        ],
      });
      const text = richTextToPlainText(doc);
      assert(text === "क्रिकेट की बारीकियों", `Expected lexical spaces between word token runs, got "${text}"`);

      // Do not insert before punctuation
      const docPunct = normalizeRunBoundaries({
        spans: [
          { text: "समझा", bold: true },
          { text: "।", color: "#f00" },
        ],
      });
      assert(richTextToPlainText(docPunct) === "समझा।", "Should not insert space before virama/full stop");
    },
  },
];

export const runRichTextTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runRichTextTests();
  console.log(`Rich text tests passed: ${result.passed}`);
}
