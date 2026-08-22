"use client";

import {
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Layers,
  LocateFixed,
  Lock,
  Plus,
  MessageSquare,
  Pencil,
  Search,
  Star,
  Trash2,
  Unlock,
  ZoomIn,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  calculateStoryManagerVirtualRange,
  createStoryManagerCards,
  filterStoryManagerCards,
  flattenStoryManagerCards,
} from "@/engines/StoryManager/StoryManagerEngine";
import { createEditionThumbnailSnapshots } from "@/engines/PageThumbnail/PageThumbnailEngine";
import type { StoryManagerCard, StoryManagerFilter } from "@/engines/StoryManager/StoryManagerTypes";
import type { IncrementalStoryLayout } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame, StoryFrameId, StoryPriority } from "@/types/editor";
import type {
  EditionCanvasMode,
  EditionPageColorLabel,
  EditionPageStatus,
  NewspaperDocument,
  NewspaperPageId,
} from "@/types/document";

const TREE_ROW_HEIGHT = 26;
const TREE_VIEWPORT_HEIGHT = 360;

const priorityLabels: Record<StoryPriority, string> = {
  lead: "Lead",
  major: "Major",
  secondary: "Secondary",
  brief: "Brief",
  filler: "Filler",
};

type StoryManagerPanelProps = {
  document: NewspaperDocument;
  stories: StoryFrame[];
  storyLayouts: IncrementalStoryLayout[];
  activePageId: NewspaperPageId;
  canvasMode: EditionCanvasMode;
  selectedStoryId: StoryFrameId | null;
  onSelectPage: (pageId: NewspaperPageId) => void;
  onAddPage: (position?: "end" | "before" | "after") => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  onMovePage: (direction: "up" | "down") => void;
  onUpdatePageProperties: (
    update: Partial<{
      sectionName: string;
      status: EditionPageStatus;
      colorLabel: EditionPageColorLabel;
      locked: boolean;
      hidden: boolean;
    }>,
  ) => void;
  onCanvasModeChange: (canvasMode: EditionCanvasMode) => void;
  onSelectStory: (storyId: StoryFrameId) => void;
  onZoomToStory: (storyId: StoryFrameId) => void;
  onRenameStory: (storyId: StoryFrameId, name: string) => void;
  onDuplicateStory: (storyId: StoryFrameId) => void;
  onDeleteStory: (storyId: StoryFrameId) => void;
  onReorderStory: (storyId: StoryFrameId, direction: "up" | "down") => void;
  onSetStoryLocked: (storyId: StoryFrameId, locked: boolean) => void;
  onSetStoryHidden: (storyId: StoryFrameId, hidden: boolean) => void;
  onUpdateStoryPriority: (storyId: StoryFrameId, priority: StoryPriority) => void;
};

type ContextMenuState = {
  storyId: StoryFrameId;
  x: number;
  y: number;
} | null;

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
      pageId: string;
      depth: number;
      label: string;
      detail: string;
      count: number;
      expanded: boolean;
    }
  | {
      kind: "story";
      id: string;
      storyId: StoryFrameId;
      depth: number;
      card: StoryManagerCard;
    };

const statusLabels: Record<StoryManagerCard["status"], string> = {
  ready: "Ready",
  draft: "Draft",
  "needs-image": "Needs Image",
  "needs-caption": "Needs Caption",
  overflow: "Overflow",
  incomplete: "Incomplete",
  edited: "Edited",
  locked: "Locked",
};

const priorityIcon = (priority: StoryPriority) =>
  priority === "lead" ? <Star size={13} fill="currentColor" /> : <Circle size={9} fill="currentColor" />;

const createTreeNodes = ({
  editionName,
  editionDetail,
  pageGroups,
  collapsedNodes,
}: {
  editionName: string;
  editionDetail: string;
  pageGroups: ReturnType<typeof createStoryManagerCards>;
  collapsedNodes: Set<string>;
}): TreeNode[] => {
  const editionId = "edition-1";
  const editionExpanded = !collapsedNodes.has(editionId);
  const storyCount = pageGroups.reduce((sum, page) => sum + page.cards.length, 0);
  const nodes: TreeNode[] = [
    {
      kind: "edition",
      id: editionId,
      depth: 0,
      label: "Edition 1",
      detail: `${editionName} / ${editionDetail}`,
      count: storyCount,
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
      detail: `${page.cards.length} stories`,
      count: page.cards.length,
      expanded: pageExpanded,
    });

    if (!pageExpanded) {
      continue;
    }

    for (const card of page.cards) {
      nodes.push({
        kind: "story",
        id: `story-node-${card.id}`,
        storyId: card.id,
        depth: 2,
        card,
      });
    }
  }

  return nodes;
};

