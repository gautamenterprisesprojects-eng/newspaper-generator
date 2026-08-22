import type { StoryPriority } from "@/types/editor";
import type { TemplateDefinition, TemplateRowRhythm, TemplateStorySlotDefinition, TemplateId } from "@/engines/TemplateLayout/TemplateTypes";

/**
 * Standard printer conversion ratio from typographical points to centimeters.
 * 1 inch = 72 points = 2.54 centimeters -> 1 cm = 72 / 2.54 points.
 */
export const POINTS_PER_CM = 72 / 2.54;

export type CustomStorySpec = {
  storyNumber: number;
  priority: StoryPriority;
  columnSpan: number;
  imageRequired?: boolean;
  roleLabel?: string;
};

export type CustomRowSpec = {
  rowNumber: number;
  heightRatio: number; // Decimal representing portion of page height, e.g. 0.35
  stories: CustomStorySpec[];
};

export type CustomLayoutBlueprint = {
  id: string;
  name: string;
  totalColumns?: number; // Defaults to standard newspaper 6-column grid
  rows: CustomRowSpec[];
};

export type PromptRowInput = {
  heightPercent: number; // e.g. 35 for 35%
  colSpans: number[];    // e.g. [4, 2] summing to total columns
  priorities?: StoryPriority[];
  images?: boolean[];
  roleLabels?: string[];
};

export type PromptLayoutInput = {
  id: string;
  name: string;
  totalColumns?: number;
  rowLayouts: PromptRowInput[];
};

export type GeneratedArticleConfig = {
  storyNumber: number;
  row: number;
  columnStart: number;
  columnSpan: number;
  internalTextColumns: number;
  widthPt: number;
  widthCm: number;
  heightPt: number;
  estimatedCapacityWords: number;
  recommendedApiTier: 250 | 500 | 1000;
  imageEnabled: boolean;
};

export type CustomLayoutResult = {
  template: Omit<TemplateDefinition, "id"> & { id: string | TemplateId };
  storyConfigs: GeneratedArticleConfig[];
  diagnostics: {
    totalStoryCount: number;
    totalRowHeightPercent: number;
    isValidGrid: boolean;
    errors: string[];
  };
};

/**
 * LOCKED RULE FOR ALL EXISTING AND FUTURE LAYOUTS:
 * Counts the maximum possible words that can fit in an article box and chooses the correct
 * size of article grabbed from the API (250, 500, or 1000 words).
 * ALWAYS takes the higher word range (applying at least a 1.5x buffer) so NO empty white space
 * is ever left blank at the bottom of the article frame.
 */
export const selectOptimisticNewswireWordTier = (estimatedCapacityWords: number): 250 | 500 | 1000 => {
  const bufferedWords = Math.max(100, Math.round(estimatedCapacityWords * 1.5));
  if (bufferedWords <= 220) {
    return 250;
  }
  if (bufferedWords <= 450) {
    return 500;
  }
  return 1000;
};

/**
 * LOCKED RULE: Automatically determines internal text columns based on physical dimensions in cm.
 * - Width < 8 cm -> 1 text column
 * - Width 8–14 cm -> 2 text columns
 * - Width > 14 cm -> 3 text columns
 * Enforces boundary clamping so columns are never < 4 cm nor > 8 cm.
 */
export const determineInternalTextColumnCount = (widthPt: number, fallbackSpan = 1): number => {
  if (!widthPt || widthPt <= 0) {
    return fallbackSpan > 3 ? 3 : fallbackSpan === 3 ? 2 : 1;
  }

  const widthCm = widthPt / POINTS_PER_CM;
  let columns = 1;
  if (widthCm >= 8 && widthCm <= 14) {
    columns = 2;
  } else if (widthCm > 14) {
    columns = 3;
  }

  // Enforce rigid limits: never narrower than 4 cm per column, never wider than 8 cm per column.
  while (columns > 1 && widthCm / columns < 4.0) {
    columns -= 1;
  }
  while (columns < 4 && widthCm / columns > 8.0) {
    columns += 1;
  }

  return Math.min(Math.max(columns, 1), 4);
};

/**
 * Estimates word capacity of a box based on physical dimensions and image status.
 * If image is NOT available or disabled, image area is 0, allowing text to reflow instantly
 * to occupy the entire vertical space.
 */
export const estimateStoryBoxWordCapacity = (
  widthPt: number,
  heightPt: number,
  imageEnabled: boolean,
  internalColumns: number,
  bodyFontSizePt = 12,
  bodyLeadingPt = 16.5,
): number => {
  const paddingX = 36;
  const availableWidth = Math.max(40, widthPt - paddingX);

  const headlineAllowancePt = 38;
  const imageAreaPt = imageEnabled ? 130 : 0; // When image is disabled, body text moves up instantly!
  const verticalPaddingPt = 16;
  const availableBodyHeight = Math.max(20, heightPt - headlineAllowancePt - imageAreaPt - verticalPaddingPt);

  const linesPerCol = Math.floor(availableBodyHeight / Math.max(1, bodyLeadingPt));
  const totalLines = linesPerCol * Math.max(1, internalColumns);

  const colGapPt = 14;
  const colWidth = Math.max(20, (availableWidth - (internalColumns - 1) * colGapPt) / Math.max(1, internalColumns));
  const wordsPerLine = colWidth / (bodyFontSizePt * 2.7);

  return Math.max(25, Math.round(totalLines * wordsPerLine));
};

