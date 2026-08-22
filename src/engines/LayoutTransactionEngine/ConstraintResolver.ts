import { rectBottom, rectRight } from "./LayoutGeometry";
import {
  getColumnGridAlignment,
  getEditorialPriorityWeight,
  getFrameBoundaryLimits,
  operationChangesGeometry,
  resolveConstraintPriorities,
} from "./ConstraintRules";
import type {
  ConstraintBlocker,
  ConstraintRequest,
  ConstraintResult,
  ConstraintWarning,
  LayoutFrameSnapshot,
  LayoutSnapshot,
} from "./LayoutTransactionTypes";

const DEFAULT_MIN_SIZE = {
  width: 1,
  height: 1,
};

const addBlocker = (
  blockedBy: ConstraintBlocker[],
  blocker: ConstraintBlocker,
) => {
  blockedBy.push(blocker);
};

const addWarning = (
  warnings: ConstraintWarning[],
  warning: ConstraintWarning,
) => {
  warnings.push(warning);
};

const getRequestedBox = (
  frame: LayoutFrameSnapshot,
  request: ConstraintRequest,
) => {
  const proposed = request.proposedFrames?.[frame.id];

  if (proposed) {
    return {
      ...frame,
      ...proposed,
    };
  }

  return {
    ...frame,
    x: frame.x + (request.delta?.x ?? 0),
    y: frame.y + (request.delta?.y ?? 0),
    width: frame.width + (request.delta?.width ?? 0),
    height: frame.height + (request.delta?.height ?? 0),
  };
};

