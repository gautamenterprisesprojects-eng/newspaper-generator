import {
  calculatePreviewFps,
  mergeCompositionMetrics,
} from "./CompositionMetrics";
import {
  createCompositionSession,
  type CompositionSession,
} from "./CompositionSession";
import {
  createCompositionTransaction,
  type CompositionGeometrySnapshot,
  type CompositionOperationType,
  type CompositionTransaction,
} from "./CompositionTransaction";
import {
  createCompositionHistory,
  pushCompositionTransaction,
  redoCompositionTransaction,
  undoCompositionTransaction,
  type CompositionHistoryState,
} from "./CompositionHistory";
import type { PreviewLayout } from "@/engines/LayoutTransactionEngine/PreviewLayout";

export type CompositionSessionBeginInput = {
  pageId: string;
  operation: CompositionOperationType;
  beforePageSnapshot: CompositionGeometrySnapshot;
  nowMs?: number;
};

export type CompositionSessionPreviewInput = {
  preview: PreviewLayout;
  kernelTimeMs?: number;
  compositionTimeMs?: number;
  copyfitTimeMs?: number;
  typographyTimeMs?: number;
  iterationCount?: number;
  nowMs?: number;
  force?: boolean;
};

export type CompositionSessionCommitInput = {
  afterPageSnapshot: CompositionGeometrySnapshot;
  commitTimeMs?: number;
  transaction?: Omit<
    Parameters<typeof createCompositionTransaction>[0],
    "id" | "sessionId" | "pageId" | "operation" | "beforeGeometry" | "afterGeometry" | "executionTimeMs"
  >;
  nowMs?: number;
};

export type CompositionSessionEndResult = {
  session: CompositionSession | null;
  transaction: CompositionTransaction | null;
  committed: boolean;
  rolledBack: boolean;
};

export type CompositionSessionManagerOptions = {
  minFrameIntervalMs?: number;
  maxHistoryEntries?: number;
  idPrefix?: string;
};

const DEFAULT_MIN_FRAME_INTERVAL_MS = 1000 / 60;

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

let managerSequence = 0;

const getSessionId = (prefix: string) => {
  managerSequence += 1;

  return [prefix, "session", managerSequence].join(":");
};

const getTransactionId = (session: CompositionSession) =>
  ["composition-tx", session.pageId, session.id].join(":");

/**
 * Manages one active composition session plus immutable transaction history.
 *
 * The manager owns lifecycle guarantees: preview throttling, nested preview
 * updates, cancellation, rollback, and exactly one commit per session.
 */
export class CompositionSessionManager {
  private readonly minFrameIntervalMs: number;

  private readonly idPrefix: string;

  private activeSession: CompositionSession | null = null;

  private lastPreviewAt = Number.NEGATIVE_INFINITY;

  private historyState: CompositionHistoryState;

  constructor(options: CompositionSessionManagerOptions = {}) {
    this.minFrameIntervalMs = options.minFrameIntervalMs ?? DEFAULT_MIN_FRAME_INTERVAL_MS;
    this.idPrefix = options.idPrefix ?? "composition";
    this.historyState = createCompositionHistory(options.maxHistoryEntries);
  }

  /** Starts a new session, replacing no active committed state. */
  begin(input: CompositionSessionBeginInput): CompositionSession {
    const startedAt = input.nowMs ?? now();
    const session = createCompositionSession({
      id: getSessionId(this.idPrefix),
      pageId: input.pageId,
      operation: input.operation,
      startedAt,
      beforePageSnapshot: input.beforePageSnapshot,
    });

    this.activeSession = session;
    this.lastPreviewAt = Number.NEGATIVE_INFINITY;

    return session;
  }

