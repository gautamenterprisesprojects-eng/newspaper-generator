import { measureTextWidth } from "./TextMeasure";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import type {
  HeadlineBalanceInput,
  HeadlineCandidateScore,
  HeadlineCandidateType,
  HeadlineLayoutMode,
  HeadlineBalanceResult,
  TextMeasureOptions,
  TypographyLine,
} from "./TypographyTypes";

type HeadlineWord = {
  text: string;
  start: number;
  end: number;
};

type HeadlineCandidate = {
  lines: TypographyLine[];
  score: number;
  type: HeadlineCandidateType;
  visualBalanceScore: number;
  finalLineRatio: number;
  readableFinalLine: boolean;
  selectionReason: string;
};

const DEFAULT_HEADLINE_FONT = getNewspaperFontStack("serif");
const MIN_ALLOWED_FINAL_LINE_RATIO = 0.35;
const MIN_FINAL_LINE_RATIO = 0.66;
const VERY_SHORT_FINAL_LINE_RATIO = 0.5;
const IDEAL_FINAL_LINE_RATIO = 0.82;
const MIN_UPPER_LINE_RATIO = 0.72;
const IDEAL_TWO_LINE_RATIO_DELTA = 0.18;
const HYPHENATION_TRIGGER_UNUSED_RATIO = 0.1;
const HYPHENATION_TARGET_FILL_RATIO = 0.95;
const IDEAL_FULL_WIDTH_RATIO = 0.94;
const IDEAL_FIRST_LINE_MIN_RATIO = 0.9;
const IDEAL_FIRST_LINE_MAX_RATIO = 0.98;
const NEWSPAPER_LINE_1_REJECT_FLOOR = 0.85;
const NEWSPAPER_LINE_1_TARGET_MIN = 0.9;
const NEWSPAPER_LINE_2_TARGET_MIN = 0.84;
const NEWSPAPER_LINE_TARGET_MAX = 0.98;

const normalizeHeadline = (headline: string) => headline.replace(/\s+/gu, " ").trim();

const PROTECTED_PHRASES: string[] = [
  "नीरज चोपड़ा",
  "लवलीना बोरगोहेन",
  "अस्मिता डे",
  "हर्ष सिंह",
  "उन्नति हुड्डा",
  "तन्वी शर्मा",
  "नरेंद्र मोदी",
  "अमित शाह",
  "द्रौपदी मुर्मू",
  "राहुल गांधी",
  "विराट कोहली",
  "रोहित शर्मा",
  "सचिन तेंदुलकर",
  "नई दिल्ली",
  "मध्य प्रदेश",
  "उत्तर प्रदेश",
  "हिमाचल प्रदेश",
  "आंध्र प्रदेश",
  "पश्चिम बंगाल",
  "ग्लासगो",
  "भोपाल",
  "इंदौर",
  "ग्वालियर",
  "जबलपुर",
  "उज्जैन",
  "साल्ट लेक",
  "ताइपे ओपन",
  "भारतीय नौसेना",
  "भारतीय सेना",
  "भारतीय वायुसेना",
  "भारतीय दल",
  "कॉमनवेल्थ गेम्स",
  "डायमंड लीग",
  "वर्ल्ड बैडमिंटन",
  "बैडमिंटन संघ",
  "टी-20 वर्ल्ड कप",
  "टी-20 विश्व कप",
  "इंडियन सुपर लीग",
  "मोहन बगान",
  "सुपर जायंट्स",
  "बीजेपी",
  "कांग्रेस",
  "इसरो",
  "डीआरडीओ",
  "भारत सरकार",
  "राज्य सरकार",
  "केंद्र सरकार",
  "संयुक्त राष्ट्र",
  "विश्व स्वास्थ्य संगठन",
  "जल संसाधन",
  "सिंचाई परियोजनाओं",
];

const UNBREAKABLE_SINGLE_WORDS = new Set([
  "भारत", "में", "की", "का", "और", "है", "था", "हो", "ने", "से", "पर", "को", "भी", "दिया", "लिया",
  "गया", "करा", "हुए", "हुई", "कर", "रहे", "रही", "तथा", "एवं", "द्वारा", "तक", "के", "से",
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is", "was", "are", "were", "by", "with"
]);

