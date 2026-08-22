import type {
  FrameAlignment,
  FrameAlignmentTarget,
  FrameCollision,
  FrameDistanceLabel,
  FrameDistributionAxis,
  FrameGuideKind,
  FrameLayoutBounds,
  FrameLayoutColumn,
  FrameLayoutContext,
  FrameLayoutPreview,
  FrameLayoutRect,
  FrameSmartGuide,
} from "./FrameLayoutInteractionTypes";

const POINTS_TO_MM = 25.4 / 72;

type SnapAxis = "x" | "y";

type SnapCandidate = {
  source: "start" | "center" | "end";
  target: number;
  guide: FrameSmartGuide;
};

type SnapResult = {
  offset: number;
  guide: FrameSmartGuide | null;
};

const round = (value: number) => Math.round(value * 1000) / 1000;

const formatMm = (points: number) => `${Math.round(points * POINTS_TO_MM)} mm`;

const rectRight = (rect: FrameLayoutBounds) => rect.x + rect.width;
const rectBottom = (rect: FrameLayoutBounds) => rect.y + rect.height;
const rectCenterX = (rect: FrameLayoutBounds) => rect.x + rect.width / 2;
const rectCenterY = (rect: FrameLayoutBounds) => rect.y + rect.height / 2;

const intersects = (first: FrameLayoutBounds, second: FrameLayoutBounds) =>
  first.x < rectRight(second) &&
  rectRight(first) > second.x &&
  first.y < rectBottom(second) &&
  rectBottom(first) > second.y;

const intersection = (first: FrameLayoutBounds, second: FrameLayoutBounds): FrameLayoutBounds | null => {
  if (!intersects(first, second)) {
    return null;
  }

  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(rectRight(first), rectRight(second));
  const bottom = Math.min(rectBottom(first), rectBottom(second));

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
};

const getSelectionBounds = (rects: FrameLayoutBounds[]): FrameLayoutBounds => {
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map(rectRight));
  const bottom = Math.max(...rects.map(rectBottom));

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
};

const makeGuide = (
  orientation: FrameSmartGuide["orientation"],
  position: number,
  label: string,
  kind: FrameGuideKind,
): FrameSmartGuide => ({
  id: `${orientation}:${kind}:${round(position)}:${label}`,
  orientation,
  position,
  label,
  kind,
});

export const createFrameLayoutContext = ({
  pageWidth,
  pageHeight,
  contentBounds,
  columns,
  frames,
  baselineGridSize,
  snapTolerance = 4,
  allowOutsidePage = false,
  collisionMode = "warn",
}: {
  pageWidth: number;
  pageHeight: number;
  contentBounds: FrameLayoutBounds;
  columns: FrameLayoutColumn[];
  frames: FrameLayoutRect[];
  baselineGridSize?: number;
  snapTolerance?: number;
  allowOutsidePage?: boolean;
  collisionMode?: "off" | "warn";
}): FrameLayoutContext => ({
  pageWidth,
  pageHeight,
  contentBounds,
  columns,
  frames,
  baselineGridSize: baselineGridSize ?? 12,
  snapTolerance,
  allowOutsidePage,
  collisionMode,
});

const getVerticalSnapCandidates = (
  rect: FrameLayoutRect,
  context: FrameLayoutContext,
): SnapCandidate[] => {
  const { contentBounds, columns, pageWidth } = context;
  const staticGuides = [
    makeGuide("vertical", contentBounds.x, "margin left", "margin"),
    makeGuide("vertical", rectRight(contentBounds), "margin right", "margin"),
    makeGuide("vertical", rectCenterX(contentBounds), "margin center", "margin"),
    makeGuide("vertical", pageWidth / 2, "page center", "page-center"),
    ...columns.flatMap((column) => [
      makeGuide("vertical", column.x, `C${column.index} left`, "column"),
      makeGuide("vertical", column.x + column.width / 2, `C${column.index} center`, "column"),
      makeGuide("vertical", column.x + column.width, `C${column.index} right`, "column"),
    ]),
  ];
  const frameGuides = context.frames
    .filter((frame) => frame.id !== rect.id && !frame.hidden)
    .flatMap((frame) => [
      makeGuide("vertical", frame.x, "frame left", "frame-edge"),
      makeGuide("vertical", rectCenterX(frame), "frame center", "frame-center"),
      makeGuide("vertical", rectRight(frame), "frame right", "frame-edge"),
    ]);

  return [...staticGuides, ...frameGuides].flatMap((guide) => [
    { source: "start" as const, target: guide.position, guide },
    { source: "center" as const, target: guide.position, guide },
    { source: "end" as const, target: guide.position, guide },
  ]);
};

