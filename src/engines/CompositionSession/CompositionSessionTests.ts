import { strict as assert } from "node:assert";
import {
  createCompositionHistory,
  jumpToCompositionRevision,
  pushCompositionTransaction,
} from "./CompositionHistory";
import { createCompositionSessionManager } from "./CompositionSessionManager";
import { createCompositionTransaction } from "./CompositionTransaction";
import type { PreviewLayout } from "@/engines/LayoutTransactionEngine/PreviewLayout";

const before = {
  story1: { x: 20, y: 20, width: 180, height: 120 },
};
const after = {
  story1: { x: 20, y: 20, width: 220, height: 120 },
};

const preview = (sequence: number): PreviewLayout => ({
  id: `preview-${sequence}`,
  sequence,
  sourceFrameId: "story1",
  resizeDirection: "right",
  requiredSpace: 40,
  status: "ready",
  frames: [{
    frameId: "story1",
    role: "source",
    before: before.story1,
    after: after.story1,
    changed: true,
  }],
  warnings: [],
  constraintViolations: [],
  solution: {
    id: "solution-1",
    pageId: "page-1",
    valid: true,
    before,
    after,
    geometryChanges: [],
    affectedFrames: ["story1"],
    dirtyFrames: ["story1"],
    metrics: {
      changedFrameCount: 1,
      affectedFrameCount: 1,
      dirtyFrameCount: 1,
      collisionCount: 0,
      unresolvedCollisionCount: 0,
      warningCount: 0,
      totalChangedArea: 4800,
    },
    warnings: [],
    errors: [],
  },
  metrics: {
    snapshotTimeMs: 1,
    constraintTimeMs: 1,
    neighborTimeMs: 1,
    spaceTimeMs: 1,
    patchTimeMs: 1,
    solveTimeMs: 1,
    diffTimeMs: 1,
    totalTimeMs: 7,
  },
});

const assertResizeSessionCommitOnce = () => {
  const manager = createCompositionSessionManager({ minFrameIntervalMs: 16, idPrefix: "test" });

  manager.begin({
    pageId: "page-1",
    operation: "resize-story",
    beforePageSnapshot: before,
    nowMs: 0,
  });
  assert(manager.preview({ preview: preview(1), nowMs: 20 }));
  const first = manager.commit({
    afterPageSnapshot: after,
    nowMs: 60,
    transaction: {
      layoutSolution: preview(1).solution,
    },
  });
  const second = manager.commit({
    afterPageSnapshot: after,
    nowMs: 80,
  });

  assert.equal(first.committed, true);
  assert.equal(first.transaction?.affectedStories[0], "story1");
  assert.equal(second.committed, false);
  assert.equal(manager.getHistory().transactions.length, 1);
};

const assertCancelSessionCreatesNoHistory = () => {
  const manager = createCompositionSessionManager({ idPrefix: "cancel" });

  manager.begin({
    pageId: "page-1",
    operation: "resize-story",
    beforePageSnapshot: before,
    nowMs: 0,
  });
  manager.preview({ preview: preview(1), nowMs: 20, force: true });
  const result = manager.cancel(40);

  assert.equal(result.committed, false);
  assert.equal(result.session?.status, "canceled");
  assert.equal(manager.getHistory().transactions.length, 0);
};

const assertUndoRedoHistory = () => {
  const tx = createCompositionTransaction({
    id: "tx-1",
    sessionId: "session-1",
    pageId: "page-1",
    operation: "resize-story",
    beforeGeometry: before,
    afterGeometry: after,
    executionTimeMs: 12,
  });
  let history = pushCompositionTransaction(createCompositionHistory(4), tx);
  const jumped = jumpToCompositionRevision(history, 0);
  const manager = createCompositionSessionManager({ idPrefix: "history" });

  assert.equal(jumped.cursor, 0);
  manager.begin({ pageId: "page-1", operation: "resize-story", beforePageSnapshot: before });
  manager.preview({ preview: preview(1), force: true });
  manager.commit({ afterPageSnapshot: after });
  const undone = manager.undo();
  const redone = manager.redo();

  assert.equal(undone?.id.startsWith("composition-tx"), true);
  assert.equal(redone?.id, undone?.id);
  history = jumpToCompositionRevision(history, -1);
  assert.equal(history.cursor, -1);
};

const assertPerformanceAndNestedPreviewUpdates = () => {
  const manager = createCompositionSessionManager({ minFrameIntervalMs: 16, idPrefix: "metrics" });

  manager.begin({
    pageId: "page-1",
    operation: "resize-story",
    beforePageSnapshot: before,
    nowMs: 0,
  });
  assert(manager.preview({ preview: preview(1), nowMs: 10, force: true }));
  assert.equal(manager.preview({ preview: preview(2), nowMs: 14 }), null);
  const nested = manager.preview({ preview: preview(2), nowMs: 20, force: true, iterationCount: 2 });

  assert(nested);
  assert.equal(nested.previewCount, 2);
  assert.equal(nested.iterationCount, 3);
  assert(nested.metrics.kernelTimeMs >= 14);
  assert(nested.metrics.previewFps > 0);
};

const assertRollbackSession = () => {
  const manager = createCompositionSessionManager({ idPrefix: "rollback" });

  manager.begin({
    pageId: "page-1",
    operation: "resize-story",
    beforePageSnapshot: before,
    nowMs: 0,
  });
  const result = manager.rollback(25);

  assert.equal(result.rolledBack, true);
  assert.equal(result.session?.status, "rolled-back");
  assert.deepEqual(result.session?.afterPageSnapshot, before);
};

assertResizeSessionCommitOnce();
assertCancelSessionCreatesNoHistory();
assertUndoRedoHistory();
assertPerformanceAndNestedPreviewUpdates();
assertRollbackSession();

console.log("CompositionSession tests passed: 5");
