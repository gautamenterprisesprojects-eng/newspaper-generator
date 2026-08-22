export type ColumnGridInput = {
  pageWidth: number;
  columnCount: number;
  gutter: number;
  contentX?: number;
  contentWidth?: number;
};

export type PageColumn = {
  index: number;
  x: number;
  width: number;
};

export const createColumnGrid = ({
  pageWidth,
  columnCount,
  gutter,
  contentX = 0,
  contentWidth = pageWidth,
}: ColumnGridInput): PageColumn[] => {
  const safeColumnCount = Math.max(1, Math.floor(columnCount));
  const safeGutter = Math.max(0, gutter);
  const totalGutterWidth = safeGutter * Math.max(0, safeColumnCount - 1);
  const columnWidth = Math.max(0, (contentWidth - totalGutterWidth) / safeColumnCount);

  return Array.from({ length: safeColumnCount }).map((_, index) => ({
    index,
    x: contentX + index * (columnWidth + safeGutter),
    width: columnWidth,
  }));
};

export const ColumnGridEngine = {
  createColumnGrid,
};
