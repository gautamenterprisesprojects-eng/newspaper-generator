export type FrameLayoutRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  hidden?: boolean;
};

export type FrameLayoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameLayoutColumn = {
  index: number;
  x: number;
  width: number;
};

export type FrameGuideKind =
  | "margin"
  | "column"
  | "page-center"
  | "frame-edge"
  | "frame-center"
  | "baseline"
  | "page-bound";

export type FrameSmartGuide = {
  id: string;
  orientation: "vertical" | "horizontal";
  position: number;
  label: string;
  kind: FrameGuideKind;
};

export type FrameDistanceLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  orientation: "horizontal" | "vertical";
};

export type FrameCollision = FrameLayoutBounds & {
  frameId: string;
};

export type FrameLayoutContext = {
  pageWidth: number;
  pageHeight: number;
  contentBounds: FrameLayoutBounds;
  columns: FrameLayoutColumn[];
  frames: FrameLayoutRect[];
  baselineGridSize: number;
  snapTolerance: number;
  allowOutsidePage?: boolean;
  collisionMode?: "off" | "warn";
};

export type FrameLayoutPreview = {
  rect: FrameLayoutRect;
  guides: FrameSmartGuide[];
  distanceLabels: FrameDistanceLabel[];
  collisions: FrameCollision[];
  outOfBounds: boolean;
};

export type FrameAlignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export type FrameAlignmentTarget =
  | "page"
  | "margins"
  | "selection"
  | "columns"
  | "spread";

export type FrameDistributionAxis = "horizontal" | "vertical";
