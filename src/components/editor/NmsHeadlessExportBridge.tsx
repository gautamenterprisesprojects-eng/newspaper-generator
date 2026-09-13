"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import type { NewswireStory } from "@/lib/newswire";
import type { NmsBundleArticle, NmsBundlePayload } from "@/lib/nms/nmsBundleTypes";
import { textValue } from "@/lib/nms/nmsBundleTypes";

const toNewswireStory = (article: NmsBundleArticle, index: number): NewswireStory => {
  const headline = textValue(article.headline) || textValue(article.originalHeadline) || `NMS Story ${index + 1}`;
  const body = textValue(article.body) || textValue(article.originalBody) || "";
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
    shortBody: body,
    mediumBody: body,
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
        console.log("[NMS export bridge] loading latest bundle payload");
        const response = await fetch("/api/nms-bundle?includePayload=1", { cache: "no-store" });
        if (!response.ok) throw new Error(`NMS export payload fetch failed: ${response.status}`);
        const envelope = await response.json() as { payload?: NmsBundlePayload };
        const payload = envelope.payload;
        if (!payload || !Array.isArray(payload.articles)) throw new Error("NMS export payload missing articles.");

        const articles = payload.articles.map(toNewswireStory);
        console.log("[NMS export bridge] importing articles", articles.length);
        const pageCount = Math.max(1, Math.ceil(articles.length / 7));
        const store = useEditorStore.getState();
        while (useEditorStore.getState().document.pages.length < pageCount) {
          useEditorStore.getState().addEditionPage("end");
        }
        while (useEditorStore.getState().document.pages.length > pageCount && useEditorStore.getState().document.pages.length > 1) {
          const pages = useEditorStore.getState().document.pages;
          useEditorStore.getState().setActivePage(pages[pages.length - 1].id);
          useEditorStore.getState().deleteActivePage();
        }

        useEditorStore.getState().setActivePage(useEditorStore.getState().document.pages[0]?.id ?? store.activePageId);
        useEditorStore.setState((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              newspaperName: "THE CLIFF NEWS",
            },
          },
        }));
        useEditorStore.getState().importNewswireStories("National", articles, {
          languageMode: "hindi",
          bylineName: textValue(payload.targetUser?.nameHi) || textValue(payload.targetUser?.fullName) || "द क्लिफ न्यूज़",
          pageKind: "front",
          subheadingStyle: {
            backgroundColor: "#111111",
            textColor: "#ffffff",
            borderColor: "#111111",
            backgroundOpacity: 1,
          },
        });

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


