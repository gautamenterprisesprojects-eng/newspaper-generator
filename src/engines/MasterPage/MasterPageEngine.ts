import type {
  NewspaperDocument,
  NewspaperLayer,
  NewspaperMasterElement,
  NewspaperMasterPage,
  NewspaperMasterPageId,
  NewspaperPageId,
  NewspaperPageObject,
  NewspaperPageTemplate,
} from "@/types/document";
import type { PageType } from "@/types/page";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const now = () => new Date().toISOString();

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const MASTER_NONE_ID = "none";

export const createDefaultLayers = (): Record<string, NewspaperLayer> => {
  const layerData: Omit<NewspaperLayer, "zIndex">[] = [
    { id: "background", name: "Background", visible: true, locked: true, print: true, export: true, opacity: 1, color: "#8b8b8b" },
    { id: "master", name: "Master", visible: true, locked: true, print: true, export: true, opacity: 1, color: "#7c3aed" },
    { id: "editorial", name: "Editorial", visible: true, locked: false, print: true, export: true, opacity: 1, color: "#2563eb" },
    { id: "advertisement", name: "Advertisement", visible: true, locked: false, print: true, export: true, opacity: 1, color: "#737373" },
    { id: "graphics", name: "Graphics", visible: true, locked: false, print: true, export: true, opacity: 1, color: "#0f766e" },
    { id: "images", name: "Images", visible: true, locked: false, print: true, export: true, opacity: 1, color: "#15803d" },
    { id: "guides", name: "Guides", visible: true, locked: true, print: false, export: false, opacity: 0.75, color: "#57b7c8" },
    { id: "annotations", name: "Annotations", visible: true, locked: false, print: false, export: false, opacity: 1, color: "#d97706" },
  ];

  return Object.fromEntries(layerData.map((layer, index) => [layer.id, { ...layer, zIndex: index }]));
};

const createMasterElement = (
  id: string,
  type: NewspaperMasterElement["type"],
  name: string,
  bounds: NewspaperMasterElement["bounds"],
  content?: string,
  token?: NewspaperMasterElement["metadata"]["token"],
): NewspaperMasterElement => ({
  id,
  type,
  layerId: "master",
  bounds,
  locked: true,
  hidden: false,
  print: true,
  export: true,
  zIndex: 0,
  content,
  style: {},
  metadata: {
    name,
    token,
    createdAt: now(),
    updatedAt: now(),
  },
});

const createRunningElements = (prefix: string): NewspaperMasterElement[] => {
  const pageWidth = toPoints(DEFAULT_PAGE_MASTER.width);
  const pageHeight = toPoints(DEFAULT_PAGE_MASTER.height);
  const contentX = toPoints(DEFAULT_PAGE_MASTER.contentX);
  const headerHeight = toPoints(DEFAULT_PAGE_MASTER.headerHeight);
  const footerHeight = toPoints(DEFAULT_PAGE_MASTER.footerHeight);
  const contentWidth = toPoints(DEFAULT_PAGE_MASTER.contentWidth);

  return [
    createMasterElement(
      `${prefix}-masthead`,
      "masthead",
      "Masthead",
      { x: contentX, y: 12, width: contentWidth, height: 28 },
      "{{publication}}",
      "publication",
    ),
    createMasterElement(
      `${prefix}-running-header`,
      "running-header",
      "Running Header",
      { x: contentX, y: 4, width: contentWidth, height: 12 },
      "{{section}}  |  {{date}}  |  Page {{pageNumber}}",
      "section",
    ),
    createMasterElement(
      `${prefix}-page-footer`,
      "page-footer",
      "Running Footer",
      { x: contentX, y: pageHeight - footerHeight + 8, width: contentWidth, height: 18 },
      "www.thecliffnews.in  |  Page {{pageNumber}}",
      "pageNumber",
    ),
    createMasterElement(
      `${prefix}-top-rule`,
      "color-bar",
      "Header Rule",
      { x: contentX, y: headerHeight - 6, width: contentWidth, height: 1 },
    ),
    createMasterElement(
      `${prefix}-safe-area`,
      "guide-frame",
      "Safe Area",
      { x: contentX, y: headerHeight, width: pageWidth - contentX * 2, height: pageHeight - headerHeight - footerHeight },
    ),
  ];
};

