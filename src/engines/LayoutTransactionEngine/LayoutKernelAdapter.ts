import { buildGeometryPatches } from "./GeometryPatchBuilder";
import { analyzeLayoutSnapshot } from "./LayoutSnapshotAnalyzer";
import { buildLayoutCluster } from "./LayoutClusterBuilder";
import { solveBorrowSpace } from "./BorrowSpaceSolver";
import { solveConstraints } from "./ConstraintSolver";
import type { GeometryPatch } from "./GeometryPatch";
import { mergeRegionFlowIntoLayoutSolution } from "./RegionFlowBridge";
import { solveRegionFlow } from "./RegionFlowSolver";
import { solveSmartLayout } from "./SmartLayoutSolver";
import { buildLayoutSolution } from "./TransactionBuilder";
import { rectArea, rectKey, rectsOverlap } from "./LayoutGeometry";
import type {
  ConstraintRequest,
  LayoutColumn,
  LayoutFrameSnapshot,
  LayoutRect,
  LayoutSnapshot,
  LayoutSolution,
  NeighborResizeDirection,
} from "./LayoutTransactionTypes";

export type LayoutKernelResizeRequest = {
  pageId: string;
  pageBounds: LayoutRect;
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  frames: LayoutFrameSnapshot[];
  sourceFrameId: string;
  before: LayoutRect;
  requested: LayoutRect;
  minSize?: ConstraintRequest["minSize"];
  maxSize?: ConstraintRequest["maxSize"];
  preferredSize?: ConstraintRequest["preferredSize"];
  baselineGridSize?: number;
};

export type LayoutKernelMoveRequest = Omit<LayoutKernelResizeRequest, "minSize" | "maxSize" | "preferredSize">;

export type LayoutKernelDeleteRequest = Omit<LayoutKernelMoveRequest, "before" | "requested">;

export type LayoutGeometryDiff = {
  frameId: string;
  oldRect: LayoutRect;
  newRect: LayoutRect;
  changed: boolean;
  delta: Required<LayoutRect>;
  areaDelta: number;
};

export type LayoutWhitespaceDiff = {
  oldCellCount: number;
  newCellCount: number;
  oldArea: number;
  newArea: number;
  areaDelta: number;
};

export type LayoutCollisionDiff = {
  oldCollisionCount: number;
  newCollisionCount: number;
  resolvedCollisionDelta: number;
};

export type LayoutKernelPerformanceMetrics = {
  snapshotTimeMs: number;
  constraintTimeMs: number;
  neighborTimeMs: number;
  spaceTimeMs: number;
  patchTimeMs: number;
  solveTimeMs: number;
  diffTimeMs: number;
  totalTimeMs: number;
};

export type LayoutDiff = {
  shadowMode: true;
  sourceFrameId: string;
  resizeDirection: NeighborResizeDirection;
  requiredSpace: number;
  geometryDifferences: LayoutGeometryDiff[];
  whitespaceDifferences: LayoutWhitespaceDiff;
  collisionDifferences: LayoutCollisionDiff;
  constraintViolations: string[];
  warnings: string[];
  performance: LayoutKernelPerformanceMetrics;
  solution: LayoutSolution;
};

const performanceNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getResizeDirection = (before: LayoutRect, requested: LayoutRect): NeighborResizeDirection => {
  const widthDelta = requested.width - before.width;
  const heightDelta = requested.height - before.height;
  const xDelta = requested.x - before.x;
  const yDelta = requested.y - before.y;

  if (Math.abs(widthDelta) >= Math.abs(heightDelta)) {
    return xDelta < 0 ? "left" : "right";
  }

  return yDelta < 0 ? "top" : "bottom";
};

const getRequiredSpace = (before: LayoutRect, requested: LayoutRect, direction: NeighborResizeDirection) => {
  if (direction === "left" || direction === "right" || direction === "horizontal") {
    return Math.max(0, Math.abs(requested.width - before.width));
  }

  return Math.max(0, Math.abs(requested.height - before.height));
};

const getResizeDelta = (before: LayoutRect, requested: LayoutRect) => ({
  x: requested.x - before.x,
  y: requested.y - before.y,
  width: requested.width - before.width,
  height: requested.height - before.height,
});

const countCollisions = (rects: LayoutRect[] & { id?: string }[]) => {
  let collisionCount = 0;

  for (let firstIndex = 0; firstIndex < rects.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < rects.length; secondIndex += 1) {
      if (rectsOverlap(rects[firstIndex], rects[secondIndex])) {
        collisionCount += 1;
      }
    }
  }

  return collisionCount;
};

