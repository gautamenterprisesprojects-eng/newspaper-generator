import { commitLayoutSolution, type LayoutCommitResult } from "./LayoutCommitEngine";
import {
  createCompositionSessionManager,
  createGeometrySnapshot,
  type CompositionSessionManager,
} from "@/engines/CompositionSession";
import {
  runLayoutKernelShadowDelete,
  runLayoutKernelShadowMove,
  runLayoutKernelShadowResize,
  type LayoutKernelDeleteRequest,
  type LayoutKernelResizeRequest,
} from "./LayoutKernelAdapter";
import { createPreviewLayout, discardPreviewLayout, type PreviewLayout } from "./PreviewLayout";
import { buildPreviewDrawCommands, type PreviewDrawCommand } from "./PreviewRenderer";
import type { StoryFrame } from "@/types/editor";
import type { NewspaperDocument, NewspaperPageId } from "@/types/document";
import type { LayoutRect } from "./LayoutTransactionTypes";

export type LiveResizeHandle = "e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw";

export type LiveResizePointer = {
  x: number;
  y: number;
};

export type LiveResizeCommitContext = {
  stories: StoryFrame[];
  document: NewspaperDocument;
  pageId: NewspaperPageId;
};

export type LiveResizeSessionInput = Omit<LayoutKernelResizeRequest, "requested"> & {
  handle: LiveResizeHandle;
  startPointer: LiveResizePointer;
  commitContext?: LiveResizeCommitContext;
};

export type LiveResizePreviewResult = {
  preview: PreviewLayout;
  drawCommands: PreviewDrawCommand[];
};

export type LiveResizeEndResult = {
  preview: PreviewLayout | null;
  drawCommands: PreviewDrawCommand[];
  commit: LayoutCommitResult | null;
  session: ReturnType<CompositionSessionManager["commit"]>["session"];
  transaction: ReturnType<CompositionSessionManager["commit"]>["transaction"];
  committed: boolean;
  discarded: boolean;
};

export type LiveResizeControllerOptions = {
  minFrameIntervalMs?: number;
};

type LiveResizeSession = LiveResizeSessionInput & {
  sequence: number;
  lastPreviewAt: number;
  lastPreview: PreviewLayout | null;
  canceled: boolean;
};

type LiveMoveSession = Omit<LiveResizeSessionInput, "handle"> & {
  sequence: number;
  lastPreviewAt: number;
  lastPreview: PreviewLayout | null;
  canceled: boolean;
};

type LiveDeleteSession = LayoutKernelDeleteRequest & {
  sequence: number;
  lastPreviewAt: number;
  lastPreview: PreviewLayout | null;
  canceled: boolean;
  commitContext?: LiveResizeCommitContext;
};

const DEFAULT_MIN_FRAME_INTERVAL_MS = 1000 / 60;

const copyRect = (rect: LayoutRect): LayoutRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

const getRequestedRect = ({
  before,
  handle,
  startPointer,
  pointer,
  minSize,
}: {
  before: LayoutRect;
  handle: LiveResizeHandle;
  startPointer: LiveResizePointer;
  pointer: LiveResizePointer;
  minSize?: LayoutKernelResizeRequest["minSize"];
}): LayoutRect => {
  const delta = {
    x: pointer.x - startPointer.x,
    y: pointer.y - startPointer.y,
  };
  const minWidth = minSize?.width ?? 1;
  const minHeight = minSize?.height ?? 1;
  const next = copyRect(before);

  if (handle.includes("e")) {
    next.width = Math.max(minWidth, before.width + delta.x);
  }

  if (handle.includes("s")) {
    next.height = Math.max(minHeight, before.height + delta.y);
  }

  if (handle.includes("w")) {
    const width = Math.max(minWidth, before.width - delta.x);
    next.x = before.x + before.width - width;
    next.width = width;
  }

  if (handle.includes("n")) {
    const height = Math.max(minHeight, before.height - delta.y);
    next.y = before.y + before.height - height;
    next.height = height;
  }

  return next;
};

const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Coordinates live smart-layout resize previews without mutating editor state.
 *
 * `updateResize()` converts pointer motion into a resize intent by deriving the
 * requested rectangle, runs `LayoutKernelAdapter` in preview/shadow mode, and
 * stores only preview data. `endResize()` commits the last valid solution only
 * when a commit context was provided.
 */