export const createDefaultMasterPages = (): Record<string, NewspaperMasterPage> => {
  const masters = [
    { id: "master-a", name: "A-Master", prefix: "A", description: "Default city/news master" },
    { id: "master-b", name: "B-Master", prefix: "B", description: "Section feature master" },
    { id: "master-c", name: "C-Master", prefix: "C", description: "Ad-heavy page master" },
  ].map((master) => {
    const runningElements = createRunningElements(master.id);

    return {
      id: master.id,
      name: master.name,
      prefix: master.prefix,
      basedOnMasterId: null,
      frames: runningElements,
      guides: [
        { id: `${master.id}-margin-top`, y: toPoints(DEFAULT_PAGE_MASTER.contentY), label: "Top margin", kind: "margin", locked: true, visible: true },
        { id: `${master.id}-margin-left`, x: toPoints(DEFAULT_PAGE_MASTER.contentX), label: "Left margin", kind: "margin", locked: true, visible: true },
        { id: `${master.id}-safe-bottom`, y: toPoints(DEFAULT_PAGE_MASTER.height - DEFAULT_PAGE_MASTER.footerHeight), label: "Footer safe area", kind: "safe-area", locked: true, visible: true },
      ],
      layerIds: ["background", "master", "guides"],
      pageDecorations: runningElements.filter((element) => element.type === "color-bar" || element.type === "guide-frame"),
      runningElements,
      metadata: {
        description: master.description,
        createdAt: now(),
        updatedAt: now(),
      },
    } satisfies NewspaperMasterPage;
  });

  return Object.fromEntries(masters.map((master) => [master.id, master]));
};

export const createDefaultPageTemplates = (): Record<string, NewspaperPageTemplate> => {
  const pageTypes: PageType[] = ["front", "city", "national", "sports", "editorial"];

  return Object.fromEntries(
    pageTypes.map((pageType) => [
      `template-${pageType}`,
      {
        id: `template-${pageType}`,
        name: `${pageType[0].toUpperCase()}${pageType.slice(1)} Page`,
        pageType,
        masterId: pageType === "sports" ? "master-b" : "master-a",
        guides: [],
        columns: DEFAULT_PAGE_MASTER.columns,
        gutter: DEFAULT_PAGE_MASTER.gutter,
        margins: {
          top: DEFAULT_PAGE_MASTER.contentY,
          right: DEFAULT_PAGE_MASTER.contentX,
          bottom: DEFAULT_PAGE_MASTER.footerHeight,
          left: DEFAULT_PAGE_MASTER.contentX,
        },
        framePlaceholders: [],
      } satisfies NewspaperPageTemplate,
    ]),
  );
};

export const normalizeMasterArchitecture = (document: NewspaperDocument): NewspaperDocument => {
  const layers = Object.keys(document.layers ?? {}).length > 0 ? document.layers : createDefaultLayers();
  const masters = Object.keys(document.masters ?? {}).length > 0 ? document.masters : createDefaultMasterPages();
  const pageTemplates =
    Object.keys(document.pageTemplates ?? {}).length > 0 ? document.pageTemplates : createDefaultPageTemplates();
  const firstMasterId = Object.keys(masters)[0] ?? null;
  const pages = document.pages.map((page) => ({
    ...page,
    masterPageId: page.masterPageId && page.masterPageId !== DEFAULT_PAGE_MASTER.id ? page.masterPageId : firstMasterId ?? undefined,
    masterOverrides: page.masterOverrides ?? {},
    numbering: page.numbering ?? {
      style: "arabic",
      restartAt: null,
      prefix: "",
      sectionPrefix: page.sectionName ?? page.pageType,
    },
  }));

  return {
    ...document,
    layers,
    masters,
    pageTemplates,
    pages,
  };
};

export const getPageMaster = (
  document: NewspaperDocument,
  page: NewspaperPageObject | null | undefined,
): NewspaperMasterPage | null => {
  if (!page?.masterPageId || page.masterPageId === MASTER_NONE_ID) {
    return null;
  }

  return document.masters?.[page.masterPageId] ?? null;
};

export const getResolvedMasterElementsForPage = (
  document: NewspaperDocument,
  page: NewspaperPageObject | null | undefined,
): NewspaperMasterElement[] => {
  const master = getPageMaster(document, page);

  if (!master || !page) {
    return [];
  }

  const overrides = page.masterOverrides ?? {};

  return master.frames.map((element) => overrides[element.id] ?? element).filter((element) => !element.hidden);
};

export const applyMasterToPage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  masterId: NewspaperMasterPageId | null,
): NewspaperDocument => ({
  ...document,
  pages: document.pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          masterPageId: masterId ?? MASTER_NONE_ID,
          updatedAt: now(),
        }
      : page,
  ),
});

export const detachMasterFromPage = (document: NewspaperDocument, pageId: NewspaperPageId): NewspaperDocument =>
  applyMasterToPage(document, pageId, null);

