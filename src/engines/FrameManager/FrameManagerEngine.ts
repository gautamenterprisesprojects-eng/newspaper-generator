import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { createStoryPlacementFromFrameObject } from "@/engines/DocumentEngine/DocumentEngine";
import type {
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperFrameObject,
  NewspaperFrameType,
  NewspaperPageId,
  NewspaperStoryPlacement,
} from "@/types/document";
import type {
  FrameLayerAction,
  FrameManagerCard,
  FrameManagerFilter,
  FrameManagerPageGroup,
  FrameManagerStatus,
  FrameManagerVirtualRange,
} from "./FrameManagerTypes";

export const frameTypeLabels: Record<NewspaperFrameType, string> = {
  article: "Story Frame",
  headline: "Headline Frame",
  subheadline: "Subheadline Frame",
  body: "Body Frame",
  image: "Image Frame",
  caption: "Caption Frame",
  "fact-box": "Fact Box",
  "pull-quote": "Pull Quote",
  graphic: "Graphic Frame",
  advertisement: "Advertisement Frame",
  table: "Table Frame",
  custom: "Custom Frame",
};

export const frameTypeColors: Record<NewspaperFrameType, string> = {
  article: "#52616f",
  headline: "#2563eb",
  subheadline: "#3b82f6",
  body: "#6b7280",
  image: "#15803d",
  caption: "#d97706",
  "fact-box": "#7c3aed",
  "pull-quote": "#9333ea",
  graphic: "#0f766e",
  advertisement: "#737373",
  table: "#475569",
  custom: "#52525b",
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const getPageFrames = (document: NewspaperDocument, pageId: NewspaperPageId) => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return [];
  }

  return page.frameIds
    .map((frameId) => document.frames[frameId])
    .filter((frame): frame is NewspaperFrameObject => Boolean(frame))
    .sort((first, second) => first.zIndex - second.zIndex);
};

const syncPageStoryShadow = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
): NewspaperDocument => ({
  ...document,
  pages: document.pages.map((page) => {
    if (page.id !== pageId) {
      return page;
    }

    const stories = getPageFrames(document, pageId)
      .map(createStoryPlacementFromFrameObject)
      .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

    return {
      ...page,
      stories,
      updatedAt: new Date().toISOString(),
    };
  }),
});

const normalizePageZOrder = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  orderedFrameIds: NewspaperFrameId[],
) => {
  const nextFrames = { ...document.frames };

  orderedFrameIds.forEach((frameId, index) => {
    const frame = nextFrames[frameId];

    if (frame) {
      nextFrames[frameId] = {
        ...frame,
        zIndex: index,
        metadata: {
          ...frame.metadata,
          updatedAt: new Date().toISOString(),
        },
      };
    }
  });

  return syncPageStoryShadow(
    {
      ...document,
      frames: nextFrames,
      pages: document.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              frameIds: orderedFrameIds,
            }
          : page,
      ),
    },
    pageId,
  );
};

export const createFrameManagerGroups = ({
  document,
  selectedFrameIds,
}: {
  document: NewspaperDocument;
  selectedFrameIds: Set<NewspaperFrameId>;
}): FrameManagerPageGroup[] =>
  document.pages.map((page) => ({
    pageId: page.id,
    pageNumber: page.pageNumber,
    sectionName: page.sectionName ?? page.pageType,
    cards: getPageFrames(document, page.id).map((frame) => {
      const story = frame.storyId ? document.stories[frame.storyId] : null;
      const headline = story ? richTextToPlainText(story.headline).trim() : "";
      const frameName = frame.metadata.name ?? frameTypeLabels[frame.frameType] ?? frame.id;

      return {
        frameId: frame.id,
        pageId: page.id,
        pageNumber: page.pageNumber,
        frameType: frame.frameType,
        frameName,
        storyName: headline || story?.name || "-",
        storyId: frame.storyId ?? null,
        author: story?.byline.author ?? "",
        tags: story?.tags ?? [],
        locked: frame.locked,
        hidden: frame.hidden,
        overflow: Boolean(story?.compositionMetrics?.overflow),
        selected: selectedFrameIds.has(frame.id),
        zIndex: frame.zIndex,
        color: frameTypeColors[frame.frameType],
        frame,
      };
    }),
  }));

export const filterFrameManagerGroups = (
  groups: FrameManagerPageGroup[],
  filter: FrameManagerFilter,
): FrameManagerPageGroup[] => {
  const query = normalizeSearch(filter.query);

  return groups
    .map((page) => ({
      ...page,
      cards: page.cards.filter((card) => {
        if (filter.pageId !== "all" && card.pageId !== filter.pageId) {
          return false;
        }

        if (filter.frameType !== "all" && card.frameType !== filter.frameType) {
          return false;
        }

        if (filter.onlyLocked && !card.locked) {
          return false;
        }

        if (filter.onlyHidden && !card.hidden) {
          return false;
        }

        if (filter.onlyOverflow && !card.overflow) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          card.frameName,
          card.storyName,
          card.frameType,
          card.pageNumber.toString(),
          card.author,
          ...card.tags,
        ].some((value) => normalizeSearch(value).includes(query));
      }),
    }))
    .filter((page) => page.cards.length > 0 || filter.pageId !== "all");
};

