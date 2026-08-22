export type WorkspaceDockPosition = "left" | "right" | "bottom" | "floating" | "hidden";

export type WorkspacePanelId =
  | "frames"
  | "pages"
  | "masters"
  | "assets"
  | "advertisements"
  | "styles"
  | "layers"
  | "swatches"
  | "preflight"
  | "output"
  | "console"
  | "threads"
  | "profiler"
  | "properties"
  | "history"
  | "navigator"
  | "quick-search";

export type WorkspacePanelState = {
  id: WorkspacePanelId;
  title: string;
  dock: WorkspaceDockPosition;
  pinned: boolean;
  collapsed: boolean;
  visible: boolean;
  floatingBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type WorkspaceDockState = {
  id: "left" | "right" | "bottom";
  collapsed: boolean;
  autoHide: boolean;
  activePanelId: WorkspacePanelId;
  panelIds: WorkspacePanelId[];
};

export type WorkspaceDefinition = {
  id: string;
  name: string;
  docks: Record<WorkspaceDockState["id"], WorkspaceDockState>;
  panels: Record<WorkspacePanelId, WorkspacePanelState>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCommand = {
  id: string;
  label: string;
  group: "File" | "Edit" | "Story" | "Layout" | "View" | "Tools" | "Workspace" | "Panels" | "Output" | "Performance" | "Developer";
  shortcut?: string;
  run: () => void;
};

export type WorkspaceManagerState = {
  workspaces: WorkspaceDefinition[];
  activeWorkspaceId: string;
};