const splitsProtectedPhrase = (lines: TypographyLine[]): boolean => {
  if (lines.length <= 1) return false;
  const fullText = lines.map((l) => l.text).join(" ");
  for (const phrase of PROTECTED_PHRASES) {
    if (fullText.includes(phrase)) {
      const intact = lines.some((l) => l.text.includes(phrase));
      if (!intact) {
        return true;
      }
    }
  }
  return false;
};

const isSingleWordOrParticleFinalLine = (lines: TypographyLine[]): boolean => {
  if (lines.length <= 1) return false;
  const finalLine = lines[lines.length - 1];
  const words = finalLine.text.trim().split(/\s+/u).filter(Boolean);
  if (words.length <= 1) return true;
  if (words.length === 2 && UNBREAKABLE_SINGLE_WORDS.has(words[0]) && UNBREAKABLE_SINGLE_WORDS.has(words[1])) {
    return true;
  }
  return false;
};

const getUglyShapePenalty = (lines: TypographyLine[], availableWidth: number): number => {
  if (lines.length !== 2) return 0;
  const r1 = lines[0].width / Math.max(1, availableWidth);
  const r2 = lines[1].width / Math.max(1, availableWidth);
  if (r1 >= 0.90 && r2 < 0.45) return 250;
  if (r1 < 0.50 && r2 >= 0.85) return 250;
  return 0;
};

const getWords = (headline: string): HeadlineWord[] => {
  const words: HeadlineWord[] = [];
  const pattern = /\S+/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(headline)) !== null) {
    words.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
};

const measureLine = (
  words: HeadlineWord[],
  startIndex: number,
  endIndex: number,
  fontFamily: string,
  fontSize: number,
  fontStyle?: string,
  options?: TextMeasureOptions,
): TypographyLine => {
  const text = words.slice(startIndex, endIndex + 1).map((word) => word.text).join(" ");

  return {
    text,
    start: words[startIndex].start,
    end: words[endIndex].end,
    width: measureTextWidth(
      {
        text,
        fontFamily,
        fontSize,
        fontStyle,
      },
      options?.provider,
    ),
  };
};

const countWords = (line: TypographyLine) => line.text.split(/\s+/u).filter(Boolean).length;

const getWordsInText = (text: string) => text.split(/\s+/u).filter(Boolean);

const getVisualLength = (text: string) => Array.from(text.replace(/[^\p{L}\p{N}\p{M}]/gu, "")).length;

const isHindiText = (text: string) => /\p{Script=Devanagari}/u.test(text);
const endsWithDevanagariVirama = (text: string) => /\u094D$/u.test(text);
const startsWithDevanagariMark = (text: string) => /^[\u0900-\u0903\u093A-\u094F\u0951-\u0957]/u.test(text);

const segmentGraphemes = (text: string) => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }

  return Array.from(text);
};

const getHyphenationBreaks = (word: string) => {
  if (word.includes("-") || getVisualLength(word) < 6) {
    return [];
  }

  if (isHindiText(word)) {
    const graphemes = segmentGraphemes(word);

    return graphemes
      .map((_, index) => index + 1)
      .filter((breakIndex) => breakIndex >= 2 && breakIndex <= graphemes.length - 1)
      .map((breakIndex) => ({
        prefix: graphemes.slice(0, breakIndex).join(""),
        suffix: graphemes.slice(breakIndex).join(""),
      }))
      .filter(
        (part) =>
          getVisualLength(part.prefix) >= 2 &&
          getVisualLength(part.suffix) >= 2 &&
          !endsWithDevanagariVirama(part.prefix) &&
          !startsWithDevanagariMark(part.suffix),
      );
  }

  return Array.from({ length: Math.max(0, word.length - 6) })
    .map((_, index) => index + 4)
    .filter((breakIndex) => breakIndex <= word.length - 3)
    .map((breakIndex) => ({
      prefix: word.slice(0, breakIndex),
      suffix: word.slice(breakIndex),
    }));
};

const createMeasuredLine = (
  text: string,
  referenceLine: TypographyLine,
  fontFamily: string,
  fontSize: number,
  fontStyle?: string,
  options?: TextMeasureOptions,
): TypographyLine => ({
  text,
  start: referenceLine.start,
  end: referenceLine.start + text.length,
  width: measureTextWidth({ text, fontFamily, fontSize, fontStyle }, options?.provider),
});

