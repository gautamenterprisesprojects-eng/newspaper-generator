import { placeImage } from "./ImagePlacementEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const storyBounds = {
  x: 18,
  y: 120,
  width: 864,
  height: 360,
};

const lead = placeImage({
  storyBounds,
  columnCount: 6,
  columnGap: 14,
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "top-right",
    imageColumnSpan: 3,
    imageHeight: 180,
    imageHeightMode: "auto",
    imageHeightPreset: "medium",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "newspaper",
  },
});

assert(lead.imageRect !== null, "enabled image must produce a rectangle");
assert(lead.wrapRect !== null, "newspaper wrap must produce a wrap rectangle");
assert(lead.imageRect!.x > storyBounds.x, "right image must move to right columns");
assert(lead.imageRect!.width < storyBounds.width, "right image must not occupy full story width");
assert(lead.imageRect!.height === 180, "image height must come from story setting");
assert(lead.imageRect!.y === storyBounds.y, "top-right image must align to story top");

const top = placeImage({
  storyBounds,
  columnCount: 2,
  columnGap: 14,
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "top-left",
    imageColumnSpan: 2,
    imageHeight: 72,
    imageHeightMode: "auto",
    imageHeightPreset: "tiny",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "rectangular",
  },
});

assert(top.imageRect?.y === storyBounds.y, "top image must align to story top");
assert(top.imageRect?.x === storyBounds.x, "top-left image must align to first column");
assert(top.imageRect?.height === 72, "top image height must remain shallow");

const disabled = placeImage({
  storyBounds,
  columnCount: 3,
  columnGap: 14,
  imageSettings: {
    imageEnabled: false,
    imageAlignment: "right",
    imageColumnSpan: 2,
    imageHeight: 120,
    imageHeightMode: "fixed",
    imageHeightPreset: "small",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "newspaper",
  },
});

assert(disabled.imageRect === null, "disabled image must not produce image rectangle");
assert(disabled.wrapRect === null, "disabled image must not produce wrap rectangle");

const noWrap = placeImage({
  storyBounds,
  columnCount: 3,
  columnGap: 14,
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "left",
    imageColumnSpan: 1,
    imageHeight: 100,
    imageHeightMode: "fixed",
    imageHeightPreset: "custom",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "none",
  },
});

assert(noWrap.imageRect !== null, "none wrap image should still render");
assert(noWrap.wrapRect === null, "none wrap mode must not create a wrap rectangle");

console.info("ImagePlacementTests passed");
