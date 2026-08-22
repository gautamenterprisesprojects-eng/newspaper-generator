export { composeAutoPage, AutoPageComposer } from "./AutoPageComposer";
export type { AutoPageComposerInput } from "./AutoPageComposer";
export { matchStoriesToSlots } from "./StorySlotMatcher";
export type { StorySlotMatchResult } from "./StorySlotMatcher";
export { scorePlacement } from "./PlacementScorer";
export type { PlacementScore } from "./PlacementScorer";
export { validatePageComposition } from "./CompositionValidator";
export type {
  AutoPageStorySlot,
  PageCompositionMetrics,
  PageCompositionResult,
  PageCompositionValidation,
  PageCompositionValidationIssue,
  PlacedStory,
  RejectedStory,
} from "./PageCompositionResult";
