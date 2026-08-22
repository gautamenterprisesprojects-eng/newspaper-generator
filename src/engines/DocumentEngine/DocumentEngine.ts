import { prototypeArticle } from "@/data/prototypeArticle";
import { normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import {
  createDefaultLayers,
  createDefaultMasterPages,
  createDefaultPageTemplates,
} from "@/engines/MasterPage/MasterPageEngine";
import { cloneRichText } from "@/engines/RichText/RichTextUtils";
import { normalizeHeaderSystemState } from "@/engines/HeaderSystem";
import { createDefaultStyleLibrary, normalizeStyleLibrary } from "@/engines/StyleManager/StyleManagerEngine";
import type { StoryFrame } from "@/types/editor";
import type {
  EditionCanvasMode,
  EditionPageColorLabel,
  EditionPageStatus,
  NewspaperDocument,
  NewspaperDocumentMetadata,
  NewspaperFrameId,
  NewspaperFrameObject,
  NewspaperPageId,
  NewspaperPageObject,
  NewspaperStoryPlacement,
  NewspaperStoryId,
  NewspaperStoryObject,
} from "@/types/document";
import { DEFAULT_PAGE_MASTER } from "@/types/page";

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const createDefaultDocumentMetadata = (
  overrides: Partial<NewspaperDocumentMetadata> = {},
): NewspaperDocumentMetadata => ({
  newspaperName: "THE CLIFF NEWS",
  edition: "National Edition",
  date: todayIsoDate(),
  language: "hi-IN",
  version: "1.0.0",
  ...overrides,
});

const createDefaultPageSettings = (): NonNullable<NewspaperPageObject["settings"]> => ({
  width: DEFAULT_PAGE_MASTER.width,
  height: DEFAULT_PAGE_MASTER.height,
  marginTop: DEFAULT_PAGE_MASTER.contentY,
  marginRight: DEFAULT_PAGE_MASTER.contentX,
  marginBottom: DEFAULT_PAGE_MASTER.footerHeight,
  marginLeft: DEFAULT_PAGE_MASTER.contentX,
  columns: DEFAULT_PAGE_MASTER.columns,
  gutter: DEFAULT_PAGE_MASTER.gutter,
  baselineGrid: {
    start: DEFAULT_PAGE_MASTER.contentY,
    increment: 12,
    color: "#8bbfd6",
    snap: true,
    opacity: 0.35,
    visible: true,
  },
  bleed: 0.125,
  safeArea: 0.25,
});

export const createEditionPage = ({
  id = createId("page"),
  pageNumber,
  stories = [],
  frameIds = [],
  pageType = "city",
  sectionName = "City",
  status = "draft",
  colorLabel = "none",
}: {
  id?: NewspaperPageId;
  pageNumber: number;
  pageType?: NewspaperPageObject["pageType"];
  sectionName?: string;
  status?: EditionPageStatus;
  colorLabel?: EditionPageColorLabel;
  stories?: NewspaperPageObject["stories"];
  frameIds?: NewspaperPageObject["frameIds"];
}): NewspaperPageObject => ({
  id,
  pageNumber,
  pageType,
  sectionName,
  status,
  colorLabel,
  locked: false,
  hidden: false,
  masterPageId: "master-a",
  masterOverrides: {},
  masterPage: DEFAULT_PAGE_MASTER,
  grid: {
    columns: DEFAULT_PAGE_MASTER.columns,
    gutter: DEFAULT_PAGE_MASTER.gutter,
  },
  guides: [],
  settings: createDefaultPageSettings(),
  frameIds,
  stories,
  advertisements: [],
  photos: [],
  notes: [],
  updatedAt: new Date().toISOString(),
});

export const createStoryObjectFromFrame = (
  frame: StoryFrame,
  metrics: NewspaperStoryObject["compositionMetrics"] = null,
): NewspaperStoryObject => ({
  id: frame.id,
  name: frame.name,
  category: frame.category,
  tags: frame.tags,
  status: frame.status,
  locked: frame.locked,
  hidden: frame.hidden,
  headline: cloneRichText(frame.articleData.headline),
  subheadline: cloneRichText(frame.articleData.subheadline),
  body: cloneRichText(frame.articleData.body),
  caption: {
    ...frame.articleData.caption,
    text: cloneRichText(frame.articleData.caption.text),
    creditText: cloneRichText(frame.articleData.caption.creditText),
  },
  photo: null,
  factBox: {
    ...frame.articleData.factBox,
    headline: cloneRichText(frame.articleData.factBox.headline),
    bullets: frame.articleData.factBox.bullets.map(cloneRichText),
  },
  pullQuote: {
    ...frame.articleData.pullQuote,
    text: cloneRichText(frame.articleData.pullQuote.text),
  },
  richText: {
    kicker: {
      ...frame.articleData.kicker,
      text: cloneRichText(frame.articleData.kicker.text),
    },
    strap: {
      ...frame.articleData.strap,
      text: cloneRichText(frame.articleData.strap.text),
    },
  },
  imageSettings: {
    imageEnabled: frame.imageEnabled,
    imageAlignment: frame.imageAlignment,
    imageColumnSpan: frame.imageColumnSpan,
    imageHeight: frame.imageHeight,
    imageHeightMode: frame.imageHeightMode,
    imageHeightPreset: frame.imageHeightPreset,
    imageHeightProtection: frame.imageHeightProtection,
    autoSizeImage: frame.autoSizeImage,
    imageWrapMode: frame.imageWrapMode,
    imageShapeType: frame.imageShapeType,
    imageShapePoints: frame.imageShapePoints,
    imageCrop: frame.imageCrop,
    wrapContourPoints: frame.wrapContourPoints,
    wrapTextOffset: frame.wrapTextOffset,
  },
  typography: {
    headlineFontSize: frame.headlineFontSize,
    subheadlineFontSize: frame.subheadlineFontSize,
    bodyFontSize: frame.bodyFontSize,
    headlineLineHeight: frame.headlineLineHeight,
    subheadlineLineHeight: frame.subheadlineLineHeight,
    bodyLineHeight: frame.bodyLineHeight,
    headlineLineHeightMode: frame.headlineLineHeightMode,
    subheadlineLineHeightMode: frame.subheadlineLineHeightMode,
    bodyLineHeightMode: frame.bodyLineHeightMode,
    headlineLeadingValue: frame.headlineLeadingValue,
    subheadlineLeadingValue: frame.subheadlineLeadingValue,
    bodyLeadingValue: frame.bodyLeadingValue,
    headlineWeight: frame.headlineWeight,
    subheadlineWeight: frame.subheadlineWeight,
    autoFitHeadline: frame.autoFitHeadline,
    autoBalanceHeadline: frame.autoBalanceHeadline,
    enableHyphenation: frame.enableHyphenation,
    forceFullWidthHeadlines: frame.forceFullWidthHeadlines,
    headlineLayoutMode: frame.headlineLayoutMode,
    universal: {
      ...frame.articleData.typography,
    },
  },
  editorialStyling: {
    editorialPreset: frame.articleData.editorialPreset,
    factBoxTheme: {
      ...frame.articleData.factBoxTheme,
    },
    pullQuoteTheme: {
      ...frame.articleData.pullQuoteTheme,
    },
    subheadlineBanner: {
      ...frame.articleData.subheadlineBanner,
    },
    containerStyles: normalizeContainerStyles(frame.articleData.containerStyles),
    badgeKickerEnabled: frame.articleData.badgeKickerEnabled,
  },
  byline: {
    author: frame.articleData.author,
    location: frame.articleData.location,
    agency: frame.articleData.agency,
  },
  columnCount: frame.articleData.columnCount,
  compositionMetrics: metrics,
});

export const createStoryPlacementFromFrame = (
  frame: StoryFrame,
  frameId = `${frame.id}-frame`,
): NewspaperStoryPlacement => ({
  id: frameId,
  storyId: frame.id,
  role: frame.role,
  priority: frame.priority,
  columnStart: frame.columnStart,
  columnSpan: frame.columnSpan,
  x: frame.x,
  y: frame.y,
  width: frame.width,
  height: frame.height,
});

export const createFrameObjectFromStoryFrame = (
  frame: StoryFrame,
  pageId: NewspaperPageId,
  frameId = `${frame.id}-frame`,
  zIndex = 0,
): NewspaperFrameObject => ({
  id: frameId,
  pageId,
  storyId: frame.id,
  frameType: "article",
  bounds: {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  },
  rotation: 0,
  zIndex,
  locked: Boolean(frame.locked),
  hidden: Boolean(frame.hidden),
  selected: false,
  geometry: {
    role: frame.role,
    priority: frame.priority,
    columnStart: frame.columnStart,
    columnSpan: frame.columnSpan,
  },
  style: {},
  containerStyle: {},
  frameStyle: {},
  baselineSettings: {
    enabled: true,
    start: 0,
    increment: frame.compositionSettings.baselineGridSize,
  },
  snapSettings: {
    snapToGrid: true,
    snapToGuides: true,
    snapToBaseline: true,
  },
  metadata: {
    name: frame.name,
    updatedAt: new Date().toISOString(),
  },
});

export const createStoryPlacementFromFrameObject = (
  frame: NewspaperFrameObject,
): NewspaperStoryPlacement | null => {
  if (!frame.storyId) {
    return null;
  }

  return {
    id: frame.id,
    storyId: frame.storyId,
    role: frame.geometry.role,
    priority: frame.geometry.priority ?? "secondary",
    columnStart: frame.geometry.columnStart ?? 1,
    columnSpan: frame.geometry.columnSpan ?? 1,
    x: frame.bounds.x,
    y: frame.bounds.y,
    width: frame.bounds.width,
    height: frame.bounds.height,
    locked: frame.locked,
    hidden: frame.hidden,
  };
};

const createFrameObjectFromPlacement = (
  placement: NewspaperStoryPlacement,
  pageId: NewspaperPageId,
  zIndex = 0,
): NewspaperFrameObject => ({
  id: placement.id,
  pageId,
  storyId: placement.storyId,
  frameType: "article",
  bounds: {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  },
  rotation: 0,
  zIndex,
  locked: false,
  hidden: false,
  selected: false,
  geometry: {
    role: placement.role,
    priority: placement.priority,
    columnStart: placement.columnStart,
    columnSpan: placement.columnSpan,
  },
  style: {},
  containerStyle: {},
  frameStyle: {},
  baselineSettings: {
    enabled: true,
    start: 0,
    increment: 12,
  },
  snapSettings: {
    snapToGrid: true,
    snapToGuides: true,
    snapToBaseline: true,
  },
  metadata: {
    updatedAt: new Date().toISOString(),
  },
});

export const getFramePlacementsForPage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
): NewspaperStoryPlacement[] => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return [];
  }

  const framePlacements = page.frameIds
    .map((frameId) => document.frames[frameId])
    .filter((frame): frame is NewspaperFrameObject => Boolean(frame))
    .sort((first, second) => first.zIndex - second.zIndex)
    .map(createStoryPlacementFromFrameObject)
    .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

  return framePlacements.length > 0 ? framePlacements : page.stories;
};

