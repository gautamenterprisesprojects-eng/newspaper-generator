import { randomUUID } from "crypto";
import https from "https";
import { NextResponse } from "next/server";
import {
  NEWSWIRE_CATEGORIES,
  cleanNewswireText,
  extractNewswirePhotoCaption,
  isNewswireCategory,
  normalizeArticleBodyText,
  normalizeIncomingArticleContent,
  stripNewswirePhotoCaption,
  trimToNearestFullStop,
  type ArticleLanguage,
  type LocalizedNewswireContent,
  type NewswireStory,
} from "@/lib/newswire";

const DEFAULT_API_BASE_URL = "https://api.gautamenterprises.org";
const GAUTAM_ENGLISH_API_BASE_URL = "https://api.gautamenterprises.org";
const GAUTAM_ENGLISH_API_KEY =
  "1f167aa0133f4836b63de2e751228b55a5b730bd95df43379c2901bbe1a7d4d3";

export const runtime = "nodejs";

type DeliveryArticle = {
  headline?: string;
  secondary_headline?: string;
  top_summary?: unknown;
  short_description?: string;
  long_description?: string;
  what_to_watch_next?: string;
  category?: string;
  image_caption?: string;
  place?: string;
  place_name?: string;
  location?: string;
  location_name?: string;
  city?: string;
  city_name?: string;
  dateline?: string;
};

type DeliveryRecord = {
  id?: string | number;
  rewrite_id?: string | number;
  news_id?: string | number;
  category?: string;
  title?: string;
  link?: string;
  source_url?: string;
  image_url?: string;
  published_at?: string | null;
  updated_at?: string | null;
  feed_source?: string;
  image_link?: string;
  image_caption?: string;
  uploaded?: string | null;
  secondary_headline?: string;
  subheadings?: unknown;
  short_100?: string;
  medium_300?: string;
  long_500?: string;
  place?: string;
  place_name?: string;
  location?: string;
  location_name?: string;
  city?: string;
  city_name?: string;
  dateline?: string;
  source?: {
    title?: string;
    url?: string;
    fetched_at?: string | null;
  };
  media?: {
    image_caption?: string;
    image_link?: string;
  };
  raw_articles_by_language?: Partial<Record<ArticleLanguage, {
    words_250?: string;
    words_100?: string;
    words_300?: string;
    words_500?: string;
    words_600?: string;
    words_1000?: string;
    headline?: string;
    top_summary?: unknown;
    image_caption?: string;
    category?: string;
    place?: string;
    place_name?: string;
    location?: string;
    location_name?: string;
    city?: string;
    city_name?: string;
    dateline?: string;
  }>>;
  ui_hindi?: {
    title?: string;
    secondary_headline?: string;
    category?: string;
    short_250?: string;
    short_100?: string;
    medium_500?: string;
    medium_300?: string;
    long_1000?: string;
    long_500?: string;
    image_caption?: string;
    image_url?: string;
    place?: string;
    place_name?: string;
    location?: string;
    location_name?: string;
    city?: string;
    city_name?: string;
    dateline?: string;
    subheadings?: unknown;
  };
  ui_english?: {
    title?: string;
    secondary_headline?: string;
    category?: string;
    short_250?: string;
    short_100?: string;
    medium_500?: string;
    medium_300?: string;
    long_1000?: string;
    long_500?: string;
    image_caption?: string;
    image_url?: string;
    place?: string;
    place_name?: string;
    location?: string;
    location_name?: string;
    city?: string;
    city_name?: string;
    dateline?: string;
    subheadings?: unknown;
  };
  article?: DeliveryArticle & {
    hindi?: Partial<DeliveryArticle>;
    english?: Partial<DeliveryArticle>;
  };
  hindi?: Partial<DeliveryArticle>;
  english?: Partial<DeliveryArticle>;
};

