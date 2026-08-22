import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import type { StoryImageSettings, StoryImageShapePoint, StoryImageShapeType } from "@/types/editor";

export type ImagePlacementInput = {
  storyBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageSettings: StoryImageSettings;
  columnCount: number;
  columnGap: number;
};

export type ImagePlacementResult = {
  imageRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  wrapRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  wrapRects: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const DEFAULT_CONTOUR_SLICE_COUNT = 18;

const rectanglePoints: StoryImageShapePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const polygonPoints: StoryImageShapePoint[] = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0.35 },
  { x: 0.82, y: 1 },
  { x: 0.18, y: 1 },
  { x: 0, y: 0.35 },
];

const starPoints: StoryImageShapePoint[] = Array.from({ length: 10 }).map((_, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI) / 5;
  const radius = index % 2 === 0 ? 0.5 : 0.22;

  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius,
  };
});

const heartPoints: StoryImageShapePoint[] = [
  { x: 0.5, y: 0.95 },
  { x: 0.08, y: 0.58 },
  { x: 0.05, y: 0.22 },
  { x: 0.26, y: 0.08 },
  { x: 0.5, y: 0.28 },
  { x: 0.74, y: 0.08 },
  { x: 0.95, y: 0.22 },
  { x: 0.92, y: 0.58 },
];

export const getDefaultImageShapePoints = (shapeType: StoryImageShapeType): StoryImageShapePoint[] => {
  if (shapeType === "star") {
    return starPoints;
  }

  if (shapeType === "heart") {
    return heartPoints;
  }

  if (shapeType === "polygon") {
    return polygonPoints;
  }

  return rectanglePoints;
};

const normalizePoint = (point: StoryImageShapePoint): StoryImageShapePoint => ({
  x: clamp(point.x, 0, 1),
  y: clamp(point.y, 0, 1),
});

const getContourPoints = (imageSettings: StoryImageSettings) => {
  const explicitPoints =
    imageSettings.wrapContourPoints?.length
      ? imageSettings.wrapContourPoints
      : imageSettings.imageShapePoints?.length
        ? imageSettings.imageShapePoints
        : getDefaultImageShapePoints(imageSettings.imageShapeType ?? "rectangle");

  return explicitPoints.map(normalizePoint);
};

const createContourWrapRects = ({
  imageRect,
  points,
  offset,
  sliceCount = DEFAULT_CONTOUR_SLICE_COUNT,
}: {
  imageRect: NonNullable<ImagePlacementResult["imageRect"]>;
  points: StoryImageShapePoint[];
  offset: number;
  sliceCount?: number;
}) => {
  if (points.length < 3) {
    return [imageRect];
  }

  const safeOffset = Math.max(0, offset);
  const safeSliceCount = Math.max(4, Math.round(sliceCount));
  const sliceHeight = imageRect.height / safeSliceCount;
  const rects: NonNullable<ImagePlacementResult["wrapRects"]> = [];

  for (let index = 0; index < safeSliceCount; index += 1) {
    const y0 = index / safeSliceCount;
    const y1 = (index + 1) / safeSliceCount;
    const yMid = (y0 + y1) / 2;
    const intersections: number[] = [];

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const current = points[pointIndex];
      const next = points[(pointIndex + 1) % points.length];
      const crosses =
        (current.y <= yMid && next.y > yMid) ||
        (next.y <= yMid && current.y > yMid);

      if (!crosses || current.y === next.y) {
        continue;
      }

      const progress = (yMid - current.y) / (next.y - current.y);
      intersections.push(current.x + progress * (next.x - current.x));
    }

    intersections.sort((a, b) => a - b);

    for (let pairIndex = 0; pairIndex < intersections.length - 1; pairIndex += 2) {
      const left = clamp(intersections[pairIndex], 0, 1);
      const right = clamp(intersections[pairIndex + 1], 0, 1);

      if (right <= left) {
        continue;
      }

      rects.push({
        x: imageRect.x + left * imageRect.width - safeOffset,
        y: imageRect.y + y0 * imageRect.height - safeOffset,
        width: (right - left) * imageRect.width + safeOffset * 2,
        height: sliceHeight + safeOffset * 2,
      });
    }
  }

  return rects.length > 0 ? rects : [imageRect];
};