  /** Records a preview update when the frame budget allows it. */
  preview(input: CompositionSessionPreviewInput): CompositionSession | null {
    const session = this.activeSession;
    const timestamp = input.nowMs ?? now();

    if (!session || session.status !== "active") {
      return null;
    }

    if (!input.force && timestamp - this.lastPreviewAt < this.minFrameIntervalMs) {
      return null;
    }

    const previewCount = session.previewCount + 1;
    const elapsedMs = Math.max(0, timestamp - session.startedAt);
    const nextSession: CompositionSession = {
      ...session,
      previewCount,
      iterationCount: session.iterationCount + (input.iterationCount ?? 1),
      latestPreview: input.preview,
      metrics: mergeCompositionMetrics(session.metrics, {
        previewCount,
        previewFps: calculatePreviewFps({ previewCount, elapsedMs }),
        kernelTimeMs: session.metrics.kernelTimeMs + (input.kernelTimeMs ?? input.preview.metrics.totalTimeMs ?? 0),
        compositionTimeMs: session.metrics.compositionTimeMs + (input.compositionTimeMs ?? 0),
        copyfitTimeMs: session.metrics.copyfitTimeMs + (input.copyfitTimeMs ?? 0),
        typographyTimeMs: session.metrics.typographyTimeMs + (input.typographyTimeMs ?? 0),
        iterationCount: session.iterationCount + (input.iterationCount ?? 1),
        affectedStories: input.preview.solution.affectedFrames.length,
      }),
    };

    this.activeSession = nextSession;
    this.lastPreviewAt = timestamp;

    return nextSession;
  }

  /** Cancels the active session without creating history. */
  cancel(nowMs = now()): CompositionSessionEndResult {
    const session = this.activeSession;

    if (!session) {
      return {
        session: null,
        transaction: null,
        committed: false,
        rolledBack: false,
      };
    }

    const ended: CompositionSession = {
      ...session,
      status: "canceled",
      endedAt: nowMs,
      metrics: mergeCompositionMetrics(session.metrics, {
        totalSessionTimeMs: Math.max(0, nowMs - session.startedAt),
      }),
    };

    this.activeSession = null;

    return {
      session: ended,
      transaction: null,
      committed: false,
      rolledBack: false,
    };
  }

  /** Rolls back the active session without creating history. */
  rollback(nowMs = now()): CompositionSessionEndResult {
    const session = this.activeSession;

    if (!session) {
      return {
        session: null,
        transaction: null,
        committed: false,
        rolledBack: false,
      };
    }

    const ended: CompositionSession = {
      ...session,
      status: "rolled-back",
      endedAt: nowMs,
      afterPageSnapshot: session.beforePageSnapshot,
      metrics: mergeCompositionMetrics(session.metrics, {
        totalSessionTimeMs: Math.max(0, nowMs - session.startedAt),
      }),
    };

    this.activeSession = null;

    return {
      session: ended,
      transaction: null,
      committed: false,
      rolledBack: true,
    };
  }

  /** Commits the active session exactly once and records a transaction. */
  commit(input: CompositionSessionCommitInput): CompositionSessionEndResult {
    const session = this.activeSession;
    const endedAt = input.nowMs ?? now();

    if (!session || session.status !== "active" || session.committed) {
      return {
        session,
        transaction: session?.transaction ?? null,
        committed: false,
        rolledBack: false,
      };
    }

    const executionTimeMs = Math.max(0, endedAt - session.startedAt);
    const transaction = createCompositionTransaction({
      id: getTransactionId(session),
      sessionId: session.id,
      pageId: session.pageId,
      operation: session.operation,
      beforeGeometry: session.beforePageSnapshot,
      afterGeometry: input.afterPageSnapshot,
      executionTimeMs,
      ...input.transaction,
    });
    const ended: CompositionSession = {
      ...session,
      status: "committed",
      endedAt,
      afterPageSnapshot: transaction.afterGeometry,
      transaction,
      committed: true,
      metrics: mergeCompositionMetrics(session.metrics, {
        commitTimeMs: input.commitTimeMs ?? 0,
        totalSessionTimeMs: executionTimeMs,
        affectedStories: transaction.affectedStories.length,
      }),
    };

    this.historyState = pushCompositionTransaction(this.historyState, transaction);
    this.activeSession = null;

    return {
      session: ended,
      transaction,
      committed: true,
      rolledBack: false,
    };
  }

  /** Returns the active session, if any. */
  getActiveSession() {
    return this.activeSession;
  }

  /** Returns immutable history state. */
  getHistory() {
    return {
      ...this.historyState,
      transactions: [...this.historyState.transactions],
    };
  }

  /** Moves history backward and returns the transaction to undo. */
  undo() {
    const result = undoCompositionTransaction(this.historyState);
    this.historyState = result.history;

    return result.transaction;
  }

  /** Moves history forward and returns the transaction to redo. */
  redo() {
    const result = redoCompositionTransaction(this.historyState);
    this.historyState = result.history;

    return result.transaction;
  }
}

/** Creates a CompositionSessionManager instance. */
export const createCompositionSessionManager = (options?: CompositionSessionManagerOptions) =>
  new CompositionSessionManager(options);
