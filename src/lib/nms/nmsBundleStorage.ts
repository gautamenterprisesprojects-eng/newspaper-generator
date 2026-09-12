import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NmsBundleArticle, NmsBundlePayload, NmsBundleSummary, StoredNmsBundle } from "./nmsBundleTypes";

export const getNmsBundleDir = () => process.env.NMS_BUNDLE_DIR || path.join(process.cwd(), "data", "nms-bundles");
export const getNmsGeneratedPdfDir = () => process.env.NMS_GENERATED_PDF_DIR || path.join(process.cwd(), "data", "nms-generated-pdfs");

export const sanitizeFilePart = (value: unknown) =>
  String(value || "bundle")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "bundle";

const summarizeArticle = (article: NmsBundleArticle, index: number) => {
  const images = Array.isArray(article.images) ? article.images : [];
  return {
    index: index + 1,
    newsId: article.newsId ?? null,
    language: article.language ?? null,
    headline: typeof article.headline === "string" ? article.headline : "",
    bodyChars: typeof article.body === "string" ? article.body.length : 0,
    category: article.category ?? null,
    place: article.place ?? null,
    imageCount: images.length,
    hasCoverImage: Boolean(article.coverImage),
  };
};

export const summarizeNmsBundle = (payload: NmsBundlePayload): NmsBundleSummary => {
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  return {
    receivedAt: new Date().toISOString(),
    source: payload.source ?? null,
    sentAt: payload.sentAt ?? null,
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    edition_id: payload.edition_id ?? null,
    target_user_id: payload.target_user_id ?? null,
    pagemint_user_id: payload.pagemint_user_id ?? null,
    pagemint_target_id: payload.pagemint_target_id ?? null,
    targetUser: payload.targetUser ?? null,
    callback: payload.callback ?? null,
    pdfCallback: payload.pdfCallback ?? null,
    declaredCount: payload.count ?? null,
    articleCount: articles.length,
    articles: articles.map(summarizeArticle),
  };
};

export const storeNmsBundle = async (payload: NmsBundlePayload): Promise<StoredNmsBundle> => {
  const bundleDir = getNmsBundleDir();
  await mkdir(bundleDir, { recursive: true });
  await mkdir(path.join(bundleDir, "used"), { recursive: true });

  const summary = summarizeNmsBundle(payload);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bundlePart = sanitizeFilePart(payload.bundle_id || payload.job_id || stamp);
  const payloadFile = path.join(bundleDir, `${stamp}-${bundlePart}.json`);
  const summaryFile = path.join(bundleDir, `${stamp}-${bundlePart}.summary.json`);
  const latestPayloadFile = path.join(bundleDir, "latest.json");
  const latestSummaryFile = path.join(bundleDir, "latest.summary.json");

  await Promise.all([
    writeFile(payloadFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(latestPayloadFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(latestSummaryFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
  ]);

  return { payloadFile, summaryFile, latestPayloadFile, latestSummaryFile, summary };
};

export const readLatestNmsBundleSummary = async () => {
  try {
    const bundleDir = getNmsBundleDir();
    const latest = JSON.parse(await readFile(path.join(bundleDir, "latest.summary.json"), "utf8")) as NmsBundleSummary;
    const files = (await readdir(bundleDir)).filter((name) => name.endsWith(".json")).sort().slice(-20);
    return { latest, files };
  } catch {
    return { latest: null, files: [] as string[] };
  }
};

export const markNmsBundleUsed = async (stored: StoredNmsBundle) => {
  const bundleDir = getNmsBundleDir();
  const usedDir = path.join(bundleDir, "used");
  await mkdir(usedDir, { recursive: true });

  const moveIfPresent = async (file: string) => {
    try {
      await rename(file, path.join(usedDir, path.basename(file)));
    } catch {
      // The bundle may already be moved or removed by a retry/cleanup. Keep cleanup isolated.
    }
  };

  await Promise.all([moveIfPresent(stored.payloadFile), moveIfPresent(stored.summaryFile)]);
};
