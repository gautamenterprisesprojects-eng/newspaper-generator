import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import type { PageTemplate, PageTemplateRole, PageTemplateSlot } from "./PageTemplateTypes";

type TemplateDefinition = {
  rows: string[][];
  roles: Record<string, PageTemplateRole>;
};

const templateDefinitions: Record<number, TemplateDefinition> = {
  5: {
    rows: [
      ["A", "A", "A", "A", "B", "B"],
      ["A", "A", "A", "A", "B", "B"],
      ["A", "A", "A", "A", "C", "C"],
      ["A", "A", "A", "A", "C", "C"],
      ["D", "D", "D", "E", "E", "E"],
      ["D", "D", "D", "E", "E", "E"],
    ],
    roles: { A: "lead", B: "secondary", C: "secondary", D: "brief", E: "brief" },
  },
  6: {
    rows: [
      ["A", "A", "A", "B", "B", "B"],
      ["A", "A", "A", "B", "B", "B"],
      ["C", "C", "C", "D", "D", "D"],
      ["C", "C", "C", "D", "D", "D"],
      ["E", "E", "E", "F", "F", "F"],
      ["E", "E", "E", "F", "F", "F"],
    ],
    roles: { A: "lead", B: "secondary", C: "secondary", D: "secondary", E: "brief", F: "brief" },
  },
  7: {
    rows: [
      ["A", "A", "A", "A", "B", "B"],
      ["A", "A", "A", "A", "B", "B"],
      ["C", "C", "C", "D", "D", "D"],
      ["C", "C", "C", "D", "D", "D"],
      ["E", "E", "F", "F", "G", "G"],
      ["E", "E", "F", "F", "G", "G"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
    },
  },
  8: {
    rows: [
      ["A", "A", "A", "B", "B", "B"],
      ["A", "A", "A", "B", "B", "B"],
      ["C", "C", "D", "D", "E", "E"],
      ["C", "C", "D", "D", "E", "E"],
      ["F", "F", "G", "G", "H", "H"],
      ["F", "F", "G", "G", "H", "H"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
    },
  },
  9: {
    rows: [
      ["A", "A", "B", "B", "C", "C"],
      ["A", "A", "B", "B", "C", "C"],
      ["D", "D", "E", "E", "F", "F"],
      ["D", "D", "E", "E", "F", "F"],
      ["G", "G", "H", "H", "I", "I"],
      ["G", "G", "H", "H", "I", "I"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
      I: "brief",
    },
  },
  10: {
    rows: [
      ["A", "A", "A", "B", "B", "B"],
      ["A", "A", "A", "B", "B", "B"],
      ["C", "C", "D", "D", "E", "E"],
      ["C", "C", "D", "D", "E", "E"],
      ["F", "F", "G", "G", "H", "H"],
      ["F", "F", "G", "G", "H", "H"],
      ["I", "I", "I", "J", "J", "J"],
      ["I", "I", "I", "J", "J", "J"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
      I: "brief",
      J: "brief",
    },
  },
  11: {
    rows: [
      ["A", "A", "A", "B", "B", "B"],
      ["A", "A", "A", "B", "B", "B"],
      ["C", "C", "D", "D", "E", "E"],
      ["C", "C", "D", "D", "E", "E"],
      ["F", "F", "G", "G", "H", "H"],
      ["F", "F", "G", "G", "H", "H"],
      ["I", "I", "J", "J", "K", "K"],
      ["I", "I", "J", "J", "K", "K"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
      I: "brief",
      J: "brief",
      K: "brief",
    },
  },
  12: {
    rows: [
      ["A", "A", "B", "B", "C", "C"],
      ["A", "A", "B", "B", "C", "C"],
      ["D", "D", "E", "E", "F", "F"],
      ["D", "D", "E", "E", "F", "F"],
      ["G", "G", "H", "H", "I", "I"],
      ["G", "G", "H", "H", "I", "I"],
      ["J", "J", "K", "K", "L", "L"],
      ["J", "J", "K", "K", "L", "L"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
      I: "brief",
      J: "brief",
      K: "brief",
      L: "brief",
    },
  },
  13: {
    rows: [
      ["A", "A", "A", "B", "B", "B"],
      ["A", "A", "A", "B", "B", "B"],
      ["C", "C", "D", "D", "E", "E"],
      ["C", "C", "D", "D", "E", "E"],
      ["F", "F", "G", "G", "H", "H"],
      ["F", "F", "G", "G", "H", "H"],
      ["I", "J", "K", "L", "M", "M"],
      ["I", "J", "K", "L", "M", "M"],
    ],
    roles: {
      A: "lead",
      B: "secondary",
      C: "secondary",
      D: "secondary",
      E: "brief",
      F: "brief",
      G: "brief",
      H: "brief",
      I: "brief",
      J: "brief",
      K: "brief",
      L: "brief",
      M: "brief",
    },
  },
};

const getBoundsForSlot = (rows: string[][], slotId: string) => {
  const coordinates: { row: number; column: number }[] = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell === slotId) {
        coordinates.push({ row: rowIndex, column: columnIndex });
      }
    });
  });

  const minRow = Math.min(...coordinates.map((coordinate) => coordinate.row));
  const maxRow = Math.max(...coordinates.map((coordinate) => coordinate.row));
  const minColumn = Math.min(...coordinates.map((coordinate) => coordinate.column));
  const maxColumn = Math.max(...coordinates.map((coordinate) => coordinate.column));

  return {
    minRow,
    maxRow,
    minColumn,
    maxColumn,
  };
};

const buildTemplateSlots = ({
  definition,
  pageWidth,
  pageHeight,
  pageMargin,
}: {
  definition: TemplateDefinition;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
}): PageTemplateSlot[] => {
  const rowCount = definition.rows.length;
  const columnCount = definition.rows[0].length;
  const contentWidth = pageWidth - pageMargin * 2;
  const contentHeight = pageHeight - pageMargin * 2;
  const cellWidth = contentWidth / columnCount;
  const cellHeight = contentHeight / rowCount;
  const slotIds = Object.keys(definition.roles);

  return slotIds.map((slotId) => {
    const bounds = getBoundsForSlot(definition.rows, slotId);

    return {
      id: slotId,
      x: pageMargin + bounds.minColumn * cellWidth,
      y: pageMargin + bounds.minRow * cellHeight,
      width: (bounds.maxColumn - bounds.minColumn + 1) * cellWidth,
      height: (bounds.maxRow - bounds.minRow + 1) * cellHeight,
      role: definition.roles[slotId],
    };
  });
};

export const getPageTemplate = ({
  storyCount,
  pageWidth = NEWSPAPER_PAGE.width,
  pageHeight = NEWSPAPER_PAGE.height,
  pageMargin = PAGE_MARGIN,
}: {
  storyCount: number;
  pageWidth?: number;
  pageHeight?: number;
  pageMargin?: number;
}): PageTemplate | null => {
  const definition = templateDefinitions[storyCount];

  if (!definition) {
    return null;
  }

  return {
    storyCount,
    pageWidth,
    pageHeight,
    pageMargin,
    slots: buildTemplateSlots({
      definition,
      pageWidth,
      pageHeight,
      pageMargin,
    }),
  };
};

export const getSupportedTemplateCounts = () =>
  Object.keys(templateDefinitions)
    .map(Number)
    .sort((first, second) => first - second);

export const PageTemplateEngine = {
  getPageTemplate,
  getSupportedTemplateCounts,
};
