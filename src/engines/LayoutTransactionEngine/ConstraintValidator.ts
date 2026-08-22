import { rectContains, rectsOverlap } from "./LayoutGeometry";
import type { LayoutRect, LayoutSnapshot } from "./LayoutTransactionTypes";

/** Validates proposed geometry against hard layout constraints. */
export const validateSolvedGeometry = (
  snapshot: LayoutSnapshot,
  proposed: Map<string, LayoutRect>,
) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [frameId, rect] of proposed) {
    const frame = snapshot.framesById[frameId];

    if (!frame) {
      errors.push(`Unknown frame '${frameId}'.`);
      continue;
    }

    if ((frame.locked || frame.pinned || frame.kind === "advertisement") &&
      (frame.x !== rect.x || frame.y !== rect.y || frame.width !== rect.width || frame.height !== rect.height)
    ) {
      errors.push(`Immutable frame '${frameId}' was changed.`);
    }

    if (!rectContains(snapshot.pageBounds, rect)) {
      errors.push(`Frame '${frameId}' leaves page bounds.`);
    }

    if (!rectContains(snapshot.contentBounds, rect)) {
      warnings.push(`Frame '${frameId}' leaves content bounds.`);
    }

    if (rect.width <= 0 || rect.height <= 0) {
      errors.push(`Frame '${frameId}' has invalid size.`);
    }
  }

  const entries = [...proposed.entries()];

  for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
      const [firstId, first] = entries[firstIndex];
      const [secondId, second] = entries[secondIndex];

      if (rectsOverlap(first, second)) {
        errors.push(`Frame '${firstId}' overlaps frame '${secondId}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