// Identity map — the app's 7 category names now match the delivery API's
// query values verbatim (see GEN-H News Agency's Delivery API reference),
// kept as an explicit map rather than passing `category` straight through
// so an unsupported/renamed category still fails loudly here instead of
// silently querying the upstream with a value it's never seen.
const GAUTAM_CATEGORY_BY_APP_CATEGORY: Record<string, string> = {
  "National": "National",
  "Madhya Pradesh": "Madhya Pradesh",
  International: "International",
  Sports: "Sports",
  Business: "Business",
  Health: "Health",
  Entertainment: "Entertainment",
};

const getApiBaseUrls = () => {
  const configured =
    process.env.NEWSWIRE_API_BASE_URLS ||
    process.env.NEWSWIRE_API_BASE_URL ||
    process.env.NEXT_PUBLIC_NEWSWIRE_API_BASE_URL ||
    DEFAULT_API_BASE_URL;

  return configured
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
};

const getApiKey = () => process.env.NEWSWIRE_API_KEY || process.env.NEWS_AUTOMATION_API_KEY || "";

const getGautamEnglishApiKey = () =>
  process.env.GAUTAM_NEWS_API_KEY ||
  process.env.NEWSWIRE_ENGLISH_API_KEY ||
  GAUTAM_ENGLISH_API_KEY;

const fetchGautamJson = (url: URL, apiKey: string): Promise<{ status: number; ok: boolean; payload: unknown }> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({
              status: response.statusCode ?? 0,
              ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
              payload: body ? JSON.parse(body) : null,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.setTimeout(30000, () => {
      request.destroy(new Error("English news API request timed out."));
    });
    request.on("error", reject);
    request.end();
  });

const getString = (...values: unknown[]) => {
  for (const value of values) {
    const text = cleanNewswireText(value);

    if (text) {
      return text;
    }
  }

  return "";
};

const normalizeCategoryKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_\-–—]+/g, "")
    .replace(/[()]/g, "");

const CATEGORY_ALIASES: Record<string, string[]> = {
  National: ["national", "rashtriya", "राष्ट्रीय", "देश"],
  "Madhya Pradesh": ["madhyapradesh", "madhyapradeshnews", "mp", "state", "मध्यप्रदेश", "प्रदेश"],
  International: ["international", "world", "deshvidesh", "विदेश", "विश्व", "अंतरराष्ट्रीय"],
  Sports: ["sports", "sport", "khel", "खेल"],
  Business: ["business", "biz", "व्यापार", "कारोबार", "बिजनेस"],
  Health: ["health", "medical", "स्वास्थ्य", "हेल्थ"],
  Entertainment: ["entertainment", "film", "cinema", "मनोरंजन"],
};

const categoryMatches = (actual: string, requested: string) => {
  const actualKey = normalizeCategoryKey(actual);
  const requestedKey = normalizeCategoryKey(requested);
  const requestedAliases = CATEGORY_ALIASES[requested] ?? [requestedKey];

  return actualKey === requestedKey || requestedAliases.some((alias) => actualKey === normalizeCategoryKey(alias));
};

const recordMatchesRequestedCategory = (record: DeliveryRecord, requestedCategory: string) => {
  const declaredCategories = [
    record.category,
    record.ui_hindi?.category,
    record.ui_english?.category,
    record.article?.category,
    record.article?.hindi?.category,
    record.article?.english?.category,
    record.hindi?.category,
    record.english?.category,
    record.raw_articles_by_language?.hindi?.category,
    record.raw_articles_by_language?.english?.category,
  ].map(cleanNewswireText).filter(Boolean);

  if (declaredCategories.length === 0) {
    return true;
  }

  return declaredCategories.some((candidate) => categoryMatches(candidate, requestedCategory));
};

