import { rectBottom, rectRight } from "./LayoutGeometry";
import type {
  ConstraintLimits,
  ConstraintOperation,
  ConstraintResolvedPriority,
  LayoutFrameSnapshot,
  LayoutSnapshot,
} from "./LayoutTransactionTypes";

const priorityWeights = {
  lead: 100,
  major: 80,
  secondary: 60,
  brief: 40,
  filler: 20,
} as const;

/** Returns true when an operation would mutate source geometry. */
export const operationChangesGeometry = (operation: ConstraintOperation) =>
  operation === "resize" ||
  operation === "move" ||
  operation === "merge" ||
  operation === "split" ||
  operation === "automatic-placement";

/** Returns deterministic editorial weight for constraint conflict ordering. */
export const getEditorialPriorityWeight = (frame: Pick<LayoutFrameSnapshot, "priority">) =>
  frame.priority ? priorityWeights[frame.priority] : 50;

/** Computes source frame movement and resize limits from current content bounds. */
export const getFrameBoundaryLimits = (
  snapshot: LayoutSnapshot,
  frame: LayoutFrameSnapshot,
): ConstraintLimits => ({
  grow: {
    left: Math.max(0, frame.x - snapshot.contentBounds.x),
    right: Math.max(0, rectRight(snapshot.contentBounds) - rectRight(frame)),
    top: Math.max(0, frame.y - snapshot.contentBounds.y),
    bottom: Math.max(0, rectBottom(snapshot.contentBounds) - rectBottom(frame)),
  },
  shrink: {
    width: Math.max(0, frame.width - 1),
    height: Math.max(0, frame.height - 1),
  },
  move: {
    left: Math.max(0, frame.x - snapshot.contentBounds.x),
    right: Math.max(0, rectRight(snapshot.contentBounds) - rectRight(frame)),
    up: Math.max(0, frame.y - snapshot.contentBounds.y),
    down: Math.max(0, rectBottom(snapshot.contentBounds) - rectBottom(frame)),
  },
});

/** Resolves source, neighbor, and whitespace priorities in stable order. */
export const resolveConstraintPriorities = (
  snapshot: LayoutSnapshot,
  frame: LayoutFrameSnapshot,
): ConstraintResolvedPriority[] => {
  const neighborIds = new Set(
    Object.values(snapshot.neighborGraph.nodes[frame.id] ?? {})
      .flatMap((value) => Array.isArray(value) ? value.map((edge) => edge.to) : [])
      .filter((id): id is string => typeof id === "string"),
  );
  const priorities: ConstraintResolvedPriority[] = [
    {
      frameId: frame.id,
      priority: getEditorialPriorityWeight(frame),
      editorialPriority: frame.priority,
      role: "source",
      reason: "Source frame priority.",
    },
  ];

  for (const neighborId of [...neighborIds].sort()) {
    const neighbor = snapshot.framesById[neighborId];

    if (neighbor) {
      priorities.push({
        frameId: neighbor.id,
        priority: getEditorialPriorityWeight(neighbor),
        editorialPriority: neighbor.priority,
        role: "neighbor",
        reason: "Adjacent frame priority.",
      });
    }
  }

  for (const cell of snapshot.whitespaceMap.filter((space) => space.boundedBy.includes(frame.id))) {
    priorities.push({
      frameId: cell.id,
      priority: Math.max(1, Math.round(cell.area / 1000)),
      role: "whitespace",
      reason: "Whitespace adjacent to source frame.",
    });
  }

  return priorities.sort((a, b) => b.priority - a.priority || a.role.localeCompare(b.role) || a.frameId.localeCompare(b.frameId));
};

/** Returns the nearest column index containing a frame's left and right edges. */
export const getColumnGridAlignment = (
  snapshot: LayoutSnapshot,
  frame: LayoutFrameSnapshot,
) => {
  const tolerance = snapshot.gapTolerance ?? 1;
  const leftColumn = snapshot.columns.find((column) => Math.abs(column.x - frame.x) <= tolerance);
  const rightColumn = snapshot.columns.find((column) => Math.abs(rectRight(column) - rectRight(frame)) <= tolerance);

  return {
    leftAligned: Boolean(leftColumn),
    rightAligned: Boolean(rightColumn),
    leftColumnIndex: leftColumn?.index,
    rightColumnIndex: rightColumn?.index,
  };
};
