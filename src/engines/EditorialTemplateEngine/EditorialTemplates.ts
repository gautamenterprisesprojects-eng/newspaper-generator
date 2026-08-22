import type {
  EditorialTemplateDefinition,
  EditorialTemplateSlotDefinition,
  EditorialTemplateVariant,
} from "./EditorialTemplateTypes";

const slotIds = "ABCDEFGHIJKLM".split("");

const briefZoneHeight = (storyCount: number) => {
  const briefCount = Math.max(0, storyCount - 6);

  if (briefCount === 0) {
    return 0;
  }

  if (briefCount === 1) {
    return 10;
  }

  if (briefCount === 2) {
    return 14;
  }

  if (briefCount === 3) {
    return 18;
  }

  return 24;
};

const imageSlotCount = (storyCount: number) => Math.max(1, Math.floor(storyCount * 0.35));

const withImageFlags = (
  storyCount: number,
  slots: Omit<EditorialTemplateSlotDefinition, "hasImage">[],
): EditorialTemplateSlotDefinition[] => {
  const imageCount = imageSlotCount(storyCount);

  return slots.map((slot, index) => ({
    ...slot,
    hasImage: index < imageCount,
  }));
};

const distributeBriefs = ({
  ids,
  yPercent,
  heightPercent,
  pattern,
}: {
  ids: string[];
  yPercent: number;
  heightPercent: number;
  pattern: EditorialTemplateVariant;
}): Omit<EditorialTemplateSlotDefinition, "hasImage">[] => {
  if (ids.length === 0) {
    return [];
  }

  if (ids.length <= 3) {
    const spans =
      pattern === "A"
        ? [2, 2, 2]
        : pattern === "B"
          ? [3, 1, 2]
          : [2, 3, 1];
    let cursor = 0;

    return ids.map((slotId, index) => {
      const columnSpan = spans[index] ?? 2;
      const slot = {
        slotId,
        columnStart: cursor,
        columnSpan,
        yPercent,
        heightPercent,
      };

      cursor += columnSpan;

      return slot;
    });
  }

  const topRowCount = Math.ceil(ids.length / 2);
  const rows = [ids.slice(0, topRowCount), ids.slice(topRowCount)];

  return rows.flatMap((rowIds, rowIndex) => {
    const rowY = yPercent + (heightPercent / 2) * rowIndex;
    const rowHeight = heightPercent / 2;

    return distributeIntegerAcrossColumns(rowIds, rowY, rowHeight);
  });
};

const distributeIntegerAcrossColumns = (
  ids: string[],
  yPercent: number,
  heightPercent: number,
): Omit<EditorialTemplateSlotDefinition, "hasImage">[] => {
  const spanPatterns: Record<number, number[]> = {
    1: [6],
    2: [3, 3],
    3: [2, 2, 2],
    4: [2, 1, 1, 2],
    5: [2, 1, 1, 1, 1],
    6: [1, 1, 1, 1, 1, 1],
  };
  const spans = spanPatterns[ids.length] ?? Array.from({ length: ids.length }).map(() => 1);
  let cursor = 0;

  return ids.map((slotId, index) => {
    const columnSpan = spans[index] ?? 1;
    const slot = {
      slotId,
      columnStart: cursor,
      columnSpan,
      yPercent,
      heightPercent,
    };

    cursor += columnSpan;

    return slot;
  });
};

const mediumSlots = ({
  storyCount,
  yPercent,
  heightPercent,
  pattern,
}: {
  storyCount: number;
  yPercent: number;
  heightPercent: number;
  pattern: EditorialTemplateVariant;
}): Omit<EditorialTemplateSlotDefinition, "hasImage">[] => {
  const mediumIds = slotIds.slice(3, Math.min(6, storyCount));

  if (mediumIds.length === 0) {
    return [];
  }

  if (mediumIds.length === 1) {
    return [
      {
        slotId: mediumIds[0],
        columnStart: pattern === "C" ? 0 : 2,
        columnSpan: 4,
        yPercent,
        heightPercent,
      },
    ];
  }

  if (mediumIds.length === 2) {
    return [
      {
        slotId: mediumIds[0],
        columnStart: 0,
        columnSpan: pattern === "B" ? 4 : 3,
        yPercent,
        heightPercent,
      },
      {
        slotId: mediumIds[1],
        columnStart: pattern === "B" ? 4 : 3,
        columnSpan: pattern === "B" ? 2 : 3,
        yPercent,
        heightPercent,
      },
    ];
  }

  if (pattern === "A") {
    return [
      { slotId: "D", columnStart: 0, columnSpan: 2, yPercent, heightPercent },
      { slotId: "E", columnStart: 2, columnSpan: 2, yPercent, heightPercent },
      { slotId: "F", columnStart: 4, columnSpan: 2, yPercent, heightPercent },
    ];
  }

  if (pattern === "B") {
    return [
      { slotId: "D", columnStart: 0, columnSpan: 3, yPercent, heightPercent },
      { slotId: "E", columnStart: 3, columnSpan: 3, yPercent, heightPercent: heightPercent / 2 },
      {
        slotId: "F",
        columnStart: 3,
        columnSpan: 3,
        yPercent: yPercent + heightPercent / 2,
        heightPercent: heightPercent / 2,
      },
    ];
  }

  return [
    { slotId: "D", columnStart: 0, columnSpan: 3, yPercent, heightPercent: heightPercent / 2 },
    {
      slotId: "E",
      columnStart: 0,
      columnSpan: 3,
      yPercent: yPercent + heightPercent / 2,
      heightPercent: heightPercent / 2,
    },
    { slotId: "F", columnStart: 3, columnSpan: 3, yPercent, heightPercent },
  ];
};