const TreeRow = memo(function TreeRow({
  node,
  selected,
  active,
  onToggle,
  onSelectPage,
  onSelectStory,
  onZoomToStory,
  onReorderStory,
  onContextMenu,
}: {
  node: TreeNode;
  selected: boolean;
  active: boolean;
  onToggle: (nodeId: string) => void;
  onSelectPage: (pageId: NewspaperPageId) => void;
  onSelectStory: (storyId: StoryFrameId) => void;
  onZoomToStory: (storyId: StoryFrameId) => void;
  onReorderStory: (storyId: StoryFrameId, direction: "up" | "down") => void;
  onContextMenu: (storyId: StoryFrameId, x: number, y: number) => void;
}) {
  if (node.kind !== "story") {
    return (
      <button
        type="button"
        id={node.id}
        role="treeitem"
        aria-expanded={node.expanded}
        className={`story-tree-row story-tree-${node.kind}${active ? " active" : ""}`}
        style={{ paddingLeft: 8 + node.depth * 16 }}
        onClick={() => {
          if (node.kind === "page") {
            onSelectPage(node.pageId);
          }
          onToggle(node.id);
        }}
      >
        <span className="story-tree-expander">
          {node.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="story-tree-folder-label">{node.label}</span>
        <span className="story-tree-folder-detail">{node.detail}</span>
        <span className="story-tree-count">{node.count}</span>
      </button>
    );
  }

  const card = node.card;

  return (
    <button
      type="button"
      id={node.id}
      role="treeitem"
      aria-selected={selected}
      className={`story-tree-row story-tree-story${selected ? " selected" : ""}${active ? " active" : ""}${
        card.hidden ? " hidden" : ""
      }`}
      style={{ paddingLeft: 8 + node.depth * 16, color: card.color }}
      draggable
      onClick={() => onSelectStory(card.id)}
      onDoubleClick={() => onZoomToStory(card.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(card.id, event.clientX, event.clientY);
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/story-id", card.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/story-id");

        if (sourceId && sourceId !== card.id) {
          onReorderStory(sourceId, "down");
        }
      }}
    >
      <span className="story-tree-priority-icon" title={priorityLabels[card.priority]}>
        {priorityIcon(card.priority)}
      </span>
      <span className="story-tree-title">{card.name}</span>
      <span className="story-tree-icons">
        {card.image ? <ImageIcon size={12} aria-label="Image" /> : null}
        {card.factBox ? <Box size={12} aria-label="Fact Box" /> : null}
        {card.pullQuote ? <MessageSquare size={12} aria-label="Pull Quote" /> : null}
        {card.overflow ? <AlertTriangle size={12} className="danger" aria-label="Overflow" /> : null}
        {card.locked ? <Lock size={12} aria-label="Locked" /> : null}
        {card.hidden ? <EyeOff size={12} aria-label="Hidden" /> : null}
        {card.status === "edited" ? <Pencil size={12} aria-label="Edited" /> : null}
        {card.status === "ready" ? <Check size={12} aria-label="Ready" /> : null}
      </span>
    </button>
  );
});

