import { rectBottom, rectRight, rectsOverlap } from "@/engines/LayoutTransactionEngine/LayoutGeometry";
import type { AdvertisementReservation } from "@/engines/PagePlanner";
import type { StoryFrame } from "@/types/editor";
import type { LayoutRect } from "@/engines/LayoutTransactionEngine/LayoutTransactionTypes";
import type { PageCompositionValidation, PageCompositionValidationIssue } from "./PageCompositionResult";

const getAdRect = (advertisement: AdvertisementReservation): LayoutRect | null => {
  const metadata = advertisement as AdvertisementReservation & Partial<LayoutRect>;

  if (
    typeof metadata.x === "number" &&
    typeof metadata.y === "number" &&
    typeof metadata.width === "number" &&
    typeof metadata.height === "number"
  ) {
    return {
      x: metadata.x,
      y: metadata.y,
      width: metadata.width,
      height: metadata.height,
    };
  }

  return null;
};

/** Validates a finished composed page without changing geometry or typography. */
export const validatePageComposition = ({
  stories,
  advertisements,
  contentBounds,
  illegalWhitespaceArea,
}: {
  stories: StoryFrame[];
  advertisements: AdvertisementReservation[];
  contentBounds: LayoutRect;
  illegalWhitespaceArea: number;
}): PageCompositionValidation => {
  const issues: PageCompositionValidationIssue[] = [];

  for (let firstIndex = 0; firstIndex < stories.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < stories.length; secondIndex += 1) {
      if (rectsOverlap(stories[firstIndex], stories[secondIndex])) {
        issues.push({
          code: "story-overlap",
          severity: "error",
          storyId: stories[firstIndex].id,
          message: `Story '${stories[firstIndex].id}' overlaps story '${stories[secondIndex].id}'.`,
        });
      }
    }
  }

  const adRects = advertisements.map(getAdRect).filter((rect): rect is LayoutRect => Boolean(rect));

  for (const story of stories) {
    if (
      story.x < contentBounds.x ||
      story.y < contentBounds.y ||
      rectRight(story) > rectRight(contentBounds) ||
      rectBottom(story) > rectBottom(contentBounds)
    ) {
      issues.push({
        code: "outside-margins",
        severity: "error",
        storyId: story.id,
        message: `Story '${story.id}' is outside page margins.`,
      });
    }

    if (story.imageEnabled && story.imageHeight > story.height) {
      issues.push({
        code: "image-overflow",
        severity: "error",
        storyId: story.id,
        message: `Story '${story.id}' image exceeds frame height.`,
      });
    }

    if (story.articleData.caption.enabled && story.height < story.imageHeight + 36) {
      issues.push({
        code: "caption-overflow",
        severity: "warning",
        storyId: story.id,
        message: `Story '${story.id}' may not have enough caption room.`,
      });
    }

    if (story.headlineFontSize * 1.2 > story.height * 0.5) {
      issues.push({
        code: "headline-overflow",
        severity: "warning",
        storyId: story.id,
        message: `Story '${story.id}' headline may overflow.`,
      });
    }

    for (const adRect of adRects) {
      if (rectsOverlap(story, adRect)) {
        issues.push({
          code: "advertisement-overlap",
          severity: "error",
          storyId: story.id,
          message: `Story '${story.id}' overlaps a reserved advertisement zone.`,
        });
      }
    }
  }

  if (illegalWhitespaceArea > 0) {
    issues.push({
      code: "illegal-whitespace",
      severity: "warning",
      message: `Page has ${Math.round(illegalWhitespaceArea)}pt^2 unresolved whitespace.`,
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};
