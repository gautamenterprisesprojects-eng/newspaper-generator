import {
  getBodyWhitespaceRatio,
  optimizeImageForEditorialQuality,
} from "./EditorialLayoutQualityEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const lead = optimizeImageForEditorialQuality({
  priority: "lead",
  storyHeight: 600,
  bodyHeight: 360,
  columnCount: 6,
  bodyText: "प्रदेश ".repeat(180),
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "top",
    imageColumnSpan: 6,
    imageHeight: 240,
    imageHeightMode: "auto",
    imageHeightPreset: "medium",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "newspaper",
  },
});

assert(lead.imageSettings.imageColumnSpan === 6, "lead image span may use all story columns");
assert(lead.imageSettings.imageAlignment === "top-right", "lead top image must become top-right");
assert(lead.imageSettings.imageHeight <= 240, "lead auto image height must respect protection");
assert(lead.adjusted, "lead image optimization must report adjustments");

const lockedLead = optimizeImageForEditorialQuality({
  priority: "lead",
  storyHeight: 600,
  bodyHeight: 360,
  columnCount: 6,
  bodyText: "प्रदेश ".repeat(80),
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "top",
    imageColumnSpan: 6,
    imageHeight: 240,
    imageHeightMode: "fixed",
    imageHeightPreset: "large",
    imageHeightProtection: true,
    autoSizeImage: false,
    imageWrapMode: "newspaper",
  },
});

assert(lockedLead.imageSettings.imageColumnSpan === 6, "locked image must preserve span");
assert(lockedLead.imageSettings.imageAlignment === "top", "locked image must preserve alignment");
assert(lockedLead.imageSettings.imageHeight === 240, "locked image must preserve height");

const boundedLocked = optimizeImageForEditorialQuality({
  priority: "major",
  storyHeight: 320,
  bodyHeight: 220,
  columnCount: 2,
  bodyText: "प्रदेश ".repeat(40),
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "right",
    imageColumnSpan: 6,
    imageHeight: 600,
    imageHeightMode: "fixed",
    imageHeightPreset: "custom",
    imageHeightProtection: false,
    autoSizeImage: false,
    imageWrapMode: "newspaper",
  },
});

assert(
  boundedLocked.imageSettings.imageColumnSpan === 2,
  "locked span must still stay inside story columns",
);
assert(
  boundedLocked.imageSettings.imageHeight === 219,
  "locked image height must still stay inside story bounds",
);

const protectedFixed = optimizeImageForEditorialQuality({
  priority: "major",
  storyHeight: 500,
  bodyHeight: 420,
  columnCount: 4,
  bodyText: "प्रदेश ".repeat(40),
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "right",
    imageColumnSpan: 2,
    imageHeight: 300,
    imageHeightMode: "fixed",
    imageHeightPreset: "xl",
    imageHeightProtection: true,
    autoSizeImage: false,
    imageWrapMode: "newspaper",
  },
});

assert(
  protectedFixed.imageSettings.imageHeight === 200,
  "newspaper wrap protection must cap image height at 40% story height",
);

const secondary = optimizeImageForEditorialQuality({
  priority: "secondary",
  storyHeight: 320,
  bodyHeight: 300,
  columnCount: 2,
  bodyText: "प्रदेश ".repeat(80),
  imageSettings: {
    imageEnabled: true,
    imageAlignment: "top",
    imageColumnSpan: 2,
    imageHeight: 72,
    imageHeightMode: "auto",
    imageHeightPreset: "tiny",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "rectangular",
  },
});

assert(
  secondary.imageSettings.imageAlignment === "top-left",
  "secondary top image must anchor to top-left",
);
assert(secondary.imageSettings.imageColumnSpan === 2, "secondary span must remain valid");

const noImage = optimizeImageForEditorialQuality({
  priority: "brief",
  storyHeight: 180,
  bodyHeight: 160,
  columnCount: 1,
  bodyText: "",
  imageSettings: {
    imageEnabled: false,
    imageAlignment: "top-left",
    imageColumnSpan: 1,
    imageHeight: 40,
    imageHeightMode: "auto",
    imageHeightPreset: "tiny",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "none",
  },
});

assert(!noImage.adjusted, "disabled images must not be adjusted");
assert(noImage.imageSettings.imageEnabled === false, "disabled images must remain disabled");

assert(
  getBodyWhitespaceRatio({
    totalCapacity: 100,
    visibleLineCount: 80,
    remainingLineCount: 0,
  }) === 0.2,
  "body whitespace must be calculated from unused capacity",
);
assert(
  getBodyWhitespaceRatio({
    totalCapacity: 100,
    visibleLineCount: 100,
    remainingLineCount: 30,
  }) === 0,
  "overset body text must not report layout whitespace",
);

console.info("EditorialLayoutQualityTests passed");
