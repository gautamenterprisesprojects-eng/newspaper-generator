export type RegionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImagePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right";

export type RegionEngineInput = {
  articleWidth: number;
  articleHeight: number;
  columnCount: number;
  columnGap: number;
  imageRect: RegionRect;
  imageObstacleRects?: RegionRect[];
  obstacleRects?: RegionRect[];
};

export type TextRegion = RegionRect & {
  area: number;
  columnIndex: number;
  order: number;
};

export type RegionEngineResult = {
  regions: TextRegion[];
  columnWidth: number;
  columnCount: number;
  columnGap: number;
  imageRect: RegionRect;
  obstacleRects: RegionRect[];
};
