import type { Point, Size } from "@/types/editor";

export type AutoReflowBox = Point &
  Size & {
    id: string;
  };

export type AutoReflowPageBounds = Point & Size;

export type AutoReflowInput = {
  boxes: AutoReflowBox[];
  changedBoxId: string;
  pageBounds: AutoReflowPageBounds;
  gap?: number;
  gridSize?: number;
};

export type AutoReflowNeighbor = {
  id: string;
  direction: "above" | "below" | "left" | "right" | "overlap";
};

export type AutoReflowResult = {
  boxes: AutoReflowBox[];
  neighbors: AutoReflowNeighbor[];
  affectedBoxIds: string[];
  movedBoxIds: string[];
  boundaryClampedBoxIds: string[];
  overlapCount: number;
};
