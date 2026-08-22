import {
  createEditorialFitMetrics,
  optimizeEditorialFit,
  type EditorialFitCandidateSettings,
} from "./EditorialFitEngine";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createBaseSettings = (overrides: Partial<EditorialFitCandidateSettings> = {}): EditorialFitCandidateSettings => ({
  bodyFontSize: 11.5,
  bodyLineHeight: 1.08,
  captionSpacingAdjustment: 0,
  imageHeight: 120,
  imageHeightPreset: "small",
  pullQuoteHeightAdjustment: 0,
  factBoxHeightAdjustment: 0,
  ...overrides,
});

const createEvaluator =
  ({
    baseFill,
    baseSettings,
    imageSensitive = false,
  }: {
    baseFill: number;
    baseSettings: EditorialFitCandidateSettings;
    imageSensitive?: boolean;
  }) =>
  (settings: EditorialFitCandidateSettings) => {
    const fontGain = (settings.bodyFontSize - baseSettings.bodyFontSize) * 4.8;
    const lineGain = (settings.bodyLineHeight - baseSettings.bodyLineHeight) * 120;
    const imageGain = imageSensitive ? (settings.imageHeight - baseSettings.imageHeight) * 0.08 : 0;
    const fillPercentage = Math.min(99, baseFill + fontGain + lineGain + imageGain);
    const overflow = fillPercentage > 99.2;

    return createEditorialFitMetrics({
      storyArea: 10_000,
      usedArea: (fillPercentage / 100) * 10_000,
      textArea: 7_000,
      imageArea: imageSensitive ? settings.imageHeight * 8 : 0,
      overflow,
      overflowPercentage: overflow ? 1 : 0,
    });
  };

const tests: TestCase[] = [
  {
    name: "Short Story",
    run: () => {
      const baseSettings = createBaseSettings();
      const baseMetrics = createEditorialFitMetrics({
        storyArea: 10_000,
        usedArea: 8_200,
        textArea: 6_500,
        imageArea: 0,
        overflow: false,
      });
      const result = optimizeEditorialFit({
        baseSettings,
        baseMetrics,
        constraints: {
          minBodyFontSize: 8,
          maxBodyFontSize: 16,
          minBodyLineHeight: 1.05,
          maxBodyLineHeight: 1.12,
          maxImageHeight: 300,
          imageEnabled: false,
          allowImageGrowth: false,
        },
        evaluateCandidate: createEvaluator({ baseFill: 82, baseSettings }),
      });

      assert(!result.selectedCandidate.metrics.overflow, "short story fit must not overflow");
      assert(result.fillPercentage > baseMetrics.fillPercentage, "short story fill should improve");
      assert(result.whitespacePercentage < baseMetrics.whitespacePercentage, "short story whitespace should reduce");
    },
  },
  {
    name: "Medium Story",
    run: () => {
      const baseSettings = createBaseSettings({ bodyFontSize: 12 });
      const baseMetrics = createEditorialFitMetrics({
        storyArea: 10_000,
        usedArea: 8_900,
        textArea: 7_800,
        imageArea: 0,
        overflow: false,
      });
      const result = optimizeEditorialFit({
        baseSettings,
        baseMetrics,
        constraints: {
          minBodyFontSize: 8,
          maxBodyFontSize: 16,
          minBodyLineHeight: 1.05,
          maxBodyLineHeight: 1.12,
          maxImageHeight: 300,
          imageEnabled: false,
          allowImageGrowth: false,
        },
        evaluateCandidate: createEvaluator({ baseFill: 89, baseSettings }),
      });

      assert(!result.selectedCandidate.metrics.overflow, "medium story fit must not overflow");
      assert(result.fillPercentage >= 92, "medium story should reach at least good fit");
      assert(result.whitespacePercentage <= 8, "medium story whitespace should be newspaper-tight");
    },
  },
  {
    name: "Long Story",
    run: () => {
      const baseSettings = createBaseSettings({ bodyFontSize: 12.5 });
      const baseMetrics = createEditorialFitMetrics({
        storyArea: 10_000,
        usedArea: 9_650,
        textArea: 9_200,
        imageArea: 0,
        overflow: false,
      });
      const result = optimizeEditorialFit({
        baseSettings,
        baseMetrics,
        constraints: {
          minBodyFontSize: 8,
          maxBodyFontSize: 16,
          minBodyLineHeight: 1.05,
          maxBodyLineHeight: 1.12,
          maxImageHeight: 300,
          imageEnabled: false,
          allowImageGrowth: false,
        },
        evaluateCandidate: createEvaluator({ baseFill: 96.5, baseSettings }),
      });

      assert(!result.selectedCandidate.metrics.overflow, "long story fit must not overflow");
      assert(result.fitStatus === "PERFECT", "long story should remain perfect");
      assert(result.fillPercentage >= 95 && result.fillPercentage <= 98, "long story should stay in target band");
    },
  },
  {
    name: "Image Story",
    run: () => {
      const baseSettings = createBaseSettings({ imageHeight: 120, imageHeightPreset: "small" });
      const baseMetrics = createEditorialFitMetrics({
        storyArea: 10_000,
        usedArea: 8_700,
        textArea: 6_600,
        imageArea: 960,
        overflow: false,
      });
      const result = optimizeEditorialFit({
        baseSettings,
        baseMetrics,
        constraints: {
          minBodyFontSize: 8,
          maxBodyFontSize: 16,
          minBodyLineHeight: 1.05,
          maxBodyLineHeight: 1.12,
          maxImageHeight: 220,
          imageEnabled: true,
          allowImageGrowth: true,
        },
        evaluateCandidate: createEvaluator({ baseFill: 87, baseSettings, imageSensitive: true }),
      });

      assert(!result.selectedCandidate.metrics.overflow, "image story fit must not overflow");
      assert(result.fillPercentage > baseMetrics.fillPercentage, "image story fill should improve");
      assert(
        result.selectedCandidate.settings.imageHeight >= baseSettings.imageHeight,
        "image story should preserve or grow image height",
      );
    },
  },
];

export const runEditorialFitTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runEditorialFitTests();
  console.log(`Editorial fit tests passed: ${result.passed}`);
}
