import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import { calculateRowGapDiagnostics, getEditorialRowGaps } from "@/engines/RowGap/RowGapEngine";
import { getStoryHierarchyStyle } from "@/engines/StoryHierarchy/StoryHierarchyEngine";
import { getTemplateDefinition } from "./TemplateRegistry";
import {
  type ArticleSizeClass,
  ARTICLE_SIZE_CLASS_CONFIG,
  getModuleFrameHeight,
} from "@/engines/EditorialLayoutQuality/EditorialSpaceOptimizer";
import type {
  PageLayoutDiagnostics,
  TemplateLayoutInput,
  TemplateLayoutResult,
  TemplateRowRhythm,
  TemplateStoryFrameSlot,
  TemplateStorySlotDefinition,
} from "./TemplateTypes";

const groupSlotsByRow = (slots: TemplateStorySlotDefinition[]) => {
  const rows = new Map<number, TemplateStorySlotDefinition[]>();

  for (const slot of slots) {
    const rowSlots = rows.get(slot.row) ?? [];
    rowSlots.push(slot);
    rows.set(slot.row, rowSlots);
  }

  return [...rows.entries()]
    .sort(([firstRow], [secondRow]) => firstRow - secondRow)
    .map(([row, rowSlots]) => ({
      row,
      slots: rowSlots.sort((first, second) => first.columnStart - second.columnStart),
    }));
};

const getRowMinimumHeight = (slots: TemplateStorySlotDefinition[]) =>
  Math.max(...slots.map((slot) => getStoryHierarchyStyle(slot.priority).minimumHeight));

const distributeRhythmRowHeights = (
  rows: { row: number; slots: TemplateStorySlotDefinition[] }[],
  contentHeight: number,
  rowRhythm: TemplateRowRhythm[],
) => {
  const rhythmsByRow = new Map(rowRhythm.map((rhythm) => [rhythm.row, rhythm]));
  const baseHeights = rows.map(({ row, slots }) => {
    const rhythm = rhythmsByRow.get(row);
    const rhythmicHeight = rhythm ? contentHeight * rhythm.baseRatio : 0;
    // A template that measured its own band depths overrides the priority floor.
    const minimumHeight = rhythm?.minimumHeight ?? getRowMinimumHeight(slots);

    return Math.max(rhythmicHeight, minimumHeight);
  });
  const totalBaseHeight = baseHeights.reduce((sum, height) => sum + height, 0);

  if (totalBaseHeight >= contentHeight) {
    const scale = contentHeight / totalBaseHeight;

    return baseHeights.map((height) => height * scale);
  }

  const expandableRows = rows
    .map(({ row }, index) => ({
      index,
      rhythm: rhythmsByRow.get(row),
    }))
    .filter(({ rhythm }) => rhythm?.receivesRemainingSpace);
  const expansionWeight = expandableRows.reduce(
    (sum, { rhythm }) => sum + (rhythm?.baseRatio ?? 0),
    0,
  );
  const remainingHeight = contentHeight - totalBaseHeight;
  const nextHeights = [...baseHeights];

  for (const { index, rhythm } of expandableRows) {
    nextHeights[index] +=
      expansionWeight > 0
        ? remainingHeight * ((rhythm?.baseRatio ?? 0) / expansionWeight)
        : remainingHeight / Math.max(1, expandableRows.length);
  }

  return nextHeights;
};

const distributeRowHeights = (
  rows: { row: number; slots: TemplateStorySlotDefinition[] }[],
  contentHeight: number,
  rowRhythm: TemplateRowRhythm[] = [],
) => {
  if (rowRhythm.length > 0) {
    return distributeRhythmRowHeights(rows, contentHeight, rowRhythm);
  }

  const minimumHeights = rows.map(({ slots }) => getRowMinimumHeight(slots));
  const totalMinimumHeight = minimumHeights.reduce((sum, height) => sum + height, 0);

  if (totalMinimumHeight <= 0) {
    return rows.map(() => contentHeight / Math.max(1, rows.length));
  }

  if (totalMinimumHeight >= contentHeight) {
    const scale = contentHeight / totalMinimumHeight;

    return minimumHeights.map((height) => height * scale);
  }

  const remainingHeight = contentHeight - totalMinimumHeight;

  return minimumHeights.map(
    (height) => height + remainingHeight * (height / totalMinimumHeight),
  );
};

