import { balanceHeadline, fitHeadline, measureParagraph } from "./TypographyEngine";
import type { TextMetricsProvider } from "./TypographyTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const deterministicProvider: TextMetricsProvider = {
  measureText: (text) => {
    let width = 0;

    for (const character of Array.from(text)) {
      if (/\s/u.test(character)) {
        width += 4;
      } else if (/[\u0900-\u097F]/u.test(character)) {
        width += 9;
      } else if (/[A-Z]/u.test(character)) {
        width += 8;
      } else {
        width += 7;
      }
    }

    return { width };
  },
};

const options = {
  provider: deterministicProvider,
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertClose = (actual: number, expected: number, message: string) => {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
};

const countWords = (text: string) => text.split(/\s+/u).filter(Boolean).length;

const getFinalLineRatio = (result: { lines: { width: number }[] }, width: number) =>
  (result.lines.at(-1)?.width ?? 0) / width;

const assertHeadlineLeavesLessThanOneSixthBlank = (
  result: { lines: { width: number }[]; lineCount: number },
  width: number,
  message: string,
) => {
  if (result.lineCount <= 1) {
    return;
  }

  assert(
    result.lines.every((line) => (width - line.width) / width <= 1 / 6),
    message,
  );
};

const installScaledCanvasMeasurementShim = () => {
  class TestOffscreenCanvas {
    private readonly context = {
      font: "",
      measureText(text: string) {
        const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
        let width = 0;

        for (const character of Array.from(text)) {
          if (/\s/u.test(character)) {
            width += fontSize * 0.28;
          } else if (/[\u0900-\u097F]/u.test(character)) {
            width += fontSize * 0.62;
          } else if (/[A-Z]/u.test(character)) {
            width += fontSize * 0.58;
          } else {
            width += fontSize * 0.5;
          }
        }

        return { width };
      },
    };

    getContext() {
      return this.context;
    }
  }

  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: TestOffscreenCanvas,
  });
};

const assertParagraph = (name: string, text: string, width: number) => {
  const result = measureParagraph(
    {
      text,
      width,
      fontFamily: "Noto Sans Devanagari, Arial",
      fontSize: 14,
      lineHeight: 1.2,
    },
    options,
  );

  assert(result.lineCount > 0, `${name}: expected at least one line`);
  assertClose(result.consumedHeight, result.lineCount * 14 * 1.2, `${name}: invalid height`);
  assert(result.lines.every((line) => line.width <= width), `${name}: line exceeds width`);
};

