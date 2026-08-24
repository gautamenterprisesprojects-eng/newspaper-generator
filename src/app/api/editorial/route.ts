import { NextResponse } from "next/server";
import https from "node:https";

/**
 * Editorial-page feed.
 *
 * Proxies the two upstream endpoints the editorial page draws on:
 *
 *   /api/dashboard/editorial/grouped   the leader and comment articles
 *   /api/dashboard/rashifal/grouped    the twelve daily horoscope entries
 *   /api/dashboard/health/grouped      the health package reserved for box 6
 *
 * Proxied rather than fetched from the browser so the page is not at the mercy
 * of the upstream host's CORS policy, matching how /api/newswire already works.
 *
 * Editorial-only: nothing here is reachable from the front-page or inside-page
 * flows, so those keep fetching exactly as they did.
 */

export const runtime = "nodejs";

const EDITORIAL_API_BASE_URL =
  process.env.EDITORIAL_API_BASE_URL ?? "https://api.gautamenterprises.org";
const EDITORIAL_API_KEY =
  process.env.EDITORIAL_API_KEY ||
  process.env.GAUTAM_NEWS_API_KEY ||
  process.env.NEWSWIRE_API_KEY ||
  "1f167aa0133f4836b63de2e751228b55a5b730bd95df43379c2901bbe1a7d4d3";

/** A record as the upstream editorial endpoint returns it. */
type UpstreamEditorialRecord = {
  id?: number | string;
  category?: string;
  title?: string;
  secondary_headline?: string;
  summary?: string;
  article?: string;
  state?: string;
  subheadings?: unknown;
};

/** A record as the upstream rashifal endpoint returns it. */
type UpstreamRashifalRecord = {
  id?: number | string;
  title?: string;
  summary?: string;
  article?: string;
  source_url?: string;
  luckyNumber?: number | string;
  luckyColor?: string;
  compatibility?: string;
};

type CliffHoroscopeRecord = {
  id?: number | string;
  sign?: string;
  date?: string;
  prediction?: string;
  luckyNumber?: number | string;
  luckyColor?: string;
  compatibility?: string;
  mood?: string;
  language?: string;
};

type UpstreamGrouped<Record> = {
  status?: string;
  grouped_records?: Array<{ category?: string; count?: number; records?: Record[] }>;
};

type UpstreamList<Record> = {
  success?: boolean;
  data?: Record[];
};

type CliffHoroscopeList = {
  success?: boolean;
  data?: CliffHoroscopeRecord[];
  count?: number;
};

type NewswireHealthStory = {
  id?: number | string;
  category?: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  shortBody?: string;
  mediumBody?: string;
  longBody?: string;
  summary?: unknown;
  sourceTitle?: string;
  place?: string;
};

// A fresh agent per call, keep-alive off: confirmed live that this route's
// concurrent requests to the same upstream host intermittently fail with a
// low-level "wrong version number" TLS error under real production traffic
// (other publishers' own concurrent /api/newswire calls hitting the same
// host at the same time) even after switching off the global fetch() --
// classic symptom of a REUSED keep-alive socket getting desynced when the
// server multiplexes/closes connections uncleanly under concurrent load. A
// dedicated non-keep-alive agent forces a brand new TCP+TLS handshake per
// request instead of pulling a possibly-corrupted socket out of a shared
// pool.
const freshAgent = new https.Agent({ keepAlive: false });

