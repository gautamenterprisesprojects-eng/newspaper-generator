import type { PageCompositionResult, RejectedStory } from "@/engines/AutoPageComposer";
import type { StoryProfile } from "@/engines/EditorialStory";
import type { AdvertisementReservation, EditionPlan, PagePlan, PlannerSection } from "@/engines/PagePlanner";
import type { NewspaperPageTemplate } from "@/engines/TemplateLibrary";
import type { StoryFrame } from "@/types/editor";

export type EditionPageComposition = {
  pageNumber: number;
  section: PlannerSection;
  pagePlan: PagePlan;
  template: NewspaperPageTemplate;
  result: PageCompositionResult;
};

export type EditionRejectedStory = RejectedStory & {
  pageNumber?: number;
};

export type EditionValidationIssue = {
  code:
    | "duplicate-story-assignment"
    | "duplicate-story-placement"
    | "missing-advertisement-reservation"
    | "invalid-page-order"
    | "invalid-section-order"
    | "invalid-page-count"
    | "orphan-story"
    | "invalid-page-composition";
  severity: "error" | "warning";
  pageNumber?: number;
  storyId?: string;
  advertisementId?: string;
  message: string;
};

export type EditionValidation = {
  valid: boolean;
  issues: EditionValidationIssue[];
};

export type EditionCompositionMetrics = {
  pageCount: number;
  placedStoryCount: number;
  rejectedStoryCount: number;
  unusedStoryCount: number;
  advertisementReservationCount: number;
  validPageCount: number;
  invalidPageCount: number;
  totalCompositionIterations: number;
  totalCompositionTimeMs: number;
};

export type EditionCompositionResult = {
  editionId: string;
  editionPlan: EditionPlan;
  pages: EditionPageComposition[];
  placedStories: StoryFrame[];
  rejectedStories: EditionRejectedStory[];
  unusedStories: StoryFrame[];
  advertisements: AdvertisementReservation[];
  storyProfiles: Record<string, StoryProfile>;
  validation: EditionValidation;
  metrics: EditionCompositionMetrics;
};
