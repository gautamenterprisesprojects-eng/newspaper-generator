import { composePullQuote } from "./PullQuoteEngine";
import type { TextMetricsProvider } from "@/engines/TypographyEngine/TypographyTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const deterministicProvider: TextMetricsProvider = {
  measureText: (text) => ({ width: Array.from(text).length * 7 }),
};

class TestOffscreenCanvas {
  getContext() {
    return {
      font: "",
      measureText: deterministicProvider.measureText,
    };
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: TestOffscreenCanvas,
});

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const options = {
  provider: deterministicProvider,
};

const assertEmptyPullQuote = () => {
  const result = composePullQuote(
    {
      data: {
        text: "   ",
      },
      x: 10,
      y: 20,
      width: 220,
    },
    options,
  );

  assert(result === null, "empty pull quote should not create layout");
};

const assertPullQuoteLayout = () => {
  const result = composePullQuote(
    {
      data: {
        text: "जलभराव रोकने के लिए संवेदनशील इलाकों में अतिरिक्त टीमें तैनात की गई हैं।",
      },
      x: 24,
      y: 96,
      width: 260,
    },
    options,
  );

  assert(result !== null, "pull quote should create layout");
  if (!result) {
    return;
  }

  assert(result.x === 24 && result.y === 96, "pull quote position mismatch");
  assert(result.width === 260, "pull quote width mismatch");
  assert(result.height > 0, "pull quote should have measured height");
  assert(result.textBlock.text.length > 0, "pull quote text should be preserved");
  assert(result.textBlock.lineBoxes.length === result.textBlock.lineCount, "line box count mismatch");
  assert(result.textBlock.style.fontFamily.includes("Serif"), "pull quote should use independent serif style");
};

const assertPullQuoteLineLimit = () => {
  const result = composePullQuote(
    {
      data: {
        text: Array.from({ length: 40 })
          .map(() => "newspaper")
          .join(" "),
      },
      x: 0,
      y: 0,
      width: 160,
    },
    options,
  );

  assert(result !== null, "long pull quote should create layout");
  if (!result) {
    return;
  }

  assert(result.textBlock.lineCount <= 4, "pull quote should cap visible lines");
  assert(result.textBlock.overflow, "long pull quote should expose overflow");
};

const tests: TestCase[] = [
  {
    name: "Empty pull quote returns null",
    run: assertEmptyPullQuote,
  },
  {
    name: "Pull quote measures styled line boxes",
    run: assertPullQuoteLayout,
  },
  {
    name: "Long pull quote exposes overflow",
    run: assertPullQuoteLineLimit,
  },
];

export const runPullQuoteTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runPullQuoteTests();
  console.log(`Pull quote tests passed: ${result.passed}`);
}