const getSlotWidth = (
  columns: ReturnType<typeof createColumnGrid>,
  columnStart: number,
  columnSpan: number,
) => {
  const firstColumn = columns[columnStart - 1];
  const lastColumn = columns[columnStart + columnSpan - 2];

  if (!firstColumn || !lastColumn) {
    throw new Error(`Invalid template column range ${columnStart}/${columnSpan}`);
  }

  return {
    x: firstColumn.x,
    width: lastColumn.x + lastColumn.width - firstColumn.x,
  };
};

const applySlotBottomTrim = (height: number, slot: TemplateStorySlotDefinition) =>
  Math.max(
    1,
    height -
      Math.max(0, slot.bottomTrimPt ?? 0) -
      Math.max(0, Math.min(0.95, slot.bottomTrimFraction ?? 0)) * height,
  );

const applySlotVerticalAdjust = (
  y: number,
  height: number,
  slot: TemplateStorySlotDefinition,
) => {
  const trimmedHeight = applySlotBottomTrim(height, slot);
  const topExtend =
    Math.max(0, slot.topExtendPt ?? 0) +
    Math.max(0, Math.min(2, slot.topExtendFraction ?? 0)) * height;

  return {
    y: y - topExtend,
    height: trimmedHeight + topExtend,
  };
};

export const generateTemplateLayout = (input: TemplateLayoutInput): TemplateLayoutResult => {
  const template = getTemplateDefinition(input.templateId);

  if (!template) {
    throw new Error(`Unknown template ${input.templateId}`);
  }

  const columns = createColumnGrid({
    pageWidth: input.pageWidth,
    contentX: input.contentX,
    contentWidth: input.contentWidth,
    columnCount: input.columnCount,
    gutter: input.gutter,
  });
  // Nested sidebars are positioned from their parent's finished rectangle, so
  // they are held out of the row pass entirely — row heights, gaps and minimum
  // heights stay driven by the peer slots alone.
  const peerSlots = template.slots.filter((slot) => !slot.insetInto);
  const insetSlots = template.slots.filter((slot) => slot.insetInto);
  const rows = groupSlotsByRow(peerSlots);
  const rowGapInputs = rows.map((row) => ({
    priorities: row.slots.map((slot) => slot.priority),
  }));
  const rowGaps = getEditorialRowGaps({
    rows: rowGapInputs,
    pageUtilizationPercent: 100,
    // No gutter override: let the row-gap engine pick priority-aware spacing
    // (its dense targets, since utilization is 100). Passing the column gutter
    // forced every row to the same 8.64pt, which read as too much air between
    // stacked stories once each box also had its own top/bottom padding.
  });
  const totalRowGap = rowGaps.reduce((sum, gap) => sum + gap, 0);
  const rowHeights = distributeRowHeights(
    rows,
    Math.max(1, input.contentHeight - totalRowGap),
    template.rowRhythm,
  );
  const slots: TemplateStoryFrameSlot[] = [];
  let currentY = input.contentY;

  rows.forEach((row, rowIndex) => {
    const height =
      rowIndex === rows.length - 1
        ? input.contentY + input.contentHeight - currentY
        : rowHeights[rowIndex];

    for (const slot of row.slots) {
      const horizontalGeometry = getSlotWidth(columns, slot.columnStart, slot.columnSpan);
      const verticalGeometry = applySlotVerticalAdjust(currentY, height, slot);

      slots.push({
        storyNumber: slot.storyNumber,
        x: horizontalGeometry.x,
        y: verticalGeometry.y,
        width: horizontalGeometry.width,
        height: verticalGeometry.height,
        columnStart: slot.columnStart,
        columnSpan: slot.columnSpan,
        priority: slot.priority,
      });
    }

    currentY += height + (rowGaps[rowIndex] ?? 0);
  });

  for (const slot of insetSlots) {
    const inset = slot.insetInto!;
    const parent = slots.find((candidate) => candidate.storyNumber === inset.parentStoryNumber);

    if (!parent) {
      throw new Error(
        `Template ${template.id}: story ${slot.storyNumber} is inset into missing parent ${inset.parentStoryNumber}`,
      );
    }

    const horizontalGeometry = getSlotWidth(columns, slot.columnStart, slot.columnSpan);
    const top = parent.y + parent.height * inset.topFraction;
    const verticalGeometry = applySlotVerticalAdjust(
      top,
      Math.max(1, parent.y + parent.height - top),
      slot,
    );

    slots.push({
      storyNumber: slot.storyNumber,
      x: horizontalGeometry.x,
      y: verticalGeometry.y,
      width: horizontalGeometry.width,
      height: verticalGeometry.height,
      columnStart: slot.columnStart,
      columnSpan: slot.columnSpan,
      priority: slot.priority,
      insetParentStoryNumber: parent.storyNumber,
    });
  }

  // A slot listed in `trimToInsets` ends where its insets begin, rather than
  // running behind them. Applied after the insets are placed, since their tops
  // are measured from the parent's untrimmed height.
  //
  // Trimming flush to the inset's own top made the two boxes touch with zero
  // air between them — every row-to-row transition elsewhere on the page
  // gets a gap (the peer-row pass above, via getEditorialRowGaps), but this
  // one, expressed through insetInto instead of the row pass, got none.
  // Stopping the trim one column-gutter short of the inset's top gives it
  // the same breathing room as everywhere else, without moving the inset
  // itself off the position its topFraction was measured against.
  for (const storyNumber of template.trimToInsets ?? []) {
    const parent = slots.find((candidate) => candidate.storyNumber === storyNumber);

    if (!parent) {
      continue;
    }

    const insetTops = slots
      .filter((candidate) => candidate.insetParentStoryNumber === storyNumber)
      .map((candidate) => candidate.y);

    if (insetTops.length === 0) {
      continue;
    }

    parent.height = Math.max(1, Math.min(...insetTops) - input.gutter - parent.y);
  }

  return {
    templateId: template.id,
    storyCount: template.storyCount,
    slots: slots.sort((first, second) => first.storyNumber - second.storyNumber),
  };
};

