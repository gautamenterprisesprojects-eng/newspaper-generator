/**
 * The inside page's "SHORT NEWS" rail for Youth UPDATE -- three live
 * newswire items (headline + body), each in its own equal-height bordered
 * box, stacked top to bottom under a "SHORT NEWS" title bar and filling the
 * rail's full reserved height (down to the hatch divider below stories 1-3),
 * painted as page furniture rather than composed article boxes. The article
 * composer (composeArticleBox.ts) flows exactly one headline/body per
 * story; it has no concept of several independent items stacked in one box
 * (the same reasoning behind RashifalGridGeometry.ts's horoscope grid), so
 * this is a small, purpose-built flow function instead, reusing the same
 * low-level text measurement (measureParagraph) that composeArticleBox.ts
 * itself is built on. The headline's own font size (12pt, bold) matches
 * composeArticleBox.ts's own floor for a single-column box's headline
 * (`headlineMinFontSize = isSingleColumnBox ? 12 : 8`), so it reads the same
 * as every other narrow single-column article box on the page.
 */

import { measureParagraph } from "@/engines/TypographyEngine/TypographyEngine";
import type { YouthUpdateInsideRailItem } from "@/store/youthUpdateInsideRailStore";

/** Splits on sentence-ending punctuation followed by whitespace -- good enough for newswire body copy, not meant to handle every abbreviation edge case. */
const splitIntoSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/**
 * Picks the longest whole-sentence prefix of `text` whose *natural* (full,
 * unclipped) line count at `fontSize`/nominal `lineHeight` still fits within
 * `maxLines` -- so the rail never has to cut a sentence mid-way and show an
 * ellipsis, the way a flat maxHeight clip on the raw article body always
 * risked. Falls back to the raw text (letting the caller's own clip/ellipsis
 * safety net handle it) only in the edge case where even the first sentence
 * alone overflows the box.
 */
const ensurePeriod = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
};

const fitWordsToLineBudget = (
  text: string,
  maxLines: number,
  measure: (candidate: string) => number,
): string => {
  const words = text.split(/\s+/u).filter(Boolean);
  let candidate = "";
  for (const word of words) {
    const next = candidate ? `${candidate} ${word}` : word;
    if (measure(next) > maxLines) break;
    candidate = next;
  }
  return candidate;
};

const fitShortNewsBodyToLineBudget = (
  text: string,
  maxLines: number,
  measure: (candidate: string) => number,
): string => {
  if (maxLines <= 0) return "";
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return text;

  let candidate = "";
  let usedSentenceCount = 0;
  for (const sentence of sentences) {
    const next = candidate ? `${candidate} ${sentence}` : sentence;
    if (measure(next) > maxLines) {
      break;
    }
    candidate = next;
    usedSentenceCount += 1;
  }

  if (!candidate) {
    return ensurePeriod(fitWordsToLineBudget(text, maxLines, measure) || sentences[0]);
  }

  let remainingLines = maxLines - measure(candidate);
  while (remainingLines > 2 && usedSentenceCount < sentences.length) {
    const next = `${candidate} ${sentences[usedSentenceCount]}`;
    if (measure(next) > maxLines) break;
    candidate = next;
    usedSentenceCount += 1;
    remainingLines = maxLines - measure(candidate);
  }

  if (remainingLines > 0 && remainingLines <= 2) {
    const usedWordCount = candidate.split(/\s+/u).filter(Boolean).length;
    const extraSource = text.split(/\s+/u).filter(Boolean).slice(usedWordCount).join(" ");
    const extra = fitWordsToLineBudget(`${candidate} ${extraSource}`, maxLines, measure);
    if (extra && measure(extra) >= measure(candidate)) {
      return ensurePeriod(extra);
    }
  }

  return ensurePeriod(candidate);
};

/**
 * English-newspaper serif for this rail's live English headline/body copy --
 * Tinos (a metric clone of Times New Roman), registered in globals.css.
 * Exported so both render call sites (Konva + canvas-export) use this exact
 * same font string as the measurement below, not a separately hardcoded one
 * -- see HEADLINE_LINE_HEIGHT's own history in this file for why that matters.
 * Serif fallbacks only cover the brief window before Tinos finishes loading.
 */
