import type {
  WorkspaceDefinition,
  WorkspaceDockPosition,
  WorkspaceManagerState,
  WorkspacePanelId,
  WorkspacePanelState,
} from "./WorkspaceManagerTypes";

const now = () => new Date().toISOString();

const panelTitles: Record<WorkspacePanelId, string> = {
  frames: "Frames",
  pages: "Pages",
  masters: "Masters",
  assets: "Assets",
  advertisements: "Advertisements",
  styles: "Styles",
  layers: "Layers",
  swatches: "Swatches",
  preflight: "Preflight",
  output: "Output",
  console: "Console",
  threads: "Threads",
  profiler: "Profiler",
  properties: "Properties",
  history: "History",
  navigator: "Navigator",
  "quick-search": "Quick Search",
};

const createPanel = (
  id: WorkspacePanelId,
  dock: WorkspaceDockPosition,
  visible = true,
): WorkspacePanelState => ({
  id,
  title: panelTitles[id],
  dock,
  pinned: true,
  collapsed: false,
  visible,
});

const getWorkspacePreset = (id: string) => {
  if (id === "layout") {
    return {
      left: ["frames", "styles"] as WorkspacePanelId[],
      right: ["properties", "navigator"] as WorkspacePanelId[],
      bottom: ["history"] as WorkspacePanelId[],
      activeLeft: "frames" as WorkspacePanelId,
      activeRight: "properties" as WorkspacePanelId,
      activeBottom: "history" as WorkspacePanelId,
      bottomCollapsed: false,
    };
  }
  if (id === "advertising") {
    return {
      left: ["advertisements", "assets"] as WorkspacePanelId[],
      right: ["properties"] as WorkspacePanelId[],
      bottom: ["history"] as WorkspacePanelId[],
      activeLeft: "advertisements" as WorkspacePanelId,
      activeRight: "properties" as WorkspacePanelId,
      activeBottom: "history" as WorkspacePanelId,
      bottomCollapsed: false,
    };
  }
  if (id === "images") {
    return {
      left: ["assets"] as WorkspacePanelId[],
      right: ["properties", "navigator"] as WorkspacePanelId[],
      bottom: ["history"] as WorkspacePanelId[],
      activeLeft: "assets" as WorkspacePanelId,
      activeRight: "properties" as WorkspacePanelId,
      activeBottom: "history" as WorkspacePanelId,
      bottomCollapsed: true,
    };
  }
  if (id === "print") {
    return {
      left: ["preflight"] as WorkspacePanelId[],
      right: ["output"] as WorkspacePanelId[],
      bottom: ["history"] as WorkspacePanelId[],
      activeLeft: "preflight" as WorkspacePanelId,
      activeRight: "output" as WorkspacePanelId,
      activeBottom: "history" as WorkspacePanelId,
      bottomCollapsed: false,
    };
  }
  if (id === "developer") {
    return {
      left: ["frames"] as WorkspacePanelId[],
      right: ["profiler"] as WorkspacePanelId[],
      bottom: ["history", "console"] as WorkspacePanelId[],
      activeLeft: "frames" as WorkspacePanelId,
      activeRight: "profiler" as WorkspacePanelId,
      activeBottom: "history" as WorkspacePanelId,
      bottomCollapsed: false,
    };
  }

  return {
    left: ["frames"] as WorkspacePanelId[],
    right: ["properties", "navigator"] as WorkspacePanelId[],
      bottom: ["history", "preflight", "output", "console", "threads"] as WorkspacePanelId[],
    activeLeft: "frames" as WorkspacePanelId,
    activeRight: "properties" as WorkspacePanelId,
    activeBottom: "history" as WorkspacePanelId,
    bottomCollapsed: false,
  };
};

