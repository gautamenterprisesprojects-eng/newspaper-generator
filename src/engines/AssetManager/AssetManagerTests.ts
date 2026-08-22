import assert from "node:assert/strict";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { prototypeArticle } from "@/data/prototypeArticle";
import type { StoryFrame } from "@/types/editor";
import {
  deleteAsset,
  filterAssets,
  getAssetManagerStatus,
  getAssetUsages,
  getAssetWarnings,
  importAssets,
  placeAssetInFrame,
  relinkAsset,
  setAssetLinkStatus,
} from "./AssetManagerEngine";

const story = {
  id: "story-asset",
  x: 72,
  y: 90,
  width: 360,
  height: 520,
  role: "lead",
  priority: "lead",
  columnStart: 1,
  columnSpan: 6,
  imageEnabled: true,
  imageAlignment: "top-right",
  imageColumnSpan: 3,
  imageHeight: 180,
  imageHeightMode: "auto",
  imageHeightPreset: "medium",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "newspaper",
  headlineFontSize: 40,
  subheadlineFontSize: 16,
  bodyFontSize: 12.5,
  headlineLineHeight: 0.95,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1.08,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: true,
  forceFullWidthHeadlines: true,
  headlineLayoutMode: "newspaper-fill",
  articleData: prototypeArticle,
  compositionSettings: {
    showRegionDebug: false,
    bodyRendererMode: "line",
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  },
} as StoryFrame;

let document = createDocumentFromStoryFrames([story]);
document = importAssets(document, [
  {
    id: "asset-1",
    name: "City Drainage",
    filename: "city-drainage.jpg",
    size: 1024,
    width: 1200,
    height: 800,
    dpi: 72,
    colorSpace: "RGB",
    source: "data:image/jpeg;base64,test",
    tags: ["city", "monsoon"],
  },
]);

assert.equal(Object.keys(document.assets).length, 1);
assert.equal(getAssetManagerStatus(document).unused, 1);
assert.equal(filterAssets(document, { query: "monsoon", type: "all", usage: "all" }).length, 1);

const frameId = document.pages[0].frameIds[0];
document = placeAssetInFrame({ document, assetId: "asset-1", frameId });

assert.equal(document.stories["story-asset"].photo, "asset-1");
assert.equal(getAssetUsages(document, "asset-1").length, 1);
assert.equal(document.assets["asset-1"].usageCount, 1);
assert.ok(getAssetWarnings(document).some((warning) => warning.type === "low-dpi"));

document = setAssetLinkStatus(document, "asset-1", "missing");
assert.ok(getAssetWarnings(document).some((warning) => warning.type === "missing"));

document = relinkAsset(document, "asset-1", "data:image/jpeg;base64,next");
assert.equal(document.assets["asset-1"].linkStatus, "ok");

document = deleteAsset(document, "asset-1");
assert.equal(Object.keys(document.assets).length, 0);
assert.equal(document.stories["story-asset"].photo, null);

console.log("AssetManagerTests passed");