const getWhitespaceArea = (snapshot: LayoutSnapshot) =>
  snapshot.whitespaceMap.reduce((sum, cell) => sum + cell.area, 0);

const buildSolutionSnapshot = (
  request: LayoutKernelResizeRequest | LayoutKernelMoveRequest | LayoutKernelDeleteRequest,
  solution: LayoutSolution,
) =>
  analyzeLayoutSnapshot({
    pageId: request.pageId,
    pageBounds: request.pageBounds,
    contentBounds: request.contentBounds,
    columns: request.columns,
    frames: request.frames.map((frame) => ({
      ...frame,
      ...(solution.after[frame.id] ?? frame),
    })),
  });

const getDeleteClusterSourceId = (snapshot: LayoutSnapshot, sourceFrameId: string) => {
  const node = snapshot.neighborGraph.nodes[sourceFrameId];
  const candidates = [
    ...(node?.bottom ?? []),
    ...(node?.right ?? []),
    ...(node?.top ?? []),
    ...(node?.left ?? []),
  ]
    .map((edge) => snapshot.framesById[edge.to])
    .filter((frame) => frame && !frame.locked && !frame.pinned && frame.kind !== "advertisement")
    .sort((first, second) =>
      first.y - second.y ||
      first.x - second.x ||
      first.id.localeCompare(second.id),
    );

  return candidates[0]?.id ?? snapshot.visibleFrames.find((frame) =>
    frame.id !== sourceFrameId &&
    !frame.locked &&
    !frame.pinned &&
    frame.kind !== "advertisement"
  )?.id ?? null;
};

const buildDeleteLayoutSolution = ({
  request,
  snapshot,
}: {
  request: LayoutKernelDeleteRequest;
  snapshot: LayoutSnapshot;
}) => {
  const source = snapshot.framesById[request.sourceFrameId];

  if (!source) {
    return buildLayoutSolution({
      snapshot,
      proposed: new Map(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }])),
      unresolvedCollisionCount: 0,
      warnings: [],
      errors: [`Delete source frame '${request.sourceFrameId}' was not found.`],
    });
  }

  if (source.locked || source.pinned || source.kind === "advertisement") {
    return buildLayoutSolution({
      snapshot,
      proposed: new Map(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }])),
      unresolvedCollisionCount: 0,
      warnings: [],
      errors: [`Delete source frame '${request.sourceFrameId}' is protected and cannot be deleted.`],
    });
  }

  const remainingFrames = snapshot.frames.filter((frame) => frame.id !== request.sourceFrameId);
  const remainingSnapshot = analyzeLayoutSnapshot({
    pageId: request.pageId,
    pageBounds: request.pageBounds,
    contentBounds: request.contentBounds,
    columns: request.columns,
    frames: remainingFrames,
  });
  const clusterSourceId = getDeleteClusterSourceId(snapshot, request.sourceFrameId);

  if (!clusterSourceId || !remainingSnapshot.framesById[clusterSourceId]) {
    return buildLayoutSolution({
      snapshot,
      proposed: new Map(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }])),
      unresolvedCollisionCount: 0,
      warnings: [],
      errors: ["No editable neighboring story exists to repair the deleted region."],
    });
  }

  const cluster = buildLayoutCluster({
    snapshot: remainingSnapshot,
    sourceFrameId: clusterSourceId,
  });
  const balancedCluster = solveRegionFlow({
    cluster,
    contentBounds: request.contentBounds,
    columns: request.columns,
  });
  const proposed = new Map<string, LayoutRect>(
    snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }]),
  );

  for (const [frameId, rect] of Object.entries(balancedCluster.after)) {
    proposed.set(frameId, { ...rect });
  }

  return buildLayoutSolution({
    snapshot,
    proposed,
    unresolvedCollisionCount: 0,
    warnings: [
      `Delete cluster '${cluster.id}' repaired ${balancedCluster.changedFrameIds.length} frame(s).`,
      ...balancedCluster.warnings,
    ],
    errors: [],
  });
};