const choose = <Value,>(values: Value[]) => values[Math.floor(Math.random() * values.length)];

const splitColumns = (count: number, columnCount: number) => {
  if (count <= 1) {
    return [columnCount];
  }

  const splits: number[][] = [];

  if (count === 2) {
    splits.push([3, 3], [4, 2], [2, 4]);
  } else if (count === 3) {
    splits.push([2, 2, 2], [3, 2, 1], [1, 2, 3], [4, 1, 1], [1, 1, 4]);
  } else {
    splits.push([2, 2, 1, 1], [1, 2, 2, 1], [1, 1, 2, 2], [3, 1, 1, 1], [1, 1, 1, 3]);
  }

  return choose(splits).slice(0, count).map((span) => Math.max(1, Math.min(columnCount, span)));
};

const splitStoryRows = (storyCount: number) => {
  const patternsByCount: Record<number, number[][]> = {
    1: [[1]],
    2: [[1, 1], [2]],
    3: [[1, 2], [2, 1], [1, 1, 1]],
    4: [[1, 3], [2, 2], [3, 1], [1, 1, 2]],
    5: [[1, 2, 2], [2, 1, 2], [2, 2, 1], [1, 1, 3]],
    6: [[1, 2, 3], [2, 2, 2], [3, 1, 2], [2, 3, 1]],
    7: [[1, 2, 4], [2, 2, 3], [2, 3, 2], [3, 2, 2]],
    8: [[1, 3, 4], [2, 2, 4], [2, 3, 3], [3, 2, 3]],
  };

  return choose(patternsByCount[storyCount] ?? patternsByCount[5]);
};

