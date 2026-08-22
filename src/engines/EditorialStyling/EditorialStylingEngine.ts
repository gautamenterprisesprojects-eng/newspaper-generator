import type {
  EditorialInlineLabelStyle,
  EditorialStylePresetName,
  FactBoxTheme,
  FactBoxThemeName,
  PullQuoteTheme,
  PullQuoteThemeName,
  SubheadlineBannerStyle,
} from "@/types/editor";

export type NewsroomColor = {
  label: string;
  value: string;
};

export const newsroomColorPalette: NewsroomColor[] = [
  { label: "Black", value: "#111111" },
  { label: "Dark Gray", value: "#4b4b4b" },
  { label: "Light Gray", value: "#d7d7d7" },
  { label: "Red", value: "#d32f2f" },
  { label: "Dark Red", value: "#9f1d17" },
  { label: "Maroon", value: "#7a1e2c" },
  { label: "Blue", value: "#1976d2" },
  { label: "Navy", value: "#153e75" },
  { label: "Green", value: "#388e3c" },
  { label: "Orange", value: "#f57c00" },
  { label: "Teal", value: "#00695c" },
  { label: "Purple", value: "#6a1b9a" },
  { label: "Brown", value: "#795548" },
  { label: "White", value: "#ffffff" },
];

export const defaultInlineLabelStyle: EditorialInlineLabelStyle = {
  color: "#ffffff",
  backgroundColor: "#b42318",
  padding: 5,
  borderRadius: 2,
  fontSize: 10,
  fontWeight: 800,
  alignment: "left",
};

export const defaultSubheadlineBannerStyle: SubheadlineBannerStyle = {
  mode: "none",
  textColor: "#3f3a34",
  backgroundColor: "#f4e5d0",
  padding: 4,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#b8a98d",
  backgroundOpacity: 1,
};

const factBoxThemes: Record<FactBoxThemeName, FactBoxTheme> = {
  "classic-gray": {
    name: "classic-gray",
    background: "#f1eee7",
    border: "#b9b0a2",
    headerColor: "#17130f",
    bulletColor: "#565046",
    textColor: "#3e3932",
  },
  red: {
    name: "red",
    background: "#fff1ee",
    border: "#c24132",
    headerColor: "#9f1d17",
    bulletColor: "#b42318",
    textColor: "#3d2521",
  },
  blue: {
    name: "blue",
    background: "#edf5ff",
    border: "#2563eb",
    headerColor: "#153e75",
    bulletColor: "#1976d2",
    textColor: "#25364a",
  },
  green: {
    name: "green",
    background: "#edf7ee",
    border: "#388e3c",
    headerColor: "#166534",
    bulletColor: "#2f7d32",
    textColor: "#233a25",
  },
  orange: {
    name: "orange",
    background: "#fff3e3",
    border: "#f57c00",
    headerColor: "#b45309",
    bulletColor: "#d86d00",
    textColor: "#45301d",
  },
  custom: {
    name: "custom",
    background: "#fff6dc",
    border: "#b99546",
    headerColor: "#111111",
    bulletColor: "#6b4f1d",
    textColor: "#30291d",
  },
};

const pullQuoteThemes: Record<PullQuoteThemeName, PullQuoteTheme> = {
  classic: {
    name: "classic",
    textColor: "#1d1710",
    backgroundColor: "#fff6dc",
    borderColor: "#b99546",
    quoteMarkColor: "#b99546",
  },
  modern: {
    name: "modern",
    textColor: "#111111",
    backgroundColor: "#eef2f5",
    borderColor: "#4b5563",
    quoteMarkColor: "#4b5563",
  },
  magazine: {
    name: "magazine",
    textColor: "#421a31",
    backgroundColor: "#f8e9f1",
    borderColor: "#b63f73",
    quoteMarkColor: "#b63f73",
  },
  breaking: {
    name: "breaking",
    textColor: "#ffffff",
    backgroundColor: "#b42318",
    borderColor: "#7a1e16",
    quoteMarkColor: "#ffd6cc",
  },
  minimal: {
    name: "minimal",
    textColor: "#181512",
    backgroundColor: "#fffdf8",
    borderColor: "#d1c8b8",
    quoteMarkColor: "#8c8376",
  },
};

export type EditorialStylePreset = {
  name: EditorialStylePresetName;
  label: string;
  kickerStyle: EditorialInlineLabelStyle;
  strapStyle: EditorialInlineLabelStyle;
  subheadlineBanner: SubheadlineBannerStyle;
  factBoxTheme: FactBoxTheme;
  pullQuoteTheme: PullQuoteTheme;
};

