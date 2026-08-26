import type { TextRegion } from "@/engines/RegionEngine/RegionTypes";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { measureCharacter } from "@/engines/TypographyEngine/TypographyEngine";
import type { TextMeasureOptions } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle, DropCapLayout } from "@/types/editor";

export type DropCapInput = {
  enabled: boolean;
  text: string;
  regions: TextRegion[];
  bodyStyle: ArticleTextStyle;
  lineHeight: number;
  lineSpan?: number;
};

export type DropCapResult = {
  text: string;
  regions: TextRegion[];
  dropCap: DropCapLayout | null;
};

const DEFAULT_DROP_CAP_LINE_SPAN = 2;
const DROP_CAP_GUTTER = 6;
const MIN_REMAINING_TEXT_WIDTH = 36;

const sortRegionsInColumnFlowOrder = (regions: TextRegion[]) =>
  [...regions].sort((a, b) => {
    if (a.columnIndex !== b.columnIndex) {
      return a.columnIndex - b.columnIndex;
    }

    if (a.y !== b.y) {
      return a.y - b.y;
    }

    return a.x - b.x;
  });

const normalizeRegionOrders = (regions: TextRegion[]) =>
  sortRegionsInColumnFlowOrder(regions).map((region, order) => ({
    ...region,
    order,
    area: region.width * region.height,
  }));

const splitFirstGrapheme = (text: string) => {
  const trimmed = text.replace(/^\s+/u, "");

  if (!trimmed) {
    return {
      firstGrapheme: "",
      remainingText: "",
    };
  }

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const [firstSegment] = Array.from(segmenter.segment(trimmed));
    const firstGrapheme = firstSegment?.segment ?? "";

    return {
      firstGrapheme,
      remainingText: trimmed.slice(firstGrapheme.length).replace(/^\s+/u, ""),
    };
  }

  const [firstGrapheme = ""] = Array.from(trimmed);

  return {
    firstGrapheme,
    remainingText: trimmed.slice(firstGrapheme.length).replace(/^\s+/u, ""),
  };
};

const createRegion = (
  source: TextRegion,
  rect: Pick<TextRegion, "x" | "y" | "width" | "height">,
): TextRegion | null => {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    ...source,
    ...rect,
    area: rect.width * rect.height,
  };
};

const subtractDropCapFromFirstRegion = (region: TextRegion, occupiedWidth: number, occupiedHeight: number) => {
  const rightRegion = createRegion(region, {
    x: region.x + occupiedWidth,
    y: region.y,
    width: region.width - occupiedWidth,
    height: Math.min(occupiedHeight, region.height),
  });
  const lowerRegion = createRegion(region, {
    x: region.x,
    y: region.y + occupiedHeight,
    width: region.width,
    height: region.height - occupiedHeight,
  });

  return [rightRegion, lowerRegion].filter((candidate): candidate is TextRegion => Boolean(candidate));
};

export const composeDropCap = (
  input: DropCapInput,
  options?: TextMeasureOptions,
): DropCapResult => {
  if (!input.enabled) {
    return {
      text: input.text,
      regions: normalizeRegionOrders(input.regions),
      dropCap: null,
    };
  }

  const sortedRegions = sortRegionsInColumnFlowOrder(input.regions);
  const firstRegion = sortedRegions[0];
  const { firstGrapheme, remainingText } = splitFirstGrapheme(input.text);
  const lineSpan = Math.max(1, Math.round(input.lineSpan ?? DEFAULT_DROP_CAP_LINE_SPAN));
  const occupiedHeight = input.lineHeight * lineSpan;

  if (!firstRegion || !firstGrapheme || firstRegion.height < occupiedHeight) {
    return {
      text: input.text,
      regions: normalizeRegionOrders(input.regions),
      dropCap: null,
    };
  }

  const dropCapFontSize = Math.max(input.bodyStyle.fontSize, occupiedHeight * 0.82);
  const measuredWidth = measureCharacter(
    firstGrapheme,
    input.bodyStyle.fontFamily,
    dropCapFontSize,
    options,
  );
  const occupiedWidth = Math.ceil(measuredWidth + DROP_CAP_GUTTER);

  if (firstRegion.width - occupiedWidth < MIN_REMAINING_TEXT_WIDTH) {
    return {
      text: input.text,
      regions: normalizeRegionOrders(input.regions),
      dropCap: null,
    };
  }

  const replacementRegions = subtractDropCapFromFirstRegion(
    firstRegion,
    occupiedWidth,
    occupiedHeight,
  );
  const remainingRegions = sortedRegions.filter((region) => region !== firstRegion);

  return {
    text: remainingText,
    regions: normalizeRegionOrders([...replacementRegions, ...remainingRegions]),
    dropCap: {
      x: firstRegion.x,
      y: firstRegion.y,
      width: occupiedWidth,
      height: occupiedHeight,
      text: firstGrapheme,
      style: {
        ...input.bodyStyle,
        fontFamily: getNewspaperFontStack("serif"),
        fontSize: dropCapFontSize,
        fontStyle: "bold",
        lineHeight: 1,
        wrap: "none",
      },
    },
  };
};

export const DropCapEngine = {
  composeDropCap,
};