export const generateRandomStoryLayout = (
  input: Omit<TemplateLayoutInput, "templateId"> & { storyCount: number },
): TemplateLayoutResult => {
  const storyCount = Math.max(1, Math.min(8, Math.round(input.storyCount)));
  const rowCounts = splitStoryRows(storyCount);
  const columns = createColumnGrid({
    pageWidth: input.pageWidth,
    contentX: input.contentX,
    contentWidth: input.contentWidth,
    columnCount: input.columnCount,
    gutter: input.gutter,
  });
  const rowGaps = getEditorialRowGaps({
    rows: rowCounts.map((count, index) => ({
      priorities: Array.from({ length: count }, (_, storyIndex) =>
        index === 0 && storyIndex === 0 ? "lead" : index <= 1 ? "major" : "secondary",
      ),
    })),
    pageUtilizationPercent: 100,
    // See generateTemplateLayout: no gutter override, so row spacing comes from
    // the priority-aware editorial targets rather than the column gutter.
  });
  const totalRowGap = rowGaps.reduce((sum, gap) => sum + gap, 0);
  const rowWeightVariants = [
    [1.15, 0.92, 0.93],
    [0.95, 1.15, 0.9],
    [1.05, 0.82, 1.13],
    [1.22, 0.78, 1],
  ];
  const rowWeights = choose(rowWeightVariants);
  const availableHeight = Math.max(1, input.contentHeight - totalRowGap);
  const normalizedWeights = rowCounts.map((_, index) => rowWeights[index] ?? 1);
  const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const rowHeights = normalizedWeights.map((weight) => availableHeight * (weight / totalWeight));
  const slots: TemplateStoryFrameSlot[] = [];
  let currentY = input.contentY;
  let storyNumber = 1;

  rowCounts.forEach((rowCount, rowIndex) => {
    const spans = splitColumns(rowCount, input.columnCount);
    const spanTotal = spans.reduce((sum, span) => sum + span, 0);
    const scale = spanTotal > input.columnCount ? input.columnCount / spanTotal : 1;
    const adjustedSpans = spans.map((span) => Math.max(1, Math.floor(span * scale)));
    let usedColumns = adjustedSpans.reduce((sum, span) => sum + span, 0);

    while (usedColumns < input.columnCount) {
      adjustedSpans[Math.floor(Math.random() * adjustedSpans.length)] += 1;
      usedColumns += 1;
    }

    let columnStart = 1;
    const height =
      rowIndex === rowCounts.length - 1
        ? input.contentY + input.contentHeight - currentY
        : rowHeights[rowIndex];

    adjustedSpans.forEach((columnSpan, slotIndex) => {
      const horizontalGeometry = getSlotWidth(columns, columnStart, columnSpan);

      slots.push({
        storyNumber,
        x: horizontalGeometry.x,
        y: currentY,
        width: horizontalGeometry.width,
        height,
        columnStart,
        columnSpan,
        priority: storyNumber === 1 ? "lead" : rowIndex === 0 || slotIndex === 0 ? "major" : "secondary",
      });
      storyNumber += 1;
      columnStart += columnSpan;
    });

    currentY += height + (rowGaps[rowIndex] ?? 0);
  });

  return {
    templateId: "FrontPage5A",
    storyCount,
    slots,
  };
};



// ─────────────────────────────────────────────────────────────────────────────
// Modular Story Layout
// ─────────────────────────────────────────────────────────────────────────────

export type ModularLayoutInput = Omit<TemplateLayoutInput, "templateId"> & {
  /**
   * Array of classified articles in display order.
   * The layout engine places them top-to-bottom, largest first within each row.
   */
  classifiedArticles: { sizeClass: ArticleSizeClass; columnSpan: number }[];
};

/**
 * Groups articles into rows such that each row fills exactly `columnCount` columns.
 *
 * Strategy:
 *  1. Sort articles largest-class-first.
 *  2. Greedily pack articles into the current row until it is full.
 *  3. If no single article fits the remaining columns, fill with the narrowest available.
 */
