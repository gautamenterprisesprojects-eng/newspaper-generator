import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NewswireStory } from "@/lib/newswire";
import { getNmsBundleDir } from "./nmsBundleStorage";
import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { pickNmsArticleImageUrl, textValue } from "./nmsBundleTypes";

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

const limitWords = (text: string, limit: number) => {
  const parts = words(text);
  return parts.length > limit ? parts.slice(0, limit).join(" ") : text;
};

const cleanNmsBody = (body: string, headline: string) => {
  const lines = body
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const cleaned: string[] = [];
  const labelOnly = /^(?:इमेज कैप्शन|हेडलाइन|सबहेडिंग\s*\d*|फोटो कैप्शन|कैप्शन)\s*:?\s*$/u;
  const headlineText = headline.replace(/\s+/gu, " ").trim();

  for (const line of lines) {
    if (labelOnly.test(line)) continue;
    if (line.replace(/\s+/gu, " ").trim() === headlineText) continue;
    cleaned.push(line.replace(/^(?:इमेज कैप्शन|हेडलाइन|सबहेडिंग\s*\d*|फोटो कैप्शन|कैप्शन)\s*:\s*/u, ""));
  }

  return cleaned.join("\n\n").trim() || body;
};

export const nmsBundleArticleToNewswireStory = (article: NmsBundleArticle, index: number): NewswireStory => {
  const headline = textValue(article.headline) || textValue(article.originalHeadline) || `NMS Story ${index + 1}`;
  const body = cleanNmsBody(textValue(article.body) || textValue(article.originalBody) || "", headline);
  const imageUrl = pickNmsArticleImageUrl(article);
  const place = textValue(article.place);
  const category = textValue(article.category) || "National";
  const reporterName = textValue(article.reporter?.nameHi) || textValue(article.reporter?.name) || "द क्लिफ न्यूज़";

  return {
    id: String(article.newsId ?? `nms-${index + 1}`),
    language: /[\u0900-\u097F]/u.test(`${headline}\n${body}`) ? "hindi" : "english",
    category,
    headline,
    subheadline: "",
    body,
    shortBody: limitWords(body, 220),
    mediumBody: limitWords(body, 420),
    longBody: body,
    summary: [],
    caption: "",
    imageUrl,
    imageCaption: "",
    place,
    sourceTitle: "NMS",
    sourceUrl: "",
    publishedAt: null,
    bylineName: reporterName,
    photoCredit: "",
  };
};

export const loadNmsBundleNewswireStories = async (limit: number): Promise<NewswireStory[]> => {
  const payloadFile = path.join(getNmsBundleDir(), "latest.json");
  try {
    const payload = JSON.parse(await readFile(payloadFile, "utf8")) as NmsBundlePayload;
    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    return articles
      .slice(0, Math.max(0, limit))
      .map((article, index) => nmsBundleArticleToNewswireStory(article, index));
  } catch {
    return [];
  }
};
