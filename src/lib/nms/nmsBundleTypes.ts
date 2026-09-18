export type NmsCallbackConfig = {
  url?: unknown;
  method?: unknown;
  targetUserId?: unknown;
  pagemintTargetId?: unknown;
  fileField?: unknown;
  targetField?: unknown;
  authHeader?: unknown;
};

export type NmsBundleImage = {
  id?: unknown;
  order?: unknown;
  sortOrder?: unknown;
  isCover?: unknown;
  url?: unknown;
  path?: unknown;
};

export type NmsLocalizedArticleFields = {
  secondary_headline?: unknown;
  subheadings?: unknown;
  image_caption?: unknown;
  image_url?: unknown;
};

export type NmsBundleArticle = {
  newsId?: unknown;
  language?: unknown;
  headline?: unknown;
  originalHeadline?: unknown;
  body?: unknown;
  originalBody?: unknown;
  reporter?: {
    id?: unknown;
    name?: unknown;
    nameHi?: unknown;
    nameEn?: unknown;
    designation?: unknown;
    printDesignation?: unknown;
    printPlaceName?: unknown;
    place?: unknown;
    photoUrl?: unknown;
    avatarUrl?: unknown;
  };
  reporterPlace?: unknown;
  reporterPhotoUrl?: unknown;
  byline?: {
    photoUrl?: unknown;
    name?: unknown;
    designation?: unknown;
    place?: unknown;
    text?: unknown;
  };
  place?: unknown;
  city?: unknown;
  city_name?: unknown;
  category?: unknown;
  kicker?: unknown;
  subheadline?: unknown;
  secondary_headline?: unknown;
  subheadings?: unknown;
  caption?: unknown;
  imageCaption?: unknown;
  image_caption?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  image_link?: unknown;
  tags?: unknown;
  images?: NmsBundleImage[];
  coverImage?: NmsBundleImage | null;
  media?: {
    image_url?: unknown;
    image_link?: unknown;
  };
  websiteLinks?: unknown;
  ui_hindi?: NmsLocalizedArticleFields;
  ui_english?: NmsLocalizedArticleFields;
  article?: NmsLocalizedArticleFields;
  createdAt?: unknown;
  processedAt?: unknown;
  forwardedAt?: unknown;
};

export type NmsTargetUser = {
  id?: unknown;
  pagemintId?: unknown;
  externalId?: unknown;
  role?: unknown;
  nameHi?: unknown;
  nameEn?: unknown;
  fullName?: unknown;
  post?: unknown;
  district?: unknown;
  place?: unknown;
  avatarUrl?: unknown;
};

export type NmsBundlePayload = {
  source?: unknown;
  sentAt?: unknown;
  job_id?: unknown;
  bundle_id?: unknown;
  edition_id?: unknown;
  target_user_id?: unknown;
  pagemint_user_id?: unknown;
  pagemint_target_id?: unknown;
  targetUser?: NmsTargetUser;
  callback?: NmsCallbackConfig;
  pdfCallback?: NmsCallbackConfig;
  count?: unknown;
  articles?: NmsBundleArticle[];
  /** cliffdemo3 only — full manual PageMint recipe from NMS */
  pageMintRecipe?: unknown;
  /** cliffdemo3 only — exact Manual-run palette/options for NMS parity */
  cliffdemo3ManualPalette?: unknown;
  /** @deprecated alias of cliffdemo3ManualPalette */
  manualBatchPalette?: unknown;
  /** cliffdemo3 only — portal publication profile for masthead city/volume */
  portalPublicationProfile?: {
    city?: string;
    cover_price?: string | number;
    publication_start_year?: number | string | null;
    last_volume_number?: number | string | null;
    front_page_header_url?: string;
    remaining_page_header_url?: string;
    newspaper_name?: string;
  };
  layout?: unknown;
  frontPageLayout?: unknown;
  meta?: unknown;
  editionPlan?: {
    pages: Array<{
      pageNumber: number;
      pageKind: "front" | "inside";
      templateId: string;
      templateName: string;
      boxCount: number;
      nmsArticleCount: number;
      fillArticleCount: number;
      articles: NmsBundleArticle[];
    }>;
    nmsArticleCount: number;
    filledArticleCount: number;
  };
};

export type NmsBundleSummaryArticle = {
  index: number;
  newsId: unknown;
  language: unknown;
  headline: string;
  bodyChars: number;
  category: unknown;
  place: unknown;
  imageCount: number;
  hasCoverImage: boolean;
};

export type NmsBundleSummary = {
  receivedAt: string;
  source: unknown;
  sentAt: unknown;
  job_id: unknown;
  bundle_id: unknown;
  edition_id: unknown;
  target_user_id: unknown;
  pagemint_user_id: unknown;
  pagemint_target_id: unknown;
  targetUser: NmsTargetUser | null;
  callback: NmsCallbackConfig | null;
  pdfCallback: NmsCallbackConfig | null;
  declaredCount: unknown;
  articleCount: number;
  articles: NmsBundleSummaryArticle[];
};

export type StoredNmsBundle = {
  payloadFile: string;
  summaryFile: string;
  latestPayloadFile: string;
  latestSummaryFile: string;
  summary: NmsBundleSummary;
};

export type NmsPdfJobResult = {
  pdfPath: string;
  filename: string;
  articleCount: number;
  filledArticleCount: number;
  callbackAttempted: boolean;
  callbackOk: boolean;
};

export const ALLOWED_NMS_PAGEMINT_IDS = new Set(["cliffdemo3"]);

export const textValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const pickNmsArticleImageUrl = (article: NmsBundleArticle) => {
  const nested = article.ui_hindi || article.ui_english || article.article;
  const cover = article.coverImage;
  const images = Array.isArray(article.images) ? article.images : [];
  const selected = images.find((image) => image?.isCover) ?? images.find((image) => textValue(image?.url));
  return (
    textValue(cover && typeof cover === "object" ? cover.url : "") ||
    textValue(selected?.url) ||
    textValue(article.imageUrl) ||
    textValue(article.image_url) ||
    textValue(article.image_link) ||
    textValue(nested?.image_url) ||
    textValue(article.media?.image_url) ||
    textValue(article.media?.image_link)
  );
};

export const getNmsPageMintTargetId = (payload: NmsBundlePayload) =>
  textValue(payload.pagemint_target_id) ||
  textValue(payload.pagemint_user_id) ||
  textValue(payload.targetUser?.pagemintId) ||
  textValue(payload.targetUser?.externalId);

export const isAllowedNmsPageMintTarget = (payload: NmsBundlePayload) =>
  ALLOWED_NMS_PAGEMINT_IDS.has(getNmsPageMintTargetId(payload));

export const getNumericTargetUserId = (payload: NmsBundlePayload) => {
  const value = payload.target_user_id ?? payload.callback?.targetUserId ?? payload.pdfCallback?.targetUserId;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
};

export const getNmsCallback = (payload: NmsBundlePayload) => {
  const callbackUrl = textValue(payload.callback?.url);
  return callbackUrl ? payload.callback : payload.pdfCallback;
};

export const validateNmsBundlePayload = (payload: unknown): NmsBundlePayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("NMS bundle must be a JSON object.");
  }

  const bundle = payload as NmsBundlePayload;
  if (!Array.isArray(bundle.articles)) {
    throw new Error("NMS bundle must include an articles array.");
  }

  if (!getNumericTargetUserId(bundle)) {
    throw new Error("NMS bundle must include a numeric target_user_id for callback storage.");
  }

  return bundle;
};
