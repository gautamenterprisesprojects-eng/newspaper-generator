/**
 * TemplateRegistry
 *
 * Built-in slot-based layout templates for the newspaper generator.
 *
 * ── Priority-band invariants (Phase 1.6) ────────────────────────────────
 * Every template MUST satisfy:
 *   1. Exactly one slot with priority "lead" per template (the "main
 *      headline appears only in the main news section" rule).
 *   2. The row that contains the lead slot MUST NOT also contain any
 *      brief or filler slot. A "news rail" pattern (narrow brief/secondary
 *      running alongside the main story) is allowed only in rows that do
 *      not include the lead itself — otherwise the small side story visually
 *      competes with the main headline.
 *
 * These are enforced by TemplateLayoutTests. Priority-based suppression in
 * `editorStore.createArticleDataFromNewswireStory` handles the visual side:
 * brief/filler stories always render without inline subheadings, and filler
 * (plus 1-col briefs) never show images regardless of source data.
 *
 * ORIGINAL:
 *   FrontPage5A  – 5-story front page (unchanged, locked)
 *
 * NEW (added by EditorialDesignEngine, v2):
 *   14 additional professional Indian newspaper layouts modelled on
 *   Dainik Bhaskar, Dainik Jagran, Rajasthan Patrika, and Hindustan.
 *
 *   All new templates are ADDITIVE – no existing template is modified.
 *   Row rhythm ratios create asymmetric, professional-looking row heights.
 *
 * Slot coordinate system:
 *   columnStart: 1-based column where the slot begins (1–6)
 *   columnSpan:  number of columns this slot spans (1–6)
 *   row:         layout row number (1 = top, ascending)
 *   priority:    "lead" | "major" | "secondary" | "brief"
 */

import type { TemplateDefinition, TemplateId } from "./TemplateTypes";
import {
  EDITORIAL_COLUMN_COUNT,
  EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
  EDITORIAL_ROW_RHYTHM,
} from "@/engines/MasterPage/EditorialPageStyle";

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL – locked, do not modify
// ─────────────────────────────────────────────────────────────────────────────