export class LiveResizeController {
  private readonly minFrameIntervalMs: number;

  private session: LiveResizeSession | null = null;

  private moveSession: LiveMoveSession | null = null;

  private deleteSession: LiveDeleteSession | null = null;

  private readonly compositionSessionManager: CompositionSessionManager;

  constructor(options: LiveResizeControllerOptions = {}) {
    this.minFrameIntervalMs = options.minFrameIntervalMs ?? DEFAULT_MIN_FRAME_INTERVAL_MS;
    this.compositionSessionManager = createCompositionSessionManager({
      minFrameIntervalMs: this.minFrameIntervalMs,
      idPrefix: "live-resize",
    });
  }

  /** Starts a cancelable live resize session. */
  beginResize(input: LiveResizeSessionInput): void {
    this.compositionSessionManager.begin({
      pageId: input.pageId,
      operation: "resize-story",
      beforePageSnapshot: createGeometrySnapshot(input.frames),
    });
    this.session = {
      ...input,
      before: copyRect(input.before),
      startPointer: { ...input.startPointer },
      sequence: 0,
      lastPreviewAt: Number.NEGATIVE_INFINITY,
      lastPreview: null,
      canceled: false,
    };
  }

  /** Starts a cancelable live move session. */
  beginMove(input: Omit<LiveResizeSessionInput, "handle">): void {
    this.compositionSessionManager.begin({
      pageId: input.pageId,
      operation: "move-story",
      beforePageSnapshot: createGeometrySnapshot(input.frames),
    });
    this.moveSession = {
      ...input,
      before: copyRect(input.before),
      startPointer: { ...input.startPointer },
      sequence: 0,
      lastPreviewAt: Number.NEGATIVE_INFINITY,
      lastPreview: null,
      canceled: false,
    };
  }

  /** Starts a cancelable smart-delete session. */
  beginDelete(input: LayoutKernelDeleteRequest & { commitContext?: LiveResizeCommitContext }): void {
    this.compositionSessionManager.begin({
      pageId: input.pageId,
      operation: "delete-story",
      beforePageSnapshot: createGeometrySnapshot(input.frames),
    });
    this.deleteSession = {
      ...input,
      sequence: 0,
      lastPreviewAt: Number.NEGATIVE_INFINITY,
      lastPreview: null,
      canceled: false,
    };
  }

  /**
   * Updates the active preview from the current pointer position.
   *
   * Returns `null` when no session exists, the session was canceled, or the
   * update is skipped to preserve the configured 60 FPS budget.
   */
  updateResize({
    pointer,
    nowMs = getNow(),
    force = false,
  }: {
    pointer: LiveResizePointer;
    nowMs?: number;
    force?: boolean;
  }): LiveResizePreviewResult | null {
    const session = this.session;

    if (!session || session.canceled) {
      return null;
    }

    if (!force && nowMs - session.lastPreviewAt < this.minFrameIntervalMs) {
      return null;
    }

    const requested = getRequestedRect({
      before: session.before,
      handle: session.handle,
      startPointer: session.startPointer,
      pointer,
      minSize: session.minSize,
    });
    const diff = runLayoutKernelShadowResize({
      pageId: session.pageId,
      pageBounds: session.pageBounds,
      contentBounds: session.contentBounds,
      columns: session.columns,
      frames: session.frames,
      sourceFrameId: session.sourceFrameId,
      before: session.before,
      requested,
      minSize: session.minSize,
      maxSize: session.maxSize,
      preferredSize: session.preferredSize,
      baselineGridSize: session.baselineGridSize,
    });
    const preview = createPreviewLayout({
      diff,
      sequence: session.sequence + 1,
    });
    this.compositionSessionManager.preview({
      preview,
      kernelTimeMs: diff.performance.totalTimeMs,
      iterationCount: 1,
      nowMs,
      force,
    });

    this.session = {
      ...session,
      sequence: preview.sequence,
      lastPreviewAt: nowMs,
      lastPreview: preview,
    };

    return {
      preview,
      drawCommands: buildPreviewDrawCommands(preview),
    };
  }

