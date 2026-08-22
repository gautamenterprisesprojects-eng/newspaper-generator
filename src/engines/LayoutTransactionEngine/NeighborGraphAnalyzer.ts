import {
  overlapLength,
  rectBottom,
  rectRight,
  sortRectsReadingOrder,
} from "./LayoutGeometry";
import type {
  LayoutFrameSnapshot,
  LayoutNeighborDirection,
  LayoutNeighborEdge,
  LayoutNeighborGraph,
  LayoutNeighborNode,
} from "./LayoutTransactionTypes";

const createNode = (frameId: string): LayoutNeighborNode => ({
  frameId,
  left: [],
  right: [],
  top: [],
  bottom: [],
});

const oppositeDirection: Record<LayoutNeighborDirection, LayoutNeighborDirection> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};

const addEdge = (
  nodes: Record<string, LayoutNeighborNode>,
  edges: LayoutNeighborEdge[],
  edge: LayoutNeighborEdge,
) => {
  nodes[edge.from][edge.direction].push(edge);
  edges.push(edge);

  const reverse: LayoutNeighborEdge = {
    ...edge,
    from: edge.to,
    to: edge.from,
    direction: oppositeDirection[edge.direction],
  };

  nodes[reverse.from][reverse.direction].push(reverse);
  edges.push(reverse);
};

const createHorizontalEdge = (
  from: LayoutFrameSnapshot,
  to: LayoutFrameSnapshot,
  direction: "left" | "right",
): LayoutNeighborEdge | null => {
  const sharedSpan = overlapLength(from.y, rectBottom(from), to.y, rectBottom(to));

  if (sharedSpan <= 0) {
    return null;
  }

  const gap = direction === "right" ? to.x - rectRight(from) : from.x - rectRight(to);
  const overlapRatio = sharedSpan / Math.max(1, Math.min(from.height, to.height));

  return {
    from: from.id,
    to: to.id,
    direction,
    gap,
    sharedSpan,
    overlapRatio,
    strength: overlapRatio / Math.max(1, gap + 1),
  };
};

const createVerticalEdge = (
  from: LayoutFrameSnapshot,
  to: LayoutFrameSnapshot,
  direction: "top" | "bottom",
): LayoutNeighborEdge | null => {
  const sharedSpan = overlapLength(from.x, rectRight(from), to.x, rectRight(to));

  if (sharedSpan <= 0) {
    return null;
  }

  const gap = direction === "bottom" ? to.y - rectBottom(from) : from.y - rectBottom(to);
  const overlapRatio = sharedSpan / Math.max(1, Math.min(from.width, to.width));

  return {
    from: from.id,
    to: to.id,
    direction,
    gap,
    sharedSpan,
    overlapRatio,
    strength: overlapRatio / Math.max(1, gap + 1),
  };
};

const sortEdges = (edges: LayoutNeighborEdge[]) =>
  edges.sort((first, second) => {
    if (first.gap !== second.gap) {
      return first.gap - second.gap;
    }

    if (second.sharedSpan !== first.sharedSpan) {
      return second.sharedSpan - first.sharedSpan;
    }

    return first.to.localeCompare(second.to);
  });

/**
 * Builds deterministic directional adjacency between visible page frames.
 *
 * The analyzer uses sweep-style sorted scans per axis and stops each scan once
 * the closest candidate band has been exceeded. This keeps normal newspaper
 * pages near O(n log n + k) while avoiding a full pairwise graph in common use.
 */
export const buildNeighborGraph = (frames: LayoutFrameSnapshot[]): LayoutNeighborGraph => {
  const visibleFrames = sortRectsReadingOrder(frames.filter((frame) => !frame.hidden));
  const nodes = Object.fromEntries(visibleFrames.map((frame) => [frame.id, createNode(frame.id)]));
  const edges: LayoutNeighborEdge[] = [];
  const byLeft = [...visibleFrames].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const byTop = [...visibleFrames].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));

  for (const frame of visibleFrames) {
    let bestRightGap = Infinity;
    for (const candidate of byLeft) {
      if (candidate.id === frame.id || candidate.x < rectRight(frame)) {
        continue;
      }

      const gap = candidate.x - rectRight(frame);
      if (gap > bestRightGap) {
        break;
      }

      const edge = createHorizontalEdge(frame, candidate, "right");
      if (edge) {
        bestRightGap = gap;
        addEdge(nodes, edges, edge);
      }
    }

    let bestBottomGap = Infinity;
    for (const candidate of byTop) {
      if (candidate.id === frame.id || candidate.y < rectBottom(frame)) {
        continue;
      }

      const gap = candidate.y - rectBottom(frame);
      if (gap > bestBottomGap) {
        break;
      }

      const edge = createVerticalEdge(frame, candidate, "bottom");
      if (edge) {
        bestBottomGap = gap;
        addEdge(nodes, edges, edge);
      }
    }
  }

  for (const node of Object.values(nodes)) {
    sortEdges(node.left);
    sortEdges(node.right);
    sortEdges(node.top);
    sortEdges(node.bottom);
  }

  return {
    nodes,
    edges: sortEdges(edges),
  };
};