const createMovePatches = ({
  sourceFrameId,
  before,
  requested,
}: {
  sourceFrameId: string;
  before: LayoutRect;
  requested: LayoutRect;
}): GeometryPatch[] => {
  const patches: GeometryPatch[] = [];
  const dx = requested.x - before.x;
  const dy = requested.y - before.y;

  if (dx !== 0) {
    patches.push({
      id: ["geometry-patch", 1, sourceFrameId, "translate", dx > 0 ? "right" : "left", Math.abs(dx)].join(":"),
      frameId: sourceFrameId,
      operation: "translate",
      direction: dx > 0 ? "right" : "left",
      amount: Math.abs(dx),
      priority: 0,
      reason: `Source frame move intent translated horizontally by ${dx}.`,
      dependencies: [],
    });
  }

  if (dy !== 0) {
    patches.push({
      id: ["geometry-patch", patches.length + 1, sourceFrameId, "translate", dy > 0 ? "bottom" : "top", Math.abs(dy)].join(":"),
      frameId: sourceFrameId,
      operation: "translate",
      direction: dy > 0 ? "bottom" : "top",
      amount: Math.abs(dy),
      priority: 0,
      reason: `Source frame move intent translated vertically by ${dy}.`,
      dependencies: [],
    });
  }

  return patches;
};

const applyRegionFlowBridge = ({
  request,
  snapshot,
  solution,
}: {
  request: LayoutKernelResizeRequest | LayoutKernelMoveRequest;
  snapshot: LayoutSnapshot;
  solution: LayoutSolution;
}) => {
  if (!solution.valid) {
    return solution;
  }

  const cluster = buildLayoutCluster({
    snapshot,
    sourceFrameId: request.sourceFrameId,
  });
  const balancedCluster = solveRegionFlow({
    cluster,
    contentBounds: request.contentBounds,
    columns: request.columns,
    proposedRects: solution.after,
  });

  const merged = mergeRegionFlowIntoLayoutSolution({
    solution,
    balancedCluster,
  });
  const solvedChangedIds = new Set(
    solution.geometryChanges
      .filter((change) => change.changed && solution.after[change.frameId])
      .map((change) => change.frameId),
  );

  if (solvedChangedIds.size === 0) {
    return merged;
  }

  const after = { ...merged.after };

  for (const frameId of solvedChangedIds) {
    const solvedAfter = solution.after[frameId];

    if (solvedAfter) {
      after[frameId] = { ...solvedAfter };
    }
  }

  const geometryChanges = merged.geometryChanges.map((change) => {
    if (!solvedChangedIds.has(change.frameId)) {
      return change;
    }

    const sourceAfter = after[change.frameId];
    const changed = rectKey(change.before) !== rectKey(sourceAfter);

    return {
      ...change,
      after: { ...sourceAfter },
      changed,
      reasons: changed ? change.reasons : [],
    };
  });
  const changedIds = new Set(geometryChanges.filter((change) => change.changed).map((change) => change.frameId));

  return {
    ...merged,
    after,
    geometryChanges,
    affectedFrames: merged.affectedFrames.filter((frameId) => changedIds.has(frameId)),
    dirtyFrames: merged.dirtyFrames.filter((frameId) => changedIds.has(frameId)),
  };
};

const preserveImmutableFrames = (
  snapshot: LayoutSnapshot,
  solution: LayoutSolution,
): LayoutSolution => {
  const immutableIds = new Set(
    snapshot.visibleFrames
      .filter((frame) => frame.locked || frame.pinned || frame.kind === "advertisement")
      .map((frame) => frame.id),
  );

  if (immutableIds.size === 0) {
    return solution;
  }

  const after = {
    ...solution.after,
  };

  for (const frameId of immutableIds) {
    const frame = snapshot.framesById[frameId];

    if (frame) {
      after[frameId] = {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      };
    }
  }

  const geometryChanges = solution.geometryChanges.map((change) =>
    immutableIds.has(change.frameId)
      ? {
          ...change,
          after: after[change.frameId],
          changed: false,
          reasons: [],
        }
      : change,
  );
  const changedIds = new Set(geometryChanges.filter((change) => change.changed).map((change) => change.frameId));

  return {
    ...solution,
    after,
    geometryChanges,
    affectedFrames: solution.affectedFrames.filter((frameId) => changedIds.has(frameId)),
    dirtyFrames: solution.dirtyFrames.filter((frameId) => changedIds.has(frameId)),
  };
};

