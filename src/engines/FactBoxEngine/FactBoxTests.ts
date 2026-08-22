import { composeFactBox } from "./FactBoxEngine";
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

const assertEmptyFactBox = () => {
  const result = composeFactBox(
    {
      data: {
        headline: "",
        bullets: [],
      },
      x: 10,
      y: 20,
      width: 120,
    },
    options,
  );

  assert(result === null, "empty fact box should not create layout");
};

const assertFactBoxLayout = () => {
  const result = composeFactBox(
    {
      data: {
        headline: "खास बातें",
        bullets: ["पहला बिंदु", "दूसरा बिंदु"],
      },
      x: 10,
      y: 20,
      width: 140,
    },
    options,
  );

  assert(result !== null, "fact box should create layout");
  if (!result) {
    return;
  }

  assert(result.x === 10 && result.y === 20, "fact box position mismatch");
  assert(result.width === 140, "fact box width mismatch");
  assert(result.height > 0, "fact box should have measured height");
  assert(result.headline.text === "खास बातें", "headline text mismatch");
  assert(result.bullets.length === 2, "bullet count mismatch");
  assert(result.bullets[0].text.startsWith("• "), "bullet prefix missing");
};

const tests: TestCase[] = [
  {
    name: "Empty fact box returns null",
    run: assertEmptyFactBox,
  },
  {
    name: "Fact box measures headline and bullets",
    run: assertFactBoxLayout,
  },
];

export const runFactBoxTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runFactBoxTests();
  console.log(`Fact box tests passed: ${result.passed}`);
}
