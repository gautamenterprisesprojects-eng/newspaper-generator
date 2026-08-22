import { overlapLength, rectBottom, rectContains, rectRight } from "./LayoutGeometry";
import { getNeighborPriorityScore, rankNeighborCandidates } from "./NeighborRanking";
import type {
  ConstraintResult,
  LayoutFrameSnapshot,
  LayoutNeighborDirection,
  LayoutSnapshot,
  LayoutWhitespaceCell,
  NeighborCandidate,
  NeighborResizeDirection,
} from "./LayoutTransactionTypes";

const directionToGraphKeys = (direction: NeighborResizeDirection): LayoutNeighborDirection[] => {
  if (direction === "horizontal") {
    return ["left", "right"];
  }

  if (direction === "vertical") {
    return ["top", "bottom"];
  }

  return [direction];
};

const getFrameCapacity = (
  frame: LayoutFrameSnapshot,
  direction: NeighborResizeDirection,
  constraint: ConstraintResult,
) => {
  const minShrinkWidth = constraint.limits.shrink.width;
  const minShrinkHeight = constraint.limits.shrink.height;

  if (direction === "left" || direction === "right" || direction === "horizontal") {
    return Math.max(0, Math.min(frame.width - 1, minShrinkWidth || frame.width - 1));
  }

  return Math.max(0, Math.min(frame.height - 1, minShrinkHeight || frame.height - 1));
};

const getWhitespaceCapacity = (cell: LayoutWhitespaceCell, direction: NeighborResizeDirection) =>
  direction === "left" || direction === "right" || direction === "horizontal"
    ? Math.max(0, cell.width)
    : Math.max(0, cell.height);

const getWhitespaceDistance = (
  source: LayoutFrameSnapshot,
  cell: LayoutWhitespaceCell,
  direction: NeighborResizeDirection,
) => {
  if (direction === "right") {
    return Math.max(0, cell.x - rectRight(source));
  }

  if (direction === "left") {
    return Math.max(0, source.x - rectRight(cell));
  }

  if (direction === "bottom") {
    return Math.max(0, cell.y - rectBottom(source));
  }

  if (direction === "top") {
    return Math.max(0, source.y - rectBottom(cell));
  }

  return Math.min(
    Math.abs(cell.x - source.x),
    Math.abs(cell.y - source.y),
  );
};

const getWhitespaceAlignment = (
  source: LayoutFrameSnapshot,
  cell: LayoutWhitespaceCell,
  direction: NeighborResizeDirection,
) => {
  const shared =
    direction === "left" || direction === "right" || direction === "horizontal"
      ? overlapLength(source.y, rectBottom(source), cell.y, rectBottom(cell))
      : overlapLength(source.x, rectRight(source), cell.x, rectRight(cell));

  const basis =
    direction === "left" || direction === "right" || direction === "horizontal"
      ? Math.min(source.height, cell.height)
      : Math.min(source.width, cell.width);

  return shared / Math.max(1, basis);
};

const isWhitespaceInDirection = (
  source: LayoutFrameSnapshot,
  cell: LayoutWhitespaceCell,
  direction: NeighborResizeDirection,
) => {
  if (direction === "right") {
    return cell.x >= rectRight(source);
  }

  if (direction === "left") {
    return rectRight(cell) <= source.x;
  }

  if (direction === "bottom") {
    return cell.y >= rectBottom(source);
  }

  if (direction === "top") {
    return rectBottom(cell) <= source.y;
  }

  return true;
};

const isHardRejected = (snapshot: LayoutSnapshot, frame: LayoutFrameSnapshot) =>
  frame.kind === "advertisement" ||
  frame.locked ||
  frame.pinned ||
  !rectContains(snapshot.pageBounds, frame) ||
  (typeof frame.columnSpan === "number" && (frame.columnSpan < 1 || frame.columnSpan > snapshot.columns.length));

/** Selects and ranks legal neighboring frame and whitespace candidates. */
export const selectNeighborCandidates = ({
  snapshot,
  constraint,
  direction,
}: {
  snapshot: LayoutSnapshot;
  constraint: ConstraintResult;
  direction: NeighborResizeDirection;
}) => {
  const source = snapshot.framesById[constraint.frameId];
  const rejectedCandidateIds: string[] = [];

  if (!source) {
    return {
      candidates: [],
      rejectedCandidateIds,
    };
  }

  const candidateById = new Map<string, NeighborCandidate>();
  const readingOrder = new Map(snapshot.visibleFrames.map((frame, index) => [frame.id, index]));
  const graphNode = snapshot.neighborGraph.nodes[source.id];

  for (const graphKey of directionToGraphKeys(direction)) {
    for (const edge of graphNode?.[graphKey] ?? []) {
      const frame = snapshot.framesById[edge.to];

      if (!frame || isHardRejected(snapshot, frame)) {
        rejectedCandidateIds.push(edge.to);
        continue;
      }

      const capacity = getFrameCapacity(frame, direction, constraint);

      if (capacity <= 0) {
        rejectedCandidateIds.push(edge.to);
        continue;
      }

      const candidate: NeighborCandidate = {
        id: frame.id,
        kind: frame.kind,
        frameId: frame.id,
        capacity,
        distance: edge.gap,
        alignmentScore: edge.overlapRatio,
        editorialPriority: frame.priority,
        priorityScore: getNeighborPriorityScore({ kind: frame.kind, editorialPriority: frame.priority }),
        readingOrder: readingOrder.get(frame.id) ?? Number.MAX_SAFE_INTEGER,
        reasons: [`${graphKey} neighbor from graph`, `capacity ${capacity}`],
      };

      candidateById.set(candidate.id, candidate);
    }
  }

  for (const cell of snapshot.whitespaceMap.filter((space) => isWhitespaceInDirection(source, space, direction))) {
    const capacity = getWhitespaceCapacity(cell, direction);
    const alignmentScore = getWhitespaceAlignment(source, cell, direction);

    if (capacity <= 0 || alignmentScore <= 0) {
      rejectedCandidateIds.push(cell.id);
      continue;
    }

    const candidate: NeighborCandidate = {
      id: cell.id,
      kind: "whitespace",
      capacity,
      distance: getWhitespaceDistance(source, cell, direction),
      alignmentScore,
      priorityScore: getNeighborPriorityScore({ kind: "whitespace" }),
      readingOrder: Number.MAX_SAFE_INTEGER,
      reasons: [
        cell.boundedBy.includes(source.id) ? "bounded source whitespace" : "directional aligned whitespace",
        `column ${cell.columnIndex ?? "-"}`,
        `capacity ${capacity}`,
      ],
    };

    candidateById.set(candidate.id, candidate);
  }

  return {
    candidates: rankNeighborCandidates([...candidateById.values()]),
    rejectedCandidateIds: [...new Set(rejectedCandidateIds)].sort(),
  };
};
