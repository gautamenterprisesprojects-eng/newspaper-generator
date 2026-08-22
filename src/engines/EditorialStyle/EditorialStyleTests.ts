import { createEditorialStyles, getPageSeparatorRuleStyle } from "./EditorialStyleEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const lead = createEditorialStyles({
  priority: "lead",
  headlineSize: 40,
  subheadlineSize: 16,
  bodySize: 12.5,
});
const major = createEditorialStyles({
  priority: "major",
  headlineSize: 26,
  subheadlineSize: 14,
  bodySize: 12,
});
const secondary = createEditorialStyles({
  priority: "secondary",
  headlineSize: 19,
  subheadlineSize: 12.5,
  bodySize: 11.5,
});
const rule = getPageSeparatorRuleStyle();

assert(lead.headline.fontStyle === "900", "lead headline must be very bold");
assert(lead.headline.lineHeight < major.headline.lineHeight, "lead headline must be tighter");
assert(major.headline.fontStyle === "800", "major headline must be bold");
assert(secondary.headline.fontStyle === "700", "secondary headline must be semi-bold");
assert(lead.dateline.fontSize === 9, "dateline must be 9 pt");
assert(lead.dateline.fontStyle === "bold", "dateline must be bold");
assert(lead.dateline.fill !== lead.body.fill, "dateline must be visually distinct");
assert(lead.reporter.fontSize < lead.body.fontSize, "reporter line must be smaller than body");
assert(lead.caption.fontSize < lead.body.fontSize, "caption must be smaller than body");
assert(lead.caption.fontSize >= 8.5 && lead.caption.fontSize <= 9, "caption must be 8.5-9 pt");
assert(lead.caption.fill !== lead.body.fill, "caption must be gray toned");
assert(rule.strokeWidth < 1, "newspaper separator must be thin");

console.info("EditorialStyleTests passed");
