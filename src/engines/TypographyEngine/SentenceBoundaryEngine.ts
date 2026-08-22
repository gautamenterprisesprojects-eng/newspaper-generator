const ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "jr",
  "vs",
  "inc",
  "ltd",
  "co",
  "st",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
  "u.s",
  "u.k",
  "e.g",
  "i.e",
  "डॉ",
  "प्रो",
  "श्री",
  "श्रीमती",
  "पं",
  "ई",
  "कृ",
  "सं",
]);

const TERMINATOR_REGEX = /[।॥.!?]/u;

/**
 * Checks if character at `index` in `text` is a valid sentence-ending punctuation.
 * Ignores abbreviations (e.g. Dr., Mr., U.S., डॉ.) and numeric decimals (e.g. 3.14, 36,441).
 */
export const isSentenceBoundaryAt = (text: string, index: number): boolean => {
  if (index < 0 || index >= text.length) {
    return false;
  }

  const char = text[index];

  if (!TERMINATOR_REGEX.test(char)) {
    return false;
  }

  // 1. Check for numeric decimal e.g. "3.14" or "36.4"
  if (char === ".") {
    const prevChar = index > 0 ? text[index - 1] : "";
    const nextChar = index + 1 < text.length ? text[index + 1] : "";

    if (/\d/u.test(prevChar) && /\d/u.test(nextChar)) {
      return false;
    }
  }

  // 2. Check for abbreviations e.g. "Dr.", "U.S.", "डॉ."
  const precedingSubstring = text.slice(Math.max(0, index - 20), index);
  const precedingWords = precedingSubstring.trim().split(/\s+/u);
  const lastWord = precedingWords.at(-1)?.toLowerCase().replace(/^[^\w\u0900-\u097F]+/u, "") ?? "";

  if (ABBREVIATIONS.has(lastWord)) {
    return false;
  }

  // 3. Ensure terminator is followed by whitespace, quote, bracket, or end of string
  if (index + 1 < text.length) {
    const nextChar = text[index + 1];

    if (!/[\s"'”’)\}\]\n।॥]/u.test(nextChar)) {
      return false;
    }
  }

  return true;
};

/**
 * Finds the index of the next valid sentence-ending punctuation at or after `startIndex`.
 */
export const findNextSentenceBoundary = (text: string, startIndex = 0): number => {
  for (let index = Math.max(0, startIndex); index < text.length; index += 1) {
    if (isSentenceBoundaryAt(text, index)) {
      return index;
    }
  }

  return -1;
};

/**
 * Finds the index of the previous valid sentence-ending punctuation at or before `startIndex`.
 */
export const findPreviousSentenceBoundary = (text: string, startIndex = text.length - 1): number => {
  for (let index = Math.min(text.length - 1, startIndex); index >= 0; index -= 1) {
    if (isSentenceBoundaryAt(text, index)) {
      return index;
    }
  }

  return -1;
};

const CLAUSE_TERMINATOR_REGEX = /[,;:]/u;

/**
 * Checks if character at `index` is a valid clause boundary (comma, semicolon, colon).
 * Ignores thousands-separator commas inside numbers (e.g. "36,441").
 */
export const isClauseBoundaryAt = (text: string, index: number): boolean => {
  if (index < 0 || index >= text.length) {
    return false;
  }

  const char = text[index];

  if (!CLAUSE_TERMINATOR_REGEX.test(char)) {
    return false;
  }

  if (char === ",") {
    const prevChar = index > 0 ? text[index - 1] : "";
    const nextChar = index + 1 < text.length ? text[index + 1] : "";

    if (/\d/u.test(prevChar) && /\d/u.test(nextChar)) {
      return false;
    }
  }

  return true;
};

/**
 * Finds the index of the nearest clause boundary (comma/semicolon/colon) at or before
 * `startIndex`, but only if it lies within `maxWordGap` words of `startIndex` — a clause
 * boundary that's too far back would discard as much real content as a full sentence
 * rollback, defeating its purpose as a lighter-weight cut point. Returns -1 if none is
 * found within that window.
 */
export const findNearbyPreviousClauseBoundary = (
  text: string,
  startIndex: number,
  maxWordGap = 30,
): number => {
  for (let index = Math.min(text.length - 1, startIndex); index >= 0; index -= 1) {
    if (isClauseBoundaryAt(text, index)) {
      const gapWords = text.slice(index + 1, startIndex + 1).trim().split(/\s+/u).filter(Boolean).length;
      return gapWords <= maxWordGap ? index : -1;
    }
  }

  return -1;
};

/**
 * Ensures text ends cleanly at a sentence-ending punctuation mark (। or . or ! or ?).
 */
export const ensureTextEndsWithFullStop = (text: string): string => {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  const lastCharIndex = trimmed.length - 1;

  if (isSentenceBoundaryAt(trimmed, lastCharIndex) || /[।॥.!?]\s*$/u.test(trimmed)) {
    return trimmed;
  }

  const isHindi = /[\u0900-\u097F]/u.test(trimmed);

  return `${trimmed}${isHindi ? " ।" : "."}`;
};

/**
 * Extracts text starting from the beginning up to a complete sentence boundary near or after `targetWordCount`.
 *
 * Requirements enforced:
 * 1. Does not stop mid-sentence when capacity is reached.
 * 2. Continues adding text until the first sentence-ending punctuation is encountered.
 * 3. Enforces runaway sentence protection (max 80 additional words after limit).
 * 4. Ignores abbreviations and decimals.
 */
export const extractTextToSentenceEnd = ({
  text,
  targetWordCount,
  maxOverflowWords = 80,
}: {
  text: string;
  targetWordCount?: number;
  maxOverflowWords?: number;
}): string => {
  const cleaned = text.replace(/\r/g, "").trim();

  if (!cleaned) {
    return "";
  }

  if (!targetWordCount || targetWordCount <= 0) {
    return ensureTextEndsWithFullStop(cleaned);
  }

  const words = cleaned.split(/\s+/u);

  if (words.length <= targetWordCount) {
    return ensureTextEndsWithFullStop(cleaned);
  }

  // Determine character position for targetWordCount
  const targetCharIndex = words.slice(0, targetWordCount).join(" ").length;

  // Search for the first valid sentence boundary AT or AFTER targetCharIndex
  const boundaryAfter = findNextSentenceBoundary(cleaned, targetCharIndex);

  if (boundaryAfter !== -1) {
    const candidateText = cleaned.slice(0, boundaryAfter + 1).trim();
    const candidateWords = candidateText.split(/\s+/u).length;

    // Check edge case: runaway sentence (> maxOverflowWords beyond target)
    if (candidateWords - targetWordCount <= maxOverflowWords) {
      return ensureTextEndsWithFullStop(candidateText);
    }

    // Runaway sentence fallback: check if paragraph break exists before boundaryAfter
    const nextParagraphIndex = cleaned.indexOf("\n\n", targetCharIndex);
    if (nextParagraphIndex !== -1 && nextParagraphIndex < boundaryAfter) {
      const paragraphCandidate = cleaned.slice(0, nextParagraphIndex).trim();
      return ensureTextEndsWithFullStop(paragraphCandidate);
    }
  }

  // Fallback 1: check if a valid sentence boundary exists before targetCharIndex
  const boundaryBefore = findPreviousSentenceBoundary(cleaned, targetCharIndex);
  if (boundaryBefore !== -1 && boundaryBefore > targetCharIndex * 0.4) {
    return ensureTextEndsWithFullStop(cleaned.slice(0, boundaryBefore + 1).trim());
  }

  // Fallback 2: include up to targetWordCount and append full stop
  return ensureTextEndsWithFullStop(words.slice(0, targetWordCount).join(" "));
};

/**
 * Determines the character offset of the last rendered character in the frame.
 */
export const findCutoffIndexInFullText = (visibleLines: (string | { text: string })[], fullText: string): number => {
  if (visibleLines.length === 0 || !fullText) {
    return -1;
  }

  const visibleWords = visibleLines
    .map((l) => (typeof l === "string" ? l.trim() : l.text.trim()))
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!visibleWords) {
    return -1;
  }

  const exactMatch = fullText.lastIndexOf(visibleWords);
  if (exactMatch !== -1) {
    return exactMatch + visibleWords.length - 1;
  }

  const visibleWordList = visibleWords.split(/\s+/u).filter(Boolean);
  for (let take = Math.min(visibleWordList.length, 5); take >= 1; take -= 1) {
    const suffix = visibleWordList.slice(visibleWordList.length - take).join(" ");
    const suffixMatch = fullText.lastIndexOf(suffix);
    if (suffixMatch !== -1) {
      return suffixMatch + suffix.length - 1;
    }
  }

  return Math.min(fullText.length - 1, visibleWords.length - 1);
};

