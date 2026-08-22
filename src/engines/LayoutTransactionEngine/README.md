# LayoutTransactionEngine

`LayoutTransactionEngine` is the deterministic geometry kernel for future Smart Auto Resize work.

It is intentionally pure TypeScript and has no React, Zustand, Konva, PDF, or browser dependencies.

## Current Responsibilities

- Analyze page geometry into a `LayoutSnapshot`.
- Build a directional neighbor graph.
- Build a column-scoped whitespace map.
- Build column and row bands.
- Define immutable transaction models.
- Validate transaction patches against hard geometry constraints.
- Resolve legal operation capabilities with `ConstraintSolver`.
- Convert drag geometry into resize intent and temporary borrowing with `BorrowSpaceSolver`.
- Select redistribution candidates with `NeighborSolver`.
- Allocate required resize space with `SpaceSolver`.
- Build immutable geometry patch intents with `GeometryPatchBuilder`.
- Orchestrate proposed layout solving with `SmartLayoutSolver`.
- Run editor resize requests in shadow mode with `LayoutKernelAdapter`.
- Build connected page regions with `LayoutClusterBuilder`.
- Balance connected regions with `RegionFlowSolver`.

## Editor Integration Point

The first editor integration should happen inside `editorStore.resizeStory()`:

1. Convert active page `StoryFrame[]` plus document advertisement/frame metadata into `LayoutFrameSnapshot[]`.
2. Call `analyzeLayoutSnapshot()`.
3. Build a resize transaction from the source frame and future Smart Auto Resize solver output.
4. Call `validateLayoutTransaction()`.
5. If valid, apply all patches to the affected `StoryFrame[]`.
6. Mark changed frames with `geometryDirty`, `compositionDirty`, and `renderDirty`.
7. Call the existing `withSyncedDocument()` path.

Typography, Region, PDF, React, and Konva should continue to receive geometry changes through existing project paths.

## Resize Intent And Borrowing

Newspaper resize gestures are layout intent, not final absolute geometry.

`LayoutKernelAdapter.runLayoutKernelShadowResize(request)` converts the editor drag rectangle into a `ResizeIntent`:

- source frame
- resize direction
- additional required space
- optional raw requested rectangle for diagnostics

`BorrowSpaceSolver.solveBorrowSpace({ snapshot, intent })` then runs before final constraint validation. It inspects the snapshot neighbor graph and whitespace map, ranks candidates deterministically, allocates available capacity, and returns a `TemporaryAllocation`:

- `neighborSolution`
- `spaceSolution`
- `proposedFrames`
- warnings and deterministic reasons

The raw drag rectangle is therefore not treated as final layout geometry. If a user drags a frame beyond content bounds but a right-side neighbor can shrink enough to keep all final rectangles inside the page, the proposed temporary layout can still validate.

Unresolved requested space is preserved as `remainingSpace`; the engine does not invent extra capacity.

## Constraint Solver

`ConstraintSolver.solveConstraints(snapshot, request)` evaluates whether a frame operation is legally allowed. It never mutates geometry and never produces patches. It returns:

- `allowed`
- grow, shrink, and move limits
- hard blockers
- soft warnings
- deterministic reasons
- resolved source, neighbor, and whitespace priorities

Rules are evaluated in this exact order:

1. Locked frames
2. Advertisements
3. Pinned frames
4. Page margins
5. Column grid
6. Minimum size
7. Maximum size
8. Editorial priority
9. Preferred size
10. Whitespace

For intent-based resize, callers should pass `request.proposedFrames` from `BorrowSpaceSolver`. Page bounds, minimum size, maximum size, and preferred size rules then validate the proposed balanced layout instead of the raw pointer-drag rectangle. Existing absolute geometry callers can continue to omit `proposedFrames`; in that mode the solver validates `frame + delta` as before.

## Neighbor Solver

`NeighborSolver.solveNeighbors({ snapshot, constraint, resizeRequest })` decides which neighboring frames and whitespace cells are legal candidates for redistribution. It never moves frames and never mutates geometry.

Pipeline:

1. Load the snapshot neighbor graph.
2. Apply the already-resolved `ConstraintResult`.
3. Remove hard-blocked candidates: advertisements, locked frames, pinned frames, zero-capacity frames, invalid columns, and invalid page geometry.
4. Score frame and whitespace candidates.
5. Sort deterministically.
6. Return a `NeighborSolution` with candidate capacities and unresolved space.

Soft ranking order prefers whitespace first, then filler, brief, secondary, major, and lead stories. Ties are resolved by closest distance, highest capacity, best alignment, reading order, and frame id.

## Space Solver

`SpaceSolver.solveSpace({ snapshot, constraint, neighborSolution, resizeRequest })` converts ranked neighbor candidates into deterministic space allocations. It does not mutate geometry and does not invent a layout when there is not enough available capacity.

Allocation order follows the existing NeighborSolver candidate order and preserves it exactly:

1. Whitespace
2. Reserved gap
3. Filler story
4. Brief story
5. Secondary story
6. Major story
7. Lead story

The solver guarantees:

- no allocation exceeds candidate capacity
- no allocation exceeds `ConstraintSolver` limits
- no negative allocation
- no geometry mutation
- unresolved space is reported as `remainingSpace`

Future layout solving should consume `SpaceSolution.allocations` as intent only. Actual frame movement/resizing belongs in a later geometry solver and should still be validated through the transaction validation layer.

## Geometry Patch Builder

`GeometryPatchBuilder.buildGeometryPatches({ snapshot, constraint, neighborSolution, spaceSolution })` converts allocation intent into immutable geometry patch operations.

It produces patch descriptors such as:

- `expand`
- `shrink`
- `move`
- `translate`
- `reserve`
- `release`

Each patch contains:

- `frameId`
- `operation`
- `direction`
- `amount`
- `priority`
- `reason`
- `dependencies`

The builder does not calculate final rectangles, validate overlaps, execute patches, update stories, or commit layout. It is an intent bridge between SpaceSolver and a future geometry execution layer.

## Smart Layout Solver

`SmartLayoutSolver.solveSmartLayout({ snapshot, patches })` converts immutable geometry patch intents into a validated `LayoutSolution`.

Pipeline:

1. `GeometryResolver`: converts patch operations into proposed rectangles.
2. `CollisionResolver`: attempts deterministic repair using push/compress style moves.
3. `GridSnapResolver`: snaps geometry to margins, columns, gutters, and baseline grid.
4. `ConstraintValidator`: checks immutable objects, page bounds, sizes, and overlaps.
5. `LayoutMetrics`: computes changed frame and collision metrics.
6. `TransactionBuilder`: returns immutable `LayoutSolution`.

The solver still does not integrate with editor state. It does not call React, Zustand, Konva, PDF export, or DOM APIs. Its output is a proposal that a later editor integration can either reject, display as preview, or convert into existing `LayoutTransaction`/store updates after final validation.

## Layout Cluster Engine

`LayoutClusterBuilder.buildLayoutCluster({ snapshot, sourceFrameId })` converts a changed frame into a connected `LayoutCluster`.

Traversal uses deterministic BFS over the snapshot `NeighborGraph`. Expansion stops at:

- advertisement frames
- locked frames
- hidden frames
- frames outside page bounds
- isolated layout regions beyond the configured gap threshold

The returned cluster contains:

- source frame id
- connected frame ids
- cloned frame snapshots
- cluster bounds
- cluster-local whitespace
- boundary stop reasons

This lets future layout operations solve page regions instead of treating each neighbor as an isolated resize candidate.

## Region Flow Solver

`RegionFlowSolver.solveRegionFlow({ cluster, contentBounds, columns, proposedRects })` balances a connected cluster without mutating editor state.

Pipeline:

1. `ColumnBalancer`: restores deterministic column alignment.
2. `VerticalCascade`: pushes or pulls vertically connected stories so no floating gaps remain between overlapping story columns.
3. `WhitespaceEliminator`: repeatedly finds vertical whitespace, expands the nearest story above it, and stops when stable or at the iteration cap.
4. `VerticalCascade`: runs again to stabilize final y positions.
5. `ClusterMetrics`: reports before/after whitespace, changed frame count, and iteration count.

The balanced cluster returns `before`, `after`, `changedFrameIds`, unresolved whitespace cells, warnings, and metrics. Typography recomposition is intentionally not performed here; downstream composition engines should recompose only frames in `changedFrameIds`.

## Region Flow Bridge

`RegionFlowBridge.mergeRegionFlowIntoLayoutSolution({ solution, balancedCluster })` is the production handoff between regional balancing and commit.

It merges `BalancedCluster.after` into `LayoutSolution.after` for only the frames listed in `BalancedCluster.changedFrameIds`. Unchanged frame geometry is preserved.

The bridge intentionally preserves the original layout solution metadata:

- solution id
- page id
- validity
- metrics
- warnings
- errors

After this merge, existing `LayoutCommitEngine.commitLayoutSolution()` can receive RegionFlow geometry without modification because it already commits from `LayoutSolution.after`.

## Layout Kernel Adapter

`LayoutKernelAdapter.runLayoutKernelShadowResize(request)` is the pure adapter intended to sit in front of the existing editor resize pipeline.

Shadow-mode responsibilities:

1. Convert an editor resize request into LayoutTransactionEngine inputs.
2. Build a fresh `LayoutSnapshot`.
3. Convert raw drag geometry into `ResizeIntent`.
4. Run `BorrowSpaceSolver` to build temporary allocations and proposed geometry.
5. Run `ConstraintSolver` against the proposed geometry.
6. Run `GeometryPatchBuilder` and `SmartLayoutSolver` for validated proposed allocations.
7. Compare old layout versus proposed layout.
8. Return a `LayoutDiff` report.
9. Do not commit results.

The diff includes:

- geometry differences
- whitespace differences
- collision differences
- constraint violations
- warnings
- performance metrics

Later `editorStore.resizeStory()` integration should call the adapter first in shadow mode, log or display diagnostics, and continue using the existing resize path until the kernel is promoted from shadow mode to commit mode.