const hasPartialLookingFinalFragment = (line: TypographyLine) => {
  const words = getWordsInText(line.text);
  const finalWord = words.at(-1) ?? "";
  const finalWordLength = getVisualLength(finalWord);
  const totalVisualLength = getVisualLength(line.text);

  if (words.length === 0) {
    return true;
  }

  if (finalWordLength <= 2) {
    return true;
  }

  return words.length <= 2 && totalVisualLength <= 8;
};

const getAverage = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const getNewspaperUsableCandidates = (
  candidates: HeadlineCandidate[],
  availableWidth: number,
  headlineLayoutMode: HeadlineLayoutMode,
) => {
  if (headlineLayoutMode !== "newspaper-fill") {
    return candidates;
  }

  const strongLine1Candidates = candidates.filter(
    (candidate) =>
      candidate.lines.length === 1 ||
      getLineFill(candidate, 0, availableWidth) >= NEWSPAPER_LINE_1_REJECT_FLOOR,
  );

  return strongLine1Candidates.length > 0 ? strongLine1Candidates : candidates;
};

const getLineFill = (candidate: HeadlineCandidate, lineIndex: number, availableWidth: number) =>
  (candidate.lines[lineIndex]?.width ?? 0) / Math.max(1, availableWidth);

const getUnusedPixels = (candidate: HeadlineCandidate, availableWidth: number) =>
  candidate.lines.reduce((sum, line) => sum + Math.max(0, availableWidth - line.width), 0);

const createCandidateScore = (
  candidate: HeadlineCandidate,
  availableWidth: number,
): HeadlineCandidateScore => ({
  type: candidate.type,
  lines: candidate.lines.map((line) => line.text),
  line1FillPercent: Math.round(getLineFill(candidate, 0, availableWidth) * 1000) / 10,
  line2FillPercent: Math.round(getLineFill(candidate, 1, availableWidth) * 1000) / 10,
  unusedPixels: Math.round(getUnusedPixels(candidate, availableWidth) * 10) / 10,
  score: Math.round(candidate.score * 1000) / 1000,
  reason: candidate.selectionReason,
});

const applyNewspaperFillSelectionScore = (
  candidates: HeadlineCandidate[],
  availableWidth: number,
) => {
  const line1FillCandidates = candidates.filter(
    (candidate) => getLineFill(candidate, 0, availableWidth) >= NEWSPAPER_LINE_1_REJECT_FLOOR,
  );
  const hasStrongLine1Alternative = line1FillCandidates.length > 0;
  const eligibleCandidates = hasStrongLine1Alternative ? line1FillCandidates : candidates;
  const maxLine1WordCount = Math.max(
    0,
    ...eligibleCandidates.map((candidate) => countWords(candidate.lines[0])),
  );
  const maxLine1Width = Math.max(
    0,
    ...eligibleCandidates
      .filter((candidate) => countWords(candidate.lines[0]) === maxLine1WordCount)
      .map((candidate) => candidate.lines[0]?.width ?? 0),
  );

  return candidates.map((candidate) => {
    const line1WordCount = countWords(candidate.lines[0]);
    const line1Width = candidate.lines[0]?.width ?? 0;
    const line1Fill = getLineFill(candidate, 0, availableWidth);
    const line2Fill = getLineFill(candidate, 1, availableWidth);
    const weakLine1Penalty =
      hasStrongLine1Alternative && line1Fill < NEWSPAPER_LINE_1_REJECT_FLOOR
        ? 1_000_000
        : 0;
    const line1WordPenalty = (maxLine1WordCount - line1WordCount) * 100_000;
    const line1WidthPenalty =
      line1WordCount === maxLine1WordCount ? Math.max(0, maxLine1Width - line1Width) * 100 : 0;
    const selectionReason =
      candidate.type === "hyphenated"
        ? "hyphenated fallback filled line 1 after whole-word candidates"
        : line1WordCount === maxLine1WordCount && line1Fill >= NEWSPAPER_LINE_1_TARGET_MIN
          ? `newspaper-fill: longest valid first line (${line1WordCount} words), L1 ${Math.round(
              line1Fill * 1000,
            ) / 10}%, L2 ${Math.round(line2Fill * 1000) / 10}%`
          : weakLine1Penalty > 0
            ? "rejected: first line below newspaper-fill threshold while stronger candidate exists"
            : "newspaper-fill fallback: best available first-line utilization";

    return {
      ...candidate,
      score: candidate.score + weakLine1Penalty + line1WordPenalty + line1WidthPenalty,
      selectionReason,
    };
  });
};

