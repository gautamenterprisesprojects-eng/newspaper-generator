/**
 * HeaderGeometry
 *
 * Single source of truth for the two header bands an Indian daily uses:
 *
 *   front  – the masthead block on page one. On the reference edition
 *            (01 Aug 2026, The Cliff News) it runs from the trim edge down to
 *            just above the "सार-समाचार" rail: ~11.5% of a 21in page, i.e.
 *            2.4in ≈ 6.1cm. Artwork: `/front-header-live.svg` — a live SVG
 *            template (see HeaderSvgTemplate.ts) rather than a flat photo:
 *            same masthead art as the old `/header front.jpg`, but its day/
 *            date/month/year/volume/city text are real, substitutable
 *            elements instead of flattened pixels, so PageHeader.tsx and
 *            HeaderPrintModel.ts skip the mask-and-redraw overlay for it
 *            entirely and just swap the six values before the image loads.
 *   inside  – the thin folio strip on every later page: 0.75in ≈ 1.9cm, which
 *            is `DEFAULT_PAGE_MASTER.headerHeight` and what inside pages have
 *            always rendered. Artwork: `/inside-header-live.svg` — same live-
 *            template treatment as front: category/section, city+date (city
 *            fixed from the publisher's profile, date live), and page number
 *            are real substitutable text, not flattened pixels.
 *
 * Both banners are drawn edge-to-edge across the full page width and stretched
 * to the band height, the way PageHeader has always drawn the inside strip.
 */

import { DEFAULT_PAGE_MASTER, type PageType } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

export type HeaderKind = "front" | "inside";

/** Masthead band on page one, in inches (≈ 6.1cm). */
export const FRONT_HEADER_HEIGHT_IN = 2.4;

/** Folio band on inside pages, in inches (≈ 1.9cm) — unchanged legacy value. */
export const INSIDE_HEADER_HEIGHT_IN = DEFAULT_PAGE_MASTER.headerHeight;

export const FRONT_HEADER_HEIGHT_PT = FRONT_HEADER_HEIGHT_IN * POINTS_PER_INCH;
export const INSIDE_HEADER_HEIGHT_PT = INSIDE_HEADER_HEIGHT_IN * POINTS_PER_INCH;

export const FRONT_HEADER_BANNER_SOURCE = "/front-header-live.svg";
export const INSIDE_HEADER_BANNER_SOURCE = "/inside-header-live.svg";

/** Reserved band height in points for the given header kind. */
export const getHeaderBandHeight = (kind: HeaderKind) =>
  kind === "front" ? FRONT_HEADER_HEIGHT_PT : INSIDE_HEADER_HEIGHT_PT;

/** Banner artwork for the given header kind. */
export const getHeaderBannerSource = (kind: HeaderKind) =>
  kind === "front" ? FRONT_HEADER_BANNER_SOURCE : INSIDE_HEADER_BANNER_SOURCE;

/**
 * A page carries the masthead only when it is explicitly typed as the front
 * page. Deliberately NOT "page one of the document": the editor opens on a
 * single `city` page that inside-page work is composed against, and that page
 * must keep the thin folio strip. The Front Page tab of the layout wizard is
 * what flips `pageType` to "front".
 */
export const resolveHeaderKind = (pageType?: PageType | string | null): HeaderKind =>
  pageType === "front" ? "front" : "inside";
