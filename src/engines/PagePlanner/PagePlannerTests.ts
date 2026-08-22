import { strict as assert } from "node:assert";
import type { StoryProfile } from "@/engines/EditorialStory";
import { planEdition } from "./EditionPlanner";
import type { PlannerTemplate } from "./EditionRules";

const profile = (overrides: Partial<StoryProfile> & Pick<StoryProfile, "storyId">): StoryProfile => ({
  storyType: "standard",
  section: "general",
  priority: "secondary",
  minimumColumns: 1,
  preferredColumns: 2,
  maximumColumns: 4,
  grow: true,
  shrink: true,
  split: true,
  jump: true,
  imageRules: {
    required: false,
    allowAutoCrop: true,
    preserveAspectRatio: true,
    minimumHeight: 0,
    maximumHeight: 240,
    preferredPlacement: "inline",
  },
  headlineRules: {
    required: true,
    allowAutoFit: true,
    allowMultiDeck: false,
    minimumLines: 1,
    maximumLines: 3,
    tone: "news",
  },
  captionRules: {
    required: false,
    allowOverflow: false,
    maximumLines: 3,
    requireCredit: false,
  },
  diagnostics: {
    classifier: "explicit",
    reasons: [],
  },
  ...overrides,
});

const templates: PlannerTemplate[] = [
  {
    id: "ad-template",
    name: "Ad Template",
    minimumStories: 1,
    maximumStories: 4,
    supportsAdvertisements: true,
    priorityWeight: 2,
  },
  {
    id: "front-template",
    name: "Front Template",
    sections: ["front-page"],
    minimumStories: 2,
    maximumStories: 4,
    supportsAdvertisements: true,
    priorityWeight: 0,
  },
  {
    id: "text-template",
    name: "Text Template",
    minimumStories: 2,
    maximumStories: 6,
    supportsAdvertisements: false,
    priorityWeight: 1,
  },
];

const assertPlansPageOrderAndPriority = () => {
  const plan = planEdition({
    storyProfiles: [
      profile({ storyId: "brief", section: "front", priority: "brief" }),
      profile({ storyId: "lead", section: "front", priority: "lead", preferredColumns: 4 }),
      profile({ storyId: "major", section: "front", priority: "major" }),
    ],
    configuration: {
      editionId: "morning",
      pageCount: 1,
      sections: ["front-page"],
      storiesPerPageTarget: 3,
    },
    templates,
  });

  assert.deepEqual(plan.pageOrder, ["front-page"]);
  assert.deepEqual(plan.pageAssignments[0].storyIds, ["lead", "major", "brief"]);
  assert.equal(plan.pageAssignments[0].templateSelection.templateId, "front-template");
};

const assertBalancesSectionsAcrossEdition = () => {
  const plan = planEdition({
    storyProfiles: [
      profile({ storyId: "national-1", section: "general" }),
      profile({ storyId: "sports-1", section: "sports" }),
      profile({ storyId: "business-1", section: "business" }),
      profile({ storyId: "editorial-1", section: "opinion" }),
    ],
    configuration: {
      editionId: "city",
      pageCount: 4,
      sections: ["national", "sports", "business", "editorial"],
      storiesPerPageTarget: 1,
    },
    templates,
  });

  assert.deepEqual(plan.pageOrder, ["national", "sports", "business", "editorial"]);
  assert.deepEqual(plan.pageAssignments.map((page) => page.storyIds[0]), [
    "national-1",
    "sports-1",
    "business-1",
    "editorial-1",
  ]);
};

const assertReservesAdvertisements = () => {
  const plan = planEdition({
    storyProfiles: [profile({ storyId: "lead", section: "front", priority: "lead" })],
    configuration: {
      editionId: "ads",
      pageCount: 1,
      sections: ["front-page"],
      storiesPerPageTarget: 1,
    },
    advertisements: [{ id: "ad-1", lockedPageNumber: 1, priority: 0 }],
    templates,
  });

  assert.deepEqual(plan.pageAssignments[0].advertisementIds, ["ad-1"]);
  assert.notEqual(plan.pageAssignments[0].templateSelection.templateId, "text-template");
};

const assertLeavesOverflowUnassigned = () => {
  const plan = planEdition({
    storyProfiles: [
      profile({ storyId: "one", section: "sports" }),
      profile({ storyId: "two", section: "sports" }),
      profile({ storyId: "three", section: "sports" }),
    ],
    configuration: {
      editionId: "overflow",
      pageCount: 1,
      sections: ["sports"],
      storiesPerPageTarget: 2,
    },
    templates,
  });

  assert.equal(plan.pageAssignments[0].storyIds.length, 2);
  assert.deepEqual(plan.unassignedStoryIds, ["two"]);
};

assertPlansPageOrderAndPriority();
assertBalancesSectionsAcrossEdition();
assertReservesAdvertisements();
assertLeavesOverflowUnassigned();

console.log("PagePlanner tests passed: 4");
