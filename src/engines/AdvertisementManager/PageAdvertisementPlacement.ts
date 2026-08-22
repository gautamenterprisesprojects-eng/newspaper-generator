/**
 * PageAdvertisementPlacement
 *
 * Lets one or more advertisements be embedded in a REGULAR page (front/
 * inside/editorial), not just the dedicated Advertisement Page. Reuses the
 * exact primitives AdvertisementPagePanel already uses for its own
 * generation — AdResidualSpaceFiller for the remaining editorial space, and
 * the same bottom-right shelf-packing order — so there is no second
 * implementation of "how ads occupy a page" to keep in sync.
 *
 * Deliberately returns the ads' story-frame PARAMS rather than calling
 * editorStore's own createStoryFrame directly: this module is imported BY
 * editorStore.ts (to compute the ads' layout during generation), so
 * importing createStoryFrame back from there would be a circular import.
 * The type-only import below carries createStoryFrame's exact parameter
 * shape without pulling in the runtime module.
 *
 * Placement: shelf-packed from the bottom-right corner of the page's content
 * area — largest ad first, each new ad placed to the left of the last, and
 * wrapping up to a new shelf once a row runs out of room — matching
 * AdvertisementPagePanel's own default ("Professional Newspaper" / "Bottom
 * Heavy") arrangeAds order exactly.
 */

import type { createStoryFrame } from "@/store/editorStore";
import { prototypeArticle } from "@/data/prototypeArticle";
import type { StoryFrame } from "@/types/editor";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";
import {
  computeAdResidualRects,
  buildAdResidualSlots,
} from "./AdResidualSpaceFiller";

const CONTENT_W_DEFAULT = DEFAULT_PAGE_MASTER.contentWidth * POINTS_PER_INCH;
const CONTENT_H_DEFAULT = DEFAULT_PAGE_MASTER.contentHeight * POINTS_PER_INCH;
const COL_COUNT = DEFAULT_PAGE_MASTER.columns;
const GUTTER = DEFAULT_PAGE_MASTER.gutter * POINTS_PER_INCH;
const COL_W = (CONTENT_W_DEFAULT - GUTTER * (COL_COUNT - 1)) / COL_COUNT;

/** Same standard newspaper ad sizes AdvertisementPagePanel offers. */
export const PAGE_AD_PRESETS: Record<string, { widthPt: number; heightPt: number; label: string }> = {
  "1-col": { widthPt: COL_W, heightPt: COL_W * 1.4, label: "1 Column" },
  "2-col": { widthPt: COL_W * 2 + GUTTER, heightPt: COL_W * 1.4, label: "2 Column" },
  "3-col": { widthPt: COL_W * 3 + GUTTER * 2, heightPt: COL_W * 1.4, label: "3 Column" },
  quarter: { widthPt: CONTENT_W_DEFAULT / 2, heightPt: CONTENT_H_DEFAULT / 4, label: "Quarter Page" },
  "vertical-strip": { widthPt: COL_W, heightPt: CONTENT_H_DEFAULT * 0.6, label: "Vertical Strip" },
  "horizontal-strip": { widthPt: CONTENT_W_DEFAULT, heightPt: COL_W * 0.8, label: "Horizontal Strip" },
  banner: { widthPt: CONTENT_W_DEFAULT, heightPt: COL_W * 0.6, label: "Banner" },
  island: { widthPt: COL_W * 2 + GUTTER, heightPt: COL_W * 2, label: "Island" },
};

export const PAGE_AD_PRESET_ORDER = [
  "1-col",
  "2-col",
  "3-col",
  "vertical-strip",
  "horizontal-strip",
  "banner",
  "island",
  "quarter",
] as const;

export type PageAdvertisement = {
  /** Stable per-ad id, assigned at upload time — lets the wizard target one ad among several for preset changes/removal, and keeps each generated story frame's id unique. */
  id: string;
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  presetKey: keyof typeof PAGE_AD_PRESETS;
};

/**
 * Computes each ad's bottom-right-shelf-packed placement rect, the residual
 * editorial slots around all of them, and each ad's own synthetic story
 * frame — ready to pass straight into importNewswireStories'
 * customLayout/customStories options for the given page's own content
 * bounds (front/inside/editorial each reserve a different header band, so
 * contentBounds must be that page's own, not the generic default).
 */
