import type { NeighborResizeDirection, SpaceAllocation } from "./LayoutTransactionTypes";
import type { GeometryPatchOperation } from "./GeometryPatch";

/** Returns the source-frame patch operation for a resize direction. */
export const getSourcePatchOperation = (direction: NeighborResizeDirection): GeometryPatchOperation =>
  direction === "left" || direction === "right" || direction === "top" || direction === "bottom"
    ? "expand"
    : "translate";

/** Returns the candidate patch operation needed to provide allocated space. */
export const getAllocationPatchOperation = (allocation: SpaceAllocation): GeometryPatchOperation => {
  if (allocation.kind === "whitespace") {
    return "release";
  }

  if (allocation.kind === "reserved-gap") {
    return "reserve";
  }

  return "shrink";
};

/** Creates a stable deterministic patch id from ordered patch fields. */
export const createGeometryPatchId = ({
  frameId,
  operation,
  direction,
  amount,
  index,
}: {
  frameId: string;
  operation: GeometryPatchOperation;
  direction: NeighborResizeDirection;
  amount: number;
  index: number;
}) => ["geometry-patch", index, frameId, operation, direction, Math.round(amount * 1000) / 1000].join(":");
