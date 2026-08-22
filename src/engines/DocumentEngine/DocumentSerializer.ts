import type { NewspaperDocument } from "@/types/document";
import {
  createDocument,
  createEditionPage,
  createStoryPlacementFromFrameObject,
} from "./DocumentEngine";
import { normalizeMasterArchitecture } from "@/engines/MasterPage/MasterPageEngine";
import { normalizeStyleLibrary } from "@/engines/StyleManager/StyleManagerEngine";
import { normalizeHeaderSystemState } from "@/engines/HeaderSystem";
import type { NewspaperFrameObject, NewspaperStoryPlacement } from "@/types/document";

export const DOCUMENT_SERIALIZER_VERSION = "ndm-1";

export type SerializedNewspaperDocument = {
  serializerVersion: typeof DOCUMENT_SERIALIZER_VERSION;
  document: NewspaperDocument;
};

export const saveDocument = (document: NewspaperDocument): string =>
  JSON.stringify(
    {
      serializerVersion: DOCUMENT_SERIALIZER_VERSION,
      document,
    } satisfies SerializedNewspaperDocument,
    null,
    2,
  );

export const parseDocumentPayload = (payload: string): SerializedNewspaperDocument => {
  const parsed = JSON.parse(payload) as Partial<SerializedNewspaperDocument>;

  if (parsed.serializerVersion !== DOCUMENT_SERIALIZER_VERSION || !parsed.document) {
    throw new Error("Unsupported Newspaper Document payload.");
  }

  return {
    serializerVersion: DOCUMENT_SERIALIZER_VERSION,
    document: normalizeLoadedDocument(parsed.document as NewspaperDocument),
  };
};

export const normalizeLoadedDocument = (document: NewspaperDocument): NewspaperDocument => {
  const fallback = createDocument({
    id: document.id,
    metadata: document.metadata,
    stories: document.stories ?? {},
  });
  const sourceFrames = document.frames ?? {};
  const migratedFrames: Record<string, NewspaperFrameObject> = { ...sourceFrames };
  const pages =
    document.pages?.map((page, index) => {
      const legacyPlacements = page.stories ?? [];
      const frameIds =
        page.frameIds && page.frameIds.length > 0
          ? page.frameIds
          : legacyPlacements.map((placement, placementIndex) => {
              const frameId = placement.id || `${placement.storyId}-frame`;

              if (!migratedFrames[frameId]) {
                migratedFrames[frameId] = {
                  id: frameId,
                  pageId: page.id,
                  storyId: placement.storyId,
                  frameType: "article",
                  bounds: {
                    x: placement.x,
                    y: placement.y,
                    width: placement.width,
                    height: placement.height,
                  },
                  rotation: 0,
                  zIndex: placementIndex,
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
                };
              }

              return frameId;
            });
      const stories = frameIds
        .map((frameId) => createStoryPlacementFromFrameObject(migratedFrames[frameId]))
        .filter((placement): placement is NewspaperStoryPlacement => Boolean(placement));
      const fallbackPage = createEditionPage({
        id: page.id,
        pageNumber: page.pageNumber ?? index + 1,
        pageType: page.pageType ?? "city",
        sectionName: page.sectionName ?? page.pageType ?? "City",
        status: page.status ?? "draft",
        colorLabel: page.colorLabel ?? "none",
        frameIds,
        stories,
      });

      return {
        ...fallbackPage,
        ...page,
        pageNumber: index + 1,
        frameIds,
        stories,
        masterOverrides: page.masterOverrides ?? {},
        numbering: page.numbering ?? fallbackPage.numbering,
        settings: page.settings ?? fallbackPage.settings,
        grid: page.grid ?? fallbackPage.grid,
        masterPage: page.masterPage ?? fallbackPage.masterPage,
        guides: page.guides ?? [],
        advertisements: page.advertisements ?? [],
        photos: page.photos ?? [],
        notes: page.notes ?? [],
      };
    }) ?? fallback.pages;

  return normalizeMasterArchitecture({
    ...fallback,
    ...document,
    editionName: document.editionName ?? document.metadata.edition,
    editionDate: document.editionDate ?? document.metadata.date,
    publication: document.publication ?? document.metadata.newspaperName,
    pages,
    masterPages: document.masterPages ?? fallback.masterPages,
    frames: migratedFrames,
    assets: document.assets ?? {},
    advertisements: document.advertisements ?? fallback.advertisements,
    masters: document.masters ?? fallback.masters,
    layers: document.layers ?? fallback.layers,
    pageTemplates: document.pageTemplates ?? fallback.pageTemplates,
    styles: normalizeStyleLibrary(document.styles ?? fallback.styles),
    headerSystem: normalizeHeaderSystemState(document.headerSystem, document.metadata, {
      enableDefaultHeader: Boolean(document.headerSystem?.activeHeaderSetId),
    }),
    settings: {
      ...fallback.settings,
      ...document.settings,
      activePageId: document.settings?.activePageId ?? pages[0]?.id,
    },
  });
};
