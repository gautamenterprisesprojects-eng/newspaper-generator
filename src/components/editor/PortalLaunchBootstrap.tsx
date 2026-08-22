"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import { getHeaderMaskSamplePoints } from "@/engines/HeaderSystem/HeaderSlotGeometry";
import { sampleImageColorsAt } from "@/lib/sampleImageColors";
import type { PageType } from "@/types/page";
import {
  YOUTH_UPDATE_PUBLISHER_ID,
  YOUTH_UPDATE_TEASER_HEADLINES,
  YOUTH_UPDATE_TEASER_IMAGE_URLS,
  YOUTH_UPDATE_TEASER_LABELS,
} from "@/engines/MasterPage/YouthUpdateConfig";
import { useYouthUpdateTeaserStore, type YouthUpdateTeaserSlot } from "@/store/youthUpdateTeaserStore";
import { loadYouthUpdateInsideAuthorsFromPortal } from "@/store/youthUpdateInsideAuthorStore";
import { fetchYouthUpdateMastheadApiTeasers } from "@/lib/youthUpdateMastheadApiTeasers";

type PortalPageSection = {
  page_number: number;
  section: string;
  header_type: string;
  notes?: string;
  category?: string;
};

function clampPageCount(value: string | null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(64, Math.floor(parsed)));
}

function clampSelectedPageNumber(value: string | null, pageCount: number | null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const maxPage = pageCount ?? 64;
  return Math.max(1, Math.min(maxPage, Math.floor(parsed)));
}

function parsePageSections(value: string | null): PortalPageSection[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        page_number: Number(item?.page_number),
        section: String(item?.section || ""),
        header_type: String(item?.header_type || ""),
        notes: String(item?.notes || ""),
        category: item?.category ? String(item.category) : undefined,
      }))
      .filter((item) => Number.isFinite(item.page_number) && item.page_number > 0);
  } catch {
    return [];
  }
}

type PublisherProfileResponse = {
  city?: string;
  cover_price?: string | number;
  publication_start_year?: number | string | null;
  front_page_header_url?: string;
  remaining_page_header_url?: string;
  youth_update_inside_author_image_url?: string;
  youth_update_inside_author_name?: string;
  youth_update_inside_author_designation?: string;
  // Set by SaaSExecuteGeneration (see nextVolumeNumber in the portal's
  // saas_handlers.go) before this profile fetch ever runs — the DB already
  // holds the freshly-incremented value by the time the batch iframe loads.
  last_volume_number?: number | string | null;
};

