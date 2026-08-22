import { rectBottom, rectContains, rectRight } from "./LayoutGeometry";
import type { LayoutClusterBoundary, LayoutClusterStopReason } from "./LayoutCluster";
import type {
  LayoutFrameSnapshot,
  LayoutNeighborEdge,
  LayoutSnapshot,
} from "./LayoutTransactionTypes";

const DEFAULT_REGION_GAP_LIMIT = 96;

const getStopReason = (
  snapshot: LayoutSnapshot,
  frame: LayoutFrameSnapshot | undefined,
): LayoutClusterStopReason | null => {
  if (!frame) {
    return "isolated-region";
  }

  if (frame.hidden) {
    return "hidden-frame";
  }

  if (frame.kind === "advertisement") {
    return "advertisement";
  }

  if (frame.locked) {
    return "locked-frame";
  }

  if (!rectContains(snapshot.pageBounds, frame)) {
    return "outside-page";
  }

  return null;
};

const isIsolatedEdge = (
  edge: LayoutNeighborEdge,
  regionGapLimit: number,
) => edge.gap > regionGapLimit;

const edgeReadingOrder = (first: LayoutNeighborEdge, second: LayoutNeighborEdge) =>
  first.gap - second.gap ||
  second.sharedSpan - first.sharedSpan ||
  first.direction.localeCompare(second.direction) ||
  first.to.localeCompare(second.to);

const getFrameEdges = (snapshot: LayoutSnapshot, frameId: string) => {
  const node = snapshot.neighborGraph.nodes[frameId];

  if (!node) {
    return [];
  }

  return [...node.right, ...node.bottom, ...node.left, ...node.top].sort(edgeReadingOrder);
};

/**
 * Traverses a connected layout cluster from a changed frame.
 *
 * The traversal is deterministic BFS over the existing NeighborGraph. It stops
 * at immutable frames, page-boundary violations, and edges whose gap exceeds
 * the isolated-region threshold.
 */
export const traverseLayoutCluster = ({
  snapshot,
  sourceFrameId,
  regionGapLimit = DEFAULT_REGION_GAP_LIMIT,
}: {
  snapshot: LayoutSnapshot;
  sourceFrameId: string;
  regionGapLimit?: number;
}) => {
  const visited = new Set<string>();
  const queued = new Set<string>();
  const frameIds: string[] = [];
  const boundaries: LayoutClusterBoundary[] = [];
  const source = snapshot.framesById[sourceFrameId];
  const sourceStop = getStopReason(snapshot, source);

  if (sourceStop || !source) {
    return {
      frameIds,
      boundaries: [{
        frameId: sourceFrameId,
        reason: sourceStop ?? "isolated-region",
      }],
    };
  }

  const queue = [sourceFrameId];
  queued.add(sourceFrameId);

  while (queue.length > 0) {
    const frameId = queue.shift() as string;

    if (visited.has(frameId)) {
      continue;
    }

    visited.add(frameId);
    frameIds.push(frameId);

    for (const edge of getFrameEdges(snapshot, frameId)) {
      if (isIsolatedEdge(edge, regionGapLimit)) {
        boundaries.push({ frameId: edge.to, reason: "isolated-region" });
        continue;
      }

      const candidate = snapshot.framesById[edge.to];
      const stopReason = getStopReason(snapshot, candidate);

      if (stopReason) {
        boundaries.push({ frameId: edge.to, reason: stopReason });
        continue;
      }

      if (!queued.has(edge.to) && !visited.has(edge.to)) {
        queue.push(edge.to);
        queued.add(edge.to);
      }
    }
  }

  return {
    frameIds: frameIds.sort((first, second) => {
      const firstFrame = snapshot.framesById[first];
      const secondFrame = snapshot.framesById[second];

      return firstFrame.y - secondFrame.y ||
        firstFrame.x - secondFrame.x ||
        rectBottom(firstFrame) - rectBottom(secondFrame) ||
        rectRight(firstFrame) - rectRight(secondFrame) ||
        first.localeCompare(second);
    }),
    boundaries: boundaries
      .filter((boundary, index, all) =>
        all.findIndex((item) => item.frameId === boundary.frameId && item.reason === boundary.reason) === index,
      )
      .sort((first, second) => first.frameId.localeCompare(second.frameId) || first.reason.localeCompare(second.reason)),
  };
};
