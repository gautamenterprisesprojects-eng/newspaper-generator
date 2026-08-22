import type {
  AutoReflowBox,
  AutoReflowInput,
  AutoReflowNeighbor,
  AutoReflowPageBounds,
  AutoReflowResult,
} from "./AutoReflowTypes";

const DEFAULT_GAP = 9;
const DEFAULT_GRID_SIZE = 9;
const MIN_SIZE = 1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const snapValue = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize;

const boxesEqual = (first: AutoReflowBox, second: AutoReflowBox) =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height;

const getRight = (box: AutoReflowBox) => box.x + box.width;
const getBottom = (box: AutoReflowBox) => box.y + box.height;

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const boxesOverlap = (first: AutoReflowBox, second: AutoReflowBox) =>
  rangesOverlap(first.x, getRight(first), second.x, getRight(second)) &&
  rangesOverlap(first.y, getBottom(first), second.y, getBottom(second));

const expandedBox = (box: AutoReflowBox, gap: number): AutoReflowBox => ({
  ...box,
  x: box.x - gap,
  y: box.y - gap,
  width: box.width + gap * 2,
  height: box.height + gap * 2,
});

const normalizeBox = (
  box: AutoReflowBox,
  pageBounds: AutoReflowPageBounds,
  gridSize: number,
) => {
  const width = Math.max(MIN_SIZE, Math.min(box.width, pageBounds.width));
  const height = Math.max(MIN_SIZE, Math.min(box.height, pageBounds.height));
  const maxX = pageBounds.x + pageBounds.width - width;
  const maxY = pageBounds.y + pageBounds.height - height;

  return {
    ...box,
    x: snapValue(clamp(box.x, pageBounds.x, maxX), gridSize),
    y: snapValue(clamp(box.y, pageBounds.y, maxY), gridSize),
    width: snapValue(width, gridSize),
    height: snapValue(height, gridSize),
  };
};

const sortInReadingOrder = (boxes: AutoReflowBox[]) =>
  [...boxes].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }

    return a.x - b.x;
  });

const getRequiredY = (
  box: AutoReflowBox,
  placedBoxes: AutoReflowBox[],
  gap: number,
  minimumY: number,
) =>
  placedBoxes.reduce((requiredY, placedBox) => {
    if (!rangesOverlap(box.x, getRight(box), placedBox.x, getRight(placedBox))) {
      return requiredY;
    }

    return Math.max(requiredY, getBottom(placedBox) + gap);
  }, minimumY);

const fitsInsidePage = (box: AutoReflowBox, pageBounds: AutoReflowPageBounds) =>
  box.x >= pageBounds.x &&
  box.y >= pageBounds.y &&
  getRight(box) <= pageBounds.x + pageBounds.width &&
  getBottom(box) <= pageBounds.y + pageBounds.height;

const hasCollision = (box: AutoReflowBox, placedBoxes: AutoReflowBox[], gap: number) =>
  placedBoxes.some((placedBox) => boxesOverlap(expandedBox(box, gap), placedBox));

const createCandidate = (box: AutoReflowBox, x: number, y: number): AutoReflowBox => ({
  ...box,
  x,
  y,
});

const findOpenPlacement = ({
  box,
  placedBoxes,
  pageBounds,
  gap,
  gridSize,
}: {
  box: AutoReflowBox;
  placedBoxes: AutoReflowBox[];
  pageBounds: AutoReflowPageBounds;
  gap: number;
  gridSize: number;
}) => {
  const maxX = pageBounds.x + pageBounds.width - box.width;
  const maxY = pageBounds.y + pageBounds.height - box.height;
  const preferredY = snapValue(getRequiredY(box, placedBoxes, gap, pageBounds.y), gridSize);
  const preferred = createCandidate(
    box,
    snapValue(clamp(box.x, pageBounds.x, maxX), gridSize),
    preferredY,
  );

  if (fitsInsidePage(preferred, pageBounds) && !hasCollision(preferred, placedBoxes, gap)) {
    return {
      box: preferred,
      boundaryClamped: false,
    };
  }

  for (let y = pageBounds.y; y <= maxY; y += gridSize) {
    for (let x = pageBounds.x; x <= maxX; x += gridSize) {
      const candidate = createCandidate(box, x, y);

      if (!hasCollision(candidate, placedBoxes, gap)) {
        return {
          box: candidate,
          boundaryClamped: false,
        };
      }
    }
  }

  return {
    box: createCandidate(
      box,
      snapValue(clamp(box.x, pageBounds.x, maxX), gridSize),
      snapValue(clamp(preferredY, pageBounds.y, maxY), gridSize),
    ),
    boundaryClamped: true,
  };
};