const tests: TestCase[] = [
  {
    name: "Short headline",
    run: () => {
      const result = fitHeadline(
        {
          text: "मानसून आया",
          width: 220,
          maxLines: 2,
          fontFamily: "Noto Serif Devanagari",
          minFontSize: 18,
          maxFontSize: 36,
          lineHeight: 1.08,
        },
        options,
      );

      assert(result.fontSize === 36, "short headline should fit at maximum size");
      assert(result.lineCount <= 2, "short headline should fit within two lines");
    },
  },
  {
    name: "Long headline",
    run: () => {
      const result = fitHeadline(
        {
          text: "प्रदेश में भारी बारिश के बाद निचले इलाकों में जलभराव की स्थिति गंभीर",
          width: 160,
          maxLines: 2,
          fontFamily: "Noto Serif Devanagari",
          minFontSize: 18,
          maxFontSize: 34,
          lineHeight: 1.08,
        },
        options,
      );

      assert(result.fontSize < 34, "long headline should reduce font size");
      assert(result.lineCount <= 3, "long headline should fit within max lines");
    },
  },
  {
    name: "Balanced headline avoids short final line",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "State monsoon alert teams prepare work",
          availableWidth: 200,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 28,
          maxLines: 2,
        },
        options,
      );

      assert(!result.overflow, "balanced headline should fit");
      assert(result.lineCount === 2, "headline should use two balanced lines");
      assert(result.wrappedLines[0] === "State monsoon alert teams", "unexpected first headline line");
      assert(result.wrappedLines[1] === "prepare work", "unexpected second headline line");
      assert(countWords(result.wrappedLines[1]) > 1, "final headline line should not be orphaned");
      assert(result.visualBalanceScore >= 0, "headline should expose a visual balance score");
      assert(result.balanceScore === result.visualBalanceScore, "headline should expose balance score alias");
      assert(Number.isFinite(result.selectedCandidateScore), "headline should expose selected candidate score");
      assert(result.selectedLayout.join(" ") === result.wrappedLines.join(" "), "selected layout should match wrapped lines");
    },
  },
  {
    name: "Headline prefers two lines over three",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "State monsoon alert teams prepare work",
          availableWidth: 200,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 28,
          maxLines: 3,
        },
        options,
      );

      assert(!result.overflow, "headline should fit");
      assert(result.lineCount === 2, "headline should prefer two lines when a readable two-line layout exists");
      assert(countWords(result.wrappedLines.at(-1) ?? "") > 1, "final line should not look incomplete");
    },
  },
  {
    name: "Newspaper fill headline prioritizes fuller upper lines",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "State monsoon alert teams prepare emergency work",
          availableWidth: 220,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 20,
          maxLines: 2,
          headlineLayoutMode: "newspaper-fill",
          forceFullWidth: true,
        },
        options,
      );

      assert(!result.overflow, "newspaper-fill headline should fit");
      assert(result.lineCount === 2, "newspaper-fill headline should use two lines");
      assert(result.wrappedLines[0] === "State monsoon alert teams prepare", "newspaper-fill should maximize line 1 before balancing");
      assert(result.lines[0].width / 220 >= 0.9, "newspaper-fill line 1 should use at least 90% of available width");
      assert(Number.isFinite(result.selectedCandidateScore), "newspaper-fill should expose candidate score");
    },
  },
  {
    name: "Headline fit uses controlled editorial font range",
    run: () => {
      const result = fitHeadline(
        {
          text: "State monsoon alert teams prepare work",
          width: 200,
          maxLines: 3,
          fontFamily: "Noto Serif Devanagari",
          minFontSize: 18,
          maxFontSize: 28,
          lineHeight: 1.08,
        },
        options,
      );

      assert(result.fontSize >= Math.ceil(28 * 0.8), "headline should not reduce more than 20%");
      assert(result.fontSize <= Math.ceil(28 * 1.05), "headline should not increase more than 5%");
      assert(result.lineCount <= 2, "fit should prefer two-line headline when possible");
      assert(result.visualBalanceScore >= 0, "fit result should expose visual balance score");
      assert(Number.isFinite(result.selectedCandidateScore), "fit result should expose selected candidate score");
      assert(result.selectedLayout.join(" ") === result.wrappedLines.join(" "), "fit should expose selected layout");
    },
  },
  {
    name: "Short headline reduces to one clean line",
    run: () => {
      installScaledCanvasMeasurementShim();
      const result = fitHeadline({
        text: "City schools reopen after rain",
        width: 360,
        maxLines: 2,
        fontFamily: "Noto Serif",
        minFontSize: 18,
        maxFontSize: 30,
        lineHeight: 1.08,
        headlineLayoutMode: "newspaper-fill",
      });

      assert(result.lineCount === 1, "short headline should reduce to a single line instead of leaving a weak second line");
      assert(result.fontSize < 30, "short headline should reduce font size only as much as needed");
      assert(result.wrappedLines[0] === "City schools reopen after rain", "headline text should remain intact");
    },
  },
  {
    name: "Proper two-line headline keeps normal behavior",
    run: () => {
      const result = fitHeadline(
        {
          text: "State monsoon alert teams prepare emergency work",
          width: 220,
          maxLines: 2,
          fontFamily: "Noto Serif Devanagari",
          minFontSize: 18,
          maxFontSize: 28,
          lineHeight: 1.08,
          headlineLayoutMode: "newspaper-fill",
        },
        options,
      );

      assert(result.lineCount === 2, "headline with a proper two-line word balance should stay two lines");
      assert(countWords(result.wrappedLines.at(-1) ?? "") >= 2, "final line should remain readable");
    },
  },
  {
    name: "Two-line headline avoids loose blank space",
    run: () => {
      installScaledCanvasMeasurementShim();
      const result = fitHeadline({
        text: "Markets rally after banks cut rates today",
        width: 260,
        maxLines: 2,
        fontFamily: "Noto Serif",
        minFontSize: 16,
        maxFontSize: 28,
        lineHeight: 1.08,
        headlineLayoutMode: "newspaper-fill",
      });

      assert(result.lineCount === 2, "headline should remain a readable two-line setting");
      assertHeadlineLeavesLessThanOneSixthBlank(result, 260, "two-line headline should not leave loose blank space");
    },
  },
  {
    name: "Three-line headline avoids loose blank space",
    run: () => {
      installScaledCanvasMeasurementShim();
      const result = fitHeadline({
        text: "Council approves riverfront flood safety repair plan",
        width: 230,
        maxLines: 3,
        fontFamily: "Noto Serif",
        minFontSize: 14,
        maxFontSize: 26,
        lineHeight: 1.08,
        headlineLayoutMode: "newspaper-fill",
      });

      assert(result.lineCount >= 2, "headline should use multiple lines when needed");
      assert(result.lineCount <= 3, "headline should respect the requested line limit");
      assertHeadlineLeavesLessThanOneSixthBlank(result, 230, "three-line headline should not leave loose blank space");
    },
  },
  {
    name: "Headline uses three lines when two-line ending is weak",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "Breaking city flood control teams prepare emergency pumps",
          availableWidth: 160,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 28,
          maxLines: 3,
        },
        options,
      );

      assert(!result.overflow, "headline should fit");
      assert(result.lineCount === 3, "headline should use three lines when no good two-line layout exists");
      assert(getFinalLineRatio(result, 160) >= 0.35, "final line should be at least 35% of headline width");
      assert(countWords(result.wrappedLines.at(-1) ?? "") > 1, "final line should not be a tiny orphan");
    },
  },
  {
    name: "Hindi headline rejects broken-looking final fragment",
    run: () => {
      const headline =
        "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915 \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
      const result = fitHeadline(
        {
          text: headline,
          width: 250,
          maxLines: 3,
          fontFamily: "Noto Serif Devanagari",
          minFontSize: 24,
          maxFontSize: 30,
          lineHeight: 1.08,
        },
        options,
      );
      const finalLine = result.wrappedLines.at(-1) ?? "";

      assert(result.wrappedLines.join(" ") === headline, "headline should preserve all words");
      assert(!/\s\u0924\u0947$/u.test(finalLine), "headline must not end with broken-looking fragment");
      assert(finalLine.includes("\u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c"), "final line should preserve the complete ending phrase");
      assert(result.balanceScore > 0, "headline should expose balance score");
    },
  },
  {
    name: "Hindi headline avoids single-word final line",
    run: () => {
      const headline =
        "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915 \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
      const result = balanceHeadline(
        {
          headline,
          availableWidth: 250,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 30,
          maxLines: 2,
        },
        options,
      );

      assert(!result.overflow, "Hindi headline should fit");
      assert(result.lineCount <= 2, "Hindi headline should respect max lines");
      assert(countWords(result.wrappedLines.at(-1) ?? "") > 1, "Hindi final line should not be a single word");
      assert(result.wrappedLines.join(" ") === headline, "Hindi headline words should be preserved");
    },
  },
  {
    name: "Hindi headline favors full first line newspaper break",
    run: () => {
      const headline =
        "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915, \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
      const desiredFirstLine =
        "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915, \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935";
      const desiredSecondLine = "\u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
      const result = balanceHeadline(
        {
          headline,
          availableWidth: 370,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 20,
          maxLines: 2,
          forceFullWidth: true,
        },
        options,
      );

      assert(!result.overflow, "Hindi newspaper headline should fit");
      assert(result.lineCount === 2, "Hindi newspaper headline should remain two lines");
      assert(result.wrappedLines[0] === desiredFirstLine, "first line should pull the next whole word when it fits");
      assert(result.wrappedLines[1] === desiredSecondLine, "second line should carry the remaining complete phrase");
      assert(result.lines[0].width / 370 >= 0.9, "first line should fill at least 90% of headline width");
      assert(result.selectedCandidateType === "newspaper-fill", "selected candidate should be controlled by newspaper-fill mode");
      assert(result.topCandidateScores[0]?.lines.join("|") === result.wrappedLines.join("|"), "chosen candidate must be the top scored candidate");
      assert((result.topCandidateScores[0]?.line1FillPercent ?? 0) > 90, "top candidate line 1 fill should exceed 90%");
      assert(Number.isFinite(result.selectedCandidateScore), "headline should expose selected candidate score");
    },
  },
  {
    name: "Headline hyphenation does not fire on loose line endings",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "City plan administration review",
          availableWidth: 120,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 20,
          maxLines: 3,
          enableHyphenation: true,
          forceFullWidth: true,
        },
        options,
      );

      assert(!result.overflow, "English headline should fit");
      assert(!result.wrappedLines.some((line) => line.includes("-")), "loose headline lines should not be hyphenated");
      assert(result.lines[0].width / 120 < 0.9, "test should exercise a line with more than 10% unused width");
    },
  },
  {
    name: "Hindi headline hyphenation uses Devanagari syllable boundaries",
    run: () => {
      const result = balanceHeadline(
        {
          headline: "\u0936\u0939\u0930 \u0915\u0940 \u092a\u094d\u0930\u0936\u093e\u0938\u0928 \u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e",
          availableWidth: 150,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 22,
          maxLines: 2,
          enableHyphenation: true,
          forceFullWidth: true,
        },
        options,
      );

      assert(!result.overflow, "hyphenated Hindi headline should fit");
      assert(result.lineCount <= 2, "Hindi headline should remain compact with hyphenation enabled");
      assert(result.lines.every((line) => line.width <= 150), "Hindi headline lines must fit available width");
      assert(!result.wrappedLines.some((line) => /-\s*$/u.test(line) && line.length <= 2), "Hindi hyphenation should not create tiny fragments");
    },
  },
  {
    name: "Hindi newspaper hyphenation fills nearly full headline line",
    run: () => {
      const headline =
        "\u092a\u094d\u0930\u0926\u0947\u0936 \u092e\u0947\u0902 \u092e\u093e\u0928\u0938\u0942\u0928 \u0915\u0940 \u0926\u0938\u094d\u0924\u0915, \u0936\u0939\u0930\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0915\u0940 \u0924\u0948\u092f\u093e\u0930\u0940 \u0924\u0947\u091c";
      const withoutHyphenation = balanceHeadline(
        {
          headline,
          availableWidth: 330,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 20,
          maxLines: 2,
          enableHyphenation: false,
          forceFullWidth: true,
        },
        options,
      );
      const withHyphenation = balanceHeadline(
        {
          headline,
          availableWidth: 330,
          fontFamily: "Noto Serif Devanagari",
          fontSize: 20,
          maxLines: 2,
          enableHyphenation: true,
          forceFullWidth: true,
        },
        options,
      );

      assert(!withoutHyphenation.wrappedLines[0].includes("-"), "disabled hyphenation should preserve whole words");
      assert(withHyphenation.wrappedLines[0].endsWith("\u091c\u0932-"), "Hindi headline should use a valid short prefix with hyphen");
      assert(withHyphenation.wrappedLines[1].startsWith("\u092d\u0930\u093e\u0935"), "Hindi headline should continue with the suffix on the next line");
      assert(withHyphenation.lines[0].width / 330 >= 0.95, "hyphenated first line should fill at least 95% of headline width");
      assert(withHyphenation.selectedCandidateType === "hyphenated", "selected candidate should be marked hyphenated");
      assert(withHyphenation.topCandidateScores[0]?.lines.join("|") === withHyphenation.wrappedLines.join("|"), "hyphenated chosen candidate must be top scored");
      assert(!withHyphenation.wrappedLines.some((line) => /\u094D-/u.test(line)), "hyphenation must not split after a virama");
      assert(!/^[\u0900-\u0903\u093A-\u094F\u0951-\u0957]/u.test(withHyphenation.wrappedLines[1]), "hyphenation must not start inside a matra cluster");
    },
  },
  {
    name: "Short article",
    run: () => assertParagraph("Short article", "नगर निगम ने सफाई अभियान शुरू किया।", 260),
  },
  {
    name: "Medium article",
    run: () =>
      assertParagraph(
        "Medium article",
        "बारिश से पहले शहर के नालों की सफाई और पंपिंग स्टेशन की जांच तेज कर दी गई है। अधिकारियों ने बताया कि टीमें चौबीस घंटे तैनात रहेंगी।",
        260,
      ),
  },
  {
    name: "Long article",
    run: () =>
      assertParagraph(
        "Long article",
        "मानसून की पहली बारिश के बाद शहर के कई इलाकों में जलभराव की शिकायतें सामने आईं। प्रशासन ने नियंत्रण कक्ष शुरू किया है और स्थानीय निकायों को संवेदनशील क्षेत्रों में अतिरिक्त संसाधन लगाने का निर्देश दिया है। नागरिकों से अपील की गई है कि वे अनावश्यक यात्रा से बचें और आपात स्थिति में हेल्पलाइन से संपर्क करें।",
        240,
      ),
  },
  {
    name: "Hindi article",
    run: () =>
      assertParagraph(
        "Hindi article",
        "हिंदी यूनिकोड पाठ को शब्दों के आधार पर सही ढंग से पंक्तियों में बांटना आवश्यक है।",
        180,
      ),
  },
  {
    name: "English article",
    run: () =>
      assertParagraph(
        "English article",
        "Editors need deterministic text measurement before moving articles across columns.",
        210,
      ),
  },
  {
    name: "Mixed Hindi + English article",
    run: () =>
      assertParagraph(
        "Mixed Hindi + English article",
        "नगर निगम ने flood control room और emergency pump teams को सक्रिय किया।",
        220,
      ),
  },
];

export const runTypographyTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runTypographyTests();
  console.log(`Typography tests passed: ${result.passed}`);
}
