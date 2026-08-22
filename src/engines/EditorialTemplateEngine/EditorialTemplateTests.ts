import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import {
  getEditorialTemplates,
  getSupportedEditorialTemplateCounts,
} from "./EditorialTemplateEngine";
import type { EditorialTemplateSlot } from "./EditorialTemplateTypes";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const rectsOverlap = (first: EditorialTemplateSlot, second: EditorialTemplateSlot) =>
  Math.max(first.x, second.x) < Math.min(first.x + first.width, second.x + second.width) - 0.001 &&
  Math.max(first.y, second.y) < Math.min(first.y + first.height, second.y + second.height) - 0.001;

const getContentArea = () =>
  (NEWSPAPER_PAGE.width - PAGE_MARGIN * 2) * (NEWSPAPER_PAGE.height - PAGE_MARGIN * 2);

const getColumnWidth = () => (NEWSPAPER_PAGE.width - PAGE_MARGIN * 2) / 6;

const assertSupportedCounts = () => {
  const counts = getSupportedEditorialTemplateCounts();

  assert(counts.join(",") === "5,6,7,8,9,10,11,12,13", "supported counts should be 5 through 13");
};

const assertThreeTemplatesPerCount = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    const templates = getEditorialTemplates(storyCount);
    const variants = new Set(templates.map((template) => template.variant));

    assert(templates.length >= 3, `story count ${storyCount} needs at least three templates`);
    assert(variants.has("A") && variants.has("B") && variants.has("C"), `story count ${storyCount} lacks A/B/C variants`);
  }
};

const assertNoOverlaps = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      for (let firstIndex = 0; firstIndex < template.slots.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < template.slots.length; secondIndex += 1) {
          assert(
            !rectsOverlap(template.slots[firstIndex], template.slots[secondIndex]),
            `${template.name} has overlapping frames`,
          );
        }
      }
    }
  }
};

const assertInsidePageBounds = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      for (const slot of template.slots) {
        assert(slot.x >= PAGE_MARGIN, `${template.name} slot ${slot.id} starts before left margin`);
        assert(slot.y >= PAGE_MARGIN, `${template.name} slot ${slot.id} starts above top margin`);
        assert(
          slot.x + slot.width <= NEWSPAPER_PAGE.width - PAGE_MARGIN + 0.001,
          `${template.name} slot ${slot.id} exceeds right margin`,
        );
        assert(
          slot.y + slot.height <= NEWSPAPER_PAGE.height - PAGE_MARGIN + 0.001,
          `${template.name} slot ${slot.id} exceeds bottom margin`,
        );
      }
    }
  }
};

const assertCoverage = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      const coverage =
        template.slots.reduce((sum, slot) => sum + slot.width * slot.height, 0) /
        getContentArea();

      assert(coverage > 0.9, `${template.name} coverage should be greater than 90%`);
    }
  }
};

const assertRoleDistribution = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      assert(template.slots[0].role === "lead", `${template.name} story 1 should be lead`);
      assert(template.slots[1].role === "major", `${template.name} story 2 should be major`);
      assert(template.slots[2].role === "major", `${template.name} story 3 should be major`);

      for (let index = 3; index < Math.min(6, template.slots.length); index += 1) {
        assert(template.slots[index].role === "medium", `${template.name} story ${index + 1} should be medium`);
      }

      for (let index = 6; index < template.slots.length; index += 1) {
        assert(template.slots[index].role === "brief", `${template.name} story ${index + 1} should be brief`);
      }
    }
  }
};

const assertFrontPageHierarchy = () => {
  const contentHeight = NEWSPAPER_PAGE.height - PAGE_MARGIN * 2;

  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      const lead = template.slots[0];
      const leadHeightPercent = (lead.height / contentHeight) * 100;

      assert(lead.y === PAGE_MARGIN, `${template.name} lead story should be at the top of the page`);
      assert(
        leadHeightPercent >= 30 && leadHeightPercent <= 40,
        `${template.name} lead height should be 30-40 percent of page height`,
      );
      assert(lead.width >= getColumnWidth() * 3, `${template.name} lead should span multiple columns`);
    }
  }
};

const assertBriefsStayLow = () => {
  const contentHeight = NEWSPAPER_PAGE.height - PAGE_MARGIN * 2;

  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      for (const slot of template.slots.filter((item) => item.role === "brief")) {
        const yPercent = ((slot.y - PAGE_MARGIN) / contentHeight) * 100;

        assert(yPercent >= 70, `${template.name} brief ${slot.id} should stay in lower page zones`);
      }
    }
  }
};

const assertColumnSnapping = () => {
  const columnWidth = getColumnWidth();

  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      for (const slot of template.slots) {
        const columnStart = (slot.x - PAGE_MARGIN) / columnWidth;
        const columnSpan = slot.width / columnWidth;

        assert(Math.abs(columnStart - Math.round(columnStart)) < 0.001, `${template.name} slot ${slot.id} is not column-snapped`);
        assert(Math.abs(columnSpan - Math.round(columnSpan)) < 0.001, `${template.name} slot ${slot.id} width is not column-snapped`);
      }
    }
  }
};

const assertImageRatio = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    for (const template of getEditorialTemplates(storyCount)) {
      const imageCount = template.slots.filter((slot) => slot.hasImage).length;

      assert(
        imageCount / template.slots.length <= 0.4,
        `${template.name} has too many image-driven stories`,
      );
    }
  }
};

const assertTemplatesLookDifferent = () => {
  for (const storyCount of getSupportedEditorialTemplateCounts()) {
    const signatures = getEditorialTemplates(storyCount).map((template) =>
      template.slots.map((slot) => `${Math.round(slot.x)}:${Math.round(slot.y)}:${Math.round(slot.width)}:${Math.round(slot.height)}`).join("|"),
    );

    assert(new Set(signatures).size >= 3, `story count ${storyCount} templates should differ visually`);
  }
};

const tests: TestCase[] = [
  {
    name: "Supports story counts 5 through 13",
    run: assertSupportedCounts,
  },
  {
    name: "Provides three variants per story count",
    run: assertThreeTemplatesPerCount,
  },
  {
    name: "Editorial frames do not overlap",
    run: assertNoOverlaps,
  },
  {
    name: "Editorial frames stay inside page bounds",
    run: assertInsidePageBounds,
  },
  {
    name: "Editorial templates cover more than 90 percent of the page",
    run: assertCoverage,
  },
  {
    name: "Editorial roles follow story order",
    run: assertRoleDistribution,
  },
  {
    name: "Editorial templates use front-page hierarchy",
    run: assertFrontPageHierarchy,
  },
  {
    name: "Brief stories stay in lower zones",
    run: assertBriefsStayLow,
  },
  {
    name: "Frames snap to the 6-column newspaper grid",
    run: assertColumnSnapping,
  },
  {
    name: "Image-driven stories stay under the 40 percent limit",
    run: assertImageRatio,
  },
  {
    name: "Template variants differ visually",
    run: assertTemplatesLookDifferent,
  },
];

export const runEditorialTemplateTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runEditorialTemplateTests();
  console.log(`Editorial template tests passed: ${result.passed}`);
}
