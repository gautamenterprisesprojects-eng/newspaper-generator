import type { NmsBundlePayload, StoredNmsBundle } from "./nmsBundleTypes";
import { isAllowedNmsPageMintTarget } from "./nmsBundleTypes";
import { buildNmsSequentialEdition } from "./nmsSequentialEdition";
import { postNmsPdfCallback } from "./nmsPdfCallback";
import { markNmsBundleUsed } from "./nmsBundleStorage";
import { cleanupOldNmsArtifacts } from "./nmsRetention";

export const generateNmsPdfJob = async (payload: NmsBundlePayload, stored?: StoredNmsBundle) => {
  if (!isAllowedNmsPageMintTarget(payload)) {
    throw new Error("NMS PageMint target is not enabled for headless PDF generation.");
  }

  const nmsArticles = Array.isArray(payload.articles) ? payload.articles : [];
  const editionPlan = await buildNmsSequentialEdition(nmsArticles);
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

export const startNmsPdfJob = (payload: NmsBundlePayload, stored: StoredNmsBundle) => {
  console.log("[NMS PDF job] queued sequential editor export", {
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    target_user_id: payload.target_user_id ?? null,
    pagemint_user_id: payload.pagemint_user_id ?? null,
    articleCount: Array.isArray(payload.articles) ? payload.articles.length : 0,
  });
  void generateNmsPdfJob(payload, stored).catch((error: unknown) => {
    console.error("[NMS PDF job] failed", error);
  });
};
