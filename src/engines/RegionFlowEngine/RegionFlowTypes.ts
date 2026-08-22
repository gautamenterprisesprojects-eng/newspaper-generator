import type { TextRegion } from "@/engines/RegionEngine/RegionTypes";

export type RegionFlowInput = {
  wrappedLines: string[];
  regions: TextRegion[];
  lineHeight: number;
  usabilityRules?: RegionUsabilityRules;
};

export type RegionUsabilityRules = {
  minRegionWidth?: number;
  minRegionLines?: number;
  minRegionArea?: number;
};

export type RegionDiscardReason = "min-width" | "min-lines" | "min-area";

export type RegionFlowLine = {
  text: string;
  sourceIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RegionFlowRegion = {
  id: string;
  status: "usable";
  region: TextRegion;
  area: number;
  maxLines: number;
  assignedLineCount: number;
  remainingCapacity: number;
  lines: RegionFlowLine[];
  consumedHeight: number;
};

export type RegionFlowDiscardedRegion = {
  id: string;
  status: "discarded";
  region: TextRegion;
  area: number;
  maxLines: number;
  assignedLineCount: 0;
  remainingCapacity: number;
  consumedHeight: 0;
  lines: [];
  discardReasons: RegionDiscardReason[];
};

export type RegionFlowResult = {
  regions: RegionFlowRegion[];
  discardedRegions: RegionFlowDiscardedRegion[];
  visibleLines: string[];
  visibleLineCount: number;
  totalCapacity: number;
  usableRegionCount: number;
  consumedRegionCount: number;
  discardedRegionCount: number;
  overflow: boolean;
  remainingLines: string[];
  remainingLineCount: number;
};
