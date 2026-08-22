import type {
  NewspaperAdvertisement,
  NewspaperAdvertisementId,
  NewspaperAdvertisementStatus,
  NewspaperDocument,
  NewspaperFrameObject,
  NewspaperPageObject,
} from "@/types/document";
import type {
  AdvertisementBookingInput,
  AdvertisementDashboard,
  AdvertisementFilter,
  AdvertisementManagerStatus,
  AdvertisementPlacement,
  AdvertisementWarning,
  PageAdvertisementOccupancy,
} from "./AdvertisementManagerTypes";

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getFrameAdId = (frame: NewspaperFrameObject) =>
  (frame.metadata.advertisementId as NewspaperAdvertisementId | undefined) ?? null;

const isPendingStatus = (status: NewspaperAdvertisementStatus) =>
  status === "booked" || status === "reserved" || status === "artwork-received" || status === "approved";

export const createAdvertisementBooking = (input: AdvertisementBookingInput): NewspaperAdvertisement => {
  const id = input.id ?? createId("ad");
  const status: NewspaperAdvertisementStatus = input.artworkAssetId ? "artwork-received" : "booked";

  return {
    id,
    bookingId: input.bookingId ?? `BK-${Date.now().toString(36).toUpperCase()}`,
    client: input.client,
    agency: input.agency ?? "",
    brand: input.brand ?? "",
    campaign: input.campaign ?? "",
    edition: input.edition ?? "National Edition",
    section: input.section ?? "City",
    pagePreference: input.pagePreference ?? "any",
    width: input.width,
    height: input.height,
    columns: input.columns,
    depth: input.depth,
    colorMode: input.colorMode ?? "cmyk",
    premium: Boolean(input.premium),
    priority: input.priority ?? "normal",
    publishDate: input.publishDate ?? today(),
    expiryDate: input.expiryDate,
    artworkAssetId: input.artworkAssetId ?? null,
    status,
    approved: false,
    reserved: false,
    placed: false,
    cancelled: false,
    expired: false,
    linkedFrameId: null,
    revenue: 0,
    metadata: {
      createdAt: now(),
      updatedAt: now(),
    },
  };
};

export const normalizeAdvertisements = (document: NewspaperDocument): NewspaperDocument => ({
  ...document,
  advertisements: document.advertisements ?? {},
});

export const addAdvertisement = (
  document: NewspaperDocument,
  input: AdvertisementBookingInput,
): NewspaperDocument => {
  const advertisement = createAdvertisementBooking(input);

  return {
    ...document,
    advertisements: {
      ...(document.advertisements ?? {}),
      [advertisement.id]: advertisement,
    },
  };
};

export const updateAdvertisementStatus = (
  document: NewspaperDocument,
  adId: NewspaperAdvertisementId,
  status: NewspaperAdvertisementStatus,
): NewspaperDocument => {
  const advertisement = document.advertisements?.[adId];

  if (!advertisement) {
    return document;
  }

  return {
    ...document,
    advertisements: {
      ...document.advertisements,
      [adId]: {
        ...advertisement,
        status,
        approved: status === "approved" || status === "placed" || status === "printed" || status === "archived",
        reserved: status === "reserved" || advertisement.reserved,
        placed: status === "placed" || status === "printed" || status === "archived",
        cancelled: status === "cancelled",
        expired: status === "expired",
        metadata: {
          ...advertisement.metadata,
          updatedAt: now(),
        },
      },
    },
  };
};

export const replaceAdvertisementArtwork = (
  document: NewspaperDocument,
  adId: NewspaperAdvertisementId,
  artworkAssetId: string | null,
): NewspaperDocument => {
  const advertisement = document.advertisements?.[adId];

  if (!advertisement) {
    return document;
  }

  return {
    ...document,
    advertisements: {
      ...document.advertisements,
      [adId]: {
        ...advertisement,
        artworkAssetId,
        status: artworkAssetId ? "artwork-received" : advertisement.status,
        metadata: {
          ...advertisement.metadata,
          updatedAt: now(),
        },
      },
    },
  };
};

export const createAdvertisementFrame = ({
  document,
  pageId,
  bounds,
  adId,
}: {
  document: NewspaperDocument;
  pageId: string;
  bounds: NewspaperFrameObject["bounds"];
  adId?: NewspaperAdvertisementId | null;
}): NewspaperDocument => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return document;
  }

  const frameId = createId("ad-frame");
  const frame: NewspaperFrameObject = {
    id: frameId,
    pageId,
    frameType: "advertisement",
    bounds,
    rotation: 0,
    zIndex: page.frameIds.length,
    locked: false,
    hidden: false,
    selected: false,
    geometry: {},
    style: {},
    containerStyle: {},
    frameStyle: {
      color: "#ca8a04",
    },
    baselineSettings: {
      enabled: false,
      start: 0,
      increment: 12,
    },
    snapSettings: {
      snapToGrid: true,
      snapToGuides: true,
      snapToBaseline: false,
    },
    metadata: {
      name: "Advertisement Frame",
      advertisementId: adId ?? null,
      createdAt: now(),
      updatedAt: now(),
    },
  };

  const pages = document.pages.map((candidate) =>
    candidate.id === pageId
      ? {
          ...candidate,
          frameIds: [...candidate.frameIds, frameId],
          advertisements: [...candidate.advertisements, adId].filter(
            (candidateAdId): candidateAdId is NewspaperAdvertisementId => Boolean(candidateAdId),
          ),
          updatedAt: now(),
        }
      : candidate,
  );

  return {
    ...document,
    frames: {
      ...document.frames,
      [frameId]: frame,
    },
    pages,
  };
};

