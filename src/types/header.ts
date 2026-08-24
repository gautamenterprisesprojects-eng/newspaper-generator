import type { PageType } from "@/types/page";

export type HeaderLayoutKind =
  | "classic-centered"
  | "two-ears"
  | "skyline-masthead"
  | "bold-hindi-regional"
  | "modern-left-identity"
  | "heritage-institutional";

export type InsideHeaderLayoutKind =
  | "classic-rule-folio"
  | "centered-publication"
  | "section-color-band"
  | "mirrored-facing-pages"
  | "compact-hindi-folio"
  | "local-edition-folio";

export type HeaderToken =
  | "{{publicationName}}"
  | "{{editionName}}"
  | "{{date}}"
  | "{{day}}"
  | "{{pageNumber}}"
  | "{{section}}"
  | "{{city}}"
  | "{{price}}";

export type PublicationProfile = {
  id: string;
  publicationName: string;
  publicationNameHindi?: string;
  shortName?: string;
  editionName: string;
  city: string;
  price: string;
  date: string;
  language: "hindi" | "english" | "bilingual";
  tagline?: string;
  taglineHindi?: string;
  establishedText?: string;
  logoAssetId?: string | null;
  monochromeLogoAssetId?: string | null;
  website?: string;
  email?: string;
  registrationNumber?: string;
  volumeLabel?: string;
  issueLabel?: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  preferredHeadingFont?: string;
  preferredBodyFont?: string;
};

export type HeaderTextSlot = {
  template: string;
  fontFamily: "serif" | "sans" | "condensed";
  fontSize: number;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
  textTransform?: "uppercase";
};

export type FrontHeaderTemplate = {
  layout: HeaderLayoutKind;
  height: number;
  padding: number;
  headerImageUrl?: string;
  /** Overlay mask-band fill colours, sampled from headerImageUrl's own pixels at upload time (see sampleImageColorsAt) — one per HeaderSlotGeometry mask band, in order. Falls back to the built-in reference colours when absent. */
  maskColors?: string[];
  /** A publisher-picked replacement for the front masthead's own promo teaser photo (Akhand Doot's live SVG template only — see isAkhandDootHeaderUrl), set by clicking that teaser image in the editor. Takes priority over the auto-picked "first front-page story with both an image and a headline" default in both the live preview and PDF export (see frontHeaderTeaser in EditorCanvas.tsx and resolveFrontHeaderTeaser in HeaderPrintModel.ts). */
  teaserImageOverrideUrl?: string;
  masthead: HeaderTextSlot;
  eyebrowLeft: HeaderTextSlot;
  eyebrowCenter: HeaderTextSlot;
  eyebrowRight: HeaderTextSlot;
  footerLine: HeaderTextSlot;
  skyline: HeaderTextSlot;
  leftEar: HeaderTextSlot;
  rightEar: HeaderTextSlot;
  ruleColor: string;
  componentVisibility: {
    skyline: boolean;
    leftEar: boolean;
    rightEar: boolean;
    logo: boolean;
    tagline: boolean;
    metadata: boolean;
    rules: boolean;
  };
};

export type InsideHeaderTemplate = {
  layout: InsideHeaderLayoutKind;
  height: number;
  padding: number;
  headerImageUrl?: string;
  /** Overlay mask-band fill colours, sampled from headerImageUrl's own pixels at upload time (see sampleImageColorsAt) — one per HeaderSlotGeometry mask band, in order. Falls back to the built-in reference colours when absent. */
  maskColors?: string[];
  left: HeaderTextSlot;
  center: HeaderTextSlot;
  right: HeaderTextSlot;
  mirrored: boolean;
  accentColor: string;
  ruleColor: string;
  componentVisibility: {
    publication: boolean;
    section: boolean;
    date: boolean;
    pageNumber: boolean;
    rule: boolean;
    website: boolean;
  };
};

export type HeaderSectionOverride = {
  sectionName: string;
  front?: Partial<FrontHeaderTemplate>;
  inside?: Partial<InsideHeaderTemplate>;
};

export type HeaderSet = {
  id: string;
  schemaVersion: number;
  name: string;
  publicationProfileId: string;
  front: FrontHeaderTemplate;
  inside: InsideHeaderTemplate;
  sectionOverrides: Record<string, HeaderSectionOverride>;
  perPageOverrides: Record<string, HeaderSectionOverride>;
  protected: true;
  locked: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HeaderSystemState = {
  schemaVersion: number;
  publicationProfiles: Record<string, PublicationProfile>;
  headerSets: Record<string, HeaderSet>;
  activeHeaderSetId: string | null;
  sectionHeaderSetOverrides: Partial<Record<PageType | string, string>>;
  defaultHeaderSetId: string | null;
};

export type ResolvedHeaderSlot = HeaderTextSlot & {
  text: string;
};

export type ResolvedFrontHeader = Omit<
  FrontHeaderTemplate,
  "masthead" | "eyebrowLeft" | "eyebrowCenter" | "eyebrowRight" | "footerLine" | "skyline" | "leftEar" | "rightEar"
> & {
  kind: "front";
  masthead: ResolvedHeaderSlot;
  eyebrowLeft: ResolvedHeaderSlot;
  eyebrowCenter: ResolvedHeaderSlot;
  eyebrowRight: ResolvedHeaderSlot;
  footerLine: ResolvedHeaderSlot;
  skyline: ResolvedHeaderSlot;
  leftEar: ResolvedHeaderSlot;
  rightEar: ResolvedHeaderSlot;
};

export type ResolvedInsideHeader = Omit<InsideHeaderTemplate, "left" | "center" | "right"> & {
  kind: "inside";
  left: ResolvedHeaderSlot;
  center: ResolvedHeaderSlot;
  right: ResolvedHeaderSlot;
};

export type ResolvedPageHeader = {
  headerSetId: string;
  profileId: string;
  issueLabel?: string;
  pageId: string;
  pageNumber: number;
  sectionName: string;
  protected: true;
  reservedHeight: number;
  contentInsetTop: number;
  header: ResolvedFrontHeader | ResolvedInsideHeader;
};