const createFrameSyncForPage = (
  document: NewspaperDocument,
  frames: StoryFrame[],
  pageId: NewspaperPageId,
) => {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  const existingFramesByStoryId = new Map(
    (page?.frameIds ?? [])
      .map((frameId) => document.frames[frameId])
      .filter((frame): frame is NewspaperFrameObject => Boolean(frame?.storyId))
      .map((frame) => [frame.storyId as NewspaperStoryId, frame]),
  );
  const nextFrameEntries = frames.map((frame, index) => {
    const existingFrame = existingFramesByStoryId.get(frame.id);
    const frameObject = createFrameObjectFromStoryFrame(
      frame,
      pageId,
      existingFrame?.id ?? `${frame.id}-frame`,
      index,
    );

    return [frameObject.id, frameObject] as const;
  });
  const frameIds = nextFrameEntries.map(([frameId]) => frameId);
  const placements = nextFrameEntries
    .map(([, frame]) => createStoryPlacementFromFrameObject(frame))
    .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

  return {
    frameIds,
    placements,
    framesById: Object.fromEntries(nextFrameEntries),
  };
};

export const createDocument = ({
  id = createId("document"),
  metadata = createDefaultDocumentMetadata(),
  pages = [createEditionPage({ pageNumber: 1 })],
  stories = {},
  frames = {},
  advertisements = {},
  masters = createDefaultMasterPages(),
  layers = createDefaultLayers(),
  pageTemplates = createDefaultPageTemplates(),
  styles = createDefaultStyleLibrary(),
  headerSystem,
}: Partial<NewspaperDocument> = {}): NewspaperDocument => ({
  id,
  metadata: {
    ...createDefaultDocumentMetadata(),
    ...metadata,
  },
  editionName: metadata.edition ?? "National Edition",
  editionDate: metadata.date ?? todayIsoDate(),
  publication: metadata.newspaperName ?? "THE CLIFF NEWS",
  pages: pages.map((page) => ({
    ...page,
    masterPageId: page.masterPageId === DEFAULT_PAGE_MASTER.id ? "master-a" : page.masterPageId ?? "master-a",
    masterOverrides: page.masterOverrides ?? {},
  })),
  masters,
  masterPages: [DEFAULT_PAGE_MASTER],
  stories,
  frames,
  assets: {},
  advertisements,
  layers,
  pageTemplates,
  styles: normalizeStyleLibrary(styles),
  headerSystem: normalizeHeaderSystemState(headerSystem, metadata, { enableDefaultHeader: true }),
  settings: {
    activePageId: pages[0]?.id,
    canvasMode: "single",
    pageManagerVisible: true,
  },
});

