import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import { getPageTemplate, getSupportedTemplateCounts } from "./PageTemplateEngine";
import type { PageTemplateSlot } from "./PageTemplateTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const rectsOverlap = (first: PageTemplateSlot, second: PageTemplateSlot) =>
  Math.max(first.x, second.x) < Math.min(first.x + first.width, second.x + second.width) &&
  Math.max(first.y, second.y) < Math.min(first.y + first.height, second.y + second.height);

const assertSupportedCounts = () => {
  const counts = getSupportedTemplateCounts();

  assert(counts.join(",") === "5,6,7,8,9,10,11,12,13", "supported template counts changed");
};

const assertTemplatesHaveNoOverlap = () => {
  for (const storyCount of getSupportedTemplateCounts()) {
    const template = getPageTemplate({ storyCount });

    assert(template !== null, `missing template for ${storyCount}`);
    if (!template) {
      continue;
    }

    assert(template.slots.length === storyCount, `template ${storyCount} slot count mismatch`);

    for (let firstIndex = 0; firstIndex < template.slots.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < template.slots.length; secondIndex += 1) {
        assert(
          !rectsOverlap(template.slots[firstIndex], template.slots[secondIndex]),
          `template ${storyCount} has overlapping slots`,
        );
      }
    }
  }
};

const assertTemplatesStayInsidePageBounds = () => {
  for (const storyCount of getSupportedTemplateCounts()) {
    const template = getPageTemplate({ storyCount });

    assert(template !== null, `missing template for ${storyCount}`);
    if (!template) {
      continue;
    }

    for (const slot of template.slots) {
      assert(slot.x >= PAGE_MARGIN, `template ${storyCount} slot starts before page margin`);
      assert(slot.y >= PAGE_MARGIN, `template ${storyCount} slot starts above page margin`);
      assert(
        slot.x + slot.width <= NEWSPAPER_PAGE.width - PAGE_MARGIN + 0.001,
        `template ${storyCount} slot exceeds right page margin`,
      );
      assert(
        slot.y + slot.height <= NEWSPAPER_PAGE.height - PAGE_MARGIN + 0.001,
        `template ${storyCount} slot exceeds bottom page margin`,
      );
    }
  }
};

const assertNoEmptyTemplateRegions = () => {
  const contentArea =
    (NEWSPAPER_PAGE.width - PAGE_MARGIN * 2) * (NEWSPAPER_PAGE.height - PAGE_MARGIN * 2);

  for (const storyCount of getSupportedTemplateCounts()) {
    const template = getPageTemplate({ storyCount });

    assert(template !== null, `missing template for ${storyCount}`);
    if (!template) {
      continue;
    }

    const slotArea = template.slots.reduce((sum, slot) => sum + slot.width * slot.height, 0);

    assert(
      Math.abs(slotArea - contentArea) < 0.001,
      `template ${storyCount} does not fully occupy the page content area`,
    );
  }
};

const assertRolesExist = () => {
  for (const storyCount of getSupportedTemplateCounts()) {
    const template = getPageTemplate({ storyCount });

    assert(template !== null, `missing template for ${storyCount}`);
    if (!template) {
      continue;
    }

    assert(template.slots.some((slot) => slot.role === "lead"), `template ${storyCount} lacks lead slot`);
    assert(
      template.slots.every((slot) => ["lead", "secondary", "brief"].includes(slot.role)),
      `template ${storyCount} has invalid role`,
    );
  }
};

const tests: TestCase[] = [
  {
    name: "Supports templates for 5 through 13 stories",
    run: assertSupportedCounts,
  },
  {
    name: "Template slots do not overlap",
    run: assertTemplatesHaveNoOverlap,
  },
  {
    name: "Template slots stay inside page bounds",
    run: assertTemplatesStayInsidePageBounds,
  },
  {
    name: "Template slots fully occupy page content area",
    run: assertNoEmptyTemplateRegions,
  },
  {
    name: "Template slots expose editorial roles",
    run: assertRolesExist,
  },
];

export const runPageTemplateTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runPageTemplateTests();
  console.log(`Page template tests passed: ${result.passed}`);
}
