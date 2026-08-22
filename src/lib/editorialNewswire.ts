import { getTemplateDefinition } from "@/engines/TemplateLayout/TemplateRegistry";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import type { NewswireStory } from "./newswire";

/**
 * Turns the editorial feed into stories for the editorial page.
 *
 * Editorial-only. The front-page and inside-page flows keep using
 * /api/newswire exactly as before; nothing here is on their path.
 */

export type EditorialFeedRecord = {
  id?: number | string;
  category?: string;
  title?: string;
  secondary_headline?: string;
  summary?: string;
  article?: string;
  state?: string;
  author?: string;
  name?: string;
  writer?: string;
  location?: string;
  place?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
};

export type RashifalRecord = {
  id?: number | string;
  title?: string;
  summary?: string;
  article?: string;
  source_url?: string;
  luckyNumber?: number | string;
  luckyColor?: string;
  compatibility?: string;
};

export type EditorialFeed = {
  articles: EditorialFeedRecord[];
  rashifal: RashifalRecord[];
  health?: EditorialFeedRecord[];
};

/**
 * The upstream `article` field is markdown-ish — section headings arrive as
 * `### heading`. Every editorial currently starts with the same boilerplate
 * heading ("पृष्ठभूमि और संरचनात्मक संदर्भ"), so keeping those lines makes
 * every box look like it has the same body. Drop markdown headings and flow the
 * actual article paragraphs.
 */