export const FRONT_PAGE_5A: TemplateDefinition = {
  id: "FrontPage5A",
  name: "Front Page 5A",
  storyCount: 5,
  rowRhythm: [
    { row: 1, baseRatio: 0.4, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.3, receivesRemainingSpace: false },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 4, priority: "major" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Indian Front Page 6-story layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianFront6A
 * Classic Dainik Bhaskar city-front layout.
 * Lead full-width top → two major stories side-by-side → two medium + one brief.
 * Row rhythm: 38% / 32% / 30% (asymmetric, professional feel).
 */
const INDIAN_FRONT_6A: TemplateDefinition = {
  id: "IndianFront6A",
  name: "Indian Front 6A",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.30, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

/**
 * IndianFront6B
 * Dominant left-column lead + vertical sidebar right.
 * Lead occupies 4 columns with room for image.
 * Sidebar: 2 stacked secondary stories.
 * Bottom: 2 medium stories.
 * Row rhythm: 42% / 58% (two-row layout with dense bottom).
 */
const INDIAN_FRONT_6B: TemplateDefinition = {
  id: "IndianFront6B",
  name: "Indian Front 6B",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.44, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.56, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: Lead (4-col) + sidebar top (2-col)
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Row 2: three secondaries + two briefs — same tier band (no major/brief mix).
    // Story 4 was "major" but sat next to briefs, violating the priority-band
    // invariant; demoted to "secondary" so the row reads as secondary+brief.
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Indian Front Page 7-story layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianFront7A
 * Three-row layout: large lead + two majors + four supporting.
 * Typical Dainik Jagran national edition style.
 * Row rhythm: 36% / 30% / 34% (bottom row slightly taller for 4 briefs).
 */
const INDIAN_FRONT_7A: TemplateDefinition = {
  id: "IndianFront7A",
  name: "Indian Front 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.36, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.30, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.34, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

/**
 * IndianFront7B
 * Asymmetric 3-column lead + right sidebar + lower rows.
 * Rajasthan Patrika regional style with heavy left anchor.
 * Row rhythm: 40% / 28% / 32%.
 */
const INDIAN_FRONT_7B: TemplateDefinition = {
  id: "IndianFront7B",
  name: "Indian Front 7B",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.40, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.32, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: 3-col lead + 3-col major (asymmetric)
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 3, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 4, columnSpan: 3, priority: "major" },
    // Row 2: 2+2+2 medium stories
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Row 3: 3+3 bottom
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

/**
 * IndianMixed7A
 * Mixed column layout: 4-col lead with 2-col sidebar + varied lower.
 * Creates strong visual contrast through unequal widths throughout.
 * Row rhythm: 38% / 34% / 28%.
 */
const INDIAN_MIXED_7A: TemplateDefinition = {
  id: "IndianMixed7A",
  name: "Indian Mixed 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.34, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.28, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: 4-col lead + 2-col secondary
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Row 2: 3-col major + 1-col secondary + 2-col major (varied widths).
    // Story 4 was "brief" but sat between two majors; violates the
    // priority-band invariant. Promoted to "secondary" (adjacent to major).
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 1, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    // Row 3: 2+4 bottom
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 3, columnSpan: 4, priority: "major" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Indian Front Page 8-story layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianFront8A
 * Dense Dainik Bhaskar-style page: lead + 3 major + 4 brief.
 * Clear four-row structure; brief strip at the bottom.
 * Row rhythm: 34% / 28% / 24% / 14%.
 */
const INDIAN_FRONT_8A: TemplateDefinition = {
  id: "IndianFront8A",
  name: "Indian Front 8A",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.34, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.14, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 5, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Brief strip: 4 narrow stories
    { storyNumber: 6, row: 4, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 7, row: 4, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 5, columnSpan: 2, priority: "brief" },
  ],
};

/**
 * IndianFront8B
 * 4-col lead + asymmetric rows with mixed widths.
 * Hindustan / Amar Ujala page composition style.
 * Row rhythm: 38% / 32% / 30%.
 */
const INDIAN_FRONT_8B: TemplateDefinition = {
  id: "IndianFront8B",
  name: "Indian Front 8B",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.30, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: 4-col lead + 2-col secondary
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Row 2: secondary + major + brief-rail (narrow 1-col brief alongside a
    // wider major is a legitimate "news rail" pattern — allowed as long as
    // the rail slot is columnSpan=1 and the compose engine strips its
    // subheadline / image via priority-based suppression).
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
    // Row 3: major + secondary + brief-rail (same pattern).
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – City & Section page layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianCity5A
 * Standard Indian city-page 5-story layout.
 * 3-col lead left + 3-col major right → 3 supporting below.
 * Row rhythm: 42% / 58%.
 */
const INDIAN_CITY_5A: TemplateDefinition = {
  id: "IndianCity5A",
  name: "Indian City 5A",
  storyCount: 5,
  rowRhythm: [
    { row: 1, baseRatio: 0.44, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.56, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 3, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * IndianCity6A
 * City page with 6 stories: 4-col + 2-col top, then 4 below.
 * Row rhythm: 40% / 60%.
 */
const INDIAN_CITY_6A: TemplateDefinition = {
  id: "IndianCity6A",
  name: "Indian City 6A",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.40, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.60, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Sports page layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianSports5A
 * Wide-photo sports lead + 4 compact match reports.
 * Row rhythm: 50% / 50% (sports images need generous height).
 */
const INDIAN_SPORTS_5A: TemplateDefinition = {
  id: "IndianSports5A",
  name: "Indian Sports 5A",
  storyCount: 5,
  rowRhythm: [
    { row: 1, baseRatio: 0.50, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.50, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Dense 9-story and 10-story layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianFront9A
 * Dense Times of India-style page: lead + 4 major + 4 brief.
 * Row rhythm: 32% / 26% / 26% / 16%.
 */
const INDIAN_FRONT_9A: TemplateDefinition = {
  id: "IndianFront9A",
  name: "Indian Front 9A",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.26, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.26, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.16, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    // Row 3: secondaries and a small secondary (was a brief that mixed with
    // major in the same row — violated the priority-band invariant). Story 6
    // promoted from "brief" to "secondary" so row 3 stays inside a single
    // adjacent tier band (major↔secondary).
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 3, priority: "major" },
    { storyNumber: 6, row: 3, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 9, row: 4, columnStart: 5, columnSpan: 2, priority: "brief" },
  ],
};

/**
 * IndianFront10A
 * Very dense 10-story layout.
 * Row rhythm: 30% / 24% / 24% / 22%.
 */
const INDIAN_FRONT_10A: TemplateDefinition = {
  id: "IndianFront10A",
  name: "Indian Front 10A",
  storyCount: 10,
  rowRhythm: [
    { row: 1, baseRatio: 0.30, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.22, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 9, row: 4, columnStart: 5, columnSpan: 1, priority: "brief" },
    { storyNumber: 10, row: 4, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Balanced & Column formats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndianColumn5A
 * Column editorial format: 1-col lead left + 5-col body.
 * Unusual layout used for special editions.
 * Row rhythm: 45% / 55%.
 */
const INDIAN_COLUMN_5A: TemplateDefinition = {
  id: "IndianColumn5A",
  name: "Indian Column 5A",
  storyCount: 5,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.55, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * IndianBalance6A
 * Perfectly balanced 6-story page: 2+4 / 3+3 / 2+2+2 rows.
 * Row rhythm: 38% / 32% / 30%.
 */
const INDIAN_BALANCE_6A: TemplateDefinition = {
  id: "IndianBalance6A",
  name: "Indian Balance 6A",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.30, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: lead 4-col + major 2-col
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    // Row 2: balanced 3+3
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    // Row 3: three equal 2-col stories
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 4, priority: "secondary" },
  ],
};

/**
 * ProfessionalNews10A
 * Layout Slot 15 – Professional Newspaper Layout (Exact PDF Scan - 9 Stories)
 * Row rhythm: 32% / 24% / 20% / 24%
 */
const PROFESSIONAL_NEWS_10A: TemplateDefinition = {
  id: "ProfessionalNews10A",
  name: "Professional Newspaper Layout (Exact PDF Scan)",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.20, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.24, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: Left sidebar top item (Col 1, span 1) + Lead Story (Cols 2-6, span 5)
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    // Row 2: Left sidebar second item (Col 1, span 1) + Middle Banner Story (Cols 2-6, span 5)
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 2, columnSpan: 5, priority: "major" },
    // Row 3: Left sidebar third item (Col 1, span 1) + Weather Story (Cols 2-3, span 2) + Transfers Story (Cols 4-6, span 3)
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
    // Row 4: Left sidebar fourth item (Col 1, span 1) + Bottom Banner Story (Cols 2-6, span 5)
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 9, row: 4, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW – Advanced Designs (professional layouts modelled on Dainik Bhaskar
// and Times of India front/city pages). ADDITIVE ONLY – nothing above is
// modified. These follow the same slot/rowRhythm rules as the basic set
// (columns per row always sum to the 6-col grid; storyNumbers sequential).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AdvancedHeroRail7A
 * Times of India front-page pattern: wide lead + major stacked on the left,
 * a narrow news rail running down the right column across every row.
 * Row rhythm: 18% / 42% / 40%.
 */
const ADVANCED_HERO_RAIL_7A: TemplateDefinition = {
  id: "AdvancedHeroRail7A",
  name: "Advanced Hero Rail 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.18, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.42, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.40, receivesRemainingSpace: true },
  ],
  slots: [
    // Row 1: lead spans 5, side rail (brief) narrowed to 1 col so it does
    // not visually compete with the main headline. (Was cols 5-6 span 2.)
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "brief" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "brief" },
  ],
};

/**
 * AdvancedMosaicGrid8A
 * Dainik Bhaskar mosaic pattern: full-width photo band, three equal majors,
 * then a four-box brief strip for tight, magazine-style density.
 * Row rhythm: 30% / 34% / 36%.
 */
const ADVANCED_MOSAIC_GRID_8A: TemplateDefinition = {
  id: "AdvancedMosaicGrid8A",
  name: "Advanced Mosaic Grid 8A",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.30, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.34, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.36, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 3, columnSpan: 2, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

/**
 * AdvancedSidebarFeature9A
 * Right-hand news rail (1-col, repeated every row) beside a wide feature
 * column, echoing Times of India's right-rail short-story stack.
 * Row rhythm: 24% / 24% / 24% / 28%.
 */
const ADVANCED_SIDEBAR_FEATURE_9A: TemplateDefinition = {
  id: "AdvancedSidebarFeature9A",
  name: "Advanced Sidebar Feature 9A",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.24, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.28, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 5, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 5, priority: "major" },
    { storyNumber: 9, row: 4, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

/**
 * AdvancedMagazineCover6A
 * Magazine-style cover: dominant 4-col lead and major stacked against a
 * slim 2-col feature sidebar, closing with a balanced two-story footer.
 * Row rhythm: 40% / 32% / 28%.
 */
const ADVANCED_MAGAZINE_COVER_6A: TemplateDefinition = {
  id: "AdvancedMagazineCover6A",
  name: "Advanced Magazine Cover 6A",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.40, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.32, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.28, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "brief" },
  ],
};

/**
 * AdvancedInfographicSplit7A
 * Times of India infographic-story pattern: a wide central story flanked by
 * two narrow 1-col rails on the left and right, closing with a full-width wrap.
 * Row rhythm: 22% / 40% / 38%.
 */
const ADVANCED_INFOGRAPHIC_SPLIT_7A: TemplateDefinition = {
  id: "AdvancedInfographicSplit7A",
  name: "Advanced Infographic Split 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.22, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.40, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.38, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    { storyNumber: 3, row: 1, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 4, priority: "major" },
    { storyNumber: 6, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 6, priority: "secondary" },
  ],
};

/**
 * AdvancedSportsBleed6A
 * Full-bleed sports photo lead over a medal-table-style stat row and a
 * closing two-story footer, matching Times of India / Dainik Bhaskar sports fronts.
 * Row rhythm: 55% / 25% / 20%.
 */
const ADVANCED_SPORTS_BLEED_6A: TemplateDefinition = {
  id: "AdvancedSportsBleed6A",
  name: "Advanced Sports Bleed 6A",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.55, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.25, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.20, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "brief" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "brief" },
  ],
};

/**
 * AdvancedEditorialColumn7A
 * Dainik Bhaskar city-front pattern: a slim opinion/index rail (1-col,
 * repeated every row) running beside the main editorial column.
 * Row rhythm: 30% / 35% / 35%.
 */
const ADVANCED_EDITORIAL_COLUMN_7A: TemplateDefinition = {
  id: "AdvancedEditorialColumn7A",
  name: "Advanced Editorial Column 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.30, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.35, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.35, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 2, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 2, columnSpan: 5, priority: "secondary" },
  ],
};

/**
 * AdvancedQuadMosaic7A
 * Balanced tabloid-style quad grid: full-width lead, two even majors,
 * then a four-box brief strip for a dense, modern finish.
 * Row rhythm: 25% / 35% / 40%.
 */
const ADVANCED_QUAD_MOSAIC_7A: TemplateDefinition = {
  id: "AdvancedQuadMosaic7A",
  name: "Advanced Quad Mosaic 7A",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.25, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.35, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.40, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 2, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 6, columnSpan: 1, priority: "brief" },
  ],
};

/**
 * AdvancedBannerStack10A
 * Dense Dainik Bhaskar banner-stack: two stacked full-width banners over
 * a halved secondary row and two rows of tri-column briefs.
 * Row rhythm: 16% / 16% / 22% / 23% / 23%.
 */
const ADVANCED_BANNER_STACK_10A: TemplateDefinition = {
  id: "AdvancedBannerStack10A",
  name: "Advanced Banner Stack 10A",
  storyCount: 10,
  rowRhythm: [
    { row: 1, baseRatio: 0.16, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.16, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.23, receivesRemainingSpace: false },
    { row: 5, baseRatio: 0.23, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 6, priority: "major" },
    { storyNumber: 3, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 4, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 6, row: 4, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 7, row: 4, columnStart: 5, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 5, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 9, row: 5, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 10, row: 5, columnStart: 5, columnSpan: 2, priority: "brief" },
  ],
};

/**
 * AdvancedFeatureWrap9A
 * Feature-wrap pattern: paired lead/major columns, paired secondaries,
 * a tri-column brief row, then a closing two-story band.
 * Row rhythm: 30% / 26% / 22% / 22%.
 */
const ADVANCED_FEATURE_WRAP_9A: TemplateDefinition = {
  id: "AdvancedFeatureWrap9A",
  name: "Advanced Feature Wrap 9A",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.30, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.26, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: false },
    { row: 4, baseRatio: 0.22, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 3, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 3, priority: "brief" },
    { storyNumber: 9, row: 4, columnStart: 4, columnSpan: 3, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layout 16
 * Custom design layout with specific visual elements:
 * - Rounded image
 * - Fact boxes inside big news articles
 * - Kicker text above bottom headlines
 * - Left side text (contour wrap) inside image box
 */
const LAYOUT_16: TemplateDefinition = {
  id: "Layout16",
  name: "Layout 16",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.40, receivesRemainingSpace: false },
    { row: 2, baseRatio: 0.35, receivesRemainingSpace: false },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" }, // large article, can have fact box
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" }, // side article, can have contour image
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 4, priority: "secondary" }, // bottom article, can have kicker
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "brief" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRONT PAGE ONLY – these are offered exclusively by the wizard's "Front Page"
// tab and are laid out below the ~6.1cm masthead band (see HeaderGeometry).
// They are NOT part of the inside-page catalogue.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CliffFront11A
 * The Cliff News front page, traced off the 01 Aug 2026 Bhopal edition.
 *
 * Column geometry measured against the 6-column grid of that page:
 *
 *   masthead band            0    → 11.5% of page height  (reserved, not a slot)
 *   row 1  top package       11.5 → 40.5%   ratio 0.34
 *     col 1        सार-समाचार rail (upper half: हिमस्खलन / कोयला खदान)
 *     cols 2-4     पप्पू यादव का अनोखा अंदाज़  ← the page lead, banner and
 *                  headline across all three columns
 *       └ col 4    संत समाज ने जताई नाराजगी   — boxed sidebar NESTED inside the
 *                  lead, below its headline; the lead's body divides around it
 *     cols 5-6     ईरान पर हमले रोकने का बिल एक वोट से गिरा
 *   row 2  mid band          40.5 → 51%     ratio 0.12
 *     col 1        सार-समाचार rail (lower half: बिल्डिंग ढही / उमर अब्दुल्ला)
 *     col 2        सड़क हादसे में सेना के मेजर हमजा आरिफ की मौत
 *     cols 3-4     सड़कों पर आवारा पशु मामले में सुप्रीम कोर्ट सख्त
 *     cols 5-6     गुरुग्राम-जयपुर हाइवे आज से बैरियर-फ्री
 *   row 3  anchor            51   → 76%     ratio 0.29
 *     cols 1-6     खराब सड़क के कारण हर दिन मारे जा रहे हैं 80 लोग
 *   row 4  bottom            76   → 98%     ratio 0.25
 *     col 1        आज का मुक्का (cartoon)
 *     cols 2-6     अंकित शर्मा हत्याकांड में ताहिर हुसैन समेत पांच दोषियों को उम्रकैद
 *
 * The rail is one continuous box on the printed page; the row grid cannot span
 * rows, so it is carried as two stacked 1-column briefs (slots 1 and 5) that
 * butt against each other and read as a single rail.
 *
 * Row 1 therefore has three *peer* columns summing to the 6-col grid — 1 │ 3 │ 2
 * — plus one nested box. Slot 3 is not a fourth column: it is inset into slot 2
 * so the lead keeps its full three-column headline measure.
 *
 * The rhythm ratios below are the measured band depths expressed against the
 * content box, and each row states its own `minimumHeight`. The priority floors
 * cannot render this page: a `lead` demands 560pt and a `major` 380pt, which are
 * taller than bands A, C and D actually are on the sheet, so the floors would win
 * over every ratio and push band A deep at the expense of the rest. The overrides
 * here are deliberately slack — they exist to stop the generic floors binding, not
 * to size the bands.
 *
 * The mid band is priced as `brief` rather than `secondary` for the same reason:
 * a 10.5% strip is shorter than a secondary's 270pt, and those four boxes really
 * are short items on the page. 2-column briefs still carry photos, which is what
 * the आवारा पशु box needs.
 */
const CLIFF_FRONT_11A: TemplateDefinition = {
  id: "CliffFront11A",
  name: "The Cliff News Front Page (PDF Scan)",
  storyCount: 11,
  rowRhythm: [
    { row: 1, baseRatio: 0.342, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 2, baseRatio: 0.122, receivesRemainingSpace: false, minimumHeight: 120 },
    { row: 3, baseRatio: 0.284, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 4, baseRatio: 0.255, receivesRemainingSpace: true, minimumHeight: 240 },
  ],
  slots: [
    // Row 1 — peers 1 │ 3 │ 2. The rail is a single-column brief, which is what
    // the priority-band invariant permits alongside the lead.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    // Nested sidebar — the lead's third column, starting below its headline
    // block. 0.32 is where the box's top edge falls on the printed page
    // (21% of page height, against a lead box spanning 11.5–41%).
    {
      storyNumber: 3,
      row: 1,
      columnStart: 4,
      columnSpan: 1,
      priority: "brief",
      insetInto: { parentStoryNumber: 2, topFraction: 0.32 },
    },
    { storyNumber: 4, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    // Row 2 — mid band of short items
    { storyNumber: 5, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 2, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 2, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 8, row: 2, columnStart: 5, columnSpan: 2, priority: "brief" },
    // Row 3 — full-width anchor report
    { storyNumber: 9, row: 3, columnStart: 1, columnSpan: 6, priority: "major" },
    // Row 4 — cartoon rail + bottom package
    { storyNumber: 10, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 11, row: 4, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

/**
 * CliffFront8A
 * The Cliff News front page reduced to eight boxes.
 *
 * Same page as CliffFront11A above — the top package and the bottom package are
 * unchanged, slot for slot. What differs is the middle, which on the 11-box page
 * is two separate bands: a 10.5% strip of four short briefs, then a full-width
 * anchor report. Eight boxes buys those five slots back as two, so the strip and
 * the anchor merge into a single mid band running the full 40.6% of page depth
 * that the two used to share (0.122 + 0.284):
 *
 *   row 1  top package       11.5 → 40.5%   ratio 0.342
 *     col 1        सार-समाचार rail
 *     cols 2-4     the page lead
 *     cols 5-6     second story
 *   row 2  mid band          40.5 → 81%     ratio 0.406
 *     cols 1-3     wide mid-lead — carries the band's photo
 *     col 4        single-column brief
 *     cols 5-6     companion report
 *   row 3  bottom            81   → 98%     ratio 0.255   (unchanged)
 *
 * Row 1 carries no nested sidebar. CliffFront11A insets a boxed brief into the
 * lead's third column; here the lead keeps its whole rectangle, so its body
 * runs the full three-column measure with nothing to divide around.
 *
 * The mid band's 3 │ 1 │ 2 split gives the band a dominant package, a narrow
 * brief and a companion report. The single column in the middle breaks up what
 * would otherwise be two wide slabs, and the uneven spans keep the band from
 * repeating row 1's rhythm.
 *
 * The two wide mid boxes are priced `major`, not `brief` — they are no longer
 * the short items of the 11-box strip, and `major` is what earns them a photo
 * and a full headline tier. The narrow one stays `brief`, which is what its
 * one-column measure can carry. The row still states its own `minimumHeight`
 * for the reason given on CliffFront11A: the priority floor for a `major`
 * (380pt) is taller than this band, so the floor would bind and push the band
 * past its measured depth.
 */
const CLIFF_FRONT_8A: TemplateDefinition = {
  id: "CliffFront8A",
  name: "The Cliff News Front Page (8 Box)",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.342, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 2, baseRatio: 0.406, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 3, baseRatio: 0.255, receivesRemainingSpace: true, minimumHeight: 240 },
  ],
  slots: [
    // Row 1 — three peers, 1 │ 3 │ 2, no nested box.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    { storyNumber: 3, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    // Row 2 — the merged mid band, 3 │ 1 │ 2.
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 4, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    // Row 3 — unchanged: cartoon rail + bottom package.
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 8, row: 3, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

/* ────────────────────────────────────────────────────────────────────────────
 * Front-page shape catalogue
 *
 * Twelve front-page archetypes, each a different *shape* rather than a
 * different story count — the count follows from the shape. They exist so the
 * front-page tab offers a real choice of page architecture, the way a desk
 * picks a page-one design to suit the day's news.
 *
 * Every one obeys the invariants the tests enforce on the whole registry:
 *   • peer columns in each row sum to exactly 6
 *   • exactly one `lead` slot
 *   • no multi-column brief/filler shares the lead's row (a 1-column rail is
 *     fine — that is the standard hero-rail pattern)
 *   • the last row carries `receivesRemainingSpace`, so the page always closes
 *     flush on the bottom content edge
 *
 * The `minimumHeight` on every row is deliberately slack, for the reason given
 * on CliffFront11A: the priority-derived floors (a lead demands 560pt, a major
 * 380pt) are taller than real front-page bands, so without an override the
 * floor beats the ratio and the top band swallows the sheet. These numbers are
 * set well under each band's natural depth — they stop the floors binding, they
 * do not size the bands.
 *
 * Ratios in each rhythm sum to 1.0 across the content box, which on a
 * broadsheet is the ~1313pt left below the masthead band.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Rails down both edges with the lead running between them. The symmetry reads
 * calmer than a single hero rail and gives two natural homes for briefs and
 * standing columns, which is why so many city editions use it midweek.
 */
const CLIFF_FRONT_TWIN_RAIL_10A: TemplateDefinition = {
  id: "CliffFrontTwinRail10A",
  name: "Twin Rail",
  storyCount: 10,
  rowRhythm: [
    { row: 1, baseRatio: 0.4, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 2, baseRatio: 0.2, receivesRemainingSpace: false, minimumHeight: 150 },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 4, baseRatio: 0.18, receivesRemainingSpace: true, minimumHeight: 140 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    { storyNumber: 3, row: 1, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 9, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 10, row: 4, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

/**
 * The lead banners the full six columns across the top, with everything else
 * ranked beneath it. The most emphatic page one available — reserved for a day
 * when one story genuinely owns the sheet.
 */
const CLIFF_FRONT_BANNER_LEAD_9A: TemplateDefinition = {
  id: "CliffFrontBannerLead9A",
  name: "Banner Lead",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.34, receivesRemainingSpace: false, minimumHeight: 220 },
    { row: 2, baseRatio: 0.24, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 4, baseRatio: 0.2, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 3, columnSpan: 2, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 8, row: 4, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 9, row: 4, columnStart: 4, columnSpan: 3, priority: "major" },
  ],
};

/**
 * Lead package up top, a thin strip of briefs across the waist, and a deep
 * picture-led anchor holding the foot of the page. The anchor is the heaviest
 * band, which is what stops a photo-driven page from going top-heavy.
 */
const CLIFF_FRONT_PHOTO_ANCHOR_8A: TemplateDefinition = {
  id: "CliffFrontPhotoAnchor8A",
  name: "Photo Anchor",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 2, baseRatio: 0.16, receivesRemainingSpace: false, minimumHeight: 110 },
    { row: 3, baseRatio: 0.46, receivesRemainingSpace: true, minimumHeight: 260 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 2, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 3, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 8, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * Three near-equal bands, each split into two large blocks, with a rail beside
 * the lead. Few, big boxes — an uncluttered page for a day of substantial
 * stories rather than many small ones.
 */
const CLIFF_FRONT_QUADRANT_7A: TemplateDefinition = {
  id: "CliffFrontQuadrant7A",
  name: "Quadrant",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.34, receivesRemainingSpace: false, minimumHeight: 220 },
    { row: 2, baseRatio: 0.33, receivesRemainingSpace: false, minimumHeight: 210 },
    { row: 3, baseRatio: 0.33, receivesRemainingSpace: true, minimumHeight: 210 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    { storyNumber: 3, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 3, columnSpan: 4, priority: "major" },
  ],
};

/**
 * A single dominant package over half the sheet, the way a magazine cover
 * carries one image. The fewest boxes of any front page here — it trades
 * breadth of coverage for impact.
 */
const CLIFF_FRONT_MAGAZINE_6A: TemplateDefinition = {
  id: "CliffFrontMagazine6A",
  name: "Magazine Cover",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.56, receivesRemainingSpace: false, minimumHeight: 300 },
    { row: 2, baseRatio: 0.22, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: true, minimumHeight: 160 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 6, priority: "major" },
  ],
};

/**
 * Full-width bands top and bottom with two graded strips between them. The
 * horizontal banding gives a strong, orderly rhythm and reads quickly — the
 * classic broadsheet skeleton.
 */
const CLIFF_FRONT_STACKED_BANDS_7A: TemplateDefinition = {
  id: "CliffFrontStackedBands7A",
  name: "Stacked Bands",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 200 },
    { row: 2, baseRatio: 0.18, receivesRemainingSpace: false, minimumHeight: 130 },
    { row: 3, baseRatio: 0.18, receivesRemainingSpace: false, minimumHeight: 130 },
    { row: 4, baseRatio: 0.34, receivesRemainingSpace: true, minimumHeight: 220 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 6, priority: "major" },
  ],
};

/**
 * The lead wraps an L around a boxed sidebar nested in its last column, so the
 * headline keeps its full four-column measure while the body divides around
 * the box. Rails on both edges close the band.
 */
const CLIFF_FRONT_L_WRAP_9A: TemplateDefinition = {
  id: "CliffFrontLWrap9A",
  name: "L-Wrap Sidebar",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.42, receivesRemainingSpace: false, minimumHeight: 250 },
    { row: 2, baseRatio: 0.2, receivesRemainingSpace: false, minimumHeight: 150 },
    { row: 3, baseRatio: 0.38, receivesRemainingSpace: true, minimumHeight: 240 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    // Nested, not a peer: it sits inside the lead's last column, below the
    // headline block, so the lead keeps its whole measure above it.
    {
      storyNumber: 3,
      row: 1,
      columnStart: 5,
      columnSpan: 1,
      priority: "brief",
      insetInto: { parentStoryNumber: 2, topFraction: 0.34 },
    },
    { storyNumber: 4, row: 1, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 1, columnSpan: 2, priority: "major" },
    { storyNumber: 6, row: 2, columnStart: 3, columnSpan: 2, priority: "major" },
    { storyNumber: 7, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 8, row: 3, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 9, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * The busiest page here: twelve boxes in varied spans, for a day with a lot of
 * separate news and no single story big enough to dominate. Dense, but the
 * spans still step down in rank so the eye has an order to follow.
 */
const CLIFF_FRONT_MOSAIC_12A: TemplateDefinition = {
  id: "CliffFrontMosaic12A",
  name: "Mosaic",
  storyCount: 12,
  rowRhythm: [
    { row: 1, baseRatio: 0.32, receivesRemainingSpace: false, minimumHeight: 210 },
    { row: 2, baseRatio: 0.16, receivesRemainingSpace: false, minimumHeight: 110 },
    { row: 3, baseRatio: 0.26, receivesRemainingSpace: false, minimumHeight: 180 },
    { row: 4, baseRatio: 0.26, receivesRemainingSpace: true, minimumHeight: 180 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    { storyNumber: 3, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 9, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 10, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 11, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 12, row: 4, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

/**
 * The sheet reads as two tall halves: the lead owns the left three columns, a
 * major the right three, and the split carries down the page. Useful when two
 * stories of comparable weight both belong above the fold.
 */
const CLIFF_FRONT_SPLIT_VERTICAL_8A: TemplateDefinition = {
  id: "CliffFrontSplitVertical8A",
  name: "Vertical Split",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.46, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false, minimumHeight: 190 },
    { row: 3, baseRatio: 0.26, receivesRemainingSpace: true, minimumHeight: 180 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 3, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 2, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * A shallow strip of three teasers above the lead — the skybox, used to trail
 * inside pages without spending real estate on them. The lead sits below it and
 * still commands the page.
 *
 * The skybox briefs run two columns each, which is only legal because they are
 * not in the lead's row; a multi-column brief beside the lead would compete
 * with the main headline.
 */
const CLIFF_FRONT_SKYBOX_10A: TemplateDefinition = {
  id: "CliffFrontSkybox10A",
  name: "Skybox Teasers",
  storyCount: 10,
  rowRhythm: [
    { row: 1, baseRatio: 0.1, receivesRemainingSpace: false, minimumHeight: 80 },
    { row: 2, baseRatio: 0.38, receivesRemainingSpace: false, minimumHeight: 240 },
    { row: 3, baseRatio: 0.22, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 4, baseRatio: 0.3, receivesRemainingSpace: true, minimumHeight: 200 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 2, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 3, columnSpan: 2, priority: "brief" },
    { storyNumber: 3, row: 1, columnStart: 5, columnSpan: 2, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 3, priority: "lead" },
    { storyNumber: 6, row: 2, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 8, row: 3, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 9, row: 4, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 10, row: 4, columnStart: 4, columnSpan: 3, priority: "major" },
  ],
};

/**
 * Spans narrow as the page descends — a full-width lead, then halves, then a
 * band of small items, closing on a rail and a wide package. The stepping gives
 * a clear reading order from top to bottom.
 */
const CLIFF_FRONT_PYRAMID_9A: TemplateDefinition = {
  id: "CliffFrontPyramid9A",
  name: "Pyramid",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 200 },
    { row: 2, baseRatio: 0.22, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 3, baseRatio: 0.24, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 4, baseRatio: 0.24, receivesRemainingSpace: true, minimumHeight: 170 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "major" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 1, priority: "brief" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 9, row: 4, columnStart: 2, columnSpan: 5, priority: "major" },
  ],
};

/**
 * A tall picture-led lead taking almost half the sheet, with a companion beside
 * it and two calm bands below. Built for a single strong photograph.
 */
const CLIFF_FRONT_HERO_PHOTO_7A: TemplateDefinition = {
  id: "CliffFrontHeroPhoto7A",
  name: "Hero Photo",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.48, receivesRemainingSpace: false, minimumHeight: 270 },
    { row: 2, baseRatio: 0.26, receivesRemainingSpace: false, minimumHeight: 180 },
    { row: 3, baseRatio: 0.26, receivesRemainingSpace: true, minimumHeight: 180 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "major" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 3, priority: "major" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 3, priority: "major" },
  ],
};

/**
 * CliffEditorial8A
 * The Cliff News editorial/comment page — अभिव्यक्ति — traced off page 8 of the
 * 08 Aug 2026 Bhopal edition.
 *
 * The printed page:
 *
 *   left rail    सम्पादकीय — the leader, one narrow column running the full
 *                depth of the two upper bands
 *   band A       विचार मंथन — signed comment beside the rail: author portrait
 *                and pull quote in its own sub-rail, headline across, photo
 *   band B       a deep spiritual feature built around one large image, with
 *                आज का राशिफल — the 12-cell horoscope — in the outer columns
 *   band C       लाइफ एंड हेल्थ, a social-media roundup of @-handle quotes with
 *                portraits, and संपादक के नाम पत्र
 *
 * The सम्पादकीय rail is one continuous box on the sheet, and it is one box
 * here too. An earlier version carried it as two stacked one-column slots — the
 * trick CliffFront11A uses for its सार-समाचार rail — but two boxes butted
 * together are still two boxes: each grew its own headline and byline, so the
 * leader read as two unrelated briefs rather than one column of comment.
 *
 * Instead the two upper bands are modelled as a single deep row. The rail is
 * one full-depth slot in column 1, and the feature and horoscope are nested
 * into the comment at mid-height rather than being peers of it. That is what
 * `insetInto` is for: the comment keeps its whole five-column measure for its
 * banner and headline, and its body divides around the two boxes below. The
 * store reserves every nested rectangle, so two insets into one parent is
 * supported.
 *
 * Story 2 is the only `lead`. The rail beside it is a one-column `brief`, which
 * is what the priority-band invariant allows next to a lead — a multi-column
 * brief there would compete with the comment headline.
 *
 * `minimumHeight` is slack on both rows for the reason given on CliffFront11A —
 * the priority floors are sized for generic pages and would otherwise beat the
 * ratios and push the upper band deeper still.
 */
/**
 * CliffFrontYouthUpdate1A
 *
 * Publisher-exclusive front page for Youth UPDATE (see YouthUpdateConfig.ts) —
 * never offered to any other publisher. Traced off that publisher's own
 * reference mockup: left rail (सम्पादकीय + short-news brief) beside a lead
 * band, a second band pairing a wide story with a narrower one, and a full-
 * width three-way band at the foot with no rail beside it.
 *
 *   ┌───────┬───────────────────────────────┐
 *   │ 1     │ 2  lead                       │  row 1, 0.45
 *   │ rail  │                               │
 *   ├───────┼─────────────────┬─────────────┤
 *   │ 3     │ 4               │ 5           │  row 2, 0.30
 *   │ rail  │                 │             │
 *   ├───────┴───────┬─────────┴─────────────┤
 *   │ 6              │ 7            │ 8      │  row 3, 0.25 (remainder)
 *   └────────────────┴──────────────┴────────┘
 *
 * The rail (stories 1 and 3) only runs the top two bands, matching the
 * reference — the foot band is full width with no sidebar. `minimumHeight`
 * is stated on all three rows for the reason given on CliffFrontHeroPhoto7A:
 * generic priority floors would otherwise beat these ratios and push the
 * masthead's already-tall reserved band deeper still.
 */
const CLIFF_FRONT_YOUTH_UPDATE_1A: TemplateDefinition = {
  id: "CliffFrontYouthUpdate1A",
  name: "Youth UPDATE — publisher exclusive",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    // सम्पादकीय — editor rail, top band.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    // Short-news rail, second band, beside a wide story and a narrower one.
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 2, columnSpan: 3, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // Foot band — full width, three-way split, no rail.
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

/**
 * ── Youth UPDATE front-page variants (2A / 3A / 4A) ─────────────────────────
 *
 * Three alternative make-ups for the same publisher-exclusive front page, so
 * the picker offers four rather than one. Every one of them is deliberately
 * identical to CliffFrontYouthUpdate1A in three respects, because the coded
 * masthead and the two rails are fixed furniture on this title:
 *
 *   • the same `rowRhythm` — 0.45 / 0.30 / 0.25 with the same minimumHeight
 *     floors, so the rail boxes are the same depth on all four designs and the
 *     masthead band above them reserves the same space;
 *   • story 1 at row 1 / column 1 / span 1 — the सम्पादकीय rail, whose editor
 *     photo + banner are painted as a fixed overlay (see
 *     YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL);
 *   • story 3 at row 2 / column 1 / span 1 — the SHORT NEWS rail, whose banner
 *     is forced in as that slot's photo during import.
 *
 * Only the make-up of columns 2-6 differs. Because rows 1 and 2 both keep
 * column 1 for the rail, and every remaining box is at least two columns wide
 * (bar one deliberate single in 3A), no box on any of these ends up shorter or
 * narrower than 1A's — the row floors, not the story count, decide box depth.
 *
 * Story numbers are not in strict reading order: 1 and 3 are reserved for the
 * two rails, so a design with a third box in the top band has to number it 4.
 * Priority, not storyNumber, is what drives the typography.
 */

/**
 * CliffFrontYouthUpdate2A — split top deck.
 *
 * The Hindu / Deccan Herald pattern: the lead gives up two of its columns to a
 * tall second story on the shoulder, the middle band staggers its division the
 * other way so the column rules do not run straight through both bands, and
 * the foot is a clean two-way split.
 *
 *   ┌───────┬───────────────────┬───────────┐
 *   │ 1     │ 2  lead           │ 4         │  row 1, 0.45
 *   │ rail  │                   │           │
 *   ├───────┼───────────┬───────┴───────────┤
 *   │ 3     │ 5         │ 6                 │  row 2, 0.30
 *   │ rail  │           │                   │
 *   ├───────┴───────────┼───────────────────┤
 *   │ 7                 │ 8                 │  row 3, 0.25 (remainder)
 *   └───────────────────┴───────────────────┘
 */
const CLIFF_FRONT_YOUTH_UPDATE_2A: TemplateDefinition = {
  id: "CliffFrontYouthUpdate2A",
  name: "Youth UPDATE — split top deck",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    // सम्पादकीय rail — fixed, identical on all four designs.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    // Shoulder story beside the lead: "secondary", not "brief" — a brief wider
    // than one column in the lead's own row breaks the priority-band invariant.
    { storyNumber: 4, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    // SHORT NEWS rail — fixed, identical on all four designs.
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 2, priority: "major" },
    { storyNumber: 6, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    // Foot band — full width, halved, no rail beside it.
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

/**
 * CliffFrontYouthUpdate3A — wide lead over a four-across middle band.
 *
 * The Indian Express pattern: the lead keeps its full five-column measure at
 * the top, and the page gets its variety from the band underneath, which runs
 * four stories across in a 2-2-1 division beside the rail. The single-column
 * box at the far right is deliberate — it is the same width as the two rails,
 * so it reads as a matching vertical rather than as a leftover sliver.
 *
 *   ┌───────┬───────────────────────────────┐
 *   │ 1     │ 2  lead                       │  row 1, 0.45
 *   │ rail  │                               │
 *   ├───────┼───────────┬───────────┬───────┤
 *   │ 3     │ 4         │ 5         │ 6     │  row 2, 0.30
 *   │ rail  │           │           │       │
 *   ├───────┴───────────┼───────────┴───────┤
 *   │ 7                 │ 8                 │  row 3, 0.25 (remainder)
 *   └───────────────────┴───────────────────┘
 */
const CLIFF_FRONT_YOUTH_UPDATE_3A: TemplateDefinition = {
  id: "CliffFrontYouthUpdate3A",
  name: "Youth UPDATE — चौड़ी लीड, चार-भाग पट्टी",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 2, columnStart: 2, columnSpan: 2, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 4, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 2, columnStart: 6, columnSpan: 1, priority: "brief" },
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

/**
 * CliffFrontYouthUpdate4A — lead anchored right.
 *
 * The Times of India pattern: the lead sits on the right-hand shoulder rather
 * than immediately beside the rail, with a two-column story filling the gap
 * between them, so the eye enters at the outer edge. The middle band reverses
 * the weighting, and the foot is an asymmetric 2 + 4 split that stops the page
 * from reading as three stacked halves.
 *
 *   ┌───────┬───────────┬───────────────────┐
 *   │ 1     │ 4         │ 2  lead           │  row 1, 0.45
 *   │ rail  │           │                   │
 *   ├───────┼───────────┴───────┬───────────┤
 *   │ 3     │ 5                 │ 6         │  row 2, 0.30
 *   │ rail  │                   │           │
 *   ├───────┴───┬───────────────┴───────────┤
 *   │ 7         │ 8                         │  row 3, 0.25 (remainder)
 *   └───────────┴───────────────────────────┘
 */
const CLIFF_FRONT_YOUTH_UPDATE_4A: TemplateDefinition = {
  id: "CliffFrontYouthUpdate4A",
  name: "Youth UPDATE — दाईं ओर लीड",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 4, row: 1, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 2, row: 1, columnStart: 4, columnSpan: 3, priority: "lead" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 1, priority: "brief" },
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 3, priority: "major" },
    { storyNumber: 6, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 3, columnStart: 3, columnSpan: 4, priority: "secondary" },
  ],
};

/**
 * CliffInsideYouthUpdate1A
 *
 * Publisher-exclusive inside page for Youth UPDATE (see YouthUpdateConfig.ts)
 * — never offered to any other publisher. Traced off that publisher's own
 * reference mockup (`public/youth-update/inside layout.jpeg`): a "SHORT
 * NEWS" rail down the left, beside a lead story and a pair of secondaries
 * beneath it, then a full-width three-way band, then a full-width closer.
 *
 *   ┌───────┬───────────────────────────────┐
 *   │ rail  │ 1  lead                       │  row 1, 0.28
 *   │ (page │                               │
 *   │furnit-├─────────────────┬─────────────┤
 *   │ ure,  │ 2  secondary    │ 3 secondary │  row 2, 0.20
 *   │ no    │                 │             │
 *   │ slot) ├─────────────────┴─────────────┤
 *   ├───────┴───────┬────────────────┬──────┤
 *   │ 4              │ 5             │ 6     │  row 3, 0.14
 *   ├────────────────┴───────────────┴───────┤
 *   │ 7  closer band                          │  row 4, remainder
 *   └──────────────────────────────────────────┘
 *
 * Column 1 carries no slot on rows 1-2 — that's the "SHORT NEWS" rail's own
 * footprint, painted as page furniture (three live headline+body items with
 * dotted separators) rather than composed article boxes, since the article
 * composer has no concept of several independent stories stacked in one box
 * (see YouthUpdateInsideRailGeometry.ts). Rows 3-4 run the full six columns
 * — the rail ends after row 2, matching the reference.
 *
 * `storyCount` here is 7 — the real, composed slots only. The wizard-facing
 * catalogue entry requests 10 articles for this template (7 real slots + 3
 * for the rail); editorStore.ts peels the 3 leftover items into
 * youthUpdateInsideRailStore.ts after the normal per-slot assignment runs.
 */
const CLIFF_INSIDE_YOUTH_UPDATE_1A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate1A",
  name: "Youth UPDATE — inside, publisher exclusive",
  storyCount: 7,
  // Ratios originally measured off the reference mockup (pixel-probed border
  // lines in scratch/ during this feature's build): row1/row2 split the
  // combined [rail+lead+secondary] band 55.8%/44.2%, that whole band 49.6%
  // of the page, row3 15.9%, row4 (remainder) 10.1% -- renormalized against
  // the content area these were 0.366 / 0.290 / 0.210 / rest. Row 4 is a
  // full-width "major"-priority closer, though, and 10% left it visibly
  // shorter than a story of that weight needs; rows 1-3 were each trimmed a
  // few points to give it real room instead.
  rowRhythm: [
    { row: 1, baseRatio: 0.31, receivesRemainingSpace: false, minimumHeight: 235 },
    { row: 2, baseRatio: 0.25, receivesRemainingSpace: false, minimumHeight: 155 },
    { row: 3, baseRatio: 0.17, receivesRemainingSpace: false, minimumHeight: 120 },
    { row: 4, baseRatio: 0.27, receivesRemainingSpace: true, minimumHeight: 190 },
  ],
  slots: [
    // Column 1 deliberately has no slot on rows 1-2 -- reserved for the
    // SHORT NEWS rail (page furniture, see EditorCanvas.tsx).
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    // Full-width three-way band -- no rail beside it.
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "brief" },
    // Full-width closer.
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 6, priority: "major" },
  ],
};

/**
 * अभिव्यक्ति — the editorial page, traced off page 8 of the printed edition.
 *
 * Set on FOUR columns, not the six the news pages use. Measured from the
 * gutters on the printed sheet, the major box edges fall at 1052 / 1576 / 2103
 * / 2646 / 3140 — four divisions of ~522px — and every box is a whole number of
 * them. See `EditorialPageStyle.ts`, which holds the grid and all the other
 * editorial-only measurements.
 *
 *   ┌───────┬───────────────────────────────┐
 *   │ 1     │ 2  signed comment             │  top band, 0.80 of the depth
 *   │ leader│    col 2 = rail, 3–5 = copy   │
 *   │ full  ├─────────────────┬─────────────┤  nested at 0.53 of the band
 *   │ depth │ 3  feature      │ 4  राशिफल   │
 *   ├───────┴─────────────────┼─────────────┤
 *   │ 5  health package       │ 6  letters  │  foot band, 0.20
 *   └─────────────────────────┴─────────────┘
 *
 * Story 1 runs the full depth of the top band, exactly as the printed
 * सम्पादकीय box does; stories 3 and 4 are nested into story 2 at mid-height so
 * the horoscope sits at the right of the middle band where the page puts it.
 */
const CLIFF_INSIDE_YOUTH_UPDATE_2A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate2A",
  name: "Youth UPDATE inside 2A - national rail lead",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.42, receivesRemainingSpace: false, minimumHeight: 250 },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false, minimumHeight: 165 },
    { row: 3, baseRatio: 0.3, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_3A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate3A",
  name: "Youth UPDATE inside 3A - dense Bhaskar grid",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.34, receivesRemainingSpace: false, minimumHeight: 230 },
    { row: 2, baseRatio: 0.27, receivesRemainingSpace: false, minimumHeight: 160 },
    { row: 3, baseRatio: 0.21, receivesRemainingSpace: false, minimumHeight: 135 },
    { row: 4, baseRatio: 0.18, receivesRemainingSpace: true, minimumHeight: 120 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 2, columnSpan: 3, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_4A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate4A",
  name: "Youth UPDATE inside 4A - city visual split",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.5, receivesRemainingSpace: false, minimumHeight: 280 },
    { row: 2, baseRatio: 0.26, receivesRemainingSpace: false, minimumHeight: 170 },
    { row: 3, baseRatio: 0.24, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 2, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_5A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate5A",
  name: "Youth UPDATE inside 5A - Telegraph nation stack",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.32, receivesRemainingSpace: false, minimumHeight: 220 },
    { row: 2, baseRatio: 0.31, receivesRemainingSpace: false, minimumHeight: 175 },
    { row: 3, baseRatio: 0.21, receivesRemainingSpace: false, minimumHeight: 140 },
    { row: 4, baseRatio: 0.16, receivesRemainingSpace: true, minimumHeight: 120 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 6, priority: "major" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_6A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate6A",
  name: "Youth UPDATE inside 6A - OrissaPost mosaic",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false, minimumHeight: 235 },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false, minimumHeight: 165 },
    { row: 3, baseRatio: 0.18, receivesRemainingSpace: false, minimumHeight: 125 },
    { row: 4, baseRatio: 0.16, receivesRemainingSpace: true, minimumHeight: 115 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 2, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 7, row: 4, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_7A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate7A",
  name: "Youth UPDATE inside 7A - picture anchor",
  storyCount: 6,
  rowRhythm: [
    { row: 1, baseRatio: 0.45, receivesRemainingSpace: false, minimumHeight: 270 },
    { row: 2, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 175 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 155 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 2, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 2, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 4, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_8A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate8A",
  name: "Youth UPDATE inside 8A - header-only dense local",
  storyCount: 9,
  rowRhythm: [
    { row: 1, baseRatio: 0.34, receivesRemainingSpace: false, minimumHeight: 260 },
    { row: 2, baseRatio: 0.25, receivesRemainingSpace: false, minimumHeight: 180 },
    { row: 3, baseRatio: 0.21, receivesRemainingSpace: false, minimumHeight: 150 },
    { row: 4, baseRatio: 0.2, receivesRemainingSpace: true, minimumHeight: 140 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 9, row: 4, columnStart: 4, columnSpan: 3, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_9A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate9A",
  name: "Youth UPDATE inside 9A - header-only right rail",
  storyCount: 8,
  rowRhythm: [
    { row: 1, baseRatio: 0.38, receivesRemainingSpace: false, minimumHeight: 285 },
    { row: 2, baseRatio: 0.28, receivesRemainingSpace: false, minimumHeight: 190 },
    { row: 3, baseRatio: 0.18, receivesRemainingSpace: false, minimumHeight: 140 },
    { row: 4, baseRatio: 0.16, receivesRemainingSpace: true, minimumHeight: 130 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 5, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 6, columnSpan: 1, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 6, priority: "major" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_10A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate10A",
  name: "Youth UPDATE inside 10A - header-only ten story",
  storyCount: 10,
  rowRhythm: [
    { row: 1, baseRatio: 0.3, receivesRemainingSpace: false, minimumHeight: 245 },
    { row: 2, baseRatio: 0.25, receivesRemainingSpace: false, minimumHeight: 180 },
    { row: 3, baseRatio: 0.23, receivesRemainingSpace: false, minimumHeight: 165 },
    { row: 4, baseRatio: 0.22, receivesRemainingSpace: true, minimumHeight: 150 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 6, priority: "lead" },
    { storyNumber: 2, row: 2, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 8, row: 4, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 9, row: 4, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 10, row: 4, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

const CLIFF_INSIDE_YOUTH_UPDATE_11A: TemplateDefinition = {
  id: "CliffInsideYouthUpdate11A",
  name: "Youth UPDATE inside 11A - header-only magazine",
  storyCount: 7,
  rowRhythm: [
    { row: 1, baseRatio: 0.48, receivesRemainingSpace: false, minimumHeight: 330 },
    { row: 2, baseRatio: 0.27, receivesRemainingSpace: false, minimumHeight: 185 },
    { row: 3, baseRatio: 0.25, receivesRemainingSpace: true, minimumHeight: 165 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 2, priority: "secondary" },
    { storyNumber: 3, row: 2, columnStart: 1, columnSpan: 3, priority: "secondary" },
    { storyNumber: 4, row: 2, columnStart: 4, columnSpan: 3, priority: "secondary" },
    { storyNumber: 5, row: 3, columnStart: 1, columnSpan: 2, priority: "secondary" },
    { storyNumber: 6, row: 3, columnStart: 3, columnSpan: 2, priority: "secondary" },
    { storyNumber: 7, row: 3, columnStart: 5, columnSpan: 2, priority: "secondary" },
  ],
};

const CLIFF_EDITORIAL_8A: TemplateDefinition = {
  id: "CliffEditorial8A",
  name: "Editorial — अभिव्यक्ति",
  storyCount: 6,
  columnCount: EDITORIAL_COLUMN_COUNT,
  // The comment ends where the feature and the horoscope begin. Without this it
  // keeps the full depth of the band and its copy overruns into them.
  trimToInsets: [2],
  rowRhythm: [
    {
      row: 1,
      baseRatio: EDITORIAL_ROW_RHYTHM.topRatio,
      receivesRemainingSpace: false,
      minimumHeight: EDITORIAL_ROW_RHYTHM.topMinimumHeight,
    },
    {
      row: 2,
      baseRatio: EDITORIAL_ROW_RHYTHM.footRatio,
      receivesRemainingSpace: true,
      minimumHeight: EDITORIAL_ROW_RHYTHM.footMinimumHeight,
    },
  ],
  slots: [
    // सम्पादकीय — the leader, one column running the full depth of the band.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" },
    // विचार मंथन — the signed comment owns the other four: its writer's rail is
    // column 2, its copy runs in columns 3 to 5.
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    // Nested into the comment at mid-height: the feature, then the horoscope
    // in the two outer columns — the twelve signs need the extra measure to set
    // two cells across without the readings breaking every other word.
    {
      storyNumber: 3,
      row: 1,
      columnStart: 2,
      columnSpan: 2,
      priority: "major",
      insetInto: {
        parentStoryNumber: 2,
        topFraction: EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
      },
    },
    {
      storyNumber: 4,
      row: 1,
      columnStart: 4,
      columnSpan: 2,
      priority: "secondary",
      bottomTrimFraction: 0.42,
      insetInto: {
        parentStoryNumber: 2,
        topFraction: EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
      },
    },
    // Foot — the health package and one wide letters column beside it. The two
    // single-column boxes that used to sit here read as offcuts at that measure;
    // merged, the copy has room to set properly.
    { storyNumber: 5, row: 2, columnStart: 1, columnSpan: 3, priority: "secondary" },
    {
      storyNumber: 6,
      row: 2,
      columnStart: 4,
      columnSpan: 2,
      priority: "secondary",
      topExtendFraction: 0.79,
    },
    ],
  };
  
  /**
   * New Modern Editorial Page layout (9A)
   * A 6-story layout using the 5-column editorial grid.
   * Keeps the traditional Left Rail Leader and Signed Comment at the top, 
   * but adds an Editorial Cartoon and Letters box, plus a bottom briefs strip.
   */
  const CLIFF_EDITORIAL_9A: TemplateDefinition = {
    id: "CliffEditorial9A",
    name: "Editorial — Modern Uneven (9A)",
    storyCount: 6,
    columnCount: EDITORIAL_COLUMN_COUNT,
    trimToInsets: [2],
    rowRhythm: [
      {
        row: 1,
        baseRatio: 0.60,
        receivesRemainingSpace: false,
        minimumHeight: 400,
      },
      {
        row: 2,
        baseRatio: 0.40,
        receivesRemainingSpace: true,
        minimumHeight: 250,
      },
    ],
    slots: [
      // ROW 1
      // Leader (Author 1) - Left rail, 1 column wide
      { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "major" },
      
      // Main Op-ed (Author 2) - Center to Right, 4 columns wide
      { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
      
      // Nested Cartoon/Feature inside Main Op-ed (Cols 2-3)
      {
        storyNumber: 3,
        row: 1,
        columnStart: 2,
        columnSpan: 2,
        priority: "secondary",
        insetInto: {
          parentStoryNumber: 2,
          topFraction: EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
        },
      },
      
      // Nested Rashifal inside Main Op-ed (Cols 4-5) - Side by side with Story 3
      {
        storyNumber: 4,
        row: 1,
        columnStart: 4,
        columnSpan: 2,
        priority: "secondary",
        bottomTrimFraction: 0.42,
        insetInto: {
          parentStoryNumber: 2,
          topFraction: EDITORIAL_MIDDLE_BAND_TOP_FRACTION,
        },
      },
      
      // ROW 2
      // Uneven bottom block (Spans columns 1, 2, 3 - breaks left rail)
      { storyNumber: 5, row: 2, columnStart: 1, columnSpan: 3, priority: "secondary" },
      
      // Letters (Spans columns 4, 5 - breaks right rail)
      {
        storyNumber: 6,
        row: 2,
        columnStart: 4,
        columnSpan: 2,
        priority: "secondary",
        topExtendFraction: 0.29,
      },
    ],
  };

const AKHAND_EDITORIAL_5A: TemplateDefinition = {
  id: "AkhandEditorial5A",
  name: "Akhand Doot - Dharm Sanskriti page 5",
  storyCount: 5,
  columnCount: EDITORIAL_COLUMN_COUNT,
  trimToInsets: [1],
  rowRhythm: [
    { row: 1, baseRatio: 0.64, receivesRemainingSpace: false, minimumHeight: 760 },
    { row: 2, baseRatio: 0.36, receivesRemainingSpace: true, minimumHeight: 430 },
  ],
  slots: [
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 4, priority: "lead" },
    { storyNumber: 2, row: 1, columnStart: 5, columnSpan: 1, priority: "secondary" },
    {
      storyNumber: 3,
      row: 1,
      columnStart: 1,
      columnSpan: 4,
      priority: "major",
      insetInto: {
        parentStoryNumber: 1,
        topFraction: 0.66,
      },
    },
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 4, priority: "major" },
    { storyNumber: 5, row: 2, columnStart: 5, columnSpan: 1, priority: "secondary" },
  ],
};

/**
 * Akhand Doot - Vichar Manthan (opinion) page, traced off the publisher's
 * own print PDF. Its own 6-column grid (not EDITORIAL_COLUMN_COUNT, which
 * the two Cliff editorial templates own -- this page measures 16%/67%/17%
 * left/centre/right, which only divides cleanly on six).
 *
 * The centre well runs the SAME pixel width top and bottom (columns 2-5 in
 * both rows) but a different TEXT-column count -- 4 up top, 3 below. That
 * split is not a slot-geometry concern (columnSpan only sets pixel width);
 * it is a per-story `resolvedColumnCount` override in editorStore.ts,
 * mirroring the story-4 override AkhandEditorial5A already uses.
 *
 * The left column's photo box and its caption/op-ed (story 4) runs all the
 * way to the page foot -- there is no row 3 for it to stop short of. Rows 2
 * and 3 are merged into one tall row so story 4 (and गांधी, story 5) can
 * reach the bottom; गांधी and आध्यात्मिक ज्ञान (story 6) are each cut back
 * up to the SAME line with `bottomTrimFraction`/an inset so राशिफल still
 * reads as sitting in its own band below them, at its original 5-column
 * width (2-6) -- it's an inset into story 6 for vertical placement, but
 * states its own wider columnStart/columnSpan (an inset's column range
 * doesn't have to match its parent's, only its top edge is derived from
 * the parent's box).
 */
const AKHAND_VICHAR_MANTHAN_6A: TemplateDefinition = {
  id: "AkhandVicharManthan6A",
  name: "Akhand Doot - Vichar Manthan page 2",
  storyCount: 7,
  columnCount: 6,
  trimToInsets: [6],
  rowRhythm: [
    { row: 1, baseRatio: 0.42, receivesRemainingSpace: false, minimumHeight: 620 },
    { row: 2, baseRatio: 0.58, receivesRemainingSpace: true, minimumHeight: 900 },
  ],
  slots: [
    // Left column, top: मप्र निवेशक -- 1 col, plain text, editorial tag inset in its own copy.
    { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "secondary" },
    // Centre well, top: मुख्य संपादकीय -- 4 text columns (forced via resolvedColumnCount).
    { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 4, priority: "lead" },
    // Right rail, top: सुनी सुनाई -- maroon band header, 2 short items with inset photos.
    { storyNumber: 3, row: 1, columnStart: 6, columnSpan: 1, priority: "secondary" },
    // Left column, bottom: नमो घाट photo + बात मुद्दे की merged into ONE box --
    // olive band header, inset photo, copy below. Runs the FULL row-2 height.
    { storyNumber: 4, row: 2, columnStart: 1, columnSpan: 1, priority: "secondary" },
    // Centre well, bottom: गांधी feature -- same pixel width as story 2, but
    // 3 text columns. Cut back to the same line आध्यात्मिक ज्ञान is, below.
    { storyNumber: 5, row: 2, columnStart: 2, columnSpan: 4, priority: "major", bottomTrimFraction: 0.336 },
    // Right rail, bottom: आध्यात्मिक ज्ञान -- no band header, rose-tinted
    // ground. Trimmed (see trimToInsets) to the same line as story 5 above.
    { storyNumber: 6, row: 2, columnStart: 6, columnSpan: 1, priority: "secondary" },
    // Sits below both 5 and 6, spanning their combined width (2-6): आज का
    // राशिफल -- content-sniffed into the horoscope grid automatically.
    {
      storyNumber: 7,
      row: 2,
      columnStart: 2,
      columnSpan: 5,
      priority: "secondary",
      insetInto: { parentStoryNumber: 6, topFraction: 0.664 },
    },
  ],
};

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateDefinition> = {
  // Original (locked)
  FrontPage5A: FRONT_PAGE_5A,
  // New Indian newspaper layouts
  IndianFront6A: INDIAN_FRONT_6A,
  IndianFront6B: INDIAN_FRONT_6B,
  IndianFront7A: INDIAN_FRONT_7A,
  IndianFront7B: INDIAN_FRONT_7B,
  IndianFront8A: INDIAN_FRONT_8A,
  IndianFront8B: INDIAN_FRONT_8B,
  IndianFront9A: INDIAN_FRONT_9A,
  IndianFront10A: INDIAN_FRONT_10A,
  IndianCity5A: INDIAN_CITY_5A,
  IndianCity6A: INDIAN_CITY_6A,
  IndianSports5A: INDIAN_SPORTS_5A,
  IndianMixed7A: INDIAN_MIXED_7A,
  IndianColumn5A: INDIAN_COLUMN_5A,
  IndianBalance6A: INDIAN_BALANCE_6A,
  ProfessionalNews10A: PROFESSIONAL_NEWS_10A,
  // Advanced Designs
  AdvancedHeroRail7A: ADVANCED_HERO_RAIL_7A,
  AdvancedMosaicGrid8A: ADVANCED_MOSAIC_GRID_8A,
  AdvancedSidebarFeature9A: ADVANCED_SIDEBAR_FEATURE_9A,
  AdvancedMagazineCover6A: ADVANCED_MAGAZINE_COVER_6A,
  AdvancedInfographicSplit7A: ADVANCED_INFOGRAPHIC_SPLIT_7A,
  AdvancedSportsBleed6A: ADVANCED_SPORTS_BLEED_6A,
  AdvancedEditorialColumn7A: ADVANCED_EDITORIAL_COLUMN_7A,
  AdvancedQuadMosaic7A: ADVANCED_QUAD_MOSAIC_7A,
  AdvancedBannerStack10A: ADVANCED_BANNER_STACK_10A,
  AdvancedFeatureWrap9A: ADVANCED_FEATURE_WRAP_9A,
  Layout16: LAYOUT_16,
  // Front page only
  CliffFront11A: CLIFF_FRONT_11A,
  CliffFront8A: CLIFF_FRONT_8A,
  // Front-page shape catalogue
  CliffFrontTwinRail10A: CLIFF_FRONT_TWIN_RAIL_10A,
  CliffFrontBannerLead9A: CLIFF_FRONT_BANNER_LEAD_9A,
  CliffFrontPhotoAnchor8A: CLIFF_FRONT_PHOTO_ANCHOR_8A,
  CliffFrontQuadrant7A: CLIFF_FRONT_QUADRANT_7A,
  CliffFrontMagazine6A: CLIFF_FRONT_MAGAZINE_6A,
  CliffFrontStackedBands7A: CLIFF_FRONT_STACKED_BANDS_7A,
  CliffFrontLWrap9A: CLIFF_FRONT_L_WRAP_9A,
  CliffFrontMosaic12A: CLIFF_FRONT_MOSAIC_12A,
  CliffFrontSplitVertical8A: CLIFF_FRONT_SPLIT_VERTICAL_8A,
  CliffFrontSkybox10A: CLIFF_FRONT_SKYBOX_10A,
  CliffFrontPyramid9A: CLIFF_FRONT_PYRAMID_9A,
  CliffFrontHeroPhoto7A: CLIFF_FRONT_HERO_PHOTO_7A,
  // Editorial page
  CliffEditorial8A: CLIFF_EDITORIAL_8A,
  CliffEditorial9A: CLIFF_EDITORIAL_9A,
  AkhandEditorial5A: AKHAND_EDITORIAL_5A,
  AkhandVicharManthan6A: AKHAND_VICHAR_MANTHAN_6A,
  // Publisher-exclusive (see YouthUpdateConfig.ts) -- kept out of
  // FRONT_PAGE_TEMPLATE_IDS below so it never appears in the shared wizard.
  CliffFrontYouthUpdate1A: CLIFF_FRONT_YOUTH_UPDATE_1A,
  CliffFrontYouthUpdate2A: CLIFF_FRONT_YOUTH_UPDATE_2A,
  CliffFrontYouthUpdate3A: CLIFF_FRONT_YOUTH_UPDATE_3A,
  CliffFrontYouthUpdate4A: CLIFF_FRONT_YOUTH_UPDATE_4A,
  // Publisher-exclusive inside page -- kept out of both FRONT_PAGE_TEMPLATE_IDS
  // and WIZARD_LAYOUT_DESIGNS (the inside picker's own curated list in
  // GenerationWizardModal.tsx) so it never appears in any shared catalogue.
  CliffInsideYouthUpdate1A: CLIFF_INSIDE_YOUTH_UPDATE_1A,
  CliffInsideYouthUpdate2A: CLIFF_INSIDE_YOUTH_UPDATE_2A,
  CliffInsideYouthUpdate3A: CLIFF_INSIDE_YOUTH_UPDATE_3A,
  CliffInsideYouthUpdate4A: CLIFF_INSIDE_YOUTH_UPDATE_4A,
  CliffInsideYouthUpdate5A: CLIFF_INSIDE_YOUTH_UPDATE_5A,
  CliffInsideYouthUpdate6A: CLIFF_INSIDE_YOUTH_UPDATE_6A,
  CliffInsideYouthUpdate7A: CLIFF_INSIDE_YOUTH_UPDATE_7A,
  CliffInsideYouthUpdate8A: CLIFF_INSIDE_YOUTH_UPDATE_8A,
  CliffInsideYouthUpdate9A: CLIFF_INSIDE_YOUTH_UPDATE_9A,
  CliffInsideYouthUpdate10A: CLIFF_INSIDE_YOUTH_UPDATE_10A,
  CliffInsideYouthUpdate11A: CLIFF_INSIDE_YOUTH_UPDATE_11A,
};

/**
 * Templates the wizard's "Front Page" tab offers. Everything else in the
 * registry belongs to the inside-page catalogue.
 */
export const FRONT_PAGE_TEMPLATE_IDS: TemplateId[] = [
  "CliffFront8A",
  "CliffFront11A",
  "CliffFrontTwinRail10A",
  "CliffFrontBannerLead9A",
  "CliffFrontPhotoAnchor8A",
  "CliffFrontQuadrant7A",
  "CliffFrontMagazine6A",
  "CliffFrontLWrap9A",
  "CliffFrontMosaic12A",
  "CliffFrontSplitVertical8A",
  "CliffFrontSkybox10A",
  "CliffFrontPyramid9A",
  "CliffFrontHeroPhoto7A",
];

export const isFrontPageTemplate = (templateId: TemplateId) =>
  FRONT_PAGE_TEMPLATE_IDS.includes(templateId);

/**
 * Designs offered only on the Editorial Page tab. Kept separate from both the
 * front-page and inside-page catalogues: an editorial page has its own furniture
 * (a leader rail, a horoscope block) and is not interchangeable with either.
 */
export const EDITORIAL_PAGE_TEMPLATE_IDS: TemplateId[] = [
  "CliffEditorial8A",
  "CliffEditorial9A",
  "AkhandEditorial5A",
  "AkhandVicharManthan6A",
];

export const isEditorialPageTemplate = (templateId: TemplateId) =>
  EDITORIAL_PAGE_TEMPLATE_IDS.includes(templateId);

export const getTemplateDefinition = (templateId: TemplateId) => TEMPLATE_REGISTRY[templateId];

/**
 * The column grid a template's slots are stated against.
 *
 * Every news template returns `fallback` — the page master's six columns —
 * exactly as before. Only the editorial page declares its own, so this can be
 * called unconditionally at the layout call sites without changing any other
 * page's geometry by a single point.
 */
export const getTemplateColumnCount = (templateId: TemplateId, fallback: number) =>
  TEMPLATE_REGISTRY[templateId]?.columnCount ?? fallback;