export const createDocumentFromStoryFrames = (
  frames: StoryFrame[],
  metadata: Partial<NewspaperDocumentMetadata> = {},
): NewspaperDocument => {
  const stories = Object.fromEntries(frames.map((frame) => [frame.id, createStoryObjectFromFrame(frame)]));
  const pageId = "page-1";
  const frameEntries = frames.map((frame, index) => {
    const frameObject = createFrameObjectFromStoryFrame(frame, pageId, `${frame.id}-frame`, index);

    return [frameObject.id, frameObject] as const;
  });
  const frameIds = frameEntries.map(([frameId]) => frameId);
  const placements = frameEntries
    .map(([, frame]) => createStoryPlacementFromFrameObject(frame))
    .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

  return createDocument({
    metadata: createDefaultDocumentMetadata(metadata),
    pages: [
      createEditionPage({
        id: pageId,
        pageNumber: 1,
        frameIds,
        stories: placements,
      }),
    ],
    stories,
    frames: Object.fromEntries(frameEntries),
  });
};

export const updateDocumentPageFromStoryFrames = (
  document: NewspaperDocument,
  frames: StoryFrame[],
  pageId = document.pages[0]?.id ?? "page-1",
): NewspaperDocument => {
  const stories = {
    ...document.stories,
    ...Object.fromEntries(frames.map((frame) => [frame.id, createStoryObjectFromFrame(frame)])),
  };
  const frameSync = createFrameSyncForPage(document, frames, pageId);
  const nextFrames = {
    ...document.frames,
    ...frameSync.framesById,
  };
  const pageExists = document.pages.some((page) => page.id === pageId);
  const pages = pageExists
    ? document.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              frameIds: frameSync.frameIds,
              stories: frameSync.placements,
              updatedAt: new Date().toISOString(),
            }
          : page,
      )
    : [
        ...document.pages,
        createEditionPage({
          id: pageId,
          pageNumber: document.pages.length + 1,
          frameIds: frameSync.frameIds,
          stories: frameSync.placements,
        }),
      ];

  return {
    ...document,
    pages,
    stories,
    frames: nextFrames,
  };
};