  /** Updates the active smart-move preview from the current pointer position. */
  updateMove({
    pointer,
    nowMs = getNow(),
    force = false,
  }: {
    pointer: LiveResizePointer;
    nowMs?: number;
    force?: boolean;
  }): LiveResizePreviewResult | null {
    const session = this.moveSession;

    if (!session || session.canceled) {
      return null;
    }

    if (!force && nowMs - session.lastPreviewAt < this.minFrameIntervalMs) {
      return null;
    }

    const requested = {
      ...session.before,
      x: session.before.x + pointer.x - session.startPointer.x,
      y: session.before.y + pointer.y - session.startPointer.y,
    };
    const diff = runLayoutKernelShadowMove({
      pageId: session.pageId,
      pageBounds: session.pageBounds,
      contentBounds: session.contentBounds,
      columns: session.columns,
      frames: session.frames,
      sourceFrameId: session.sourceFrameId,
      before: session.before,
      requested,
      baselineGridSize: session.baselineGridSize,
    });
    const preview = createPreviewLayout({
      diff,
      sequence: session.sequence + 1,
    });

    this.compositionSessionManager.preview({
      preview,
      kernelTimeMs: diff.performance.totalTimeMs,
      iterationCount: 1,
      nowMs,
      force,
    });
    this.moveSession = {
      ...session,
      sequence: preview.sequence,
      lastPreviewAt: nowMs,
      lastPreview: preview,
    };

    return {
      preview,
      drawCommands: buildPreviewDrawCommands(preview),
    };
  }

  /** Updates the active smart-delete preview without mutating editor state. */
  updateDelete({
    nowMs = getNow(),
    force = false,
  }: {
    nowMs?: number;
    force?: boolean;
  } = {}): LiveResizePreviewResult | null {
    const session = this.deleteSession;

    if (!session || session.canceled) {
      return null;
    }

    if (!force && nowMs - session.lastPreviewAt < this.minFrameIntervalMs) {
      return null;
    }

    const diff = runLayoutKernelShadowDelete({
      pageId: session.pageId,
      pageBounds: session.pageBounds,
      contentBounds: session.contentBounds,
      columns: session.columns,
      frames: session.frames,
      sourceFrameId: session.sourceFrameId,
      baselineGridSize: session.baselineGridSize,
    });
    const preview = createPreviewLayout({
      diff,
      sequence: session.sequence + 1,
    });

    this.compositionSessionManager.preview({
      preview,
      kernelTimeMs: diff.performance.totalTimeMs,
      iterationCount: 1,
      nowMs,
      force,
    });
    this.deleteSession = {
      ...session,
      sequence: preview.sequence,
      lastPreviewAt: nowMs,
      lastPreview: preview,
    };

    return {
      preview,
      drawCommands: buildPreviewDrawCommands(preview),
    };
  }

  /** Cancels the active preview session and returns discarded preview commands. */
  cancelResize(): LiveResizeEndResult {
    const preview = discardPreviewLayout(this.session?.lastPreview ?? null);
    const sessionResult = this.compositionSessionManager.cancel();
    this.session = null;

    return {
      preview,
      drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
      commit: null,
      session: sessionResult.session,
      transaction: null,
      committed: false,
      discarded: true,
    };
  }

  /** Cancels the active smart-move session and returns discarded preview commands. */
  cancelMove(): LiveResizeEndResult {
    const preview = discardPreviewLayout(this.moveSession?.lastPreview ?? null);
    const sessionResult = this.compositionSessionManager.cancel();
    this.moveSession = null;

    return {
      preview,
      drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
      commit: null,
      session: sessionResult.session,
      transaction: null,
      committed: false,
      discarded: true,
    };
  }

  /** Cancels the active smart-delete session and returns discarded preview commands. */
  cancelDelete(): LiveResizeEndResult {
    const preview = discardPreviewLayout(this.deleteSession?.lastPreview ?? null);
    const sessionResult = this.compositionSessionManager.cancel();
    this.deleteSession = null;

    return {
      preview,
      drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
      commit: null,
      session: sessionResult.session,
      transaction: null,
      committed: false,
      discarded: true,
    };
  }