export const buildPageAdvertisementsLayout = (
  ads: PageAdvertisement[],
  contentBounds: { x: number; y: number; width: number; height: number },
  maxArticleSlots: number,
) => {
  const sized = ads.map((ad) => {
    const preset = PAGE_AD_PRESETS[ad.presetKey] ?? PAGE_AD_PRESETS["2-col"]!;
    return {
      ad,
      width: Math.min(preset.widthPt, contentBounds.width),
      height: Math.min(preset.heightPt, contentBounds.height),
    };
  });

  // Shelf-pack from the bottom-right corner, largest first: each ad goes to
  // the left of the previous one, wrapping up to a new shelf once a row runs
  // out of room. Mirrors AdvertisementPagePanel's own arrangeAds exactly, so
  // multiple ads on a regular page read the same way they would on the
  // dedicated Advertisement Page.
  const sortedByArea = [...sized].sort((a, b) => b.width * b.height - a.width * a.height);
  let cursorX = contentBounds.x + contentBounds.width;
  let cursorY = contentBounds.y + contentBounds.height;
  const placed: Array<{ ad: PageAdvertisement; x: number; y: number; width: number; height: number }> = [];

  for (const { ad, width, height } of sortedByArea) {
    let adX = cursorX - width;
    let adY = cursorY - height;
    adX = Math.max(contentBounds.x, Math.min(adX, contentBounds.x + contentBounds.width - width));
    adY = Math.max(contentBounds.y, Math.min(adY, contentBounds.y + contentBounds.height - height));

    placed.push({ ad, x: adX, y: adY, width, height });

    cursorX = adX;
    if (cursorX - width < contentBounds.x) {
      cursorX = contentBounds.x + contentBounds.width;
      cursorY = adY;
    }
  }

  const residualRects = computeAdResidualRects(
    placed.map((p) => ({ placedX: p.x, placedY: p.y, displayWidthPt: p.width, displayHeightPt: p.height, placed: true })),
    contentBounds.x,
    contentBounds.y,
    contentBounds.width,
    contentBounds.height,
  );
  const adResidualSlots = buildAdResidualSlots(
    residualRects.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
    contentBounds.x,
    COL_W,
    GUTTER,
    maxArticleSlots,
  );

  const customLayoutSlots = adResidualSlots.map((slot, index) => ({
    storyNumber: index + 1,
    priority: index === 0 ? "lead" : "secondary",
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    columnStart: slot.columnStart,
    columnSpan: slot.columnSpan,
    internalTextColumns: slot.internalTextColumns,
    isAdResidualSpace: slot.isAdResidualSpace,
  }));

  const adStoryFrameParamsList: Array<Parameters<typeof createStoryFrame>[0]> = placed.map(({ ad, x, y, width, height }) => {
    const colStart = Math.min(
      COL_COUNT,
      Math.max(1, Math.round((x - contentBounds.x) / (COL_W + GUTTER)) + 1),
    );
    const colSpan = Math.min(
      COL_COUNT,
      Math.max(1, Math.round((width + GUTTER) / (COL_W + GUTTER))),
    );

    return {
      id: `page-ad-${ad.id}`,
      role: "advertisement" as StoryFrame["role"],
      priority: "secondary",
      columnStart: colStart as StoryFrame["columnStart"],
      columnSpan: colSpan as StoryFrame["columnSpan"],
      x,
      y,
      width,
      height,
      imageEnabled: true,
      imageHeightMode: "fixed",
      imageHeight: height,
      imageColumnSpan: colSpan as StoryFrame["imageColumnSpan"],
      imageAlignment: "top-left",
      autoSizeImage: false,
      sourceWidth: ad.originalWidth,
      sourceHeight: ad.originalHeight,
      articleData: {
        ...prototypeArticle,
        headline: "",
        subheadline: "",
        body: "",
        author: "",
        imageUrl: ad.dataUrl,
        columnCount: 1,
        containerStyles: {
          ...prototypeArticle.containerStyles,
          backgroundOpacity: 0,
          borderWidth: 0,
        },
      } as StoryFrame["articleData"],
    };
  });

  return {
    customLayout: { slots: customLayoutSlots },
    adStoryFrameParamsList,
    articleSlotCount: customLayoutSlots.length,
  };
};