export const getStoryFramesForPage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  frameFactory: (story: NewspaperStoryObject, placement: NewspaperPageObject["stories"][number], document: NewspaperDocument) => StoryFrame,
): StoryFrame[] => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return [];
  }

  return getFramePlacementsForPage(document, pageId)
    .map((placement) => {
      const story = document.stories[placement.storyId];

      return story ? frameFactory(story, placement, document) : null;
    })
    .filter((frame): frame is StoryFrame => Boolean(frame));
};

export const duplicatePage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
): NewspaperDocument => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return document;
  }

  const sourceFrames = getFramePlacementsForPage(document, pageId)
    .map((placement, index) => createFrameObjectFromPlacement(placement, pageId, index));
  const nextPageNumber = document.pages.length + 1;
  const nextPageId = createId("page");
  const clonedFrameEntries = sourceFrames.map((frame, index) => {
    const nextFrame: NewspaperFrameObject = {
      ...frame,
      id: createId("frame"),
      pageId: nextPageId,
      selected: false,
      zIndex: index,
      metadata: {
        ...frame.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    return [nextFrame.id, nextFrame] as const;
  });
  const clonedPlacements = clonedFrameEntries
    .map(([, frame]) => createStoryPlacementFromFrameObject(frame))
    .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

  return {
    ...document,
    frames: {
      ...document.frames,
      ...Object.fromEntries(clonedFrameEntries),
    },
    pages: [
      ...document.pages,
      {
        ...page,
        id: nextPageId,
        pageNumber: nextPageNumber,
        status: "draft",
        locked: false,
        hidden: false,
        updatedAt: new Date().toISOString(),
        frameIds: clonedFrameEntries.map(([frameId]) => frameId),
        stories: clonedPlacements,
      },
    ],
    settings: {
      ...document.settings,
      activePageId: nextPageId,
    },
  };
};

export const addPage = (
  document: NewspaperDocument,
  insertIndex = document.pages.length,
): NewspaperDocument => {
  const boundedIndex = Math.min(Math.max(insertIndex, 0), document.pages.length);
  const page = createEditionPage({
    pageNumber: boundedIndex + 1,
    sectionName: "City",
  });
  const pages = [
    ...document.pages.slice(0, boundedIndex),
    page,
    ...document.pages.slice(boundedIndex),
  ].map((candidate, index) => ({
    ...candidate,
    pageNumber: index + 1,
  }));

  return {
    ...document,
    pages,
    settings: {
      ...document.settings,
      activePageId: page.id,
    },
  };
};

export const movePage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  toIndex: number,
): NewspaperDocument => {
  const fromIndex = document.pages.findIndex((page) => page.id === pageId);

  if (fromIndex < 0) {
    return document;
  }

  const pages = [...document.pages];
  const [page] = pages.splice(fromIndex, 1);
  const boundedIndex = Math.min(Math.max(toIndex, 0), pages.length);
  pages.splice(boundedIndex, 0, page);

  return {
    ...document,
    pages: pages.map((candidate, index) => ({
      ...candidate,
      pageNumber: index + 1,
    })),
  };
};

