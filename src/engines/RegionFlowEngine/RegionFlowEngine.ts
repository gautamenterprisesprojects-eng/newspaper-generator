import type {
  RegionDiscardReason,
  RegionFlowDiscardedRegion,
  RegionFlowInput,
  RegionFlowRegion,
  RegionFlowResult,
  RegionUsabilityRules,
} from "./RegionFlowTypes";

const getRegionId = (order: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = alphabet[order % alphabet.length];
  const suffix = order >= alphabet.length ? `${Math.floor(order / alphabet.length) + 1}` : "";

  return `Region ${letter}${suffix}`;
};

const sortRegionsInColumnFlowOrder = (regions: RegionFlowInput["regions"]) =>
  [...regions].sort((a, b) => {
    if (a.columnIndex !== b.columnIndex) {
      return a.columnIndex - b.columnIndex;
    }

    if (a.y !== b.y) {
      return a.y - b.y;
    }

    return a.x - b.x;
  });

const getRegionArea = (region: RegionFlowInput["regions"][number]) =>
  region.area ?? region.width * region.height;

const getMaxLines = (height: number, lineHeight: number) =>
  lineHeight > 0 ? Math.floor(height / lineHeight) : 0;

const getDiscardReasons = (
  region: RegionFlowInput["regions"][number],
  maxLines: number,
  usabilityRules: RegionUsabilityRules = {},
) => {
  const reasons: RegionDiscardReason[] = [];
  const area = getRegionArea(region);

  if (
    typeof usabilityRules.minRegionWidth === "number" &&
    region.width < usabilityRules.minRegionWidth
  ) {
    reasons.push("min-width");
  }

  if (
    typeof usabilityRules.minRegionLines === "number" &&
    maxLines < usabilityRules.minRegionLines
  ) {
    reasons.push("min-lines");
  }

  if (
    typeof usabilityRules.minRegionArea === "number" &&
    area < usabilityRules.minRegionArea
  ) {
    reasons.push("min-area");
  }

  return reasons;
};

export const partitionRegionsByUsability = ({
  regions,
  lineHeight,
  usabilityRules,
}: Pick<RegionFlowInput, "regions" | "lineHeight" | "usabilityRules">) => {
  const safeLineHeight = Math.max(0, lineHeight);
  const sortedRegions = sortRegionsInColumnFlowOrder(regions);
  const usableRegions: RegionFlowInput["regions"] = [];
  const discardedRegions: RegionFlowDiscardedRegion[] = [];

  for (const region of sortedRegions) {
    const maxLines = getMaxLines(region.height, safeLineHeight);
    const reasons = getDiscardReasons(region, maxLines, usabilityRules);

    if (reasons.length === 0) {
      usableRegions.push(region);
      continue;
    }

    discardedRegions.push({
      id: getRegionId(region.order),
      status: "discarded",
      region,
      area: getRegionArea(region),
      maxLines,
      assignedLineCount: 0,
      remainingCapacity: maxLines,
      consumedHeight: 0,
      lines: [],
      discardReasons: reasons,
    });
  }

  return {
    usableRegions,
    discardedRegions,
  };
};

export const flowLinesThroughRegions = (input: RegionFlowInput): RegionFlowResult => {
  const lineHeight = Math.max(0, input.lineHeight);
  const { usableRegions, discardedRegions } = partitionRegionsByUsability({
    regions: input.regions,
    lineHeight,
    usabilityRules: input.usabilityRules,
  });
  let cursor = 0;

  const regions: RegionFlowRegion[] = usableRegions.map((region) => {
    const maxLines = getMaxLines(region.height, lineHeight);
    const regionLines = input.wrappedLines.slice(cursor, cursor + maxLines);
    const sourceStart = cursor;
    const assignedLineCount = regionLines.length;

    cursor += assignedLineCount;

    return {
      id: getRegionId(region.order),
      status: "usable",
      region,
      area: getRegionArea(region),
      maxLines,
      assignedLineCount,
      remainingCapacity: maxLines - assignedLineCount,
      consumedHeight: assignedLineCount * lineHeight,
      lines: regionLines.map((line, index) => ({
        text: line,
        sourceIndex: sourceStart + index,
        x: region.x,
        y: region.y + index * lineHeight,
        width: region.width,
        height: lineHeight,
      })),
    };
  });
  const visibleLines = input.wrappedLines.slice(0, cursor);
  const remainingLines = input.wrappedLines.slice(cursor);
  const totalCapacity = regions.reduce((sum, region) => sum + region.maxLines, 0);
  const consumedRegionCount = regions.filter((region) => region.assignedLineCount > 0).length;

  return {
    regions,
    discardedRegions,
    visibleLines,
    visibleLineCount: visibleLines.length,
    totalCapacity,
    usableRegionCount: regions.length,
    consumedRegionCount,
    discardedRegionCount: discardedRegions.length,
    overflow: remainingLines.length > 0,
    remainingLines,
    remainingLineCount: remainingLines.length,
  };
};

export const RegionFlowEngine = {
  partitionRegionsByUsability,
  flowLinesThroughRegions,
};
