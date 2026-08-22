import type { LayoutFrameSnapshot, LayoutRect, LayoutWhitespaceCell } from "./LayoutTransactionTypes";

export type LayoutClusterStopReason =
  | "advertisement"
  | "locked-frame"
  | "hidden-frame"
  | "outside-page"
  | "isolated-region";

export type LayoutClusterBoundary = {
  frameId: string;
  reason: LayoutClusterStopReason;
};

export type LayoutCluster = {
  id: string;
  sourceFrameId: string;
  frameIds: string[];
  frames: LayoutFrameSnapshot[];
  bounds: LayoutRect;
  whitespace: LayoutWhitespaceCell[];
  boundaries: LayoutClusterBoundary[];
};

export type BalancedCluster = {
  cluster: LayoutCluster;
  before: Record<string, LayoutRect>;
  after: Record<string, LayoutRect>;
  changedFrameIds: string[];
  unresolvedWhitespace: LayoutWhitespaceCell[];
  warnings: string[];
  metrics: {
    beforeWhitespaceArea: number;
    afterWhitespaceArea: number;
    eliminatedWhitespaceArea: number;
    changedFrameCount: number;
    iterationCount: number;
  };
};
