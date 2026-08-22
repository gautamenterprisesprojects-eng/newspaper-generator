import type {
  NewspaperAsset,
  NewspaperAssetId,
  NewspaperDocument,
  NewspaperFrameObject,
} from "@/types/document";
import type {
  AssetImportDescriptor,
  AssetManagerFilter,
  AssetManagerStatus,
  AssetUsage,
  AssetWarning,
} from "./AssetManagerTypes";

const now = () => new Date().toISOString();

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createAssetHash = (parts: (string | number | undefined)[]) =>
  parts
    .join("|")
    .split("")
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
    .toString(16)
    .replace("-", "a");

const getFrameAssetId = (frame: NewspaperFrameObject) =>
  (frame.metadata.assetId as NewspaperAssetId | undefined) ?? null;

export const createAssetRecord = (descriptor: AssetImportDescriptor): NewspaperAsset => {
  const id = descriptor.id ?? createId("asset");
  const format = descriptor.format ?? descriptor.filename.split(".").pop()?.toLowerCase() ?? "unknown";
  const type: NewspaperAsset["type"] =
    format === "svg"
      ? "svg"
      : format === "pdf"
        ? "pdf"
        : ["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"].includes(format)
          ? "image"
          : "other";

  return {
    id,
    type,
    name: descriptor.name,
    filename: descriptor.filename,
    originalFilename: descriptor.originalFilename ?? descriptor.filename,
    hash: createAssetHash([descriptor.filename, descriptor.size, descriptor.width, descriptor.height, descriptor.modifiedAt]),
    size: descriptor.size,
    width: descriptor.width,
    height: descriptor.height,
    resolution:
      descriptor.width && descriptor.height
        ? {
            width: descriptor.width,
            height: descriptor.height,
          }
        : undefined,
    dpi: descriptor.dpi ?? 72,
    colorSpace: descriptor.colorSpace ?? "RGB",
    format,
    createdAt: now(),
    modifiedAt: descriptor.modifiedAt ?? now(),
    credit: "",
    photographer: "",
    caption: "",
    keywords: [],
    section: descriptor.section ?? "",
    tags: descriptor.tags ?? [],
    usageCount: 0,
    linkedFrames: [],
    linkMode: descriptor.linkMode ?? "embedded",
    linkStatus: "ok",
    thumbnailUrl: descriptor.thumbnailUrl ?? descriptor.source,
    previewUrl: descriptor.previewUrl ?? descriptor.source,
    source: descriptor.source,
    metadata: {},
  };
};

export const importAssets = (
  document: NewspaperDocument,
  descriptors: AssetImportDescriptor[],
): NewspaperDocument => {
  const assets = descriptors.map(createAssetRecord);

  return {
    ...document,
    assets: {
      ...document.assets,
      ...Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    },
  };
};

export const getAssetUsages = (
  document: NewspaperDocument,
  assetId: NewspaperAssetId,
): AssetUsage[] =>
  document.pages.flatMap((page) =>
    page.frameIds.flatMap((frameId) => {
      const frame = document.frames[frameId];
      const story = frame?.storyId ? document.stories[frame.storyId] : null;
      const frameAssetId = frame ? getFrameAssetId(frame) : null;
      const storyAssetId = story?.photo ?? null;

      if (!frame || (frameAssetId !== assetId && storyAssetId !== assetId)) {
        return [];
      }

      return [{
        assetId,
        pageId: page.id,
        pageNumber: page.pageNumber,
        frameId,
        storyId: frame.storyId ?? null,
        layer: frame.zIndex,
      }];
    }),
  );

export const refreshAssetUsage = (document: NewspaperDocument): NewspaperDocument => {
  const assets = Object.fromEntries(
    Object.entries(document.assets).map(([assetId, asset]) => {
      const usages = getAssetUsages(document, assetId);

      return [
        assetId,
        {
          ...asset,
          usageCount: usages.length,
          linkedFrames: usages.map((usage) => usage.frameId),
          lastUsedAt: usages.length > 0 ? asset.lastUsedAt ?? now() : asset.lastUsedAt,
        },
      ];
    }),
  );

  return {
    ...document,
    assets,
  };
};

export const placeAssetInFrame = ({
  document,
  assetId,
  frameId,
  keepCrop = true,
}: {
  document: NewspaperDocument;
  assetId: NewspaperAssetId;
  frameId: string;
  keepCrop?: boolean;
}): NewspaperDocument => {
  const frame = document.frames[frameId];
  const asset = document.assets[assetId];

  if (!frame || !asset) {
    return document;
  }

  const nextFrames = {
    ...document.frames,
    [frameId]: {
      ...frame,
      frameType: frame.frameType === "article" ? frame.frameType : ("image" as const),
      metadata: {
        ...frame.metadata,
        assetId,
        imageFit: (frame.metadata.imageFit as string | undefined) ?? "cover",
        keepCrop,
        updatedAt: now(),
      },
    },
  };
  const nextStories = frame.storyId && document.stories[frame.storyId]
    ? {
        ...document.stories,
        [frame.storyId]: {
          ...document.stories[frame.storyId],
          photo: assetId,
        },
      }
    : document.stories;
  const nextPages = document.pages.map((page) =>
    page.frameIds.includes(frameId)
      ? {
          ...page,
          photos: [...new Set([...page.photos, assetId])],
          updatedAt: now(),
        }
      : page,
  );

  return refreshAssetUsage({
    ...document,
    frames: nextFrames,
    stories: nextStories,
    pages: nextPages,
  });
};

