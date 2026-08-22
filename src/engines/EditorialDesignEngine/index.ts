/**
 * EditorialDesignEngine – Public API
 *
 * This module sits BEFORE the existing layout engine in the composition
 * pipeline.  It selects the best professional Indian newspaper page template
 * for the current set of stories and returns a TemplateId that is passed
 * directly into generateTemplateLayout() without any modification.
 */

export {
  EditorialDesignEngine,
  selectEditorialTemplate,
  scoreAllCandidates,
  classifyPageRhythm,
} from "./EditorialDesignEngine";

export type { PageRhythm } from "./EditorialDesignEngine";

export {
  scoreTemplate,
  scoreHierarchy,
  scoreBalance,
  scoreDiversity,
  scoreImageDistribution,
  scoreStoryCountFit,
  scoreRowRhythm,
} from "./LayoutScorer";

export type { LayoutScoreBreakdown, ScoredTemplate } from "./LayoutScorer";