const getDirection = (target: AutoReflowBox, candidate: AutoReflowBox): AutoReflowNeighbor["direction"] => {
  if (boxesOverlap(target, candidate)) {
    return "overlap";
  }

  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const candidateCenterX = candidate.x + candidate.width / 2;
  const candidateCenterY = candidate.y + candidate.height / 2;
  const horizontalDelta = candidateCenterX - targetCenterX;
  const verticalDelta = candidateCenterY - targetCenterY;

  if (Math.abs(verticalDelta) >= Math.abs(horizontalDelta)) {
    return verticalDelta < 0 ? "above" : "below";
  }

  return horizontalDelta < 0 ? "left" : "right";
};

export const detectNeighboringBoxes = (
  boxes: AutoReflowBox[],
  targetBoxId: string,
  gap = DEFAULT_GAP,
) => {
  const target = boxes.find((box) => box.id === targetBoxId);

  if (!target) {
    return [];
  }

  const expandedTarget = expandedBox(target, gap);

  return boxes
    .filter((box) => box.id !== target.id)
    .filter(
      (box) =>
        boxesOverlap(expandedTarget, box) ||
        rangesOverlap(target.x, getRight(target), box.x, getRight(box)) ||
        rangesOverlap(target.y, getBottom(target), box.y, getBottom(box)),
    )
    .map((box) => ({
      id: box.id,
      direction: getDirection(target, box),
    }));
};

export const countOverlaps = (boxes: AutoReflowBox[]) => {
  let overlapCount = 0;

  for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < boxes.length; secondIndex += 1) {
      if (boxesOverlap(boxes[firstIndex], boxes[secondIndex])) {
        overlapCount += 1;
      }
    }
  }

  return overlapCount;
};

export const reflowArticleBoxes = ({
  boxes,
  changedBoxId,
  pageBounds,
  gap = DEFAULT_GAP,
  gridSize = DEFAULT_GRID_SIZE,
}: AutoReflowInput): AutoReflowResult => {
  const safeGridSize = Math.max(1, gridSize);
  const safeGap = Math.max(0, gap);
  const normalizedBoxes = boxes.map((box) => normalizeBox(box, pageBounds, safeGridSize));
  const changedBox = normalizedBoxes.find((box) => box.id === changedBoxId);

  if (!changedBox) {
    return {
      boxes: normalizedBoxes,
      neighbors: [],
      affectedBoxIds: [],
      movedBoxIds: [],
      boundaryClampedBoxIds: [],
      overlapCount: countOverlaps(normalizedBoxes),
    };
  }

  const neighbors = detectNeighboringBoxes(normalizedBoxes, changedBoxId, safeGap);
  const placedBoxes: AutoReflowBox[] = [changedBox];
  const movedBoxIds: string[] = [];
  const boundaryClampedBoxIds: string[] = [];
  const originalById = new Map(normalizedBoxes.map((box) => [box.id, box]));

  for (const box of sortInReadingOrder(normalizedBoxes.filter((item) => item.id !== changedBoxId))) {
    const placement = findOpenPlacement({
      box,
      placedBoxes,
      pageBounds,
      gap: safeGap,
      gridSize: safeGridSize,
    });

    placedBoxes.push(placement.box);

    const original = originalById.get(box.id);

    if (original && !boxesEqual(original, placement.box)) {
      movedBoxIds.push(box.id);
    }

    if (placement.boundaryClamped) {
      boundaryClampedBoxIds.push(box.id);
    }
  }

  const boxOrder = new Map(boxes.map((box, index) => [box.id, index]));
  const reflowedBoxes = [...placedBoxes].sort(
    (a, b) => (boxOrder.get(a.id) ?? 0) - (boxOrder.get(b.id) ?? 0),
  );

  return {
    boxes: reflowedBoxes,
    neighbors,
    affectedBoxIds: Array.from(new Set([...neighbors.map((neighbor) => neighbor.id), ...movedBoxIds])),
    movedBoxIds,
    boundaryClampedBoxIds,
    overlapCount: countOverlaps(reflowedBoxes),
  };
};

export const AutoReflowEngine = {
  countOverlaps,
  detectNeighboringBoxes,
  reflowArticleBoxes,
};
