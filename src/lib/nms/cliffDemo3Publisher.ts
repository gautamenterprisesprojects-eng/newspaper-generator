/** PageMint username / NMS pagemint_user_id for Cliff News demo. */
export const CLIFFDEMO3_PAGEMINT_ID = "cliffdemo3";

/**
 * Settings-page category label for cliffdemo3 only. Kept out of
 * NEWSWIRE_CATEGORIES so other publishers never see or fetch it.
 */
export const CLIFFDEMO3_NMS_CATEGORY = "NMS Bundle";

/**
 * Every spelling a saved page plan may carry for the category above.
 *
 * The portal's Settings list (newspaper-front a5dbf8c) ships the short "NMS",
 * and that is the string it writes into page_section_config.categories, while
 * the label shown in the wizard here is the longer "NMS Bundle". Matching on
 * one spelling only means the other is dropped by the isNewswireCategory
 * filter and the page silently falls back to guessing a category from the
 * section name -- the page looks generated, just from the wrong feed.
 */
const CLIFFDEMO3_NMS_CATEGORY_SPELLINGS = [CLIFFDEMO3_NMS_CATEGORY, "NMS"] as const;

const CLIFFDEMO3_NEWSPAPER_NAME_CANDIDATES = ["THE CLIFF NEWS", "Cliff News", "द क्लिफ न्यूज़", "द क्लिफ़ न्यूज़"];

const normalizeIdentity = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\u093C/g, "")
    .replace(/[\s_-]+/g, "");

export const isCliffDemo3PublisherIdentity = (value: string) =>
  normalizeIdentity(value) === CLIFFDEMO3_PAGEMINT_ID;

export const isCliffDemo3NewspaperName = (value: string) => {
  const normalized = normalizeIdentity(value);
  return CLIFFDEMO3_NEWSPAPER_NAME_CANDIDATES.some((name) => normalizeIdentity(name) === normalized);
};

export const isCliffDemo3PublisherSession = (input: {
  publisherId?: string;
  newspaperName?: string;
  username?: string;
}) =>
  isCliffDemo3PublisherIdentity(input.publisherId ?? "") ||
  isCliffDemo3PublisherIdentity(input.username ?? "") ||
  isCliffDemo3NewspaperName(input.newspaperName ?? "");

export const isNmsBundleCategory = (value: string) => {
  const normalized = normalizeIdentity(value);
  if (!normalized) return false;
  return CLIFFDEMO3_NMS_CATEGORY_SPELLINGS.some(
    (spelling) => normalizeIdentity(spelling) === normalized,
  );
};

export const pagePlanRequestsNmsBundle = (
  plannedCategories: readonly string[] = [],
  plannedCategory = "",
) =>
  plannedCategories.some((category) => isNmsBundleCategory(category)) ||
  isNmsBundleCategory(plannedCategory);

/**
 * cliffdemo3 front pages always take the NMS bundle. Inside pages take it
 * only when Settings selected "NMS Bundle". Every other publisher stays on
 * the existing mix / newswire category path.
 */
export const shouldUseNmsBundleFeed = (input: {
  isCliffDemo3: boolean;
  isFrontPage: boolean;
  plannedCategories?: readonly string[];
  plannedCategory?: string;
}) => {
  if (!input.isCliffDemo3) return false;
  if (input.isFrontPage) return true;
  return pagePlanRequestsNmsBundle(input.plannedCategories, input.plannedCategory);
};

export const isCliffDemo3PortalSession = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return isCliffDemo3PublisherSession({
    publisherId: params.get("publisherId") ?? "",
    newspaperName: params.get("newspaperName") ?? "",
    username: params.get("username") ?? params.get("publisherUsername") ?? "",
  });
};
