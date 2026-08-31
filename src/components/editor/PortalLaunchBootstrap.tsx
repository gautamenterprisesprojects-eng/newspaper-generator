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
import { usePublisherEditorialAuthorStore } from "@/store/publisherEditorialAuthorStore";
import { fetchYouthUpdateMastheadApiTeasers } from "@/lib/youthUpdateMastheadApiTeasers";

type PortalPageSection = {
  page_number: number;
  section: string;
  header_type: string;
  notes?: string;
  category?: string;
  categories?: string[];
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
        categories: Array.isArray(item?.categories)
          ? item.categories.map((c: unknown) => String(c)).filter(Boolean)
          : undefined,
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
  editorial_author_name?: string;
  editorial_author_image_url?: string;
  editorial_authors?: Array<{ name?: string; image_url?: string; imageUrl?: string }>;
  theme_color?: string;
  editions?: Array<{ name?: string; front_header_url?: string; inside_header_url?: string }>;
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

    if (!publisherId || !authToken) {
      // No profile to fetch on this launch -- nothing will ever set
      // editorialAuthors, so mark it settled immediately rather than
      // leaving anything waiting on `hydrated` stuck forever.
      usePublisherEditorialAuthorStore.getState().setHydrated();
      return;
    }

    const key = `${apiBase}|${publisherId}|${authToken}`;
    if (appliedProfileFetchKey.current === key) return;
    appliedProfileFetchKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${apiBase}/publisher/profile/${publisherId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok || cancelled) {
          if (!cancelled) usePublisherEditorialAuthorStore.getState().setHydrated();
          return;
        }

        const profile: PublisherProfileResponse = await response.json();

        if (cancelled) return;

        const state = useEditorStore.getState();
        const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;
        const activeHeaderSet = activeHeaderSetId ? state.document.headerSystem.headerSets[activeHeaderSetId] : null;
        const profileId = activeHeaderSet?.publicationProfileId;
        const editorialAuthors = Array.isArray(profile.editorial_authors)
          ? profile.editorial_authors
              .map((author) => ({
                name: String(author?.name ?? "").trim(),
                imageUrl: String(author?.image_url ?? author?.imageUrl ?? "").trim(),
              }))
              .filter((author) => author.name || author.imageUrl)
          : [];
        const editorialAuthorName = String(profile.editorial_author_name ?? "").trim();
        const editorialAuthorImageUrl = String(profile.editorial_author_image_url ?? "").trim();
        if (editorialAuthors.length > 0) {
          usePublisherEditorialAuthorStore.getState().setAuthors(editorialAuthors);
        } else {
          usePublisherEditorialAuthorStore.getState().setDefaults(
            editorialAuthorName || editorialAuthorImageUrl
              ? { name: editorialAuthorName, imageUrl: editorialAuthorImageUrl }
              : null,
          );
        }

        if (!profileId) {
          // No header set to apply front/inside artwork onto -- nothing
          // else in this function will run, so this IS the fully-settled
          // point for this launch.
          usePublisherEditorialAuthorStore.getState().setHydrated();
          return;
        }

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

        // A publisher with multiple editions (e.g. Bhopal, Jabalpur) has its
        // own front/inside header per edition, set once on the Settings page
        // and picked here by the small editionIndex param the dashboard adds
        // to the launch URL. Publishers who never set up editions (or whose
        // edition has no header of its own) fall back to the legacy
        // single-header fields.
        const editionIndexRaw = Number(searchParams.get("editionIndex"));
        const editionIndex = Number.isFinite(editionIndexRaw) && editionIndexRaw >= 0 ? editionIndexRaw : 0;
        const selectedEdition = Array.isArray(profile.editions) ? profile.editions[editionIndex] : undefined;
        const frontHeaderUrl = selectedEdition?.front_header_url || profile.front_page_header_url;
        const insideHeaderUrl = selectedEdition?.inside_header_url || profile.remaining_page_header_url;

        // Each publisher's own artwork uses its own accent colour for the
        // same date-block/issue-bar zones Cliff News's is white/red for —
        // sample their actual pixels there rather than assuming ours.
        if (frontHeaderUrl) {
          const maskColors = await sampleImageColorsAt(frontHeaderUrl, getHeaderMaskSamplePoints("front"));
          if (!cancelled) {
            state.setHeaderBannerImage("front", frontHeaderUrl, maskColors ?? undefined);
          }
        }
        if (insideHeaderUrl) {
          const maskColors = await sampleImageColorsAt(insideHeaderUrl, getHeaderMaskSamplePoints("inside"));
          if (!cancelled) {
            state.setHeaderBannerImage("inside", insideHeaderUrl, maskColors ?? undefined);
          }
        }
        // One-time theme colour, seeded as the inside header's starting
        // accent colour -- fully editable afterward in HeaderManagerPanel,
        // same as the header images just above.
        if (profile.theme_color && !cancelled) {
          state.setHeaderAccentColor(profile.theme_color);
        }
        if (!cancelled) {
          // Only now -- after the publisher's own front/inside header
          // artwork has actually been applied, not merely requested -- is
          // this launch's profile bootstrap really finished. Batch mode
          // waits on this flag before generating anything (see its own doc
          // comment in EditorCanvas.tsx); it used to fire right after the
          // editorial-author fields above, well before the two
          // sampleImageColorsAt() awaits for front/inside headers resolved,
          // so an unattended run could render its first several inside
          // pages before setHeaderBannerImage("inside", ...) ever ran,
          // printing the wrong (default/stale) inside header artwork.
          usePublisherEditorialAuthorStore.getState().setHydrated();
        }
      } catch {
        // No publisher profile reachable — the default/current header keeps
        // rendering rather than the page breaking.
        if (!cancelled) usePublisherEditorialAuthorStore.getState().setHydrated();
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
