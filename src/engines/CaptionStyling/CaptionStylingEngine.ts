import type {
  ArticleCaptionData,
  CaptionPresetName,
  CaptionTextStyle,
  CaptionLabelStyle,
} from "@/types/editor";

export type CaptionPreset = {
  name: CaptionPresetName;
  label: string;
  captionStyle: CaptionTextStyle;
  creditStyle: CaptionTextStyle;
  labelStyle: CaptionLabelStyle;
};

export const defaultCaptionStyle: CaptionTextStyle = {
  fontSize: 9.5,
  fontWeight: 600,
  color: "#333333", // ~80% black
  backgroundColor: "transparent",
};

export const defaultCreditStyle: CaptionTextStyle = {
  fontSize: 7.6,
  fontWeight: 600,
  color: "#3f3a34",
  backgroundColor: "transparent",
};

export const defaultCaptionLabelStyle: CaptionLabelStyle = {
  color: "#ffffff",
  backgroundColor: "#111111",
  fontWeight: 800,
  padding: 2,
  borderRadius: 1,
};

export const captionPresets: CaptionPreset[] = [
  {
    name: "classic-newspaper",
    label: "Classic Newspaper",
    captionStyle: defaultCaptionStyle,
    creditStyle: defaultCreditStyle,
    labelStyle: defaultCaptionLabelStyle,
  },
  {
    name: "modern-newspaper",
    label: "Modern Newspaper",
    captionStyle: {
      ...defaultCaptionStyle,
      color: "#333333",
      backgroundColor: "#f1f1f1",
    },
    creditStyle: {
      ...defaultCreditStyle,
      color: "#555555",
    },
    labelStyle: {
      ...defaultCaptionLabelStyle,
      backgroundColor: "#4b4b4b",
    },
  },
  {
    name: "magazine",
    label: "Magazine",
    captionStyle: {
      ...defaultCaptionStyle,
      fontSize: 9.5,
      color: "#2d1825",
      backgroundColor: "#f8e9f1",
    },
    creditStyle: {
      ...defaultCreditStyle,
      color: "#6a1b9a",
    },
    labelStyle: {
      ...defaultCaptionLabelStyle,
      backgroundColor: "#6a1b9a",
      borderRadius: 3,
    },
  },
  {
    name: "photo-story",
    label: "Photo Story",
    captionStyle: {
      ...defaultCaptionStyle,
      fontSize: 10,
      fontWeight: 600,
      color: "#ffffff",
      backgroundColor: "#111111",
    },
    creditStyle: {
      ...defaultCreditStyle,
      color: "#ffffff",
      backgroundColor: "#111111",
    },
    labelStyle: {
      ...defaultCaptionLabelStyle,
      color: "#111111",
      backgroundColor: "#fdd835",
    },
  },
  {
    name: "breaking-news",
    label: "Breaking News",
    captionStyle: {
      ...defaultCaptionStyle,
      fontWeight: 700,
      color: "#ffffff",
      backgroundColor: "#b42318",
    },
    creditStyle: {
      ...defaultCreditStyle,
      color: "#ffffff",
      backgroundColor: "#9f1d17",
    },
    labelStyle: {
      ...defaultCaptionLabelStyle,
      backgroundColor: "#7a1e16",
    },
  },
  {
    name: "minimal",
    label: "Minimal",
    captionStyle: {
      ...defaultCaptionStyle,
      color: "#6d675d",
    },
    creditStyle: {
      ...defaultCreditStyle,
      fontWeight: 400,
      color: "#8c8376",
    },
    labelStyle: {
      ...defaultCaptionLabelStyle,
      color: "#6d675d",
      backgroundColor: "transparent",
    },
  },
];

export const getCaptionPreset = (name: CaptionPresetName) =>
  captionPresets.find((preset) => preset.name === name) ?? captionPresets[0];

export const createDefaultCaptionData = (text = ""): ArticleCaptionData => ({
  enabled: true,
  text,
  creditText: "",
  photographer: "",
  agency: "",
  source: "",
  showCredit: false,
  showSource: false,
  alignment: "left",
  position: "below-image",
  creditPosition: "below-caption",
  preset: "classic-newspaper",
  captionStyle: {
    ...defaultCaptionStyle,
  },
  creditStyle: {
    ...defaultCreditStyle,
  },
  labelStyle: {
    ...defaultCaptionLabelStyle,
  },
  labels: {
    caption: "चित्र:",
    credit: "फोटो:",
    source: "Source:",
    agency: "Agency:",
  },
});

export const applyCaptionPreset = (
  caption: ArticleCaptionData,
  presetName: CaptionPresetName,
): ArticleCaptionData => {
  const preset = getCaptionPreset(presetName);

  return {
    ...caption,
    preset: preset.name,
    captionStyle: {
      ...preset.captionStyle,
    },
    creditStyle: {
      ...preset.creditStyle,
    },
    labelStyle: {
      ...preset.labelStyle,
    },
  };
};

export const CaptionStylingEngine = {
  applyCaptionPreset,
  captionPresets,
  createDefaultCaptionData,
  getCaptionPreset,
};
