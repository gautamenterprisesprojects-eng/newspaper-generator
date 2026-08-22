import type { RichTextContent, RichTextDocument, RichTextSpan, RichTextStyle } from "@/types/RichText";

const STYLE_KEYS: (keyof RichTextStyle)[] = [
  "bold",
  "italic",
  "underline",
  "color",
  "backgroundColor",
  "opacity",
  "fontSize",
  "fontWeight",
  "characterSpacing",
  "horizontalScale",
  "verticalScale",
  "superscript",
  "subscript",
  "smallCaps",
  "openTypeFeatures",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isRichTextDocument = (value: unknown): value is RichTextDocument =>
  isObject(value) && Array.isArray(value.spans);

export const hasRichTextStyling = (value: RichTextContent): boolean => {
  const document = normalizeRichText(value);

  return document.spans.some((span) =>
    STYLE_KEYS.some((key) => span[key] !== undefined && span[key] !== false && span[key] !== ""),
  );
};

const normalizeSpan = (span: unknown): RichTextSpan | null => {
  if (!isObject(span) || typeof span.text !== "string" || span.text.length === 0) {
    return null;
  }

  const normalized: RichTextSpan = {
    text: span.text,
  };

  if (typeof span.bold === "boolean") {
    normalized.bold = span.bold;
  }

  if (typeof span.italic === "boolean") {
    normalized.italic = span.italic;
  }

  if (typeof span.underline === "boolean") {
    normalized.underline = span.underline;
  }

  if (typeof span.color === "string" && span.color.trim()) {
    normalized.color = span.color;
  }

  if (typeof span.backgroundColor === "string" && span.backgroundColor.trim()) {
    normalized.backgroundColor = span.backgroundColor;
  }

  if (typeof span.opacity === "number" && Number.isFinite(span.opacity)) {
    normalized.opacity = Math.min(Math.max(span.opacity, 0), 1);
  }

  if (typeof span.fontSize === "number" && Number.isFinite(span.fontSize) && span.fontSize > 0) {
    normalized.fontSize = span.fontSize;
  }

  if (typeof span.fontWeight === "number" && Number.isFinite(span.fontWeight) && span.fontWeight > 0) {
    normalized.fontWeight = span.fontWeight;
  }

  if (typeof span.characterSpacing === "number" && Number.isFinite(span.characterSpacing)) {
    normalized.characterSpacing = span.characterSpacing;
  }

  if (typeof span.horizontalScale === "number" && Number.isFinite(span.horizontalScale)) {
    normalized.horizontalScale = span.horizontalScale;
  }

  if (typeof span.verticalScale === "number" && Number.isFinite(span.verticalScale)) {
    normalized.verticalScale = span.verticalScale;
  }

  if (typeof span.superscript === "boolean") {
    normalized.superscript = span.superscript;
  }

  if (typeof span.subscript === "boolean") {
    normalized.subscript = span.subscript;
  }

  if (typeof span.smallCaps === "boolean") {
    normalized.smallCaps = span.smallCaps;
  }

  if (Array.isArray(span.openTypeFeatures)) {
    normalized.openTypeFeatures = span.openTypeFeatures.filter(
      (feature): feature is string => typeof feature === "string" && feature.trim().length > 0,
    );
  }

  return normalized;
};

const getStyleSignature = (span: RichTextSpan) =>
  STYLE_KEYS.map((key) => `${key}:${span[key] ?? ""}`).join("|");

const spansAreCompatible = (first: RichTextSpan, second: RichTextSpan) =>
  getStyleSignature(first) === getStyleSignature(second);

export const plainTextToRichText = (text: string): RichTextDocument => ({
  spans: text ? [{ text }] : [],
});

export const richTextToPlainText = (value: RichTextContent): string => {
  if (typeof value === "string") {
    return value;
  }

  return normalizeRichText(value).spans.map((span) => span.text).join("");
};

export const cloneRichText = (value: RichTextContent): RichTextDocument =>
  normalizeRichText(value);

export const mergeAdjacentCompatibleSpans = (document: RichTextDocument): RichTextDocument => {
  const merged: RichTextSpan[] = [];

  for (const span of document.spans) {
    const previous = merged.at(-1);

    if (previous && spansAreCompatible(previous, span)) {
      previous.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }

  return {
    spans: merged,
  };
};

export const normalizeRichText = (value: RichTextContent | unknown): RichTextDocument => {
  if (typeof value === "string") {
    return plainTextToRichText(value);
  }

  if (!isRichTextDocument(value)) {
    return {
      spans: [],
    };
  }

  return mergeAdjacentCompatibleSpans({
    spans: value.spans.flatMap((span) => {
      const normalized = normalizeSpan(span);

      return normalized ? [normalized] : [];
    }),
  });
};

const splitSpanAt = (span: RichTextSpan, offset: number) => {
  if (offset <= 0) {
    return [null, { ...span }] as const;
  }

  if (offset >= span.text.length) {
    return [{ ...span }, null] as const;
  }

  return [
    {
      ...span,
      text: span.text.slice(0, offset),
    },
    {
      ...span,
      text: span.text.slice(offset),
    },
  ] as const;
};

const splitDocumentByRange = (document: RichTextDocument, start: number, end: number) => {
  const before: RichTextSpan[] = [];
  const inside: RichTextSpan[] = [];
  const after: RichTextSpan[] = [];
  let cursor = 0;

  for (const span of document.spans) {
    const spanStart = cursor;
    const spanEnd = cursor + span.text.length;
    cursor = spanEnd;

    if (spanEnd <= start) {
      before.push({ ...span });
      continue;
    }

    if (spanStart >= end) {
      after.push({ ...span });
      continue;
    }

    const rangeStart = Math.max(start, spanStart) - spanStart;
    const rangeEnd = Math.min(end, spanEnd) - spanStart;
    const [left, remainder] = splitSpanAt(span, rangeStart);

    if (left) {
      before.push(left);
    }

    if (!remainder) {
      continue;
    }

    const [middle, right] = splitSpanAt(remainder, rangeEnd - rangeStart);

    if (middle) {
      inside.push(middle);
    }

    if (right) {
      after.push(right);
    }
  }

  return {
    before,
    inside,
    after,
  };
};

export const applyStyleToRange = (
  value: RichTextContent,
  start: number,
  end: number,
  style: RichTextStyle,
): RichTextDocument => {
  const document = normalizeRichText(value);
  const plainTextLength = richTextToPlainText(document).length;
  const safeStart = Math.max(0, Math.min(start, plainTextLength));
  const safeEnd = Math.max(safeStart, Math.min(end, plainTextLength));

  if (safeStart === safeEnd) {
    return document;
  }

  const split = splitDocumentByRange(document, safeStart, safeEnd);

  return normalizeRichText({
    spans: [
      ...split.before,
      ...split.inside.map((span) => ({
        ...span,
        ...style,
      })),
      ...split.after,
    ],
  });
};

export const removeStyleFromRange = (
  value: RichTextContent,
  start: number,
  end: number,
  styleKeys: (keyof RichTextStyle)[],
): RichTextDocument => {
  const document = normalizeRichText(value);
  const plainTextLength = richTextToPlainText(document).length;
  const safeStart = Math.max(0, Math.min(start, plainTextLength));
  const safeEnd = Math.max(safeStart, Math.min(end, plainTextLength));

  if (safeStart === safeEnd) {
    return document;
  }

  const split = splitDocumentByRange(document, safeStart, safeEnd);

  return normalizeRichText({
    spans: [
      ...split.before,
      ...split.inside.map((span) => {
        const next = { ...span };

        for (const key of styleKeys) {
          delete next[key];
        }

        return next;
      }),
      ...split.after,
    ],
  });
};

export const normalizeRunBoundaries = (value: RichTextContent | unknown): RichTextDocument => {
  const doc = normalizeRichText(value);
  const spans = doc.spans.map((span) => ({ ...span }));

  for (let i = 0; i < spans.length - 1; i++) {
    const prev = spans[i];
    const next = spans[i + 1];

    const prevText = prev.text;
    const nextText = next.text;

    if (!prevText || !nextText) continue;
    if (/\s$/u.test(prevText) || /^\s/u.test(nextText)) continue;

    // Do not insert spaces before `, . । ॥ ? !`
    if (/^[,.।॥?!]/u.test(nextText)) continue;

    // Do not insert inside Devanagari grapheme clusters (combining vowel matra, anusvara, visarga, nukta, etc.)
    if (/^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]/u.test(nextText)) continue;

    // Do not insert inside conjuncts (previous ends with halant/virama \u094D or joiners)
    if (/[\u094D\u200C\u200D]$/u.test(prevText)) continue;

    // Do not insert inside numbers (previous ends with digit and next starts with digit/decimal)
    if (/\d+$/u.test(prevText) && /^[0-9.,]/u.test(nextText)) continue;

    // Do not insert inside valid abbreviations (e.g., ends with dot)
    if (/\.$/.test(prevText)) continue;

    // Check if previous ends with letter/number and next begins with letter/number
    const prevEndsWithLetterOrNumber = /[\p{L}\p{N}\u0900-\u097F]$/u.test(prevText);
    const nextBeginsWithLetterOrNumber = /^[\p{L}\p{N}\u0900-\u097F]/u.test(nextText);

    if (prevEndsWithLetterOrNumber && nextBeginsWithLetterOrNumber) {
      // Insert a lexical space when the runs represent separate word tokens
      prev.text += " ";
    }
  }

  return mergeAdjacentCompatibleSpans({ spans });
};

export const RichTextUtils = {
  applyStyleToRange,
  cloneRichText,
  hasRichTextStyling,
  isRichTextDocument,
  mergeAdjacentCompatibleSpans,
  normalizeRichText,
  normalizeRunBoundaries,
  plainTextToRichText,
  removeStyleFromRange,
  richTextToPlainText,
};
