import { flowLinesThroughRegions } from "@/engines/RegionFlowEngine/RegionFlowEngine";
import type { ArticleTextStyle } from "@/types/editor";
import type { RichTextDocument } from "@/types/RichText";
import {
  createRichLinesFromWrappedLines,
  measureRichText,
  measureRichTextParagraph,
  resolveRichTextSpanStyle,
} from "./RichTextTypographyEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const provider = {
  measureText: (text: string) => {
    let width = 0;

    for (const character of Array.from(text)) {
      if (/\s/u.test(character)) {
        width += 4;
      } else if (/[\u0900-\u097F]/u.test(character)) {
        width += 9;
      } else {
        width += 7;
      }
    }

    return { width };
  },
};

const baseStyle: ArticleTextStyle = {
  fill: "#111",
  fontFamily: "Noto Serif Devanagari, serif",
  fontSize: 18,
  fontStyle: "400",
  lineHeight: 1,
  wrap: "none",
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const richDocument: RichTextDocument = {
  spans: [
    { text: "नगर निगम", bold: true },
    { text: " ने विशेष अभियान ", italic: true },
    { text: "शुरू", underline: true, fontWeight: 800 },
    { text: " किया", fontSize: 22 },
  ],
};

const tests: TestCase[] = [
  {
    name: "Bold rendering style",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, { text: "नगर", bold: true });

      assert(style.fontStyle === "700", "bold span should resolve to 700 weight");
    },
  },
  {
    name: "Italic rendering style",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, { text: "नगर", italic: true });

      assert(style.fontStyle === "italic 400", "italic span should preserve base weight");
    },
  },
  {
    name: "Underline rendering style",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, { text: "नगर", underline: true });

      assert(style.textDecoration === "underline", "underline span should resolve text decoration");
    },
  },
  {
    name: "Font weight rendering style",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, { text: "नगर", fontWeight: 900 });

      assert(style.fontStyle === "900", "fontWeight span should override base style");
    },
  },
  {
    name: "Font size rendering style",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, { text: "BREAKING", fontSize: 24 });

      assert(style.fontSize === 24, "fontSize span should override base size");
    },
  },
  {
    name: "Headline wrapping with rich spans",
    run: () => {
      const result = measureRichTextParagraph(
        {
          content: richDocument,
          width: 170,
          baseStyle,
          maxLines: 3,
          options: { provider },
        },
      );

      assert(result.lineCount > 1, "rich headline should wrap across multiple lines");
      assert(result.lines.every((line) => line.segments.length > 0), "rich lines should preserve segments");
      assert(result.wrappedLines.join("").replace(/\s+/gu, " ").trim().length > 0, "rich wrap should preserve text");
    },
  },
  {
    name: "Body flow compatibility",
    run: () => {
      const result = measureRichTextParagraph({
        content: richDocument,
        width: 140,
        baseStyle,
        options: { provider },
      });
      const flow = flowLinesThroughRegions({
        wrappedLines: result.wrappedLines,
        lineHeight: 18,
        regions: [
          { x: 0, y: 0, width: 140, height: 54, order: 0, columnIndex: 0, area: 140 * 54 },
          { x: 160, y: 0, width: 140, height: 54, order: 1, columnIndex: 1, area: 140 * 54 },
        ],
      });

      assert(flow.visibleLineCount === result.wrappedLines.length, "region flow should consume rich wrapped lines");
      assert(!flow.overflow, "rich body flow should not overflow test regions");
    },
  },
  {
    name: "PDF compatibility segments",
    run: () => {
      const wrappedLines = ["नगर निगम ने विशेष अभियान शुरू किया"];
      const lines = createRichLinesFromWrappedLines(richDocument, wrappedLines, baseStyle, { provider });

      assert(lines[0].segments.length >= 4, "PDF line should expose styled segments");
      assert(lines[0].segments.some((segment) => segment.style.textDecoration === "underline"), "PDF segments should preserve underline");
      assert(lines[0].segments.some((segment) => segment.style.fontSize === 22), "PDF segments should preserve font size");
    },
  },
  {
    name: "Backward compatibility plain text",
    run: () => {
      const width = measureRichText("Plain headline", baseStyle, { provider });
      const paragraph = measureRichTextParagraph({
        content: "Plain headline",
        width: 500,
        baseStyle,
        options: { provider },
      });

      assert(width > 0, "plain text should measure through rich typography engine");
      assert(paragraph.wrappedLines[0] === "Plain headline", "plain text should remain unchanged");
    },
  },
];

export const runRichTextTypographyTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runRichTextTypographyTests();
  console.log(`Rich text typography tests passed: ${result.passed}`);
}