export const updatePageProperties = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  update: Partial<Pick<
    NewspaperPageObject,
    "pageType" | "sectionName" | "status" | "colorLabel" | "locked" | "hidden" | "masterPageId"
  >>,
): NewspaperDocument => ({
  ...document,
  pages: document.pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          ...update,
          updatedAt: new Date().toISOString(),
        }
      : page,
  ),
});

export const setDocumentCanvasMode = (
  document: NewspaperDocument,
  canvasMode: EditionCanvasMode,
): NewspaperDocument => ({
  ...document,
  settings: {
    ...document.settings,
    canvasMode,
  },
});

export const deletePage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
): NewspaperDocument => {
  if (document.pages.length <= 1) {
    return document;
  }

  const pages = document.pages
    .filter((page) => page.id !== pageId)
    .map((page, index) => ({
      ...page,
      pageNumber: index + 1,
    }));
  const deletedFrameIds = new Set(document.pages.find((page) => page.id === pageId)?.frameIds ?? []);
  const frames = Object.fromEntries(
    Object.entries(document.frames).filter(([frameId]) => !deletedFrameIds.has(frameId)),
  );

  return {
    ...document,
    pages,
    frames,
    settings: {
      ...document.settings,
      activePageId: pages[0]?.id,
    },
  };
};

export const moveStoryBetweenPages = ({
  document,
  storyId,
  fromPageId,
  toPageId,
}: {
  document: NewspaperDocument;
  storyId: NewspaperStoryId;
  fromPageId: NewspaperPageId;
  toPageId: NewspaperPageId;
}): NewspaperDocument => {
  const sourcePage = document.pages.find((page) => page.id === fromPageId);
  const sourceFrame = (sourcePage?.frameIds ?? [])
    .map((frameId) => document.frames[frameId])
    .find((frame) => frame?.storyId === storyId);

  if (sourceFrame) {
    const nextFrame: NewspaperFrameObject = {
      ...sourceFrame,
      pageId: toPageId,
      id: createId("frame"),
      selected: false,
      metadata: {
        ...sourceFrame.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    return {
      ...document,
      frames: {
        ...document.frames,
        [nextFrame.id]: nextFrame,
      },
      pages: document.pages.map((page) => {
        if (page.id === fromPageId) {
          const nextFrameIds = page.frameIds.filter((frameId) => frameId !== sourceFrame.id);
          const stories = nextFrameIds
            .map((frameId) => createStoryPlacementFromFrameObject(document.frames[frameId]))
            .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

          return {
            ...page,
            frameIds: nextFrameIds,
            stories,
          };
        }

        if (page.id === toPageId) {
          const nextFrameIds = [...page.frameIds, nextFrame.id];
          const stories = [
            ...nextFrameIds
              .map((frameId) =>
                frameId === nextFrame.id
                  ? createStoryPlacementFromFrameObject(nextFrame)
                  : createStoryPlacementFromFrameObject(document.frames[frameId]),
              )
              .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement)),
          ];

          return {
            ...page,
            frameIds: nextFrameIds,
            stories,
          };
        }

        return page;
      }),
    };
  }

  let movedPlacement: NewspaperPageObject["stories"][number] | null = null;
  const pages = document.pages.map((page) => {
    if (page.id !== fromPageId) {
      return page;
    }

    return {
      ...page,
      stories: page.stories.filter((placement) => {
        if (placement.storyId === storyId) {
          movedPlacement = placement;

          return false;
        }

        return true;
      }),
    };
  });

  if (!movedPlacement) {
    return document;
  }

  const placementToMove: NewspaperPageObject["stories"][number] = movedPlacement;

  return {
    ...document,
    pages: pages.map((page) =>
      page.id === toPageId
        ? {
            ...page,
            stories: [
              ...page.stories,
              {
                ...placementToMove,
                id: createId("placement"),
              },
            ],
          }
        : page,
    ),
  };
};