export const applyMasterToPages = (
  document: NewspaperDocument,
  pageIds: NewspaperPageId[],
  masterId: NewspaperMasterPageId | null,
): NewspaperDocument => {
  const targets = new Set(pageIds);

  return {
    ...document,
    pages: document.pages.map((page) =>
      targets.has(page.id)
        ? {
            ...page,
            masterPageId: masterId ?? MASTER_NONE_ID,
            updatedAt: now(),
          }
        : page,
    ),
  };
};

export const createMasterPage = (
  document: NewspaperDocument,
  name = "New Master",
): NewspaperDocument => {
  const prefix = String.fromCharCode(65 + Object.keys(document.masters ?? {}).length);
  const id = createId("master");
  const master: NewspaperMasterPage = {
    id,
    name,
    prefix,
    basedOnMasterId: null,
    frames: createRunningElements(id),
    guides: [],
    layerIds: ["background", "master", "guides"],
    pageDecorations: [],
    runningElements: [],
    metadata: {
      createdAt: now(),
      updatedAt: now(),
    },
  };

  return {
    ...document,
    masters: {
      ...(document.masters ?? {}),
      [id]: master,
    },
  };
};

export const duplicateMasterPage = (
  document: NewspaperDocument,
  masterId: NewspaperMasterPageId,
): NewspaperDocument => {
  const master = document.masters?.[masterId];

  if (!master) {
    return document;
  }

  const id = createId("master");
  const nextMaster: NewspaperMasterPage = {
    ...master,
    id,
    name: `${master.name} Copy`,
    prefix: `${master.prefix}2`,
    frames: master.frames.map((element) => ({
      ...element,
      id: `${id}-${element.type}-${createId("element").slice(-6)}`,
      metadata: {
        ...element.metadata,
        updatedAt: now(),
      },
    })),
    metadata: {
      ...master.metadata,
      createdAt: now(),
      updatedAt: now(),
    },
  };

  return {
    ...document,
    masters: {
      ...document.masters,
      [id]: nextMaster,
    },
  };
};

export const renameMasterPage = (
  document: NewspaperDocument,
  masterId: NewspaperMasterPageId,
  name: string,
): NewspaperDocument => {
  const master = document.masters?.[masterId];

  if (!master) {
    return document;
  }

  return {
    ...document,
    masters: {
      ...document.masters,
      [masterId]: {
        ...master,
        name,
        metadata: {
          ...master.metadata,
          updatedAt: now(),
        },
      },
    },
  };
};

export const deleteMasterPage = (
  document: NewspaperDocument,
  masterId: NewspaperMasterPageId,
): NewspaperDocument => {
  const entries = Object.entries(document.masters ?? {});

  if (entries.length <= 1 || !document.masters?.[masterId]) {
    return document;
  }

  const masters = Object.fromEntries(entries.filter(([id]) => id !== masterId));

  return {
    ...document,
    masters,
    pages: document.pages.map((page) =>
      page.masterPageId === masterId
        ? {
            ...page,
            masterPageId: MASTER_NONE_ID,
            updatedAt: now(),
          }
        : page,
    ),
  };
};

export const overrideMasterElementOnPage = (
  document: NewspaperDocument,
  pageId: NewspaperPageId,
  elementId: string,
): NewspaperDocument => {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  const master = getPageMaster(document, page);
  const element = master?.frames.find((candidate) => candidate.id === elementId);

  if (!page || !element) {
    return document;
  }

  return {
    ...document,
    pages: document.pages.map((candidate) =>
      candidate.id === pageId
        ? {
            ...candidate,
            masterOverrides: {
              ...(candidate.masterOverrides ?? {}),
              [elementId]: {
                ...element,
                locked: false,
                metadata: {
                  ...element.metadata,
                  name: `${element.metadata.name} Override`,
                  updatedAt: now(),
                },
              },
            },
            updatedAt: now(),
          }
        : candidate,
    ),
  };
};

export const getMasterBadgeForPage = (
  document: NewspaperDocument,
  page: NewspaperPageObject,
) => {
  const master = getPageMaster(document, page);

  return master?.prefix ?? "None";
};

export const formatPageNumber = (page: NewspaperPageObject) => {
  const numbering = page.numbering ?? { style: "arabic" as const };
  const value = numbering.restartAt ?? page.pageNumber;

  if (numbering.style === "roman") {
    const numerals: [number, string][] = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let remaining = value;
    let output = "";

    for (const [amount, glyph] of numerals) {
      while (remaining >= amount) {
        output += glyph;
        remaining -= amount;
      }
    }

    return `${numbering.prefix ?? ""}${output}`;
  }

  if (numbering.style === "alphabetic") {
    return `${numbering.prefix ?? ""}${String.fromCharCode(64 + Math.max(1, Math.min(26, value)))}`;
  }

  return `${numbering.prefix ?? ""}${value}`;
};
