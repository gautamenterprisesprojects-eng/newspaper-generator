"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Box,
  BringToFront,
  Captions,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Group,
  Layers,
  Link,
  Lock,
  MessageSquare,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  Search,
  DownloadCloud,
  SendToBack,
  Signature,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  X,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  getMasterBadgeForPage,
  getResolvedMasterElementsForPage,
} from "@/engines/MasterPage/MasterPageEngine";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import {
  calculateFrameManagerStatus,
  calculateFrameManagerVirtualRange,
  createFrameManagerGroups,
  filterFrameManagerGroups,
  flattenFrameManagerCards,
  frameTypeLabels,
} from "@/engines/FrameManager/FrameManagerEngine";
import type { FrameLayerAction, FrameManagerCard, FrameManagerFilter } from "@/engines/FrameManager/FrameManagerTypes";
import type {
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperFrameType,
  NewspaperMasterElementId,
  NewspaperMasterPageId,
  NewspaperPageId,
} from "@/types/document";
import type { EditorObjectType, EditorialTextAlignment } from "@/types/editor";
import {
  NEWSWIRE_CATEGORIES,
  NEWSWIRE_SUBHEADING_PRESETS,
  getPaletteInlineAccent,
  getPaletteSubheadingStyle,
  getPaletteTintColor,
  type NewswireCategory,
  type NewswireSubheadingPreset,
  type NewswireSubheadingPresetId,
  type NewswireStory,
} from "@/lib/newswire";
import {
  buildEditorialHealthStory,
  buildEditorialStory,
  buildEditorialStories,
  getHealthSlotIndex,
  getRashifalSlotIndex,
  getTemplateColumnSpans,
  type EditorialFeedRecord,
  type RashifalRecord,
} from "@/lib/editorialNewswire";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";

const ROW_HEIGHT = 32;
const VIEWPORT_HEIGHT = 430;
const EXPANSION_STORAGE_KEY = "cliff-newspaper-frame-tree-expanded";
const OBJECT_META_STORAGE_KEY = "cliff-newspaper-frame-tree-object-meta";
const OBJECT_ORDER_STORAGE_KEY = "cliff-newspaper-frame-tree-object-order";
const EDITORIAL_TEMPLATE_ID: TemplateId = "CliffEditorial8A";

type NewswirePanelImportOptions = {
  colouredHeadings?: boolean;
  tintedStoryBackground?: boolean;
  tintColor?: string;
  inlineColumnSubheadings?: boolean;
  inlineSubheadingColor?: string;
  palettePreset?: NewswireSubheadingPreset;
  subheadingStyle: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    backgroundOpacity: number;
  };
  headlineAlignment?: Exclude<EditorialTextAlignment, "justify">;
  bodyAlignment?: EditorialTextAlignment;
  languageMode?: "hindi" | "english" | "bilingual";
  pageKind?: "front" | "inside" | "editorial";
  templateId?: TemplateId;
};

type FrameManagerPanelProps = {
  document: NewspaperDocument;
  activePageId: NewspaperPageId;
  selectedFrameId: NewspaperFrameId | null;
  selectedFrameIds: NewspaperFrameId[];
  selectedObjectType: EditorObjectType;
  contentMode: boolean;
  onSelectPage: (pageId: NewspaperPageId) => void;
  onSelectFrame: (frameId: NewspaperFrameId, additive?: boolean) => void;
  onSelectObject: (frameId: NewspaperFrameId, objectType: EditorObjectType, additive?: boolean) => void;
  onZoomToFrame: (frameId: NewspaperFrameId) => void;
  onRenameFrame: (frameId: NewspaperFrameId, name: string) => void;
  onSetFrameLocked: (frameId: NewspaperFrameId, locked: boolean) => void;
  onSetFrameHidden: (frameId: NewspaperFrameId, hidden: boolean) => void;
  onReorderFrame: (frameId: NewspaperFrameId, action: FrameLayerAction) => void;
  onMoveFrameBefore: (sourceFrameId: NewspaperFrameId, targetFrameId: NewspaperFrameId) => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onGroupFrames: () => void;
  onUngroupFrames: () => void;
  onSoloFrame: (frameId: NewspaperFrameId) => void;
  onAddPage: (position?: "end" | "before" | "after") => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  onMovePage: (direction: "up" | "down") => void;
  onCreateMaster: () => void;
  onDuplicateMaster: (masterId: NewspaperMasterPageId) => void;
  onRenameMaster: (masterId: NewspaperMasterPageId, name: string) => void;
  onDeleteMaster: (masterId: NewspaperMasterPageId) => void;
  onApplyMasterToActivePage: (masterId: NewspaperMasterPageId | null) => void;
  onDetachActivePageMaster: () => void;
  onOverrideMasterElement: (elementId: NewspaperMasterElementId) => void;
  onImportNewswireStories: (
    category: string,
    articles: NewswireStory[],
    options: NewswirePanelImportOptions,
  ) => void;
  onReplaceStoryArticle: (
    storyId: string,
    article: NewswireStory,
    options: NewswirePanelImportOptions,
  ) => void;
  compactPublisherMode?: boolean;
};

type NewswireRouteResponse = {
  success: boolean;
  data?: NewswireStory[];
  error?: string;
  meta?: {
    count?: number;
  };
};

type EditorialRouteResponse = {
  success?: boolean;
  articles?: EditorialFeedRecord[];
  rashifal?: RashifalRecord[];
  health?: EditorialFeedRecord[];
  error?: string;
};

type ReplacementManualEntry = {
  place: string;
  headline: string;
  subheadline: string;
  body: string;
  imageUrl: string;
  imageCaption: string;
};

const emptyReplacementManualEntry = (): ReplacementManualEntry => ({
  place: "",
  headline: "",
  subheadline: "",
  body: "",
  imageUrl: "",
  imageCaption: "",
});

const countArticleWords = (value: string) => value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

const getWordRangeText = (min: number, max: number) => `${min}-${max}`;

const getManualFieldStatusClass = (count: number, min: number, max: number) => {
  if (count === 0) return "manual-box-fit-hint";
  if (count < min || count > max) return "manual-box-fit-bad";
  return "manual-box-fit-ok";
};

const estimateManualBodyWordRange = (card: FrameManagerCard | null, hasImage: boolean) => {
  if (!card) return { min: 120, max: 180 };

  const { width, height } = card.frame.bounds;
  const usableArea = Math.max(1, width * height);
  const imageFactor = hasImage ? 0.72 : 0.92;
  const estimated = Math.round((usableArea / 430) * imageFactor);
  const min = Math.max(35, Math.round(estimated * 0.76));
  const max = Math.max(min + 20, Math.round(estimated * 1.18));

  return { min, max };
};

const estimateManualHeadlineWordRange = (card: FrameManagerCard | null) => {
  const columnSpan = card?.frame.geometry.columnSpan ?? 2;
  const min = Math.max(3, Math.round(columnSpan * 2));
  const max = Math.max(min + 4, Math.round(columnSpan * 4.2));
  return { min, max };
};

const estimateManualSubheadlineWordRange = (card: FrameManagerCard | null) => {
  const columnSpan = card?.frame.geometry.columnSpan ?? 2;
  const min = Math.max(6, Math.round(columnSpan * 3));
  const max = Math.max(min + 6, Math.round(columnSpan * 6.5));
  return { min, max };
};

const replacementEntryToStory = (
  entry: ReplacementManualEntry,
  slotNumber: number,
): NewswireStory => {
  const headline = entry.headline.trim();
  const subheadline = entry.subheadline.trim();
  const body = entry.body.trim();
  const place = entry.place.trim();
  const imageUrl = entry.imageUrl.trim();
  const imageCaption = entry.imageCaption.trim();
  const localized = {
    headline,
    kicker: "",
    subheadings: [],
    subheadline,
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    caption: imageCaption,
    imageCaption,
    place,
    imageUrl,
    sourceUrl: "",
    category: "Manual",
  };

  return {
    id: `manual-replace-${slotNumber}-${Date.now()}`,
    category: "Manual",
    headline,
    subheadline,
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    summary: [],
    caption: imageCaption,
    imageUrl,
    imageCaption,
    place,
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
    manualPinned: true,
    manualTargetSlotIndex: Math.max(0, slotNumber - 1),
    localized: {
      hindi: { ...localized, language: "hindi" },
      english: { ...localized, language: "english" },
    },
  } as NewswireStory;
};

type TreeNode =
  | {
      kind: "edition";
      id: string;
      depth: number;
      label: string;
      detail: string;
      count: number;
      expanded: boolean;
    }
  | {
      kind: "page";
      id: string;
      pageId: NewspaperPageId;
      depth: number;
      label: string;
      detail: string;
      count: number;
      expanded: boolean;
    }
  | {
      kind: "story";
      id: string;
      frameId: NewspaperFrameId;
      depth: number;
      label: string;
      detail: string;
      count: number;
      expanded: boolean;
      matched: boolean;
      card: FrameManagerCard;
    }
  | {
      kind: "frame";
      id: string;
      frameId: NewspaperFrameId;
      depth: number;
      card: FrameManagerCard;
      objectType?: EditorObjectType;
      displayName?: string;
      displayType?: LayerDisplayType;
      locked?: boolean;
      hidden?: boolean;
      matched?: boolean;
    };

type LayerDisplayType =
  | NewspaperFrameType
  | "kicker"
  | "strap"
  | "byline"
  | "location"
  | "body"
  | "credit"
  | "source"
  | "story";

const layerTypeColors: Record<LayerDisplayType, string> = {
  article: "#52616f",
  story: "#52616f",
  kicker: "#2563eb",
  headline: "#2563eb",
  subheadline: "#3b82f6",
  strap: "#0f766e",
  byline: "#0f766e",
  location: "#0f766e",
  body: "#6b7280",
  image: "#15803d",
  caption: "#d97706",
  credit: "#8b5e34",
  source: "#8b5e34",
  "fact-box": "#7c3aed",
  "pull-quote": "#dc2626",
  graphic: "#0f766e",
  advertisement: "#ca8a04",
  table: "#475569",
  custom: "#52525b",
};