export const cloneStory = (
  document: NewspaperDocument,
  storyId: NewspaperStoryId,
): NewspaperDocument => {
  const story = document.stories[storyId];

  if (!story) {
    return document;
  }

  const clonedStoryId = createId("story");

  return {
    ...document,
    stories: {
      ...document.stories,
      [clonedStoryId]: {
        ...story,
        id: clonedStoryId,
      },
    },
  };
};

export const duplicateFrame = (
  document: NewspaperDocument,
  frameId: NewspaperFrameId,
): NewspaperDocument => {
  const frame = document.frames[frameId];

  if (!frame) {
    return document;
  }

  const nextFrame: NewspaperFrameObject = {
    ...frame,
    id: createId("frame"),
    bounds: {
      ...frame.bounds,
      x: frame.bounds.x + 12,
      y: frame.bounds.y + 12,
    },
    selected: false,
    zIndex: frame.zIndex + 1,
    metadata: {
      ...frame.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  return {
    ...document,
    frames: {
      ...document.frames,
      [nextFrame.id]: nextFrame,
    },
    pages: document.pages.map((page) => {
      if (page.id !== frame.pageId) {
        return page;
      }

      const frameIds = [...page.frameIds, nextFrame.id];
      const stories = frameIds
        .map((candidateFrameId) =>
          candidateFrameId === nextFrame.id
            ? createStoryPlacementFromFrameObject(nextFrame)
            : createStoryPlacementFromFrameObject(document.frames[candidateFrameId]),
        )
        .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

      return {
        ...page,
        frameIds,
        stories,
      };
    }),
  };
};

export const deleteFrame = (
  document: NewspaperDocument,
  frameId: NewspaperFrameId,
): NewspaperDocument => {
  const { [frameId]: removedFrame, ...frames } = document.frames;

  if (!removedFrame) {
    return document;
  }

  return {
    ...document,
    frames,
    pages: document.pages.map((page) => {
      if (page.id !== removedFrame.pageId) {
        return page;
      }

      const frameIds = page.frameIds.filter((candidateFrameId) => candidateFrameId !== frameId);
      const stories = frameIds
        .map((candidateFrameId) => createStoryPlacementFromFrameObject(frames[candidateFrameId]))
        .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));

      return {
        ...page,
        frameIds,
        stories,
      };
    }),
  };
};

export const createArticleDataFromStoryObject = (
  story: NewspaperStoryObject,
) => ({
  ...prototypeArticle,
  kicker: story.richText.kicker,
  strap: story.richText.strap,
  headline: story.headline,
  subheadline: story.subheadline,
  subheadlineBanner: story.editorialStyling.subheadlineBanner,
  author: story.byline.author,
  location: story.byline.location,
  agency: story.byline.agency,
  factBox: story.factBox,
  factBoxTheme: story.editorialStyling.factBoxTheme,
  pullQuote: story.pullQuote,
  pullQuoteTheme: story.editorialStyling.pullQuoteTheme,
  editorialPreset: story.editorialStyling.editorialPreset,
  typography: story.typography.universal,
  containerStyles: normalizeContainerStyles(story.editorialStyling.containerStyles),
  // Without this the badge flag would fall back to prototypeArticle (undefined)
  // on reload, so the accent would vanish from any page rendered from the
  // document — notably non-active pages during PDF export.
  badgeKickerEnabled: story.editorialStyling.badgeKickerEnabled,
  caption: story.caption,
  body: story.body,
  columnCount: story.columnCount,
});