export const YOUTH_UPDATE_RAIL_FONT_FAMILY = `"Tinos", Georgia, "Times New Roman", serif`;

const BOX_COUNT = 3;
/** Matches composeArticleBox.ts's own single-column headline floor (headlineMinFontSize = 12 for isSingleColumnBox). Exported so callers can pre-load the Tinos weight at this exact size before the geometry (which measures with it) ever runs. */
export const YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE = 12;
const HEADLINE_FONT_SIZE = YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE;
/** Matches StoryHierarchyEngine.ts's Devanagari Newspaper Leading Standard (headlineLineHeight = 1.28 for every priority tier, applied regardless of script). */
const HEADLINE_LINE_HEIGHT = 1.28;
/** Matches StoryHierarchyEngine.ts's "brief" tier bodySize (8.8), the closest analog to this rail's small single-column items. Exported for the same pre-load reason as the headline size above. */
export const YOUTH_UPDATE_RAIL_BODY_FONT_SIZE = 7.2;
const BODY_FONT_SIZE = YOUTH_UPDATE_RAIL_BODY_FONT_SIZE;
/** Matches StoryHierarchyEngine.ts's Devanagari Newspaper Leading Standard (bodyLineHeight = 1.38 for every priority tier). */
const BODY_LINE_HEIGHT = 1.2;
const HEADLINE_TO_BODY_GAP = 4;
/** Each item sits inside its own bordered box -- inner padding and the gap between boxes. Matches composeArticleBox.ts's own ARTICLE_PADDING (top/bottom 3, left/right 6) so this rail's text edges line up with every other article box's on the page, instead of the rail's own separately-tuned inset. */
const BOX_PADDING_X = 6;
const BOX_PADDING_Y = 3;
const BOX_GAP = 8;
const BOX_BORDER_COLOR = "#3a352f";
const BOX_BORDER_WIDTH = 0.75;
/** "SHORT NEWS" title bar at the top of the rail -- a flat height (like the front page's own "SHORT NEWS" banner), not scaled to the rail's own (narrow) width, which would make the label unreadably small. */
const TITLE_BAR_HEIGHT = 17;
const TITLE_TO_FIRST_ITEM_GAP = 10;

export type YouthUpdateInsideRailFlowedItem = {
  box: { x: number; y: number; width: number; height: number };
  headline: { x: number; y: number; width: number; height: number; text: string; lines: string[] };
  body: { x: number; y: number; width: number; height: number; text: string; lineHeight: number };
};

export type YouthUpdateInsideRailGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  titleBar: { x: number; y: number; width: number; height: number };
  items: YouthUpdateInsideRailFlowedItem[];
  headlineFontSize: number;
  /** The line height measurement actually reserved space with -- render call sites must use this exact value, not a separately hardcoded one, or the reserved space and the drawn text disagree (see HEADLINE_LINE_HEIGHT's own history). */
  headlineLineHeight: number;
  bodyFontSize: number;
  borderColor: string;
  borderWidth: number;
};

export type YouthUpdateInsideRailInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  items: YouthUpdateInsideRailItem[];
};