const getRecordSearchText = (record: DeliveryRecord) =>
  getString(
    record.title,
    record.secondary_headline,
    record.article?.headline,
    record.article?.secondary_headline,
    record.article?.short_description,
    record.article?.long_description,
    record.ui_hindi?.title,
    record.ui_hindi?.secondary_headline,
    record.ui_hindi?.short_250,
    record.ui_hindi?.medium_500,
    record.ui_english?.title,
    record.ui_english?.secondary_headline,
    record.ui_english?.short_250,
    record.raw_articles_by_language?.hindi?.headline,
    record.raw_articles_by_language?.hindi?.words_250,
    record.raw_articles_by_language?.english?.headline,
    record.raw_articles_by_language?.english?.words_250,
  ).toLowerCase();

const hasAnyTerm = (text: string, terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));

const recordPassesCategoryContentGuard = (record: DeliveryRecord, requestedCategory: string) => {
  if (requestedCategory !== "Madhya Pradesh") {
    return true;
  }

  const text = getRecordSearchText(record);
  const madhyaPradeshSignals = [
    "madhya pradesh",
    "madhyapradesh",
    "mp ",
    "m.p.",
    "मध्य प्रदेश",
    "मध्यप्रदेश",
    "मप्र",
    "भोपाल",
    "इंदौर",
    "जबलपुर",
    "ग्वालियर",
    "उज्जैन",
    "खंडवा",
    "सागर",
    "रीवा",
    "सीहोर",
    "छिंदवाड़ा",
    "बड़वानी",
    "मऊगंज",
  ];
  const obviousOtherCategorySignals = [
    "क्रिकेट",
    "मैच",
    "खिलाड़ी",
    "टीम",
    "फुटबॉल",
    "ट्रॉफी",
    "पाकिस्तान",
    "अमेरिका",
    "ईरान",
    "रूस",
    "यूक्रेन",
    "चीन",
    "इजराइल",
    "वैश्विक",
    "शेयर",
    "सेंसेक्स",
    "निफ्टी",
    "बाजार",
    "stock",
    "market",
  ];

  return hasAnyTerm(text, madhyaPradeshSignals) || !hasAnyTerm(text, obviousOtherCategorySignals);
};

const getPlaceString = (...records: Array<Record<string, unknown> | null | undefined>) =>
  getString(
    ...records.flatMap((record) =>
      record
        ? [
            record.place,
            record.place_name,
            record.location,
            record.location_name,
            record.city,
            record.city_name,
            record.dateline,
          ]
        : [],
    ),
  );

const normalizeSummary = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(cleanNewswireText).filter(Boolean).slice(0, 6);
};

const toRequestedArticleLanguage = (language: string): ArticleLanguage | null =>
  language === "english" || language === "hindi" ? language : null;

const getLanguageRecord = (
  record: DeliveryRecord,
  language: ArticleLanguage,
  requestedLanguage: ArticleLanguage | null,
) => {
  const ui = language === "hindi" ? record.ui_hindi : record.ui_english;
  const article = language === "hindi"
    ? record.article?.hindi ?? record.hindi ?? (requestedLanguage !== "english" ? record.article : undefined)
    : record.article?.english ?? record.english ?? (requestedLanguage === "english" ? record.article : undefined);
  const raw = record.raw_articles_by_language?.[language];

  return { ui, article: article ?? {}, raw };
};

const getLocalizedSummary = (uiSubheadings: unknown, rawSummary: unknown, articleSummary: unknown) => {
  const uiSummary = normalizeSummary(uiSubheadings);
  if (uiSummary.length > 0) return uiSummary.slice(0, 3);

  const rawList = normalizeSummary(rawSummary);
  if (rawList.length > 0) return rawList.slice(0, 3);

  return normalizeSummary(articleSummary).slice(0, 3);
};