export const placeAdvertisementInFrame = (
  document: NewspaperDocument,
  adId: NewspaperAdvertisementId,
  frameId: string,
): NewspaperDocument => {
  const advertisement = document.advertisements?.[adId];
  const frame = document.frames[frameId];

  if (!advertisement || !frame || frame.frameType !== "advertisement") {
    return document;
  }

  const nextAdvertisement: NewspaperAdvertisement = {
    ...advertisement,
    linkedFrameId: frameId,
    placed: true,
    reserved: true,
    status: "placed",
    metadata: {
      ...advertisement.metadata,
      updatedAt: now(),
    },
  };

  return {
    ...document,
    frames: {
      ...document.frames,
      [frameId]: {
        ...frame,
        metadata: {
          ...frame.metadata,
          advertisementId: adId,
          artworkAssetId: advertisement.artworkAssetId,
          updatedAt: now(),
        },
      },
    },
    advertisements: {
      ...document.advertisements,
      [adId]: nextAdvertisement,
    },
    pages: document.pages.map((page) =>
      page.id === frame.pageId
        ? {
            ...page,
            advertisements: [...new Set([...page.advertisements, adId])],
            updatedAt: now(),
          }
        : page,
    ),
  };
};

const frameMatchesAd = (frame: NewspaperFrameObject, advertisement: NewspaperAdvertisement) =>
  frame.frameType === "advertisement" &&
  frame.bounds.width >= advertisement.width * 0.95 &&
  frame.bounds.height >= advertisement.height * 0.95 &&
  !getFrameAdId(frame);

export const autoPlaceAdvertisements = (document: NewspaperDocument): NewspaperDocument => {
  let nextDocument = document;

  Object.values(document.advertisements ?? {})
    .filter((advertisement) => advertisement.status === "reserved" || advertisement.reserved)
    .forEach((advertisement) => {
      const matchingFrame = Object.values(nextDocument.frames).find((frame) => {
        const page = nextDocument.pages.find((candidate) => candidate.id === frame.pageId);
        const pageMatches =
          advertisement.pagePreference === "any" ||
          !advertisement.pagePreference ||
          page?.pageNumber === advertisement.pagePreference;

        return pageMatches && frameMatchesAd(frame, advertisement);
      });

      if (matchingFrame) {
        nextDocument = placeAdvertisementInFrame(nextDocument, advertisement.id, matchingFrame.id);
      }
    });

  return nextDocument;
};

export const getAdvertisementPlacements = (document: NewspaperDocument): AdvertisementPlacement[] =>
  Object.values(document.frames)
    .filter((frame) => frame.frameType === "advertisement" && getFrameAdId(frame))
    .flatMap((frame) => {
      const page = document.pages.find((candidate) => candidate.id === frame.pageId);
      const adId = getFrameAdId(frame);

      if (!page || !adId) {
        return [];
      }

      return [{
        adId,
        frameId: frame.id,
        pageId: page.id,
        pageNumber: page.pageNumber,
      }];
    });

export const getAdvertisementWarnings = (document: NewspaperDocument): AdvertisementWarning[] => {
  const placements = getAdvertisementPlacements(document);

  return Object.values(document.advertisements ?? {}).flatMap((advertisement) => {
    const warnings: AdvertisementWarning[] = [];
    const asset = advertisement.artworkAssetId ? document.assets[advertisement.artworkAssetId] : null;
    const placementsForAd = placements.filter((placement) => placement.adId === advertisement.id);

    if (!advertisement.artworkAssetId || !asset) {
      warnings.push({ adId: advertisement.id, type: "missing-artwork", message: "Advertisement artwork is missing." });
    }

    if (asset?.dpi && asset.dpi < 200) {
      warnings.push({ adId: advertisement.id, type: "low-dpi", message: "Advertisement artwork is below 200 DPI." });
    }

    if (asset?.width && asset.width < advertisement.width) {
      warnings.push({ adId: advertisement.id, type: "too-small", message: "Advertisement artwork is smaller than booked size." });
    }

    if (advertisement.expiryDate && advertisement.expiryDate < today()) {
      warnings.push({ adId: advertisement.id, type: "expired-booking", message: "Advertisement booking has expired." });
    }

    if (placementsForAd.length === 0 && !advertisement.cancelled && advertisement.status !== "archived") {
      warnings.push({ adId: advertisement.id, type: "unplaced-booking", message: "Booked advertisement is not placed." });
    }

    if (placementsForAd.length > 1) {
      warnings.push({ adId: advertisement.id, type: "duplicate-placement", message: "Advertisement is placed more than once." });
    }

    const wrongPage = placementsForAd.some((placement) =>
      advertisement.pagePreference !== "any" &&
      advertisement.pagePreference !== undefined &&
      placement.pageNumber !== advertisement.pagePreference,
    );

    if (wrongPage) {
      warnings.push({ adId: advertisement.id, type: "wrong-page", message: "Advertisement is placed on the wrong page." });
    }

    return warnings;
  });
};

