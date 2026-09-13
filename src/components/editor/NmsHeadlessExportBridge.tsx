"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import type { NewswireStory } from "@/lib/newswire";
import type { NmsBundleArticle, NmsBundlePayload } from "@/lib/nms/nmsBundleTypes";
import { textValue } from "@/lib/nms/nmsBundleTypes";

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

const chunkArticlesForPages = (articles: NewswireStory[]) => {
  const chunks: NewswireStory[][] = [];
  const frontCount = Math.min(7, Math.max(1, articles.length));
  chunks.push(articles.slice(0, frontCount));

  for (let index = frontCount; index < articles.length; index += 7) {
    chunks.push(articles.slice(index, index + 7));
  }

  return chunks.filter((chunk) => chunk.length > 0);
};

const toNewswireStory = (article: NmsBundleArticle, index: number): NewswireStory => {
  const headline = textValue(article.headline) || textValue(article.originalHeadline) || `NMS Story ${index + 1}`;
  const body = cleanNmsBody(textValue(article.body) || textValue(article.originalBody) || "", headline);
  const imageUrl = textValue(article.coverImage?.url) || textValue(article.images?.find((image) => textValue(image.url))?.url);
  const place = textValue(article.place);
  const category = textValue(article.category) || "National";
  const reporterName = textValue(article.reporter?.nameHi) || textValue(article.reporter?.name) || "द क्लिफ न्यूज़";

  return {
    id: String(article.newsId ?? `nms-${index + 1}`),
    language: /[\u0900-\u097F]/.test(`${headline}\n${body}`) ? "hindi" : "english",
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
  } as NewswireStory;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function NmsHeadlessExportBridge() {
  const searchParams = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (searchParams.get("nmsExport") !== "1" || started.current) return;
    started.current = true;

    (async () => {
      try {
        const job = searchParams.get("job")?.trim() || "";
        console.log("[NMS export bridge] loading bundle payload", job);
        const response = await fetch(`/api/nms-bundle?includePayload=1${job ? `&job=${encodeURIComponent(job)}` : ""}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`NMS export payload fetch failed: ${response.status}`);
        const envelope = await response.json() as { payload?: NmsBundlePayload };
        const payload = envelope.payload;
        if (!payload || !Array.isArray(payload.articles)) throw new Error("NMS export payload missing articles.");

        const articles = payload.articles.map(toNewswireStory);
        const pageArticleChunks = chunkArticlesForPages(articles);
        console.log("[NMS export bridge] importing articles", articles.length, "pages", pageArticleChunks.length);
        const pageCount = Math.max(1, pageArticleChunks.length);
        const store = useEditorStore.getState();
        while (useEditorStore.getState().document.pages.length < pageCount) {
          useEditorStore.getState().addEditionPage("end");
        }
        while (useEditorStore.getState().document.pages.length > pageCount && useEditorStore.getState().document.pages.length > 1) {
          const pages = useEditorStore.getState().document.pages;
          useEditorStore.getState().setActivePage(pages[pages.length - 1].id);
          useEditorStore.getState().deleteActivePage();
        }

        useEditorStore.setState((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              newspaperName: "THE CLIFF NEWS",
            },
          },
        }));
        const bylineName = textValue(payload.targetUser?.nameHi) || textValue(payload.targetUser?.fullName) || "द क्लिफ न्यूज़";
        const subheadingStyle = {
          backgroundColor: "#111111",
          textColor: "#ffffff",
          borderColor: "#111111",
          backgroundOpacity: 1,
        };

        pageArticleChunks.forEach((chunk, pageIndex) => {
          const page = useEditorStore.getState().document.pages[pageIndex];
          useEditorStore.getState().setActivePage(page?.id ?? store.activePageId);
          useEditorStore.getState().importNewswireStories(pageIndex === 0 ? "National" : "Madhya Pradesh", chunk, {
            languageMode: "hindi",
            bylineName,
            pageKind: pageIndex === 0 ? "front" : "inside",
            subheadingStyle,
          });
        });
        useEditorStore.getState().setActivePage(useEditorStore.getState().document.pages[0]?.id ?? store.activePageId);
        useEditorStore.setState((state) => ({
          document: {
            ...state.document,
            pages: state.document.pages.map((page, index) => ({
              ...page,
              pageType: index === 0 ? "front" : "city",
              sectionName: index === 0 ? "Front Page" : page.sectionName || "City",
            })),
          },
          pageType: "front",
        }));

        await document.fonts?.ready;
        await wait(2500);
        console.log("[NMS export bridge] ready for editor PDF export");
        (window as typeof window & { __NMS_EXPORT_READY?: boolean; __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_READY = true;
      } catch (error) {
        console.error("[NMS export bridge] failed", error);
        (window as typeof window & { __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_ERROR = error instanceof Error ? error.message : String(error);
      }
    })();
  }, [searchParams]);

  return null;
}


