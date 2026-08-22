import type { CompositionOrchestratorResult } from "@/engines/CompositionOrchestrator";
import type { StoryProfile } from "@/engines/EditorialStory";
import type { AdvertisementReservation } from "@/engines/PagePlanner";
import type { NewspaperPageTemplate } from "@/engines/TemplateLibrary";
import type { StoryFrame } from "@/types/editor";
import type { TemplateStoryFrameSlot } from "@/engines/TemplateLayout/TemplateTypes";

export type AutoPageStorySlot = TemplateStoryFrameSlot & {
  id: string;
  reservedForAdvertisement: boolean;
};

export type PlacedStory = {
  storyId: string;
  slotId: string;
  score: number;
  reasons: string[];
};

export type RejectedStory = {
  storyId: string;
  reason: string;
};

export type PageCompositionValidationIssue = {
  code:
    | "story-overlap"
    | "advertisement-overlap"
    | "illegal-whitespace"
    | "outside-margins"
    | "image-overflow"
    | "caption-overflow"
    | "headline-overflow";
  severity: "error" | "warning";
  storyId?: string;
  message: string;
};

export type PageCompositionValidation = {
  valid: boolean;
  issues: PageCompositionValidationIssue[];
};

export type PageCompositionMetrics = {
  placedStoryCount: number;
  rejectedStoryCount: number;
  unusedSlotCount: number;
  advertisementReservationCount: number;
  compositionIterations: number;
  compositionTimeMs: number;
};

export type PageCompositionResult = {
  pageId: string;
  template: NewspaperPageTemplate;
  placedStories: StoryFrame[];
  placedStoryAssignments: PlacedStory[];
  rejectedStories: RejectedStory[];
  unusedSlots: AutoPageStorySlot[];
  advertisements: AdvertisementReservation[];
  validation: PageCompositionValidation;
  metrics: PageCompositionMetrics;
  orchestrator: CompositionOrchestratorResult;
  storyProfiles: Record<string, StoryProfile>;
};