const getColumnSpanRect = ({
  storyBounds,
  columnCount,
  columnGap,
  columnSpan,
  startColumn,
}: {
  storyBounds: ImagePlacementInput["storyBounds"];
  columnCount: number;
  columnGap: number;
  columnSpan: number;
  startColumn: number;
}) => {
  const columns = createColumnGrid({
    pageWidth: storyBounds.width,
    contentX: storyBounds.x,
    contentWidth: storyBounds.width,
    columnCount,
    gutter: columnGap,
  });
  const firstColumn = columns[startColumn];
  const lastColumn = columns[startColumn + columnSpan - 1];

  if (!firstColumn || !lastColumn) {
    return {
      x: storyBounds.x,
      width: storyBounds.width,
    };
  }

  return {
    x: firstColumn.x,
    width: lastColumn.x + lastColumn.width - firstColumn.x,
  };
};

const getStartColumn = ({
  alignment,
  columnCount,
  columnSpan,
}: {
  alignment: StoryImageSettings["imageAlignment"];
  columnCount: number;
  columnSpan: number;
}) => {
  const maxStartColumn = Math.max(0, columnCount - columnSpan);

  if (alignment === "right") {
    return maxStartColumn;
  }

  if (alignment === "top-right") {
    return maxStartColumn;
  }

  if (alignment === "top-left") {
    return 0;
  }

  if (alignment === "center" || alignment === "top" || alignment === "top-center" || alignment === "bottom") {
    return Math.round(maxStartColumn / 2);
  }

  return 0;
};

const getY = ({
  alignment,
  storyBounds,
  imageHeight,
}: {
  alignment: StoryImageSettings["imageAlignment"];
  storyBounds: ImagePlacementInput["storyBounds"];
  imageHeight: number;
}) => {
  if (alignment === "bottom") {
    return storyBounds.y + storyBounds.height - imageHeight;
  }

  if (alignment === "center") {
    return storyBounds.y + Math.max(0, (storyBounds.height - imageHeight) / 2);
  }

  return storyBounds.y;
};

export const placeImage = ({
  storyBounds,
  imageSettings,
  columnCount,
  columnGap,
}: ImagePlacementInput): ImagePlacementResult => {
  if (!imageSettings.imageEnabled) {
    return {
      imageRect: null,
      wrapRect: null,
      wrapRects: [],
    };
  }

  const safeColumnCount = Math.max(1, Math.floor(columnCount));
  const safeColumnSpan = clamp(
    Math.round(imageSettings.imageColumnSpan),
    1,
    safeColumnCount,
  );
  const startColumn = getStartColumn({
    alignment: imageSettings.imageAlignment,
    columnCount: safeColumnCount,
    columnSpan: safeColumnSpan,
  });
  const columnRect = getColumnSpanRect({
    storyBounds,
    columnCount: safeColumnCount,
    columnGap,
    columnSpan: safeColumnSpan,
    startColumn,
  });

  let imageHeight = clamp(Math.round(imageSettings.imageHeight), 1, storyBounds.height);
  const minImageHeight = Math.round(columnRect.width * 0.5);
  if (imageHeight < minImageHeight) {
    imageHeight = clamp(minImageHeight, 1, storyBounds.height);
  }

  const imageRect = {
    x: columnRect.x,
    y: getY({
      alignment: imageSettings.imageAlignment,
      storyBounds,
      imageHeight,
    }),
    width: columnRect.width,
    height: imageHeight,
  };

  const wrapRects =
    imageSettings.imageWrapMode === "none"
      ? []
      : imageSettings.imageWrapMode === "contour"
        ? createContourWrapRects({
            imageRect,
            points: getContourPoints(imageSettings),
            offset: imageSettings.wrapTextOffset ?? 1,
          })
        : [imageRect];

  return {
    imageRect,
    wrapRect: imageSettings.imageWrapMode === "none" ? null : imageRect,
    wrapRects,
  };
};

export const ImagePlacementEngine = {
  placeImage,
};