const getHorizontalSnapCandidates = (
  rect: FrameLayoutRect,
  context: FrameLayoutContext,
): SnapCandidate[] => {
  const { contentBounds, pageHeight } = context;
  const baselineTop = Math.round(rect.y / context.baselineGridSize) * context.baselineGridSize;
  const baselineBottom = Math.round(rectBottom(rect) / context.baselineGridSize) * context.baselineGridSize;
  const staticGuides = [
    makeGuide("horizontal", contentBounds.y, "margin top", "margin"),
    makeGuide("horizontal", rectBottom(contentBounds), "margin bottom", "margin"),
    makeGuide("horizontal", rectCenterY(contentBounds), "margin middle", "margin"),
    makeGuide("horizontal", pageHeight / 2, "page middle", "page-center"),
    makeGuide("horizontal", baselineTop, "baseline", "baseline"),
    makeGuide("horizontal", baselineBottom, "baseline", "baseline"),
  ];
  const frameGuides = context.frames
    .filter((frame) => frame.id !== rect.id && !frame.hidden)
    .flatMap((frame) => [
      makeGuide("horizontal", frame.y, "frame top", "frame-edge"),
      makeGuide("horizontal", rectCenterY(frame), "frame middle", "frame-center"),
      makeGuide("horizontal", rectBottom(frame), "frame bottom", "frame-edge"),
    ]);

  return [...staticGuides, ...frameGuides].flatMap((guide) => [
    { source: "start" as const, target: guide.position, guide },
    { source: "center" as const, target: guide.position, guide },
    { source: "end" as const, target: guide.position, guide },
  ]);
};

const getSourcePosition = (rect: FrameLayoutRect, axis: SnapAxis, source: SnapCandidate["source"]) => {
  if (axis === "x") {
    if (source === "start") {
      return rect.x;
    }

    if (source === "center") {
      return rectCenterX(rect);
    }

    return rectRight(rect);
  }

  if (source === "start") {
    return rect.y;
  }

  if (source === "center") {
    return rectCenterY(rect);
  }

  return rectBottom(rect);
};

const findSnap = (
  rect: FrameLayoutRect,
  candidates: SnapCandidate[],
  axis: SnapAxis,
  tolerance: number,
): SnapResult => {
  let best: { distance: number; offset: number; guide: FrameSmartGuide } | null = null;

  for (const candidate of candidates) {
    const sourcePosition = getSourcePosition(rect, axis, candidate.source);
    const offset = candidate.target - sourcePosition;
    const distance = Math.abs(offset);

    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = {
        distance,
        offset,
        guide: candidate.guide,
      };
    }
  }

  return {
    offset: best?.offset ?? 0,
    guide: best?.guide ?? null,
  };
};

const clampToPage = (rect: FrameLayoutRect, context: FrameLayoutContext): FrameLayoutRect => {
  if (context.allowOutsidePage) {
    return rect;
  }

  return {
    ...rect,
    x: Math.min(Math.max(0, rect.x), Math.max(0, context.pageWidth - rect.width)),
    y: Math.min(Math.max(0, rect.y), Math.max(0, context.pageHeight - rect.height)),
  };
};

const isOutOfBounds = (rect: FrameLayoutRect, context: FrameLayoutContext) =>
  rect.x < 0 || rect.y < 0 || rectRight(rect) > context.pageWidth || rectBottom(rect) > context.pageHeight;

const getCollisions = (rect: FrameLayoutRect, context: FrameLayoutContext): FrameCollision[] => {
  if (context.collisionMode === "off") {
    return [];
  }

  return context.frames
    .filter((frame) => frame.id !== rect.id && !frame.hidden)
    .map((frame) => {
      const overlap = intersection(rect, frame);

      return overlap
        ? {
            ...overlap,
            frameId: frame.id,
          }
        : null;
    })
    .filter((collision): collision is FrameCollision => Boolean(collision));
};

