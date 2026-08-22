import { rectBottom, rectRight } from "./LayoutGeometry";
import type { GeometryPatch } from "./GeometryPatch";
import type { LayoutRect, LayoutSnapshot } from "./LayoutTransactionTypes";

const cloneRect = (rect: LayoutRect): LayoutRect => ({ ...rect });

const applyPatch = (rect: LayoutRect, patch: GeometryPatch): LayoutRect => {
  if (patch.operation === "expand") {
    if (patch.direction === "right") {
      return { ...rect, width: rect.width + patch.amount };
    }

    if (patch.direction === "left") {
      return { ...rect, x: rect.x - patch.amount, width: rect.width + patch.amount };
    }

    if (patch.direction === "bottom") {
      return { ...rect, height: rect.height + patch.amount };
    }

    if (patch.direction === "top") {
      return { ...rect, y: rect.y - patch.amount, height: rect.height + patch.amount };
    }
  }

  if (patch.operation === "shrink" || patch.operation === "reserve") {
    if (patch.direction === "right") {
      return { ...rect, x: rect.x + patch.amount, width: Math.max(1, rect.width - patch.amount) };
    }

    if (patch.direction === "left") {
      return { ...rect, width: Math.max(1, rect.width - patch.amount) };
    }

    if (patch.direction === "bottom") {
      return { ...rect, y: rect.y + patch.amount, height: Math.max(1, rect.height - patch.amount) };
    }

    if (patch.direction === "top") {
      return { ...rect, height: Math.max(1, rect.height - patch.amount) };
    }
  }

  if (patch.operation === "move" || patch.operation === "translate") {
    if (patch.direction === "right") {
      return { ...rect, x: rect.x + patch.amount };
    }

    if (patch.direction === "left") {
      return { ...rect, x: rect.x - patch.amount };
    }

    if (patch.direction === "bottom") {
      return { ...rect, y: rect.y + patch.amount };
    }

    if (patch.direction === "top") {
      return { ...rect, y: rect.y - patch.amount };
    }
  }

  return rect;
};

/** Converts geometry patch intents into proposed frame rectangles. */
export const resolveGeometryPatches = (
  snapshot: LayoutSnapshot,
  patches: GeometryPatch[],
) => {
  const proposed = new Map<string, LayoutRect>(
    snapshot.visibleFrames.map((frame) => [frame.id, cloneRect(frame)]),
  );
  const warnings: string[] = [];

  for (const patch of patches) {
    const current = proposed.get(patch.frameId);

    if (!current) {
      warnings.push(`Patch references missing frame '${patch.frameId}'.`);
      continue;
    }

    proposed.set(patch.frameId, applyPatch(current, patch));
  }

  for (const [frameId, rect] of proposed) {
    const clampedRight = Math.min(rectRight(rect), rectRight(snapshot.pageBounds));
    const clampedBottom = Math.min(rectBottom(rect), rectBottom(snapshot.pageBounds));

    proposed.set(frameId, {
      x: Math.max(snapshot.pageBounds.x, rect.x),
      y: Math.max(snapshot.pageBounds.y, rect.y),
      width: Math.max(1, clampedRight - Math.max(snapshot.pageBounds.x, rect.x)),
      height: Math.max(1, clampedBottom - Math.max(snapshot.pageBounds.y, rect.y)),
    });
  }

  return {
    proposed,
    warnings,
  };
};
