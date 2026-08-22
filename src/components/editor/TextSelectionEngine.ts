import type { RichTextContent, RichTextDocument, RichTextStyle } from "@/types/RichText";
import {
  applyStyleToRange,
  normalizeRichText,
  removeStyleFromRange,
  richTextToPlainText,
} from "@/engines/RichText/RichTextUtils";

export interface TextSelectionRange {
  start: number;
  end: number;
}

export type EditorialTextSelectionField =
  | "headline"
  | "subheadline"
  | "kicker"
  | "strap"
  | "caption"
  | "body"
  | "pullQuote"
  | "factBoxHeadline"
  | "factBoxBullets";

export type BulletSelectionRange = {
  bulletIndex: number;
  range: TextSelectionRange;
};

export const clearableRichTextStyleKeys: (keyof RichTextStyle)[] = [
  "bold",
  "italic",
  "underline",
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
];

export const normalizeSelectionRange = (range: TextSelectionRange): TextSelectionRange => ({
  start: Math.max(0, Math.min(range.start, range.end)),
  end: Math.max(0, Math.max(range.start, range.end)),
});

export const hasTextSelection = (range: TextSelectionRange): boolean => {
  const normalized = normalizeSelectionRange(range);

  return normalized.end > normalized.start;
};

export const applyStyleToSelection = (
  content: RichTextContent,
  range: TextSelectionRange,
  style: RichTextStyle,
): RichTextDocument => {
  const normalized = normalizeSelectionRange(range);

  if (!hasTextSelection(normalized)) {
    return normalizeRichText(content);
  }

  return applyStyleToRange(content, normalized.start, normalized.end, style);
};

export const removeStyleFromSelection = (
  content: RichTextContent,
  range: TextSelectionRange,
  styleKeys: (keyof RichTextStyle)[],
): RichTextDocument => {
  const normalized = normalizeSelectionRange(range);

  if (!hasTextSelection(normalized)) {
    return normalizeRichText(content);
  }

  return removeStyleFromRange(content, normalized.start, normalized.end, styleKeys);
};

export const clearFormattingFromSelection = (
  content: RichTextContent,
  range: TextSelectionRange,
): RichTextDocument => removeStyleFromSelection(content, range, clearableRichTextStyleKeys);

export const mapJoinedTextSelectionToBulletRanges = (
  bullets: RichTextContent[],
  range: TextSelectionRange,
): BulletSelectionRange[] => {
  const normalized = normalizeSelectionRange(range);
  const mappedRanges: BulletSelectionRange[] = [];
  let cursor = 0;

  bullets.forEach((bullet, bulletIndex) => {
    const bulletText = richTextToPlainText(bullet);
    const bulletStart = cursor;
    const bulletEnd = bulletStart + bulletText.length;
    const start = Math.max(normalized.start, bulletStart);
    const end = Math.min(normalized.end, bulletEnd);

    if (end > start) {
      mappedRanges.push({
        bulletIndex,
        range: {
          start: start - bulletStart,
          end: end - bulletStart,
        },
      });
    }

    cursor = bulletEnd + 1;
  });

  return mappedRanges;
};

export const TextSelectionEngine = {
  applyStyleToSelection,
  clearFormattingFromSelection,
  clearableRichTextStyleKeys,
  hasTextSelection,
  mapJoinedTextSelectionToBulletRanges,
  normalizeSelectionRange,
  removeStyleFromSelection,
};
