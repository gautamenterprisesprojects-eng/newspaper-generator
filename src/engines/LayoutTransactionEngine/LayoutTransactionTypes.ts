import type { ArticleBoxModel, StoryFrameId, StoryPriority } from "@/types/editor";
import type { NewspaperFrameId, NewspaperPageId } from "@/types/document";

export type LayoutRect = ArticleBoxModel;

export type LayoutFrameKind = "story" | "advertisement" | "master" | "asset" | "unknown";

export type LayoutFrameSnapshot = LayoutRect & {
  id: NewspaperFrameId | StoryFrameId;
  pageId: NewspaperPageId;
  storyId?: StoryFrameId;
  kind: LayoutFrameKind;
  locked: boolean;
  hidden: boolean;
  pinned: boolean;
  columnStart?: number;
  columnSpan?: number;
  priority?: StoryPriority;
  zIndex: number;
};

export type LayoutColumn = LayoutRect & {
  index: number;
};

export type LayoutBand = LayoutRect & {
  id: string;
  frameIds: string[];
};

export type LayoutWhitespaceCell = LayoutRect & {
  id: string;
  rowBandId?: string;
  columnIndex?: number;
  boundedBy: string[];
  area: number;
};

export type LayoutNeighborDirection = "left" | "right" | "top" | "bottom";

export type LayoutNeighborEdge = {
  from: string;
  to: string;
  direction: LayoutNeighborDirection;
  gap: number;
  sharedSpan: number;
  overlapRatio: number;
  strength: number;
};

export type LayoutNeighborNode = {
  frameId: string;
  left: LayoutNeighborEdge[];
  right: LayoutNeighborEdge[];
  top: LayoutNeighborEdge[];
  bottom: LayoutNeighborEdge[];
};

export type LayoutNeighborGraph = {
  nodes: Record<string, LayoutNeighborNode>;
  edges: LayoutNeighborEdge[];
};

export type LayoutSnapshotInput = {
  pageId: NewspaperPageId;
  pageBounds: LayoutRect;
  contentBounds: LayoutRect;
  columns: LayoutColumn[];
  frames: LayoutFrameSnapshot[];
  gapTolerance?: number;
};

export type LayoutSnapshot = LayoutSnapshotInput & {
  framesById: Record<string, LayoutFrameSnapshot>;
  visibleFrames: LayoutFrameSnapshot[];
  neighborGraph: LayoutNeighborGraph;
  whitespaceMap: LayoutWhitespaceCell[];
  columnBands: LayoutBand[];
  rowBands: LayoutBand[];
  version: string;
};

export type LayoutGeometryPatch = {
  frameId: string;
  before: LayoutRect;
  after: LayoutRect;
  reason: "source-resize" | "source-move" | "auto-resize" | "auto-move" | "validation-clamp";
};

export type LayoutTransaction = {
  id: string;
  pageId: NewspaperPageId;
  sourceFrameId: string;
  kind: "resize" | "move" | "batch";
  patches: LayoutGeometryPatch[];
  affectedFrameIds: string[];
  createdAtVersion: string;
};

export type LayoutValidationIssue = {
  code:
    | "missing-frame"
    | "negative-size"
    | "page-bounds"
    | "content-bounds"
    | "overlap"
    | "locked-frame-mutated"
    | "advertisement-mutated"
    | "invalid-column-span"
    | "empty-transaction";
  severity: "error" | "warning";
  frameId?: string;
  message: string;
};

export type LayoutValidationResult = {
  valid: boolean;
  issues: LayoutValidationIssue[];
};

export type ConstraintOperation =
  | "resize"
  | "move"
  | "delete"
  | "insert"
  | "merge"
  | "split"
  | "automatic-placement";

export type ConstraintDelta = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type ConstraintRuleCode =
  | "locked-frame"
  | "advertisement"
  | "pinned-frame"
  | "page-margins"
  | "column-grid"
  | "minimum-size"
  | "maximum-size"
  | "editorial-priority"
  | "preferred-size"
  | "whitespace";

export type ConstraintBlocker = {
  rule: ConstraintRuleCode;
  frameId?: string;
  message: string;
};