const layerLabels: Record<LayerDisplayType, string> = {
  article: "Story",
  story: "Story",
  kicker: "Kicker",
  headline: "Headline",
  subheadline: "Subheadline",
  strap: "Strap",
  byline: "Byline",
  location: "Location",
  body: "Body",
  image: "Image",
  caption: "Caption",
  credit: "Image Credit",
  source: "Source",
  "fact-box": "Fact Box",
  "pull-quote": "Pull Quote",
  graphic: "Graphic",
  advertisement: "Advertisement",
  table: "Table",
  custom: "Custom",
};

type ObjectTreeMeta = {
  name?: string;
  locked?: boolean;
  hidden?: boolean;
};

type ObjectMetaMap = Record<string, ObjectTreeMeta>;
type ObjectOrderMap = Record<string, LayerDisplayType[]>;

const defaultStoryObjectOrder: LayerDisplayType[] = [
  "headline",
  "subheadline",
  "kicker",
  "strap",
  "byline",
  "location",
  "image",
  "caption",
  "credit",
  "source",
  "body",
  "pull-quote",
  "fact-box",
];

const layerTypeToObjectType: Partial<Record<LayerDisplayType, EditorObjectType>> = {
  headline: "headline",
  subheadline: "subheadline",
  kicker: "kicker",
  strap: "strap",
  byline: "byline",
  location: "location",
  image: "image",
  caption: "caption",
  credit: "credit",
  source: "source",
  body: "body",
  "pull-quote": "pullQuote",
  "fact-box": "factBox",
  advertisement: "advertisement",
};

const objectTypeToLayerType: Partial<Record<EditorObjectType, LayerDisplayType>> = {
  headline: "headline",
  subheadline: "subheadline",
  kicker: "kicker",
  strap: "strap",
  byline: "byline",
  location: "location",
  image: "image",
  caption: "caption",
  credit: "credit",
  source: "source",
  body: "body",
  pullQuote: "pull-quote",
  factBox: "fact-box",
  advertisement: "advertisement",
};

const getObjectMetaKey = (frameId: NewspaperFrameId, type: LayerDisplayType) => `${frameId}:${type}`;

const readStoredSet = (fallback: Set<string>) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(EXPANSION_STORAGE_KEY);

  if (!stored) {
    return fallback;
  }

  try {
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return fallback;
  }
};

const readStoredObjectMeta = (): ObjectMetaMap => {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(OBJECT_META_STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as ObjectMetaMap;
  } catch {
    return {};
  }
};

const readStoredObjectOrder = (): ObjectOrderMap => {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(OBJECT_ORDER_STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as ObjectOrderMap;
  } catch {
    return {};
  }
};

const frameIcon = (type: LayerDisplayType) => {
  if (type === "headline" || type === "subheadline") {
    return <Type size={13} />;
  }

  if (type === "body") {
    return <Pilcrow size={13} />;
  }

  if (type === "byline" || type === "strap" || type === "location") {
    return <Signature size={13} />;
  }

  if (type === "image") {
    return <FileImage size={13} />;
  }

  if (type === "source") {
    return <Link size={13} />;
  }

  if (type === "caption" || type === "credit") {
    return <Captions size={13} />;
  }

  if (type === "fact-box") {
    return <Box size={13} />;
  }

  if (type === "pull-quote") {
    return <Quote size={13} />;
  }

  if (type === "advertisement") {
    return <Box size={13} />;
  }

  return <FileText size={13} />;
};

const createTreeNodes = ({
  editionName,
  pageGroups,
  collapsedNodes,
  frameTypeFilter,
  query,
  selectedObjectType,
  objectMeta,
  objectOrder,
}: {
  editionName: string;
  pageGroups: ReturnType<typeof createFrameManagerGroups>;
  collapsedNodes: Set<string>;
  frameTypeFilter: FrameManagerFilter["frameType"];
  query: string;
  selectedObjectType: EditorObjectType;
  objectMeta: ObjectMetaMap;
  objectOrder: ObjectOrderMap;
}): TreeNode[] => {
  const editionExpanded = !collapsedNodes.has("edition");
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (values: string[]) =>
    !normalizedQuery || values.some((value) => value.toLowerCase().includes(normalizedQuery));
  const isQueryMatch = (values: string[]) =>
    Boolean(normalizedQuery && values.some((value) => value.toLowerCase().includes(normalizedQuery)));
  const matchesType = (type: LayerDisplayType) =>
    frameTypeFilter === "all" || frameTypeFilter === type;
  const frameCount = pageGroups.reduce((sum, page) => sum + page.cards.length, 0);
  const nodes: TreeNode[] = [
    {
      kind: "edition",
      id: "edition",
      depth: 0,
      label: editionName,
      detail: "Frame tree",
      count: frameCount,
      expanded: editionExpanded,
    },
  ];

  if (!editionExpanded) {
    return nodes;
  }

  for (const page of pageGroups) {
    const pageNodeId = `page-${page.pageId}`;
    const pageExpanded = !collapsedNodes.has(pageNodeId);

    nodes.push({
      kind: "page",
      id: pageNodeId,
      pageId: page.pageId,
      depth: 1,
      label: `Page ${page.pageNumber}`,
      detail: page.sectionName,
      count: page.cards.length,
      expanded: pageExpanded,
    });

    if (!pageExpanded) {
      continue;
    }

    for (const card of page.cards) {
      if (card.frameType === "article") {
        const storyNodeId = `story-${card.frameId}`;
        const storyExpanded = !collapsedNodes.has(storyNodeId);
        const allChildTypes = objectOrder[card.frameId] ?? defaultStoryObjectOrder;
        const storyMatches = matchesQuery([card.storyName, card.frameName]);
        const childTypes = allChildTypes.filter(
          (type) => {
            const meta = objectMeta[getObjectMetaKey(card.frameId, type)];
            const displayName = meta?.name ?? layerLabels[type];

            return matchesType(type) && (storyMatches || matchesQuery([displayName, layerLabels[type], card.storyName]));
          },
        );

        if (childTypes.length === 0 && !storyMatches) {
          continue;
        }

        nodes.push({
          kind: "story",
          id: storyNodeId,
          frameId: card.frameId,
          depth: 2,
          label: card.storyName || "Untitled Story",
          detail: `Layer ${card.zIndex}`,
          count: childTypes.length,
          expanded: storyExpanded,
          matched: isQueryMatch([card.storyName, card.frameName]),
          card,
        });

        if (!storyExpanded) {
          continue;
        }

        for (const type of childTypes) {
          const meta = objectMeta[getObjectMetaKey(card.frameId, type)];
          const objectType = layerTypeToObjectType[type];
          nodes.push({
            kind: "frame",
            id: `frame-${card.frameId}-${type}`,
            frameId: card.frameId,
            depth: 3,
            card,
            objectType,
            displayName: meta?.name ?? layerLabels[type],
            displayType: type,
            locked: Boolean(meta?.locked),
            hidden: Boolean(meta?.hidden),
            matched: isQueryMatch([meta?.name ?? "", layerLabels[type], card.storyName]),
          });
        }

        continue;
      }

      if (!matchesType(card.frameType) || !matchesQuery([layerLabels[card.frameType], card.storyName, card.frameName])) {
        continue;
      }

      nodes.push({
        kind: "frame",
        id: `frame-${card.frameId}`,
        frameId: card.frameId,
        depth: 2,
        card,
        displayName: layerLabels[card.frameType],
        displayType: card.frameType,
        matched: isQueryMatch([layerLabels[card.frameType], card.storyName, card.frameName]),
      });
    }
  }

  return nodes;
};

