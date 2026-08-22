import type {
  NewspaperAsset,
  NewspaperAssetId,
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperPageId,
  NewspaperStoryId,
} from "@/types/document";

export type AssetImportDescriptor = {
  id?: NewspaperAssetId;
  name: string;
  filename: string;
  originalFilename?: string;
  size: number;
  width?: number;
  height?: number;
  dpi?: number;
  colorSpace?: NewspaperAsset["colorSpace"];
  format?: string;
  source?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  modifiedAt?: string;
  linkMode?: NewspaperAsset["linkMode"];
  section?: string;
  tags?: string[];
};

export type AssetUsage = {
  assetId: NewspaperAssetId;
  pageId: NewspaperPageId;
  pageNumber: number;
  frameId: NewspaperFrameId;
  storyId: NewspaperStoryId | null;
  layer: number;
};

export type AssetWarningType =
  | "low-dpi"
  | "wrong-color-space"
  | "too-small"
  | "overscaled"
  | "unused"
  | "broken"
  | "missing";

export type AssetWarning = {
  assetId: NewspaperAssetId;
  type: AssetWarningType;
  message: string;
};

export type AssetManagerFilter = {
  query: string;
  type: NewspaperAsset["type"] | "all";
  usage: "all" | "used" | "unused" | "missing" | "broken" | "recent";
};

export type AssetManagerStatus = {
  total: number;
  images: number;
  logos: number;
  advertisements: number;
  graphics: number;
  recentlyUsed: number;
  unused: number;
  missing: number;
  broken: number;
};