  /**
   * Finishes the active resize session.
   *
   * A valid preview is committed through `LayoutCommitEngine` only on release.
   * Invalid previews, missing previews, and missing commit context are discarded.
   */
  endResize(): LiveResizeEndResult {
    const session = this.session;
    this.session = null;

    if (!session?.lastPreview || !session.lastPreview.solution.valid || !session.commitContext) {
      const preview = discardPreviewLayout(session?.lastPreview ?? null);
      const sessionResult = this.compositionSessionManager.rollback();

      return {
        preview,
        drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
        commit: null,
        session: sessionResult.session,
        transaction: null,
        committed: false,
        discarded: true,
      };
    }

    const commit = commitLayoutSolution({
      stories: session.commitContext.stories,
      document: session.commitContext.document,
      pageId: session.commitContext.pageId,
      solution: session.lastPreview.solution,
    });
    const sessionResult = commit.committed
      ? this.compositionSessionManager.commit({
          afterPageSnapshot: createGeometrySnapshot(commit.stories),
          commitTimeMs: 0,
          transaction: {
            layoutSolution: session.lastPreview.solution,
          },
        })
      : this.compositionSessionManager.rollback();

    return {
      preview: session.lastPreview,
      drawCommands: buildPreviewDrawCommands(session.lastPreview),
      commit,
      session: sessionResult.session,
      transaction: sessionResult.transaction,
      committed: commit.committed,
      discarded: !commit.committed,
    };
  }

  /** Finishes the active smart-move session and commits once when valid. */
  endMove(): LiveResizeEndResult {
    const session = this.moveSession;
    this.moveSession = null;

    if (!session?.lastPreview || !session.lastPreview.solution.valid || !session.commitContext) {
      const preview = discardPreviewLayout(session?.lastPreview ?? null);
      const sessionResult = this.compositionSessionManager.rollback();

      return {
        preview,
        drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
        commit: null,
        session: sessionResult.session,
        transaction: null,
        committed: false,
        discarded: true,
      };
    }

    const commit = commitLayoutSolution({
      stories: session.commitContext.stories,
      document: session.commitContext.document,
      pageId: session.commitContext.pageId,
      solution: session.lastPreview.solution,
    });
    const sessionResult = commit.committed
      ? this.compositionSessionManager.commit({
          afterPageSnapshot: createGeometrySnapshot(commit.stories),
          commitTimeMs: 0,
          transaction: {
            layoutSolution: session.lastPreview.solution,
          },
        })
      : this.compositionSessionManager.rollback();

    return {
      preview: session.lastPreview,
      drawCommands: buildPreviewDrawCommands(session.lastPreview),
      commit,
      session: sessionResult.session,
      transaction: sessionResult.transaction,
      committed: commit.committed,
      discarded: !commit.committed,
    };
  }

  /** Finishes the active smart-delete session and commits the repaired page once when valid. */
  endDelete(): LiveResizeEndResult {
    const session = this.deleteSession;
    this.deleteSession = null;

    if (!session?.lastPreview || !session.lastPreview.solution.valid || !session.commitContext) {
      const preview = discardPreviewLayout(session?.lastPreview ?? null);
      const sessionResult = this.compositionSessionManager.rollback();

      return {
        preview,
        drawCommands: preview ? buildPreviewDrawCommands(preview) : [],
        commit: null,
        session: sessionResult.session,
        transaction: null,
        committed: false,
        discarded: true,
      };
    }

    const remainingStories = session.commitContext.stories.filter((story) => story.id !== session.sourceFrameId);
    const commit = commitLayoutSolution({
      stories: remainingStories,
      document: session.commitContext.document,
      pageId: session.commitContext.pageId,
      solution: session.lastPreview.solution,
    });
    const sessionResult = commit.committed
      ? this.compositionSessionManager.commit({
          afterPageSnapshot: createGeometrySnapshot(commit.stories),
          commitTimeMs: 0,
          transaction: {
            layoutSolution: session.lastPreview.solution,
          },
        })
      : this.compositionSessionManager.rollback();

    return {
      preview: session.lastPreview,
      drawCommands: buildPreviewDrawCommands(session.lastPreview),
      commit,
      session: sessionResult.session,
      transaction: sessionResult.transaction,
      committed: commit.committed,
      discarded: !commit.committed,
    };
  }
}

/** Public facade factory for live resize preview sessions. */
export const createLiveResizeController = (options?: LiveResizeControllerOptions) =>
  new LiveResizeController(options);
