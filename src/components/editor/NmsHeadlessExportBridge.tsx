"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import type { NewswireStory } from "@/lib/newswire";
import type { PageType } from "@/types/page";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
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

const namespaceActivePageStories = (pageIndex: number) => {
  const prefix = `nms-p${pageIndex + 1}-`;
  useEditorStore.setState((state) => {
    const pageId = state.activePageId;
    const idMap = new Map(state.stories.map((story) => [story.id, `${prefix}${story.id}`]));
    if (idMap.size === 0) return {};

    const stories = state.stories.map((story) => ({
      ...story,
      id: idMap.get(story.id) ?? story.id,
    }));
    const documentStories = { ...state.document.stories };
    idMap.forEach((newId, oldId) => {
      const story = documentStories[oldId];
      if (story) {
        documentStories[newId] = { ...story, id: newId };
        delete documentStories[oldId];
      }
    });

    return {
      stories,
      selectedStoryId: state.selectedStoryId ? idMap.get(state.selectedStoryId) ?? state.selectedStoryId : state.selectedStoryId,
      selectedObjects: state.selectedObjects.map((selection) => ({
        ...selection,
        storyId: idMap.get(selection.storyId) ?? selection.storyId,
      })),
      document: {
        ...state.document,
        stories: documentStories,
        frames: Object.fromEntries(
          Object.entries(state.document.frames).map(([frameId, frame]) => [
            frameId,
            frame.pageId === pageId && frame.storyId && idMap.has(frame.storyId)
              ? { ...frame, storyId: idMap.get(frame.storyId) }
              : frame,
          ]),
        ),
        pages: state.document.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                stories: page.stories.map((placement) => ({
                  ...placement,
                  storyId: idMap.get(placement.storyId) ?? placement.storyId,
                })),
              }
            : page,
        ),
      },
    };
  });
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

const resizeDocumentToPageCount = (pageCount: number) => {
  while (useEditorStore.getState().document.pages.length < pageCount) {
    useEditorStore.getState().addEditionPage("end");
  }
  while (useEditorStore.getState().document.pages.length > pageCount && useEditorStore.getState().document.pages.length > 1) {
    const pages = useEditorStore.getState().document.pages;
    useEditorStore.getState().setActivePage(pages[pages.length - 1].id);
    useEditorStore.getState().deleteActivePage();
  }
};

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

        const plannedPages = payload.editionPlan?.pages;
        if (!Array.isArray(plannedPages) || plannedPages.length === 0) {
          throw new Error("NMS export payload missing sequential edition plan.");
        }

        console.log("[NMS export bridge] sequential pages", plannedPages.map((page) => ({
          pageNumber: page.pageNumber,
          templateId: page.templateId,
          templateName: page.templateName,
          boxes: page.boxCount,
          nms: page.nmsArticleCount,
          fill: page.fillArticleCount,
        })));

        resizeDocumentToPageCount(plannedPages.length);

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

        for (let pageIndex = 0; pageIndex < plannedPages.length; pageIndex += 1) {
          const planned = plannedPages[pageIndex];
          const page = useEditorStore.getState().document.pages[pageIndex];
          if (!page) throw new Error(`Queued page ${pageIndex + 1} is missing from the document.`);

          useEditorStore.getState().setActivePage(page.id);
          const chunk = (planned.articles ?? []).map((article, articleIndex) =>
            toNewswireStory(article, pageIndex * 100 + articleIndex),
          );
          if (chunk.length === 0) {
            throw new Error(`Queued page ${planned.pageNumber} (${planned.templateName}) has no articles.`);
          }

          console.log("[NMS export bridge] generating queued page", {
            pageNumber: planned.pageNumber,
            pageKind: planned.pageKind,
            templateId: planned.templateId,
            templateName: planned.templateName,
            articleCount: chunk.length,
          });

          useEditorStore.getState().importNewswireStories(
            "NMS Bundle",
            chunk,
            {
              languageMode: "hindi",
              bylineName,
              pageKind: planned.pageKind,
              templateId: planned.templateId as TemplateId,
              subheadingStyle,
              isBatchGeneration: true,
            },
          );
          namespaceActivePageStories(pageIndex);
          useEditorStore.setState((state) => ({
            document: {
              ...state.document,
              pages: state.document.pages.map((documentPage, index) =>
                index === pageIndex
                  ? {
                      ...documentPage,
                      pageType: (planned.pageKind === "front" ? "front" : "city") as PageType,
                      sectionName: planned.pageKind === "front" ? "Front Page" : planned.templateName || "City",
                    }
                  : documentPage,
              ),
            },
          }));

          await document.fonts?.ready;
          await wait(750);
        }

        const finalPages = useEditorStore.getState().document.pages;
        useEditorStore.getState().setActivePage(finalPages[finalPages.length - 1]?.id ?? finalPages[0]?.id);

        await wait(2500);
        const finalState = useEditorStore.getState();
        (window as typeof window & { __NMS_EXPORT_DEBUG?: unknown }).__NMS_EXPORT_DEBUG = {
          activePageId: finalState.activePageId,
          pageType: finalState.pageType,
          pageCount: finalState.document.pages.length,
          pages: finalState.document.pages.map((page) => ({
            id: page.id,
            pageNumber: page.pageNumber,
            pageType: page.pageType,
            sectionName: page.sectionName,
            storyIds: page.stories.map((placement) => placement.storyId),
          })),
          editionPlan: plannedPages.map((page) => ({
            pageNumber: page.pageNumber,
            templateId: page.templateId,
            templateName: page.templateName,
            boxCount: page.boxCount,
            nmsArticleCount: page.nmsArticleCount,
            fillArticleCount: page.fillArticleCount,
          })),
          activeStoryIds: finalState.stories.map((story) => story.id),
          documentStoryCount: Object.keys(finalState.document.stories).length,
        };

        await document.fonts?.ready;
        await wait(400);
        console.log("[NMS export bridge] ready for combined editor PDF export");
        (window as typeof window & { __NMS_EXPORT_READY?: boolean; __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_READY = true;
      } catch (error) {
        console.error("[NMS export bridge] failed", error);
        (window as typeof window & { __NMS_EXPORT_ERROR?: string }).__NMS_EXPORT_ERROR = error instanceof Error ? error.message : String(error);
      }
    })();
  }, [searchParams]);

  return null;
}
