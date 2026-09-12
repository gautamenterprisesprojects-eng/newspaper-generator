import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { textValue } from "./nmsBundleTypes";

const DEFAULT_API_BASE_URL = "https://api.gautamenterprises.org";
const CLIFFDEMO3_CATEGORIES = ["National", "Madhya Pradesh", "International", "Business", "Sports", "Health"];

const getApiBaseUrls = () =>
  (process.env.NEWSWIRE_API_BASE_URLS || process.env.NEWSWIRE_API_BASE_URL || DEFAULT_API_BASE_URL)
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const getApiKey = () => process.env.NEWSWIRE_API_KEY || process.env.NEWS_AUTOMATION_API_KEY || process.env.GAUTAM_NEWS_API_KEY || "";

const normalizeFallbackRecord = (record: Record<string, unknown>, category: string, index: number): NmsBundleArticle => {
  const uiHindi = typeof record.ui_hindi === "object" && record.ui_hindi ? record.ui_hindi as Record<string, unknown> : {};
  const article = typeof record.article === "object" && record.article ? record.article as Record<string, unknown> : {};
  const media = typeof record.media === "object" && record.media ? record.media as Record<string, unknown> : {};
  const headline = textValue(uiHindi.title) || textValue(record.title) || textValue(article.headline) || `PageMint fallback story ${index + 1}`;
  const body = textValue(uiHindi.long_500) || textValue(uiHindi.medium_300) || textValue(uiHindi.short_250) || textValue(record.long_500) || textValue(record.medium_300) || textValue(article.long_description) || textValue(article.short_description);
  const imageUrl = textValue(uiHindi.image_url) || textValue(record.image_url) || textValue(record.image_link) || textValue(media.image_link);
  const place = textValue(uiHindi.place) || textValue(uiHindi.city) || textValue(record.place) || textValue(record.city);

  return {
    newsId: `pagemint-fill-${record.id ?? record.news_id ?? index}`,
    language: "hindi",
    headline,
    body,
    category,
    place,
    images: imageUrl ? [{ id: `pagemint-fill-image-${record.id ?? index}`, order: 1, isCover: true, url: imageUrl }] : [],
    coverImage: imageUrl ? { id: `pagemint-fill-image-${record.id ?? index}`, order: 1, isCover: true, url: imageUrl } : null,
  };
};

const fetchFallbackCategory = async (category: string, limit: number): Promise<NmsBundleArticle[]> => {
  const apiKey = getApiKey();
  if (!apiKey || limit <= 0) return [];

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const url = new URL("/api/v1/delivery/news", baseUrl);
      url.searchParams.set("category", category);
      url.searchParams.set("language", "hindi");
      url.searchParams.set("limit", String(Math.max(limit, 8)));
      const response = await fetch(url, { headers: { "x-api-key": apiKey }, cache: "no-store" });
      const payload = await response.json().catch(() => null) as { success?: boolean; data?: Record<string, unknown>[] } | null;
      if (!response.ok || !Array.isArray(payload?.data)) continue;
      return payload.data.slice(0, limit).map((record, index) => normalizeFallbackRecord(record, category, index));
    } catch {
      // Try the next configured backend.
    }
  }

  return [];
};

export const ensureNmsArticleCapacity = async (payload: NmsBundlePayload) => {
  const minimum = Math.max(1, Number(process.env.NMS_MIN_ARTICLE_COUNT || 12));
  const originalArticles = Array.isArray(payload.articles) ? payload.articles : [];
  const articles = [...originalArticles];
  let remaining = Math.max(0, minimum - articles.length);

  for (const category of CLIFFDEMO3_CATEGORIES) {
    if (remaining <= 0) break;
    const fetched = await fetchFallbackCategory(category, remaining);
    articles.push(...fetched);
    remaining = Math.max(0, minimum - articles.length);
  }

  return {
    articles,
    filledArticleCount: Math.max(0, articles.length - originalArticles.length),
  };
};