/**
 * Returns true if the text already ends at a sentence boundary at cutoffIndex or last visible line.
 */
export const isAlreadyAtSentenceEnd = (
  fullText: string,
  cutoffIndex: number,
  visibleLines: (string | { text: string })[],
): boolean => {
  if (isSentenceBoundaryAt(fullText, cutoffIndex)) {
    return true;
  }

  if (cutoffIndex >= fullText.length - 2 && /[।॥.!?]\s*$/u.test(fullText)) {
    return true;
  }

  if (visibleLines.length > 0) {
    const lastLine = visibleLines[visibleLines.length - 1];
    const lastLineText = (typeof lastLine === "string" ? lastLine : lastLine.text).trim();

    // Validate against isSentenceBoundaryAt (with full fullText context) at
    // the terminator's real position, rather than trusting the isolated
    // line's raw regex match. The line alone has no context to know it's
    // actually an abbreviation ("डॉ.") or a decimal ("3.5") sitting right at
    // a wrap boundary — a bare regex would misread either as a real
    // sentence end and skip the trim-to-boundary logic below, leaving text
    // that's genuinely mid-sentence.
    if (lastLineText && /[।॥.!?]$/u.test(lastLineText)) {
      const terminatorChar = lastLineText[lastLineText.length - 1];
      const terminatorIndex = fullText.lastIndexOf(terminatorChar, Math.max(0, cutoffIndex));

      if (terminatorIndex !== -1 && isSentenceBoundaryAt(fullText, terminatorIndex)) {
        return true;
      }
    }
  }

  return false;
};


export const SentenceBoundaryEngine = {
  ensureTextEndsWithFullStop,
  extractTextToSentenceEnd,
  findNextSentenceBoundary,
  findPreviousSentenceBoundary,
  isSentenceBoundaryAt,
  findCutoffIndexInFullText,
  isAlreadyAtSentenceEnd,
  isClauseBoundaryAt,
  findNearbyPreviousClauseBoundary,
};

