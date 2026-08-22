import type { CompositionSessionMetrics } from "./CompositionMetrics";
import { createEmptyCompositionMetrics } from "./CompositionMetrics";
import type {
  CompositionGeometrySnapshot,
  CompositionOperationType,
  CompositionTransaction,
} from "./CompositionTransaction";
import type { PreviewLayout } from "@/engines/LayoutTransactionEngine/PreviewLayout";

export type CompositionSessionStatus =
  | "active"
  | "committed"
  | "canceled"
  | "rolled-back";

export type CompositionSession = {
  id: string;
  pageId: string;
  operation: CompositionOperationType;
  status: CompositionSessionStatus;
  startedAt: number;
  endedAt: number | null;
  previewCount: number;
  iterationCount: number;
  metrics: CompositionSessionMetrics;
  beforePageSnapshot: CompositionGeometrySnapshot;
  afterPageSnapshot: CompositionGeometrySnapshot | null;
  latestPreview: PreviewLayout | null;
  transaction: CompositionTransaction | null;
  committed: boolean;
};

const cloneGeometry = (snapshot: CompositionGeometrySnapshot): CompositionGeometrySnapshot =>
  Object.fromEntries(
    Object.entries(snapshot).map(([id, rect]) => [
      id,
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    ]),
  );

/** Creates a new immutable composition session record. */
export const createCompositionSession = ({
  id,
  pageId,
  operation,
  startedAt,
  beforePageSnapshot,
}: {
  id: string;
  pageId: string;
  operation: CompositionOperationType;
  startedAt: number;
  beforePageSnapshot: CompositionGeometrySnapshot;
}): CompositionSession => ({
  id,
  pageId,
  operation,
  status: "active",
  startedAt,
  endedAt: null,
  previewCount: 0,
  iterationCount: 0,
  metrics: createEmptyCompositionMetrics(),
  beforePageSnapshot: cloneGeometry(beforePageSnapshot),
  afterPageSnapshot: null,
  latestPreview: null,
  transaction: null,
  committed: false,
});

/** Returns an immutable geometry snapshot from frame-like records. */
export const createGeometrySnapshot = <
  Frame extends { id: string; x: number; y: number; width: number; height: number },
>(
  frames: Frame[],
): CompositionGeometrySnapshot =>
  Object.fromEntries(
    frames.map((frame) => [
      frame.id,
      {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      },
    ]),
  );