const toPlainProse = (markdown: string) =>
  markdown
    .split(/\r?\n/)
    .filter((line) => !/^\s{0,3}#{1,6}\s+/.test(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Which headline a box gets.
 *
 * A one-column box is too narrow to carry the long form, so it takes the
 * record's `title` — the short, self-contained line. Every wider box takes
 * `secondary_headline`, which is the fuller sentence the desk writes as the
 * display headline.
 */
export const pickEditorialHeadline = (record: EditorialFeedRecord, columnSpan: number) => {
  const title = (record.title ?? "").trim();
  const secondary = (record.secondary_headline ?? "").trim();

  if (columnSpan <= 1) {
    // Fall back the other way if the short line is missing, so a narrow box is
    // never left without a headline.
    return title || secondary;
  }

  return secondary || title;
};

/**
 * Which slot of an editorial template holds the horoscope, zero-based.
 *
 * On the printed page राशिफल sits in a fixed box — the outer columns of the
 * middle band — rather than wherever the rotation happens to put it, so the
 * template states it here. A template not listed simply has no horoscope box
 * and every slot takes an article.
 */
const RASHIFAL_SLOT_BY_TEMPLATE: Partial<Record<TemplateId, number>> = {
  // Story 3 — the आज का राशिफल block nested in the middle band.
  CliffEditorial8A: 2,
  CliffEditorial9A: 2,
};

export const getRashifalSlotIndex = (templateId: TemplateId) =>
  RASHIFAL_SLOT_BY_TEMPLATE[templateId] ?? -1;

const HEALTH_SLOT_BY_TEMPLATE: Partial<Record<TemplateId, number>> = {
  CliffEditorial8A: 5,
  CliffEditorial9A: 5,
};

export const getHealthSlotIndex = (templateId: TemplateId) =>
  HEALTH_SLOT_BY_TEMPLATE[templateId] ?? -1;

/** Column span of each slot of a template, in story-number order. */
export const getTemplateColumnSpans = (templateId: TemplateId): number[] => {
  const template = getTemplateDefinition(templateId);

  if (!template) {
    return [];
  }

  return [...template.slots]
    .sort((a, b) => a.storyNumber - b.storyNumber)
    .map((slot) => slot.columnSpan);
};

const RASHIFAL_SIGN_ORDER = [
  "मेष",
  "वृषभ",
  "मिथुन",
  "कर्क",
  "सिंह",
  "कन्या",
  "तुला",
  "वृश्चिक",
  "धनु",
  "मकर",
  "कुंभ",
  "मीन",
] as const;

const RASHIFAL_FALLBACK_READINGS: Record<(typeof RASHIFAL_SIGN_ORDER)[number], string> = {
  मेष: "कामकाज में जल्दबाजी से बचें और निर्णय सोच-समझकर लें। परिवार का सहयोग मिलेगा, खर्च नियंत्रण में रखें और स्वास्थ्य पर ध्यान दें।",
  वृषभ: "नए अवसर मिल सकते हैं। रुके हुए काम आगे बढ़ेंगे, लेकिन बातचीत में संयम रखें और आर्थिक मामलों में सावधानी बरतें।",
  मिथुन: "दिन मिलाजुला रहेगा। संपर्कों से लाभ होगा, पुराने मतभेद कम होंगे और काम की योजना बनाकर चलना बेहतर रहेगा।",
  कर्क: "परिवार और कार्यस्थल दोनों जगह जिम्मेदारी बढ़ सकती है। धैर्य रखें, अधूरे काम पूरे करें और स्वास्थ्य को नजरअंदाज न करें।",
  सिंह: "आत्मविश्वास बढ़ेगा और महत्वपूर्ण लोगों से सहयोग मिलेगा। खर्च बढ़ सकता है, इसलिए बजट संभालें और निर्णय शांत मन से लें।",
  कन्या: "मेहनत का अच्छा परिणाम मिल सकता है। दस्तावेजों और पैसों से जुड़े काम ध्यान से करें, यात्रा में सावधानी रखें।",
  तुला: "रिश्तों में मधुरता रहेगी और कामकाज में गति आएगी। नई योजना पर विचार होगा, पर बड़े फैसले जल्दबाजी में न लें।",
  वृश्चिक: "पुराने अटके काम आगे बढ़ सकते हैं। मन में उत्साह रहेगा, लेकिन विवाद से दूर रहें और स्वास्थ्य संबंधी संकेतों पर ध्यान दें।",
  धनु: "सीखने और आगे बढ़ने का मौका मिलेगा। वरिष्ठों से सलाह लाभ देगी, आय के साधन सुधरेंगे और परिवार में सहयोग रहेगा।",
  मकर: "काम का दबाव रह सकता है, लेकिन अनुशासन से लाभ मिलेगा। खर्चों पर नियंत्रण रखें और जरूरी बातचीत स्पष्ट ढंग से करें।",
  कुंभ: "नए संपर्क उपयोगी रहेंगे। योजनाओं में बदलाव करना पड़ सकता है, फिर भी मेहनत का फल मिलेगा और मनोबल बना रहेगा।",
  मीन: "धन से जुड़े काम सोच-समझकर करें। परिवार और रिश्तों में संवाद शांत रखें, सहयोग मिलेगा और दिन के अंत तक राहत महसूस होगी।",
};

const getRashifalSign = (title: string) =>
  RASHIFAL_SIGN_ORDER.find((sign) => title.startsWith(sign) || title.includes(`${sign} राशिफल`));

/**
 * One sign's reading, cleaned but kept complete.
 *
 * The renderer owns fitting. The feed sentence should not be cut here, because
 * the horoscope API already gives compact per-sign copy and the metadata sits
 * in its own footer inside each cell.
 */
const trimReading = (text: string) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    // The summary repeats its own dated title before the reading starts
    // ("मीन राशिफल 8 Aug 2026: धन से…"). Left in, every cell prints the sign
    // and the date twice — once as the lead-in and again inside the copy.
    .replace(/^[^:।]{0,40}राशिफल[^:]{0,40}:\s*/u, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  return cleaned;
};

/**
 * The twelve daily horoscope entries, folded into one story.
 *
 * The printed page carries राशिफल as a single block of twelve short readings,
 * not as twelve separate articles, so the whole set becomes the body of the one
 * box the template reserves for it.
 */
export const buildRashifalStory = (
  records: RashifalRecord[],
  category: string,
): NewswireStory | null => {
  const liveBySign = new Map<
    string,
    {
      reading: string;
      luckyNumber?: string;
      luckyColor?: string;
      compatibility?: string;
    }
  >();

  for (const record of records) {
    const sign = getRashifalSign((record.title ?? "").trim());

    if (!sign || liveBySign.has(sign)) {
      continue;
    }

    const reading = trimReading(record.summary ?? record.article ?? "");

    if (reading.trim().split(/\s+/).filter(Boolean).length >= 12) {
      liveBySign.set(sign, {
        reading,
        luckyNumber: record.luckyNumber ? String(record.luckyNumber).trim() : "",
        luckyColor: record.luckyColor ? String(record.luckyColor).trim() : "",
        compatibility: record.compatibility ? String(record.compatibility).trim() : "",
      });
    }
  }

  const entries = RASHIFAL_SIGN_ORDER.map((sign) => {
    const live = liveBySign.get(sign);
    const reading = live?.reading ?? RASHIFAL_FALLBACK_READINGS[sign];
    const metadata = [
      live?.luckyNumber ? `शुभ अंक=${live.luckyNumber}` : "",
      live?.luckyColor ? `शुभ रंग=${live.luckyColor}` : "",
      live?.compatibility ? `राशि अनुकूलता=${live.compatibility}` : "",
    ]
      .filter(Boolean)
      .join(";");

    return `${sign}: ${reading}${metadata ? ` [[meta:${metadata}]]` : ""}`;
  });

  const body = entries.join(" ");

  return {
    id: "editorial-rashifal",
    category,
    headline: "आज का राशिफल",
    subheadline: "",
    body,
    shortBody: entries.slice(0, 4).join(" "),
    mediumBody: entries.slice(0, 8).join(" "),
    longBody: body,
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: records[0]?.source_url ?? "",
    publishedAt: null,
    // Never justified. The horoscope sits in a narrow, multi-column box, and
    // justifying two or three long Hindi words to a full measure stretches the
    // gaps between them until the type visibly pulls apart. Printed horoscopes
    // are set ragged right for the same reason.
    raggedRight: true,
    localized: {
      hindi: buildLocalized({
        headline: "आज का राशिफल",
        subheadline: "",
        body,
        summary: entries[0] ?? "",
        category,
      }),
    },
  };
};

/**
 * Hindi localized content for a story built from the editorial feed.
 *
 * Every body tier is filled from the same prose. The resolver picks a tier by
 * requested word count and returns null if the one it picks is empty, so
 * leaving a tier blank is what makes a page refuse to generate.
 */
const buildLocalized = ({
  headline,
  subheadline,
  body,
  summary,
  category,
}: {
  headline: string;
  subheadline: string;
  body: string;
  summary: string;
  category: string;
}) => ({
  language: "hindi" as const,
  headline,
  kicker: "",
  subheadings: summary ? [summary] : [],
  subheadline,
  body,
  shortBody: summary || body,
  mediumBody: body,
  longBody: body,
  caption: "",
  imageCaption: "",
  place: "",
  imageUrl: "",
  sourceUrl: "",
  category,
});

/** Maps one editorial record onto a story, honouring the per-box headline rule. */
export const buildEditorialStory = (
  record: EditorialFeedRecord,
  columnSpan: number,
  category: string,
  index: number,
): NewswireStory => {
  const headline = pickEditorialHeadline(record, columnSpan);
  const body = toPlainProse(record.article ?? "");
  const summary = (record.summary ?? "").trim();

  return {
    id: `editorial-${record.id ?? index}`,
    category: record.category ?? category,
    headline,
    // The line not used as the headline becomes the subheadline, so no copy the
    // desk wrote is silently dropped. A one-column box took the short title, so
    // it keeps the long line underneath, and vice versa.
    subheadline:
      columnSpan <= 1 ? (record.secondary_headline ?? "").trim() : (record.title ?? "").trim(),
    body: body || summary,
    shortBody: summary,
    mediumBody: summary || body.slice(0, 600),
    longBody: body,
    summary: summary ? [summary] : [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: record.state ?? "",
    sourceUrl: "",
    publishedAt: null,
    // The desk's summary doubles as the author-rail standfirst; the feed
    // carries no portrait, so the rail prints the name over an empty frame
    // until one is added by hand.
    editorSummary: summary,
    letterAuthor: (record.author ?? record.name ?? record.writer ?? "").trim(),
    letterLocation: (record.location ?? record.place ?? record.state ?? "").trim(),
    letterEmail: (record.email ?? "").trim(),
    letterPhone: (record.whatsapp ?? record.phone ?? record.mobile ?? "").trim(),
    // The feed is Hindi copy. Stating that explicitly matters: the resolver
    // looks for `localized[language]` first and only falls back to the bare
    // story fields, and that fallback rejects anything it considers short —
    // which is what made an editorial page fail with "Not enough Hindi
    // articles are available to generate this page."
    localized: {
      hindi: buildLocalized({
        headline,
        subheadline:
          columnSpan <= 1 ? (record.secondary_headline ?? "").trim() : (record.title ?? "").trim(),
        body: body || summary,
        summary,
        category: record.category ?? category,
      }),
    },
  };
};

export const buildEditorialHealthStory = (
  record: EditorialFeedRecord,
  category: string,
): NewswireStory => {
  const headline = (record.secondary_headline ?? record.title ?? "").trim();
  const body = toPlainProse(record.article ?? "") || (record.summary ?? "").trim();

  return {
    id: `editorial-health-${record.id ?? "daily"}`,
    category: "Health",
    headline,
    subheadline: "",
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: record.state ?? "",
    sourceUrl: "",
    publishedAt: null,
    kicker: "हेल्थ डेस्क",
    badgeKickerEnabled: true,
    inlineSubheadingColor: "#2E7D32",
    kickerLabelColor: "#2E7D32",
    localized: {
      hindi: buildLocalized({
        headline,
        subheadline: "",
        body,
        summary: "",
        category: category || "Health",
      }),
    },
  };
};

/**
 * Builds the stories for an editorial page, slot by slot.
 *
 * `rashifalSlotIndex` is the zero-based slot the template reserves for the
 * horoscope; it is filled from the rashifal feed and skipped by the article
 * rotation.
 *
 * The desk feed is the only source for editorial article boxes. When it is
 * short, the missing boxes stay missing so live-feed testing shows the real
 * problem instead of hiding it behind preloaded copy.
 */
export const buildEditorialStories = ({
  feed,
  columnSpans,
  category,
  rashifalSlotIndex,
  healthSlotIndex = -1,
}: {
  feed: EditorialFeed;
  columnSpans: number[];
  category: string;
  rashifalSlotIndex: number;
  healthSlotIndex?: number;
  fillers?: NewswireStory[];
}): NewswireStory[] => {
  const rashifal = buildRashifalStory(feed.rashifal, category);
  const health =
    healthSlotIndex >= 0 && feed.health?.[0]
      ? buildEditorialHealthStory(feed.health[0], "Health")
      : null;
  const stories: NewswireStory[] = [];
  let articleIndex = 0;

  columnSpans.forEach((columnSpan, slotIndex) => {
    if (slotIndex === rashifalSlotIndex && rashifal) {
      stories.push(rashifal);
      return;
    }

    if (slotIndex === healthSlotIndex && health) {
      stories.push(health);
      return;
    }

    const record = feed.articles[articleIndex];

    if (record) {
      articleIndex += 1;
      stories.push(buildEditorialStory(record, columnSpan, category, slotIndex));
      return;
    }
  });

  return stories;
};
