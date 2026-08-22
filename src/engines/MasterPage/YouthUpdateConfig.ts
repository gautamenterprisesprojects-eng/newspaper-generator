/**
 * Everything that scopes the Youth UPDATE custom front page to exactly one
 * publisher, in one place — every gate in the codebase (the wizard's design
 * picker, the batch auto-rotation, the masthead's own draw functions) reads
 * from here rather than repeating this publisher_id or template id
 * separately, so there is exactly one place to update if either ever
 * changes.
 */

export const YOUTH_UPDATE_PUBLISHER_ID = "85a50d12-8aa3-4f88-93aa-8153443c1c98";

export const YOUTH_UPDATE_FRONT_TEMPLATE_ID = "CliffFrontYouthUpdate1A" as const;

/**
 * Every front page this publisher may pick. All four share one masthead, one
 * editorial rail (story 1, row 1, column 1) and one SHORT NEWS rail (story 3,
 * row 2, column 1) — only the make-up of columns 2-6 differs between them, so
 * each id below must go through this list rather than being compared against
 * YOUTH_UPDATE_FRONT_TEMPLATE_ID alone. A gate that still compares to the
 * single 1A id would render the other three with no masthead, no rail and the
 * wrong reserved header depth.
 */
export const YOUTH_UPDATE_FRONT_TEMPLATE_IDS = [
  YOUTH_UPDATE_FRONT_TEMPLATE_ID,
  "CliffFrontYouthUpdate2A",
  "CliffFrontYouthUpdate3A",
  "CliffFrontYouthUpdate4A",
] as const;

export type YouthUpdateFrontTemplateId = (typeof YOUTH_UPDATE_FRONT_TEMPLATE_IDS)[number];

export const isYouthUpdateFrontTemplateId = (templateId?: string | null): templateId is YouthUpdateFrontTemplateId =>
  Boolean(templateId && (YOUTH_UPDATE_FRONT_TEMPLATE_IDS as readonly string[]).includes(templateId));

export const YOUTH_UPDATE_INSIDE_TEMPLATE_ID = "CliffInsideYouthUpdate1A" as const;

export const YOUTH_UPDATE_INSIDE_TEMPLATE_IDS = [
  YOUTH_UPDATE_INSIDE_TEMPLATE_ID,
  "CliffInsideYouthUpdate2A",
  "CliffInsideYouthUpdate3A",
  "CliffInsideYouthUpdate4A",
  "CliffInsideYouthUpdate5A",
  "CliffInsideYouthUpdate6A",
  "CliffInsideYouthUpdate7A",
  "CliffInsideYouthUpdate8A",
  "CliffInsideYouthUpdate9A",
  "CliffInsideYouthUpdate10A",
  "CliffInsideYouthUpdate11A",
] as const;

export const YOUTH_UPDATE_HEADER_ONLY_INSIDE_TEMPLATE_IDS = [
  "CliffInsideYouthUpdate8A",
  "CliffInsideYouthUpdate9A",
  "CliffInsideYouthUpdate10A",
  "CliffInsideYouthUpdate11A",
] as const;

export type YouthUpdateInsideTemplateId = (typeof YOUTH_UPDATE_INSIDE_TEMPLATE_IDS)[number];

export const isYouthUpdateInsideTemplateId = (templateId?: string | null): templateId is YouthUpdateInsideTemplateId =>
  Boolean(templateId && (YOUTH_UPDATE_INSIDE_TEMPLATE_IDS as readonly string[]).includes(templateId));

export const isYouthUpdateHeaderOnlyInsideTemplateId = (templateId?: string | null) =>
  Boolean(templateId && (YOUTH_UPDATE_HEADER_ONLY_INSIDE_TEMPLATE_IDS as readonly string[]).includes(templateId));

/**
 * True only when this browser session was launched from the SaaS portal
 * with Youth UPDATE's own publisher_id in the URL. Reads window.location
 * directly (not React-reactive) -- this publisher_id never changes over a
 * session's lifetime, matching the same non-memoized read every other
 * Youth UPDATE gate in this codebase already uses (see
 * EditorCanvas.tsx's getPortalLaunchParam calls).
 */
export const isYouthUpdatePortalSession = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("publisherId") === YOUTH_UPDATE_PUBLISHER_ID;
};

/** Fixed press registration number — this publisher's own, not derived from anything dynamic. */
export const YOUTH_UPDATE_REGISTRATION_NUMBER = "MPBIL/2017/74424";

/**
 * Fallback copy for the four front-page teaser slots, used only until the
 * publisher's own daily content loads (see youthUpdateTeaserStore.ts, fed
 * by the portal's masthead-teasers endpoint) or if that fetch fails.
 * Deliberately generic rather than the reference mockup's own example
 * headlines (which would otherwise print the same fake celebrity-gossip
 * teaser every single day if the publisher never gets around to editing
 * them).
 */
export const YOUTH_UPDATE_TEASER_HEADLINES: [string, string, string, string] = [
  "आज की प्रमुख खबर यहां छपेगी",
  "मनोरंजन जगत की ताज़ा खबर",
  "खेल जगत की बड़ी खबर",
  "अंतरराष्ट्रीय खबर यहां छपेगी",
];

export const YOUTH_UPDATE_TEASER_LABELS: [string, string, string, string] = [
  "FOOD POST-P7",
  "YOUTH POST-P4",
  "SPORTS POST-P7",
  "INTERNATIONAL-P8",
];

export const YOUTH_UPDATE_TEASER_IMAGE_URLS: [string, string, string, string] = [
  "/youth-update/teaser-entertainment.png",
  "/youth-update/teaser-youth.png",
  "/youth-update/teaser-sports.png",
  "/youth-update/teaser-international.png",
];

export const YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS = {
  imageUrl: "/youth-update/inside-author-default.png",
  name: "AMIT KUMAR MISHRA",
  designation: "EDITOR IN CHIEF",
} as const;

export const YOUTH_UPDATE_INSIDE_AUTHOR_SLOT_DEFAULTS = [
  YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS,
  {
    imageUrl: "/youth-update/inside-author-default.png",
    name: "VIKAS SONI",
    designation: "RESIDENT EDITOR",
  },
  {
    imageUrl: "/youth-update/inside-author-default.png",
    name: "ANUPAM SINGH",
    designation: "RESIDENT EDITOR",
  },
] as const;

/**
 * The publisher's own editor photo + "EDITORIAL" banner -- a fixed graphic
 * hardcoded into story 1's box (the top-left rail) on their front page,
 * never composed from article content. Served from /public, so this is a
 * root-relative URL, not an import.
 */
export const YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL = "/youth-update/editorial-rail.jpg";

/**
 * "SHORT NEWS" section banner, forced as story 3's (the row-2 rail's) own
 * photo during import -- unlike the editorial rail, this box keeps its real
 * composed headline/byline/body underneath; only the photo itself is fixed,
 * so the existing article composer reserves space for it and flows the rest
 * of the box below it exactly as it does for any other photo story (see
 * importNewswireStories's resolvedImageEnabled/effectiveImageUrls override
 * in editorStore.ts).
 */
export const YOUTH_UPDATE_SHORT_NEWS_IMAGE_URL = "/youth-update/short-news.jpg";