const getCandidateQuality = (
  lines: TypographyLine[],
  availableWidth: number,
  forceFullWidth = false,
  headlineLayoutMode: HeadlineLayoutMode = "newspaper-fill",
) => {
  if (lines.length === 0 || availableWidth <= 0) {
    return {
      score: Infinity,
      visualBalanceScore: 0,
      finalLineRatio: 0,
      readableFinalLine: false,
    };
  }

  const widths = lines.map((line) => line.width);
  const averageWidth = getAverage(widths);
  const maxWidth = Math.max(...widths);
  const minWidth = Math.min(...widths);
  const finalLineRatio = widths[widths.length - 1] / availableWidth;
  const lineRatios = widths.map((width) => width / Math.max(1, availableWidth));
  const wordCounts = lines.map(countWords);
  const averageWords = getAverage(wordCounts);
  const finalWordRatio = wordCounts[wordCounts.length - 1] / Math.max(1, averageWords);
  const finalLine = lines[lines.length - 1];
  const finalWords = getWordsInText(finalLine.text);
  const finalVisualLength = getVisualLength(finalLine.text);
  const finalLineLooksComplete =
    finalWords.length >= 3 &&
    finalVisualLength >= 10 &&
    !hasPartialLookingFinalFragment(finalLine);
  const readableFinalLine =
    lines.length === 1 ||
    ((finalLineRatio >= MIN_ALLOWED_FINAL_LINE_RATIO ||
      (lines.length === 2 && lineRatios[0] >= IDEAL_FIRST_LINE_MIN_RATIO && finalLineLooksComplete)) &&
      !hasPartialLookingFinalFragment(finalLine) &&
      !(finalWords.length <= 2 && finalVisualLength <= 10));
  const balancePenalty =
    widths.reduce((sum, width) => sum + Math.pow(width - averageWidth, 2), 0) /
    Math.max(1, availableWidth * availableWidth * widths.length);
  const spreadPenalty = (maxWidth - minWidth) / Math.max(1, availableWidth);
  const looseFitPenalty =
    widths.reduce((sum, width) => sum + Math.pow((availableWidth - width) / availableWidth, 2), 0) /
    widths.length;
  const fullWidthPenalty = forceFullWidth
    ? lineRatios.reduce(
        (penalty, ratio) => penalty + Math.pow(Math.max(0, IDEAL_FULL_WIDTH_RATIO - ratio), 2) * 18,
        0,
      )
    : 0;
  const singleWordLinePenalty = wordCounts.reduce((penalty, words, index) => {
    if (words !== 1 || lines.length === 1) {
      return penalty;
    }

    return penalty + (index === lines.length - 1 ? 14 : 4);
  }, 0);
  const underfilledLinePenalty = lineRatios.reduce((penalty, ratio, index) => {
    if (lines.length === 1) {
      return penalty;
    }

    if (index === lines.length - 1) {
      return penalty + Math.pow(Math.max(0, IDEAL_FINAL_LINE_RATIO - ratio), 2) * 4;
    }

    return penalty + Math.pow(Math.max(0, MIN_UPPER_LINE_RATIO - ratio), 2) * 14;
  }, 0);
  const incompleteFinalLinePenalty =
    lines.length > 1
      ? Math.pow(Math.max(0, 0.72 - finalLineRatio), 2) * 12 +
        Math.pow(Math.max(0, 0.85 - finalWordRatio), 2) * 5
      : 0;
  const brokenFinalLinePenalty =
    lines.length > 1 && finalLineRatio < MIN_ALLOWED_FINAL_LINE_RATIO && !finalLineLooksComplete
      ? 120
      : 0;
  const finalFragmentPenalty =
    lines.length > 1 && hasPartialLookingFinalFragment(finalLine) ? 36 : 0;
  const shortFinalWordsPenalty =
    lines.length > 1 && finalWords.length <= 2 && finalVisualLength <= 10 ? 28 : 0;
  const shortFinalLinePenalty =
    finalLineRatio < VERY_SHORT_FINAL_LINE_RATIO
      ? 22
      : finalLineRatio < MIN_FINAL_LINE_RATIO
        ? 11
        : 0;
  const descendingShapePenalty =
    lines.length > 1 && widths[widths.length - 1] > widths[0] * 1.12
      ? Math.pow(widths[widths.length - 1] / Math.max(1, widths[0]) - 1.12, 2) * 16
      : 0;
  const twoLineSymmetryPenalty =
    lines.length === 2
      ? Math.pow(Math.max(0, Math.abs(widths[0] - widths[1]) / availableWidth - IDEAL_TWO_LINE_RATIO_DELTA), 2) *
        10
      : 0;
  const threeLinePenalty = lines.length === 3 ? 2.4 : lines.length > 3 ? lines.length * 2 : 0;
  const orphanFinalPenalty =
    lines.length > 1 && wordCounts[wordCounts.length - 1] <= 2 && finalLineRatio < 0.78 ? 4 : 0;
  const protectedPhrasePenalty = splitsProtectedPhrase(lines) ? 400 : 0;
  const singleWordFinalLinePenalty = isSingleWordOrParticleFinalLine(lines) ? 500 : 0;
  const shapePenalty = getUglyShapePenalty(lines, availableWidth);

  const visualPenalty =
    balancePenalty * 28 +
    spreadPenalty * 10 +
    underfilledLinePenalty +
    fullWidthPenalty +
    shortFinalLinePenalty +
    incompleteFinalLinePenalty +
    brokenFinalLinePenalty +
    finalFragmentPenalty +
    shortFinalWordsPenalty +
    descendingShapePenalty +
    twoLineSymmetryPenalty +
    orphanFinalPenalty +
    threeLinePenalty +
    protectedPhrasePenalty +
    singleWordFinalLinePenalty +
    shapePenalty;
  const visualBalanceScore = Math.round(Math.max(0, Math.min(100, 100 - visualPenalty * 7)));
  const newspaperFillScore =
    headlineLayoutMode === "newspaper-fill" && lines.length >= 2
      ? -(
          (lineRatios[0] ?? 0) * 95 +
          (lineRatios[1] ?? 0) * 90 +
          Math.min(...lineRatios) * 160 -
          widths.reduce((sum, width) => sum + Math.max(0, availableWidth - width), 0)
        ) +
        Math.pow(Math.max(0, NEWSPAPER_LINE_1_TARGET_MIN - (lineRatios[0] ?? 0)), 2) * 4 +
        Math.pow(Math.max(0, NEWSPAPER_LINE_2_TARGET_MIN - (lineRatios[1] ?? 0)), 2) * 8 +
        Math.pow(Math.max(0, (lineRatios[0] ?? 0) - NEWSPAPER_LINE_TARGET_MAX), 2) * 0.5 +
        Math.pow(Math.max(0, (lineRatios[1] ?? 0) - NEWSPAPER_LINE_TARGET_MAX), 2) * 0.25 +
        balancePenalty * 0.18 +
        brokenFinalLinePenalty +
        finalFragmentPenalty +
        shortFinalWordsPenalty * 0.5 +
        singleWordLinePenalty * 0.35 +
        threeLinePenalty +
        protectedPhrasePenalty * 100 +
        singleWordFinalLinePenalty * 100 +
        shapePenalty * 50
      : null;
  const twoLineNewspaperScore =
    headlineLayoutMode === "balanced" && lines.length === 2
      ? -(lineRatios[0] * 5 + lineRatios[1]) +
        balancePenalty * 0.5 +
        Math.pow(Math.max(0, IDEAL_FIRST_LINE_MIN_RATIO - lineRatios[0]), 2) * 20 +
        Math.pow(Math.max(0, lineRatios[0] - IDEAL_FIRST_LINE_MAX_RATIO), 2) * 8 +
        brokenFinalLinePenalty +
        finalFragmentPenalty +
        shortFinalWordsPenalty * 0.4 +
        singleWordLinePenalty * 0.35
      : null;
  const legacyScore =
    balancePenalty * 22 +
    spreadPenalty * 8 +
    looseFitPenalty +
    fullWidthPenalty +
    singleWordLinePenalty +
    underfilledLinePenalty +
    incompleteFinalLinePenalty +
    brokenFinalLinePenalty +
    finalFragmentPenalty +
    shortFinalWordsPenalty +
    shortFinalLinePenalty +
    descendingShapePenalty +
    twoLineSymmetryPenalty +
    orphanFinalPenalty +
    threeLinePenalty +
    lines.length * 0.15;

  return {
    visualBalanceScore,
    finalLineRatio,
    readableFinalLine,
    score: newspaperFillScore ?? twoLineNewspaperScore ?? legacyScore,
  };
};

