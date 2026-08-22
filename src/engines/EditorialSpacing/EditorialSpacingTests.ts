import { createEditorialSpacing } from "./EditorialSpacingEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertRange = (value: number, min: number, max: number, message: string) => {
  assert(value >= min && value <= max, `${message}: expected ${min}-${max}, got ${value}`);
};

export const runEditorialSpacingTests = () => {
  const lead = createEditorialSpacing({
    priority: "lead",
    headlineSize: 40,
    hasSubheadline: true,
    hasImage: true,
    hasCaption: true,
  });
  const secondaryProduction = createEditorialSpacing({
    priority: "secondary",
    headlineSize: 19,
    hasSubheadline: true,
    hasImage: true,
    hasCaption: true,
    productionView: true,
  });
  const briefWithoutSubheadline = createEditorialSpacing({
    priority: "brief",
    headlineSize: 14,
    hasSubheadline: false,
    hasImage: false,
    hasCaption: false,
  });

  // Values reflect a ~30% cut from the originals (2/4/3/6/3) applied across
  // EditorialSpacingEngine per an explicit request to tighten internal spacing.
  assert(lead.headlineToSubheadline === 1.5, "headline bottom margin should be packed");
  assert(lead.subheadlineToDateline === 3, "lead subheadline margin should stay compact");
  assert(lead.datelineToContent === 2, "dateline bottom margin should be packed");
  assert(lead.imageToCaption === 4, "image bottom margin should provide clean separation from image");
  assert(lead.captionToBody === 2, "caption bottom margin should be packed");
  assert(
    secondaryProduction.headlineToSubheadline <= lead.headlineToSubheadline,
    "production spacing should stay at packed-stack density",
  );
  assert(
    briefWithoutSubheadline.headlineToSubheadline === 0,
    "missing subheadline should not reserve headline-to-subheadline spacing",
  );

  return {
    passed: true,
  };
};

if (require.main === module) {
  runEditorialSpacingTests();
  console.log("EditorialSpacingTests passed");
}