export function StoryManagerPanel({
  document,
  stories,
  storyLayouts,
  activePageId,
  canvasMode,
  selectedStoryId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onUpdatePageProperties,
  onCanvasModeChange,
  onSelectStory,
  onZoomToStory,
  onRenameStory,
  onDuplicateStory,
  onDeleteStory,
  onReorderStory,
  onSetStoryLocked,
  onSetStoryHidden,
  onUpdateStoryPriority,
}: StoryManagerPanelProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [activeNodeId, setActiveNodeId] = useState("edition-1");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filter, setFilter] = useState<StoryManagerFilter>({
    query: "",
    priority: "all",
    pageId: "all",
    status: "all",
  });
  const pageGroups = useMemo(
    () => createStoryManagerCards({ document, stories, storyLayouts }),
    [document, stories, storyLayouts],
  );
  const allCards = useMemo(() => flattenStoryManagerCards(pageGroups), [pageGroups]);
  const authors = useMemo(
    () => [...new Set(allCards.map((card) => card.author).filter(Boolean))].sort(),
    [allCards],
  );
  const categories = useMemo(
    () => [...new Set(allCards.map((card) => card.category).filter(Boolean))].sort(),
    [allCards],
  );
  const filteredPageGroups = useMemo(() => {
    const byCoreFilters = filterStoryManagerCards(pageGroups, filter);

    return byCoreFilters
      .map((page) => ({
        ...page,
        cards: page.cards.filter(
          (card) =>
            (authorFilter === "all" || card.author === authorFilter) &&
            (categoryFilter === "all" || card.category === categoryFilter),
        ),
      }))
      .filter((page) => page.cards.length > 0 || filter.pageId !== "all");
  }, [authorFilter, categoryFilter, filter, pageGroups]);
  const selectedCard = allCards.find((card) => card.id === selectedStoryId) ?? null;
  const treeNodes = useMemo(
    () =>
      createTreeNodes({
        editionName: document.metadata.newspaperName,
        editionDetail: document.metadata.edition,
        pageGroups: filteredPageGroups,
        collapsedNodes,
      }),
    [collapsedNodes, document.metadata.edition, document.metadata.newspaperName, filteredPageGroups],
  );
  const virtualRange = calculateStoryManagerVirtualRange({
    itemCount: treeNodes.length,
    scrollTop,
    viewportHeight: TREE_VIEWPORT_HEIGHT,
    itemHeight: TREE_ROW_HEIGHT,
    overscan: 8,
  });
  const visibleNodes = treeNodes.slice(virtualRange.startIndex, virtualRange.endIndex);
  const contextCard = contextMenu ? allCards.find((card) => card.id === contextMenu.storyId) ?? null : null;
  const thumbnails = useMemo(() => createEditionThumbnailSnapshots(document), [document]);
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0] ?? null;

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
    setActiveNodeId(nodeId);
  };

  const renameStory = (storyId: StoryFrameId) => {
    const card = allCards.find((candidate) => candidate.id === storyId);
    const nextName = window.prompt("Rename story", card?.name ?? storyId);

    if (nextName !== null) {
      onRenameStory(storyId, nextName);
    }
  };

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const activeIndex = treeNodes.findIndex((node) => node.id === activeNodeId);
    const activeNode = treeNodes[activeIndex];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveNodeId(treeNodes[Math.min(treeNodes.length - 1, activeIndex + 1)]?.id ?? activeNodeId);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveNodeId(treeNodes[Math.max(0, activeIndex - 1)]?.id ?? activeNodeId);
    } else if (event.key === "ArrowRight" && activeNode && activeNode.kind !== "story") {
      event.preventDefault();
      if (!activeNode.expanded) {
        toggleNode(activeNode.id);
      }
    } else if (event.key === "ArrowLeft" && activeNode && activeNode.kind !== "story") {
      event.preventDefault();
      if (activeNode.expanded) {
        toggleNode(activeNode.id);
      }
    } else if ((event.key === "Enter" || event.key === " ") && activeNode) {
      event.preventDefault();
      if (activeNode.kind === "story") {
        onSelectStory(activeNode.storyId);
      } else {
        toggleNode(activeNode.id);
      }
    }
  };

  return (
    <aside className="story-manager" aria-label="Story Manager">
      <header className="story-manager-header">
        <span>NEWSPAPER</span>
        <strong>{document.metadata.newspaperName}</strong>
        <small>{document.metadata.edition}</small>
      </header>

      <section className="edition-page-manager" aria-label="Page Manager">
        <div className="edition-page-manager-title">
          <span>
            <Layers size={13} /> Pages
          </span>
          <div className="edition-page-actions">
            <button type="button" onClick={() => onAddPage("after")} title="Insert Page After">
              <Plus size={13} />
            </button>
            <button type="button" onClick={onDuplicatePage} title="Duplicate Page">
              <Copy size={13} />
            </button>
            <button type="button" onClick={onDeletePage} title="Delete Page">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="edition-page-strip" role="list" aria-label="Edition pages">
          {thumbnails.map((thumbnail) => {
            const page = document.pages.find((candidate) => candidate.id === thumbnail.pageId);
            const active = thumbnail.pageId === activePageId;

            if (!page) {
              return null;
            }

            return (
              <button
                key={thumbnail.pageId}
                type="button"
                role="listitem"
                className={`edition-page-card${active ? " active" : ""} color-${page.colorLabel ?? "none"}${
                  page.hidden ? " hidden" : ""
                }`}
                onClick={() => onSelectPage(thumbnail.pageId)}
                onDoubleClick={() => onSelectPage(thumbnail.pageId)}
                title={`Page ${page.pageNumber}`}
              >
                <span className="edition-page-thumb">
                  {thumbnail.rects.map((rect) => (
                    <i
                      key={rect.placementId}
                      className={`priority-${rect.priority}${rect.hidden ? " hidden" : ""}`}
                      style={{
                        left: `${Math.max(0, Math.min(100, (rect.x / page.masterPage.width / 72) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (rect.y / page.masterPage.height / 72) * 100))}%`,
                        width: `${Math.max(3, Math.min(100, (rect.width / page.masterPage.width / 72) * 100))}%`,
                        height: `${Math.max(3, Math.min(100, (rect.height / page.masterPage.height / 72) * 100))}%`,
                      }}
                    />
                  ))}
                </span>
                <span className="edition-page-meta">
                  <strong>Page {page.pageNumber}</strong>
                  <small>{page.sectionName ?? page.pageType}</small>
                </span>
                <span className="edition-page-badges">
                  <small>{thumbnail.storyCount} stories</small>
                  {thumbnail.overflow ? (
                    <span title="Overflow">
                      <AlertTriangle size={11} />
                    </span>
                  ) : null}
                  {thumbnail.missingAssets ? (
                    <span title="Missing assets">
                      <ImageIcon size={11} />
                    </span>
                  ) : null}
                  {page.locked ? (
                    <span title="Locked">
                      <Lock size={11} />
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="edition-page-controls">
          <button type="button" onClick={() => onAddPage("before")}>Insert Before</button>
          <button type="button" onClick={() => onMovePage("up")}>Move Up</button>
          <button type="button" onClick={() => onMovePage("down")}>Move Down</button>
          <button
            type="button"
            disabled={!activePage}
            onClick={() => activePage && onUpdatePageProperties({ locked: !activePage.locked })}
          >
            {activePage?.locked ? "Unlock" : "Lock"}
          </button>
          <button
            type="button"
            disabled={!activePage}
            onClick={() => activePage && onUpdatePageProperties({ hidden: !activePage.hidden })}
          >
            {activePage?.hidden ? "Show" : "Hide"}
          </button>
        </div>
        {activePage ? (
          <div className="edition-page-fields">
            <label>
              <span>Section</span>
              <input
                value={activePage.sectionName ?? ""}
                onChange={(event) => onUpdatePageProperties({ sectionName: event.target.value })}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={activePage.status ?? "draft"}
                onChange={(event) => onUpdatePageProperties({ status: event.target.value as EditionPageStatus })}
              >
                <option value="draft">Draft</option>
                <option value="in-progress">In Progress</option>
                <option value="ready">Ready</option>
                <option value="needs-review">Needs Review</option>
                <option value="overflow">Overflow</option>
                <option value="locked">Locked</option>
              </select>
            </label>
            <label>
              <span>Label</span>
              <select
                value={activePage.colorLabel ?? "none"}
                onChange={(event) => onUpdatePageProperties({ colorLabel: event.target.value as EditionPageColorLabel })}
              >
                <option value="none">None</option>
                <option value="red">Red</option>
                <option value="orange">Orange</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="gray">Gray</option>
              </select>
            </label>
            <label>
              <span>Mode</span>
              <select
                value={canvasMode}
                onChange={(event) => onCanvasModeChange(event.target.value as EditionCanvasMode)}
              >
                <option value="single">Single Page</option>
                <option value="facing">Facing Pages</option>
                <option value="continuous-vertical">Continuous Vertical</option>
                <option value="continuous-horizontal">Continuous Horizontal</option>
                <option value="presentation">Presentation</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <section className="story-manager-tree-shell" aria-label="Newspaper Navigator">
        <div
          className="story-manager-tree"
          role="tree"
          tabIndex={0}
          aria-activedescendant={activeNodeId}
          style={{ height: TREE_VIEWPORT_HEIGHT }}
          onKeyDown={handleTreeKeyDown}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: virtualRange.totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${virtualRange.offsetTop}px)` }}>
              {visibleNodes.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  selected={node.kind === "story" && node.storyId === selectedStoryId}
                  active={node.id === activeNodeId}
                  onToggle={toggleNode}
                  onSelectPage={onSelectPage}
                  onSelectStory={(storyId) => {
                    const card = allCards.find((candidate) => candidate.id === storyId);

                    if (card) {
                      onSelectPage(card.pageId);
                    }

                    setActiveNodeId(`story-node-${storyId}`);
                    onSelectStory(storyId);
                  }}
                  onZoomToStory={onZoomToStory}
                  onReorderStory={onReorderStory}
                  onContextMenu={(storyId, x, y) => setContextMenu({ storyId, x, y })}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="story-manager-filter-panel" aria-label="Search and filters">
        <label className="story-manager-search-box">
          <Search size={13} />
          <input
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search"
          />
        </label>
        <div className="story-manager-compact-filters">
          <select
            value={filter.priority}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                priority: event.target.value as StoryManagerFilter["priority"],
              }))
            }
          >
            <option value="all">Priority</option>
            <option value="lead">Lead</option>
            <option value="major">Major</option>
            <option value="secondary">Secondary</option>
            <option value="brief">Brief</option>
            <option value="filler">Filler</option>
          </select>
          <select
            value={filter.status}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                status: event.target.value as StoryManagerFilter["status"],
              }))
            }
          >
            <option value="all">Status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
            <option value="all">Author</option>
            {authors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={filter.pageId}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                pageId: event.target.value as StoryManagerFilter["pageId"],
              }))
            }
          >
            <option value="all">Page</option>
            {document.pages.map((page) => (
              <option key={page.id} value={page.id}>
                Page {page.pageNumber}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Section</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="story-manager-selected-panel" aria-label="Selected Story">
        <div className="story-manager-panel-title">Selected Story</div>
        {selectedCard ? (
          <div className="story-manager-detail-grid">
            <span>Headline</span>
            <strong>{selectedCard.name}</strong>
            <span>Priority</span>
            <strong>{priorityLabels[selectedCard.priority]}</strong>
            <span>Columns</span>
            <strong>{selectedCard.columns}</strong>
            <span>Size</span>
            <strong>
              {selectedCard.width} x {selectedCard.height}
            </strong>
            <span>Fill</span>
            <strong>{selectedCard.fillPercent}%</strong>
            <span>Image</span>
            <strong>{selectedCard.image ? "Yes" : "No"}</strong>
            <span>Fact Box</span>
            <strong>{selectedCard.factBox ? "Yes" : "No"}</strong>
            <span>Pull Quote</span>
            <strong>{selectedCard.pullQuote ? "Yes" : "No"}</strong>
            <span>Caption</span>
            <strong>{selectedCard.caption ? "Yes" : "No"}</strong>
            <span>Author</span>
            <strong>{selectedCard.author || "-"}</strong>
            <span>Tags</span>
            <strong>{selectedCard.tags.length > 0 ? selectedCard.tags.join(", ") : "-"}</strong>
            <span>Status</span>
            <strong>{statusLabels[selectedCard.status]}</strong>
          </div>
        ) : (
          <p className="story-manager-empty">No story selected</p>
        )}
      </section>

      <footer className="story-manager-action-bar" aria-label="Quick Actions">
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && renameStory(selectedCard.id)} title="Rename">
          <Pencil size={14} />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onDuplicateStory(selectedCard.id)} title="Duplicate">
          <Copy size={14} />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onDeleteStory(selectedCard.id)} title="Delete">
          <Trash2 size={14} />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onReorderStory(selectedCard.id, "up")} title="Move Up">
          <ChevronDown size={14} className="rotate-up" />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onSetStoryLocked(selectedCard.id, !selectedCard.locked)} title="Lock">
          {selectedCard?.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onSetStoryHidden(selectedCard.id, !selectedCard.hidden)} title="Hide">
          {selectedCard?.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onUpdateStoryPriority(selectedCard.id, "lead")} title="Convert Priority">
          <FileText size={14} />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onZoomToStory(selectedCard.id)} title="Zoom">
          <ZoomIn size={14} />
        </button>
        <button type="button" disabled={!selectedCard} onClick={() => selectedCard && onSelectStory(selectedCard.id)} title="Locate on Canvas">
          <LocateFixed size={14} />
        </button>
      </footer>

      {contextMenu && contextCard ? (
        <div
          className="story-manager-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button type="button" onClick={() => {
            renameStory(contextCard.id);
            setContextMenu(null);
          }}>Rename</button>
          <button type="button" onClick={() => {
            onDuplicateStory(contextCard.id);
            setContextMenu(null);
          }}>Duplicate</button>
          <button type="button" onClick={() => {
            onDeleteStory(contextCard.id);
            setContextMenu(null);
          }}>Delete</button>
          <button type="button" disabled>Move</button>
          <button type="button" onClick={() => {
            onSetStoryLocked(contextCard.id, !contextCard.locked);
            setContextMenu(null);
          }}>{contextCard.locked ? "Unlock" : "Lock"}</button>
          <button type="button" onClick={() => {
            onSetStoryHidden(contextCard.id, !contextCard.hidden);
            setContextMenu(null);
          }}>{contextCard.hidden ? "Show" : "Hide"}</button>
          <button type="button" onClick={() => {
            onDuplicateStory(contextCard.id);
            setContextMenu(null);
          }}>Clone</button>
          <button type="button" onClick={() => {
            onUpdateStoryPriority(contextCard.id, "lead");
            setContextMenu(null);
          }}>Convert Priority</button>
          <button type="button" disabled>Move to Page</button>
          <button type="button" disabled>Create Continuation</button>
        </div>
      ) : null}
    </aside>
  );
}