const diffGeometry = (snapshot: LayoutSnapshot, solution: LayoutSolution): LayoutGeometryDiff[] =>
  snapshot.visibleFrames
    .map((frame) => {
      const newRect = solution.after[frame.id] ?? frame;

      return {
        frameId: frame.id,
        oldRect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
        newRect,
        changed: rectKey(frame) !== rectKey(newRect),
        delta: {
          x: newRect.x - frame.x,
          y: newRect.y - frame.y,
          width: newRect.width - frame.width,
          height: newRect.height - frame.height,
        },
        areaDelta: rectArea(newRect) - rectArea(frame),
      };
    })
    .filter((diff) => diff.changed)
    .sort((a, b) => a.frameId.localeCompare(b.frameId));

/**
 * Runs the deterministic layout kernel in shadow mode for an editor resize.
 *
 * The adapter converts editor geometry into kernel requests, runs the solver
 * stack, compares old and proposed layout state, and returns diagnostics. It
 * never commits or mutates editor state.
 */
export const runLayoutKernelShadowResize = (request: LayoutKernelResizeRequest): LayoutDiff => {
  const startedAt = performanceNow();
  const snapshotStart = performanceNow();
  const snapshot = analyzeLayoutSnapshot({
    pageId: request.pageId,
    pageBounds: request.pageBounds,
    contentBounds: request.contentBounds,
    columns: request.columns,
    frames: request.frames,
  });
  const snapshotTimeMs = performanceNow() - snapshotStart;
  const direction = getResizeDirection(request.before, request.requested);
  const requiredSpace = getRequiredSpace(request.before, request.requested, direction);

  const constraintStart = performanceNow();
  const resizeRequest = {
    sourceFrameId: request.sourceFrameId,
    direction,
    requiredSpace,
    requestedRect: request.requested,
  };
  const borrow = solveBorrowSpace({
    snapshot,
    intent: resizeRequest,
    minSize: request.minSize,
    maxSize: request.maxSize,
  });
  const constraint = solveConstraints(snapshot, {
    frameId: request.sourceFrameId,
    operation: "resize",
    delta: getResizeDelta(request.before, request.requested),
    proposedFrames: borrow.proposedFrames,
    minSize: request.minSize,
    maxSize: request.maxSize,
    preferredSize: request.preferredSize,
  });
  const constraintTimeMs = performanceNow() - constraintStart;

  const neighborStart = performanceNow();
  const neighborSolution = constraint.allowed
    ? borrow.neighborSolution
    : {
        ...borrow.neighborSolution,
        candidates: [],
        remainingUnresolvedSpace: Math.max(0, requiredSpace),
        reasons: [
          ...borrow.neighborSolution.reasons,
          "Proposed temporary allocation failed constraint validation; neighbor solution discarded.",
        ],
      };
  const neighborTimeMs = performanceNow() - neighborStart;

  const spaceStart = performanceNow();
  const spaceSolution = constraint.allowed
    ? borrow.spaceSolution
    : {
        ...borrow.spaceSolution,
        requiredSpace: 0,
        resolvedSpace: 0,
        remainingSpace: Math.max(0, requiredSpace),
        allocations: [],
        solverWarnings: [
          ...borrow.spaceSolution.solverWarnings,
          "Proposed temporary allocation failed constraint validation; no space allocation was accepted.",
        ],
      };
  const spaceTimeMs = performanceNow() - spaceStart;

  const patchStart = performanceNow();
  const patchResult = buildGeometryPatches({
    snapshot,
    constraint,
    neighborSolution,
    spaceSolution,
  });
  const patchTimeMs = performanceNow() - patchStart;

  const solveStart = performanceNow();
  const solvedSolution = solveSmartLayout({
    snapshot,
    patches: patchResult.patches,
    baselineGridSize: request.baselineGridSize,
  });
  const solution = preserveImmutableFrames(
    snapshot,
    applyRegionFlowBridge({
      request,
      snapshot,
      solution: solvedSolution,
    }),
  );
  const solveTimeMs = performanceNow() - solveStart;

  const diffStart = performanceNow();
  const solutionSnapshot = buildSolutionSnapshot(request, solution);
  const geometryDifferences = diffGeometry(snapshot, solution);
  const whitespaceDifferences = {
    oldCellCount: snapshot.whitespaceMap.length,
    newCellCount: solutionSnapshot.whitespaceMap.length,
    oldArea: getWhitespaceArea(snapshot),
    newArea: getWhitespaceArea(solutionSnapshot),
    areaDelta: getWhitespaceArea(solutionSnapshot) - getWhitespaceArea(snapshot),
  };
  const oldCollisionCount = countCollisions(snapshot.visibleFrames);
  const newCollisionCount = countCollisions(solutionSnapshot.visibleFrames);
  const diffTimeMs = performanceNow() - diffStart;

  return {
    shadowMode: true,
    sourceFrameId: request.sourceFrameId,
    resizeDirection: direction,
    requiredSpace,
    geometryDifferences,
    whitespaceDifferences,
    collisionDifferences: {
      oldCollisionCount,
      newCollisionCount,
      resolvedCollisionDelta: oldCollisionCount - newCollisionCount,
    },
    constraintViolations: [
      ...constraint.blockedBy.map((blocker) => blocker.message),
      ...solution.errors,
    ],
    warnings: [
      ...constraint.warnings.map((warning) => warning.message),
      ...neighborSolution.reasons,
      ...spaceSolution.solverWarnings,
      ...patchResult.warnings,
      ...solution.warnings,
    ],
    performance: {
      snapshotTimeMs,
      constraintTimeMs,
      neighborTimeMs,
      spaceTimeMs,
      patchTimeMs,
      solveTimeMs,
      diffTimeMs,
      totalTimeMs: performanceNow() - startedAt,
    },
    solution,
  };
};

