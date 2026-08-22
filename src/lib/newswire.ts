export const NEWSWIRE_CATEGORIES = [
  "National",
  "Madhya Pradesh",
  "International",
  "Sports",
  "Business",
  "Health",
  "Entertainment",
] as const;

export type NewswireCategory = (typeof NEWSWIRE_CATEGORIES)[number];
export type PageLanguageMode = "hindi" | "english" | "bilingual";
export type ArticleLanguage = "hindi" | "english";

export type NewswireSubheadingPresetId =
  | "classic"
  | "red"
  | "yellow"
  | "blue"
  | "green"
  | "plum"
  | "slate"
  | "maroon"
  | "sepia"
  | "custom";

export type NewswireSubheadingPreset = {
  id: NewswireSubheadingPresetId;
  label: string;
  description?: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  palette?: {
    primary: string;
    alert: string;
    secondary: string;
    highlight: string;
    neutral: string;
  };
};

export const getPaletteSubheadingStyle = (
  preset: NewswireSubheadingPreset,
  backgroundOpacity = 1,
) => {
  const backgroundColor = preset.id === "yellow"
    ? preset.palette?.highlight ?? preset.backgroundColor
    : preset.backgroundColor;

  return {
    backgroundColor,
    textColor: preset.textColor,
    borderColor: preset.borderColor,
    backgroundOpacity,
  };
};

export const getPaletteInlineAccent = (preset: NewswireSubheadingPreset) => {
  if (preset.id === "yellow") {
    return preset.borderColor;
  }

  return preset.backgroundColor;
};

export const getPaletteTintColor = (preset: NewswireSubheadingPreset) =>
  preset.id === "classic"
    ? preset.palette?.neutral ?? preset.backgroundColor
    : preset.backgroundColor;

export const getPaletteHeadlineAccent = (
  preset: NewswireSubheadingPreset,
  slotIndex: number,
) => {
  const palette = preset.palette;
  if (!palette) {
    return preset.backgroundColor;
  }

  const mainAccent = preset.id === "yellow" ? preset.borderColor : preset.backgroundColor;
  const accents = [mainAccent, palette.alert, palette.secondary, palette.highlight].filter(
    (color, index, list) => list.findIndex((candidate) => candidate.toLowerCase() === color.toLowerCase()) === index,
  );
  return accents[Math.abs(slotIndex) % accents.length];
};

