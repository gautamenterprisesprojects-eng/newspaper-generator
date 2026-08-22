"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Command,
  Copy,
  Dock,
  EyeOff,
  ExternalLink,
  GripVertical,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pin,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  activateDockPanel,
  createDefaultWorkspaceState,
  deleteWorkspace,
  duplicateWorkspace,
  getActiveWorkspace,
  movePanelToDock,
  normalizeWorkspaceState,
  renameWorkspace,
  resetWorkspace,
  setActiveWorkspace,
  toggleDockCollapsed,
} from "@/engines/WorkspaceManager/WorkspaceManagerEngine";
import type {
  WorkspaceCommand,
  WorkspaceDockPosition,
  WorkspaceManagerState,
  WorkspacePanelId,
} from "@/engines/WorkspaceManager/WorkspaceManagerTypes";
import type { NewspaperDocument, NewspaperStyle } from "@/types/document";

const storageKey = "cliff-news-workspace-layout-v1";

const getTextLabel = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "spans" in value && Array.isArray((value as { spans?: unknown[] }).spans)) {
    return ((value as { spans: { text?: string }[] }).spans)
      .map((span) => span.text ?? "")
      .join("")
      .trim();
  }
  if (value && typeof value === "object" && "text" in value && typeof (value as { text?: unknown }).text === "string") {
    return (value as { text: string }).text;
  }

  return "";
};

type WorkspaceDockProps = {
  dockId: "left" | "right" | "bottom";
  state: WorkspaceManagerState;
  panels: Partial<Record<WorkspacePanelId, ReactNode>>;
  onStateChange: (state: WorkspaceManagerState) => void;
};

