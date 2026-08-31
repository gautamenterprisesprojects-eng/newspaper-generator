/**
 * EditorialDesignEngine
 *
 * New additive pre-layout module that selects the best professional Indian
 * newspaper page layout template BEFORE the existing layout engine runs.
 *
 * Pipeline position:
 *   Story Fetch → Story Selection → EditorialDesignEngine (THIS MODULE)
 *   → Existing Layout Engine → Typography → SentenceEndFitting → Export
 *
 * SAFETY GUARANTEE:
 *   This engine ONLY returns a TemplateId string.
 *   It never modifies stories, typography, body text, images, or any
 *   downstream engine state.  All locked engines remain completely unaffected.
 *
 * Design reference:
 *   Dainik Bhaskar / Dainik Jagran / Rajasthan Patrika front-page layouts.
 */

import type { TemplateDefinition } from "@/engines/TemplateLayout/TemplateTypes";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import { TEMPLATE_REGISTRY } from "@/engines/TemplateLayout/TemplateRegistry";
import type { StoryProfile } from "@/engines/EditorialStory";
import { scoreTemplate, type ScoredTemplate } from "./LayoutScorer";

// ─────────────────────────────────────────────────────────────────────────────
// Template catalogue – which templates are eligible for each story count
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a story count to an ordered list of candidate template IDs.
 * Multiple templates per count create layout diversity across pages.
 */
const STORY_COUNT_TEMPLATE_MAP: Record<number, TemplateId[]> = {
  1: ["FrontPage5A"],
  2: ["FrontPage5A"],
  3: ["FrontPage5A"],
  4: ["FrontPage5A"],
  5: ["IndianSports5A", "IndianColumn5A", "FrontPage5A"],
  6: [
    "IndianFront6A",
    "IndianFront6B",
    "IndianCity6A",
    "IndianBalance6A",
    "Layout16",
  ],
  7: [
    "IndianFront7A",
    "IndianFront7B",
    "IndianMixed7A",
  ],
  8: [
    "IndianFront8A",
    "IndianFront8B",
  ],
  9: ["IndianFront9A", "IndianCity5A", "ProfessionalNews10A"],
  10: ["IndianFront10A", "ProfessionalNews10A"],
};

const FALLBACK_TEMPLATE: TemplateId = "FrontPage5A";

// ─────────────────────────────────────────────────────────────────────────────
// Candidate selection
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the candidate template IDs for a given story count. */
const getCandidateIds = (storyCount: number): TemplateId[] => {
  // Exact match first
  if (STORY_COUNT_TEMPLATE_MAP[storyCount]) {
    return STORY_COUNT_TEMPLATE_MAP[storyCount];
  }

  // For counts beyond the map, find the closest available bracket
  const keys = Object.keys(STORY_COUNT_TEMPLATE_MAP)
    .map(Number)
    .sort((a, b) => Math.abs(a - storyCount) - Math.abs(b - storyCount));

  return STORY_COUNT_TEMPLATE_MAP[keys[0]] ?? [FALLBACK_TEMPLATE];
};

// ─────────────────────────────────────────────────────────────────────────────
// Page rhythm classifier
// ─────────────────────────────────────────────────────────────────────────────

export type PageRhythm = "news-heavy" | "photo-led" | "mixed";

/**
 * Classifies the editorial rhythm of the page based on story profiles.
 * Used to apply bias adjustments when scoring templates.
 */
export const classifyPageRhythm = (profiles: StoryProfile[]): PageRhythm => {
  if (profiles.length === 0) return "mixed";

  const imageProfiles = profiles.filter(
    (p) => p.imageRules.required || p.imageRules.preferredPlacement !== "none",
  );
  const imageRatio = imageProfiles.length / profiles.length;

  if (imageRatio >= 0.6) return "photo-led";
  if (imageRatio <= 0.25) return "news-heavy";

  return "mixed";
};

// ─────────────────────────────────────────────────────────────────────────────
// Rhythm-based score bias
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies a small editorial bias to the raw score based on page rhythm.
 * Photo-led pages prefer templates with wider lead slots (more image space).
 * News-heavy pages prefer templates with more columns and denser layouts.
 */
const applyRhythmBias = (
  score: number,
  template: TemplateDefinition,
  rhythm: PageRhythm,
): number => {
  const leadSlot = template.slots.find((s) => s.priority === "lead");
  const leadSpan = leadSlot?.columnSpan ?? 0;

  if (rhythm === "photo-led" && leadSpan >= 4) return score + 8;
  if (rhythm === "news-heavy" && leadSpan <= 3) return score + 5;
  if (rhythm === "mixed") return score + 3;

  return score;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main selection function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Selects the best professional Indian newspaper layout template for the given
 * story count and story profiles.
 *
 * Algorithm:
 *  1. Generate candidate template IDs for the story count
 *  2. Score each candidate template using LayoutScorer
 *  3. Apply page-rhythm bias
 *  4. Return the highest-scoring template ID
 *
 * @param storyCount  - Number of stories to place on this page
 * @param profiles    - StoryProfile map (keyed by storyId) from the classifier
 * @returns           - TemplateId string passed directly to generateTemplateLayout()
 */
export const selectEditorialTemplate = (
  storyCount: number,
  profiles: Record<string, StoryProfile>,
): TemplateId => {
  const candidateIds = getCandidateIds(storyCount);
  const profileList = Object.values(profiles);
  const rhythm = classifyPageRhythm(profileList);

  const scored = candidateIds
    .map((id) => {
      const template = TEMPLATE_REGISTRY[id];

      if (!template) {
        return null;
      }

      const breakdown = scoreTemplate(template, storyCount, profileList);
      const biasedScore = applyRhythmBias(breakdown.total, template, rhythm);

      return {
        templateId: id as string,
        score: { ...breakdown, total: biasedScore },
      } satisfies ScoredTemplate;
    })
    .filter(Boolean) as ScoredTemplate[];

  if (scored.length === 0) {
    return FALLBACK_TEMPLATE;
  }

  // Sort descending by total score, stable tie-break by templateId
  scored.sort(
    (a, b) =>
      b.score.total - a.score.total ||
      a.templateId.localeCompare(b.templateId),
  );

  return scored[0].templateId as TemplateId;
};

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostics (for debugging / testing only)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns full scoring breakdown for all candidate templates (diagnostics). */
export const scoreAllCandidates = (
  storyCount: number,
  profiles: Record<string, StoryProfile>,
): ScoredTemplate[] => {
  const candidateIds = getCandidateIds(storyCount);
  const profileList = Object.values(profiles);
  const rhythm = classifyPageRhythm(profileList);

  return (candidateIds
    .map((id) => {
      const template = TEMPLATE_REGISTRY[id];

      if (!template) return null;

      const breakdown = scoreTemplate(template, storyCount, profileList);
      const biasedScore = applyRhythmBias(breakdown.total, template, rhythm);

      return {
        templateId: id as string,
        score: { ...breakdown, total: biasedScore },
      } satisfies ScoredTemplate;
    })
    .filter(Boolean) as ScoredTemplate[])
    .sort((a, b) => b.score.total - a.score.total);
};

export const EditorialDesignEngine = {
  selectEditorialTemplate,
  scoreAllCandidates,
  classifyPageRhythm,
};