export const flattenFrameManagerCards = (groups: FrameManagerPageGroup[]) =>
  groups.flatMap((page) => page.cards);

export const calculateFrameManagerStatus = (
  cards: FrameManagerCard[],
): FrameManagerStatus => ({
  frameCount: cards.length,
  storyCount: new Set(cards.map((card) => card.storyId).filter(Boolean)).size,
  imageFrames: cards.filter((card) => card.frameType === "image" || card.frame.frameType === "image").length,
  overflowFrames: cards.filter((card) => card.overflow).length,
  visibleFrames: cards.filter((card) => !card.hidden).length,
  lockedFrames: cards.filter((card) => card.locked).length,
  hiddenFrames: cards.filter((card) => card.hidden).length,
  selectedFrames: cards.filter((card) => card.selected).length,
});

export const calculateFrameManagerVirtualRange = ({
  itemCount,
  scrollTop,
  viewportHeight,
  itemHeight,
  overscan = 6,
}: {
  itemCount: number;
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  overscan?: number;
}): FrameManagerVirtualRange => {
  const firstVisible = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(itemCount, firstVisible + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * itemHeight,
    totalHeight: itemCount * itemHeight,
  };
};

export const updateFrameProperties = (
  document: NewspaperDocument,
  frameId: NewspaperFrameId,
  update: Partial<Pick<NewspaperFrameObject, "locked" | "hidden" | "selected" | "frameType">> & {
    name?: string;
  },
): NewspaperDocument => {
  const frame = document.frames[frameId];

  if (!frame) {
    return document;
  }

  const nextFrame: NewspaperFrameObject = {
    ...frame,
    ...update,
    metadata: {
      ...frame.metadata,
      name: update.name ?? frame.metadata.name,
      updatedAt: new Date().toISOString(),
    },
  };

  return syncPageStoryShadow(
    {
      ...document,
      frames: {
        ...document.frames,
        [frameId]: nextFrame,
      },
    },
    frame.pageId,
  );
};

export const reorderFrameLayer = (
  document: NewspaperDocument,
  frameId: NewspaperFrameId,
  action: FrameLayerAction,
): NewspaperDocument => {
  const frame = document.frames[frameId];

  if (!frame) {
    return document;
  }

  const pageFrameIds = getPageFrames(document, frame.pageId).map((candidate) => candidate.id);
  const currentIndex = pageFrameIds.indexOf(frameId);

  if (currentIndex < 0) {
    return document;
  }

  const nextIds = [...pageFrameIds];
  const [target] = nextIds.splice(currentIndex, 1);
  const nextIndex =
    action === "bring-to-front"
      ? nextIds.length
      : action === "send-to-back"
        ? 0
        : action === "bring-forward"
          ? Math.min(currentIndex + 1, nextIds.length)
          : Math.max(currentIndex - 1, 0);

  nextIds.splice(nextIndex, 0, target);

  return normalizePageZOrder(document, frame.pageId, nextIds);
};

export const moveFrameBefore = (
  document: NewspaperDocument,
  sourceFrameId: NewspaperFrameId,
  targetFrameId: NewspaperFrameId,
): NewspaperDocument => {
  const source = document.frames[sourceFrameId];
  const target = document.frames[targetFrameId];

  if (!source || !target || source.pageId !== target.pageId || sourceFrameId === targetFrameId) {
    return document;
  }

  const pageFrameIds = getPageFrames(document, source.pageId).map((frame) => frame.id);
  const nextIds = pageFrameIds.filter((frameId) => frameId !== sourceFrameId);
  const targetIndex = nextIds.indexOf(targetFrameId);

  nextIds.splice(Math.max(0, targetIndex), 0, sourceFrameId);

  return normalizePageZOrder(document, source.pageId, nextIds);
};

export const groupFrames = (
  document: NewspaperDocument,
  frameIds: NewspaperFrameId[],
  groupName = "Frame Group",
): NewspaperDocument => {
  if (frameIds.length < 2) {
    return document;
  }

  const groupId = `group-${Date.now().toString(36)}`;

  return {
    ...document,
    frames: Object.fromEntries(
      Object.entries(document.frames).map(([frameId, frame]) => [
        frameId,
        frameIds.includes(frameId)
          ? {
              ...frame,
              metadata: {
                ...frame.metadata,
                groupId,
                groupName,
                updatedAt: new Date().toISOString(),
              },
            }
          : frame,
      ]),
    ),
  };
};

export const ungroupFrames = (
  document: NewspaperDocument,
  frameIds: NewspaperFrameId[],
): NewspaperDocument => ({
  ...document,
  frames: Object.fromEntries(
    Object.entries(document.frames).map(([frameId, frame]) => {
      if (!frameIds.includes(frameId)) {
        return [frameId, frame];
      }

      const { groupId, groupName, ...metadata } = frame.metadata;

      return [
        frameId,
        {
          ...frame,
          metadata: {
            ...metadata,
            updatedAt: new Date().toISOString(),
          },
        },
      ];
    }),
  ),
});