export function PortalLaunchBootstrap() {
  const searchParams = useSearchParams();
  const appliedKey = useRef<string | null>(null);
  const appliedProfileFetchKey = useRef<string | null>(null);

  useEffect(() => {
    const newspaperName = searchParams.get("newspaperName")?.trim();
    const pageCount = clampPageCount(searchParams.get("pageCount"));
    const pageSections = parsePageSections(searchParams.get("pageSections"));
    const mode = searchParams.get("mode") === "single" ? "single" : "full";
    // Single-page mode always launches with pageCount=1 (one page is being
    // edited in this session) — clamping selectedPageNumber against that
    // silently forced every single-page generation down to page 1 no matter
    // which real page number the publisher picked, making every non-front
    // page (Sports, City, Editorial, ...) render as the front page. The real
    // upper bound is the edition's full page count, from the page plan.
    const editionPageCount = pageSections.length > 0
      ? Math.max(...pageSections.map((section) => section.page_number))
      : mode === "single"
        ? null
        : pageCount;
    const selectedPageNumber = clampSelectedPageNumber(searchParams.get("selectedPageNumber"), editionPageCount);
    const issueNumber = searchParams.get("issueNumber")?.trim() || "";
    // India-only product: fall back to the IST calendar day, not UTC --
    // toISOString() is UTC and during 00:00-05:29 IST still reports the
    // previous day (see the matching fix in the portal's dashboard today()).
    const publicationDate =
      searchParams.get("publicationDate")?.trim() ||
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const pageKind = searchParams.get("pageKind") === "advertisement" ? "advertisement" : searchParams.get("pageKind") === "front" ? "front" : "normal";
    const selectedPageName = searchParams.get("selectedPageName")?.trim() || "";
    const publisherId = searchParams.get("publisherId")?.trim() || "";

    if (!newspaperName && !pageCount && !issueNumber && !publisherId) return;

    const key = searchParams.toString();
    if (appliedKey.current === key) return;
    appliedKey.current = key;

    const targetPages = mode === "single" ? 1 : pageCount ?? useEditorStore.getState().document.pages.length;

    while (useEditorStore.getState().document.pages.length < targetPages) {
      useEditorStore.getState().addEditionPage("end");
    }
    while (useEditorStore.getState().document.pages.length > targetPages && useEditorStore.getState().document.pages.length > 1) {
      const pages = useEditorStore.getState().document.pages;
      useEditorStore.getState().setActivePage(pages[pages.length - 1].id);
      useEditorStore.getState().deleteActivePage();
    }

    const state = useEditorStore.getState();
    const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;
    const activeHeaderSet = activeHeaderSetId ? state.document.headerSystem.headerSets[activeHeaderSetId] : null;
    const profileId = activeHeaderSet?.publicationProfileId;

    if (profileId) {
      state.updatePublicationProfile(profileId, {
        publicationName: newspaperName || state.document.metadata.newspaperName,
        publicationNameHindi: newspaperName || state.document.metadata.newspaperName,
        date: publicationDate,
        issueLabel: issueNumber,
      });
    }

    const latest = useEditorStore.getState();
    latest.document.pages.forEach((page, index) => {
      latest.setActivePage(page.id);
      const planned = pageSections.find((item) => item.page_number === index + 1);
      const isFrontPage = mode === "single" ? pageKind === "front" || selectedPageNumber === 1 : planned?.header_type === "front" || index === 0;
      latest.setPageType((isFrontPage ? "front" : "city") as PageType);
    });

    if (mode === "single" && selectedPageNumber) {
      const sectionName =
        pageKind === "front" || selectedPageNumber === 1
          ? "Front Page"
          : pageKind === "advertisement"
            ? selectedPageName || "Advertisement Page"
            : selectedPageName || "Normal Page";

      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) => ({
            ...page,
            pageNumber: selectedPageNumber,
            sectionName,
          })),
        },
      }));
    } else if (mode === "full" && pageSections.length > 0) {
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page, index) => {
            const planned = pageSections.find((item) => item.page_number === index + 1);
            return {
              ...page,
              pageNumber: planned?.page_number || index + 1,
              sectionName: planned?.section || page.sectionName,
            };
          }),
        },
      }));
    }

    useEditorStore.getState().setActivePage(useEditorStore.getState().document.pages[0]?.id ?? latest.activePageId);
  }, [searchParams]);

  // Separate effect: the publisher's own masthead artwork and profile fields
  // (price, "years published") are too large / not carried in the launch
  // query string, so they're fetched from the portal directly rather than
  // read from searchParams like everything else in this file.
  useEffect(() => {
    const publisherId = searchParams.get("publisherId")?.trim() || "";
    const authToken = searchParams.get("authToken")?.trim() || "";
    const apiBase = searchParams.get("apiBase")?.trim() || "http://localhost:8080/api/v1";

    if (!publisherId || !authToken) return;

    const key = `${apiBase}|${publisherId}|${authToken}`;
    if (appliedProfileFetchKey.current === key) return;
    appliedProfileFetchKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${apiBase}/publisher/profile/${publisherId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok || cancelled) return;

        const profile: PublisherProfileResponse = await response.json();

        if (cancelled) return;

        const state = useEditorStore.getState();
        const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;
        const activeHeaderSet = activeHeaderSetId ? state.document.headerSystem.headerSets[activeHeaderSetId] : null;
        const profileId = activeHeaderSet?.publicationProfileId;

        if (!profileId) return;

        const startYear = Number(profile.publication_start_year);
        const establishedText = Number.isFinite(startYear) && startYear > 0
          ? `Year-${new Date().getFullYear() - startYear + 1}`
          : undefined;
        const patch: Record<string, string> = {};
        if (profile.city) patch.city = profile.city;
        if (profile.cover_price) patch.price = String(profile.cover_price);
        if (establishedText) patch.establishedText = establishedText;
        const volumeNumber = Number(profile.last_volume_number);
        if (Number.isFinite(volumeNumber) && volumeNumber > 0) {
          patch.volumeLabel = String(volumeNumber);
        }

        if (Object.keys(patch).length > 0) {
          state.updatePublicationProfile(profileId, patch);
        }
        // Each publisher's own artwork uses its own accent colour for the
        // same date-block/issue-bar zones Cliff News's is white/red for —
        // sample their actual pixels there rather than assuming ours.
        if (profile.front_page_header_url) {
          const url = profile.front_page_header_url;
          const maskColors = await sampleImageColorsAt(url, getHeaderMaskSamplePoints("front"));
          if (!cancelled) {
            state.setHeaderBannerImage("front", url, maskColors ?? undefined);
          }
        }
        if (profile.remaining_page_header_url) {
          const url = profile.remaining_page_header_url;
          const maskColors = await sampleImageColorsAt(url, getHeaderMaskSamplePoints("inside"));
          if (!cancelled) {
            state.setHeaderBannerImage("inside", url, maskColors ?? undefined);
          }
        }
      } catch {
        // No publisher profile reachable — the default/current header keeps
        // rendering rather than the page breaking.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Youth UPDATE's own four masthead teaser slots (cutout photo + headline +
  // category label, editable daily via the portal). A separate fetch, gated
  // to this one publisher_id, rather than folding it into the profile fetch
  // above -- every other publisher's launch never makes this request at all.
  const appliedTeaserFetchKey = useRef<string | null>(null);
  useEffect(() => {
    const publisherId = searchParams.get("publisherId")?.trim() || "";
    const authToken = searchParams.get("authToken")?.trim() || "";
    const apiBase = searchParams.get("apiBase")?.trim() || "http://localhost:8080/api/v1";

    if (publisherId !== YOUTH_UPDATE_PUBLISHER_ID) return;

    const key = `${apiBase}|${publisherId}|${authToken}`;
    if (appliedTeaserFetchKey.current === key) return;
    appliedTeaserFetchKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        const loadApiSlots = async () => {
          try {
            return await fetchYouthUpdateMastheadApiTeasers();
          } catch {
            return null;
          }
        };

        let bySlot = new Map<number, { headline: string; category_label: string; image_url: string }>();
        if (authToken) {
          try {
            const response = await fetch(`${apiBase}/publisher/masthead-teasers/${publisherId}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (response.ok) {
              const body: { teasers?: Array<{ slot_index: number; headline: string; category_label: string; image_url: string }> } =
                await response.json();
              bySlot = new Map((body.teasers ?? []).map((t) => [t.slot_index, t]));
            }
          } catch {
            // The API-news fallback below is independent of the SaaS profile
            // endpoint, so a temporary portal/API miss should not leave the
            // Youth masthead stuck on the static placeholder PNGs.
          }
        }
        if (cancelled) return;

        const hasAnySavedTeaser = Array.from(bySlot.values()).some(
          (teaser) => teaser.headline.trim() || teaser.category_label.trim() || teaser.image_url.trim(),
        );
        const hasCompleteSavedTeasers = [1, 2, 3, 4].every((slotIndex) => {
          const saved = bySlot.get(slotIndex);
          return Boolean(saved?.headline.trim() && saved?.category_label.trim() && saved?.image_url.trim());
        });
        const apiSlots = hasCompleteSavedTeasers ? null : await loadApiSlots();
        if (cancelled) return;

        const slots = [1, 2, 3, 4].map((slotIndex): YouthUpdateTeaserSlot => {
          const saved = bySlot.get(slotIndex);
          const apiSlot = apiSlots?.[slotIndex - 1];
          return {
            imageUrl: saved?.image_url || apiSlot?.imageUrl || YOUTH_UPDATE_TEASER_IMAGE_URLS[slotIndex - 1],
            headline: saved?.headline?.trim() || apiSlot?.headline || YOUTH_UPDATE_TEASER_HEADLINES[slotIndex - 1],
            label: saved?.category_label?.trim() || apiSlot?.label || YOUTH_UPDATE_TEASER_LABELS[slotIndex - 1],
          };
        }) as [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot];

        if (hasAnySavedTeaser || apiSlots) {
          useYouthUpdateTeaserStore.getState().setTeasers(slots);
        }
      } catch {
        // Unreachable backend or no rows saved yet -- the static placeholder
        // copy keeps rendering rather than the masthead breaking.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Youth UPDATE's inside-page author badge: passport image + name +
  // designation. The portal can expose it either as a dedicated endpoint
  // or, later, in the publisher profile fields above; this fetch is gated to
  // the single Youth UPDATE publisher id.
  const appliedInsideAuthorFetchKey = useRef<string | null>(null);
  useEffect(() => {
    const publisherId = searchParams.get("publisherId")?.trim() || "";
    const authToken = searchParams.get("authToken")?.trim() || "";
    const apiBase = searchParams.get("apiBase")?.trim() || "http://localhost:8080/api/v1";

    if (publisherId !== YOUTH_UPDATE_PUBLISHER_ID || !authToken) return;

    const key = `${apiBase}|${publisherId}|${authToken}`;
    if (appliedInsideAuthorFetchKey.current === key) return;
    appliedInsideAuthorFetchKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        if (cancelled) return;
        await loadYouthUpdateInsideAuthorsFromPortal({ apiBase, authToken, publisherId });
      } catch {
        // No portal-side author row yet -- keep the hardcoded default visible.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
}
