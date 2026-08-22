import type { NeighborResizeDirection } from "./LayoutTransactionTypes";

export type GeometryPatchOperation =
  | "expand"
  | "shrink"
  | "move"
  | "translate"
  | "reserve"
  | "release";

export type GeometryPatch = {
  id: string;
  frameId: string;
  operation: GeometryPatchOperation;
  direction: NeighborResizeDirection;
  amount: number;
  priority: number;
  reason: string;
  dependencies: string[];
};

export type GeometryPatchBuildResult = {
  patches: GeometryPatch[];
  warnings: string[];
  reasons: string[];
};