const generateCandidates = (
  words: HeadlineWord[],
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  fontStyle: string | undefined,
  maxLines: number,
  forceFullWidth: boolean,
  headlineLayoutMode: HeadlineLayoutMode,
  options?: TextMeasureOptions,
) => {
  const candidates: HeadlineCandidate[] = [];
  const currentLines: TypographyLine[] = [];

  const visit = (wordIndex: number) => {
    if (wordIndex === words.length) {
      const lines = [...currentLines];
      const quality = getCandidateQuality(lines, availableWidth, forceFullWidth, headlineLayoutMode);

      candidates.push({
        lines,
        score: quality.score,
        type: headlineLayoutMode === "newspaper-fill" ? "newspaper-fill" : "balanced",
        visualBalanceScore: quality.visualBalanceScore,
        finalLineRatio: quality.finalLineRatio,
        readableFinalLine: quality.readableFinalLine,
        selectionReason:
          headlineLayoutMode === "newspaper-fill"
            ? "candidate generated for newspaper-fill scoring"
            : "candidate generated for balanced scoring",
      });
      return;
    }

    if (currentLines.length >= maxLines) {
      return;
    }

    for (let endIndex = wordIndex; endIndex < words.length; endIndex += 1) {
      const line = measureLine(words, wordIndex, endIndex, fontFamily, fontSize, fontStyle, options);

      if (line.width > availableWidth) {
        break;
      }

      currentLines.push(line);
      visit(endIndex + 1);
      currentLines.pop();
    }
  };

  visit(0);

  return candidates;
};