const requestJsonOnce = (url: string, headers: Record<string, string>): Promise<{ status: number; ok: boolean; body: unknown }> =>
  new Promise((resolve, reject) => {
    const request = https.request(url, { method: "GET", headers, agent: freshAgent }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({
            status: response.statusCode ?? 0,
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
            body: text ? JSON.parse(text) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(20000, () => request.destroy(new Error(`Request to ${url} timed out.`)));
    request.on("error", reject);
    request.end();
  });

/** One retry on top of the fresh-agent fix above -- a second layer against whatever residual flakiness this upstream has under concurrent load, matching /api/newswire's own established retry pattern for the same host. */
const fetchJson = async (url: string, headers: Record<string, string>): Promise<{ status: number; ok: boolean; body: unknown }> => {
  try {
    return await requestJsonOnce(url, headers);
  } catch {
    return requestJsonOnce(url, headers);
  }
};

const fetchApiJson = async (url: string) => {
  const response = await fetchJson(url, {
    accept: "application/json",
    "x-api-key": EDITORIAL_API_KEY,
  });

  if (!response.ok) {
    throw new Error(`Upstream API responded ${response.status}`);
  }

  return response.body;
};

const fetchEditorialArticles = async (limit: string): Promise<UpstreamEditorialRecord[]> => {
  const url = new URL("/api/v1/editorial", EDITORIAL_API_BASE_URL);
  url.searchParams.set("limit", limit);
  const payload = (await fetchApiJson(url.toString())) as UpstreamList<UpstreamEditorialRecord>;

  if (payload?.success && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
};

const shuffleRecords = <Record,>(records: Record[]) => {
  const shuffled = [...records];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const fetchGroupedApi = async <Record,>(endpoint: string, limit: string): Promise<Record[]> => {
  const url = new URL(`/api/v1/${endpoint}/grouped`, EDITORIAL_API_BASE_URL);
  url.searchParams.set("limit", limit);
  // Loosely typed on purpose, matching this endpoint's actual (not the
  // UpstreamGrouped<Record> type's documented) response shape -- unchanged
  // from before this route's fetch() calls were swapped for fetchJson().
  const payload = (await fetchApiJson(url.toString())) as { success?: boolean; data?: Array<{ records?: Record[] }> };

  if (payload?.success && Array.isArray(payload?.data)) {
    const allRecords: Record[] = [];
    for (const group of payload.data) {
      if (Array.isArray(group.records)) {
        allRecords.push(...group.records);
      }
    }
    return allRecords;
  }
  return [];
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const summaryText = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join(" ");
  }
  return typeof value === "string" ? value.trim() : "";
};

const HINDI_SIGN_BY_ENGLISH: Record<string, string> = {
  aries: "मेष",
  taurus: "वृषभ",
  gemini: "मिथुन",
  cancer: "कर्क",
  leo: "सिंह",
  virgo: "कन्या",
  libra: "तुला",
  scorpio: "वृश्चिक",
  sagittarius: "धनु",
  capricorn: "मकर",
  aquarius: "कुंभ",
  pisces: "मीन",
};

const HINDI_COLOR_BY_ENGLISH: Record<string, string> = {
  black: "काला",
  blue: "नीला",
  brown: "भूरा",
  cream: "क्रीम",
  gold: "सुनहरा",
  golden: "सुनहरा",
  green: "हरा",
  grey: "धूसर",
  gray: "धूसर",
  lavender: "लैवेंडर",
  navy: "गहरा नीला",
  "navy blue": "गहरा नीला",
  orange: "नारंगी",
  peach: "पीच",
  pink: "गुलाबी",
  purple: "बैंगनी",
  red: "लाल",
  silver: "चांदी",
  white: "सफेद",
  yellow: "पीला",
};

const toHindiColor = (color: string) => {
  const normalized = color.trim().toLowerCase();
  return HINDI_COLOR_BY_ENGLISH[normalized] ?? color.trim();
};

const fetchCliffHoroscope = async (): Promise<UpstreamRashifalRecord[]> => {
  const response = await fetchJson("https://api.thecliffnews.in/api/horoscope?language=HINDI", {
    accept: "application/json",
  });

  if (!response.ok) {
    throw new Error(`Horoscope API responded ${response.status}`);
  }

  const payload = response.body as CliffHoroscopeList;

  if (!payload?.success || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data.reduce<UpstreamRashifalRecord[]>((records, record) => {
      const signKey = firstText(record.sign).toLowerCase();
      const hindiSign = HINDI_SIGN_BY_ENGLISH[signKey];
      const prediction = firstText(record.prediction);

      if (!hindiSign || !prediction) {
        return records;
      }

      const luckyColor = record.luckyColor ? toHindiColor(String(record.luckyColor)) : "";
      const compatibility = record.compatibility
        ? (HINDI_SIGN_BY_ENGLISH[String(record.compatibility).trim().toLowerCase()] ??
          String(record.compatibility).trim())
        : "";

      records.push({
        id: record.id ?? `horoscope-${signKey}`,
        title: `${hindiSign} राशिफल`,
        summary: prediction,
        article: prediction,
        luckyNumber: record.luckyNumber,
        luckyColor,
        compatibility,
        source_url: "https://api.thecliffnews.in/api/horoscope?language=HINDI",
      });

      return records;
    }, []);
};

const fetchHealthFromNewswire = async (request: Request): Promise<UpstreamEditorialRecord[]> => {
  const url = new URL("/api/newswire", request.url);
  url.searchParams.set("category", "Health");
  url.searchParams.set("language", "hindi");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    data?: NewswireHealthStory[];
  } | null;

  if (!response.ok || payload?.success === false || !Array.isArray(payload?.data)) {
    return [];
  }

  return payload.data.map((story, index) => {
    const body = firstText(story.longBody, story.body, story.mediumBody, story.shortBody);
    const summary = summaryText(story.summary) || firstText(story.shortBody, story.subheadline);
    return {
      id: story.id ?? `health-${index + 1}`,
      category: "Health",
      title: firstText(story.headline),
      secondary_headline: firstText(story.headline),
      summary,
      article: body || summary,
      state: firstText(story.place, story.sourceTitle),
    };
  });
};

export const GET = async (request: Request) => {
  const requestedLimit = new URL(request.url).searchParams.get("limit") ?? "50";
  const editorialPoolLimit = String(Math.max(Number.parseInt(requestedLimit, 10) || 50, 50));

  try {
    // Both are independent, so fetch them together rather than in series.
    const [editorialPool, rashifal, groupedHealth] = await Promise.all([
      fetchEditorialArticles(editorialPoolLimit),
      fetchCliffHoroscope().catch(() => fetchGroupedApi<UpstreamRashifalRecord>("rashifal", requestedLimit)),
      fetchGroupedApi<UpstreamEditorialRecord>("health", "1").catch(() => []),
    ]);
    const articles = shuffleRecords(editorialPool).slice(0, Number.parseInt(requestedLimit, 10) || 50);
    const health = groupedHealth.length > 0 ? groupedHealth : await fetchHealthFromNewswire(request);

    return NextResponse.json(
      {
        success: true,
        articles,
        rashifal,
        health,
        counts: { articles: articles.length, rashifal: rashifal.length, health: health.length },
        source: {
          editorial: `${EDITORIAL_API_BASE_URL}/api/v1/editorial?limit=${editorialPoolLimit}`,
          rashifal: "https://api.thecliffnews.in/api/horoscope?language=HINDI",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    // Surface the failure rather than returning an empty page that looks like
    // "there is no editorial copy today".
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load the editorial feed.",
        articles: [],
        rashifal: [],
      },
      { status: 502 },
    );
  }
};
