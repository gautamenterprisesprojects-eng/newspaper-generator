import { getClusterBounds, getClusterWhitespace } from "./ClusterMetrics";
import { traverseLayoutCluster } from "./ClusterTraversal";
import type { LayoutCluster } from "./LayoutCluster";
import type { LayoutSnapshot } from "./LayoutTransactionTypes";

/**
 * Builds a connected layout cluster for a changed frame.
 *
 * The builder is read-only and deterministic. It uses the snapshot's
 * NeighborGraph, clones frame and whitespace data, and records traversal
 * boundaries where cluster expansion stopped.
 */
export const buildLayoutCluster = ({
  snapshot,
  sourceFrameId,
  regionGapLimit,
}: {
  snapshot: LayoutSnapshot;
  sourceFrameId: string;
  regionGapLimit?: number;
}): LayoutCluster => {
  const traversal = traverseLayoutCluster({
    snapshot,
    sourceFrameId,
    regionGapLimit,
  });
  const frames = traversal.frameIds
    .map((frameId) => snapshot.framesById[frameId])
    .filter(Boolean)
    .map((frame) => ({ ...frame }));

  return {
    id: ["layout-cluster", sourceFrameId, traversal.frameIds.join(".")].join(":"),
    sourceFrameId,
    frameIds: [...traversal.frameIds],
    frames,
    bounds: getClusterBounds(frames),
    whitespace: getClusterWhitespace(traversal.frameIds, snapshot.whitespaceMap),
    boundaries: traversal.boundaries.map((boundary) => ({ ...boundary })),
  };
};

/** Public facade for deterministic layout cluster construction. */
export const LayoutClusterBuilder = {
  buildLayoutCluster,
};
