export type BodyFlowInput = {
  wrappedLines: string[];
  lineHeight: number;
  availableWidth: number;
  availableHeight: number;
  columnCount: number;
  columnGap: number;
};

export type BodyFlowLine = {
  text: string;
  sourceIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BodyFlowColumn = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: BodyFlowLine[];
  consumedHeight: number;
};

export type BodyFlowResult = {
  columns: BodyFlowColumn[];
  columnWidth: number;
  maxLinesPerColumn: number;
  visibleLines: string[];
  visibleLineCount: number;
  remainingLines: string[];
  remainingLineCount: number;
  consumedHeight: number;
  overflow: boolean;
};
