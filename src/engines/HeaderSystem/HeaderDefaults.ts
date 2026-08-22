import type {
  FrontHeaderTemplate,
  HeaderSet,
  HeaderSystemState,
  HeaderTextSlot,
  InsideHeaderTemplate,
  PublicationProfile,
} from "@/types/header";
import {
  FRONT_HEADER_BANNER_SOURCE,
  FRONT_HEADER_HEIGHT_PT,
  INSIDE_HEADER_BANNER_SOURCE,
  INSIDE_HEADER_HEIGHT_PT,
} from "./HeaderGeometry";

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
export const HEADER_SYSTEM_SCHEMA_VERSION = 1;
export const HEADER_SET_SCHEMA_VERSION = 1;

const normalizePublicationLanguage = (language: unknown): PublicationProfile["language"] =>
  language === "hindi" || language === "english" || language === "bilingual"
    ? language
    : String(language ?? "").toLowerCase().startsWith("hi")
      ? "hindi"
      : "bilingual";

export const createHeaderTextSlot = (slot: Partial<HeaderTextSlot> = {}): HeaderTextSlot => ({
  template: "",
  fontFamily: "sans",
  fontSize: 9,
  fontWeight: "normal",
  align: "left",
  color: "#17130f",
  ...slot,
});

export const createDefaultPublicationProfile = (
  input: Partial<PublicationProfile> = {},
): PublicationProfile => ({
  id: input.id ?? "publication-default",
  publicationName: input.publicationName ?? "THE CLIFF NEWS",
  editionName: input.editionName ?? "National Edition",
  city: input.city ?? "New Delhi",
  price: input.price ?? "Rs. 5",
  date: input.date ?? todayIso(),
  language: normalizePublicationLanguage(input.language),
  tagline: input.tagline ?? "Independent daily journalism",
  taglineHindi: input.taglineHindi ?? "",
  establishedText: input.establishedText ?? "",
  logoAssetId: input.logoAssetId ?? null,
  monochromeLogoAssetId: input.monochromeLogoAssetId ?? null,
  website: input.website ?? "",
  email: input.email ?? "",
  registrationNumber: input.registrationNumber ?? "",
  volumeLabel: input.volumeLabel ?? "1",
  issueLabel: input.issueLabel ?? "",
  primaryColor: input.primaryColor ?? "#17130f",
  secondaryColor: input.secondaryColor ?? "#0f6f83",
  textColor: input.textColor ?? "#17130f",
  preferredHeadingFont: input.preferredHeadingFont ?? "",
  preferredBodyFont: input.preferredBodyFont ?? "",
});

export const createDefaultFrontHeader = (
  input: Partial<FrontHeaderTemplate> = {},
): FrontHeaderTemplate => ({
  layout: "classic-centered",
  height: FRONT_HEADER_HEIGHT_PT,
  padding: 8,
  headerImageUrl: FRONT_HEADER_BANNER_SOURCE,
  masthead: createHeaderTextSlot({
    template: "{{publicationName}}",
    fontFamily: "serif",
    fontSize: 28,
    fontWeight: "bold",
    align: "center",
  }),
  // Every field below this line, up to rightEar, is drawn over the banner's
  // own date/issue block on every issue, not baked into the artwork — see
  // HeaderSlotGeometry.ts (positions + the PSD layer each maps to) and
  // buildHeaderPrintModel/PageHeader.tsx (the two render paths that draw
  // them). This front-image-overlay rendering path only ever draws
  // eyebrowLeft/eyebrowRight/skyline/footerLine/leftEar/rightEar — masthead,
  // eyebrowCenter and componentVisibility below exist for the *other*,
  // build-from-scratch header mode and are inert here.
  eyebrowLeft: createHeaderTextSlot({
    template: "{{city}}",
    fontSize: 17,
    fontWeight: "bold",
    align: "left",
    textTransform: "uppercase",
  }),
  eyebrowCenter: createHeaderTextSlot({
    template: "{{editionName}}",
    align: "center",
    color: "#51483f",
  }),
  eyebrowRight: createHeaderTextSlot({
    template: "{{day}}",
    fontSize: 17,
    fontWeight: "bold",
    align: "left",
    color: "#3a332c",
    textTransform: "uppercase",
  }),
  // Repurposed as the date block's month/year line (PSD layer "month and
  // year ") for this layout specifically — its usual centered tagline role
  // only applies to the other, non-image header mode, which never renders
  // this field from here.
  footerLine: createHeaderTextSlot({
    template: "{{monthYear}}",
    fontSize: 18,
    fontWeight: "normal",
    align: "left",
    color: "#3a332c",
  }),
  // Repurposed as the date block's big day-of-month number (PSD layer
  // "date") — its usual role belongs to the other, non-image header mode.
  skyline: createHeaderTextSlot({
    template: "{{dayOfMonth}}",
    fontSize: 17,
    fontWeight: "bold",
    align: "center",
    color: "#3a332c",
  }),
  // Year and Volume are two separate boxes in the reference PSD (its
  // "publishing Year" and "Volume" layers), not one combined string — kept
  // as separate slots so each can sit exactly where the artwork puts it
  // instead of drifting apart or overlapping at different text lengths.
  leftEar: createHeaderTextSlot({
    template: "{{establishedText}}",
    fontSize: 9,
    fontWeight: "bold",
    align: "left",
    color: "#fffdf8",
  }),
  rightEar: createHeaderTextSlot({
    template: "Volume-{{volume}}",
    fontSize: 9,
    fontWeight: "bold",
    align: "left",
    color: "#fffdf8",
  }),
  ruleColor: "#17130f",
  componentVisibility: {
    skyline: false,
    leftEar: false,
    rightEar: false,
    logo: true,
    tagline: true,
    metadata: true,
    rules: true,
  },
  ...input,
});