const variantSlots = (
  storyCount: number,
  variant: EditorialTemplateVariant,
): Omit<EditorialTemplateSlotDefinition, "hasImage">[] => {
  const leadHeight = variant === "A" ? 36 : variant === "B" ? 34 : 38;
  const briefHeight = briefZoneHeight(storyCount);
  const mediumY = leadHeight;
  const mediumHeight = 100 - leadHeight - briefHeight;
  const briefIds = slotIds.slice(6, storyCount);

  if (variant === "A") {
    return [
      { slotId: "A", columnStart: 0, columnSpan: 4, yPercent: 0, heightPercent: leadHeight },
      { slotId: "B", columnStart: 4, columnSpan: 2, yPercent: 0, heightPercent: leadHeight / 2 },
      {
        slotId: "C",
        columnStart: 4,
        columnSpan: 2,
        yPercent: leadHeight / 2,
        heightPercent: leadHeight / 2,
      },
      ...mediumSlots({ storyCount, yPercent: mediumY, heightPercent: mediumHeight, pattern: variant }),
      ...distributeBriefs({
        ids: briefIds,
        yPercent: 100 - briefHeight,
        heightPercent: briefHeight,
        pattern: variant,
      }),
    ].slice(0, storyCount);
  }

  if (variant === "B") {
    return [
      { slotId: "A", columnStart: 2, columnSpan: 4, yPercent: 0, heightPercent: leadHeight },
      { slotId: "B", columnStart: 0, columnSpan: 2, yPercent: 0, heightPercent: leadHeight / 2 },
      {
        slotId: "C",
        columnStart: 0,
        columnSpan: 2,
        yPercent: leadHeight / 2,
        heightPercent: leadHeight / 2,
      },
      ...mediumSlots({ storyCount, yPercent: mediumY, heightPercent: mediumHeight, pattern: variant }),
      ...distributeBriefs({
        ids: briefIds,
        yPercent: 100 - briefHeight,
        heightPercent: briefHeight,
        pattern: variant,
      }),
    ].slice(0, storyCount);
  }

  const majorBandHeight = 18;
  const fullLeadHeight = 34;
  const lowerMediumY = fullLeadHeight + majorBandHeight;
  const lowerMediumHeight = 100 - lowerMediumY - briefHeight;

  return [
    { slotId: "A", columnStart: 0, columnSpan: 6, yPercent: 0, heightPercent: fullLeadHeight },
    { slotId: "B", columnStart: 0, columnSpan: 3, yPercent: fullLeadHeight, heightPercent: majorBandHeight },
    { slotId: "C", columnStart: 3, columnSpan: 3, yPercent: fullLeadHeight, heightPercent: majorBandHeight },
    ...mediumSlots({ storyCount, yPercent: lowerMediumY, heightPercent: lowerMediumHeight, pattern: variant }),
    ...distributeBriefs({
      ids: briefIds,
      yPercent: 100 - briefHeight,
      heightPercent: briefHeight,
      pattern: variant,
    }),
  ].slice(0, storyCount);
};

export const editorialTemplates: EditorialTemplateDefinition[] = Array.from(
  { length: 9 },
  (_, index) => index + 5,
).flatMap((storyCount) =>
  (["A", "B", "C"] as EditorialTemplateVariant[]).map((variant) => ({
    storyCount,
    variant,
    name: `${storyCount} Story Hindi Front Page ${variant}`,
    slots: withImageFlags(storyCount, variantSlots(storyCount, variant)),
  })),
);
