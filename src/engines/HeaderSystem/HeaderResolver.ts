import type { NewspaperDocument, NewspaperPageObject } from "@/types/document";
import type {
  HeaderSet,
  HeaderTextSlot,
  ResolvedHeaderSlot,
  ResolvedPageHeader,
} from "@/types/header";
import { normalizeHeaderSystemState } from "./HeaderNormalizer";
import { resolveHeaderTokens } from "./HeaderTokenResolver";

const resolveSlot = (
  slot: HeaderTextSlot,
  context: Parameters<typeof resolveHeaderTokens>[1],
): ResolvedHeaderSlot => {
  const text = resolveHeaderTokens(slot.template, context);

  return {
    ...slot,
    text: slot.textTransform === "uppercase" ? text.toUpperCase() : text,
  };
};

const resolveHeaderSetForPage = (
  headerState: ReturnType<typeof normalizeHeaderSystemState>,
  page: NewspaperPageObject,
): HeaderSet | null => {
  const overrideId = headerState.sectionHeaderSetOverrides[page.sectionName ?? page.pageType];
  const headerSetId = overrideId ?? headerState.activeHeaderSetId;

  return headerSetId ? headerState.headerSets[headerSetId] ?? null : null;
};

/** Resolves the protected master header for a page without creating page-local header objects. */
export const resolvePageHeader = (
  document: NewspaperDocument,
  pageId: string,
): ResolvedPageHeader | null => {
  const pageIndex = document.pages.findIndex((candidate) => candidate.id === pageId);

  if (pageIndex < 0) {
    return null;
  }

  const page = document.pages[pageIndex];
  const headerState = normalizeHeaderSystemState(document.headerSystem, document.metadata, { enableDefaultHeader: false });
  const headerSet = resolveHeaderSetForPage(headerState, page);

  if (!headerSet) {
    return null;
  }

  const profile = headerState.publicationProfiles[headerSet.publicationProfileId];

  if (!profile || headerSet.hidden) {
    return null;
  }

  // page.pageNumber, not the array index — single-page mode holds only one
  // page in the whole document (array index always 0), but that page's own
  // pageNumber field is deliberately set to the real page the publisher
  // picked (see PortalLaunchBootstrap's mode==="single" branch). Every other
  // path (batch/full mode, addPage) already keeps pageNumber in sync with
  // array position, so this is a no-op change there.
  const pageNumber = page.pageNumber ?? pageIndex + 1;
  const sectionName = page.sectionName ?? page.pageType;
  const context = {
    profile,
    pageNumber,
    totalPages: document.pages.length,
    sectionName,
  };
  // A page carries the masthead when it is typed as the front page — not when
  // it merely happens to sit first. The editor opens on a single `city` page
  // that inside-page work is composed against; treating that as page one of an
  // edition would put a 6.1cm masthead over it. The layout wizard's Front Page
  // tab is what types a page as "front".
  const isFront = page.pageType === "front";
  const pageOverride = headerSet.perPageOverrides[page.id];
  const sectionOverride = headerSet.sectionOverrides[sectionName];
  const effectiveOverride = pageOverride ?? sectionOverride;

  if (isFront) {
    const front = {
      ...headerSet.front,
      ...effectiveOverride?.front,
    };
    // The masthead band is ~3x the inside folio strip. This used to reuse the
    // inside height, which is what made the front page and inside pages render
    // an identical thin header.
    const frontHeight = front.height;

    return {
      headerSetId: headerSet.id,
      profileId: profile.id,
      issueLabel: profile.issueLabel,
      pageId: page.id,
      pageNumber,
      sectionName,
      protected: true,
      reservedHeight: frontHeight,
      contentInsetTop: Math.max(page.masterPage.contentY * 72, frontHeight),
      header: {
        ...front,
        height: frontHeight,
        kind: "front",
        masthead: resolveSlot(front.masthead, context),
        eyebrowLeft: resolveSlot(front.eyebrowLeft, context),
        eyebrowCenter: resolveSlot(front.eyebrowCenter, context),
        eyebrowRight: resolveSlot(front.eyebrowRight, context),
        footerLine: resolveSlot(front.footerLine, context),
        skyline: resolveSlot(front.skyline, context),
        leftEar: resolveSlot(front.leftEar, context),
        rightEar: resolveSlot(front.rightEar, context),
      },
    };
  }

  const inside = {
    ...headerSet.inside,
    ...effectiveOverride?.inside,
  };

  const left = resolveSlot(inside.left, context);
  const center = resolveSlot(inside.center, context);
  const right = resolveSlot(inside.right, context);
  const shouldMirror = inside.mirrored && pageNumber % 2 === 0;

  return {
    headerSetId: headerSet.id,
    profileId: profile.id,
    issueLabel: profile.issueLabel,
    pageId: page.id,
    pageNumber,
    sectionName,
    protected: true,
    reservedHeight: inside.height,
    contentInsetTop: Math.max(page.masterPage.contentY * 72, inside.height),
    header: {
      ...inside,
      kind: "inside",
      left: shouldMirror ? right : left,
      center,
      right: shouldMirror ? left : right,
    },
  };
};

/** Resolves all active document page headers in page order. */
export const resolveDocumentHeaders = (document: NewspaperDocument): ResolvedPageHeader[] =>
  document.pages
    .map((page) => resolvePageHeader(document, page.id))
    .filter((header): header is ResolvedPageHeader => Boolean(header));

/** Returns page content bounds adjusted for the resolved protected header reservation. */
export const resolveHeaderReservedContentBounds = (
  document: NewspaperDocument,
  pageId: string,
): { x: number; y: number; width: number; height: number } | null => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return null;
  }

  const header = resolvePageHeader(document, pageId);
  const baseY = page.masterPage.contentY * 72;
  const y = Math.max(baseY, header?.contentInsetTop ?? baseY);
  const baseBottom = (page.masterPage.contentY + page.masterPage.contentHeight) * 72;

  return {
    x: page.masterPage.contentX * 72,
    y,
    width: page.masterPage.contentWidth * 72,
    height: Math.max(0, baseBottom - y),
  };
};
