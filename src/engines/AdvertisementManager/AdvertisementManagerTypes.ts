import type {
  NewspaperAdvertisement,
  NewspaperAdvertisementId,
  NewspaperAdvertisementStatus,
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperPageId,
} from "@/types/document";

export type AdvertisementBookingInput = {
  id?: NewspaperAdvertisementId;
  bookingId?: string;
  client: string;
  agency?: string;
  brand?: string;
  campaign?: string;
  edition?: string;
  section?: string;
  pagePreference?: number | "any";
  width: number;
  height: number;
  columns: number;
  depth: number;
  colorMode?: NewspaperAdvertisement["colorMode"];
  premium?: boolean;
  priority?: NewspaperAdvertisement["priority"];
  publishDate?: string;
  expiryDate?: string;
  artworkAssetId?: string | null;
};

export type AdvertisementFilter = {
  query: string;
  status: NewspaperAdvertisementStatus | "all" | "pending";
  section: string | "all";
};

export type AdvertisementWarningType =
  | "missing-artwork"
  | "wrong-dimensions"
  | "low-dpi"
  | "expired-booking"
  | "wrong-page"
  | "duplicate-placement"
  | "unplaced-booking"
  | "too-small"
  | "oversized-artwork";

export type AdvertisementWarning = {
  adId: NewspaperAdvertisementId;
  type: AdvertisementWarningType;
  message: string;
};

export type AdvertisementPlacement = {
  adId: NewspaperAdvertisementId;
  frameId: NewspaperFrameId;
  pageId: NewspaperPageId;
  pageNumber: number;
};

export type PageAdvertisementOccupancy = {
  pageId: NewspaperPageId;
  pageNumber: number;
  editorialPercent: number;
  advertisementPercent: number;
  freePercent: number;
  reservedPercent: number;
  occupiedColumns: number;
  remainingColumns: number;
};

export type AdvertisementDashboard = {
  total: number;
  revenuePlaceholder: number;
  occupiedSpace: number;
  pending: number;
  booked: number;
  printed: number;
  cancelled: number;
};

export type AdvertisementManagerStatus = {
  total: number;
  reserved: number;
  placed: number;
  pending: number;
  expired: number;
  missingArtwork: number;
  unplaced: number;
};
