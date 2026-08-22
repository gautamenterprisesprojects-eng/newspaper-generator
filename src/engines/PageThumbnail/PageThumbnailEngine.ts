import type {
  NewspaperDocument,
  NewspaperPageId,
  NewspaperPageObject,
  NewspaperStoryPlacement,
} from "@/types/document";
import type { StoryPriority } from "@/types/editor";
import { getFramePlacementsForPage } from "@/engines/DocumentEngine/DocumentEngine";

export type PageThumbnailStoryRect = {
  placementId: string;
  storyId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: StoryPriority;
  overflow: boolean;
  hidden: boolean;
};

export type PageThumbnailSnapshot = {
  pageId: NewspaperPageId;
  cacheKey: string;
  storyCount: number;
  overflow: boolean;
  missingAssets: boolean;
  status: NonNullable<NewspaperPageObject["status"]>;
  rects: PageThumbnailStoryRect[];
};

const placementHash = (placement: NewspaperStoryPlacement) =>
  [
    placement.id,
    placement.storyId,
    placement.priority,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
    placement.columnStart,
    placement.columnSpan,
  ].join(":");

export const createPageThumbnailCacheKey = ({
  document,
  page,
}: {
  document: NewspaperDocument;
  page: NewspaperPageObject;
}) => {
  const placements = getFramePlacementsForPage(document, page.id);
  const storyVersion = placements
    .map((placement) => {
      const story = document.stories[placement.storyId];

      return `${placementHash(placement)}:${story?.compositionMetrics?.overflow ? "overset" : "fit"}:${
        story?.hidden ? "hidden" : "visible"
      }`;
    })
    .join("|");

  return [
    page.id,
    page.pageNumber,
    page.status ?? "draft",
    page.colorLabel ?? "none",
    page.updatedAt ?? "",
    storyVersion,
  ].join("::");
};

export const createPageThumbnailSnapshot = ({
  document,
  page,
}: {
  document: NewspaperDocument;
  page: NewspaperPageObject;
}): PageThumbnailSnapshot => {
  const placements = getFramePlacementsForPage(document, page.id);
  const rects = placements.map((placement) => {
    const story = document.stories[placement.storyId];

    return {
      placementId: placement.id,
      storyId: placement.storyId,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      priority: placement.priority,
      overflow: Boolean(story?.compositionMetrics?.overflow),
      hidden: Boolean(story?.hidden),
    };
  });
  const overflow = rects.some((rect) => rect.overflow) || page.status === "overflow";
  const missingAssets = placements.some((placement) => {
    const story = document.stories[placement.storyId];

    return Boolean(story?.imageSettings.imageEnabled && !story.photo);
  });

  return {
    pageId: page.id,
    cacheKey: createPageThumbnailCacheKey({ document, page }),
    storyCount: placements.length,
    overflow,
    missingAssets,
    status: page.status ?? "draft",
    rects,
  };
};

export const createEditionThumbnailSnapshots = (document: NewspaperDocument) =>
  document.pages.map((page) => createPageThumbnailSnapshot({ document, page }));
