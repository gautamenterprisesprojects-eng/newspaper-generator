import type { TextMeasurementInput, TextMetricsProvider } from "./TypographyTypes";

const contextCache = new Map<string, TextMetricsProvider>();

/**
 * Per-font memo of measured widths.
 *
 * Canvas `measureText` was the single largest cost in a CPU profile of page
 * generation — ~10s of roughly 24s of real work — because composition measures
 * the same words over and over: every fitting pass, every candidate font size
 * and every re-flow re-measures text it has already seen.
 *
 * Width is a pure function of (font, string), so memoising it cannot change a
 * layout: identical inputs return the identical number they returned before.
 * Only the arithmetic for letter/word spacing sits outside this, and that is
 * applied to the cached base width exactly as it was to the measured one.
 */
const widthCaches = new Map<string, Map<string, number>>();

/**
 * Cap per font, so a long session cannot grow the memo without bound. On
 * overflow the memo is emptied rather than evicted one by one — measurement is
 * cheap to redo and an LRU would cost more than it saves here.
 */
const MAX_CACHED_WIDTHS_PER_FONT = 20000;

/**
 * Drops every memoised width.
 *
 * Must be called whenever text metrics can change underneath the cache. The one
 * case that matters in practice is webfont loading: text measured while the
 * Devanagari faces are still loading is measured against a fallback and comes
 * back a different width, and without this those wrong widths would be pinned
 * for the rest of the session.
 */
export const clearTextMeasurementCache = () => {
  for (const cache of widthCaches.values()) {
    cache.clear();
  }
};

if (typeof document !== "undefined" && document.fonts) {
  // `loadingdone` fires after each batch of faces finishes; re-measuring from
  // scratch at that point is what keeps the memo honest.
  document.fonts.addEventListener?.("loadingdone", clearTextMeasurementCache);
}

export const quoteFontFamily = (fontFamily: string) =>
  fontFamily
    .split(",")
    .map((family) => {
      const trimmed = family.trim();

      if (!trimmed || trimmed.startsWith('"') || trimmed.includes(" ")) {
        return trimmed.startsWith('"') ? trimmed : `"${trimmed}"`;
      }

      return trimmed;
    })
    .join(", ");

export const createCanvasFontString = (
  fontFamily: string,
  fontSize: number,
  fontStyle = "normal",
) => `${fontStyle} ${fontSize}px ${quoteFontFamily(fontFamily)}`;

export const createCanvasTextMeasure = (
  fontFamily: string,
  fontSize: number,
  fontStyle = "normal",
): TextMetricsProvider => {
  const cacheKey = `${fontFamily}:${fontSize}:${fontStyle}`;
  const cached = contextCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1)
      : typeof document !== "undefined"
        ? document.createElement("canvas")
        : null;

  const context = canvas?.getContext("2d");

  if (!context) {
    throw new Error("Canvas text measurement is unavailable in this runtime.");
  }

  context.font = createCanvasFontString(fontFamily, fontSize, fontStyle);

  let widths = widthCaches.get(cacheKey);
  if (!widths) {
    widths = new Map<string, number>();
    widthCaches.set(cacheKey, widths);
  }
  const memo = widths;

  const provider: TextMetricsProvider = {
    measureText: (text) => {
      const hit = memo.get(text);

      if (hit !== undefined) {
        return { width: hit };
      }

      const width = context.measureText(text).width;

      if (memo.size >= MAX_CACHED_WIDTHS_PER_FONT) {
        memo.clear();
      }
      memo.set(text, width);

      return { width };
    },
  };

  contextCache.set(cacheKey, provider);

  return provider;
};

/**
 * Vertical ink metrics for one run of text, in px, relative to its baseline.
 *
 * Separate from `createCanvasTextMeasure` on purpose, for two reasons: that
 * provider is typed width-only (`Pick<TextMetrics, "width">`) and memoises on
 * width alone, and it *throws* when no canvas exists. This returns `null`
 * instead, so a caller running outside a DOM (the test runner) can fall back to
 * whatever it did before rather than crash.
 *
 * `fontDescent` is the descender depth the font reserves for every line
 * regardless of content; `actualDescent` is how much of it this particular
 * string really uses — 0 for a Latin line with no descenders, close to (or past)
 * `fontDescent` for Devanagari, whose conjuncts and matras genuinely paint down
 * there. The difference between the two is empty space that a fixed,
 * content-blind leading model cannot see.
 */
export type TextInkMetrics = {
  fontDescent: number;
  actualDescent: number;
  /** Ascent the font reserves above the baseline for every line, ink or not. */
  fontAscent: number;
  /** How much of it this string actually uses — cap height for plain capitals. */
  actualAscent: number;
};

const inkMetricsCaches = new Map<string, Map<string, TextInkMetrics>>();

export const measureTextInkMetrics = (
  input: Pick<TextMeasurementInput, "text" | "fontFamily" | "fontSize" | "fontStyle">,
): TextInkMetrics | null => {
  const cacheKey = `${input.fontFamily}:${input.fontSize}:${input.fontStyle ?? "normal"}`;
  let memo = inkMetricsCaches.get(cacheKey);
  if (!memo) {
    memo = new Map<string, TextInkMetrics>();
    inkMetricsCaches.set(cacheKey, memo);
  }
  const hit = memo.get(input.text);
  if (hit) return hit;

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1)
      : typeof document !== "undefined"
        ? document.createElement("canvas")
        : null;
  const context = canvas?.getContext("2d");
  if (!context) return null;

  context.font = createCanvasFontString(input.fontFamily, input.fontSize, input.fontStyle);
  const metrics = context.measureText(input.text);
  // fontBoundingBox* is unavailable in some engines; without it there is no
  // reserved-descender figure to compare against, so report nothing rather than
  // guess one.
  if (typeof metrics.fontBoundingBoxDescent !== "number") return null;

  const result: TextInkMetrics = {
    fontDescent: Math.max(0, metrics.fontBoundingBoxDescent),
    actualDescent: Math.max(0, metrics.actualBoundingBoxDescent ?? 0),
    fontAscent: Math.max(0, metrics.fontBoundingBoxAscent ?? 0),
    actualAscent: Math.max(0, metrics.actualBoundingBoxAscent ?? 0),
  };
  if (memo.size >= MAX_CACHED_WIDTHS_PER_FONT) memo.clear();
  memo.set(input.text, result);
  return result;
};

/**
 * Width of `text` including tracking and word spacing.
 *
 * Canvas `measureText` has no notion of letter or word spacing, so both are
 * added arithmetically: tracking applies to each gap between characters, word
 * spacing to each inter-word space. Both default to 0, so every existing caller
 * measures exactly as before.
 */
export const measureTextWidth = (
  input: TextMeasurementInput,
  provider = createCanvasTextMeasure(input.fontFamily, input.fontSize, input.fontStyle),
) => {
  const baseWidth = provider.measureText(input.text).width;
  const letterSpacing = input.letterSpacing ?? 0;
  const wordSpacing = input.wordSpacing ?? 0;

  if (letterSpacing === 0 && wordSpacing === 0) {
    return baseWidth;
  }

  const characters = Array.from(input.text);
  const trackingWidth = letterSpacing * Math.max(0, characters.length - 1);
  const wordSpacingWidth =
    wordSpacing * characters.reduce((count, character) => (/\s/u.test(character) ? count + 1 : count), 0);

  return baseWidth + trackingWidth + wordSpacingWidth;
};
