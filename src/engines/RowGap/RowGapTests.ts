import {
  calculateRowGapDiagnostics,
  getEditorialRowGap,
  getEditorialRowGaps,
} from "./RowGapEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const leadToMajor = getEditorialRowGap({
  upperPriorities: ["lead"],
  lowerPriorities: ["major"],
  pageUtilizationPercent: 80,
});
const denseLeadToMajor = getEditorialRowGap({
  upperPriorities: ["lead"],
  lowerPriorities: ["major"],
  pageUtilizationPercent: 90,
});
const majorToSecondary = getEditorialRowGap({
  upperPriorities: ["major"],
  lowerPriorities: ["secondary"],
  pageUtilizationPercent: 90,
});
const secondaryToBrief = getEditorialRowGap({
  upperPriorities: ["secondary"],
  lowerPriorities: ["brief"],
  pageUtilizationPercent: 90,
});

assert(leadToMajor >= 6 && leadToMajor <= 8, "lead-major gap must stay in range");
assert(denseLeadToMajor === 6, "dense lead-major gap must compress to minimum");
assert(majorToSecondary === 4, "dense major-secondary gap must compress to minimum");
assert(secondaryToBrief === 3, "dense secondary-brief gap must compress to minimum");

const gaps = getEditorialRowGaps({
  rows: [
    { priorities: ["lead"] },
    { priorities: ["major"] },
    { priorities: ["secondary"] },
    { priorities: ["brief"] },
  ],
  pageUtilizationPercent: 90,
});

assert(gaps.length === 3, "four rows must produce three gaps");
assert(Math.max(...gaps) <= 20, "editorial row gaps must never exceed 20px");

const diagnostics = calculateRowGapDiagnostics({
  rows: [
    { y: 0, height: 400, priorities: ["lead"] },
    { y: 408, height: 300, priorities: ["major"] },
    { y: 714, height: 250, priorities: ["secondary"] },
  ],
  contentHeight: 1000,
});

assert(diagnostics.averageRowGap === 7, "average row gap must be calculated");
assert(diagnostics.largestRowGap === 8, "largest row gap must be calculated");
assert(diagnostics.rowDensityPercent > 98, "row density must reflect compressed gaps");

console.info("RowGapTests passed");
