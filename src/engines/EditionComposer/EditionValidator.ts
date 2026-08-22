import { getOrderedSections, type EditionConfiguration, type EditionPlan } from "@/engines/PagePlanner";
import type { AdvertisementReservation } from "@/engines/PagePlanner";
import type { StoryFrame } from "@/types/editor";
import type {
  EditionPageComposition,
  EditionValidation,
  EditionValidationIssue,
} from "./EditionCompositionResult";

const pushDuplicateIssues = (
  ids: string[],
  code: "duplicate-story-assignment" | "duplicate-story-placement",
  issues: EditionValidationIssue[],
) => {
  const counts = new Map<string, number>();

  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  for (const [storyId, count] of [...counts.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    if (count > 1) {
      issues.push({
        code,
        severity: "error",
        storyId,
        message: `Story '${storyId}' appears ${count} times in the edition.`,
      });
    }
  }
};

const getAdvertisementPage = (advertisement: AdvertisementReservation) =>
  advertisement.lockedPageNumber ?? advertisement.preferredPageNumber;

/** Validates edition-level publishing rules without inspecting or recalculating page geometry. */
export const validateEditionComposition = ({
  editionPlan,
  pages,
  stories,
  advertisements,
  configuration,
}: {
  editionPlan: EditionPlan;
  pages: EditionPageComposition[];
  stories: StoryFrame[];
  advertisements: AdvertisementReservation[];
  configuration?: EditionConfiguration;
}): EditionValidation => {
  const issues: EditionValidationIssue[] = [];
  const pageNumbers = pages.map((page) => page.pageNumber);
  const sortedPageNumbers = [...pageNumbers].sort((first, second) => first - second);

  if (pageNumbers.some((pageNumber, index) => pageNumber !== sortedPageNumbers[index])) {
    issues.push({
      code: "invalid-page-order",
      severity: "error",
      message: "Edition pages are not composed in ascending page order.",
    });
  }

  const expectedPageCount = configuration?.pageCount ?? editionPlan.pages.length;

  if (pages.length !== expectedPageCount) {
    issues.push({
      code: "invalid-page-count",
      severity: "error",
      message: `Edition composed ${pages.length} pages but expected ${expectedPageCount}.`,
    });
  }

  if (configuration) {
    const expectedSections = getOrderedSections(configuration);
    const expectedPrefix = pages.map((_, index) => expectedSections[Math.min(index, expectedSections.length - 1)]);

    for (const [index, page] of pages.entries()) {
      const expected = expectedPrefix[index];

      if (expected && page.section !== expected) {
        issues.push({
          code: "invalid-section-order",
          severity: "warning",
          pageNumber: page.pageNumber,
          message: `Page ${page.pageNumber} is '${page.section}' but expected '${expected}'.`,
        });
      }
    }
  }

  pushDuplicateIssues(
    editionPlan.storyAssignments.map((assignment) => assignment.storyId),
    "duplicate-story-assignment",
    issues,
  );
  pushDuplicateIssues(
    pages.flatMap((page) => page.result.placedStories.map((story) => story.id)),
    "duplicate-story-placement",
    issues,
  );

  const placedStoryIds = new Set(pages.flatMap((page) => page.result.placedStories.map((story) => story.id)));
  const rejectedStoryIds = new Set(pages.flatMap((page) => page.result.rejectedStories.map((story) => story.storyId)));

  for (const story of [...stories].sort((first, second) => first.id.localeCompare(second.id))) {
    if (!placedStoryIds.has(story.id) && !rejectedStoryIds.has(story.id)) {
      issues.push({
        code: "orphan-story",
        severity: "warning",
        storyId: story.id,
        message: `Story '${story.id}' was not placed or rejected by any composed page.`,
      });
    }
  }

  for (const advertisement of [...advertisements].sort((first, second) => first.id.localeCompare(second.id))) {
    const pageNumber = getAdvertisementPage(advertisement);
    const reserved = pages.some((page) =>
      page.result.advertisements.some((pageAdvertisement) => pageAdvertisement.id === advertisement.id) &&
      (!pageNumber || page.pageNumber === pageNumber),
    );

    if (!reserved) {
      issues.push({
        code: "missing-advertisement-reservation",
        severity: "error",
        pageNumber,
        advertisementId: advertisement.id,
        message: `Advertisement '${advertisement.id}' was not reserved on its planned page.`,
      });
    }
  }

  for (const page of pages) {
    if (!page.result.validation.valid) {
      issues.push({
        code: "invalid-page-composition",
        severity: "error",
        pageNumber: page.pageNumber,
        message: `Page ${page.pageNumber} has invalid page composition issues.`,
      });
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};
