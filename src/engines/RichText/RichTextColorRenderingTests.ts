import { createEditorialFitMetrics, getEditorialFitStatus } from "@/engines/EditorialFitEngine/EditorialFitEngine";
import { parsePrintColor } from "@/engines/PrintPDFEngine/PrintPDFEngine";
import type { ArticleTextStyle } from "@/types/editor";
import type { RichTextDocument } from "@/types/RichText";
import { applyRichTextColorStyle, hasRichTextColorStyle } from "./RichTextColorRenderingEngine";
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
      width += /\s/u.test(character) ? 4 : 8;
    }

    return { width };
  },
};

const baseStyle: ArticleTextStyle = {
  fill: "#111111",
  fontFamily: "Noto Serif Devanagari, serif",
  fontSize: 18,
  fontStyle: "700",
  lineHeight: 1,
  wrap: "none",
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const richColorDocument: RichTextDocument = {
  spans: [
    { text: "नगर निगम", color: "#d32f2f" },
    { text: " ने " },
    { text: "विशेष रिपोर्ट", backgroundColor: "#ffeb3b" },
    { text: " शुरू की", bold: true, color: "#ffffff", backgroundColor: "#d32f2f" },
  ],
};

const tests: TestCase[] = [
  {
    name: "Text color rendering",
    run: () => {
      const style = applyRichTextColorStyle(baseStyle, { text: "नगर निगम", color: "#d32f2f" });

      assert(style.fill === "#d32f2f", "span color should override text fill");
      assert(hasRichTextColorStyle({ text: "नगर निगम", color: "#d32f2f" }), "color span should be detected");
    },
  },
  {
    name: "Background color rendering",
    run: () => {
      const style = applyRichTextColorStyle(baseStyle, {
        text: "विशेष रिपोर्ट",
        backgroundColor: "#ffeb3b",
      });

      assert(style.backgroundColor === "#ffeb3b", "background color should be preserved");
    },
  },
  {
    name: "Mixed styling rendering",
    run: () => {
      const style = resolveRichTextSpanStyle(baseStyle, {
        text: "ब्रेकिंग",
        bold: true,
        color: "#ffffff",
        backgroundColor: "#d32f2f",
      });

      assert(style.fontStyle === "700", "bold mixed style should preserve headline weight");
      assert(style.fill === "#ffffff", "mixed style should preserve text color");
      assert(style.backgroundColor === "#d32f2f", "mixed style should preserve background");
    },
  },
  {
    name: "PDF rendering color compatibility",
    run: () => {
      assert(parsePrintColor("#d32f2f") !== null, "PDF parser should accept text color");
      assert(parsePrintColor("#ffeb3b") !== null, "PDF parser should accept background color");
    },
  },
  {
    name: "Backward compatibility",
    run: () => {
      const plainWidth = measureRichText("Plain headline", baseStyle, { provider });
      const richWidth = measureRichText({ spans: [{ text: "Plain headline" }] }, baseStyle, { provider });

      assert(plainWidth === richWidth, "unstyled rich document should measure like plain text");
    },
  },
  {
    name: "Typography compatibility",
    run: () => {
      const noColor = measureRichText("नगर निगम", baseStyle, { provider });
      const withColor = measureRichText({ spans: [{ text: "नगर निगम", color: "#d32f2f" }] }, baseStyle, {
        provider,
      });

      assert(noColor === withColor, "color must not affect text measurement");
    },
  },
  {
    name: "Headline compatibility",
    run: () => {
      const result = measureRichTextParagraph({
        content: richColorDocument,
        width: 170,
        baseStyle,
        options: { provider },
      });

      assert(result.lineCount > 1, "colored rich headline should wrap");
      assert(result.lines.some((line) => line.segments.some((segment) => segment.style.fill === "#d32f2f")), "wrapped headline should keep red segment");
      assert(
        result.lines.some((line) => line.segments.some((segment) => segment.style.backgroundColor === "#ffeb3b")),
        "wrapped headline should keep highlight segment",
      );
    },
  },
  {
    name: "Editorial Fit compatibility",
    run: () => {
      const metrics = createEditorialFitMetrics({
        storyArea: 10_000,
        usedArea: 9_600,
        textArea: 7_500,
        imageArea: 1_000,
        overflow: false,
      });

      assert(getEditorialFitStatus(metrics) === "PERFECT", "color should not affect editorial fit metrics");
    },
  },
  {
    name: "Line segments preserve color backgrounds",
    run: () => {
      const lines = createRichLinesFromWrappedLines(
        richColorDocument,
        ["नगर निगम ने विशेष रिपोर्ट शुरू की"],
        baseStyle,
        { provider },
      );

      assert(lines[0].segments.some((segment) => segment.style.fill === "#d32f2f"), "line should preserve text color");
      assert(
        lines[0].segments.some((segment) => segment.style.backgroundColor === "#ffeb3b"),
        "line should preserve background highlight",
      );
    },
  },
];

export const runRichTextColorRenderingTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runRichTextColorRenderingTests();
  console.log(`Rich text color rendering tests passed: ${result.passed}`);
}