const createHyphenatedCandidates = (
  candidates: HeadlineCandidate[],
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  fontStyle: string | undefined,
  forceFullWidth: boolean,
  headlineLayoutMode: HeadlineLayoutMode,
  options?: TextMeasureOptions,
) => {
  const hyphenated: HeadlineCandidate[] = [];

  for (const candidate of candidates) {
    for (let lineIndex = 0; lineIndex < candidate.lines.length - 1; lineIndex += 1) {
      const line = candidate.lines[lineIndex];
      const nextLine = candidate.lines[lineIndex + 1];
      const unusedRatio = (availableWidth - line.width) / Math.max(1, availableWidth);

      if (unusedRatio < 0 || unusedRatio > HYPHENATION_TRIGGER_UNUSED_RATIO) {
        continue;
      }

      const nextWords = getWordsInText(nextLine.text);
      const firstNextWord = nextWords[0];

      if (!firstNextWord) {
        continue;
      }

      for (const split of getHyphenationBreaks(firstNextWord)) {
        const lineText = `${line.text} ${split.prefix}-`;
        const nextLineText = [split.suffix, ...nextWords.slice(1)].join(" ");
        const newLine = createMeasuredLine(lineText, line, fontFamily, fontSize, fontStyle, options);
        const newNextLine = createMeasuredLine(nextLineText, nextLine, fontFamily, fontSize, fontStyle, options);

        if (newLine.width > availableWidth || newNextLine.width > availableWidth) {
          continue;
        }

        const lines = candidate.lines.map((candidateLine, index) => {
          if (index === lineIndex) {
            return newLine;
          }

          if (index === lineIndex + 1) {
            return newNextLine;
          }

          return candidateLine;
        });
        const quality = getCandidateQuality(lines, availableWidth, forceFullWidth, headlineLayoutMode);
        const fillImprovement = (newLine.width - line.width) / Math.max(1, availableWidth);
        const newLineFill = newLine.width / Math.max(1, availableWidth);
        const newspaperHyphenationBonus =
          newLineFill >= HYPHENATION_TARGET_FILL_RATIO
            ? 2.4 + Math.max(0, newLineFill - line.width / Math.max(1, availableWidth)) * 8
            : 0;

        hyphenated.push({
          lines,
          score: quality.score - 0.4 - fillImprovement * 3 - newspaperHyphenationBonus,
          type: "hyphenated",
          visualBalanceScore: quality.visualBalanceScore,
          finalLineRatio: quality.finalLineRatio,
          readableFinalLine: quality.readableFinalLine,
          selectionReason: "hyphenated candidate generated",
        });

        if (nextWords.length === 1 && candidate.lines[lineIndex + 2]) {
          const followingLine = candidate.lines[lineIndex + 2];
          const mergedNextLineText = `${split.suffix} ${followingLine.text}`;
          const mergedNextLine = createMeasuredLine(
            mergedNextLineText,
            nextLine,
            fontFamily,
            fontSize,
            fontStyle,
            options,
          );

          if (mergedNextLine.width <= availableWidth) {
            const mergedLines = candidate.lines.flatMap((candidateLine, index) => {
              if (index === lineIndex) {
                return [newLine];
              }

              if (index === lineIndex + 1) {
                return [mergedNextLine];
              }

              if (index === lineIndex + 2) {
                return [];
              }

              return [candidateLine];
            });
            const mergedQuality = getCandidateQuality(mergedLines, availableWidth, forceFullWidth, headlineLayoutMode);
            const mergedLineFill = newLine.width / Math.max(1, availableWidth);
            const mergedHyphenationBonus =
              mergedLineFill >= HYPHENATION_TARGET_FILL_RATIO
                ? 2.8 + Math.max(0, fillImprovement) * 8
                : 0;

            hyphenated.push({
              lines: mergedLines,
              score: mergedQuality.score - 0.6 - fillImprovement * 3 - mergedHyphenationBonus,
              type: "hyphenated",
              visualBalanceScore: mergedQuality.visualBalanceScore,
              finalLineRatio: mergedQuality.finalLineRatio,
              readableFinalLine: mergedQuality.readableFinalLine,
              selectionReason: "hyphenated merged candidate generated",
            });
          }
        }
      }
    }
  }

  return hyphenated;
};