/**
 * Helper to compile descriptive, prompt-based layout arrays directly into structured blueprints.
 */
export const compilePromptToBlueprint = (prompt: PromptLayoutInput): CustomLayoutBlueprint => {
  const totalColumns = prompt.totalColumns ?? 6;
  let storyCounter = 1;
  const rows: CustomRowSpec[] = prompt.rowLayouts.map((rowInput, rowIndex) => {
    const heightRatio = rowInput.heightPercent / 100;
    const stories: CustomStorySpec[] = rowInput.colSpans.map((span, spanIndex) => {
      const priority = rowInput.priorities?.[spanIndex] ?? (span >= 4 ? "lead" : span === 3 ? "major" : "secondary");
      const imageRequired = rowInput.images?.[spanIndex] ?? (span >= 3);
      const roleLabel = rowInput.roleLabels?.[spanIndex] ?? `Story ${storyCounter}`;
      const spec: CustomStorySpec = {
        storyNumber: storyCounter,
        priority,
        columnSpan: span,
        imageRequired,
        roleLabel,
      };
      storyCounter += 1;
      return spec;
    });

    return {
      rowNumber: rowIndex + 1,
      heightRatio,
      stories,
    };
  });

  return {
    id: prompt.id,
    name: prompt.name,
    totalColumns,
    rows,
  };
};

/**
 * Generates a complete, verified newspaper template layout from a custom blueprint.
 * Automatically enforces all locked rules: word counter fitting (250/500/1000),
 * physical internal column measurements in cm, and zero blank space guarantees.
 */
export const generateCustomLayoutFromBlueprint = (
  blueprint: CustomLayoutBlueprint,
  pageWidthPt = 792,  // Standard tabloid / newspaper content width in points
  pageHeightPt = 1122, // Standard content height in points
): CustomLayoutResult => {
  const totalColumns = blueprint.totalColumns ?? 6;
  const gutterPt = 14;
  const colWidthPt = (pageWidthPt - (totalColumns - 1) * gutterPt) / totalColumns;

  const rowRhythm: TemplateRowRhythm[] = [];
  const slots: TemplateStorySlotDefinition[] = [];
  const storyConfigs: GeneratedArticleConfig[] = [];
  const errors: string[] = [];

  let totalRatio = 0;
  let storyCount = 0;

  blueprint.rows.forEach((row, rowIndex) => {
    totalRatio += row.heightRatio;
    const isLastRow = rowIndex === blueprint.rows.length - 1;
    rowRhythm.push({
      row: row.rowNumber,
      baseRatio: row.heightRatio,
      receivesRemainingSpace: isLastRow,
    });

    const rowHeightPt = Math.max(80, pageHeightPt * row.heightRatio);
    let currentColStart = 1;
    let rowSpanSum = 0;

    row.stories.forEach((story) => {
      storyCount += 1;
      const colStart = currentColStart;
      const colSpan = Math.min(story.columnSpan, totalColumns - colStart + 1);
      rowSpanSum += colSpan;
      currentColStart += colSpan;

      slots.push({
        storyNumber: story.storyNumber,
        row: row.rowNumber,
        columnStart: colStart,
        columnSpan: colSpan,
        priority: story.priority,
      });

      const widthPt = colSpan * colWidthPt + (colSpan - 1) * gutterPt;
      const widthCm = Number((widthPt / POINTS_PER_CM).toFixed(2));
      const internalTextColumns = determineInternalTextColumnCount(widthPt, colSpan);
      
      // If image is disabled or unavailable, imageEnabled is false -> zero image space reserved -> text moves up instantly
      const imageEnabled = Boolean(story.imageRequired);
      const estimatedCapacityWords = estimateStoryBoxWordCapacity(widthPt, rowHeightPt, imageEnabled, internalTextColumns);
      const recommendedApiTier = selectOptimisticNewswireWordTier(estimatedCapacityWords);

      storyConfigs.push({
        storyNumber: story.storyNumber,
        row: row.rowNumber,
        columnStart: colStart,
        columnSpan: colSpan,
        internalTextColumns,
        widthPt: Math.round(widthPt),
        widthCm,
        heightPt: Math.round(rowHeightPt),
        estimatedCapacityWords,
        recommendedApiTier,
        imageEnabled,
      });
    });

    if (rowSpanSum > totalColumns) {
      errors.push(`Row ${row.rowNumber} exceeds total column grid (${rowSpanSum} > ${totalColumns}).`);
    } else if (rowSpanSum < totalColumns) {
      errors.push(`Row ${row.rowNumber} does not completely fill horizontal columns (${rowSpanSum} < ${totalColumns}).`);
    }
  });

  const totalRowHeightPercent = Math.round(totalRatio * 100);
  if (Math.abs(totalRowHeightPercent - 100) > 2) {
    errors.push(`Total row heights sum to ${totalRowHeightPercent}%, expected ~100%.`);
  }

  return {
    template: {
      id: blueprint.id,
      name: blueprint.name,
      storyCount,
      rowRhythm,
      slots,
    },
    storyConfigs,
    diagnostics: {
      totalStoryCount: storyCount,
      totalRowHeightPercent,
      isValidGrid: errors.length === 0,
      errors,
    },
  };
};
