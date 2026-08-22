import assert from "node:assert/strict";
import { createPerformanceProfiler } from "./PerformanceProfilerEngine";

const profiler = createPerformanceProfiler();

const result = profiler.timeOperation("story-compose", () => 42, { storyId: "story-1" });

assert.equal(result, 42);

profiler.recordOperation("headline-compose", 2.5);
profiler.recordOperation("paragraph-compose", 3.5);
profiler.recordOperation("cache-lookup", 0.1);
profiler.recordFrame(16);
profiler.recordFrame(20);
profiler.updateCacheAudit({
  cacheSize: 4,
  hitPercent: 75,
  missPercent: 25,
  evictions: 1,
});

const snapshot = profiler.getSnapshot();

assert.ok(snapshot.samples.length >= 4);
assert.ok(snapshot.hotPathOperations.some((operation) => operation.name === "headline-compose"));
assert.ok(snapshot.hotPathOperations.every((operation) => operation.durationMs >= 2));
assert.equal(snapshot.cacheAudit.cacheSize, 4);
assert.equal(snapshot.cacheAudit.hitPercent, 75);
assert.equal(snapshot.cacheAudit.mostRecomposedStoryId, "story-1");
assert.equal(snapshot.worstFrameTimeMs, 20);
assert.ok(snapshot.averageFps > 0);
assert.ok(snapshot.timeline.some((event) => event.stage === "story-compose"));

console.log("Performance profiler tests passed: 9");

