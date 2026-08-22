import type { PreviewFrame, PreviewLayout } from "./PreviewLayout";
import type { LayoutRect } from "./LayoutTransactionTypes";

export type PreviewDrawCommandKind = "frame-outline" | "source-outline" | "invalid-overlay";

export type PreviewDrawCommand = {
  id: string;
  kind: PreviewDrawCommandKind;
  frameId: string;
  rect: LayoutRect;
  stroke: string;
  fill: string;
  opacity: number;
  dash: number[];
  zIndex: number;
};

const rectOf = (rect: LayoutRect): LayoutRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

const getCommandKind = (preview: PreviewLayout, frame: PreviewFrame): PreviewDrawCommandKind => {
  if (preview.status === "invalid") {
    return "invalid-overlay";
  }

  return frame.role === "source" ? "source-outline" : "frame-outline";
};

/**
 * Converts a PreviewLayout into deterministic renderer-neutral draw commands.
 *
 * These commands are intentionally not React, Konva, Canvas, or DOM nodes. The
 * editor can map them to its active rendering surface without the preview
 * engine mutating live StoryFrames.
 */
export const buildPreviewDrawCommands = (preview: PreviewLayout): PreviewDrawCommand[] =>
  preview.frames
    .filter((frame) => frame.changed || frame.role === "source" || preview.status === "invalid")
    .map((frame, index) => {
      const kind = getCommandKind(preview, frame);

      return {
        id: ["preview-command", preview.sequence, frame.frameId, kind].join(":"),
        kind,
        frameId: frame.frameId,
        rect: rectOf(frame.after),
        stroke: kind === "invalid-overlay" ? "#b42318" : frame.role === "source" ? "#0d5f75" : "#247a48",
        fill: kind === "invalid-overlay" ? "rgba(180, 35, 24, 0.08)" : "rgba(36, 122, 72, 0.08)",
        opacity: preview.status === "discarded" ? 0 : 1,
        dash: frame.role === "source" ? [7, 4] : [4, 4],
        zIndex: index,
      };
    })
    .sort((first, second) => first.zIndex - second.zIndex || first.id.localeCompare(second.id));

/** Public facade for preview draw-command generation. */
export const PreviewRenderer = {
  buildPreviewDrawCommands,
};
