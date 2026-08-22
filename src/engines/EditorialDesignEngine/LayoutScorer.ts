/**
 * LayoutScorer
 *
 * Pure scoring functions used by the EditorialDesignEngine to rank candidate
 * layout templates against professional Indian newspaper design standards
 * (Dainik Bhaskar, Dainik Jagran, Rajasthan Patrika style).
 *
 * All functions are pure: no mutations, no DOM access, no engine calls.
 */

import type { TemplateDefinition, TemplateStorySlotDefinition } from "@/engines/TemplateLayout/TemplateTypes";
import type { StoryProfile } from "@/engines/EditorialStory";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutScoreBreakdown = {
  /** 0–30: lead story occupies a visually dominant share of the page */
  hierarchy: number;
  /** 0–20: left/right and top/bottom visual weight is roughly balanced */
  balance: number;
  /** 0–15: column widths vary — stories don't all have the same span */
  diversity: number;
  /** 0–15: image-eligible stories are distributed across the page */
  imageDistribution: number;
  /** 0–10: story count in the template is close to the actual story count */
  storyCountFit: number;
  /** 0–10: row heights form an interesting rhythm (not all equal) */
  rowRhythm: number;
  /** Total composite score */
  total: number;
};

export type ScoredTemplate = {
  templateId: string;
  score: LayoutScoreBreakdown;
};

// ─────────────────────────────────────────────────────────────────────────────
// Slot helpers
// ─────────────────────────────────────────────────────────────────────────────

const COLUMN_COUNT = 6;

/** Fraction of total column-area occupied by a slot */
const slotAreaFraction = (slot: TemplateStorySlotDefinition): number =>
  slot.columnSpan / COLUMN_COUNT;

/** Centre column position (0–1) of a slot */
const slotCentreX = (slot: TemplateStorySlotDefinition): number =>
  (slot.columnStart - 1 + slot.columnSpan / 2) / COLUMN_COUNT;

// ─────────────────────────────────────────────────────────────────────────────
// Individual scoring dimensions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rewards templates where the lead slot occupies 25–40 % of total column-area.
 * Max score: 30.
 */
export const scoreHierarchy = (slots: TemplateStorySlotDefinition[]): number => {
  const leadSlots = slots.filter((s) => s.priority === "lead");

  if (leadSlots.length === 0) return 0;

  const totalArea = slots.reduce((sum, s) => sum + s.columnSpan, 0);
  const leadArea = leadSlots.reduce((sum, s) => sum + s.columnSpan, 0);
  const leadRatio = totalArea > 0 ? leadArea / totalArea : 0;

  // Sweet spot: 0.25 – 0.40 of total area
  if (leadRatio >= 0.25 && leadRatio <= 0.40) return 30;
  if (leadRatio >= 0.20 && leadRatio <= 0.45) return 22;
  if (leadRatio >= 0.15 && leadRatio <= 0.50) return 14;

  return 5;
};

/**
 * Rewards templates where stories are distributed evenly across the left and
 * right halves of the page. Max score: 20.
 */
export const scoreBalance = (slots: TemplateStorySlotDefinition[]): number => {
  if (slots.length === 0) return 0;

  const leftArea = slots
    .filter((s) => slotCentreX(s) < 0.5)
    .reduce((sum, s) => sum + s.columnSpan, 0);
  const rightArea = slots
    .filter((s) => slotCentreX(s) >= 0.5)
    .reduce((sum, s) => sum + s.columnSpan, 0);
  const totalArea = leftArea + rightArea;

  if (totalArea === 0) return 0;

  const imbalance = Math.abs(leftArea - rightArea) / totalArea;

  // Full-width slots (columnSpan=6) are always balanced
  if (imbalance <= 0.12) return 20;
  if (imbalance <= 0.22) return 15;
  if (imbalance <= 0.35) return 10;

  return 4;
};

/**
 * Rewards templates where story column spans vary — avoids all stories being
 * the same width (which looks software-generated). Max score: 15.
 */
export const scoreDiversity = (slots: TemplateStorySlotDefinition[]): number => {
  if (slots.length <= 1) return 0;

  const spans = slots.map((s) => s.columnSpan);
  const unique = new Set(spans).size;
  const maxUnique = Math.min(slots.length, 5);
  const ratio = unique / maxUnique;

  // Bonus if the lead slot is wider than all others (dominance bonus)
  const leadSpan = slots.find((s) => s.priority === "lead")?.columnSpan ?? 0;
  const otherMaxSpan = Math.max(
    ...slots.filter((s) => s.priority !== "lead").map((s) => s.columnSpan),
    0,
  );
  const dominanceBonus = leadSpan > otherMaxSpan ? 3 : 0;

  return Math.round(ratio * 12) + dominanceBonus;
};

/**
 * Rewards templates where slots eligible for images are spread across the page
 * (not clustered on one side). Max score: 15.
 */
export const scoreImageDistribution = (
  slots: TemplateStorySlotDefinition[],
  profiles: StoryProfile[],
): number => {
  const imageEligiblePriorities = new Set(["lead", "major"]);
  const imageSlots = slots.filter((s) => imageEligiblePriorities.has(s.priority));

  if (imageSlots.length <= 1) return 15; // single image — always good

  const centres = imageSlots.map((s) => slotCentreX(s));
  const min = Math.min(...centres);
  const max = Math.max(...centres);
  const spread = max - min;

  // Reward wide spread across the page
  if (spread >= 0.55) return 15;
  if (spread >= 0.35) return 10;
  if (spread >= 0.20) return 6;

  return 2;
};

/**
 * Rewards templates whose story count is close to the number of stories
 * we actually need to place. Max score: 10.
 */
export const scoreStoryCountFit = (
  templateStoryCount: number,
  actualStoryCount: number,
): number => {
  const delta = Math.abs(templateStoryCount - actualStoryCount);

  if (delta === 0) return 10;
  if (delta === 1) return 7;
  if (delta === 2) return 4;

  return 0;
};

/**
 * Rewards templates that have interesting row rhythm (rows of varying height
 * rather than equal splits). Max score: 10.
 */
export const scoreRowRhythm = (template: TemplateDefinition): number => {
  const rhythm = template.rowRhythm;

  if (!rhythm || rhythm.length === 0) return 5;

  const ratios = rhythm.map((r) => r.baseRatio);
  const max = Math.max(...ratios);
  const min = Math.min(...ratios);
  const spread = max - min;

  // Reward variance (larger spread = more interesting rhythm)
  if (spread >= 0.14) return 10;
  if (spread >= 0.08) return 7;

  return 4;
};

// ─────────────────────────────────────────────────────────────────────────────
// Composite scorer
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a composite editorial layout score for the given template. */
export const scoreTemplate = (
  template: TemplateDefinition,
  actualStoryCount: number,
  profiles: StoryProfile[],
): LayoutScoreBreakdown => {
  const slots = template.slots;

  const hierarchy = scoreHierarchy(slots);
  const balance = scoreBalance(slots);
  const diversity = scoreDiversity(slots);
  const imageDistribution = scoreImageDistribution(slots, profiles);
  const storyCountFit = scoreStoryCountFit(template.storyCount, actualStoryCount);
  const rowRhythm = scoreRowRhythm(template);

  return {
    hierarchy,
    balance,
    diversity,
    imageDistribution,
    storyCountFit,
    rowRhythm,
    total: hierarchy + balance + diversity + imageDistribution + storyCountFit + rowRhythm,
  };
};
