import type { RegionEngineInput, RegionEngineResult, RegionRect, TextRegion } from "./RegionTypes";

const MIN_COLUMN_COUNT = 1;
const MAX_COLUMN_COUNT = 8;
const MIN_REGION_SIZE = 0.001;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeRect = (rect: RegionRect, articleWidth: number, articleHeight: number): RegionRect => {
  const x = clamp(rect.x, 0, articleWidth);
  const y = clamp(rect.y, 0, articleHeight);
  const right = clamp(rect.x + rect.width, 0, articleWidth);
  const bottom = clamp(rect.y + rect.height, 0, articleHeight);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
};

const intersectRect = (a: RegionRect, b: RegionRect): RegionRect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;

  if (width <= MIN_REGION_SIZE || height <= MIN_REGION_SIZE) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
  };
};

const isUsableRegion = (region: RegionRect) =>
  region.width > MIN_REGION_SIZE && region.height > MIN_REGION_SIZE;

const getRegionArea = (region: RegionRect) => region.width * region.height;

const subtractObstacleFromRegion = (
  region: RegionRect,
  obstacleRect: RegionRect,
  columnIndex: number,
): Omit<TextRegion, "order">[] => {
  const intersection = intersectRect(region, obstacleRect);

  if (!intersection) {
    return [
      {
        ...region,
        area: getRegionArea(region),
        columnIndex,
      },
    ];
  }

  const regionRight = region.x + region.width;
  const regionBottom = region.y + region.height;
  const intersectionRight = intersection.x + intersection.width;
  const intersectionBottom = intersection.y + intersection.height;
  const candidates: RegionRect[] = [
    {
      x: region.x,
      y: region.y,
      width: region.width,
      height: intersection.y - region.y,
    },
    {
      x: region.x,
      y: intersection.y,
      width: intersection.x - region.x,
      height: intersection.height,
    },
    {
      x: intersectionRight,
      y: intersection.y,
      width: regionRight - intersectionRight,
      height: intersection.height,
    },
    {
      x: region.x,
      y: intersectionBottom,
      width: region.width,
      height: regionBottom - intersectionBottom,
    },
  ];

  return candidates.filter(isUsableRegion).map((region) => ({
    ...region,
    area: getRegionArea(region),
    columnIndex,
  }));
};

const subtractObstaclesFromColumn = (
  column: RegionRect,
  obstacleRects: RegionRect[],
  columnIndex: number,
) =>
  obstacleRects.reduce<Omit<TextRegion, "order">[]>(
    (regions, obstacleRect) =>
      regions.flatMap((region) => subtractObstacleFromRegion(region, obstacleRect, columnIndex)),
    [
      {
        ...column,
        area: getRegionArea(column),
        columnIndex,
      },
    ],
  );

const isTopSideObstacle = (imageRect: RegionRect, articleWidth: number) => {
  if (imageRect.width <= MIN_REGION_SIZE || imageRect.height <= MIN_REGION_SIZE) {
    return false;
  }

  const touchesLeft = imageRect.x <= MIN_REGION_SIZE;
  const touchesRight = imageRect.x + imageRect.width >= articleWidth - MIN_REGION_SIZE;

  return touchesLeft || touchesRight;
};

const rangesOverlapX = (a: RegionRect, b: RegionRect) =>
  a.x < b.x + b.width && a.x + a.width > b.x;