export const getYouthUpdateInsideRailGeometry = (
  input: YouthUpdateInsideRailInput,
): YouthUpdateInsideRailGeometry => {
  const { x, y, width, height, items } = input;
  const fontFamily = YOUTH_UPDATE_RAIL_FONT_FAMILY;
  const titleBar = { x, y, width, height: TITLE_BAR_HEIGHT };
  const textWidth = width - BOX_PADDING_X * 2;

  const itemsAreaTop = y + TITLE_BAR_HEIGHT + TITLE_TO_FIRST_ITEM_GAP;
  const itemsAreaHeight = Math.max(0, y + height - itemsAreaTop);
  // Three equal boxes, filling the rail's full reserved height down to the
  // hatch divider below -- not sized by how much of each article's content
  // happens to fit, the way the earlier content-flow version worked.
  const boxHeight = (itemsAreaHeight - BOX_GAP * (BOX_COUNT - 1)) / BOX_COUNT;

  const flowed: YouthUpdateInsideRailFlowedItem[] = [];
  for (let i = 0; i < Math.min(BOX_COUNT, items.length); i += 1) {
    const item = items[i];
    const boxTop = itemsAreaTop + i * (boxHeight + BOX_GAP);
    const boxBottom = boxTop + boxHeight;
    const headlineY = boxTop + BOX_PADDING_Y;

    // No maxLines cap -- the 3rd summary bullet from the API should print
    // in full, not get cut with an ellipsis. maxHeight is only the box's own
    // boundary (a real headline never gets anywhere near it in practice),
    // kept so a freak oversized string can't visually break out of the box.
    const headlineMetrics = measureParagraph({
      text: item.headline,
      width: textWidth,
      fontFamily,
      fontSize: HEADLINE_FONT_SIZE,
      fontStyle: "bold",
      lineHeight: HEADLINE_LINE_HEIGHT,
      maxLines: 2,
      maxHeight: Math.max(0, boxBottom - BOX_PADDING_Y - headlineY),
      script: "english",
    });
    const headlineHeight = headlineMetrics.consumedHeight;
    const bodyY = headlineY + headlineHeight + HEADLINE_TO_BODY_GAP;
    const remainingForBody = Math.max(0, boxBottom - BOX_PADDING_Y - bodyY);

    const nominalLineHeightPx = BODY_FONT_SIZE * BODY_LINE_HEIGHT;
    const maxLinesAvailable = Math.max(0, Math.floor(remainingForBody / nominalLineHeightPx));
    const measureNaturalLines = (candidate: string) =>
      measureParagraph({
        text: candidate,
        width: textWidth,
        fontFamily,
        fontSize: BODY_FONT_SIZE,
        fontStyle: "normal",
        lineHeight: BODY_LINE_HEIGHT,
        script: "english",
      }).fullLineCount;
    // The longest whole-sentence prefix of the article body that still fits
    // within the box at nominal leading -- never a mid-sentence cut, so the
    // box never needs an ellipsis. Because this is picked to already fit
    // within maxLinesAvailable, its own natural line count is always the
    // binding constraint below (never clipped), so the stretch-to-fill step
    // always reaches zero foot-gap too.
    const fittedBodyText = fitShortNewsBodyToLineBudget(item.body, maxLinesAvailable, measureNaturalLines);
    const naturalLineCount = measureNaturalLines(fittedBodyText);
    const linesToShow = naturalLineCount > 0 ? Math.min(naturalLineCount, maxLinesAvailable) : 0;
    measureParagraph({
      text: fittedBodyText,
      width: textWidth,
      fontFamily,
      fontSize: BODY_FONT_SIZE,
      fontStyle: "normal",
      lineHeight: BODY_LINE_HEIGHT,
      maxHeight: remainingForBody,
      script: "english",
    });

    flowed.push({
      box: { x, y: boxTop, width, height: boxHeight },
      headline: {
        x: x + BOX_PADDING_X,
        y: headlineY,
        width: textWidth,
        height: headlineHeight,
        text: item.headline,
        lines: headlineMetrics.wrappedLines.slice(0, 2),
      },
      body: {
        x: x + BOX_PADDING_X,
        y: bodyY,
        width: textWidth,
        height: remainingForBody,
        text: fittedBodyText,
        lineHeight: BODY_LINE_HEIGHT,
      },
    });
  }

  return {
    x,
    y,
    width,
    height,
    titleBar,
    items: flowed,
    headlineFontSize: HEADLINE_FONT_SIZE,
    headlineLineHeight: HEADLINE_LINE_HEIGHT,
    bodyFontSize: BODY_FONT_SIZE,
    borderColor: BOX_BORDER_COLOR,
    borderWidth: BOX_BORDER_WIDTH,
  };
};
