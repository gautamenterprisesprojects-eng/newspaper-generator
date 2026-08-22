import { composeByline, formatByline } from "./BylineEngine";
import type { TextMetricsProvider } from "@/engines/TypographyEngine/TypographyTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const deterministicProvider: TextMetricsProvider = {
  measureText: (text) => ({ width: Array.from(text).length * 8 }),
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const tests: TestCase[] = [
  {
    name: "Formats location and author byline",
    run: () => {
      assert(
        formatByline({ location: "भोपाल", author: "संवाददाता" }) === "संवाददाता • भोपाल",
        "location and author byline mismatch",
      );
    },
  },
  {
    name: "Formats location and agency byline",
    run: () => {
      assert(
        formatByline({ location: "नई दिल्ली", agency: "एजेंसी" }) === "एजेंसी • नई दिल्ली",
        "location and agency byline mismatch",
      );
    },
  },
  {
    name: "Measures byline with TypographyEngine",
    run: () => {
      const result = composeByline(
        {
          location: "नई दिल्ली",
          agency: "एजेंसी",
          width: 220,
        },
        { provider: deterministicProvider },
      );

      assert(result.text === "एजेंसी • नई दिल्ली", "unexpected composed byline text");
      assert(result.metrics.lineCount === 1, "byline should be one measured line");
      assert(result.metrics.consumedWidth > 0, "byline should report measured width");
      assert(result.style.fontStyle === "600", "byline should use dedicated semibold style");
    },
  },
];

export const runBylineTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runBylineTests();
  console.log(`Byline tests passed: ${result.passed}`);
}