const createTopSideRecoveryRegions = (
  articleWidth: number,
  articleHeight: number,
  imageRect: RegionRect,
  imageObstacleRects: RegionRect[],
  obstacleRects: RegionRect[],
  columns: RegionRect[],
) => {
  const imageBottom = imageRect.y + imageRect.height;
  // A column whose horizontal span never crosses the image (or its caption)
  // has no real reason to be fragmented into above/side/recovery bands
  // around that boundary — it used to be split anyway, purely because the
  // image touched an edge SOMEWHERE on the page, leaving this column's body
  // text flow broken into two regions with an artificial gap at the
  // image's bottom edge even though nothing in this column's path ever
  // required it. Only columns that actually overlap the image get the
  // three-way split; everything else flows as a single continuous region.
  const columnOverlapsImageObstacle = (column: RegionRect) =>
    imageObstacleRects.some((obstacle) => rangesOverlapX(column, obstacle));

  const regions = columns.flatMap((column, columnIndex) => {
    if (!columnOverlapsImageObstacle(column)) {
      return subtractObstaclesFromColumn(column, obstacleRects, columnIndex);
    }

    const aboveRegions = subtractObstaclesFromColumn(
      {
        ...column,
        y: 0,
        height: imageRect.y,
      },
      obstacleRects,
      columnIndex,
    );
    const sideRegions = subtractObstaclesFromColumn(
      {
        ...column,
        y: imageRect.y,
        height: imageRect.height,
      },
      [...imageObstacleRects, ...obstacleRects],
      columnIndex,
    );
    const recoveryRegions = subtractObstaclesFromColumn(
      {
        ...column,
        y: imageBottom,
        height: articleHeight - imageBottom,
      },
      obstacleRects,
      columnIndex,
    );

    return [...aboveRegions, ...sideRegions, ...recoveryRegions];
  });

  return regions.filter(isUsableRegion);
};

const sortRegionsInReadingOrder = (regions: Omit<TextRegion, "order">[]): TextRegion[] =>
  [...regions]
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > MIN_REGION_SIZE) {
        return a.y - b.y;
      }

      if (Math.abs(a.x - b.x) > MIN_REGION_SIZE) {
        return a.x - b.x;
      }

      return a.columnIndex - b.columnIndex;
    })
    .map((region, order) => ({
      ...region,
      area: getRegionArea(region),
      order,
    }));

export const generateTextRegions = (input: RegionEngineInput): RegionEngineResult => {
  const articleWidth = Math.max(0, input.articleWidth);
  const articleHeight = Math.max(0, input.articleHeight);
  const columnCount = clamp(Math.round(input.columnCount), MIN_COLUMN_COUNT, MAX_COLUMN_COUNT);
  const columnGap = Math.max(0, input.columnGap);
  const totalGapWidth = columnGap * Math.max(0, columnCount - 1);
  const columnWidth = Math.max(0, (articleWidth - totalGapWidth) / columnCount);
  const imageRect = normalizeRect(input.imageRect, articleWidth, articleHeight);
  const imageObstacleRects = (input.imageObstacleRects?.length ? input.imageObstacleRects : [imageRect]).map((rect) =>
    normalizeRect(rect, articleWidth, articleHeight),
  );
  const obstacleRects = [...imageObstacleRects, ...(input.obstacleRects ?? [])].map((rect) =>
    normalizeRect(rect, articleWidth, articleHeight),
  );
  const extraObstacleRects = (input.obstacleRects ?? []).map((rect) =>
    normalizeRect(rect, articleWidth, articleHeight),
  );
  const columns: RegionRect[] = Array.from({ length: columnCount }).map((_, columnIndex) => ({
    x: columnIndex * (columnWidth + columnGap),
    y: 0,
    width: columnWidth,
    height: articleHeight,
  }));
  const regions = sortRegionsInReadingOrder(
    isTopSideObstacle(imageRect, articleWidth)
      ? createTopSideRecoveryRegions(
          articleWidth,
          articleHeight,
          imageRect,
          imageObstacleRects,
          extraObstacleRects,
          columns,
        )
      : columns.flatMap((column, columnIndex) =>
          subtractObstaclesFromColumn(column, obstacleRects, columnIndex),
        ),
  );

  return {
    regions,
    columnWidth,
    columnCount,
    columnGap,
    imageRect,
    obstacleRects,
  };
};

export const RegionEngine = {
  generateTextRegions,
};
