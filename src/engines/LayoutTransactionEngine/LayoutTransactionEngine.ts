import { analyzeLayoutSnapshot } from "./LayoutSnapshotAnalyzer";
import { buildColumnBands, buildRowBands } from "./BandAnalyzer";
import { buildLayoutCluster } from "./LayoutClusterBuilder";
import { solveBorrowSpace } from "./BorrowSpaceSolver";
import { buildGeometryPatches } from "./GeometryPatchBuilder";
import { commitLayoutSolution } from "./LayoutCommitEngine";
import { buildNeighborGraph } from "./NeighborGraphAnalyzer";
import { runLayoutKernelShadowDelete, runLayoutKernelShadowMove, runLayoutKernelShadowResize } from "./LayoutKernelAdapter";
import { createLiveResizeController } from "./LiveResizeController";
import { buildPreviewDrawCommands } from "./PreviewRenderer";
import { mergeRegionFlowIntoLayoutSolution } from "./RegionFlowBridge";
import { solveRegionFlow } from "./RegionFlowSolver";
import { solveConstraints } from "./ConstraintSolver";
import { solveNeighbors } from "./NeighborSolver";
import { solveSpace } from "./SpaceSolver";
import { solveSmartLayout } from "./SmartLayoutSolver";
import { validateLayoutTransaction } from "./LayoutTransactionValidation";
import { buildWhitespaceMap } from "./WhitespaceAnalyzer";
import type { LayoutGeometryPatch, LayoutSnapshot, LayoutTransaction } from "./LayoutTransactionTypes";

const getTransactionId = (pageId: string, sourceFrameId: string, patches: LayoutGeometryPatch[]) =>
  [
    "layout-tx",
    pageId,
    sourceFrameId,
    patches.map((patch) => `${patch.frameId}:${patch.reason}`).join("."),
  ].join(":");

/**
 * Creates an immutable geometry transaction from validated patch data.
 *
 * The helper intentionally does not solve geometry. It standardizes transaction
 * shape for future editorStore integration and validation.
 */
export const createLayoutTransaction = ({
  snapshot,
  sourceFrameId,
  kind,
  patches,
}: {
  snapshot: LayoutSnapshot;
  sourceFrameId: string;
  kind: LayoutTransaction["kind"];
  patches: LayoutGeometryPatch[];
}): LayoutTransaction => ({
  id: getTransactionId(snapshot.pageId, sourceFrameId, patches),
  pageId: snapshot.pageId,
  sourceFrameId,
  kind,
  patches: patches.map((patch) => ({ ...patch })),
  affectedFrameIds: [...new Set(patches.map((patch) => patch.frameId))].sort(),
  createdAtVersion: snapshot.version,
});

/** Public facade for snapshot analysis, transaction creation, and validation. */
export const LayoutTransactionEngine = {
  analyzeLayoutSnapshot,
  buildLayoutCluster,
  buildGeometryPatches,
  buildColumnBands,
  commitLayoutSolution,
  buildNeighborGraph,
  buildRowBands,
  buildWhitespaceMap,
  createLayoutTransaction,
  createLiveResizeController,
  buildPreviewDrawCommands,
  runLayoutKernelShadowDelete,
  runLayoutKernelShadowMove,
  runLayoutKernelShadowResize,
  mergeRegionFlowIntoLayoutSolution,
  solveRegionFlow,
  solveBorrowSpace,
  solveConstraints,
  solveNeighbors,
  solveSpace,
  solveSmartLayout,
  validateLayoutTransaction,
};

export type * from "./LayoutTransactionTypes";