export const setAssetLinkStatus = (
  document: NewspaperDocument,
  assetId: NewspaperAssetId,
  linkStatus: NonNullable<NewspaperAsset["linkStatus"]>,
): NewspaperDocument => {
  const asset = document.assets[assetId];

  if (!asset) {
    return document;
  }

  return {
    ...document,
    assets: {
      ...document.assets,
      [assetId]: {
        ...asset,
        linkStatus,
        modifiedAt: now(),
      },
    },
  };
};

export const relinkAsset = (
  document: NewspaperDocument,
  assetId: NewspaperAssetId,
  source: string,
): NewspaperDocument => {
  const asset = document.assets[assetId];

  if (!asset) {
    return document;
  }

  return {
    ...document,
    assets: {
      ...document.assets,
      [assetId]: {
        ...asset,
        source,
        previewUrl: source,
        thumbnailUrl: source,
        linkStatus: "ok",
        modifiedAt: now(),
      },
    },
  };
};

export const deleteAsset = (
  document: NewspaperDocument,
  assetId: NewspaperAssetId,
): NewspaperDocument => {
  const assets = { ...document.assets };

  delete assets[assetId];

  const frames = Object.fromEntries(
    Object.entries(document.frames).map(([frameId, frame]) => [
      frameId,
      getFrameAssetId(frame) === assetId
        ? {
            ...frame,
            metadata: {
              ...frame.metadata,
              assetId: undefined,
              updatedAt: now(),
            },
          }
        : frame,
    ]),
  );
  const stories = Object.fromEntries(
    Object.entries(document.stories).map(([storyId, story]) => [
      storyId,
      story.photo === assetId ? { ...story, photo: null } : story,
    ]),
  );

  return refreshAssetUsage({
    ...document,
    assets,
    frames,
    stories,
    pages: document.pages.map((page) => ({
      ...page,
      photos: page.photos.filter((photoId) => photoId !== assetId),
    })),
  });
};

export const getAssetWarnings = (
  document: NewspaperDocument,
  minimumDpi = 200,
): AssetWarning[] =>
  Object.values(document.assets).flatMap((asset) => {
    const warnings: AssetWarning[] = [];

    if ((asset.usageCount ?? getAssetUsages(document, asset.id).length) === 0) {
      warnings.push({ assetId: asset.id, type: "unused", message: "Asset is not used on any page." });
    }

    if (asset.linkStatus === "missing") {
      warnings.push({ assetId: asset.id, type: "missing", message: "Linked asset is missing." });
    }

    if (asset.linkStatus === "broken") {
      warnings.push({ assetId: asset.id, type: "broken", message: "Linked asset path is broken." });
    }

    if (asset.type === "image" && (asset.dpi ?? 72) < minimumDpi) {
      warnings.push({ assetId: asset.id, type: "low-dpi", message: `Image is below ${minimumDpi} DPI.` });
    }

    if (asset.type === "image" && asset.colorSpace && asset.colorSpace !== "CMYK" && asset.usageCount && asset.usageCount > 0) {
      warnings.push({ assetId: asset.id, type: "wrong-color-space", message: "Placed image is not CMYK." });
    }

    return warnings;
  });

export const filterAssets = (
  document: NewspaperDocument,
  filter: AssetManagerFilter,
): NewspaperAsset[] => {
  const warnings = getAssetWarnings(document);
  const warningByAsset = new Map(warnings.map((warning) => [warning.assetId, warning]));
  const query = filter.query.trim().toLowerCase();

  return Object.values(document.assets)
    .filter((asset) => {
      if (filter.type !== "all" && asset.type !== filter.type) {
        return false;
      }

      const usageCount = asset.usageCount ?? getAssetUsages(document, asset.id).length;

      if (filter.usage === "used" && usageCount === 0) {
        return false;
      }
      if (filter.usage === "unused" && usageCount > 0) {
        return false;
      }
      if (filter.usage === "missing" && asset.linkStatus !== "missing") {
        return false;
      }
      if (filter.usage === "broken" && asset.linkStatus !== "broken") {
        return false;
      }
      if (filter.usage === "recent" && !asset.lastUsedAt) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        asset.name,
        asset.filename,
        asset.originalFilename,
        asset.caption,
        asset.credit,
        asset.photographer,
        asset.section,
        asset.type,
        ...(asset.tags ?? []),
        ...(asset.keywords ?? []),
        warningByAsset.get(asset.id)?.type,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    })
    .sort((first, second) => (second.modifiedAt ?? "").localeCompare(first.modifiedAt ?? ""));
};

export const getAssetManagerStatus = (document: NewspaperDocument): AssetManagerStatus => {
  const assets = Object.values(document.assets);
  const warnings = getAssetWarnings(document);
  const hasWarning = (assetId: NewspaperAssetId, type: string) =>
    warnings.some((warning) => warning.assetId === assetId && warning.type === type);

  return {
    total: assets.length,
    images: assets.filter((asset) => asset.type === "image").length,
    logos: assets.filter((asset) => asset.type === "logo").length,
    advertisements: assets.filter((asset) => asset.type === "advertisement").length,
    graphics: assets.filter((asset) => asset.type === "graphic" || asset.type === "svg").length,
    recentlyUsed: assets.filter((asset) => asset.lastUsedAt).length,
    unused: assets.filter((asset) => (asset.usageCount ?? getAssetUsages(document, asset.id).length) === 0).length,
    missing: assets.filter((asset) => hasWarning(asset.id, "missing")).length,
    broken: assets.filter((asset) => hasWarning(asset.id, "broken")).length,
  };
};