const getDistanceLabels = (rect: FrameLayoutRect, context: FrameLayoutContext): FrameDistanceLabel[] => {
  const peers = context.frames.filter((frame) => frame.id !== rect.id && !frame.hidden);
  const labels: FrameDistanceLabel[] = [];
  const verticalOverlap = (frame: FrameLayoutRect) => frame.y < rectBottom(rect) && rectBottom(frame) > rect.y;
  const horizontalOverlap = (frame: FrameLayoutRect) => frame.x < rectRight(rect) && rectRight(frame) > rect.x;
  const leftPeer = peers
    .filter((frame) => rectRight(frame) <= rect.x && verticalOverlap(frame))
    .sort((first, second) => rect.x - rectRight(first) - (rect.x - rectRight(second)))[0];
  const rightPeer = peers
    .filter((frame) => frame.x >= rectRight(rect) && verticalOverlap(frame))
    .sort((first, second) => first.x - rectRight(rect) - (second.x - rectRight(rect)))[0];
  const topPeer = peers
    .filter((frame) => rectBottom(frame) <= rect.y && horizontalOverlap(frame))
    .sort((first, second) => rect.y - rectBottom(first) - (rect.y - rectBottom(second)))[0];
  const bottomPeer = peers
    .filter((frame) => frame.y >= rectBottom(rect) && horizontalOverlap(frame))
    .sort((first, second) => first.y - rectBottom(rect) - (second.y - rectBottom(rect)))[0];

  if (leftPeer) {
    const gap = rect.x - rectRight(leftPeer);
    labels.push({
      id: `gap-left-${leftPeer.id}`,
      x: rect.x - gap / 2,
      y: Math.max(rect.y, leftPeer.y) + 8,
      text: formatMm(gap),
      orientation: "horizontal",
    });
  }

  if (rightPeer) {
    const gap = rightPeer.x - rectRight(rect);
    labels.push({
      id: `gap-right-${rightPeer.id}`,
      x: rectRight(rect) + gap / 2,
      y: Math.max(rect.y, rightPeer.y) + 8,
      text: formatMm(gap),
      orientation: "horizontal",
    });
  }

  if (topPeer) {
    const gap = rect.y - rectBottom(topPeer);
    labels.push({
      id: `gap-top-${topPeer.id}`,
      x: Math.max(rect.x, topPeer.x) + 8,
      y: rect.y - gap / 2,
      text: formatMm(gap),
      orientation: "vertical",
    });
  }

  if (bottomPeer) {
    const gap = bottomPeer.y - rectBottom(rect);
    labels.push({
      id: `gap-bottom-${bottomPeer.id}`,
      x: Math.max(rect.x, bottomPeer.x) + 8,
      y: rectBottom(rect) + gap / 2,
      text: formatMm(gap),
      orientation: "vertical",
    });
  }

  return labels;
};

const createPreview = (rect: FrameLayoutRect, guides: FrameSmartGuide[], context: FrameLayoutContext): FrameLayoutPreview => {
  const outOfBounds = isOutOfBounds(rect, context);
  const clampedRect = clampToPage(rect, context);

  return {
    rect: clampedRect,
    guides,
    distanceLabels: getDistanceLabels(clampedRect, context),
    collisions: getCollisions(clampedRect, context),
    outOfBounds,
  };
};

export const snapFrameDrag = (
  rect: FrameLayoutRect,
  context: FrameLayoutContext,
): FrameLayoutPreview => {
  const xSnap = findSnap(rect, getVerticalSnapCandidates(rect, context), "x", context.snapTolerance);
  const withX = {
    ...rect,
    x: rect.x + xSnap.offset,
  };
  const ySnap = findSnap(withX, getHorizontalSnapCandidates(withX, context), "y", context.snapTolerance);
  const snapped = {
    ...withX,
    y: withX.y + ySnap.offset,
  };
  const guides = [xSnap.guide, ySnap.guide].filter((guide): guide is FrameSmartGuide => Boolean(guide));

  return createPreview(snapped, guides, context);
};

export const snapFrameResize = (
  rect: FrameLayoutRect,
  context: FrameLayoutContext,
  handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" = "se",
): FrameLayoutPreview => {
  const guides: FrameSmartGuide[] = [];
  let next = { ...rect };
  const canResizeLeft = handle.includes("w");
  const canResizeRight = handle.includes("e");
  const canResizeTop = handle.includes("n");
  const canResizeBottom = handle.includes("s");

  if (canResizeLeft || canResizeRight) {
    const candidates = getVerticalSnapCandidates(next, context).filter((candidate) =>
      canResizeLeft ? candidate.source === "start" : candidate.source === "end",
    );
    const xSnap = findSnap(next, candidates, "x", context.snapTolerance);

    if (xSnap.guide) {
      guides.push(xSnap.guide);

      if (canResizeLeft) {
        next = {
          ...next,
          x: next.x + xSnap.offset,
          width: Math.max(1, next.width - xSnap.offset),
        };
      } else {
        next = {
          ...next,
          width: Math.max(1, next.width + xSnap.offset),
        };
      }
    }
  }

  if (canResizeTop || canResizeBottom) {
    const candidates = getHorizontalSnapCandidates(next, context).filter((candidate) =>
      canResizeTop ? candidate.source === "start" : candidate.source === "end",
    );
    const ySnap = findSnap(next, candidates, "y", context.snapTolerance);

    if (ySnap.guide) {
      guides.push(ySnap.guide);

      if (canResizeTop) {
        next = {
          ...next,
          y: next.y + ySnap.offset,
          height: Math.max(1, next.height - ySnap.offset),
        };
      } else {
        next = {
          ...next,
          height: Math.max(1, next.height + ySnap.offset),
        };
      }
    }
  }

  return createPreview(next, guides, context);
};