const normalizeLocalizedContent = (
  record: DeliveryRecord,
  fallbackCategory: string,
  language: ArticleLanguage,
  requestedLanguage: ArticleLanguage | null,
): LocalizedNewswireContent | null => {
  const { ui, article, raw } = getLanguageRecord(record, language, requestedLanguage);
  const media = record.media ?? {};
  const sourceTitle = getString(record.source?.title, record.feed_source);
  const useTopLevelFields = requestedLanguage === language || (!requestedLanguage && language === "hindi");
  const rawHeadline = getString(raw?.headline, article.headline, ui?.title, useTopLevelFields ? record.title : "");
  // A dedicated secondary_headline field (label + short line, e.g. "स्वास्थ्य
  // मंत्रालय, दवा : फर्जी डेटा...") ships from upstream in article/ui — it was
  // previously undeclared here and silently dropped. It maps directly onto
  // the app's kicker (composeArticleBox already splits kicker text at its
  // first colon for two-tone label/body styling), distinct from top_summary,
  // which remains the subheadline source below.
  const rawKicker = getString(
    article.secondary_headline,
    ui?.secondary_headline,
    useTopLevelFields ? record.secondary_headline : "",
  );
  const rawShort = getString(
    useTopLevelFields ? record.short_100 : "",
    raw?.words_250,
    ui?.short_250,
    raw?.words_100,
    ui?.short_100,
    article.short_description,
  );
  const rawMedium = getString(
    useTopLevelFields ? record.medium_300 : "",
    raw?.words_500,
    ui?.medium_500,
    raw?.words_300,
    ui?.medium_300,
    article.what_to_watch_next,
    article.long_description,
    rawShort,
  );
  const rawLong = getString(
    useTopLevelFields ? record.long_500 : "",
    raw?.words_1000,
    raw?.words_600,
    ui?.long_1000,
    article.long_description,
    ui?.long_500,
    raw?.words_500,
    language === "hindi" ? article.what_to_watch_next : "",
    rawMedium,
  );
  const summaryList = getLocalizedSummary(
    useTopLevelFields ? record.subheadings : undefined,
    ui?.subheadings,
    raw?.top_summary ?? article.top_summary,
  );

  if (!rawHeadline || !(rawShort || rawMedium || rawLong)) {
    return null;
  }

  // Only the first summary line is used as the subheadline banner — joining
  // every line with "|" produced a run-on, double-bulleted banner instead of
  // a single clean line.
  const rawSubheading = summaryList.length > 0
    ? summaryList[0]
    : getString(rawShort);
  const shortBody = trimToNearestFullStop(stripNewswirePhotoCaption(rawShort || rawMedium || rawLong), 250);
  const mediumBody = trimToNearestFullStop(stripNewswirePhotoCaption(rawMedium || rawLong || rawShort), 500);
  const longBody = trimToNearestFullStop(stripNewswirePhotoCaption(rawLong || rawMedium || rawShort), 1000);
  const rawCaption = getString(
    raw?.image_caption,
    useTopLevelFields ? record.image_caption : "",
    media.image_caption,
    ui?.image_caption,
    article.image_caption,
    extractNewswirePhotoCaption(rawLong || rawShort),
  );
  const place = getPlaceString(raw, article, ui, record);
  const normalized = normalizeIncomingArticleContent({
    headline: rawHeadline,
    subheading: rawSubheading,
    body: longBody || mediumBody || shortBody,
    caption: rawCaption,
    source: sourceTitle,
    agency: sourceTitle,
  });

  return {
    language,
    headline: normalized.headline,
    kicker: rawKicker,
    subheadings: summaryList,
    subheadline: normalized.subheading,
    body: normalized.body,
    shortBody: normalizeArticleBodyText(shortBody, normalized.headline, normalized.subheading),
    mediumBody: normalizeArticleBodyText(mediumBody, normalized.headline, normalized.subheading),
    longBody: normalizeArticleBodyText(longBody, normalized.headline, normalized.subheading),
    caption: normalized.caption,
    imageCaption: normalized.caption,
    place,
    imageUrl: getString(record.image_url, record.image_link, media.image_link, ui?.image_url),
    sourceUrl: getString(record.link, record.source?.url, record.source_url),
    category: getString(raw?.category, article.category, ui?.category, record.category, fallbackCategory),
  };
};

