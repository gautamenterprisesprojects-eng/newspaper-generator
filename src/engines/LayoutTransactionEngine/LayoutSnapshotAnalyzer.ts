import { rectKey, sortRectsReadingOrder } from "./LayoutGeometry";
import { buildColumnBands, buildRowBands } from "./BandAnalyzer";
import { buildNeighborGraph } from "./NeighborGraphAnalyzer";
import { buildWhitespaceMap } from "./WhitespaceAnalyzer";
import type {
  LayoutFrameSnapshot,
  LayoutSnapshot,
  LayoutSnapshotInput,
} from "./LayoutTransactionTypes";

const getSnapshotVersion = (frames: LayoutFrameSnapshot[]) =>
  sortRectsReadingOrder(frames)
    .map((frame) => [
      frame.id,
      rectKey(frame),
      frame.locked ? "L" : "U",
      frame.hidden ? "H" : "V",
      frame.kind,
      frame.columnStart ?? "",
      frame.columnSpan ?? "",
    ].join("|"))
    .join(";");

/**
 * Analyzes page geometry into a deterministic layout snapshot.
 *
 * The snapshot is immutable-by-convention and contains all read models needed
 * by future resize transactions: frame lookup, neighbor graph, whitespace map,
 * and row/column bands.
 */
export const analyzeLayoutSnapshot = (input: LayoutSnapshotInput): LayoutSnapshot => {
  const frames = sortRectsReadingOrder(input.frames).map((frame) => ({ ...frame }));
  const visibleFrames = frames.filter((frame) => !frame.hidden);
  const framesById = Object.fromEntries(frames.map((frame) => [frame.id, frame]));
  const columnBands = buildColumnBands(input.columns, visibleFrames);
  const rowBands = buildRowBands(visibleFrames);

  return {
    ...input,
    frames,
    visibleFrames,
    framesById,
    neighborGraph: buildNeighborGraph(visibleFrames),
    whitespaceMap: buildWhitespaceMap({
      contentBounds: input.contentBounds,
      columns: input.columns,
      frames: visibleFrames,
    }),
    columnBands,
    rowBands,
    version: getSnapshotVersion(frames),
  };
};
