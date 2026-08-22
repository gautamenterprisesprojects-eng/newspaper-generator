import {
  getDefaultStoryTypographySettings,
  getStoryHierarchyStyle,
  STORY_HIERARCHY_STYLE_TABLE,
} from "./StoryHierarchyEngine";
import type { StoryPriority } from "@/types/editor";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const priorities: StoryPriority[] = ["lead", "major", "secondary", "brief", "filler"];

for (const priority of priorities) {
  const style = getStoryHierarchyStyle(priority);
  const copiedStyle = getStoryHierarchyStyle(priority);

  assert(style !== copiedStyle, "style must be returned as a copy");
  assert(style.headlineSize > 0, `${priority} headline size must be positive`);
  assert(style.bodySize > 0, `${priority} body size must be positive`);
  assert(style.minimumHeight > 0, `${priority} minimum height must be positive`);

  const typography = getDefaultStoryTypographySettings(priority);

  assert(typography.headlineFontSize === style.headlineSize, `${priority} headline default mismatch`);
  assert(typography.subheadlineFontSize >= 10, `${priority} subheadline control default must be editable`);
  assert(typography.bodyFontSize === style.bodySize, `${priority} body default mismatch`);
  assert(typography.autoFitHeadline, `${priority} should default to headline auto-fit`);
}

const lead = STORY_HIERARCHY_STYLE_TABLE.lead;
assert(lead.headlineSize >= 32 && lead.headlineSize <= 44, "lead headline must be 32-44 pt");
assert(lead.subheadlineSize >= 14 && lead.subheadlineSize <= 18, "lead subheadline must be 14-18 pt");

const major = STORY_HIERARCHY_STYLE_TABLE.major;
assert(major.headlineSize >= 22 && major.headlineSize <= 30, "major headline must be 22-30 pt");

assert(!STORY_HIERARCHY_STYLE_TABLE.brief.showSubheadline, "brief must not show subheadline");
assert(!STORY_HIERARCHY_STYLE_TABLE.filler.showSubheadline, "filler must be minimal");

assert(
  STORY_HIERARCHY_STYLE_TABLE.lead.headlineSize > STORY_HIERARCHY_STYLE_TABLE.major.headlineSize,
  "lead must be visually larger than major",
);
assert(
  STORY_HIERARCHY_STYLE_TABLE.major.headlineSize >
    STORY_HIERARCHY_STYLE_TABLE.secondary.headlineSize,
  "major must be visually larger than secondary",
);
assert(
  STORY_HIERARCHY_STYLE_TABLE.secondary.headlineSize >
    STORY_HIERARCHY_STYLE_TABLE.brief.headlineSize,
  "secondary must be visually larger than brief",
);

console.info("StoryHierarchyTests passed");