export type ConstraintWarning = {
  rule: ConstraintRuleCode;
  frameId?: string;
  message: string;
};

export type ConstraintLimits = {
  grow: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  shrink: {
    width: number;
    height: number;
  };
  move: {
    left: number;
    right: number;
    up: number;
    down: number;
  };
};

export type ConstraintResolvedPriority = {
  frameId: string;
  priority: number;
  editorialPriority?: StoryPriority;
  role: "source" | "neighbor" | "whitespace";
  reason: string;
};

export type ConstraintRequest = {
  frameId: string;
  operation: ConstraintOperation;
  delta?: ConstraintDelta;
  proposedFrames?: Record<string, LayoutRect>;
  minSize?: Partial<Pick<LayoutRect, "width" | "height">>;
  maxSize?: Partial<Pick<LayoutRect, "width" | "height">>;
  preferredSize?: Partial<Pick<LayoutRect, "width" | "height">>;
};

export type ConstraintResult = {
  frameId: string;
  operation: ConstraintOperation;
  allowed: boolean;
  requestedDelta: ConstraintDelta;
  limits: ConstraintLimits;
  blockedBy: ConstraintBlocker[];
  warnings: ConstraintWarning[];
  reasons: string[];
  resolvedPriorities: ConstraintResolvedPriority[];
};

export type NeighborResizeDirection = "left" | "right" | "top" | "bottom" | "horizontal" | "vertical";

export type NeighborResizeRequest = {
  sourceFrameId: string;
  direction: NeighborResizeDirection;
  requiredSpace: number;
};

export type ResizeIntent = NeighborResizeRequest & {
  requestedRect?: LayoutRect;
};

export type TemporaryAllocation = {
  intent: ResizeIntent;
  neighborSolution: NeighborSolution;
  spaceSolution: SpaceSolution;
  proposedFrames: Record<string, LayoutRect>;
  warnings: string[];
  reasons: string[];
};

export type NeighborCandidateKind = "whitespace" | LayoutFrameKind;

export type NeighborCandidate = {
  id: string;
  kind: NeighborCandidateKind;
  frameId?: string;
  capacity: number;
  distance: number;
  alignmentScore: number;
  editorialPriority?: StoryPriority;
  priorityScore: number;
  readingOrder: number;
  reasons: string[];
};

export type NeighborSolution = {
  sourceFrameId: string;
  resizeDirection: NeighborResizeDirection;
  requiredSpace: number;
  candidates: NeighborCandidate[];
  remainingUnresolvedSpace: number;
  rejectedCandidateIds: string[];
  reasons: string[];
};

export type SpaceAllocationKind = "whitespace" | "reserved-gap" | "story";

export type SpaceAllocation = {
  candidateId: string;
  frameId?: string;
  kind: SpaceAllocationKind;
  requestedSpace: number;
  candidateCapacity: number;
  allocatedSpace: number;
  remainingCandidateCapacity: number;
  priorityScore: number;
  reason: string;
};

export type SpaceRejectedCandidate = {
  candidateId: string;
  reason: string;
};

export type SpaceSolution = {
  sourceFrameId: string;
  requiredSpace: number;
  resolvedSpace: number;
  remainingSpace: number;
  allocations: SpaceAllocation[];
  rejectedCandidates: SpaceRejectedCandidate[];
  allocationReasons: string[];
  solverWarnings: string[];
};

export type LayoutSolutionGeometryChange = {
  frameId: string;
  before: LayoutRect;
  after: LayoutRect;
  changed: boolean;
  reasons: string[];
};

export type LayoutSolutionMetrics = {
  changedFrameCount: number;
  affectedFrameCount: number;
  dirtyFrameCount: number;
  collisionCount: number;
  unresolvedCollisionCount: number;
  warningCount: number;
  totalChangedArea: number;
};

export type LayoutSolution = {
  id: string;
  pageId: NewspaperPageId;
  valid: boolean;
  before: Record<string, LayoutRect>;
  after: Record<string, LayoutRect>;
  geometryChanges: LayoutSolutionGeometryChange[];
  affectedFrames: string[];
  dirtyFrames: string[];
  metrics: LayoutSolutionMetrics;
  warnings: string[];
  errors: string[];
};
