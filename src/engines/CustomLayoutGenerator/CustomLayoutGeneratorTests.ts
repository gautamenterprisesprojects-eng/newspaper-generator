import assert from "node:assert";
import {
  compilePromptToBlueprint,
  generateCustomLayoutFromBlueprint,
  selectOptimisticNewswireWordTier,
  determineInternalTextColumnCount,
  estimateStoryBoxWordCapacity,
  POINTS_PER_CM,
} from "./CustomLayoutGeneratorEngine";

console.info("Running CustomLayoutGeneratorTests...");

// Test 1: Optimistic Word Tier Selection (250 / 500 / 1000 words)
// Ensures we always pick higher word ranges so no blank white space is ever left at column bottoms
assert(selectOptimisticNewswireWordTier(100) === 250, "100 words capacity should map to 250 word API tier");
assert(selectOptimisticNewswireWordTier(200) === 500, "200 words capacity (with 1.5x buffer = 300) should map to 500 word API tier");
assert(selectOptimisticNewswireWordTier(350) === 1000, "350 words capacity (with 1.5x buffer = 525) should map to 1000 word API tier");
assert(selectOptimisticNewswireWordTier(800) === 1000, "Large capacities must map to 1000 word API tier");

// Test 2: Internal Newspaper Text Columns (<8cm -> 1 col, 8-14cm -> 2 cols, >14cm -> 3 cols)
const width5cmPt = 5 * POINTS_PER_CM;
const width10cmPt = 10 * POINTS_PER_CM;
const width16cmPt = 16 * POINTS_PER_CM;
assert(determineInternalTextColumnCount(width5cmPt) === 1, "Width < 8cm must receive exactly 1 column");
assert(determineInternalTextColumnCount(width10cmPt) === 2, "Width 8–14cm must receive exactly 2 columns");
assert(determineInternalTextColumnCount(width16cmPt) === 3, "Width > 14cm must receive exactly 3 columns");

// Test 3: Image Disabling instantly reflows body text upwards (more word capacity without image box)
const capWithImage = estimateStoryBoxWordCapacity(width10cmPt, 350, true, 2);
const capWithoutImage = estimateStoryBoxWordCapacity(width10cmPt, 350, false, 2);
assert(capWithoutImage >= capWithImage + 40, "Disabling image must immediately increase body text word capacity cleanly without leaving blank placeholder boxes");

// Test 4: Prompt Compilation & Custom Layout Generation
const promptBlueprint = compilePromptToBlueprint({
  id: "CustomPrompt8A",
  name: "Custom 8 Story Prompt Layout",
  totalColumns: 6,
  rowLayouts: [
    { heightPercent: 35, colSpans: [4, 2], priorities: ["lead", "major"], images: [true, false] },
    { heightPercent: 35, colSpans: [2, 2, 2], priorities: ["secondary", "secondary", "secondary"], images: [false, true, false] },
    { heightPercent: 30, colSpans: [2, 2, 2], priorities: ["major", "secondary", "secondary"], images: [true, false, true] },
  ],
});

const generated = generateCustomLayoutFromBlueprint(promptBlueprint, 792, 1122);
assert(generated.diagnostics.isValidGrid === true, `Layout grid must be valid without errors: ${generated.diagnostics.errors.join(", ")}`);
assert(generated.diagnostics.totalStoryCount === 8, "Must generate exactly 8 stories as prompted");
assert(generated.diagnostics.totalRowHeightPercent === 100, "Row height percentages must sum to 100%");
assert(generated.storyConfigs.length === 8, "Must return 8 story configs");

// Ensure every story config has a valid API tier (250, 500, or 1000) and proper centimeter metrics
generated.storyConfigs.forEach((config) => {
  assert([250, 500, 1000].includes(config.recommendedApiTier), `Story ${config.storyNumber} has valid tier ${config.recommendedApiTier}`);
  assert(config.widthCm > 0 && config.internalTextColumns >= 1, `Story ${config.storyNumber} has valid dimensions`);
});

console.info("CustomLayoutGeneratorTests passed cleanly!");
