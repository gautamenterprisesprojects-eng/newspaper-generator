import type { NmsBundlePayload, StoredNmsBundle } from "./nmsBundleTypes";
import { isAllowedNmsPageMintTarget } from "./nmsBundleTypes";
import { ensureNmsArticleCapacity } from "./nmsNewsFill";
import { postNmsPdfCallback } from "./nmsPdfCallback";
import { markNmsBundleUsed } from "./nmsBundleStorage";
import { cleanupOldNmsArtifacts } from "./nmsRetention";

export const generateNmsPdfJob = async (payload: NmsBundlePayload, stored?: StoredNmsBundle) => {
  if (!isAllowedNmsPageMintTarget(payload)) {
    throw new Error("NMS PageMint target is not enabled for headless PDF generation.");
  }

  const originalCount = Array.isArray(payload.articles) ? payload.articles.length : 0;
  const { articles, filledArticleCount } = await ensureNmsArticleCapacity(payload);
  const { generateNmsRealEditorPdf } = await import("./nmsHeadlessPdfRenderer");
  const { pdfPath, filename } = await generateNmsRealEditorPdf(payload, articles.map((article, index) => ({
    ...article,
    nmsFilled: index >= originalCount,
  })));

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
    filledArticleCount,
    callbackAttempted,
    callbackOk,
  };
};

export const startNmsPdfJob = (payload: NmsBundlePayload, stored: StoredNmsBundle) => {
  console.log("[NMS PDF job] queued real editor export", {
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    target_user_id: payload.target_user_id ?? null,
    pagemint_user_id: payload.pagemint_user_id ?? null,
  });
  void generateNmsPdfJob(payload, stored).catch((error: unknown) => {
    console.error("[NMS PDF job] failed", error);
  });
};

