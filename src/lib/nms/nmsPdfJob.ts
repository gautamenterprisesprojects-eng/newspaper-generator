import type { NmsBundlePayload, StoredNmsBundle } from "./nmsBundleTypes";
import { isAllowedNmsPageMintTarget } from "./nmsBundleTypes";
import { buildNmsSequentialEdition, resolveNmsFrontTemplateId } from "./nmsSequentialEdition";
import { postNmsPdfCallback } from "./nmsPdfCallback";
import { markNmsBundleUsed } from "./nmsBundleStorage";
import { cleanupOldNmsArtifacts } from "./nmsRetention";

export const generateNmsPdfJob = async (payload: NmsBundlePayload, stored?: StoredNmsBundle) => {
  if (!isAllowedNmsPageMintTarget(payload)) {
    throw new Error("NMS PageMint target is not enabled for headless PDF generation.");
  }

  const nmsArticles = Array.isArray(payload.articles) ? payload.articles : [];
  const frontTemplateId = resolveNmsFrontTemplateId(payload);
  const editionPlan = await buildNmsSequentialEdition(nmsArticles, undefined, frontTemplateId);
  const articles = editionPlan.pages.flatMap((page) => page.articles);
  console.log("[NMS PDF job] sequential edition planned", {
    nmsArticleCount: editionPlan.nmsArticleCount,
    filledArticleCount: editionPlan.filledArticleCount,
    pages: editionPlan.pages.map((page) => ({
      pageNumber: page.pageNumber,
      pageKind: page.pageKind,
      templateId: page.templateId,
      templateName: page.templateName,
      boxCount: page.boxCount,
      nmsArticleCount: page.nmsArticleCount,
      fillArticleCount: page.fillArticleCount,
    })),
  });

  const { generateNmsRealEditorPdf } = await import("./nmsHeadlessPdfRenderer");
  const { pdfPath, filename } = await generateNmsRealEditorPdf({
    ...payload,
    count: articles.length,
    articles,
    editionPlan,
  }, articles);

  let callbackAttempted = false;
  let callbackOk = false;
  try {
    callbackAttempted = true;
    await postNmsPdfCallback(payload, pdfPath);
    callbackOk = true;
  } finally {
    if (stored && callbackAttempted) {
      await markNmsBundleUsed(stored);
    }
    await cleanupOldNmsArtifacts();
  }

  return {
    pdfPath,
    filename,
    articleCount: articles.length,
    filledArticleCount: editionPlan.filledArticleCount,
    callbackAttempted,
    callbackOk,
  };
};

// Each job launches a full headless Chromium that loads the whole editor
// (~0.5-1 GB, up to 3 minutes). Without a cap, a burst of POSTs -- 8 jobs in
// 70 seconds from one NMS user on 2026-09-21 -- launched them all at once,
// OOM-killed the 8 GB VPS (no swap), starved nginx/sshd and took both sites
// down with Cloudflare 522s. Jobs are async (NMS gets a callback), so
// running them one or two at a time costs nothing but latency.
const MAX_CONCURRENT_PDF_JOBS = Math.max(1, Number(process.env.NMS_PDF_MAX_CONCURRENCY) || 1);
const pendingJobs: Array<() => Promise<void>> = [];
const activeJobIds = new Set<string>();
let runningJobs = 0;

const drainPdfQueue = () => {
  while (runningJobs < MAX_CONCURRENT_PDF_JOBS && pendingJobs.length > 0) {
    const run = pendingJobs.shift()!;
    runningJobs += 1;
    void run().finally(() => {
      runningJobs -= 1;
      drainPdfQueue();
    });
  }
};

export const startNmsPdfJob = (payload: NmsBundlePayload, stored: StoredNmsBundle) => {
  const jobKey = String(payload.job_id ?? payload.bundle_id ?? "");
  if (jobKey && activeJobIds.has(jobKey)) {
    console.warn("[NMS PDF job] duplicate job ignored (already queued or running)", { job_id: jobKey });
    return;
  }
  if (jobKey) activeJobIds.add(jobKey);
  console.log("[NMS PDF job] queued sequential editor export", {
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    target_user_id: payload.target_user_id ?? null,
    pagemint_user_id: payload.pagemint_user_id ?? null,
    articleCount: Array.isArray(payload.articles) ? payload.articles.length : 0,
    queueDepth: pendingJobs.length,
    running: runningJobs,
    maxConcurrent: MAX_CONCURRENT_PDF_JOBS,
  });
  pendingJobs.push(() =>
    generateNmsPdfJob(payload, stored)
      .catch((error: unknown) => {
        console.error("[NMS PDF job] failed", error);
      })
      .finally(() => {
        if (jobKey) activeJobIds.delete(jobKey);
      }),
  );
  drainPdfQueue();
};
