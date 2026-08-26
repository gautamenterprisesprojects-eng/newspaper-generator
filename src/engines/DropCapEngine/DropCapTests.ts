import { composeDropCap } from "./DropCapEngine";
import type { TextMetricsProvider } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle } from "@/types/editor";

type TestCase = {
  name: string;
  run: () => void;
};

const deterministicProvider: TextMetricsProvider = {
  measureText: (text) => ({ width: Array.from(text).length * 10 }),
};

const bodyStyle: ArticleTextStyle = {
  fill: "#333",
  fontFamily: "Noto Sans Devanagari",
  fontSize: 12,
  lineHeight: 1.35,
  wrap: "none",
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createRegion = () => ({
  order: 0,
  columnIndex: 0,
  x: 0,
  y: 0,
  width: 120,
  height: 120,
  area: 120 * 120,
});

const assertDisabledDropCap = () => {
  const region = createRegion();
  const result = composeDropCap({
    enabled: false,
    text: "Opening paragraph",
    regions: [region],
    bodyStyle,
    lineHeight: 20,
  });

  assert(result.dropCap === null, "disabled drop cap should not create layout");
  assert(result.text === "Opening paragraph", "disabled drop cap should preserve body text");
  assert(result.regions.length === 1, "disabled drop cap should preserve region count");
};

const assertDropCapRegionSplit = () => {
  const result = composeDropCap(
    {
      enabled: true,
      text: "Opening paragraph",
      regions: [createRegion()],
      bodyStyle,
      lineHeight: 20,
      lineSpan: 3,
    },
    { provider: deterministicProvider },
  );

  assert(result.dropCap !== null, "enabled drop cap should create layout");
  if (!result.dropCap) {
    return;
  }

  assert(result.dropCap.text === "O", "drop cap should use first grapheme");
  assert(result.text === "pening paragraph", "body text should remove first grapheme");
  assert(result.dropCap.height === 60, "drop cap should occupy three body lines");
  assert(result.dropCap.width === 16, "drop cap width should include measured glyph and gutter");
  assert(result.regions.length === 2, "first region should split around drop cap");
  assert(result.regions[0].x === 16, "first flow region should start after drop cap");
  assert(result.regions[0].height === 60, "first flow region should cover drop cap height");
  assert(result.regions[1].y === 60, "second flow region should continue below drop cap");
};

const assertDefaultDropCapUsesTwoRows = () => {
  const result = composeDropCap(
    {
      enabled: true,
      text: "Opening paragraph",
      regions: [createRegion()],
      bodyStyle,
      lineHeight: 20,
    },
    { provider: deterministicProvider },
  );

  assert(result.dropCap !== null, "default drop cap should create layout");
  if (!result.dropCap) {
    return;
  }

  assert(result.dropCap.height === 40, "default drop cap should occupy two body lines");
  assert(result.regions[0].height === 40, "first flow region should match default two-line drop cap");
  assert(result.regions[1].y === 40, "second flow region should continue after default two-line drop cap");
};

const assertTinyRegionSkipsDropCap = () => {
  const result = composeDropCap(
    {
      enabled: true,
      text: "Opening paragraph",
      regions: [
        {
          ...createRegion(),
          width: 30,
          area: 30 * 120,
        },
      ],
      bodyStyle,
      lineHeight: 20,
      lineSpan: 3,
    },
    { provider: deterministicProvider },
  );

  assert(result.dropCap === null, "drop cap should be skipped when no readable text width remains");
  assert(result.text === "Opening paragraph", "skipped drop cap should preserve body text");
};

const tests: TestCase[] = [
  {
    name: "Disabled drop cap preserves input",
    run: assertDisabledDropCap,
  },
  {
    name: "Enabled drop cap creates occupied three-line region",
    run: assertDropCapRegionSplit,
  },
  {
    name: "Default drop cap occupies two body lines",
    run: assertDefaultDropCapUsesTwoRows,
  },
  {
    name: "Drop cap is skipped for tiny regions",
    run: assertTinyRegionSkipsDropCap,
  },
];

export const runDropCapTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runDropCapTests();
  console.log(`Drop cap tests passed: ${result.passed}`);
}
