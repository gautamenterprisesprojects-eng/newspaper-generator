import type { StoryPriority } from "@/types/editor";

export type EditorialSpacingInput = {
  priority: StoryPriority;
  headlineSize: number;
  hasSubheadline: boolean;
  hasImage: boolean;
  hasCaption: boolean;
  productionView?: boolean;
};

export type EditorialSpacingResult = {
  headlineToSubheadline: number;
  headlineToDateline: number;
  subheadlineToDateline: number;
  datelineToContent: number;
  imageToCaption: number;
  captionToBody: number;
};

// Values cut ~30% from their originals (headlineToSubheadline/headlineToDateline
// 2→1.5, lead subheadlineToDateline 4→3, others 2→1.5, datelineToContent 3→2,
// imageToCaption 6→4, captionToBody 3→2) per an explicit request to tighten
// spacing inside article boxes.
const prioritySpacing: Record<StoryPriority, EditorialSpacingResult> = {
  lead: {
    headlineToSubheadline: 1.5,
    headlineToDateline: 1.5,
    subheadlineToDateline: 3,
    datelineToContent: 2,
    imageToCaption: 4,
    captionToBody: 2,
  },
  major: {
    headlineToSubheadline: 1.5,
    headlineToDateline: 1.5,
    subheadlineToDateline: 1.5,
    datelineToContent: 2,
    imageToCaption: 4,
    captionToBody: 2,
  },
  secondary: {
    headlineToSubheadline: 1.5,
    headlineToDateline: 1.5,
    subheadlineToDateline: 1.5,
    datelineToContent: 2,
    imageToCaption: 4,
    captionToBody: 2,
  },
  brief: {
    headlineToSubheadline: 1.5,
    headlineToDateline: 1.5,
    subheadlineToDateline: 1.5,
    datelineToContent: 2,
    imageToCaption: 4,
    captionToBody: 2,
  },
  filler: {
    headlineToSubheadline: 1.5,
    headlineToDateline: 1.5,
    subheadlineToDateline: 1.5,
    datelineToContent: 2,
    imageToCaption: 4,
    captionToBody: 2,
  },
};

export const createEditorialSpacing = ({
  priority,
  hasSubheadline,
  hasImage,
  hasCaption,
}: EditorialSpacingInput): EditorialSpacingResult => {
  const base = prioritySpacing[priority];
  const spacing: EditorialSpacingResult = {
    headlineToSubheadline: base.headlineToSubheadline,
    headlineToDateline: base.headlineToDateline,
    subheadlineToDateline: base.subheadlineToDateline,
    // Previously `hasImage ? base.datelineToContent : 3` — a hardcoded fallback
    // that only matched the base value by coincidence (both were 3). Using the
    // base value directly so it can't silently drift out of sync again.
    datelineToContent: base.datelineToContent,
    imageToCaption: base.imageToCaption,
    captionToBody: hasCaption ? base.captionToBody : 0,
  };

  if (!hasSubheadline) {
    spacing.headlineToSubheadline = 0;
  }

  return spacing;
};

export const EditorialSpacingEngine = {
  createEditorialSpacing,
};
