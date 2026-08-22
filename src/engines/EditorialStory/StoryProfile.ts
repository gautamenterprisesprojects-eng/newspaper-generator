import type { StoryFrame, StoryFrameId, StoryPriority } from "@/types/editor";

export type StoryType =
  | "lead"
  | "brief"
  | "advertisement"
  | "photo"
  | "editorial"
  | "sports"
  | "standard";

export type StorySection =
  | "front"
  | "city"
  | "opinion"
  | "sports"
  | "business"
  | "features"
  | "classifieds"
  | "advertising"
  | "general";

export type StoryImageRules = {
  required: boolean;
  allowAutoCrop: boolean;
  preserveAspectRatio: boolean;
  minimumHeight: number;
  maximumHeight: number;
  preferredPlacement: "top" | "inline" | "dominant" | "none";
};

export type StoryHeadlineRules = {
  required: boolean;
  allowAutoFit: boolean;
  allowMultiDeck: boolean;
  minimumLines: number;
  maximumLines: number;
  tone: "news" | "feature" | "opinion" | "sports" | "advertisement";
};

export type StoryCaptionRules = {
  required: boolean;
  allowOverflow: boolean;
  maximumLines: number;
  requireCredit: boolean;
};

export type StoryProfile = {
  storyId: StoryFrameId;
  storyType: StoryType;
  section: StorySection;
  priority: StoryPriority;
  minimumColumns: number;
  preferredColumns: number;
  maximumColumns: number;
  grow: boolean;
  shrink: boolean;
  split: boolean;
  jump: boolean;
  imageRules: StoryImageRules;
  headlineRules: StoryHeadlineRules;
  captionRules: StoryCaptionRules;
  diagnostics: {
    classifier: "explicit" | "derived";
    reasons: string[];
  };
};

export type StoryProfileInput = {
  story: StoryFrame;
  storyType?: StoryType;
  section?: StorySection;
};

/** Creates an immutable copy of a StoryProfile for diagnostics pass-through. */
export const cloneStoryProfile = (profile: StoryProfile): StoryProfile => ({
  ...profile,
  imageRules: { ...profile.imageRules },
  headlineRules: { ...profile.headlineRules },
  captionRules: { ...profile.captionRules },
  diagnostics: {
    classifier: profile.diagnostics.classifier,
    reasons: [...profile.diagnostics.reasons],
  },
});

