import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import { composeEditorialPage } from "./EditorialPageComposer";
import type { EditorialPageSlot } from "./EditorialPageComposer";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const rectsOverlap = (first: EditorialPageSlot, second: EditorialPageSlot) =>
  Math.max(first.x, second.x) < Math.min(first.x + first.width, second.x + second.width) - 0.001 &&
  Math.max(first.y, second.y) < Math.min(first.y + first.height, second.y + second.height) - 0.001;

const getContentHeight = () => NEWSPAPER_PAGE.height - PAGE_MARGIN * 2;
const getColumnWidth = () => (NEWSPAPER_PAGE.width - PAGE_MARGIN * 2) / 6;
const storyCounts = Array.from({ length: 9 }).map((_, index) => index + 5);

const getCompositions = () =>
  storyCounts.map((storyCount) => {
    const composition = composeEditorialPage({ storyCount });

    assert(composition !== null, `missing editorial page composition for ${storyCount}`);

    return composition;
  });

const assertCoverage = () => {
  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    assert(
      composition.coverageRatio > 0.97,
      `${composition.storyCount} story page coverage should exceed 97%`,
    );
  }
};

const assertNoOverlap = () => {
  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    for (let firstIndex = 0; firstIndex < composition.slots.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < composition.slots.length; secondIndex += 1) {
        assert(
          !rectsOverlap(composition.slots[firstIndex], composition.slots[secondIndex]),
          `${composition.storyCount} story page has overlapping frames`,
        );
      }
    }
  }
};

const assertLeadGeometry = () => {
  const contentHeight = getContentHeight();

  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    const lead = composition.slots[0];
    const leadHeightPercent = (lead.height / contentHeight) * 100;

    assert(lead.role === "lead", `${composition.storyCount} story page first slot must be lead`);
    assert(lead.y === PAGE_MARGIN, `${composition.storyCount} story lead must start at top margin`);
    assert(
      leadHeightPercent >= 35 && leadHeightPercent <= 45,
      `${composition.storyCount} story lead height must be 35-45%`,
    );
    assert(lead.width >= getColumnWidth() * 3, `${composition.storyCount} story lead must span multiple columns`);
  }
};

const assertRoleHierarchy = () => {
  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    const majorAreas = composition.slots
      .filter((slot) => slot.role === "major")
      .map((slot) => slot.width * slot.height);
    const mediumAreas = composition.slots
      .filter((slot) => slot.role === "medium")
      .map((slot) => slot.width * slot.height);

    if (majorAreas.length > 0 && mediumAreas.length > 0) {
      assert(
        Math.min(...majorAreas) > Math.min(...mediumAreas),
        `${composition.storyCount} story page major stories must be visibly larger than medium stories`,
      );
    }
  }
};

const assertBriefsLowerAndTextHeavy = () => {
  const contentHeight = getContentHeight();

  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    for (const slot of composition.slots.filter((item) => item.role === "brief")) {
      const topPercent = ((slot.y - PAGE_MARGIN) / contentHeight) * 100;

      assert(topPercent >= 70, `${composition.storyCount} story page brief stories must stay low`);
      assert(!slot.hasImage, `${composition.storyCount} story page brief stories should be text-heavy`);
    }
  }
};

const assertImageRatio = () => {
  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    const imageRatio = composition.slots.filter((slot) => slot.hasImage).length / composition.slots.length;

    assert(imageRatio >= 0.2, `${composition.storyCount} story page needs at least 20% image stories`);
    assert(imageRatio <= 0.4, `${composition.storyCount} story page exceeds 40% image stories`);
  }
};

const assertColumnSnapping = () => {
  const columnWidth = getColumnWidth();

  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    for (const slot of composition.slots) {
      const columnStart = (slot.x - PAGE_MARGIN) / columnWidth;
      const columnSpan = slot.width / columnWidth;

      assert(Math.abs(columnStart - Math.round(columnStart)) < 0.001, `${composition.storyCount} story slot x is off grid`);
      assert(Math.abs(columnSpan - Math.round(columnSpan)) < 0.001, `${composition.storyCount} story slot width is off grid`);
    }
  }
};

const assertNotDashboardCards = () => {
  for (const composition of getCompositions()) {
    if (!composition) {
      continue;
    }

    const areaSignatures = new Set(
      composition.slots.map((slot) => Math.round((slot.width * slot.height) / 1000)),
    );

    assert(
      areaSignatures.size >= Math.min(4, composition.storyCount - 2),
      `${composition.storyCount} story page has too few distinct frame sizes`,
    );
  }
};

const tests: TestCase[] = [
  {
    name: "Page coverage exceeds 97 percent",
    run: assertCoverage,
  },
  {
    name: "Composed frames do not overlap",
    run: assertNoOverlap,
  },
  {
    name: "Lead story follows newspaper front-page geometry",
    run: assertLeadGeometry,
  },
  {
    name: "Major stories are larger than medium stories",
    run: assertRoleHierarchy,
  },
  {
    name: "Brief stories stay low and text-heavy",
    run: assertBriefsLowerAndTextHeavy,
  },
  {
    name: "Image story ratio remains between 20 and 40 percent",
    run: assertImageRatio,
  },
  {
    name: "Frames snap to a 6-column newspaper grid",
    run: assertColumnSnapping,
  },
  {
    name: "Composition avoids equal-size dashboard cards",
    run: assertNotDashboardCards,
  },
];

export const runEditorialPageComposerTests = () => {
  for (const test of tests) {
    test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  const result = runEditorialPageComposerTests();
  console.log(`Editorial page composer tests passed: ${result.passed}`);
}