const TreeRow = memo(function TreeRow({
  node,
  activePageId,
  contentMode,
  selectedObjectType,
  onToggle,
  onSelectPage,
  onSelectFrame,
  onSelectObject,
  onZoomToFrame,
  onMoveFrameBefore,
  onMoveObjectBefore,
  onRenameObject,
  onSetObjectLocked,
  onSetObjectHidden,
  onSoloObject,
  onContextMenu,
}: {
  node: TreeNode;
  activePageId: NewspaperPageId;
  contentMode: boolean;
  selectedObjectType: EditorObjectType;
  onToggle: (nodeId: string) => void;
  onSelectPage: (pageId: NewspaperPageId) => void;
  onSelectFrame: (frameId: NewspaperFrameId, additive: boolean) => void;
  onSelectObject: (frameId: NewspaperFrameId, objectType: EditorObjectType, additive: boolean) => void;
  onZoomToFrame: (frameId: NewspaperFrameId) => void;
  onMoveFrameBefore: (sourceFrameId: NewspaperFrameId, targetFrameId: NewspaperFrameId) => void;
  onMoveObjectBefore: (
    sourceFrameId: NewspaperFrameId,
    sourceType: LayerDisplayType,
    targetFrameId: NewspaperFrameId,
    targetType: LayerDisplayType,
  ) => void;
  onRenameObject: (frameId: NewspaperFrameId, type: LayerDisplayType) => void;
  onSetObjectLocked: (frameId: NewspaperFrameId, type: LayerDisplayType, locked: boolean) => void;
  onSetObjectHidden: (frameId: NewspaperFrameId, type: LayerDisplayType, hidden: boolean) => void;
  onSoloObject: (frameId: NewspaperFrameId, type: LayerDisplayType) => void;
  onContextMenu: (frameId: NewspaperFrameId, x: number, y: number) => void;
}) {
  if (node.kind !== "frame") {
    const active = node.kind === "page" && node.pageId === activePageId;
    const selected = node.kind === "story" && node.card.selected;
    const hidden = node.kind === "story" && node.card.hidden;
    const matched = node.kind === "story" && node.matched;

    return (
      <button
        type="button"
        role="treeitem"
        aria-expanded={node.expanded}
        className={`frame-tree-row frame-tree-${node.kind}${active ? " active" : ""}${selected ? " selected" : ""}${hidden ? " hidden" : ""}${matched ? " matched" : ""}`}
        style={{ paddingLeft: 8 + node.depth * 16 }}
        title={node.kind === "story" ? node.label : undefined}
        onClick={(event) => {
          if (node.kind === "page") {
            onSelectPage(node.pageId);
          } else if (node.kind === "story") {
            onSelectFrame(node.frameId, event.shiftKey || event.ctrlKey || event.metaKey);
          }
          onToggle(node.id);
        }}
      >
        <span
          className="frame-tree-strip"
          style={node.kind === "story" ? { backgroundColor: layerTypeColors.story } : undefined}
        />
        <span className="frame-tree-expander">
          {node.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="frame-tree-title">{node.label}</span>
        <span className="frame-tree-detail">{node.detail}</span>
        <span className="frame-tree-count">{node.count}</span>
      </button>
    );
  }

  const card = node.card;
  const displayType = node.displayType ?? card.frameType;
  const displayName = node.displayName ?? layerLabels[displayType];
  const isObjectRow = Boolean(node.objectType);
  const rowSelected = isObjectRow
    ? contentMode && card.selected && node.objectType === selectedObjectType
    : card.selected;
  const rowHidden = isObjectRow ? Boolean(node.hidden) : card.hidden;
  const rowLocked = isObjectRow ? Boolean(node.locked) : card.locked;

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={rowSelected}
      className={`frame-tree-row frame-tree-frame${rowSelected ? " selected" : ""}${rowHidden ? " hidden" : ""}${node.matched ? " matched" : ""}`}
      style={{ paddingLeft: 8 + node.depth * 16, color: layerTypeColors[displayType] }}
      draggable
      onClick={(event) => {
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;

        if (node.objectType) {
          onSelectObject(card.frameId, node.objectType, additive);
        } else {
          onSelectFrame(card.frameId, additive);
        }
      }}
      onDoubleClick={() => {
        if (isObjectRow) {
          onRenameObject(card.frameId, displayType);
          return;
        }

        onZoomToFrame(card.frameId);
      }}
      title={card.storyName}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(card.frameId, event.clientX, event.clientY);
      }}
      onDragStart={(event) => {
        if (isObjectRow) {
          event.dataTransfer.setData(
            "application/x-frame-object",
            JSON.stringify({ frameId: card.frameId, type: displayType }),
          );
        } else {
          event.dataTransfer.setData("text/frame-id", card.frameId);
        }
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const objectPayload = event.dataTransfer.getData("application/x-frame-object");

        if (objectPayload && isObjectRow) {
          try {
            const parsed = JSON.parse(objectPayload) as { frameId: NewspaperFrameId; type: LayerDisplayType };
            onMoveObjectBefore(parsed.frameId, parsed.type, card.frameId, displayType);
          } catch {
            // Ignore malformed drag data from outside this tree.
          }

          return;
        }

        const sourceFrameId = event.dataTransfer.getData("text/frame-id");

        if (sourceFrameId) {
          onMoveFrameBefore(sourceFrameId, card.frameId);
        }
      }}
    >
      <span className="frame-tree-strip" style={{ backgroundColor: layerTypeColors[displayType] }} />
      <span className="frame-tree-icon">{frameIcon(displayType)}</span>
      <span className="frame-tree-title">{displayName}</span>
      <span className="frame-tree-detail">{rowHidden ? "Hidden" : rowLocked ? "Locked" : ""}</span>
      <span className="frame-tree-flags">
        {card.overflow ? <AlertTriangle size={12} className="danger" /> : null}
        {isObjectRow ? (
          <>
            <span
              className="frame-tree-flag-button"
              role="button"
              tabIndex={-1}
              title={rowHidden ? "Show object" : "Hide object"}
              onClick={(event) => {
                event.stopPropagation();
                if (event.altKey) {
                  onSoloObject(card.frameId, displayType);
                  return;
                }
                onSetObjectHidden(card.frameId, displayType, !rowHidden);
              }}
            >
              {rowHidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </span>
            <span
              className="frame-tree-flag-button"
              role="button"
              tabIndex={-1}
              title={rowLocked ? "Unlock object" : "Lock object"}
              onClick={(event) => {
                event.stopPropagation();
                onSetObjectLocked(card.frameId, displayType, !rowLocked);
              }}
            >
              {rowLocked ? <Lock size={12} /> : <Unlock size={12} />}
            </span>
          </>
        ) : (
          <>
            {card.locked ? <Lock size={12} /> : null}
            {card.hidden ? <EyeOff size={12} /> : null}
          </>
        )}
      </span>
    </button>
  );
});