/**
 * Runs the deterministic layout kernel in shadow mode for an editor move.
 *
 * Move uses translate patch intents, validates proposed geometry, runs the
 * existing SmartLayoutSolver, then merges connected RegionFlow geometry into
 * the returned LayoutSolution. It never commits or mutates editor state.
 */
export const runLayoutKernelShadowMove = (request: LayoutKernelMoveRequest): LayoutDiff => {
  const startedAt = performanceNow();
  const snapshotStart = performanceNow();
  const snapshot = analyzeLayoutSnapshot({
    pageId: request.pageId,
    pageBounds: request.pageBounds,
    contentBounds: request.contentBounds,
    columns: request.columns,
    frames: request.frames,
  });
  const snapshotTimeMs = performanceNow() - snapshotStart;
  const dx = request.requested.x - request.before.x;
  const dy = request.requested.y - request.before.y;
  const direction: NeighborResizeDirection = Math.abs(dx) >= Math.abs(dy)
    ? dx < 0 ? "left" : "right"
    : dy < 0 ? "top" : "bottom";
  const requiredSpace = Math.max(Math.abs(dx), Math.abs(dy));
  const constraintStart = performanceNow();
  const constraint = solveConstraints(snapshot, {
    frameId: request.sourceFrameId,
    operation: "move",
    delta: getResizeDelta(request.before, request.requested),
    proposedFrames: {
      [request.sourceFrameId]: request.requested,
    },
  });
  const constraintTimeMs = performanceNow() - constraintStart;
  const neighborTimeMs = 0;
  const spaceTimeMs = 0;
  const patchStart = performanceNow();
  const patches = constraint.allowed
    ? createMovePatches({
        sourceFrameId: request.sourceFrameId,
        before: request.before,
        requested: request.requested,
      })
    : [];
  const patchTimeMs = performanceNow() - patchStart;

  const solveStart = performanceNow();
  const solvedSolution = solveSmartLayout({
    snapshot,
    patches,
    baselineGridSize: request.baselineGridSize,
  });
  const solution = constraint.allowed
    ? preserveImmutableFrames(
        snapshot,
        applyRegionFlowBridge({
          request,
          snapshot,
          solution: solvedSolution,
        }),
      )
    : {
        ...solvedSolution,
        valid: false,
        errors: [
          ...solvedSolution.errors,
          ...constraint.blockedBy.map((blocker) => blocker.message),
        ],
      };
  const solveTimeMs = performanceNow() - solveStart;

  const diffStart = performanceNow();
  const solutionSnapshot = buildSolutionSnapshot(request, solution);
  const geometryDifferences = diffGeometry(snapshot, solution);
  const whitespaceDifferences = {
    oldCellCount: snapshot.whitespaceMap.length,
    newCellCount: solutionSnapshot.whitespaceMap.length,
    oldArea: getWhitespaceArea(snapshot),
    newArea: getWhitespaceArea(solutionSnapshot),
    areaDelta: getWhitespaceArea(solutionSnapshot) - getWhitespaceArea(snapshot),
  };
  const oldCollisionCount = countCollisions(snapshot.visibleFrames);
  const newCollisionCount = countCollisions(solutionSnapshot.visibleFrames);
  const diffTimeMs = performanceNow() - diffStart;

  return {
    shadowMode: true,
    sourceFrameId: request.sourceFrameId,
    resizeDirection: direction,
    requiredSpace,
    geometryDifferences,
    whitespaceDifferences,
    collisionDifferences: {
      oldCollisionCount,
      newCollisionCount,
      resolvedCollisionDelta: oldCollisionCount - newCollisionCount,
    },
    constraintViolations: [
      ...constraint.blockedBy.map((blocker) => blocker.message),
      ...solution.errors,
    ],
    warnings: [
      ...constraint.warnings.map((warning) => warning.message),
      ...(constraint.allowed ? [] : ["Constraint result is blocked; move patch intents were not created."]),
      ...solution.warnings,
    ],
    performance: {
      snapshotTimeMs,
      constraintTimeMs,
      neighborTimeMs,
      spaceTimeMs,
      patchTimeMs,
      solveTimeMs,
      diffTimeMs,
      totalTimeMs: performanceNow() - startedAt,
    },
    solution,
  };
};