export const getFactBoxTheme = (name: FactBoxThemeName): FactBoxTheme => ({
  ...factBoxThemes[name],
});

export const getPullQuoteTheme = (name: PullQuoteThemeName): PullQuoteTheme => ({
  ...pullQuoteThemes[name],
});

export const editorialStylePresets: EditorialStylePreset[] = [
  {
    name: "none",
    label: "None",
    kickerStyle: defaultInlineLabelStyle,
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#153e75",
    },
    subheadlineBanner: defaultSubheadlineBannerStyle,
    factBoxTheme: getFactBoxTheme("classic-gray"),
    pullQuoteTheme: getPullQuoteTheme("classic"),
  },
  {
    name: "breaking-news",
    label: "Breaking News",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#b42318",
      fontWeight: 900,
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#153e75",
      fontWeight: 900,
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "banner",
      textColor: "#ffffff",
      backgroundColor: "#b42318",
      padding: 5,
    },
    factBoxTheme: getFactBoxTheme("red"),
    pullQuoteTheme: getPullQuoteTheme("breaking"),
  },
  {
    name: "political",
    label: "Political",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      backgroundColor: "#153e75",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#4b5563",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "solid",
      textColor: "#153e75",
      backgroundColor: "#edf5ff",
      borderWidth: 1,
      borderColor: "#2563eb",
    },
    factBoxTheme: getFactBoxTheme("blue"),
    pullQuoteTheme: getPullQuoteTheme("modern"),
  },
  {
    name: "sports",
    label: "Sports",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      backgroundColor: "#166534",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#111111",
      backgroundColor: "#d7f5dd",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "rounded",
      textColor: "#166534",
      backgroundColor: "#edf7ee",
      borderRadius: 3,
    },
    factBoxTheme: getFactBoxTheme("green"),
    pullQuoteTheme: getPullQuoteTheme("classic"),
  },
  {
    name: "business",
    label: "Business",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      backgroundColor: "#795548",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#4b4b4b",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "solid",
      textColor: "#3a2a20",
      backgroundColor: "#f3ebe3",
    },
    factBoxTheme: getFactBoxTheme("orange"),
    pullQuoteTheme: getPullQuoteTheme("minimal"),
  },
  {
    name: "feature",
    label: "Feature",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      backgroundColor: "#6a1b9a",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#421a31",
      backgroundColor: "#f8e9f1",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "rounded",
      textColor: "#421a31",
      backgroundColor: "#f8e9f1",
      borderRadius: 4,
    },
    factBoxTheme: getFactBoxTheme("custom"),
    pullQuoteTheme: getPullQuoteTheme("magazine"),
  },
  {
    name: "magazine",
    label: "Magazine",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#421a31",
      borderRadius: 4,
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#421a31",
      backgroundColor: "#f8e9f1",
      borderRadius: 4,
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "rounded",
      textColor: "#421a31",
      backgroundColor: "#f8e9f1",
      borderRadius: 5,
    },
    factBoxTheme: getFactBoxTheme("custom"),
    pullQuoteTheme: getPullQuoteTheme("magazine"),
  },
  {
    name: "editorial",
    label: "Editorial",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#111111",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#111111",
      backgroundColor: "#d7d7d7",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "solid",
      textColor: "#111111",
      backgroundColor: "#eeeeee",
      borderWidth: 1,
      borderColor: "#4b4b4b",
    },
    factBoxTheme: getFactBoxTheme("classic-gray"),
    pullQuoteTheme: getPullQuoteTheme("minimal"),
  },
  {
    name: "opinion",
    label: "Opinion",
    kickerStyle: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#7a1e2c",
    },
    strapStyle: {
      ...defaultInlineLabelStyle,
      color: "#7a1e2c",
      backgroundColor: "#f8e2e6",
    },
    subheadlineBanner: {
      ...defaultSubheadlineBannerStyle,
      mode: "rounded",
      textColor: "#7a1e2c",
      backgroundColor: "#f8e2e6",
      borderRadius: 3,
    },
    factBoxTheme: getFactBoxTheme("red"),
    pullQuoteTheme: getPullQuoteTheme("classic"),
  },
];

export const getEditorialStylePreset = (name: EditorialStylePresetName) =>
  editorialStylePresets.find((preset) => preset.name === name) ?? editorialStylePresets[0];

export const EditorialStylingEngine = {
  editorialStylePresets,
  getEditorialStylePreset,
  getFactBoxTheme,
  getPullQuoteTheme,
  newsroomColorPalette,
};
