import type { PublicationProfile } from "@/types/header";

export type HeaderTokenContext = {
  profile: PublicationProfile;
  pageNumber: number;
  totalPages: number;
  sectionName: string;
};

const formatDay = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-US", { weekday: "long" });
};

/** "13 August-2026" — the masthead dateline's own convention (day-of-month, then Month-Year), not the raw ISO {{date}} value. */
const formatMastheadDate = (date: string, monthFormat: "long" | "short") => {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const month = parsed.toLocaleDateString("en-US", { month: monthFormat });

  return `${parsed.getDate()} ${month}-${parsed.getFullYear()}`;
};

/** Just the day-of-month number ("13") — the front masthead's date block draws this on its own, apart from the month/year line. */
const formatDayOfMonth = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? "" : String(parsed.getDate());
};

/** "August 2026" — month + year with no day-of-month and no dash, matching the masthead's own separate month/year line. */
const formatMonthYear = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.toLocaleDateString("en-US", { month: "long" })} ${parsed.getFullYear()}`;
};

/** Resolves supported header tokens without evaluating arbitrary expressions. */
export const resolveHeaderTokens = (
  template: string,
  context: HeaderTokenContext,
): string => {
  const values: Record<string, string> = {
    publicationName: context.profile.publicationName,
    publicationNameHindi: context.profile.publicationNameHindi ?? context.profile.publicationName,
    shortName: context.profile.shortName ?? context.profile.publicationName,
    editionName: context.profile.editionName,
    edition: context.profile.editionName,
    date: context.profile.date,
    day: formatDay(context.profile.date),
    mastheadDate: formatMastheadDate(context.profile.date, "long"),
    mastheadDateShort: formatMastheadDate(context.profile.date, "short"),
    dayOfMonth: formatDayOfMonth(context.profile.date),
    monthYear: formatMonthYear(context.profile.date),
    pageNumber: String(context.pageNumber),
    totalPages: String(context.totalPages),
    section: context.sectionName,
    city: context.profile.city,
    price: context.profile.price,
    tagline: context.profile.tagline ?? "",
    taglineHindi: context.profile.taglineHindi ?? "",
    establishedText: context.profile.establishedText ?? "",
    volume: context.profile.volumeLabel ?? "",
    issue: context.profile.issueLabel ?? "",
    website: context.profile.website ?? "",
    registrationNumber: context.profile.registrationNumber ?? "",
  };

  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_match, token: string) => values[token] ?? "");
};
