import type { LayoutDiff } from "./LayoutKernelAdapter";
import type { LayoutRect, LayoutSolution, NeighborResizeDirection } from "./LayoutTransactionTypes";

export type PreviewFrameRole = "source" | "affected" | "unchanged";

export type PreviewFrame = {
  frameId: string;
  role: PreviewFrameRole;
  before: LayoutRect;
  after: LayoutRect;
  changed: boolean;
};

export type PreviewLayoutStatus = "ready" | "invalid" | "discarded";

export type PreviewLayout = {
  id: string;
  sequence: number;
  sourceFrameId: string;
  resizeDirection: NeighborResizeDirection;
  requiredSpace: number;
  status: PreviewLayoutStatus;
  frames: PreviewFrame[];
  warnings: string[];
  constraintViolations: string[];
  solution: LayoutSolution;
  metrics: LayoutDiff["performance"];
};

const copyRect = (rect: LayoutRect): LayoutRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

/**
 * Converts a layout-kernel diff into a deterministic preview model.
 *
 * The returned value is immutable-by-convention and contains only proposed
 * geometry. It never writes StoryFrames or document data.
 */
export const createPreviewLayout = ({
  diff,
  sequence,
}: {
  diff: LayoutDiff;
  sequence: number;
}): PreviewLayout => {
  const changedById = new Map(diff.geometryDifferences.map((item) => [item.frameId, item]));
  const frames: PreviewFrame[] = Object.entries(diff.solution.before)
    .map(([frameId, before]) => {
      const changed = changedById.get(frameId);
      const after = diff.solution.after[frameId] ?? before;
      const role: PreviewFrameRole = frameId === diff.sourceFrameId ? "source" : changed ? "affected" : "unchanged";

      return {
        frameId,
        role,
        before: copyRect(before),
        after: copyRect(after),
        changed: Boolean(changed),
      };
    })
    .sort((first, second) => first.frameId.localeCompare(second.frameId));

  return {
    id: ["preview-layout", diff.sourceFrameId, sequence].join(":"),
    sequence,
    sourceFrameId: diff.sourceFrameId,
    resizeDirection: diff.resizeDirection,
    requiredSpace: diff.requiredSpace,
    status: diff.solution.valid ? "ready" : "invalid",
    frames,
    warnings: [...diff.warnings],
    constraintViolations: [...diff.constraintViolations],
    solution: diff.solution,
    metrics: { ...diff.performance },
  };
};

/** Returns a discarded preview marker without retaining proposed geometry. */
export const discardPreviewLayout = (preview: PreviewLayout | null): PreviewLayout | null =>
  preview
    ? {
        ...preview,
        status: "discarded",
        frames: preview.frames.map((frame) => ({
          ...frame,
          before: copyRect(frame.before),
          after: copyRect(frame.before),
          changed: false,
        })),
      }
    : null;