const normalizeDeliveryRecord = (
  record: DeliveryRecord,
  fallbackCategory: string,
  requestedLanguage: ArticleLanguage | null,
): NewswireStory => {
  const media = record.media ?? {};
  const localizedHindi = normalizeLocalizedContent(record, fallbackCategory, "hindi", requestedLanguage);
  const localizedEnglish = normalizeLocalizedContent(record, fallbackCategory, "english", requestedLanguage);
  const legacy = requestedLanguage === "english"
    ? localizedEnglish ?? localizedHindi
    : requestedLanguage === "hindi"
      ? localizedHindi ?? localizedEnglish
      : localizedHindi ?? localizedEnglish;
  const imageUrl = getString(record.image_url, record.image_link, media.image_link, legacy?.imageUrl);
  const sourceTitle = getString(record.source?.title, record.feed_source);
  const localized = {
    ...(localizedHindi ? { hindi: { ...localizedHindi, imageUrl } } : {}),
    ...(localizedEnglish ? { english: { ...localizedEnglish, imageUrl } } : {}),
  };

  return {
    id: String(record.id ?? record.rewrite_id ?? record.news_id ?? randomUUID()),
    language: legacy?.language ?? "hindi",
    category: legacy?.category ?? getString(record.category, fallbackCategory),
    headline: legacy?.headline ?? "Untitled",
    kicker: legacy?.kicker || undefined,
    subheadline: legacy?.subheadline ?? "",
    body: legacy?.body ?? "",
    shortBody: legacy?.shortBody ?? "",
    mediumBody: legacy?.mediumBody ?? "",
    longBody: legacy?.longBody ?? "",
    summary: legacy?.subheadings ?? [],
    caption: legacy?.caption ?? "",
    imageUrl,
    imageCaption: legacy?.imageCaption ?? "",
    place: legacy?.place || getPlaceString(record),
    sourceTitle,
    sourceUrl: legacy?.sourceUrl ?? getString(record.link, record.source?.url, record.source_url),
    publishedAt: record.uploaded ?? record.published_at ?? record.updated_at ?? record.source?.fetched_at ?? null,
    localized,
  };
};

const HINDI_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const ENGLISH_FRESHNESS_WINDOW_MS = 96 * 60 * 60 * 1000;

/**
 * The upstream delivery API has no pagination — the same category + limit
 * always returns the identical top-N-by-recency records, so repeat fetches
 * (a new page, a re-opened wizard, a different session) kept landing on the
 * exact same articles. Callers now always over-fetch the upstream's full
 * pool (see the `limit=100`/`limit=50` request sizes below, independent of
 * the caller's own requested count) so there is a real pool to pick from
 * here: restrict to the last 24h, prefer whatever this process hasn't
 * shuffle, then take however many the caller asked for.
 *
 * "No repeat" is a preference, not a hard floor: a category's entire live
 * pool is small (a thin one can be 3-5 articles total) and every caller
 * across every publisher shares the same 48h used-history, so heavy same-day
 * use — several batch runs, repeated testing, a large edition needing many
 * categories — can legitimately exhaust "fresh AND never-shown" for every
 * category at once. Confirmed live: after a day of testing, all 7
 * categories returned zero fresh-and-unused articles simultaneously despite
 * each having a normal-sized total pool, and a real batch run hit that
 * exact wall and rendered several pages blank instead of erroring — silent
 * data loss, not just a missed "no repeat" nicety. A page with no live
 * content is a worse outcome than a page with a repeated one, so once the
 * fresh-and-unused tier runs short, this tops up with the fresh (still
 * within 24h) articles that HAVE been used, oldest-used first — still real,
 * still current news, just not guaranteed novel — rather than ever handing
 * back fewer than requested while genuinely fresh content exists.
 */