export const createWorkspace = (id: string, name: string): WorkspaceDefinition => {
  const timestamp = now();
  const preset = getWorkspacePreset(id);
  const panels: WorkspaceDefinition["panels"] = {
    frames: createPanel("frames", preset.left.includes("frames") ? "left" : "hidden", preset.left.includes("frames")),
    pages: createPanel("pages", "hidden", false),
    masters: createPanel("masters", "hidden", false),
    assets: createPanel("assets", preset.left.includes("assets") ? "left" : "hidden", preset.left.includes("assets")),
    advertisements: createPanel("advertisements", preset.left.includes("advertisements") ? "left" : "hidden", preset.left.includes("advertisements")),
    styles: createPanel("styles", preset.left.includes("styles") ? "left" : "hidden", preset.left.includes("styles")),
    layers: createPanel("layers", "hidden", false),
    swatches: createPanel("swatches", "hidden", false),
    preflight: createPanel("preflight", preset.left.includes("preflight") ? "left" : preset.bottom.includes("preflight") ? "bottom" : "hidden", preset.left.includes("preflight") || preset.bottom.includes("preflight")),
    output: createPanel("output", preset.right.includes("output") ? "right" : preset.bottom.includes("output") ? "bottom" : "hidden", preset.right.includes("output") || preset.bottom.includes("output")),
    console: createPanel("console", preset.bottom.includes("console") ? "bottom" : "hidden", preset.bottom.includes("console")),
    threads: createPanel("threads", preset.bottom.includes("threads") ? "bottom" : "hidden", preset.bottom.includes("threads")),
    profiler: createPanel("profiler", preset.right.includes("profiler") ? "right" : "hidden", preset.right.includes("profiler")),
    properties: createPanel("properties", preset.right.includes("properties") ? "right" : "hidden", preset.right.includes("properties")),
    history: createPanel("history", preset.bottom.includes("history") ? "bottom" : "hidden", preset.bottom.includes("history")),
    navigator: createPanel("navigator", preset.right.includes("navigator") ? "right" : "hidden", preset.right.includes("navigator")),
    "quick-search": createPanel("quick-search", "hidden", false),
  };

  return {
    id,
    name,
    panels,
    docks: {
      left: {
        id: "left",
        collapsed: false,
        autoHide: false,
        activePanelId: preset.activeLeft,
        panelIds: preset.left,
      },
      right: {
        id: "right",
        collapsed: false,
        autoHide: false,
        activePanelId: preset.activeRight,
        panelIds: preset.right,
      },
      bottom: {
        id: "bottom",
        collapsed: preset.bottomCollapsed,
        autoHide: false,
        activePanelId: preset.activeBottom,
        panelIds: preset.bottom,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createDefaultWorkspaceState = (): WorkspaceManagerState => ({
  activeWorkspaceId: "editorial",
  workspaces: [
    createWorkspace("editorial", "Editorial"),
    createWorkspace("layout", "Layout"),
    createWorkspace("advertising", "Advertising"),
    createWorkspace("images", "Images"),
    createWorkspace("print", "Print"),
    createWorkspace("developer", "Developer"),
  ],
});

export const getActiveWorkspace = (state: WorkspaceManagerState): WorkspaceDefinition =>
  state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? state.workspaces[0];

const updateActiveWorkspace = (
  state: WorkspaceManagerState,
  updater: (workspace: WorkspaceDefinition) => WorkspaceDefinition,
): WorkspaceManagerState => ({
  ...state,
  workspaces: state.workspaces.map((workspace) =>
    workspace.id === state.activeWorkspaceId ? updater(workspace) : workspace,
  ),
});

export const setActiveWorkspace = (
  state: WorkspaceManagerState,
  workspaceId: string,
): WorkspaceManagerState => ({
  ...state,
  activeWorkspaceId: state.workspaces.some((workspace) => workspace.id === workspaceId)
    ? workspaceId
    : state.activeWorkspaceId,
});

export const duplicateWorkspace = (
  state: WorkspaceManagerState,
  workspaceId: string,
): WorkspaceManagerState => {
  const source = state.workspaces.find((workspace) => workspace.id === workspaceId);

  if (!source) {
    return state;
  }

  const id = `${source.id}-copy-${Date.now().toString(36)}`;

  return {
    activeWorkspaceId: id,
    workspaces: [
      ...state.workspaces,
      {
        ...source,
        id,
        name: `${source.name} Copy`,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
  };
};

export const renameWorkspace = (
  state: WorkspaceManagerState,
  workspaceId: string,
  name: string,
): WorkspaceManagerState => ({
  ...state,
  workspaces: state.workspaces.map((workspace) =>
    workspace.id === workspaceId ? { ...workspace, name, updatedAt: now() } : workspace,
  ),
});

export const deleteWorkspace = (
  state: WorkspaceManagerState,
  workspaceId: string,
): WorkspaceManagerState => {
  if (state.workspaces.length <= 1) {
    return state;
  }

  const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);

  return {
    activeWorkspaceId: state.activeWorkspaceId === workspaceId ? workspaces[0].id : state.activeWorkspaceId,
    workspaces,
  };
};

export const resetWorkspace = (
  state: WorkspaceManagerState,
  workspaceId: string,
): WorkspaceManagerState => ({
  ...state,
  workspaces: state.workspaces.map((workspace) =>
    workspace.id === workspaceId ? createWorkspace(workspace.id, workspace.name) : workspace,
  ),
});

export const activateDockPanel = (
  state: WorkspaceManagerState,
  dockId: "left" | "right" | "bottom",
  panelId: WorkspacePanelId,
): WorkspaceManagerState =>
  updateActiveWorkspace(state, (workspace) => ({
    ...workspace,
    docks: {
      ...workspace.docks,
      [dockId]: {
        ...workspace.docks[dockId],
        activePanelId: panelId,
        collapsed: false,
      },
    },
    panels: {
      ...workspace.panels,
      [panelId]: {
        ...workspace.panels[panelId],
        visible: true,
        dock: dockId,
      },
    },
    updatedAt: now(),
  }));

export const toggleDockCollapsed = (
  state: WorkspaceManagerState,
  dockId: "left" | "right" | "bottom",
): WorkspaceManagerState =>
  updateActiveWorkspace(state, (workspace) => ({
    ...workspace,
    docks: {
      ...workspace.docks,
      [dockId]: {
        ...workspace.docks[dockId],
        collapsed: !workspace.docks[dockId].collapsed,
      },
    },
    updatedAt: now(),
  }));

export const movePanelToDock = (
  state: WorkspaceManagerState,
  panelId: WorkspacePanelId,
  dock: WorkspaceDockPosition,
): WorkspaceManagerState =>
  updateActiveWorkspace(state, (workspace) => {
    const docks = { ...workspace.docks };

    (Object.keys(docks) as (keyof typeof docks)[]).forEach((dockId) => {
      docks[dockId] = {
        ...docks[dockId],
        panelIds: docks[dockId].panelIds.filter((candidate) => candidate !== panelId),
      };
    });

    if (dock === "left" || dock === "right" || dock === "bottom") {
      docks[dock] = {
        ...docks[dock],
        panelIds: [...docks[dock].panelIds, panelId],
        activePanelId: panelId,
        collapsed: false,
      };
    }

    return {
      ...workspace,
      docks,
      panels: {
        ...workspace.panels,
        [panelId]: {
          ...workspace.panels[panelId],
          dock,
          visible: dock !== "hidden",
        },
      },
      updatedAt: now(),
    };
  });

export const normalizeWorkspaceState = (state: unknown): WorkspaceManagerState => {
  const defaults = createDefaultWorkspaceState();

  if (!state || typeof state !== "object") {
    return defaults;
  }

  const candidate = state as Partial<WorkspaceManagerState>;

  if (!Array.isArray(candidate.workspaces) || candidate.workspaces.length === 0) {
    return defaults;
  }

  return {
    activeWorkspaceId: candidate.activeWorkspaceId ?? candidate.workspaces[0].id,
    workspaces: candidate.workspaces.map((workspace) => ({
      ...createWorkspace(workspace.id, workspace.name),
      ...workspace,
    })),
  };
};
