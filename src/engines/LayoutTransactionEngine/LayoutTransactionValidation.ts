import { rectContains, rectsOverlap } from "./LayoutGeometry";
import type {
  LayoutSnapshot,
  LayoutTransaction,
  LayoutValidationIssue,
  LayoutValidationResult,
} from "./LayoutTransactionTypes";

const addIssue = (
  issues: LayoutValidationIssue[],
  issue: LayoutValidationIssue,
) => {
  issues.push(issue);
};

/**
 * Validates an immutable layout transaction against a snapshot.
 *
 * This layer checks transaction structure, hard object constraints, page/content
 * boundaries, negative sizes, overlaps after patches, and basic column-span
 * metadata. It does not run typography or region validation.
 */
export const validateLayoutTransaction = (
  snapshot: LayoutSnapshot,
  transaction: LayoutTransaction,
): LayoutValidationResult => {
  const issues: LayoutValidationIssue[] = [];

  if (transaction.patches.length === 0) {
    addIssue(issues, {
      code: "empty-transaction",
      severity: "error",
      message: "Layout transaction must contain at least one geometry patch.",
    });
  }

  const nextFrames = new Map(snapshot.visibleFrames.map((frame) => [frame.id, { ...frame }]));

  for (const patch of transaction.patches) {
    const frame = snapshot.framesById[patch.frameId];

    if (!frame) {
      addIssue(issues, {
        code: "missing-frame",
        severity: "error",
        frameId: patch.frameId,
        message: `Transaction references unknown frame '${patch.frameId}'.`,
      });
      continue;
    }

    if (frame.locked) {
      addIssue(issues, {
        code: "locked-frame-mutated",
        severity: "error",
        frameId: frame.id,
        message: `Locked frame '${frame.id}' cannot be changed by a layout transaction.`,
      });
    }

    if (frame.kind === "advertisement") {
      addIssue(issues, {
        code: "advertisement-mutated",
        severity: "error",
        frameId: frame.id,
        message: `Advertisement frame '${frame.id}' cannot be changed by a layout transaction.`,
      });
    }

    if (patch.after.width <= 0 || patch.after.height <= 0) {
      addIssue(issues, {
        code: "negative-size",
        severity: "error",
        frameId: frame.id,
        message: `Frame '${frame.id}' has an invalid size after transaction.`,
      });
    }

    if (!rectContains(snapshot.pageBounds, patch.after)) {
      addIssue(issues, {
        code: "page-bounds",
        severity: "error",
        frameId: frame.id,
        message: `Frame '${frame.id}' leaves page bounds.`,
      });
    }

    if (!rectContains(snapshot.contentBounds, patch.after)) {
      addIssue(issues, {
        code: "content-bounds",
        severity: "warning",
        frameId: frame.id,
        message: `Frame '${frame.id}' leaves content bounds.`,
      });
    }

    if (
      typeof frame.columnSpan === "number" &&
      (frame.columnSpan < 1 || frame.columnSpan > Math.max(1, snapshot.columns.length))
    ) {
      addIssue(issues, {
        code: "invalid-column-span",
        severity: "error",
        frameId: frame.id,
        message: `Frame '${frame.id}' has an invalid column span.`,
      });
    }

    nextFrames.set(frame.id, {
      ...frame,
      ...patch.after,
    });
  }

  const frames = [...nextFrames.values()].filter((frame) => !frame.hidden);

  for (let firstIndex = 0; firstIndex < frames.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < frames.length; secondIndex += 1) {
      const first = frames[firstIndex];
      const second = frames[secondIndex];

      if (rectsOverlap(first, second)) {
        addIssue(issues, {
          code: "overlap",
          severity: "error",
          frameId: first.id,
          message: `Frame '${first.id}' overlaps frame '${second.id}' after transaction.`,
        });
      }
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};
