# CompositionOrchestrator

`CompositionOrchestrator` is the root coordinator for the newspaper composition pipeline.

It integrates existing engines without replacing their internals:

1. Receive changed stories.
2. Run typography and copyfit through `composeStoriesIncrementally()`.
3. Detect overflow, underflow, collisions, and illegal whitespace.
4. Request `LayoutTransactionEngine` only when composition cannot stabilize in the current geometry.
5. Receive `LayoutSolution`.
6. Run connected cluster balancing through `RegionFlowSolver`.
7. Merge `BalancedCluster.after` into `LayoutSolution.after` through `RegionFlowBridge`.
8. Apply proposed geometry to story copies.
9. Recompose affected layouts through the next iteration.
10. Stop at stability, no layout solution, or the max iteration cap.

The orchestrator does not import React, Zustand, Konva, DOM APIs, or PDF code. It does not mutate editor state or normalized document data.

## Stable Conditions

The loop stops as stable when all are true:

- no story composition overflow
- no configured underflow
- no frame collisions
- illegal whitespace area is below the configured threshold

## Layout Requests

When overflow remains, the orchestrator asks `LayoutKernelAdapter` for a layout solution using the overflowing story as the source. The raw layout kernel remains a child engine; it is no longer the root pipeline owner.

Before applying geometry, the orchestrator builds the connected layout cluster for the source frame, runs `RegionFlowSolver`, and uses `RegionFlowBridge` so RegionFlow geometry is present in `LayoutSolution.after`.

`LayoutSolution` geometry is applied only to local story copies. A future production integration can commit the returned stories/document through the existing editor store path.