export function FrameManagerPanel({
  document,
  activePageId,
  selectedFrameId,
  selectedFrameIds,
  selectedObjectType,
  contentMode,
  onSelectPage,
  onSelectFrame,
  onSelectObject,
  onZoomToFrame,
  onRenameFrame,
  onSetFrameLocked,
  onSetFrameHidden,
  onReorderFrame,
  onMoveFrameBefore,
  onDuplicateFrame,
  onDeleteFrame,
  onGroupFrames,
  onUngroupFrames,
  onSoloFrame,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onCreateMaster,
  onDuplicateMaster,
  onRenameMaster,
  onDeleteMaster,
  onApplyMasterToActivePage,
  onDetachActivePageMaster,
  onOverrideMasterElement,
  onImportNewswireStories,
  onReplaceStoryArticle,
  compactPublisherMode = false,
}: FrameManagerPanelProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => readStoredSet(new Set()));
  const [objectMeta, setObjectMeta] = useState<ObjectMetaMap>(() => readStoredObjectMeta());
  const [objectOrder, setObjectOrder] = useState<ObjectOrderMap>(() => readStoredObjectOrder());
  const [contextFrameId, setContextFrameId] = useState<NewspaperFrameId | null>(null);
  const [contextPoint, setContextPoint] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<FrameManagerFilter>({
    query: "",
    pageId: "all",
    frameType: "all",
    onlyLocked: false,
    onlyHidden: false,
    onlyOverflow: false,
  });
  const [newswireCategory, setNewswireCategory] = useState<NewswireCategory>("Sports");
  const [newswireLimit, setNewswireLimit] = useState(5);
  const newswireLimitTouchedRef = useRef(false);
  const [newswireSubheadingPresetId, setNewswireSubheadingPresetId] =
    useState<NewswireSubheadingPresetId>("classic");
  const [customSubheadingBackground, setCustomSubheadingBackground] = useState("#111111");
  const [customSubheadingText, setCustomSubheadingText] = useState("#ffffff");
  const [newswireSubheadingOpacity, setNewswireSubheadingOpacity] = useState(100);
  const [newswireColouredHeadings, setNewswireColouredHeadings] = useState(false);
  const [newswireTintedStoryBackground, setNewswireTintedStoryBackground] = useState(false);
  const [newswireInlineColumnSubheadings, setNewswireInlineColumnSubheadings] = useState(true);
  const [newswireHeadlineAlignment, setNewswireHeadlineAlignment] =
    useState<Exclude<EditorialTextAlignment, "justify">>("left");
  const [newswireBodyAlignment, setNewswireBodyAlignment] =
    useState<EditorialTextAlignment>("justify");
  const [newswireLoading, setNewswireLoading] = useState(false);
  const [newswireStatus, setNewswireStatus] = useState("");
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementStatus, setReplacementStatus] = useState("");
  const [replacementCandidates, setReplacementCandidates] = useState<NewswireStory[]>([]);
  const [manualReplacementFrameId, setManualReplacementFrameId] = useState<NewspaperFrameId | null>(null);
  const [manualReplacementEntry, setManualReplacementEntry] = useState<ReplacementManualEntry>(() =>
    emptyReplacementManualEntry(),
  );
  const replacementImageInputRef = useRef<HTMLInputElement>(null);
  const selectedFrameSet = useMemo(() => new Set(selectedFrameIds), [selectedFrameIds]);
  const groups = useMemo(
    () => createFrameManagerGroups({ document, selectedFrameIds: selectedFrameSet }),
    [document, selectedFrameSet],
  );
  const baseFilter = useMemo<FrameManagerFilter>(
    () => ({
      ...filter,
      query: "",
      frameType: filter.frameType === "article" ? filter.frameType : "all",
    }),
    [filter],
  );
  const filteredGroups = useMemo(() => filterFrameManagerGroups(groups, baseFilter), [baseFilter, groups]);
  const allCards = useMemo(() => flattenFrameManagerCards(groups), [groups]);
  const status = useMemo(() => calculateFrameManagerStatus(allCards), [allCards]);
  const treeNodes = useMemo(
    () =>
      createTreeNodes({
        editionName: document.metadata.newspaperName,
        pageGroups: filteredGroups,
        collapsedNodes,
        frameTypeFilter: filter.frameType,
        query: filter.query,
        selectedObjectType,
        objectMeta,
        objectOrder,
      }),
    [
      collapsedNodes,
      document.metadata.newspaperName,
      filter.frameType,
      filter.query,
      filteredGroups,
      objectMeta,
      objectOrder,
      selectedObjectType,
    ],
  );
  const virtualRange = calculateFrameManagerVirtualRange({
    itemCount: treeNodes.length,
    scrollTop,
    viewportHeight: VIEWPORT_HEIGHT,
    itemHeight: ROW_HEIGHT,
  });
  const visibleNodes = treeNodes.slice(virtualRange.startIndex, virtualRange.endIndex);
  const selectedCard = allCards.find((card) => card.frameId === selectedFrameId) ?? null;
  const contextCard = contextFrameId ? allCards.find((card) => card.frameId === contextFrameId) ?? null : null;
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0] ?? null;
  const isActiveEditorialPage =
    (activePage?.sectionName ?? "").trim().toLowerCase() === "editorial" ||
    (activePage?.pageType ?? "").trim().toLowerCase() === "editorial";
  // How many story boxes this page's actual layout has — the newswire
  // fetch limit needs to match this or a box goes unfilled. A hardcoded
  // default (previously 5) can't track every template's real box count.
  const activePageArticleBoxCount = activePage
    ? activePage.frameIds.filter((frameId) => document.frames[frameId]?.frameType === "article").length
    : 0;
  // Auto-sync the fetch limit to the active page's real box count on every
  // page switch so "Load News"/"Generate Page" fills every box by default —
  // publishers who explicitly pick a different limit keep their choice
  // (tracked via the touched ref) rather than getting silently overridden.
  useEffect(() => {
    if (newswireLimitTouchedRef.current) return;
    if (activePageArticleBoxCount > 0) {
      setNewswireLimit(activePageArticleBoxCount);
    }
  }, [activePageId, activePageArticleBoxCount]);
  const masters = Object.values(document.masters ?? {});
  const pageTemplates = Object.values(document.pageTemplates ?? {});
  const layers = Object.values(document.layers ?? {}).sort((first, second) => first.zIndex - second.zIndex);
  const activeMasterBadge = activePage ? getMasterBadgeForPage(document, activePage) : "None";
  const inheritedElements = activePage ? getResolvedMasterElementsForPage(document, activePage) : [];
  const objectStatus = useMemo(() => {
    const objectNodes = treeNodes.filter((node) => node.kind === "frame" && node.objectType);

    return {
      count: objectNodes.length,
      hidden: objectNodes.filter((node) => node.kind === "frame" && node.hidden).length,
      locked: objectNodes.filter((node) => node.kind === "frame" && node.locked).length,
      selected: objectNodes.filter(
        (node) => node.kind === "frame" && contentMode && node.card.selected && node.objectType === selectedObjectType,
      ).length,
    };
  }, [contentMode, selectedObjectType, treeNodes]);
  const selectedSubheadingPreset =
    NEWSWIRE_SUBHEADING_PRESETS.find((preset) => preset.id === newswireSubheadingPresetId) ??
    NEWSWIRE_SUBHEADING_PRESETS[0];
  const applyNewswirePalette = (preset: NewswireSubheadingPreset) => {
    setNewswireSubheadingPresetId(preset.id as NewswireSubheadingPresetId);
  };
  const subheadingStyle =
    newswireSubheadingPresetId === "custom"
      ? {
          backgroundColor: customSubheadingBackground,
          textColor: customSubheadingText,
          borderColor: customSubheadingBackground,
          backgroundOpacity: newswireSubheadingOpacity / 100,
        }
      : {
          ...getPaletteSubheadingStyle(selectedSubheadingPreset, newswireSubheadingOpacity / 100),
        };
  const activePageArticleCards = useMemo(
    () =>
      allCards
        .filter((card) => card.pageId === activePage?.id && card.frameType === "article" && card.storyId)
        .sort((first, second) => {
          const firstStoryNumber = Number(first.storyId?.match(/story-(\d+)/)?.[1] ?? Number.NaN);
          const secondStoryNumber = Number(second.storyId?.match(/story-(\d+)/)?.[1] ?? Number.NaN);

          if (Number.isFinite(firstStoryNumber) && Number.isFinite(secondStoryNumber)) {
            return firstStoryNumber - secondStoryNumber;
          }

          return first.frame.bounds.y - second.frame.bounds.y || first.frame.bounds.x - second.frame.bounds.x;
        }),
    [activePage?.id, allCards],
  );
  const layoutPreviewBounds = useMemo(() => {
    if (activePageArticleCards.length === 0) {
      return null;
    }

    const left = Math.min(...activePageArticleCards.map((card) => card.frame.bounds.x));
    const top = Math.min(...activePageArticleCards.map((card) => card.frame.bounds.y));
    const right = Math.max(...activePageArticleCards.map((card) => card.frame.bounds.x + card.frame.bounds.width));
    const bottom = Math.max(...activePageArticleCards.map((card) => card.frame.bounds.y + card.frame.bounds.height));

    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }, [activePageArticleCards]);
  const selectedReplacementCard =
    activePageArticleCards.find((card) => card.frameId === selectedFrameId) ??
    activePageArticleCards.find((card) => card.storyId && card.storyId === selectedCard?.storyId) ??
    null;
  const selectedReplacementStoryId = selectedReplacementCard?.storyId ?? null;
  const selectedReplacementBoxNumber = selectedReplacementCard
    ? Number(selectedReplacementCard.storyId?.match(/story-(\d+)/)?.[1] ?? activePageArticleCards.indexOf(selectedReplacementCard) + 1)
    : null;
  const manualReplacementCard = manualReplacementFrameId
    ? activePageArticleCards.find((card) => card.frameId === manualReplacementFrameId) ?? null
    : null;
  const manualReplacementStoryId = manualReplacementCard?.storyId ?? null;
  const manualReplacementBoxNumber = manualReplacementCard
    ? Number(manualReplacementCard.storyId?.match(/story-(\d+)/)?.[1] ?? activePageArticleCards.indexOf(manualReplacementCard) + 1)
    : 0;
  const manualHeadlineWordCount = countArticleWords(manualReplacementEntry.headline);
  const manualSubheadlineWordCount = countArticleWords(manualReplacementEntry.subheadline);
  const manualBodyWordCount = countArticleWords(manualReplacementEntry.body);
  const manualHeadlineRange = estimateManualHeadlineWordRange(manualReplacementCard);
  const manualSubheadlineRange = estimateManualSubheadlineWordRange(manualReplacementCard);
  const manualBodyRange = estimateManualBodyWordRange(manualReplacementCard, Boolean(manualReplacementEntry.imageUrl));
  const manualHeadlineStatusClass = getManualFieldStatusClass(
    manualHeadlineWordCount,
    manualHeadlineRange.min,
    manualHeadlineRange.max,
  );
  const manualSubheadlineStatusClass =
    manualSubheadlineWordCount === 0
      ? "manual-box-fit-hint"
      : getManualFieldStatusClass(manualSubheadlineWordCount, manualSubheadlineRange.min, manualSubheadlineRange.max);
  const manualBodyStatusClass = getManualFieldStatusClass(
    manualBodyWordCount,
    manualBodyRange.min,
    manualBodyRange.max,
  );

  const createReplacementEntryFromCard = (card: FrameManagerCard): ReplacementManualEntry => {
    const storyObject = card.storyId ? document.stories[card.storyId] : null;
    const photoAsset = storyObject?.photo ? document.assets[storyObject.photo] : null;

    return {
      place: storyObject?.byline.location ?? "",
      headline: storyObject ? richTextToPlainText(storyObject.headline) : card.storyName,
      subheadline: storyObject ? richTextToPlainText(storyObject.subheadline) : "",
      body: storyObject ? richTextToPlainText(storyObject.body) : "",
      imageUrl: photoAsset?.source ?? photoAsset?.previewUrl ?? photoAsset?.thumbnailUrl ?? "",
      imageCaption: storyObject ? richTextToPlainText(storyObject.caption.text) : "",
    };
  };

  const openManualReplacementPopup = (card: FrameManagerCard) => {
    onSelectFrame(card.frameId);
    onZoomToFrame(card.frameId);
    setManualReplacementFrameId(card.frameId);
    setManualReplacementEntry(createReplacementEntryFromCard(card));
  };

  const setManualReplacementField = (patch: Partial<ReplacementManualEntry>) => {
    setManualReplacementEntry((current) => ({
      ...current,
      ...patch,
    }));
  };

  const pickManualReplacementImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : "";

      if (imageUrl) {
        setManualReplacementField({ imageUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const applyManualReplacement = () => {
    if (!manualReplacementStoryId) {
      setReplacementStatus("Select a story box first");
      return;
    }

    if (!manualReplacementEntry.headline.trim() || !manualReplacementEntry.body.trim()) {
      setReplacementStatus("Headline and body text are required");
      return;
    }

    onReplaceStoryArticle(
      manualReplacementStoryId,
      replacementEntryToStory(manualReplacementEntry, manualReplacementBoxNumber || 1),
      buildNewswirePanelOptions(),
    );
    setManualReplacementFrameId(null);
    setReplacementStatus("Story article replaced");
  };

  useEffect(() => {
    setReplacementCandidates([]);
    setReplacementStatus("");
  }, [activePageId, selectedReplacementStoryId]);

  const buildNewswirePanelOptions = (): NewswirePanelImportOptions => ({
    colouredHeadings: newswireColouredHeadings,
    tintedStoryBackground: newswireTintedStoryBackground,
    tintColor: getPaletteTintColor(selectedSubheadingPreset),
    inlineColumnSubheadings: newswireInlineColumnSubheadings,
    inlineSubheadingColor: getPaletteInlineAccent(selectedSubheadingPreset),
    palettePreset: selectedSubheadingPreset,
    subheadingStyle,
    headlineAlignment: newswireHeadlineAlignment,
    bodyAlignment: newswireBodyAlignment,
    languageMode: "hindi",
    pageKind: isActiveEditorialPage ? "editorial" : activePage?.pageType === "front" ? "front" : "inside",
    templateId: isActiveEditorialPage ? EDITORIAL_TEMPLATE_ID : undefined,
  });

  const loadReplacementCandidates = async () => {
    if (!selectedReplacementCard || !selectedReplacementStoryId) {
      setReplacementStatus("Select a story box from the page map first");
      return;
    }

    setReplacementLoading(true);
    setReplacementStatus("");
    setReplacementCandidates([]);

    try {
      let candidates: NewswireStory[] = [];

      if (isActiveEditorialPage) {
        const response = await fetch(`/api/editorial?limit=50&ts=${Date.now()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as EditorialRouteResponse | null;

        if (!response.ok || !payload?.success || !Array.isArray(payload.articles)) {
          throw new Error(payload?.error || `Editorial API failed with ${response.status}`);
        }

        const columnSpans = getTemplateColumnSpans(EDITORIAL_TEMPLATE_ID);
        const slotIndex = Math.max(0, (selectedReplacementBoxNumber ?? 1) - 1);

        if (slotIndex === getRashifalSlotIndex(EDITORIAL_TEMPLATE_ID)) {
          setReplacementStatus("Rashifal box uses the horoscope feed, not editorial news");
          return;
        }

        candidates =
          slotIndex === getHealthSlotIndex(EDITORIAL_TEMPLATE_ID)
            ? (payload.health ?? []).map((record, index) => buildEditorialHealthStory(record, "Health"))
            : payload.articles.map((record, index) =>
                buildEditorialStory(record, columnSpans[slotIndex] ?? selectedReplacementCard.frame.geometry.columnSpan ?? 2, "Editorial", index),
              );
      } else {
        const params = new URLSearchParams({
          category: newswireCategory,
          language: "hindi",
          limit: "20",
          ts: String(Date.now()),
        });
        const response = await fetch(`/api/newswire?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json() as NewswireRouteResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `News API failed with ${response.status}`);
        }

        candidates = payload.data ?? [];
      }

      const pageHeadlineKeys = new Set(
        activePageArticleCards
          .map((card) => card.storyName.trim().toLowerCase())
          .filter(Boolean),
      );
      const uniqueCandidates = candidates.filter((candidate, index, list) => {
        const id = candidate.id.trim();
        const headlineKey = candidate.headline.trim().toLowerCase();

        return (
          headlineKey.length > 0 &&
          headlineKey !== selectedReplacementCard.storyName.trim().toLowerCase() &&
          !pageHeadlineKeys.has(headlineKey) &&
          list.findIndex((other) => other.id === id || other.headline.trim().toLowerCase() === headlineKey) === index
        );
      });

      setReplacementCandidates(uniqueCandidates.slice(0, 8));
      setReplacementStatus(
        uniqueCandidates.length > 0
          ? `Found ${Math.min(uniqueCandidates.length, 8)} replacement option${uniqueCandidates.length === 1 ? "" : "s"}`
          : "No unused replacement articles found",
      );
    } catch (error) {
      setReplacementStatus(error instanceof Error ? error.message : "Replacement lookup failed");
    } finally {
      setReplacementLoading(false);
    }
  };

  const applyReplacementCandidate = (candidate: NewswireStory) => {
    if (!selectedReplacementStoryId) {
      setReplacementStatus("Select a story box from the page map first");
      return;
    }

    onReplaceStoryArticle(selectedReplacementStoryId, candidate, buildNewswirePanelOptions());
    setReplacementStatus("Story article replaced");
  };

  const liveReplacementSection = (
    <section className="live-layout-replacer" aria-label="Live layout story replacement">
      <div className="live-layout-help">
        <strong>लाइव पेज लेआउट</strong>
        <p>जिस बॉक्स की खबर बदलनी है उस नंबर पर क्लिक करें। पॉपअप में टेक्स्ट या फोटो बदलकर सिर्फ वही बॉक्स अपडेट होगा।</p>
      </div>
      {layoutPreviewBounds ? (
        <div
          className="live-layout-map"
          style={{
            aspectRatio: `${layoutPreviewBounds.width} / ${layoutPreviewBounds.height}`,
          }}
        >
          {activePageArticleCards.map((card, index) => {
            const boxNumber = Number(card.storyId?.match(/story-(\d+)/)?.[1] ?? index + 1);
            const bounds = card.frame.bounds;
            const isSelected = card.frameId === selectedReplacementCard?.frameId;

            return (
              <button
                key={card.frameId}
                type="button"
                className={isSelected ? "selected" : ""}
                style={{
                  left: `${((bounds.x - layoutPreviewBounds.left) / layoutPreviewBounds.width) * 100}%`,
                  top: `${((bounds.y - layoutPreviewBounds.top) / layoutPreviewBounds.height) * 100}%`,
                  width: `${(bounds.width / layoutPreviewBounds.width) * 100}%`,
                  height: `${(bounds.height / layoutPreviewBounds.height) * 100}%`,
                }}
                onClick={() => openManualReplacementPopup(card)}
                title={`Select box ${boxNumber}: ${card.storyName}`}
              >
                <span>{boxNumber}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p>No story boxes on this page.</p>
      )}
      <div className="live-layout-selected">
        <span>Selected Box</span>
        <strong>
          {selectedReplacementCard
            ? `${selectedReplacementBoxNumber ?? "-"} - ${selectedReplacementCard.storyName || "Untitled"}`
            : "Select a box"}
        </strong>
      </div>
      <button
        type="button"
        className="live-layout-load"
        onClick={loadReplacementCandidates}
        disabled={replacementLoading || !selectedReplacementStoryId}
      >
        <DownloadCloud size={13} />
        <span>{replacementLoading ? "Loading options" : "Load Replacement News"}</span>
      </button>
      {replacementCandidates.length > 0 ? (
        <div className="live-layout-candidates">
          {replacementCandidates.map((candidate) => (
            <button
              key={`${candidate.id}-${candidate.headline}`}
              type="button"
              onClick={() => applyReplacementCandidate(candidate)}
              title={candidate.headline}
            >
              <FileText size={13} />
              <span>{candidate.headline}</span>
            </button>
          ))}
        </div>
      ) : null}
      {replacementStatus ? <p>{replacementStatus}</p> : null}
    </section>
  );

  const manualReplacementPopup = manualReplacementCard ? (
    <div className="manual-box-popup-backdrop" onClick={() => setManualReplacementFrameId(null)}>
      <div className="manual-box-popup" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="manual-box-popup-close"
          onClick={() => setManualReplacementFrameId(null)}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="manual-box-card filled">
          <div className="manual-box-card-header">
            <span>Box {manualReplacementBoxNumber || "-"}</span>
            <span className="manual-box-card-span">
              {manualReplacementCard.frame.geometry.columnSpan ?? 1}-column
            </span>
            <button
              type="button"
              className="manual-box-clear-btn"
              onClick={() => setManualReplacementEntry(emptyReplacementManualEntry())}
            >
              Clear
            </button>
          </div>

          <label className="manual-box-field">
            <span>Place name</span>
            <input
              value={manualReplacementEntry.place}
              onChange={(event) => setManualReplacementField({ place: event.target.value })}
              placeholder="Optional dateline, e.g. Bhopal"
            />
          </label>

          <label className="manual-box-field">
            <span>Headline *</span>
            <textarea
              rows={2}
              value={manualReplacementEntry.headline}
              onChange={(event) => setManualReplacementField({ headline: event.target.value })}
              placeholder="Write the replacement headline"
            />
            <em className={manualHeadlineStatusClass}>
              {manualHeadlineWordCount} शब्द / words | suggested {getWordRangeText(manualHeadlineRange.min, manualHeadlineRange.max)}
            </em>
          </label>

          <label className="manual-box-field">
            <span>Subheadline</span>
            <textarea
              rows={2}
              value={manualReplacementEntry.subheadline}
              onChange={(event) => setManualReplacementField({ subheadline: event.target.value })}
              placeholder="Optional"
            />
            <em className={manualSubheadlineStatusClass}>
              {manualSubheadlineWordCount} शब्द / words | suggested {getWordRangeText(manualSubheadlineRange.min, manualSubheadlineRange.max)}
            </em>
          </label>

          <label className="manual-box-field">
            <span>Body text *</span>
            <textarea
              rows={6}
              value={manualReplacementEntry.body}
              onChange={(event) => setManualReplacementField({ body: event.target.value })}
              placeholder="Full article body text"
            />
            <em className="manual-box-fit-hint">
              Approx fit changes with headline and image size.
            </em>
            <em className={manualBodyStatusClass}>
              {manualBodyWordCount} शब्द / words | suggested {getWordRangeText(manualBodyRange.min, manualBodyRange.max)}
            </em>
          </label>

          <div className="manual-box-field manual-box-image-picker">
            <span>{manualReplacementEntry.imageUrl ? "Image selected" : "Image (optional)"}</span>
            <input
              ref={replacementImageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  pickManualReplacementImage(file);
                }
                event.target.value = "";
              }}
            />
            <button type="button" className="manual-box-choose-btn" onClick={() => replacementImageInputRef.current?.click()}>
              {manualReplacementEntry.imageUrl ? "Change image" : "Choose image"}
            </button>
            {manualReplacementEntry.imageUrl ? (
              <button type="button" onClick={() => setManualReplacementField({ imageUrl: "" })}>
                Remove
              </button>
            ) : null}
          </div>

          <label className="manual-box-field">
            <span>Image caption</span>
            <input
              value={manualReplacementEntry.imageCaption}
              onChange={(event) => setManualReplacementField({ imageCaption: event.target.value })}
              placeholder="Optional"
            />
          </label>
        </div>
        <button type="button" className="manual-box-popup-done" onClick={applyManualReplacement}>
          Replace current article
        </button>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    window.localStorage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify([...collapsedNodes]));
  }, [collapsedNodes]);

  useEffect(() => {
    window.localStorage.setItem(OBJECT_META_STORAGE_KEY, JSON.stringify(objectMeta));
  }, [objectMeta]);

  useEffect(() => {
    window.localStorage.setItem(OBJECT_ORDER_STORAGE_KEY, JSON.stringify(objectOrder));
  }, [objectOrder]);

  useEffect(() => {
    if (!selectedFrameId) {
      return;
    }

    const frame = document.frames[selectedFrameId];

    if (!frame) {
      return;
    }

    const selectedLayerType = objectTypeToLayerType[selectedObjectType];
    const nextCollapsed = new Set(collapsedNodes);
    nextCollapsed.delete("edition");
    nextCollapsed.delete(`page-${frame.pageId}`);
    nextCollapsed.delete(`story-${selectedFrameId}`);

    if (selectedLayerType) {
      nextCollapsed.delete(`frame-${selectedFrameId}-${selectedLayerType}`);
    }

    if (nextCollapsed.size !== collapsedNodes.size) {
      setCollapsedNodes(nextCollapsed);
    }
  }, [collapsedNodes, document.frames, selectedFrameId, selectedObjectType]);

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  };

  const renameFrame = (frameId: NewspaperFrameId) => {
    const card = allCards.find((candidate) => candidate.frameId === frameId);
    const nextName = window.prompt("Rename frame", card?.frameName ?? frameId);

    if (nextName !== null) {
      onRenameFrame(frameId, nextName);
    }
  };

  const renameObject = (frameId: NewspaperFrameId, type: LayerDisplayType) => {
    const metaKey = getObjectMetaKey(frameId, type);
    const currentName = objectMeta[metaKey]?.name ?? layerLabels[type];
    const nextName = window.prompt("Rename object", currentName);

    if (nextName === null) {
      return;
    }

    setObjectMeta((current) => ({
      ...current,
      [metaKey]: {
        ...current[metaKey],
        name: nextName.trim() || undefined,
      },
    }));
  };

  const setObjectLocked = (frameId: NewspaperFrameId, type: LayerDisplayType, locked: boolean) => {
    const metaKey = getObjectMetaKey(frameId, type);
    setObjectMeta((current) => ({
      ...current,
      [metaKey]: {
        ...current[metaKey],
        locked,
      },
    }));
  };

  const setObjectHidden = (frameId: NewspaperFrameId, type: LayerDisplayType, hidden: boolean) => {
    const metaKey = getObjectMetaKey(frameId, type);
    setObjectMeta((current) => ({
      ...current,
      [metaKey]: {
        ...current[metaKey],
        hidden,
      },
    }));
  };

  const soloObject = (frameId: NewspaperFrameId, type: LayerDisplayType) => {
    const order = objectOrder[frameId] ?? defaultStoryObjectOrder;
    const shouldUnsolo = order
      .filter((candidate) => candidate !== type)
      .every((candidate) => objectMeta[getObjectMetaKey(frameId, candidate)]?.hidden);

    setObjectMeta((current) => {
      const next = { ...current };

      for (const candidate of order) {
        const metaKey = getObjectMetaKey(frameId, candidate);
        next[metaKey] = {
          ...next[metaKey],
          hidden: shouldUnsolo ? false : candidate !== type,
        };
      }

      return next;
    });
  };

  const moveObjectBefore = (
    sourceFrameId: NewspaperFrameId,
    sourceType: LayerDisplayType,
    targetFrameId: NewspaperFrameId,
    targetType: LayerDisplayType,
  ) => {
    if (sourceFrameId !== targetFrameId || sourceType === targetType) {
      return;
    }

    setObjectOrder((current) => {
      const currentOrder = current[sourceFrameId] ?? defaultStoryObjectOrder;
      const nextOrder = currentOrder.filter((type) => type !== sourceType);
      const targetIndex = nextOrder.indexOf(targetType);

      nextOrder.splice(Math.max(0, targetIndex), 0, sourceType);

      return {
        ...current,
        [sourceFrameId]: nextOrder,
      };
    });
  };

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDeleteFrame();
    }
  };

  const loadNewswireStories = async () => {
    setNewswireLoading(true);
    setNewswireStatus("");

    try {
      if (isActiveEditorialPage) {
        const response = await fetch(`/api/editorial?limit=50&ts=${Date.now()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as EditorialRouteResponse | null;

        if (!response.ok || !payload?.success || !Array.isArray(payload.articles)) {
          throw new Error(payload?.error || `Editorial API failed with ${response.status}`);
        }

        const columnSpans = getTemplateColumnSpans(EDITORIAL_TEMPLATE_ID);
        const articles = buildEditorialStories({
          feed: {
            articles: payload.articles,
            rashifal: payload.rashifal ?? [],
            health: payload.health ?? [],
          },
          columnSpans,
          category: "Editorial",
          rashifalSlotIndex: getRashifalSlotIndex(EDITORIAL_TEMPLATE_ID),
          healthSlotIndex: getHealthSlotIndex(EDITORIAL_TEMPLATE_ID),
        });

        if (articles.length === 0) {
          setNewswireStatus("No live editorial articles found");
          return;
        }

        onImportNewswireStories("Editorial", articles, {
          colouredHeadings: newswireColouredHeadings,
          tintedStoryBackground: newswireTintedStoryBackground,
          tintColor: getPaletteTintColor(selectedSubheadingPreset),
          inlineColumnSubheadings: newswireInlineColumnSubheadings,
          inlineSubheadingColor: getPaletteInlineAccent(selectedSubheadingPreset),
          palettePreset: selectedSubheadingPreset,
          subheadingStyle,
          headlineAlignment: newswireHeadlineAlignment,
          bodyAlignment: newswireBodyAlignment,
          languageMode: "hindi",
          pageKind: "editorial",
          templateId: EDITORIAL_TEMPLATE_ID,
        });
        setNewswireStatus(`Loaded ${articles.length} live editorial stories`);
        return;
      }

      const params = new URLSearchParams({
        category: newswireCategory,
        language: "hindi",
        limit: String(newswireLimit),
      });
      const response = await fetch(`/api/newswire?${params.toString()}`);
      const payload = await response.json() as NewswireRouteResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `News API failed with ${response.status}`);
      }

      const articles = payload.data ?? [];

      if (articles.length === 0) {
        setNewswireStatus("No articles found");
        return;
      }

      onImportNewswireStories(newswireCategory, articles, {
        colouredHeadings: newswireColouredHeadings,
        tintedStoryBackground: newswireTintedStoryBackground,
        tintColor: getPaletteTintColor(selectedSubheadingPreset),
        inlineColumnSubheadings: newswireInlineColumnSubheadings,
        inlineSubheadingColor: getPaletteInlineAccent(selectedSubheadingPreset),
        palettePreset: selectedSubheadingPreset,
        subheadingStyle,
        headlineAlignment: newswireHeadlineAlignment,
        bodyAlignment: newswireBodyAlignment,
      });
      setNewswireStatus(`Loaded ${articles.length} ${newswireCategory} articles`);
    } catch (error) {
      setNewswireStatus(error instanceof Error ? error.message : "News import failed");
    } finally {
      setNewswireLoading(false);
    }
  };

  if (compactPublisherMode) {
    return (
      <aside className="frame-manager publisher-layout-frame-manager" aria-label="Live page layout">
        {liveReplacementSection}
        {manualReplacementPopup}
      </aside>
    );
  }

  return (
    <aside className="frame-manager" aria-label="Layers and Frame Manager">
      <header className="frame-manager-header">
        <span>Layers</span>
        <strong>{document.metadata.newspaperName}</strong>
        <small>Frames / Pages / Stories</small>
      </header>

      <section className="frame-manager-status" aria-label="Frame status">
        <span>Frames {status.frameCount}</span>
        <span>Stories {status.storyCount}</span>
        <span>Objects {objectStatus.count}</span>
        <span>Images {status.imageFrames}</span>
        <span>Overflow {status.overflowFrames}</span>
        <span>Locked {status.lockedFrames + objectStatus.locked}</span>
        <span>Hidden {status.hiddenFrames + objectStatus.hidden}</span>
        <span>Selected {status.selectedFrames}</span>
      </section>

      <section className="live-layout-replacer" aria-label="Live layout story replacement">
        <div className="frame-manager-panel-title">Live Page Layout</div>
        {layoutPreviewBounds ? (
          <div
            className="live-layout-map"
            style={{
              aspectRatio: `${layoutPreviewBounds.width} / ${layoutPreviewBounds.height}`,
            }}
          >
            {activePageArticleCards.map((card, index) => {
              const boxNumber = Number(card.storyId?.match(/story-(\d+)/)?.[1] ?? index + 1);
              const bounds = card.frame.bounds;
              const isSelected = card.frameId === selectedReplacementCard?.frameId;

              return (
                <button
                  key={card.frameId}
                  type="button"
                  className={isSelected ? "selected" : ""}
                  style={{
                    left: `${((bounds.x - layoutPreviewBounds.left) / layoutPreviewBounds.width) * 100}%`,
                    top: `${((bounds.y - layoutPreviewBounds.top) / layoutPreviewBounds.height) * 100}%`,
                    width: `${(bounds.width / layoutPreviewBounds.width) * 100}%`,
                    height: `${(bounds.height / layoutPreviewBounds.height) * 100}%`,
                  }}
                  onClick={() => openManualReplacementPopup(card)}
                  title={`Select box ${boxNumber}: ${card.storyName}`}
                >
                  <span>{boxNumber}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p>No story boxes on this page.</p>
        )}
        <div className="live-layout-selected">
          <span>Selected Box</span>
          <strong>
            {selectedReplacementCard
              ? `${selectedReplacementBoxNumber ?? "-"} - ${selectedReplacementCard.storyName || "Untitled"}`
              : "Select a box"}
          </strong>
        </div>
        <button
          type="button"
          className="live-layout-load"
          onClick={loadReplacementCandidates}
          disabled={replacementLoading || !selectedReplacementStoryId}
        >
          <DownloadCloud size={13} />
          <span>{replacementLoading ? "Loading options" : "Load Replacement News"}</span>
        </button>
        {replacementCandidates.length > 0 ? (
          <div className="live-layout-candidates">
            {replacementCandidates.map((candidate) => (
              <button
                key={`${candidate.id}-${candidate.headline}`}
                type="button"
                onClick={() => applyReplacementCandidate(candidate)}
                title={candidate.headline}
              >
                <FileText size={13} />
                <span>{candidate.headline}</span>
              </button>
            ))}
          </div>
        ) : null}
        {replacementStatus ? <p>{replacementStatus}</p> : null}
      </section>

      {manualReplacementCard ? (
        <div className="manual-box-popup-backdrop" onClick={() => setManualReplacementFrameId(null)}>
          <div className="manual-box-popup" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="manual-box-popup-close"
              onClick={() => setManualReplacementFrameId(null)}
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
            <div className="manual-box-card filled">
              <div className="manual-box-card-header">
                <span>Box {manualReplacementBoxNumber || "-"}</span>
                <span className="manual-box-card-span">
                  {manualReplacementCard.frame.geometry.columnSpan ?? 1}-column
                </span>
                <button
                  type="button"
                  className="manual-box-clear-btn"
                  onClick={() => setManualReplacementEntry(emptyReplacementManualEntry())}
                >
                  Clear
                </button>
              </div>

              <label className="manual-box-field">
                <span>Place name</span>
                <input
                  value={manualReplacementEntry.place}
                  onChange={(event) => setManualReplacementField({ place: event.target.value })}
                  placeholder="Optional dateline, e.g. Bhopal"
                />
              </label>

              <label className="manual-box-field">
                <span>Headline *</span>
                <textarea
                  rows={2}
                  value={manualReplacementEntry.headline}
                  onChange={(event) => setManualReplacementField({ headline: event.target.value })}
                  placeholder="Write the replacement headline"
                />
                <em className={manualHeadlineStatusClass}>
                  {manualHeadlineWordCount} शब्द / words | suggested {getWordRangeText(manualHeadlineRange.min, manualHeadlineRange.max)}
                </em>
              </label>

              <label className="manual-box-field">
                <span>Subheadline</span>
                <textarea
                  rows={2}
                  value={manualReplacementEntry.subheadline}
                  onChange={(event) => setManualReplacementField({ subheadline: event.target.value })}
                  placeholder="Optional"
                />
                <em className={manualSubheadlineStatusClass}>
                  {manualSubheadlineWordCount} शब्द / words | suggested {getWordRangeText(manualSubheadlineRange.min, manualSubheadlineRange.max)}
                </em>
              </label>

              <label className="manual-box-field">
                <span>Body text *</span>
                <textarea
                  rows={6}
                  value={manualReplacementEntry.body}
                  onChange={(event) => setManualReplacementField({ body: event.target.value })}
                  placeholder="Full article body text"
                />
                <em className="manual-box-fit-hint">
                  Approx fit changes with headline and image size.
                </em>
                <em className={manualBodyStatusClass}>
                  {manualBodyWordCount} शब्द / words | suggested {getWordRangeText(manualBodyRange.min, manualBodyRange.max)}
                </em>
              </label>

              <div className="manual-box-field manual-box-image-picker">
                <span>{manualReplacementEntry.imageUrl ? "Image selected" : "Image (optional)"}</span>
                <input
                  ref={replacementImageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      pickManualReplacementImage(file);
                    }
                    event.target.value = "";
                  }}
                />
                <button type="button" className="manual-box-choose-btn" onClick={() => replacementImageInputRef.current?.click()}>
                  {manualReplacementEntry.imageUrl ? "Change image" : "Choose image"}
                </button>
                {manualReplacementEntry.imageUrl ? (
                  <button type="button" onClick={() => setManualReplacementField({ imageUrl: "" })}>
                    Remove
                  </button>
                ) : null}
              </div>

              <label className="manual-box-field">
                <span>Image caption</span>
                <input
                  value={manualReplacementEntry.imageCaption}
                  onChange={(event) => setManualReplacementField({ imageCaption: event.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>
            <button type="button" className="manual-box-popup-done" onClick={applyManualReplacement}>
              Replace current article
            </button>
          </div>
        </div>
      ) : null}

      <section className="newswire-importer" aria-label="AI news importer">
        <div className="frame-manager-panel-title">AI News</div>
        <div className="newswire-importer-grid">
          <label>
            <span>Category</span>
            <select
              value={newswireCategory}
              onChange={(event) => setNewswireCategory(event.target.value as NewswireCategory)}
            >
              {NEWSWIRE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Limit</span>
            <select
              value={newswireLimit}
              onChange={(event) => {
                newswireLimitTouchedRef.current = true;
                setNewswireLimit(Number(event.target.value));
              }}
            >
              {Array.from(new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, activePageArticleBoxCount].filter((n) => n > 0)))
                .sort((a, b) => a - b)
                .map((limit) => (
                  <option key={limit} value={limit}>
                    {limit}
                    {limit === activePageArticleBoxCount ? " (page boxes)" : ""}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="newswire-wide-field" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: "#111" }}>Newspaper Colour Palette</span>
            <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>Formatting</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {NEWSWIRE_SUBHEADING_PRESETS.filter((p) => (p.id as string) !== "inline-default").map((preset) => (
              <button
                key={`panel-subheading-${preset.id}`}
                type="button"
                onClick={() => applyNewswirePalette(preset)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 8px",
                  minHeight: 48,
                  border: newswireSubheadingPresetId === preset.id ? "2px solid #1565c0" : "1px solid #ccc",
                  borderRadius: 4,
                  background: newswireSubheadingPresetId === preset.id ? "#e3f2fd" : "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#222",
                }}
                title={preset.label}
              >
                <span style={{ width: 14, height: 14, borderRadius: 3, background: preset.backgroundColor, border: `1px solid ${preset.borderColor}`, display: "inline-block" }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preset.label}</span>
                  {preset.palette ? (
                    <span style={{ display: "flex", gap: 3 }}>
                      {Object.values(preset.palette).map((color) => (
                        <span key={color} style={{ width: 14, height: 5, borderRadius: 2, background: color, border: "1px solid rgba(0,0,0,0.18)" }} />
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
        <label className="newswire-wide-field">
          <span>Subheading Opacity</span>
          <div className="newswire-opacity-control">
            <input
              type="range"
              min={0}
              max={100}
              value={newswireSubheadingOpacity}
              onChange={(event) => setNewswireSubheadingOpacity(Number(event.target.value))}
            />
            <span>{newswireSubheadingOpacity}%</span>
          </div>
        </label>
        <label className="newswire-wide-field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 4, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={newswireColouredHeadings}
            onChange={(event) => setNewswireColouredHeadings(event.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, fontSize: 12, color: "#111" }}>Coloured Headings (Editorial Style)</span>
        </label>
        <label className="newswire-wide-field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, marginBottom: newswireTintedStoryBackground ? 4 : 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={newswireTintedStoryBackground}
            onChange={(event) => setNewswireTintedStoryBackground(event.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, fontSize: 12, color: "#111" }}>Tinted Story Background (Visual Hierarchy)</span>
        </label>
        <label className="newswire-wide-field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, marginBottom: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={newswireInlineColumnSubheadings}
            onChange={(event) => setNewswireInlineColumnSubheadings(event.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, fontSize: 12, color: "#111" }}>Inline Column Subheadings (Newspaper Bullets)</span>
        </label>
        <div className="newswire-alignment-controls" aria-label="News text alignment">
          <div>
            <span>Heading Alignment</span>
            <div className="newswire-align-row">
              {[
                ["left", AlignLeft, "Left"],
                ["center", AlignCenter, "Center"],
                ["right", AlignRight, "Right"],
              ].map(([alignment, Icon, label]) => (
                <button
                  key={alignment as string}
                  type="button"
                  className={newswireHeadlineAlignment === alignment ? "active" : ""}
                  onClick={() => setNewswireHeadlineAlignment(alignment as Exclude<EditorialTextAlignment, "justify">)}
                  title={`Heading ${label}`}
                  aria-label={`Heading ${label}`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Body Alignment</span>
            <div className="newswire-align-row">
              {[
                ["left", AlignLeft, "Left"],
                ["center", AlignCenter, "Center"],
                ["right", AlignRight, "Right"],
                ["justify", AlignJustify, "Justify"],
              ].map(([alignment, Icon, label]) => (
                <button
                  key={alignment as string}
                  type="button"
                  className={newswireBodyAlignment === alignment ? "active" : ""}
                  onClick={() => setNewswireBodyAlignment(alignment as EditorialTextAlignment)}
                  title={`Body ${label}`}
                  aria-label={`Body ${label}`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
        {newswireSubheadingPresetId === "custom" ? (
          <div className="newswire-color-grid">
            <label>
              <span>BG</span>
              <input
                type="color"
                value={customSubheadingBackground}
                onChange={(event) => setCustomSubheadingBackground(event.target.value)}
              />
            </label>
            <label>
              <span>Text</span>
              <input
                type="color"
                value={customSubheadingText}
                onChange={(event) => setCustomSubheadingText(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <button type="button" onClick={loadNewswireStories} disabled={newswireLoading}>
          <DownloadCloud size={13} />
          <span>{newswireLoading ? "Loading" : isActiveEditorialPage ? "Load Editorial" : "Load News"}</span>
        </button>
        {newswireStatus ? <p>{newswireStatus}</p> : null}
      </section>

      <section className="master-manager" aria-label="Master Page Manager">
        <div className="frame-manager-panel-title">Masters / Layers / Templates</div>
        <div className="master-manager-active">
          <span>Page {activePage?.pageNumber ?? "-"}</span>
          <strong>{activeMasterBadge}</strong>
        </div>
        <div className="master-manager-actions" aria-label="Page actions">
          <button type="button" onClick={() => onAddPage("after")} title="Insert Page After">
            <Plus size={13} /> Page
          </button>
          <button type="button" onClick={onDuplicatePage} title="Duplicate Page">
            <Copy size={13} /> Page
          </button>
          <button type="button" onClick={() => onMovePage("up")} disabled={(activePage?.pageNumber ?? 1) <= 1} title="Move Page Up">
            Up
          </button>
          <button
            type="button"
            onClick={() => onMovePage("down")}
            disabled={(activePage?.pageNumber ?? document.pages.length) >= document.pages.length}
            title="Move Page Down"
          >
            Down
          </button>
          <button type="button" onClick={onDeletePage} disabled={document.pages.length <= 1} title="Delete Page">
            <Trash2 size={13} /> Page
          </button>
        </div>
        <label className="master-manager-field">
          <span>Assign Master</span>
          <select
            value={activePage?.masterPageId ?? "none"}
            onChange={(event) =>
              onApplyMasterToActivePage(event.target.value === "none" ? null : event.target.value)
            }
          >
            <option value="none">None</option>
            {masters.map((master) => (
              <option key={master.id} value={master.id}>
                {master.name}
              </option>
            ))}
          </select>
        </label>
        <div className="master-manager-actions">
          <button type="button" onClick={onCreateMaster}>New</button>
          <button
            type="button"
            disabled={!activePage?.masterPageId || activePage.masterPageId === "none"}
            onClick={() => activePage?.masterPageId && onDuplicateMaster(activePage.masterPageId)}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={!activePage?.masterPageId || activePage.masterPageId === "none"}
            onClick={() => {
              if (!activePage?.masterPageId || activePage.masterPageId === "none") {
                return;
              }

              const currentName = document.masters[activePage.masterPageId]?.name ?? "Master";
              const nextName = window.prompt("Rename master", currentName);

              if (nextName?.trim()) {
                onRenameMaster(activePage.masterPageId, nextName.trim());
              }
            }}
          >
            Rename
          </button>
          <button type="button" onClick={onDetachActivePageMaster}>Detach</button>
          <button
            type="button"
            disabled={!activePage?.masterPageId || activePage.masterPageId === "none"}
            onClick={() => activePage?.masterPageId && onDeleteMaster(activePage.masterPageId)}
          >
            Delete
          </button>
        </div>
        <div className="master-manager-list">
          <span>Inherited Elements</span>
          {inheritedElements.slice(0, 5).map((element) => (
            <button
              type="button"
              key={element.id}
              title="Ctrl+Shift override creates a local editable copy"
              onClick={(event) => {
                if (event.ctrlKey && event.shiftKey) {
                  onOverrideMasterElement(element.id);
                }
              }}
            >
              {element.metadata.name}
            </button>
          ))}
          {inheritedElements.length === 0 ? <em>No inherited master objects</em> : null}
        </div>
        <div className="master-manager-meta">
          <span>Layers {layers.length}</span>
          <span>Templates {pageTemplates.length}</span>
          <span>Guides {activePage?.guides.length ?? 0}</span>
        </div>
      </section>

      <section className="frame-manager-filters" aria-label="Frame filters">
        <label className="frame-manager-search">
          <Search size={13} />
          <input
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search frames"
          />
        </label>
        <div className="frame-manager-filter-grid">
          <select
            value={filter.pageId}
            onChange={(event) =>
              setFilter((current) => ({ ...current, pageId: event.target.value as FrameManagerFilter["pageId"] }))
            }
          >
            <option value="all">All Pages</option>
            {document.pages.map((page) => (
              <option key={page.id} value={page.id}>
                Page {page.pageNumber}
              </option>
            ))}
          </select>
          <select
            value={filter.frameType}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                frameType: event.target.value as FrameManagerFilter["frameType"],
              }))
            }
          >
            <option value="all">All Types</option>
            {Object.entries(frameTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="frame-manager-toggles">
          <label><input type="checkbox" checked={filter.onlyLocked} onChange={(event) => setFilter((current) => ({ ...current, onlyLocked: event.target.checked }))} /> Locked</label>
          <label><input type="checkbox" checked={filter.onlyHidden} onChange={(event) => setFilter((current) => ({ ...current, onlyHidden: event.target.checked }))} /> Hidden</label>
          <label><input type="checkbox" checked={filter.onlyOverflow} onChange={(event) => setFilter((current) => ({ ...current, onlyOverflow: event.target.checked }))} /> Overflow</label>
        </div>
      </section>

      <section className="frame-manager-tree-shell" aria-label="Frame tree">
        <div
          className="frame-manager-tree"
          role="tree"
          tabIndex={0}
          style={{ height: VIEWPORT_HEIGHT }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onKeyDown={handleTreeKeyDown}
        >
          <div style={{ height: virtualRange.totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${virtualRange.offsetTop}px)` }}>
              {visibleNodes.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  activePageId={activePageId}
                  contentMode={contentMode}
                  selectedObjectType={selectedObjectType}
                  onToggle={toggleNode}
                  onSelectPage={onSelectPage}
                  onSelectFrame={onSelectFrame}
                  onSelectObject={onSelectObject}
                  onZoomToFrame={onZoomToFrame}
                  onMoveFrameBefore={onMoveFrameBefore}
                  onMoveObjectBefore={moveObjectBefore}
                  onRenameObject={renameObject}
                  onSetObjectLocked={setObjectLocked}
                  onSetObjectHidden={setObjectHidden}
                  onSoloObject={soloObject}
                  onContextMenu={(frameId, x, y) => {
                    onSelectFrame(frameId, false);
                    setContextFrameId(frameId);
                    setContextPoint({ x, y });
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="frame-manager-detail" aria-label="Selected frame">
        <div className="frame-manager-panel-title">Selected Frame</div>
        {selectedFrameIds.length > 1 ? (
          <p className="frame-manager-empty">{selectedFrameIds.length} Frames Selected</p>
        ) : selectedCard ? (
          <div className="frame-manager-detail-grid">
            <span>Name</span><strong>{selectedCard.frameName}</strong>
            <span>Type</span><strong>{frameTypeLabels[selectedCard.frameType]}</strong>
            <span>Story</span><strong>{selectedCard.storyName}</strong>
            <span>Page</span><strong>{selectedCard.pageNumber}</strong>
            <span>Layer</span><strong>{selectedCard.zIndex}</strong>
            <span>State</span><strong>{selectedCard.hidden ? "Hidden" : selectedCard.locked ? "Locked" : "Editable"}</strong>
          </div>
        ) : (
          <p className="frame-manager-empty">No Frame Selected<br /><span>Select a frame on the page or in Layers.</span></p>
        )}
      </section>

      <footer className="frame-manager-actions" aria-label="Layer actions">
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && renameFrame(selectedCard.frameId)} title="Rename"><Pencil size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={onDuplicateFrame} title="Duplicate"><Copy size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={onDeleteFrame} title="Delete"><Trash2 size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onReorderFrame(selectedCard.frameId, "bring-forward")} title="Bring Forward"><BringToFront size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onReorderFrame(selectedCard.frameId, "send-backward")} title="Send Backward"><SendToBack size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onSetFrameLocked(selectedCard.frameId, !selectedCard.locked)} title="Lock">{selectedCard?.locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onSetFrameHidden(selectedCard.frameId, !selectedCard.hidden)} title="Hide">{selectedCard?.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
        <button type="button" disabled={selectedFrameIds.length < 2} onClick={onGroupFrames} title="Group"><Group size={14} /></button>
        <button type="button" disabled={!selectedCard} onClick={onUngroupFrames} title="Ungroup"><Ungroup size={14} /></button>
      </footer>

      {contextCard ? (
        <div
          className="frame-manager-context-menu"
          style={{ left: contextPoint.x, top: contextPoint.y }}
          onMouseLeave={() => setContextFrameId(null)}
        >
          <button type="button" onClick={() => { renameFrame(contextCard.frameId); setContextFrameId(null); }}>Rename</button>
          <button type="button" onClick={() => { onDuplicateFrame(); setContextFrameId(null); }}>Duplicate</button>
          <button type="button" onClick={() => { onDeleteFrame(); setContextFrameId(null); }}>Delete</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" disabled>Copy Style</button>
          <button type="button" disabled>Paste Style</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { onReorderFrame(contextCard.frameId, "bring-forward"); setContextFrameId(null); }}>Bring Forward</button>
          <button type="button" onClick={() => { onReorderFrame(contextCard.frameId, "send-backward"); setContextFrameId(null); }}>Send Backward</button>
          <button type="button" onClick={() => { onReorderFrame(contextCard.frameId, "bring-to-front"); setContextFrameId(null); }}>Bring To Front</button>
          <button type="button" onClick={() => { onReorderFrame(contextCard.frameId, "send-to-back"); setContextFrameId(null); }}>Send To Back</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { onSetFrameLocked(contextCard.frameId, !contextCard.locked); setContextFrameId(null); }}>{contextCard.locked ? "Unlock" : "Lock"}</button>
          <button type="button" onClick={() => { onSetFrameHidden(contextCard.frameId, !contextCard.hidden); setContextFrameId(null); }}>{contextCard.hidden ? "Show" : "Hide"}</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { onGroupFrames(); setContextFrameId(null); }}>Group</button>
          <button type="button" onClick={() => { onUngroupFrames(); setContextFrameId(null); }}>Ungroup</button>
          <button type="button" onClick={() => { onSoloFrame(contextCard.frameId); setContextFrameId(null); }}>Solo</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" disabled>Convert Frame</button>
          <button type="button" disabled>Headline</button>
          <button type="button" disabled>Body</button>
          <button type="button" disabled>Caption</button>
          <button type="button" disabled>Fact Box</button>
          <button type="button" disabled>Advertisement</button>
        </div>
      ) : null}
    </aside>
  );
}
