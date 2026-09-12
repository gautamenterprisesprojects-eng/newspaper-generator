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
  };
  place?: unknown;
  category?: unknown;
  tags?: unknown;
  images?: NmsBundleImage[];
  coverImage?: NmsBundleImage | null;
  websiteLinks?: unknown;
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