/** Resolves a constraint request against rules in the mandated rule order. */
export const resolveConstraintRequest = (
  snapshot: LayoutSnapshot,
  request: ConstraintRequest,
): ConstraintResult => {
  const blockedBy: ConstraintBlocker[] = [];
  const warnings: ConstraintWarning[] = [];
  const reasons: string[] = [];
  const frame = snapshot.framesById[request.frameId];
  const requestedDelta = { ...(request.delta ?? {}) };

  if (!frame) {
    addBlocker(blockedBy, {
      rule: "locked-frame",
      frameId: request.frameId,
      message: `Frame '${request.frameId}' does not exist in the layout snapshot.`,
    });

    return {
      frameId: request.frameId,
      operation: request.operation,
      allowed: false,
      requestedDelta,
      limits: {
        grow: { left: 0, right: 0, top: 0, bottom: 0 },
        shrink: { width: 0, height: 0 },
        move: { left: 0, right: 0, up: 0, down: 0 },
      },
      blockedBy,
      warnings,
      reasons,
      resolvedPriorities: [],
    };
  }

  const limits = getFrameBoundaryLimits(snapshot, frame);
  const requestedBox = getRequestedBox(frame, request);
  const mutatesGeometry = operationChangesGeometry(request.operation);

  if (frame.locked && request.operation !== "insert") {
    addBlocker(blockedBy, {
      rule: "locked-frame",
      frameId: frame.id,
      message: `Locked frame '${frame.id}' cannot perform '${request.operation}'.`,
    });
  } else {
    reasons.push("Locked-frame rule passed.");
  }

  if (frame.kind === "advertisement" && request.operation !== "insert") {
    addBlocker(blockedBy, {
      rule: "advertisement",
      frameId: frame.id,
      message: `Advertisement frame '${frame.id}' is immutable for layout transactions.`,
    });
  } else {
    reasons.push("Advertisement rule passed.");
  }

  if (frame.pinned && mutatesGeometry && (requestedDelta.x || requestedDelta.y)) {
    addBlocker(blockedBy, {
      rule: "pinned-frame",
      frameId: frame.id,
      message: `Pinned frame '${frame.id}' cannot move from its anchor.`,
    });
  } else if (frame.pinned && request.operation === "resize") {
    addWarning(warnings, {
      rule: "pinned-frame",
      frameId: frame.id,
      message: `Pinned frame '${frame.id}' may resize only while preserving its anchor.`,
    });
  } else {
    reasons.push("Pinned-frame rule passed.");
  }

  if (
    mutatesGeometry &&
    (requestedBox.x < snapshot.contentBounds.x ||
      requestedBox.y < snapshot.contentBounds.y ||
      rectRight(requestedBox) > rectRight(snapshot.contentBounds) ||
      rectBottom(requestedBox) > rectBottom(snapshot.contentBounds))
  ) {
    addBlocker(blockedBy, {
      rule: "page-margins",
      frameId: frame.id,
      message: `Requested '${request.operation}' would leave content margins.`,
    });
  } else {
    reasons.push("Page-margin rule passed.");
  }

  const alignment = getColumnGridAlignment(snapshot, frame);
  if (request.operation === "resize" && frame.columnSpan && (!alignment.leftAligned || !alignment.rightAligned)) {
    addWarning(warnings, {
      rule: "column-grid",
      frameId: frame.id,
      message: `Frame '${frame.id}' is not fully aligned to the column grid before resize.`,
    });
  } else if (request.operation === "insert" && snapshot.columns.length === 0) {
    addBlocker(blockedBy, {
      rule: "column-grid",
      frameId: frame.id,
      message: "Automatic insertion requires at least one page column.",
    });
  } else {
    reasons.push("Column-grid rule passed.");
  }

  const minWidth = request.minSize?.width ?? DEFAULT_MIN_SIZE.width;
  const minHeight = request.minSize?.height ?? DEFAULT_MIN_SIZE.height;
  if (requestedBox.width < minWidth || requestedBox.height < minHeight) {
    addBlocker(blockedBy, {
      rule: "minimum-size",
      frameId: frame.id,
      message: `Requested size is below minimum ${minWidth} x ${minHeight}.`,
    });
  } else {
    reasons.push("Minimum-size rule passed.");
  }

  if (
    (typeof request.maxSize?.width === "number" && requestedBox.width > request.maxSize.width) ||
    (typeof request.maxSize?.height === "number" && requestedBox.height > request.maxSize.height)
  ) {
    addBlocker(blockedBy, {
      rule: "maximum-size",
      frameId: frame.id,
      message: "Requested size exceeds maximum size constraint.",
    });
  } else {
    reasons.push("Maximum-size rule passed.");
  }

  const sourcePriority = getEditorialPriorityWeight(frame);
  if ((request.operation === "delete" || request.operation === "merge") && sourcePriority >= 100) {
    addWarning(warnings, {
      rule: "editorial-priority",
      frameId: frame.id,
      message: `High-priority frame '${frame.id}' should not be ${request.operation}d without explicit editorial approval.`,
    });
  }
  reasons.push(`Editorial-priority rule resolved weight ${sourcePriority}.`);

  if (
    request.preferredSize &&
    ((typeof request.preferredSize.width === "number" && requestedBox.width !== request.preferredSize.width) ||
      (typeof request.preferredSize.height === "number" && requestedBox.height !== request.preferredSize.height))
  ) {
    addWarning(warnings, {
      rule: "preferred-size",
      frameId: frame.id,
      message: "Requested operation diverges from preferred frame size.",
    });
  } else {
    reasons.push("Preferred-size rule passed.");
  }

  const adjacentWhitespace = snapshot.whitespaceMap.filter((cell) => cell.boundedBy.includes(frame.id));
  if (request.operation === "automatic-placement" && adjacentWhitespace.length === 0) {
    addWarning(warnings, {
      rule: "whitespace",
      frameId: frame.id,
      message: "No adjacent whitespace is available for automatic placement.",
    });
  } else {
    reasons.push(`Whitespace rule found ${adjacentWhitespace.length} adjacent cells.`);
  }

  return {
    frameId: frame.id,
    operation: request.operation,
    allowed: blockedBy.length === 0,
    requestedDelta,
    limits: {
      ...limits,
      shrink: {
        width: Math.max(0, frame.width - minWidth),
        height: Math.max(0, frame.height - minHeight),
      },
    },
    blockedBy,
    warnings,
    reasons,
    resolvedPriorities: resolveConstraintPriorities(snapshot, frame),
  };
};