const createOverflowResult = (
  headline: string,
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  fontStyle?: string,
  options?: TextMeasureOptions,
): HeadlineBalanceResult => {
  const width = measureTextWidth(
    {
      text: headline,
      fontFamily,
      fontSize,
      fontStyle,
    },
    options?.provider,
  );
  const line = {
    text: headline,
    start: 0,
    end: headline.length,
    width,
  };

  return {
    lines: [line],
    wrappedLines: [headline],
    lineCount: 1,
    consumedWidth: width,
    overflow: width > availableWidth,
    score: Infinity,
    visualBalanceScore: 0,
    balanceScore: 0,
    selectedCandidateScore: Infinity,
    selectedCandidateType: "balanced",
    selectedCandidateReason: "overflow: no fitting candidate",
    selectedLayout: [headline],
    candidateLayouts: [[headline]],
    topCandidateScores: [],
    candidateCount: 0,
  };
};

export const balanceHeadline = (
  input: HeadlineBalanceInput,
  options?: TextMeasureOptions,
): HeadlineBalanceResult => {
  const headline = normalizeHeadline(input.headline);
  const availableWidth = Math.max(0, input.availableWidth);
  const fontSize = Math.max(1, input.fontSize);
  const maxLines = Math.max(1, Math.round(input.maxLines));
  const fontFamily = input.fontFamily || DEFAULT_HEADLINE_FONT;
  const fontStyle = input.fontStyle;
  const autoBalance = input.autoBalance ?? true;
  const enableHyphenation = input.enableHyphenation ?? false;
  const forceFullWidth = input.forceFullWidth ?? false;
  const headlineLayoutMode = input.headlineLayoutMode ?? "newspaper-fill";
  const words = getWords(headline);

  if (words.length === 0 || availableWidth <= 0) {
    return {
      lines: [],
      wrappedLines: [],
      lineCount: 0,
      consumedWidth: 0,
      overflow: false,
      score: 0,
      visualBalanceScore: 100,
      balanceScore: 100,
      selectedCandidateScore: 0,
      selectedCandidateType: "balanced",
      selectedCandidateReason: "empty headline",
      selectedLayout: [],
      candidateLayouts: [],
      topCandidateScores: [],
      candidateCount: 0,
    };
  }

  const candidates = generateCandidates(
    words,
    availableWidth,
    fontFamily,
    fontSize,
    fontStyle,
    maxLines,
    forceFullWidth,
    headlineLayoutMode,
    options,
  );

  if (candidates.length === 0) {
    return createOverflowResult(headline, availableWidth, fontFamily, fontSize, fontStyle, options);
  }

  if (!autoBalance) {
    const firstFit = candidates[0];
    const consumedWidth = firstFit.lines.reduce((max, line) => Math.max(max, line.width), 0);

    return {
      lines: firstFit.lines,
      wrappedLines: firstFit.lines.map((line) => line.text),
      lineCount: firstFit.lines.length,
      consumedWidth,
      overflow: false,
      score: firstFit.score,
      visualBalanceScore: firstFit.visualBalanceScore,
      balanceScore: firstFit.visualBalanceScore,
      selectedCandidateScore: firstFit.score,
      selectedCandidateType: firstFit.type,
      selectedCandidateReason: "auto balance disabled: first fitting candidate",
      selectedLayout: firstFit.lines.map((line) => line.text),
      candidateLayouts: candidates.map((candidate) => candidate.lines.map((line) => line.text)),
      topCandidateScores: candidates
        .slice()
        .sort((first, second) => first.score - second.score)
        .slice(0, 10)
        .map((candidate) => createCandidateScore(candidate, availableWidth)),
      candidateCount: candidates.length,
    };
  }

  const balancedCandidates = enableHyphenation
    ? [
        ...candidates,
        ...createHyphenatedCandidates(
          candidates,
          availableWidth,
          fontFamily,
          fontSize,
          fontStyle,
          forceFullWidth,
          headlineLayoutMode,
          options,
        ),
      ]
    : candidates;
  const fittingBalancedCandidates = balancedCandidates.filter((candidate) =>
    candidate.lines.every((line) => line.width <= availableWidth),
  );
  const candidatePool = fittingBalancedCandidates.length > 0 ? fittingBalancedCandidates : balancedCandidates;
  const newspaperCandidatePool = getNewspaperUsableCandidates(candidatePool, availableWidth, headlineLayoutMode);
  const readableBalancedCandidates = newspaperCandidatePool.filter((candidate) => candidate.readableFinalLine);
  const preferredCandidates =
    readableBalancedCandidates.filter((candidate) => candidate.lines.length === 2).length > 0
      ? readableBalancedCandidates.filter((candidate) => candidate.lines.length === 2)
      : readableBalancedCandidates.filter((candidate) => candidate.lines.length === 3).length > 0
        ? readableBalancedCandidates.filter((candidate) => candidate.lines.length === 3)
        : readableBalancedCandidates.length > 0
          ? readableBalancedCandidates
          : newspaperCandidatePool;
  const scoredPreferredCandidates =
    headlineLayoutMode === "newspaper-fill"
      ? applyNewspaperFillSelectionScore(preferredCandidates, availableWidth)
      : preferredCandidates;
  const sortedCandidates = scoredPreferredCandidates
    .slice()
    .sort((first, second) => first.score - second.score);
  const best = sortedCandidates[0];
  const consumedWidth = best.lines.reduce((max, line) => Math.max(max, line.width), 0);
  const topCandidateScores = sortedCandidates.slice(0, 10).map((candidate) =>
    createCandidateScore(candidate, availableWidth),
  );

  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEBUG_HEADLINE_PIPELINE === "true"
  ) {
    console.log("HeadlineBalancerEngine candidate audit", {
      selected: createCandidateScore(best, availableWidth),
      topCandidates: topCandidateScores,
      chosenCandidateIsTopCandidate:
        topCandidateScores[0]?.lines.join("|") === best.lines.map((line) => line.text).join("|"),
    });
  }

  return {
    lines: best.lines,
    wrappedLines: best.lines.map((line) => line.text),
    lineCount: best.lines.length,
    consumedWidth,
    overflow: false,
    score: best.score,
    visualBalanceScore: best.visualBalanceScore,
    balanceScore: best.visualBalanceScore,
    selectedCandidateScore: best.score,
    selectedCandidateType: best.type,
    selectedCandidateReason: best.selectionReason,
    selectedLayout: best.lines.map((line) => line.text),
    candidateLayouts: sortedCandidates.map((candidate) => candidate.lines.map((line) => line.text)),
    topCandidateScores,
    candidateCount: sortedCandidates.length,
  };
};

export const HeadlineBalancerEngine = {
  balanceHeadline,
};