const packArticlesIntoRows = (
  articles: { sizeClass: ArticleSizeClass; columnSpan: number }[],
  columnCount: number,
): { sizeClass: ArticleSizeClass; columnSpan: number }[][] => {
  const rows: { sizeClass: ArticleSizeClass; columnSpan: number }[][] = [];
  const remaining = [...articles];

  while (remaining.length > 0) {
    const row: { sizeClass: ArticleSizeClass; columnSpan: number }[] = [];
    let usedColumns = 0;

    // Build a row until it is full or no more articles remain.
    while (usedColumns < columnCount && remaining.length > 0) {
      const freeColumns = columnCount - usedColumns;

      // Find the first article that fits.
      const fitIndex = remaining.findIndex((a) => a.columnSpan <= freeColumns);

      if (fitIndex === -1) {
        // No article fits — clamp the next article to the remaining width.
        const next = remaining.shift()!;
        row.push({ ...next, columnSpan: freeColumns });
        usedColumns = columnCount;
      } else {
        const [article] = remaining.splice(fitIndex, 1);
        row.push(article);
        usedColumns += article.columnSpan;
      }
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
};

/**
 * Generates a page layout where each frame's height is calibrated to the
 * article's size class rather than using random weight ratios.
 *
 * Each article is placed in the frame that matches its class:
 * - XS  → brief priority, minimal height
 * - S   → secondary priority
 * - M   → secondary priority, standard height
 * - L   → major priority
 * - XL  → lead priority, tallest frame
 *
 * Rows are packed left-to-right until `columnCount` columns are filled, then
 * a new row begins. Row heights come from `getModuleFrameHeight` for the
 * tallest class in each row.
 *
 * Row gaps are computed by the existing `getEditorialRowGaps` engine.
 * The last row is stretched to fill any remaining content height so the page
 * reaches 100% occupancy.
 */
export const generateModularStoryLayout = (
  input: ModularLayoutInput,
): TemplateLayoutResult => {
  const { classifiedArticles, columnCount, gutter, contentX, contentY, contentWidth, contentHeight, pageWidth } = input;

  if (classifiedArticles.length === 0) {
    return { templateId: "FrontPage5A", storyCount: 0, slots: [] };
  }

  const columns = createColumnGrid({
    pageWidth,
    contentX,
    contentWidth,
    columnCount,
    gutter,
  });

  // Pack articles into rows.
  const rows = packArticlesIntoRows(classifiedArticles, columnCount);

  // Compute the preferred height for each row (based on the tallest class in that row).
  const rowPreferredHeights = rows.map((row) => {
    const maxHeight = Math.max(
      ...row.map((a) => getModuleFrameHeight(a.sizeClass, a.columnSpan)),
    );
    return maxHeight;
  });

  // Compute row gaps using the editorial gap engine.
  const rowGaps = getEditorialRowGaps({
    rows: rows.map((row) => ({
      priorities: row.map((a) => ARTICLE_SIZE_CLASS_CONFIG[a.sizeClass].priority),
    })),
    pageUtilizationPercent: 100,
    // See generateTemplateLayout: no gutter override, so row spacing comes from
    // the priority-aware editorial targets rather than the column gutter.
  });

  // Scale row heights to fill the full content area.
  const totalGap = rowGaps.reduce((sum, g) => sum + g, 0);
  const availableHeight = Math.max(1, contentHeight - totalGap);
  const totalPreferred = rowPreferredHeights.reduce((sum, h) => sum + h, 0);
  const scale = totalPreferred > 0 ? availableHeight / totalPreferred : 1;
  const rowHeights = rowPreferredHeights.map((h) => Math.round(h * scale));

  // Distribute any rounding remainder to the last row.
  const allocatedTotal = rowHeights.reduce((sum, h) => sum + h, 0) + totalGap;
  const remainder = contentHeight - allocatedTotal;
  if (rowHeights.length > 0) {
    rowHeights[rowHeights.length - 1] += remainder;
  }

  // Build slots.
  const slots: TemplateStoryFrameSlot[] = [];
  let currentY = contentY;
  let storyNumber = 1;

  rows.forEach((row, rowIndex) => {
    const height =
      rowIndex === rows.length - 1
        ? contentY + contentHeight - currentY
        : rowHeights[rowIndex];
    let columnStart = 1;

    for (const article of row) {
      const span = article.columnSpan;
      const firstCol = columns[columnStart - 1];
      const lastCol = columns[columnStart + span - 2] ?? columns[columns.length - 1];

      if (firstCol && lastCol) {
        slots.push({
          storyNumber,
          x: firstCol.x,
          y: currentY,
          width: lastCol.x + lastCol.width - firstCol.x,
          height: Math.max(height, 150),
          columnStart,
          columnSpan: span,
          priority: ARTICLE_SIZE_CLASS_CONFIG[article.sizeClass].priority,
        });
      }

      columnStart += span;
      storyNumber += 1;
    }

    currentY += height + (rowGaps[rowIndex] ?? 0);
  });

  return {
    templateId: "FrontPage5A",
    storyCount: storyNumber - 1,
    slots: slots.sort((a, b) => a.storyNumber - b.storyNumber),
  };
};


export function calculatePageLayoutDiagnostics({
  stories,
  imageAreas,
  contentArea,
  contentHeight,
}: {
  stories: { width: number; height: number; y?: number; priority?: TemplateStoryFrameSlot["priority"] }[];
  imageAreas: number[];
  contentArea: number;
  contentHeight?: number;
}): PageLayoutDiagnostics {
  const storyAreas = stories.map((story) => story.width * story.height);
  const totalStoryArea = storyAreas.reduce((sum, area) => sum + area, 0);
  const totalImageArea = imageAreas.reduce((sum, area) => sum + area, 0);
  const largestStoryArea = Math.max(...storyAreas, 0);
  const smallestStoryArea = Math.min(...storyAreas, contentArea);
  const textArea = Math.max(0, totalStoryArea - totalImageArea);
  const rowMap = new Map<number, { y: number; height: number; priorities: TemplateStoryFrameSlot["priority"][] }>();

  for (const story of stories) {
    if (typeof story.y !== "number") {
      continue;
    }

    const key = Math.round(story.y * 1000) / 1000;
    const row = rowMap.get(key) ?? {
      y: story.y,
      height: 0,
      priorities: [],
    };

    row.height = Math.max(row.height, story.height);
    row.priorities.push(story.priority ?? "secondary");
    rowMap.set(key, row);
  }

  const rowGapDiagnostics = calculateRowGapDiagnostics({
    rows: [...rowMap.values()],
    contentHeight: contentHeight ?? 0,
  });

  return {
    pageFillPercent: contentArea > 0 ? (totalStoryArea / contentArea) * 100 : 0,
    unusedArea: Math.max(0, contentArea - totalStoryArea),
    averageRowGap: rowGapDiagnostics.averageRowGap,
    largestRowGap: rowGapDiagnostics.largestRowGap,
    rowDensityPercent: rowGapDiagnostics.rowDensityPercent,
    largestStoryPercent: contentArea > 0 ? (largestStoryArea / contentArea) * 100 : 0,
    smallestStoryPercent: contentArea > 0 ? (smallestStoryArea / contentArea) * 100 : 0,
    averageStorySize: stories.length > 0 ? totalStoryArea / stories.length : 0,
    totalImageAreaPercent: totalStoryArea > 0 ? (totalImageArea / totalStoryArea) * 100 : 0,
    textAreaPercent: totalStoryArea > 0 ? (textArea / totalStoryArea) * 100 : 0,
    editorialDensityPercent: contentArea > 0 ? (textArea / contentArea) * 100 : 0,
    imageDensityPercent: contentArea > 0 ? (totalImageArea / contentArea) * 100 : 0,
    whitespacePercent: contentArea > 0 ? Math.max(0, 100 - (totalStoryArea / contentArea) * 100) : 0,
    pageUtilizationPercent: contentArea > 0 ? (totalStoryArea / contentArea) * 100 : 0,
  };
}

export const TemplateLayoutEngine = {
  calculatePageLayoutDiagnostics,
  generateRandomStoryLayout,
  generateTemplateLayout,
  generateModularStoryLayout,
};
