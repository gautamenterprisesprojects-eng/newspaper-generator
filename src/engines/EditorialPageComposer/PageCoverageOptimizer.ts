import type { ArticleBoxModel } from "@/types/editor";

export type PageContentBounds = ArticleBoxModel;

export type PageCoverageSlot = ArticleBoxModel & {
  id: string;
};

export type PageCoverageResult = {
  coverageRatio: number;
  uncoveredArea: number;
};

const rectsOverlap = (first: ArticleBoxModel, second: ArticleBoxModel) =>
  Math.max(first.x, second.x) < Math.min(first.x + first.width, second.x + second.width) - 0.001 &&
  Math.max(first.y, second.y) < Math.min(first.y + first.height, second.y + second.height) - 0.001;

export const calculatePageCoverage = (
  slots: PageCoverageSlot[],
  bounds: PageContentBounds,
): PageCoverageResult => {
  const contentArea = bounds.width * bounds.height;
  const occupiedArea = slots.reduce((sum, slot) => sum + slot.width * slot.height, 0);
  const coverageRatio = contentArea > 0 ? occupiedArea / contentArea : 0;

  return {
    coverageRatio,
    uncoveredArea: Math.max(0, contentArea - occupiedArea),
  };
};

export const hasOverlappingSlots = (slots: PageCoverageSlot[]) => {
  for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < slots.length; secondIndex += 1) {
      if (rectsOverlap(slots[firstIndex], slots[secondIndex])) {
        return true;
      }
    }
  }

  return false;
};

export const optimizePageCoverage = (
  slots: PageCoverageSlot[],
  bounds: PageContentBounds,
): PageCoverageSlot[] => {
  const bottom = bounds.y + bounds.height;
  const right = bounds.x + bounds.width;

  return slots.map((slot) => {
    const next = { ...slot };

    if (Math.abs(slot.y + slot.height - bottom) < 1) {
      next.height = bottom - slot.y;
    }

    if (Math.abs(slot.x + slot.width - right) < 1) {
      next.width = right - slot.x;
    }

    return next;
  });
};

export const PageCoverageOptimizer = {
  calculatePageCoverage,
  hasOverlappingSlots,
  optimizePageCoverage,
};