export const alignFrameRects = (
  rects: FrameLayoutRect[],
  alignment: FrameAlignment,
  target: FrameLayoutBounds,
): FrameLayoutRect[] =>
  rects.map((rect) => {
    if (alignment === "left") {
      return { ...rect, x: target.x };
    }

    if (alignment === "center") {
      return { ...rect, x: target.x + target.width / 2 - rect.width / 2 };
    }

    if (alignment === "right") {
      return { ...rect, x: rectRight(target) - rect.width };
    }

    if (alignment === "top") {
      return { ...rect, y: target.y };
    }

    if (alignment === "middle") {
      return { ...rect, y: target.y + target.height / 2 - rect.height / 2 };
    }

    return { ...rect, y: rectBottom(target) - rect.height };
  });

export const getAlignmentTargetBounds = (
  rects: FrameLayoutRect[],
  target: FrameAlignmentTarget,
  context: FrameLayoutContext,
): FrameLayoutBounds => {
  if (target === "page" || target === "spread") {
    return { x: 0, y: 0, width: context.pageWidth, height: context.pageHeight };
  }

  if (target === "columns") {
    const firstColumn = context.columns[0];
    const lastColumn = context.columns[context.columns.length - 1];

    if (firstColumn && lastColumn) {
      return {
        x: firstColumn.x,
        y: context.contentBounds.y,
        width: lastColumn.x + lastColumn.width - firstColumn.x,
        height: context.contentBounds.height,
      };
    }
  }

  if (target === "selection" && rects.length > 1) {
    return getSelectionBounds(rects);
  }

  return context.contentBounds;
};

export const distributeFrameRects = (
  rects: FrameLayoutRect[],
  axis: FrameDistributionAxis,
): FrameLayoutRect[] => {
  if (rects.length < 3) {
    return rects;
  }

  const sorted = [...rects].sort((first, second) =>
    axis === "horizontal" ? first.x - second.x : first.y - second.y,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSize = sorted.reduce((sum, rect) => sum + (axis === "horizontal" ? rect.width : rect.height), 0);
  const span = axis === "horizontal" ? rectRight(last) - first.x : rectBottom(last) - first.y;
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = axis === "horizontal" ? first.x : first.y;
  const nextRects = new Map<string, FrameLayoutRect>();

  for (const rect of sorted) {
    nextRects.set(rect.id, axis === "horizontal" ? { ...rect, x: cursor } : { ...rect, y: cursor });
    cursor += (axis === "horizontal" ? rect.width : rect.height) + gap;
  }

  return rects.map((rect) => nextRects.get(rect.id) ?? rect);
};

export const resizeFramesAcrossGap = ({
  first,
  second,
  axis,
  delta,
  minSize = 48,
}: {
  first: FrameLayoutRect;
  second: FrameLayoutRect;
  axis: FrameDistributionAxis;
  delta: number;
  minSize?: number;
}): [FrameLayoutRect, FrameLayoutRect] => {
  if (axis === "horizontal") {
    const clampedDelta = Math.min(
      Math.max(delta, minSize - first.width),
      second.width - minSize,
    );

    return [
      {
        ...first,
        width: first.width + clampedDelta,
      },
      {
        ...second,
        x: second.x + clampedDelta,
        width: second.width - clampedDelta,
      },
    ];
  }

  const clampedDelta = Math.min(
    Math.max(delta, minSize - first.height),
    second.height - minSize,
  );

  return [
    {
      ...first,
      height: first.height + clampedDelta,
    },
    {
      ...second,
      y: second.y + clampedDelta,
      height: second.height - clampedDelta,
    },
  ];
};