export const NEWSWIRE_SUBHEADING_PRESETS: NewswireSubheadingPreset[] = [
  {
    id: "classic",
    label: "Classic Daily",
    description: "Black base with red alerts and blue desk accents.",
    backgroundColor: "#111111",
    textColor: "#ffffff",
    borderColor: "#111111",
    palette: { primary: "#111111", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#d7d2c8" },
  },
  {
    id: "red",
    label: "Red Alert Edition",
    description: "Strong red lead treatment balanced with black and blue.",
    backgroundColor: "#b42318",
    textColor: "#ffffff",
    borderColor: "#7a1e16",
    palette: { primary: "#111111", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#e3ded4" },
  },
  {
    id: "yellow",
    label: "Heritage Copper",
    description: "Warm copper highlight with black, red and civic blue.",
    backgroundColor: "#b5541f",
    textColor: "#ffffff",
    borderColor: "#7a3814",
    palette: { primary: "#111111", alert: "#b42318", secondary: "#1f5f86", highlight: "#b5541f", neutral: "#e8ded4" },
  },
  {
    id: "blue",
    label: "Blue Desk",
    description: "Cool news-desk blue with red urgency and copper emphasis.",
    backgroundColor: "#1f5f86",
    textColor: "#ffffff",
    borderColor: "#164963",
    palette: { primary: "#111111", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#dbe3e8" },
  },
  {
    id: "green",
    label: "Civic Green",
    description: "Civic green with black, red and blue editorial accents.",
    backgroundColor: "#166534",
    textColor: "#ffffff",
    borderColor: "#0f4a25",
    palette: { primary: "#166534", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#d6ded8" },
  },
  {
    id: "plum",
    label: "Editorial Plum",
    description: "Deep plum lead with red alerts and navy desk accents.",
    backgroundColor: "#5b2c5f",
    textColor: "#ffffff",
    borderColor: "#3d1d40",
    palette: { primary: "#5b2c5f", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#e6dde6" },
  },
  {
    id: "slate",
    label: "Slate Standard",
    description: "Modern slate-grey base with red urgency and copper warmth.",
    backgroundColor: "#37474f",
    textColor: "#ffffff",
    borderColor: "#22292d",
    palette: { primary: "#37474f", alert: "#b42318", secondary: "#1f5f86", highlight: "#b5541f", neutral: "#dde2e4" },
  },
  {
    id: "maroon",
    label: "Maroon Herald",
    description: "Rich maroon lead balanced with navy desk and teal highlight.",
    backgroundColor: "#6d1b3f",
    textColor: "#ffffff",
    borderColor: "#471228",
    palette: { primary: "#6d1b3f", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#e8dde1" },
  },
  {
    id: "sepia",
    label: "Sepia Standard",
    description: "Warm sepia lead with black ink and civic blue accents.",
    backgroundColor: "#6b4226",
    textColor: "#ffffff",
    borderColor: "#452a18",
    palette: { primary: "#6b4226", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#e6ddd2" },
  },
  { id: "custom", label: "Custom Palette", backgroundColor: "#111111", textColor: "#ffffff", borderColor: "#111111" },
];

export type NewswireTintPresetId = "neutral" | "amber" | "blue" | "green" | "rose";

export type NewswireTintPreset = {
  id: NewswireTintPresetId;
  label: string;
  colorHex: string;
  previewColor: string;
};

export const NEWSWIRE_TINT_PRESETS: NewswireTintPreset[] = [
  { id: "neutral", label: "Warm Neutral", colorHex: "#111111", previewColor: "#dce0e5" },
  { id: "amber", label: "Editorial Amber", colorHex: "#d99b00", previewColor: "#fae8b4" },
  { id: "blue", label: "Desk Blue", colorHex: "#1f5f86", previewColor: "#ccdbe8" },
  { id: "green", label: "Edition Green", colorHex: "#166534", previewColor: "#cadcce" },
  { id: "rose", label: "Alert Rose", colorHex: "#b42318", previewColor: "#e8c9c7" },
];

export type FactBoxRow = { label: string; value: string };

export type NewswireStory = {
  id: string;
  language?: ArticleLanguage;
  category: NewswireCategory | string;
  headline: string;
  subheadline: string;
  body: string;
  shortBody?: string;
  mediumBody?: string;
  longBody?: string;
  summary: string[];
  caption: string;
  imageUrl: string;
  imageCaption: string;
  place?: string;
  sourceTitle: string;
  sourceUrl: string;
  publishedAt: string | null;
  localized?: Partial<Record<ArticleLanguage, LocalizedNewswireContent>>;
  // Rich per-story design chrome (Dainik Bhaskar / Times of India parity)
  kicker?: string;
  strap?: string;
  bylineName?: string;
  photoCredit?: string;
  factBoxHeading?: string;
  factBoxRows?: FactBoxRow[];
  pullQuoteText?: string;
  pullQuoteAttribution?: string;
  /**
   * Set the body ragged right instead of justified.
   *
   * For blocks whose measure is too narrow to justify without visibly pulling
   * the words apart — the daily राशिफल is the case this exists for. Opt-in per
   * story, so nothing that does not ask for it is affected.
   */
  raggedRight?: boolean;
  /**
   * Editorial-page author block: the writer's portrait and the short summary
   * printed under their name.
   *
   * Read only on editorial pages, where the writer is identified by a portrait
   * rail rather than a byline. News pages ignore both.
   */
  editorPortraitUrl?: string;
  editorSummary?: string;
  letterAuthor?: string;
  letterLocation?: string;
  letterEmail?: string;
  letterPhone?: string;
  badgeKickerEnabled?: boolean;
  inlineSubheadingColor?: string;
  kickerLabelColor?: string;
  /**
   * A publisher-supplied article for the current issue (headline/body/image
   * entered on the SaaS portal, not fetched from the wire). Once rank-paired
   * to a slot, it is guaranteed to be used there — see the `manualPinned`
   * check in `importNewswireStories` — rather than being silently swapped
   * out just because its photo doesn't match that slot's usual image
   * convention the way wire content would be.
   */
  manualPinned?: boolean;
  /**
   * Which slot (array index into `generateTemplateLayout`'s output, the same
   * index `importNewswireStories` iterates by) this manual story must land in.
   *
   * Without this, `manualPinned` only guarantees the story survives the
   * image/width aesthetic check — the rank-by-word-count pairing above it can
   * still send it to a *different* slot than the one its word-limit was
   * checked against on the wizard's manual-seeder screen. Set alongside
   * `manualPinned`; ignored when absent, so ordinary wire/preloaded stories
   * (which never set either field) take the exact rank-paired path they
   * always have.
   */
  manualTargetSlotIndex?: number;
};

export type LocalizedNewswireContent = {
  language: ArticleLanguage;
  headline: string;
  kicker: string;
  subheadings: string[];
  subheadline: string;
  body: string;
  shortBody: string;
  mediumBody: string;
  longBody: string;
  caption: string;
  imageCaption: string;
  place?: string;
  imageUrl: string;
  sourceUrl: string;
  category: string;
};

export const isNewswireCategory = (value: string): value is NewswireCategory =>
  NEWSWIRE_CATEGORIES.includes(value as NewswireCategory);

export const getSlotLanguage = (
  languageMode: PageLanguageMode | undefined,
  slotIndex: number,
): ArticleLanguage => {
  if (languageMode === "english") {
    return "english";
  }

  if (languageMode === "bilingual") {
    return slotIndex % 2 === 0 ? "english" : "hindi";
  }

  return "hindi";
};

export const cleanNewswireText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(cleanNewswireText).filter(Boolean).join(" ");
  }

  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

/**
 * Detects the dominant script of a string.
 * Returns "devanagari" when the majority of alphabetic characters are in the
 * Unicode Devanagari block (U+0900–U+097F), otherwise returns "latin".
 */
export const detectScript = (text: string): "devanagari" | "latin" => {
  const devanagariChars = (text.match(/[\u0900-\u097F]/gu) ?? []).length;
  const latinChars = (text.match(/[A-Za-z]/gu) ?? []).length;
  return devanagariChars >= latinChars ? "devanagari" : "latin";
};

/**
 * Ensures `text` ends with the correct terminal punctuation for its script.
 *
 * Rules:
 *  - If the string already ends with any of `.`, `!`, `?`, `।`, `॥` the text
 *    is returned unchanged.
 *  - Hindi / Devanagari content → Purna Viram (`।`) is appended.
 *  - English / Latin content   → full stop (`.`) is appended.
 *
 * This function is the single enforcement point for the terminal-punctuation
 * constraint applied during API data ingestion.
 */
export const ensureEndsWithFullStop = (text: string): string => {
  const trimmed = cleanNewswireText(text);

  if (!trimmed) {
    return "";
  }

  // Already ends with valid terminal punctuation — no change needed.
  if (/[।॥.!?]\s*$/u.test(trimmed)) {
    return trimmed;
  }

  // Detect script and append the correct terminal character.
  const script = detectScript(trimmed);
  return script === "devanagari" ? `${trimmed} ।` : `${trimmed}.`;
};

export const trimToNearestFullStop = (text: string, targetWords?: number): string => {
  const cleaned = cleanNewswireText(text);

  if (!cleaned) {
    return "";
  }

  if (!targetWords || targetWords <= 0) {
    return ensureEndsWithFullStop(cleaned);
  }

  const words = cleaned.split(/\s+/u);

  if (words.length <= targetWords) {
    return ensureEndsWithFullStop(cleaned);
  }

  const subset = words.slice(0, targetWords).join(" ");
  const remainder = words.slice(targetWords).join(" ");

  const lastMatch = subset.match(/[\s\S]*[।॥.!?]/u);
  if (lastMatch && lastMatch[0].trim().split(/\s+/u).length >= Math.min(25, targetWords * 0.35)) {
    return ensureEndsWithFullStop(lastMatch[0].trim());
  }

  const nextMatch = remainder.match(/^[\s\S]*?[।॥.!?]/u);
  if (nextMatch) {
    return ensureEndsWithFullStop(`${subset} ${nextMatch[0]}`.trim());
  }

  // A real sentence ending, even a short one, always beats a fabricated one. The branch
  // above rejects `lastMatch` when it is shorter than the target ratio, which used to fall
  // straight through to appending a full stop onto a word-truncated fragment — printing a
  // sentence that stops mid-thought but looks complete. Prefer the genuine boundary here;
  // only genuinely unpunctuated source text reaches the append below.
  if (lastMatch) {
    return ensureEndsWithFullStop(lastMatch[0].trim());
  }

  return ensureEndsWithFullStop(subset);
};

export const selectLocalizedBody = (
  localized: Partial<Pick<LocalizedNewswireContent, "shortBody" | "mediumBody" | "longBody"> & { body?: string }>,
  requestedWords: number,
) => {
  if (requestedWords <= 250) {
    return localized.shortBody || localized.mediumBody || localized.longBody || localized.body || "";
  }

  if (requestedWords <= 500) {
    return localized.mediumBody || localized.longBody || localized.shortBody || localized.body || "";
  }

  return localized.longBody || localized.mediumBody || localized.shortBody || localized.body || "";
};

export const hasMeaningfulLocalizedContent = (
  story: NewswireStory,
  language: ArticleLanguage,
  requestedWords = 300,
) => {
  const localized = story.localized?.[language];

  if (!localized) {
    return language === "hindi" && Boolean(story.headline && selectLocalizedBody(story, requestedWords));
  }

  return Boolean(localized.headline && selectLocalizedBody(localized, requestedWords));
};

export const getLocalizedArticleContent = (
  story: NewswireStory,
  language: ArticleLanguage,
  requestedWords: number,
): LocalizedNewswireContent | null => {
  const localized = story.localized?.[language];

  if (localized) {
    const selectedBody = selectLocalizedBody(localized, requestedWords);

    if (!localized.headline || !selectedBody) {
      return null;
    }

    return {
      ...localized,
      body: selectedBody,
      shortBody: localized.shortBody,
      mediumBody: localized.mediumBody,
      longBody: localized.longBody,
      imageUrl: localized.imageUrl || story.imageUrl,
      imageCaption: localized.imageCaption || localized.caption,
      place: localized.place || story.place,
      sourceUrl: localized.sourceUrl || story.sourceUrl,
      category: localized.category || story.category,
    };
  }

  if (language !== "hindi") {
    return null;
  }

  const selectedBody = selectLocalizedBody(story, requestedWords);

  if (!story.headline || !selectedBody) {
    return null;
  }

  return {
    language: "hindi",
    headline: story.headline,
    kicker: story.kicker ?? "",
    subheadings: story.summary.slice(0, 3),
    subheadline: story.subheadline,
    body: selectedBody,
    shortBody: story.shortBody ?? "",
    mediumBody: story.mediumBody ?? "",
    longBody: story.longBody ?? "",
    caption: story.caption,
    imageCaption: story.imageCaption,
    place: story.place,
    imageUrl: story.imageUrl,
    sourceUrl: story.sourceUrl,
    category: story.category,
  };
};

export const extractNewswirePhotoCaption = (text: string): string => {
  const match = text.match(/Photo Caption:\s*([\s\S]+)$/i);

  return cleanNewswireText(match?.[1] ?? "");
};

export const stripNewswirePhotoCaption = (text: string): string =>
  cleanNewswireText(text.replace(/\n?\s*Photo Caption:\s*[\s\S]+$/i, ""));

/**
 * Clean body text of imported metadata patterns (Subheadings:, bullet lists, Agency source tags)
 * while preserving legitimate article prose and Indic shaping.
 */
export const normalizeArticleBodyText = (
  rawBody: string,
  headline?: string,
  subheading?: string,
): string => {
  if (!rawBody) return "";

  let cleaned = stripNewswirePhotoCaption(rawBody);

  // 1. Remove imported summary block with Subheadings: label and bullet points (stop at sentence punctuation or next bullet)
  cleaned = cleaned.replace(/\bSubheadings?\s*[:-]?\s*(?:[•*·-]\s*[^•*·\n.।!?]+[।!?.]?\s*)+/gi, " ");

  // 2. Remove standalone Subheadings: or Subheading: metadata labels at start, line start, or after punctuation
  cleaned = cleaned.replace(/(?:^|[\s.।!?])Subheadings?\s*[:-]\s*/gi, " ");

  // 3. Remove accidental source/agency tags inserted in body matter like "Agency GE News Hub" or "Source: GE News"
  cleaned = cleaned.replace(/\b(?:Agency|Source)\s+GE\s+News(?:\s+Hub)?\.?/gi, "");
  cleaned = cleaned.replace(/\bAgency\s+[A-Z0-9\s-]{2,20}(?:Hub|Desk|Feed)\.?/gi, "");

  // 4. Remove duplicate headline or subheading duplicated at the very beginning of the body
  const stripMatchingPrefix = (text: string, matchTarget?: string) => {
    if (!matchTarget) return text;
    const targetNorm = matchTarget.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    if (!targetNorm || targetNorm.length < 5) return text;

    const currentNorm = text.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    if (currentNorm.startsWith(targetNorm)) {
      // Find where the match ends in original text
      const words = targetNorm.split(" ");
      let lastIndex = 0;
      let wordCount = 0;
      const textWords = text.split(/\s+/);
      while (wordCount < words.length && lastIndex < textWords.length) {
        lastIndex++;
        wordCount++;
      }
      return textWords.slice(lastIndex).join(" ").trim();
    }
    return text;
  };

  cleaned = stripMatchingPrefix(cleaned, headline);
  cleaned = stripMatchingPrefix(cleaned, subheading);

  // 5. Clean up Unicode spaces and zero-width characters (preserve valid Devanagari ZWJ U+200D and ZWNJ U+200C inside words)
  cleaned = cleaned
    .replace(/[\u200B\uFEFF]/g, "") // remove zero-width space and BOM
    .replace(/[ \t\u00A0]+/g, " ") // normalize non-breaking spaces and tabs
    .replace(/\s*([।॥!?])\s*/g, "$1 ") // ensure single space around Indic stops and exclamations/questions
    .replace(/([^0-9\s]\.)\s+/g, "$1 ") // normalize space after English full stops without breaking decimals
    .replace(/\s{2,}/g, " ")
    .trim();

  return ensureEndsWithFullStop(cleaned);
};

export type IncomingArticleInput = {
  headline?: string;
  subheading?: string;
  body?: string;
  caption?: string;
  source?: string;
  agency?: string;
};

export type NormalizedArticleFields = {
  headline: string;
  subheading: string;
  body: string;
  caption: string;
  source: string;
  agency: string;
};

/**
 * Single article content normalization boundary enforcing strict field separation.
 */
export const normalizeIncomingArticleContent = (
  input: IncomingArticleInput,
): NormalizedArticleFields => {
  const headline = ensureEndsWithFullStop(cleanNewswireText(input.headline));

  // Clean subheading text of literal "Subheadings:" labels
  let subheadingText = cleanNewswireText(input.subheading);
  subheadingText = subheadingText.replace(/\bSubheadings?\s*[:-]\s*/gi, "").trim();
  const subheading = ensureEndsWithFullStop(subheadingText);

  const caption = ensureEndsWithFullStop(cleanNewswireText(input.caption));
  const source = cleanNewswireText(input.source);
  const agency = cleanNewswireText(input.agency);

  // Clean body text ensuring no headline/subheading duplication or metadata contamination
  const body = normalizeArticleBodyText(input.body || "", headline, subheading);

  return {
    headline,
    subheading,
    body,
    caption,
    source,
    agency,
  };
};