export const createDefaultInsideHeader = (
  input: Partial<InsideHeaderTemplate> = {},
): InsideHeaderTemplate => ({
  layout: "classic-rule-folio",
  height: INSIDE_HEADER_HEIGHT_PT,
  padding: 6,
  headerImageUrl: INSIDE_HEADER_BANNER_SOURCE,
  left: createHeaderTextSlot({
    template: "{{section}}",
    fontWeight: "bold",
    align: "left",
  }),
  center: createHeaderTextSlot({
    template: "{{publicationName}}",
    fontFamily: "serif",
    fontWeight: "bold",
    align: "center",
  }),
  // Drawn over the banner's own folio strip every issue. City is a
  // publisher-set constant (from their profile, same {{city}} front uses) —
  // never re-derived per day — while day/date/month/year are freshly
  // computed every time; the live SVG template (inside-header-live.svg)
  // carries city+date as one text layer, so this slot's own text has to
  // already be the combined string, matching that layer's own
  // "Bhopal,Monday 10 August 2026" convention exactly (no space after the
  // comma).
  right: createHeaderTextSlot({
    template: "{{city}},{{day}} {{dayOfMonth}} {{monthYear}}",
    fontSize: 8,
    align: "right",
    color: "#51483f",
  }),
  mirrored: false,
  accentColor: "#0f6f83",
  ruleColor: "#17130f",
  componentVisibility: {
    publication: true,
    section: true,
    date: true,
    pageNumber: true,
    rule: true,
    website: false,
  },
  ...input,
});

export const createDefaultHeaderSet = (
  profile: PublicationProfile = createDefaultPublicationProfile(),
  input: Partial<HeaderSet> = {},
): HeaderSet => ({
  id: input.id ?? "header-set-default",
  schemaVersion: input.schemaVersion ?? HEADER_SET_SCHEMA_VERSION,
  name: input.name ?? "Default Newspaper Header",
  publicationProfileId: input.publicationProfileId ?? profile.id,
  front: createDefaultFrontHeader(input.front),
  inside: createDefaultInsideHeader(input.inside),
  sectionOverrides: input.sectionOverrides ?? {},
  perPageOverrides: input.perPageOverrides ?? {},
  protected: true,
  locked: input.locked ?? true,
  hidden: input.hidden ?? false,
  createdAt: input.createdAt ?? nowIso(),
  updatedAt: input.updatedAt ?? nowIso(),
});

export const createDefaultHeaderSystemState = (
  metadata: {
    newspaperName?: string;
    edition?: string;
    date?: string;
    language?: string;
  } = {},
): HeaderSystemState => {
  const profile = createDefaultPublicationProfile({
    publicationName: metadata.newspaperName,
    editionName: metadata.edition,
    date: metadata.date,
    language: normalizePublicationLanguage(metadata.language),
  });
  const headerSet = createDefaultHeaderSet(profile);

  return {
    schemaVersion: HEADER_SYSTEM_SCHEMA_VERSION,
    publicationProfiles: {
      [profile.id]: profile,
    },
    headerSets: {
      [headerSet.id]: headerSet,
    },
    activeHeaderSetId: headerSet.id,
    sectionHeaderSetOverrides: {},
    defaultHeaderSetId: headerSet.id,
  };
};
