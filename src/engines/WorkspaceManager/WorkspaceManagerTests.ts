import assert from "node:assert/strict";
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
} from "./WorkspaceManagerEngine";

let state = createDefaultWorkspaceState();

assert.equal(getActiveWorkspace(state).name, "Editorial");
assert.equal(getActiveWorkspace(state).docks.left.activePanelId, "frames");

state = activateDockPanel(state, "left", "assets");
assert.equal(getActiveWorkspace(state).docks.left.activePanelId, "assets");

state = toggleDockCollapsed(state, "left");
assert.equal(getActiveWorkspace(state).docks.left.collapsed, true);

state = movePanelToDock(state, "styles", "right");
assert.equal(getActiveWorkspace(state).panels.styles.dock, "right");
assert.ok(getActiveWorkspace(state).docks.right.panelIds.includes("styles"));

state = setActiveWorkspace(state, "layout");
assert.equal(getActiveWorkspace(state).name, "Layout");

state = duplicateWorkspace(state, "layout");
assert.ok(getActiveWorkspace(state).name.includes("Copy"));

state = renameWorkspace(state, state.activeWorkspaceId, "Custom Layout");
assert.equal(getActiveWorkspace(state).name, "Custom Layout");

state = resetWorkspace(state, state.activeWorkspaceId);
assert.equal(getActiveWorkspace(state).docks.left.activePanelId, "frames");

state = deleteWorkspace(state, state.activeWorkspaceId);
assert.ok(state.workspaces.length >= 1);

assert.equal(normalizeWorkspaceState({}).activeWorkspaceId, "editorial");

console.log("WorkspaceManagerTests passed");