const selectFreshUnusedRandom = async (
  records: NewswireStory[],
  limit: number,
  freshnessWindowMs = HINDI_FRESHNESS_WINDOW_MS,
): Promise<NewswireStory[]> => {
  const cutoff = Date.now() - freshnessWindowMs;
  const fresh = records.filter((record) => {
    if (!record.publishedAt) return false;
    const publishedAt = new Date(record.publishedAt).getTime();
    return Number.isFinite(publishedAt) && publishedAt >= cutoff;
  });

  for (let i = fresh.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }

  let selected = fresh.slice(0, limit);

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((record) => record.id));
    const freshIds = new Set(fresh.map((record) => record.id));
    const olderOrUndatedLive = records
      .filter((record) => !selectedIds.has(record.id) && !freshIds.has(record.id))
      .sort((a, b) => {
        const aPublishedAt = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bPublishedAt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bPublishedAt - aPublishedAt;
      });
    selected = [...selected, ...olderOrUndatedLive.slice(0, limit - selected.length)];
  }

  return selected;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "Sports";
  const language = searchParams.get("language") ?? "hindi";
  const requestedLanguage = toRequestedArticleLanguage(language);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 5) || 5));

  if (!isNewswireCategory(category)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unknown category. Use one of: ${NEWSWIRE_CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const apiKey = getApiKey();

  if (requestedLanguage === "english") {
    const upstreamCategory = GAUTAM_CATEGORY_BY_APP_CATEGORY[category];

    if (!upstreamCategory) {
      return NextResponse.json(
        {
          success: false,
          error: `English API does not provide '${category}'. Use one of: ${Object.keys(GAUTAM_CATEGORY_BY_APP_CATEGORY).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const upstreamUrl = new URL("/api/v1/delivery/news", GAUTAM_ENGLISH_API_BASE_URL);
    upstreamUrl.searchParams.set("language", "english");
    upstreamUrl.searchParams.set("category", upstreamCategory);
    // Always request the upstream's full pool, not the caller's `limit` --
    // selectFreshUnusedRandom below needs the whole pool to pick a random,
    // unused, last-24h subset from, not just the top N by recency.
    upstreamUrl.searchParams.set("limit", "50");

    // The upstream has genuine latency spikes into the high-teens/30s range
    // on an otherwise-healthy endpoint -- confirmed live, the "National"
    // category alone timing out at exactly the 30s per-attempt budget while
    // every other English category returned in a couple of seconds. The
    // Hindi/default path already gives a jittery upstream a second attempt
    // for the same reason (see UPSTREAM_MAX_ATTEMPTS above); this English
    // path had none, so a single slow response failed the request outright.
    const GAUTAM_ENGLISH_MAX_ATTEMPTS = 2;
    let lastErrorMessage = "English news API request failed.";
    let lastErrorStatus = 502;

    for (let attempt = 1; attempt <= GAUTAM_ENGLISH_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchGautamJson(upstreamUrl, getGautamEnglishApiKey());
        const payload = response.payload as {
          success?: boolean;
          data?: DeliveryRecord[];
          error?: unknown;
        } | null;

        if (!response.ok || payload?.success === false || !Array.isArray(payload?.data)) {
          lastErrorMessage = getString(payload?.error) || `English news API failed with ${response.status}`;
          lastErrorStatus = response.ok ? 502 : response.status || 502;
          continue;
        }

        const records = await selectFreshUnusedRandom(
          payload.data
            .filter((record) => recordMatchesRequestedCategory(record, category))
            .filter((record) => recordPassesCategoryContentGuard(record, category))
            .map((record) => normalizeDeliveryRecord(record, category, requestedLanguage)),
          limit,
          ENGLISH_FRESHNESS_WINDOW_MS,
        );

        return NextResponse.json({
          success: true,
          data: records,
          meta: {
            category,
            upstreamCategory,
            language: "english",
            count: records.length,
            baseUrl: GAUTAM_ENGLISH_API_BASE_URL,
          },
        });
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : "English news API request failed.";
        lastErrorStatus = 502;
      }
    }

    return NextResponse.json(
      { success: false, error: lastErrorMessage },
      { status: lastErrorStatus },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: "NEWSWIRE_API_KEY is not configured. Live category news cannot be loaded.",
        meta: {
          category,
          language,
          count: 0,
          baseUrl: "unconfigured",
        },
      },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  // Unbounded fetch() here previously let one slow/unresponsive base URL
  // (observed: 40-70s on a cold request) block the whole page — batch mode
  // runs several pages back-to-back, so one stalled category compounded into
  // minutes of dead time. A firm per-attempt deadline keeps a bad host from
  // costing more than UPSTREAM_TIMEOUT_MS before retrying or moving on to
  // the next base URL / the always-fast deterministic fallback pool.
  //
  // 12s and up to 2 attempts, not one 12-18s attempt: measured directly
  // against the live delivery API, response time tracks `limit`, and every
  // request here now asks for the upstream's full pool (100, regardless of
  // what the caller wants back — see selectFreshUnusedRandom) so it can
  // pick a random, unused, last-24h subset rather than always the same
  // deterministic top-N. That request normally lands around 3-4s, but the
  // upstream has genuine latency spikes into the teens of seconds on an
  // otherwise-healthy request (confirmed live: a request that came back in
  // 4s once took 17s on an identical retry seconds later, no connection or
  // warm-up difference between them). A single big budget burns the whole
  // thing on one unlucky roll; two 12s attempts spend the same rough
  // worst-case total but give a jittery upstream a real second chance
  // before conceding to fallback stories.
  const UPSTREAM_TIMEOUT_MS = 25000;
  const UPSTREAM_MAX_ATTEMPTS = 2;
  const upstreamLimit = Math.min(100, Math.max(30, limit * 4 + 10));

  for (const baseUrl of getApiBaseUrls()) {
    const upstreamUrl = new URL("/api/v1/delivery/news", baseUrl);
    upstreamUrl.searchParams.set("category", category);
    upstreamUrl.searchParams.set("language", language);
    upstreamUrl.searchParams.set("limit", String(upstreamLimit));

    for (let attempt = 1; attempt <= UPSTREAM_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      try {
        const response = await fetch(upstreamUrl, {
          headers: {
            "x-api-key": apiKey,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { success?: boolean; data?: DeliveryRecord[]; error?: unknown } | null;

        if (!response.ok || payload?.success === false) {
          errors.push(`${baseUrl} (attempt ${attempt}): ${getString(payload?.error) || response.status}`);
          continue;
        }

        const records = await selectFreshUnusedRandom(
          Array.isArray(payload?.data)
            ? payload.data
                .filter((record) => recordMatchesRequestedCategory(record, category))
                .filter((record) => recordPassesCategoryContentGuard(record, category))
                .map((record) => normalizeDeliveryRecord(record, category, requestedLanguage))
            : [],
          limit,
          HINDI_FRESHNESS_WINDOW_MS,
        );

        return NextResponse.json({
          success: true,
          data: records,
          meta: {
            category,
            language,
            count: records.length,
            baseUrl,
          },
        });
      } catch (error) {
        const message = error instanceof Error
          ? (error.name === "AbortError" ? `timed out after ${UPSTREAM_TIMEOUT_MS}ms` : error.message)
          : "request failed";
        errors.push(`${baseUrl} (attempt ${attempt}): ${message}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return NextResponse.json(
    {
      success: false,
      data: [],
      error: `All newswire backends failed. ${errors.join(" | ")}`,
      meta: {
        category,
        language,
        count: 0,
        baseUrl: "failed",
      },
    },
    { status: 502 },
  );
}