export const usePersistentWorkspaceState = () => {
  const [state, setState] = useState<WorkspaceManagerState>(() => {
    if (typeof window === "undefined") {
      return createDefaultWorkspaceState();
    }

    try {
      return normalizeWorkspaceState(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"));
    } catch {
      return createDefaultWorkspaceState();
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
};

export const WorkspaceDock = memo(function WorkspaceDock({
  dockId,
  state,
  panels,
  onStateChange,
}: WorkspaceDockProps) {
  const workspace = getActiveWorkspace(state);
  const dock = workspace.docks[dockId];
  const activePanelId = dock.panelIds.includes(dock.activePanelId) ? dock.activePanelId : dock.panelIds[0];
  const activePanel = activePanelId ? panels[activePanelId] : null;
  const icon = dockId === "left" ? <PanelLeft size={14} /> : dockId === "right" ? <PanelRight size={14} /> : <PanelBottom size={14} />;

  if (dock.collapsed) {
    return (
      <aside className={`workspace-dock workspace-dock-${dockId} collapsed`}>
        <button type="button" onClick={() => onStateChange(toggleDockCollapsed(state, dockId))}>
          {icon}
          <span>{dockId}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`workspace-dock workspace-dock-${dockId}`}>
      <header className="workspace-dock-header">
        <span>{icon}{workspace.name}</span>
        <span className="workspace-dock-actions">
          <button type="button" onClick={() => onStateChange(toggleDockCollapsed(state, dockId))} title="Collapse dock">
            {dockId === "right" ? <ChevronRight size={14} /> : dockId === "left" ? <ChevronLeft size={14} /> : <ChevronDown size={14} />}
          </button>
        </span>
      </header>
      <nav className="workspace-panel-tabs" aria-label={`${dockId} panel tabs`}>
        {dock.panelIds.map((panelId) => {
          const panel = workspace.panels[panelId];

          if (!panel?.visible || !panels[panelId]) {
            return null;
          }

          return (
            <button
              type="button"
              key={panelId}
              className={panelId === activePanelId ? "active" : ""}
              onClick={() => onStateChange(activateDockPanel(state, dockId, panelId))}
            >
              {panel.title}
              <span className="workspace-tab-actions">
                <i
                  role="button"
                  tabIndex={0}
                  title="Float panel"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStateChange(movePanelToDock(state, panelId, "floating"));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      onStateChange(movePanelToDock(state, panelId, "floating"));
                    }
                  }}
                >
                  <ExternalLink size={10} />
                </i>
                <i
                  role="button"
                  tabIndex={0}
                  title="Close panel"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStateChange(movePanelToDock(state, panelId, "hidden"));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      onStateChange(movePanelToDock(state, panelId, "hidden"));
                    }
                  }}
                >
                  <X size={10} />
                </i>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="workspace-panel-body">
        {activePanel}
      </div>
    </aside>
  );
});

export const FloatingWorkspacePanels = memo(function FloatingWorkspacePanels({
  state,
  panels,
  onStateChange,
}: {
  state: WorkspaceManagerState;
  panels: Partial<Record<WorkspacePanelId, ReactNode>>;
  onStateChange: (state: WorkspaceManagerState) => void;
}) {
  const workspace = getActiveWorkspace(state);
  const floatingPanels = Object.values(workspace.panels).filter((panel) => panel.dock === "floating" && panel.visible);

  return (
    <>
      {floatingPanels.map((panel, index) => (
        <section
          className="workspace-floating-panel"
          key={panel.id}
          style={{
            left: panel.floatingBounds?.x ?? 360 + index * 24,
            top: panel.floatingBounds?.y ?? 96 + index * 24,
            width: panel.floatingBounds?.width ?? 320,
            height: panel.floatingBounds?.height ?? 420,
          }}
        >
          <header>
            <span><GripVertical size={13} />{panel.title}</span>
            <span>
              <button type="button" title="Dock left" onClick={() => onStateChange(movePanelToDock(state, panel.id, "left"))}><PanelLeft size={12} /></button>
              <button type="button" title="Dock right" onClick={() => onStateChange(movePanelToDock(state, panel.id, "right"))}><PanelRight size={12} /></button>
              <button type="button" title="Dock bottom" onClick={() => onStateChange(movePanelToDock(state, panel.id, "bottom"))}><PanelBottom size={12} /></button>
              <button type="button" title="Close" onClick={() => onStateChange(movePanelToDock(state, panel.id, "hidden"))}><X size={12} /></button>
            </span>
          </header>
          <div>{panels[panel.id]}</div>
        </section>
      ))}
    </>
  );
});

type WorkspaceToolbarProps = {
  state: WorkspaceManagerState;
  onStateChange: (state: WorkspaceManagerState) => void;
  onOpenCommandPalette: () => void;
};

type ToolbarMenuAction = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  run: () => void;
};

function WorkspaceToolbarMenu({
  label,
  actions,
}: {
  label: string;
  actions: ToolbarMenuAction[];
}) {
  return (
    <div className="workspace-toolbar-menu">
      <details>
        <summary>
          <span>{label}</span>
          <ChevronDown size={12} />
        </summary>
        <div className="workspace-toolbar-menu-list">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={(event) => {
                action.run();
                const details = event.currentTarget.closest("details");
                if (details) {
                  details.removeAttribute("open");
                }
              }}
            >
              <span>
                {action.icon}
                {action.label}
              </span>
              {action.shortcut ? <small>{action.shortcut}</small> : null}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export const WorkspaceToolbar = memo(function WorkspaceToolbar({
  state,
  onStateChange,
  onOpenCommandPalette,
}: WorkspaceToolbarProps) {
  const workspace = getActiveWorkspace(state);

  const workspaceActions: ToolbarMenuAction[] = [
    {
      id: "duplicate-workspace",
      label: "Duplicate Workspace",
      icon: <Copy size={12} />,
      run: () => onStateChange(duplicateWorkspace(state, workspace.id)),
    },
    {
      id: "save-workspace",
      label: "Save Workspace",
      icon: <Save size={12} />,
      run: () => onStateChange(renameWorkspace(state, workspace.id, `${workspace.name} Saved`)),
    },
    {
      id: "reset-workspace",
      label: "Reset Workspace",
      icon: <RotateCcw size={12} />,
      run: () => onStateChange(resetWorkspace(state, workspace.id)),
    },
    {
      id: "delete-workspace",
      label: "Delete Workspace",
      icon: <Trash2 size={12} />,
      run: () => onStateChange(deleteWorkspace(state, workspace.id)),
    },
  ];

  const panelActions: ToolbarMenuAction[] = [
    {
      id: "open-assets",
      label: "Assets Panel",
      icon: <ExternalLink size={12} />,
      run: () => onStateChange(activateDockPanel(state, "left", "assets")),
    },
    {
      id: "open-styles",
      label: "Styles Panel",
      icon: <ExternalLink size={12} />,
      run: () => onStateChange(activateDockPanel(state, "left", "styles")),
    },
    {
      id: "open-advertisements",
      label: "Advertisements Panel",
      icon: <ExternalLink size={12} />,
      run: () => onStateChange(activateDockPanel(state, "left", "advertisements")),
    },
    {
      id: "open-properties",
      label: "Properties Panel",
      icon: <ExternalLink size={12} />,
      run: () => onStateChange(activateDockPanel(state, "right", "properties")),
    },
    {
      id: "open-navigator",
      label: "Navigator Panel",
      icon: <ExternalLink size={12} />,
      run: () => onStateChange(activateDockPanel(state, "right", "navigator")),
    },
    {
      id: "search-panel",
      label: "Quick Search",
      shortcut: "Ctrl+K",
      icon: <Search size={12} />,
      run: () => onStateChange(activateDockPanel(state, "right", "quick-search")),
    },
    {
      id: "panel-layout",
      label: "Panel Layout",
      icon: <GripVertical size={12} />,
      run: () => onStateChange(activateDockPanel(state, "bottom", "output")),
    },
  ];

  return (
    <div className="workspace-toolbar" aria-label="Workspace controls">
      <label>
        <span>Workspace</span>
        <select
          value={state.activeWorkspaceId}
          onChange={(event) => onStateChange(setActiveWorkspace(state, event.target.value))}
        >
          {state.workspaces.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
      </label>
      <WorkspaceToolbarMenu label="Workspace" actions={workspaceActions} />
      <WorkspaceToolbarMenu label="Panels" actions={panelActions} />
      <button type="button" className="primary" onClick={onOpenCommandPalette}>
        <Command size={14} /> Commands
      </button>
    </div>
  );
});

type CommandPaletteProps = {
  open: boolean;
  commands: WorkspaceCommand[];
  recentCommands?: string[];
  onClose: () => void;
};

export const CommandPalette = memo(function CommandPalette({
  open,
  commands,
  recentCommands = [],
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return commands.filter((command) =>
      !normalized ||
      command.label.toLowerCase().includes(normalized) ||
      command.group.toLowerCase().includes(normalized) ||
      command.shortcut?.toLowerCase().includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch (e) {
        inputRef.current.focus();
      }
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const pinnedCommands = commands.filter((command) =>
    ["create-story", "duplicate-frame", "fit-width", "open-properties", "focus-search"].includes(command.id),
  );
  const groupedCommands = Object.entries(
    filteredCommands.reduce<Record<string, WorkspaceCommand[]>>((acc, command) => {
      acc[command.group] = [...(acc[command.group] ?? []), command];
      return acc;
    }, {}),
  );

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-label="Command Palette" onMouseDown={(event) => event.stopPropagation()}>
        <label className="command-palette-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
              if (event.key === "Enter" && filteredCommands[0]) {
                filteredCommands[0].run();
                onClose();
              }
            }}
            placeholder="Search commands, panels, pages, assets..."
          />
        </label>
        <div className="command-palette-list">
          {query.trim() === "" && pinnedCommands.length > 0 ? (
            <section className="command-palette-section">
              <h4>Pinned</h4>
              {pinnedCommands.map((command) => (
                <CommandButton key={command.id} command={command} onClose={onClose} />
              ))}
            </section>
          ) : null}
          {query.trim() === "" && recentCommands.length > 0 ? (
            <section className="command-palette-section">
              <h4>Recent</h4>
              {recentCommands.slice(0, 6).map((label) => (
                <button type="button" key={label} disabled>
                  <span>{label}</span>
                  <small>Recent</small>
                </button>
              ))}
            </section>
          ) : null}
          {groupedCommands.map(([group, groupCommands]) => (
            <section className="command-palette-section" key={group}>
              <h4>{group}</h4>
              {groupCommands.slice(0, 16).map((command) => (
                <CommandButton key={command.id} command={command} onClose={onClose} />
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
});

const CommandButton = memo(function CommandButton({
  command,
  onClose,
}: {
  command: WorkspaceCommand;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        command.run();
        onClose();
      }}
    >
      <span>{command.label}</span>
      <small>{command.group}{command.shortcut ? ` / ${command.shortcut}` : ""}</small>
    </button>
  );
});

export const ShortcutOverlay = memo(function ShortcutOverlay({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: WorkspaceCommand[];
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  const groupedCommands = Object.entries(
    commands.reduce<Record<string, WorkspaceCommand[]>>((acc, command) => {
      acc[command.group] = [...(acc[command.group] ?? []), command];
      return acc;
    }, {}),
  );

  return (
    <div className="shortcut-overlay-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="shortcut-overlay" role="dialog" aria-label="Keyboard shortcuts" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <strong>Keyboard Shortcuts</strong>
          <button type="button" onClick={onClose}><X size={14} /></button>
        </header>
        <div className="shortcut-overlay-grid">
          {groupedCommands.map(([group, groupCommands]) => (
            <section key={group}>
              <h4>{group}</h4>
              {groupCommands.filter((command) => command.shortcut).map((command) => (
                <p key={command.id}>
                  <span>{command.label}</span>
                  <kbd>{command.shortcut}</kbd>
                </p>
              ))}
            </section>
          ))}
          <section>
            <h4>Workspace</h4>
            <p><span>Command Palette</span><kbd>Ctrl+Shift+P</kbd></p>
            <p><span>Quick Search</span><kbd>Ctrl+K</kbd></p>
            <p><span>Shortcuts</span><kbd>?</kbd></p>
            <p><span>Collapse Left Dock</span><kbd>Alt+1</kbd></p>
            <p><span>Collapse Right Dock</span><kbd>Alt+2</kbd></p>
            <p><span>Collapse Bottom Dock</span><kbd>Alt+3</kbd></p>
          </section>
        </div>
      </section>
    </div>
  );
});

type QuickSearchPanelProps = {
  document: NewspaperDocument;
  commands: WorkspaceCommand[];
};

export const QuickSearchPanel = memo(function QuickSearchPanel({ document, commands }: QuickSearchPanelProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const groupedResults = useMemo(() => {
    if (!normalized) {
      return [];
    }

    const pages = document.pages.map((page) => ({
      kind: "Page",
      label: `Page ${page.pageNumber}`,
      detail: page.sectionName ?? page.pageType,
    }));
    const frames = Object.values(document.frames).map((frame) => ({
      kind: "Frame",
      label: frame.metadata.name ?? frame.frameType,
      detail: `${frame.frameType} / ${frame.id}`,
    }));
    const stories = Object.values(document.stories).map((story) => ({
      kind: "Story",
      label: (story.name ?? getTextLabel(story.headline)) || story.id,
      detail: story.category ?? story.status ?? "story",
    }));
    const assets = Object.values(document.assets).map((asset) => ({
      kind: "Asset",
      label: asset.name,
      detail: asset.type,
    }));
    const advertisements = Object.values(document.advertisements).map((ad) => ({
      kind: "Ad",
      label: ad.client,
      detail: `${ad.bookingId} / ${ad.status}`,
    }));
    const masters = Object.values(document.masters).map((master) => ({
      kind: "Master",
      label: master.name,
      detail: master.prefix,
    }));
    const styles = Object.values(document.styles.styles).map((style: NewspaperStyle) => ({
      kind: "Style",
      label: style.name,
      detail: style.kind,
    }));
    const commandResults = commands.map((command) => ({
      kind: "Command",
      label: command.label,
      detail: command.group,
    }));

    const matches = [...pages, ...frames, ...stories, ...assets, ...advertisements, ...masters, ...styles, ...commandResults]
      .filter((item) => `${item.kind} ${item.label} ${item.detail}`.toLowerCase().includes(normalized))
      .slice(0, 50);

    return Object.entries(
      matches.reduce<Record<string, typeof matches>>((acc, item) => {
        acc[item.kind] = [...(acc[item.kind] ?? []), item];
        return acc;
      }, {}),
    );
  }, [commands, document, normalized]);

  return (
    <section className="workspace-utility-panel">
      <label className="workspace-search-field">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document and commands" />
      </label>
      <div className="workspace-search-results">
        {groupedResults.length === 0 ? <p>Search pages, frames, assets, ads, styles, masters, and commands.</p> : null}
        {groupedResults.map(([group, items]) => (
          <section className="workspace-search-group" key={group}>
            <h4>{group}</h4>
            {items.map((item, index) => (
              <button type="button" key={`${item.kind}-${item.label}-${index}`}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
});

type NavigatorPanelProps = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onFitSelection: () => void;
  pageCount: number;
  activePageNumber: number;
  onSelectPage: (pageNumber: number) => void;
};

export const NavigatorPanel = memo(function NavigatorPanel({
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onFitWidth,
  onFitSelection,
  pageCount,
  activePageNumber,
  onSelectPage,
}: NavigatorPanelProps) {
  return (
    <section className="workspace-utility-panel">
      <div className="navigator-preview">
        <div className="navigator-page" role="button" tabIndex={0} title="Drag viewport preview">
          <span>Page {activePageNumber}</span>
          <i />
          <b />
        </div>
      </div>
      <div className="navigator-controls">
        <button type="button" onClick={onZoomOut}>-</button>
        <strong>{Math.round(zoom * 100)}%</strong>
        <button type="button" onClick={onZoomIn}>+</button>
      </div>
      <input
        className="navigator-zoom-slider"
        type="range"
        min={35}
        max={150}
        value={Math.round(zoom * 100)}
        onChange={(event) => onZoomChange(Number(event.target.value) / 100)}
      />
      <div className="navigator-fit-grid">
        <button type="button" onClick={onFitPage}>Fit Page</button>
        <button type="button" onClick={onFitWidth}>Fit Width</button>
        <button type="button" onClick={onFitSelection}>Fit Selection</button>
        <button type="button" onClick={() => onZoomChange(1)}>100%</button>
      </div>
      <label className="navigator-page-switcher">
        <span>Page</span>
        <select value={activePageNumber} onChange={(event) => onSelectPage(Number(event.target.value))}>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <option key={pageNumber} value={pageNumber}>{pageNumber}</option>
          ))}
        </select>
      </label>
      <p>{pageCount} pages / viewport rectangle, zoom, fit, spread and rotation preview ready.</p>
    </section>
  );
});

type HistoryPanelProps = {
  history: string[];
};

export const HistoryPanel = memo(function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <section className="workspace-utility-panel">
      <div className="history-actions">
        <button type="button">Undo</button>
        <button type="button">Redo</button>
        <button type="button">Bookmark</button>
      </div>
      <div className="history-list">
        {(history.length > 0 ? history : ["Open document", "Workspace initialized"]).map((item, index) => (
          <button type="button" key={`${item}-${index}`} className={index === 0 ? "current" : ""}>
            <ChevronsUpDown size={13} />
            <span>{item}</span>
            <small>{index === 0 ? "current" : `${index + 1} states ago`}</small>
          </button>
        ))}
      </div>
    </section>
  );
});

export const PanelRoutingMenu = memo(function PanelRoutingMenu({
  state,
  onStateChange,
}: {
  state: WorkspaceManagerState;
  onStateChange: (state: WorkspaceManagerState) => void;
}) {
  const workspace = getActiveWorkspace(state);
  const docks: WorkspaceDockPosition[] = ["left", "right", "bottom", "floating", "hidden"];

  return (
    <section className="panel-routing-menu">
      {Object.values(workspace.panels).map((panel) => (
        <label key={panel.id}>
          <span>{panel.title}</span>
          <select
            value={panel.dock}
            onChange={(event) => onStateChange(movePanelToDock(state, panel.id, event.target.value as WorkspaceDockPosition))}
          >
            {docks.map((dock) => <option key={dock} value={dock}>{dock}</option>)}
          </select>
          <button type="button" title="Pin"><Pin size={12} /></button>
          <button type="button" title="Restore"><Dock size={12} /></button>
        </label>
      ))}
    </section>
  );
});

export const PlaceholderPanel = memo(function PlaceholderPanel({ title }: { title: string }) {
  return (
    <section className="workspace-utility-panel">
      <p>{title} panel is dock-ready for the next workflow integration.</p>
      <button type="button"><EyeOff size={13} /> Hide</button>
    </section>
  );
});