export const filterAdvertisements = (
  document: NewspaperDocument,
  filter: AdvertisementFilter,
): NewspaperAdvertisement[] => {
  const query = filter.query.trim().toLowerCase();

  return Object.values(document.advertisements ?? {}).filter((advertisement) => {
    if (filter.status === "pending" && !isPendingStatus(advertisement.status)) {
      return false;
    }
    if (filter.status !== "all" && filter.status !== "pending" && advertisement.status !== filter.status) {
      return false;
    }
    if (filter.section !== "all" && advertisement.section !== filter.section) {
      return false;
    }
    if (!query) {
      return true;
    }

    return [
      advertisement.bookingId,
      advertisement.client,
      advertisement.agency,
      advertisement.brand,
      advertisement.campaign,
      advertisement.section,
      advertisement.status,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query));
  });
};

const getPageArea = (page: NewspaperPageObject) => {
  const settings = page.settings;

  return (settings?.width ?? page.masterPage.width) * 72 * ((settings?.height ?? page.masterPage.height) * 72);
};

export const getPageAdvertisementOccupancy = (
  document: NewspaperDocument,
  pageId: string,
): PageAdvertisementOccupancy | null => {
  const page = document.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    return null;
  }

  const pageArea = Math.max(1, getPageArea(page));
  const frames = page.frameIds.map((frameId) => document.frames[frameId]).filter(Boolean);
  const adFrames = frames.filter((frame) => frame.frameType === "advertisement");
  const adArea = adFrames.reduce((sum, frame) => sum + frame.bounds.width * frame.bounds.height, 0);
  const reservedArea = adFrames
    .filter((frame) => getFrameAdId(frame))
    .reduce((sum, frame) => sum + frame.bounds.width * frame.bounds.height, 0);
  const editorialArea = frames
    .filter((frame) => frame.frameType !== "advertisement")
    .reduce((sum, frame) => sum + frame.bounds.width * frame.bounds.height, 0);
  const occupiedColumns = adFrames.reduce((sum, frame) => sum + Math.max(1, Math.round(frame.bounds.width / 120)), 0);
  const columns = page.grid.columns;

  return {
    pageId: page.id,
    pageNumber: page.pageNumber,
    editorialPercent: Math.min(100, (editorialArea / pageArea) * 100),
    advertisementPercent: Math.min(100, (adArea / pageArea) * 100),
    freePercent: Math.max(0, 100 - ((editorialArea + adArea) / pageArea) * 100),
    reservedPercent: Math.min(100, (reservedArea / pageArea) * 100),
    occupiedColumns: Math.min(columns, occupiedColumns),
    remainingColumns: Math.max(0, columns - occupiedColumns),
  };
};

export const getAdvertisementDashboard = (document: NewspaperDocument): AdvertisementDashboard => {
  const advertisements = Object.values(document.advertisements ?? {});
  const occupancy = document.pages
    .map((page) => getPageAdvertisementOccupancy(document, page.id))
    .filter((item): item is PageAdvertisementOccupancy => Boolean(item));

  return {
    total: advertisements.length,
    revenuePlaceholder: advertisements.reduce((sum, advertisement) => sum + (advertisement.revenue ?? 0), 0),
    occupiedSpace: occupancy.reduce((sum, page) => sum + page.advertisementPercent, 0),
    pending: advertisements.filter((advertisement) => isPendingStatus(advertisement.status)).length,
    booked: advertisements.filter((advertisement) => advertisement.status === "booked").length,
    printed: advertisements.filter((advertisement) => advertisement.status === "printed").length,
    cancelled: advertisements.filter((advertisement) => advertisement.status === "cancelled").length,
  };
};

export const getAdvertisementManagerStatus = (document: NewspaperDocument): AdvertisementManagerStatus => {
  const advertisements = Object.values(document.advertisements ?? {});
  const warnings = getAdvertisementWarnings(document);

  return {
    total: advertisements.length,
    reserved: advertisements.filter((advertisement) => advertisement.reserved || advertisement.status === "reserved").length,
    placed: advertisements.filter((advertisement) => advertisement.placed || advertisement.status === "placed").length,
    pending: advertisements.filter((advertisement) => isPendingStatus(advertisement.status)).length,
    expired: advertisements.filter((advertisement) => advertisement.expired || advertisement.status === "expired").length,
    missingArtwork: warnings.filter((warning) => warning.type === "missing-artwork").length,
    unplaced: warnings.filter((warning) => warning.type === "unplaced-booking").length,
  };
};