/**
 * Runs the deterministic layout kernel in shadow mode for a story delete.
 *
 * Delete removes the source from the repair snapshot, builds a connected
 * editable cluster from its neighbors, lets RegionFlow close the resulting
 * whitespace, and returns diagnostics without mutating editor state.
 */
export const runLayoutKernelShadowDelete = (request: LayoutKernelDeleteRequest): LayoutDiff => {
  const startedAt = performanceNow();
  const snapshotStart = performanceNow();
  const snapshot = analyzeLayoutSnapshot({
    pageId: request.pageId,
    pageBounds: request.pageBounds,
    contentBounds: request.contentBounds,
    columns: request.columns,
    frames: request.frames,
  });
  const snapshotTimeMs = performanceNow() - snapshotStart;
  const constraintStart = performanceNow();
  const constraint = solveConstraints(snapshot, {
    frameId: request.sourceFrameId,
    operation: "delete",
    delta: {},
  });
  const constraintTimeMs = performanceNow() - constraintStart;
  const solveStart = performanceNow();
  const repairedSolution = constraint.allowed
    ? buildDeleteLayoutSolution({ request, snapshot })
    : buildLayoutSolution({
        snapshot,
        proposed: new Map(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }])),
        unresolvedCollisionCount: 0,
        warnings: [],
        errors: constraint.blockedBy.map((blocker) => blocker.message),
      });
  const solution = preserveImmutableFrames(snapshot, repairedSolution);
  const solveTimeMs = performanceNow() - solveStart;
  const diffStart = performanceNow();
  const solutionSnapshot = buildSolutionSnapshot(request, solution);
  const geometryDifferences = diffGeometry(snapshot, solution);
  const whitespaceDifferences = {
    oldCellCount: snapshot.whitespaceMap.length,
    newCellCount: solutionSnapshot.whitespaceMap.length,
    oldArea: getWhitespaceArea(snapshot),
    newArea: getWhitespaceArea(solutionSnapshot),
    areaDelta: getWhitespaceArea(solutionSnapshot) - getWhitespaceArea(snapshot),
  };
  const oldCollisionCount = countCollisions(snapshot.visibleFrames);
  const newCollisionCount = countCollisions(solutionSnapshot.visibleFrames);
  const diffTimeMs = performanceNow() - diffStart;

  return {
    shadowMode: true,
    sourceFrameId: request.sourceFrameId,
    resizeDirection: "vertical",
    requiredSpace: snapshot.framesById[request.sourceFrameId]?.height ?? 0,
    geometryDifferences,
    whitespaceDifferences,
    collisionDifferences: {
      oldCollisionCount,
      newCollisionCount,
      resolvedCollisionDelta: oldCollisionCount - newCollisionCount,
    },
    constraintViolations: [
      ...constraint.blockedBy.map((blocker) => blocker.message),
      ...solution.errors,
    ],
    warnings: [
      ...constraint.warnings.map((warning) => warning.message),
      ...solution.warnings,
    ],
    performance: {
      snapshotTimeMs,
      constraintTimeMs,
      neighborTimeMs: 0,
      spaceTimeMs: 0,
      patchTimeMs: 0,
      solveTimeMs,
      diffTimeMs,
      totalTimeMs: performanceNow() - startedAt,
    },
    solution,
  };
};

/** Public facade for shadow-mode layout kernel diagnostics. */
export const LayoutKernelAdapter = {
  runLayoutKernelShadowDelete,
  runLayoutKernelShadowMove,
  runLayoutKernelShadowResize,
};
