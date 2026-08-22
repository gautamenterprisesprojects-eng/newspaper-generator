import { rectBottom, rectRight, rectsOverlap } from "./LayoutGeometry";
import type { LayoutFrameSnapshot, LayoutRect, LayoutSnapshot } from "./LayoutTransactionTypes";

export type LayoutCollision = {
  firstFrameId: string;
  secondFrameId: string;
};

const canMove = (frame: LayoutFrameSnapshot | undefined) =>
  Boolean(frame && !frame.locked && !frame.pinned && frame.kind !== "advertisement");

const findCollisions = (
  rects: Map<string, LayoutRect>,
  snapshot: LayoutSnapshot,
): LayoutCollision[] => {
  const frames = [...rects.entries()].filter(([id]) => !snapshot.framesById[id]?.hidden);
  const collisions: LayoutCollision[] = [];

  for (let firstIndex = 0; firstIndex < frames.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < frames.length; secondIndex += 1) {
      const [firstId, first] = frames[firstIndex];
      const [secondId, second] = frames[secondIndex];

      if (rectsOverlap(first, second)) {
        collisions.push({ firstFrameId: firstId, secondFrameId: secondId });
      }
    }
  }

  return collisions;
};

const pushSecondBelow = (
  rects: Map<string, LayoutRect>,
  snapshot: LayoutSnapshot,
  firstId: string,
  secondId: string,
) => {
  const first = rects.get(firstId);
  const second = rects.get(secondId);
  const secondFrame = snapshot.framesById[secondId];

  if (!first || !second || !canMove(secondFrame)) {
    return false;
  }

  const nextY = rectBottom(first);
  const maxY = rectBottom(snapshot.contentBounds) - second.height;

  if (nextY > maxY) {
    return false;
  }

  rects.set(secondId, { ...second, y: nextY });
  return true;
};

const compressSecondHeight = (
  rects: Map<string, LayoutRect>,
  snapshot: LayoutSnapshot,
  firstId: string,
  secondId: string,
) => {
  const first = rects.get(firstId);
  const second = rects.get(secondId);
  const secondFrame = snapshot.framesById[secondId];

  if (!first || !second || !canMove(secondFrame)) {
    return false;
  }

  const overlap = rectBottom(first) - second.y;
  const nextHeight = second.height - Math.max(0, overlap);

  if (nextHeight < 1) {
    return false;
  }

  rects.set(secondId, { ...second, y: rectBottom(first), height: nextHeight });
  return true;
};

/** Attempts deterministic collision repair using push, compress, and row repack style moves. */
export const resolveCollisions = (
  snapshot: LayoutSnapshot,
  proposed: Map<string, LayoutRect>,
) => {
  const resolved = new Map([...proposed.entries()].map(([id, rect]) => [id, { ...rect }]));
  const warnings: string[] = [];

  for (let pass = 0; pass < 4; pass += 1) {
    const collisions = findCollisions(resolved, snapshot);

    if (collisions.length === 0) {
      break;
    }

    let changed = false;

    for (const collision of collisions) {
      const first = resolved.get(collision.firstFrameId);
      const second = resolved.get(collision.secondFrameId);

      if (!first || !second) {
        continue;
      }

      const firstBeforeSecond =
        first.y < second.y ||
        (first.y === second.y && first.x <= second.x);
      const anchorId = firstBeforeSecond ? collision.firstFrameId : collision.secondFrameId;
      const movableId = firstBeforeSecond ? collision.secondFrameId : collision.firstFrameId;

      changed =
        pushSecondBelow(resolved, snapshot, anchorId, movableId) ||
        compressSecondHeight(resolved, snapshot, anchorId, movableId) ||
        changed;
    }

    if (!changed) {
      break;
    }
  }

  const unresolvedCollisions = findCollisions(resolved, snapshot);

  if (unresolvedCollisions.length > 0) {
    warnings.push(`Unresolved collisions remain: ${unresolvedCollisions.length}.`);
  }

  return {
    resolved,
    unresolvedCollisions,
    warnings,
  };
};
