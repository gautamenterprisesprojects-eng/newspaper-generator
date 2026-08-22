/**
 * SmartSpaceOptimizer Types
 *
 * Type definitions for the multi-strategy article fill optimizer.
 * This file contains ONLY types — no logic.
 * The optimizer wraps existing engines without modifying them.
 */

// ─── Input / Output ───────────────────────────────────────────────────────────

export type OptimizerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Describes the current fill state of an article box after composition.
 */
export type ArticleFillMetrics = {
  /** Total height of the article box (printable area). */
  boxHeight: number;
  /** Height actually consumed by composed content. */
  composedHeight: number;
  /** Fraction of the box that is filled: composedHeight / boxHeight. */
  fillRatio: number;
  /** Points of unused space at the bottom. */
  unusedPts: number;
  /** Whether the content overflows below the box boundary. */
  overflowing: boolean;
};

/**
 * Typography micro-adjustment knobs passed to the optimizer.
 * All values are DELTAS applied to the base settings.
 */
export type TypographyAdjustment = {
  trackingDelta: number;       // pt, clamped ±0.5
  lineSpacingDelta: number;    // fraction, clamped ±0.03
  paragraphSpacingDelta: number; // pt, clamped ±4
};

/**
 * Image adjustment knobs.
 */
export type ImageAdjustment = {
  heightScaleDelta: number;  // fraction, clamped ±0.15
  widthScaleDelta: number;   // fraction, clamped ±0.15
  verticalShiftDelta: number; // pt, clamped ±50
};

/**
 * Result returned by the optimizer after applying a strategy.
 */
export type OptimizerResult = {
  /** Whether the optimizer achieved ≥99% fill. */
  success: boolean;
  /** Chosen strategy that achieved fill (or last tried). */
  strategyUsed: OptimizerStrategy;
  /** Number of iterations taken. */
  iterations: number;
  /** Final fill ratio achieved. */
  finalFillRatio: number;
  /** Typography adjustments applied. */
  typographyAdjustment: TypographyAdjustment;
  /** Image adjustments applied. */
  imageAdjustment: ImageAdjustment;
  /** Whether a concluding sentence was appended (last resort). */
  concludingSentenceAppended: boolean;
};

// ─── Strategy enumeration ─────────────────────────────────────────────────────

/**
 * The 18 strategies are tried in priority order.
 * The optimizer stops at the first strategy that achieves ≥99% fill.
 */
export type OptimizerStrategy =
  | "image-height-increase"
  | "image-height-decrease"
  | "image-vertical-shift"
  | "tracking-increase"
  | "tracking-decrease"
  | "line-spacing-increase"
  | "line-spacing-decrease"
  | "paragraph-spacing-increase"
  | "paragraph-spacing-decrease"
  | "caption-resize"
  | "pull-quote-resize"
  | "info-box-resize"
  | "merge-short-paragraphs"
  | "split-long-paragraph"
  | "reflow-paragraphs"
  | "balance-columns"
  | "rejustify-text"
  | "append-concluding-sentence";

/**
 * Configuration for the optimizer. All limits are enforced by the engine.
 */
export type OptimizerConfig = {
  /** Target fill ratio (default 0.99). */
  targetFillRatio: number;
  /** Maximum number of strategy iterations (default 5). */
  maxIterations: number;
  /** Image height scale bounds. */
  imageHeightScaleMin: number;   // default -0.15
  imageHeightScaleMax: number;   // default +0.15
  /** Typography bounds. */
  trackingMin: number;           // default -0.5 pt
  trackingMax: number;           // default +0.5 pt
  lineSpacingMin: number;        // default -0.03
  lineSpacingMax: number;        // default +0.03
  paragraphSpacingMin: number;   // default -4 pt
  paragraphSpacingMax: number;   // default +4 pt
  /** Whether appending a concluding sentence is allowed. */
  allowConcludingSentence: boolean;
};

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  targetFillRatio: 0.99,
  maxIterations: 5,
  imageHeightScaleMin: -0.15,
  imageHeightScaleMax: 0.15,
  trackingMin: -0.5,
  trackingMax: 0.5,
  lineSpacingMin: -0.03,
  lineSpacingMax: 0.03,
  paragraphSpacingMin: -4,
  paragraphSpacingMax: 4,
  allowConcludingSentence: true,
};
