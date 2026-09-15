import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { getNumericTargetUserId } from "./nmsBundleTypes";
import { getNmsGeneratedPdfDir, sanitizeFilePart, storeNmsExportPayload } from "./nmsBundleStorage";

type HeadlessWindow = typeof window & {
  __NMS_EXPORT_READY?: boolean;
  __NMS_EXPORT_ERROR?: string;
  __PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF?: () => Promise<number[]>;
  __NMS_EXPORT_DEBUG?: unknown;
};

const getInternalBaseUrl = () =>
  process.env.NMS_PAGEMINT_INTERNAL_EXPORT_URL ||
  process.env.PAGEMINT_INTERNAL_EXPORT_URL ||
  "http://127.0.0.1:3000";

const getChromeExecutablePath = () =>
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_BIN ||
  "/usr/bin/chromium-browser";

export const generateNmsRealEditorPdf = async (payload: NmsBundlePayload, articles: NmsBundleArticle[]) => {
  const pdfDir = getNmsGeneratedPdfDir();
  await mkdir(pdfDir, { recursive: true });

  const filename = `nms-37-real-${sanitizeFilePart(payload.job_id || payload.bundle_id || Date.now())}.pdf`;
  const pdfPath = path.join(pdfDir, filename);
  const baseUrl = getInternalBaseUrl().replace(/\/+$/, "");
  const exportJobId = String(payload.job_id || payload.bundle_id || Date.now());
  const exportPayloadFile = await storeNmsExportPayload({
    ...payload,
    count: articles.length,
    articles,
  });
  const plannedPages = Array.isArray(payload.editionPlan?.pages) ? payload.editionPlan.pages : [];
  const exportPageCount = Math.max(1, plannedPages.length || Math.ceil(articles.length / 8));
  const pageSections = (plannedPages.length > 0
    ? plannedPages
    : Array.from({ length: exportPageCount }, (_, index) => ({
        pageNumber: index + 1,
        pageKind: (index === 0 ? "front" : "inside") as "front" | "inside",
        templateName: index === 0 ? "Front Page" : "City",
      }))
  ).map((page) => ({
    page_number: page.pageNumber,
    section: page.pageKind === "front" ? "Front Page" : page.templateName || "City",
    header_type: page.pageKind === "front" ? "front" : "inside",
    notes: "templateId" in page ? String(page.templateId) : "",
  }));
  const exportParams = new URLSearchParams({
    nmsExport: "1",
    job: exportJobId,
    newspaperName: "THE CLIFF NEWS",
    pageCount: String(exportPageCount),
    pageSections: JSON.stringify(pageSections),
  });
  const exportUrl = `${baseUrl}/?${exportParams.toString()}`;
  const timeoutMs = Number(process.env.NMS_HEADLESS_EXPORT_TIMEOUT_MS || 180000);

  console.log("[NMS real PDF] starting PageMint editor export", {
    job_id: payload.job_id ?? null,
    bundle_id: payload.bundle_id ?? null,
    target_user_id: getNumericTargetUserId(payload),
    articleCount: articles.length,
    pageCount: exportPageCount,
    filledArticleCount: payload.editionPlan?.filledArticleCount ?? 0,
    exportPayloadFile,
    exportUrl,
  });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    executablePath: getChromeExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    page.on("console", (message) => {
      console.log(`[NMS real PDF browser:${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      console.error("[NMS real PDF browser error]", error);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      console.warn("[NMS real PDF request failed]", request.url(), failure?.errorText);
    });
    await page.setViewportSize({ width: 1400, height: 1800 });
    await page.goto(exportUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      console.warn("[NMS real PDF] network did not become idle before readiness wait; continuing.");
    });
    await page.waitForFunction(() => {
      const nmsWindow = window as HeadlessWindow;
      if (nmsWindow.__NMS_EXPORT_ERROR) throw new Error(nmsWindow.__NMS_EXPORT_ERROR);
      return Boolean(nmsWindow.__NMS_EXPORT_READY && nmsWindow.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF);
    }, undefined, { timeout: timeoutMs });
    console.log("[NMS real PDF] editor export bridge is ready");
    await page.evaluate(async () => document.fonts?.ready);
    const exportDebug = await page.evaluate(() => (window as HeadlessWindow).__NMS_EXPORT_DEBUG ?? null);
    const bytes = await page.evaluate(async () => {
      const exporter = (window as HeadlessWindow).__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF;
      if (!exporter) throw new Error("PageMint editor PDF exporter is not available.");
      return exporter();
    });

    if (!Array.isArray(bytes) || bytes.length < 1000) {
      throw new Error("PageMint real editor export returned an empty PDF.");
    }

    await writeFile(pdfPath, Buffer.from(bytes));
    console.log("[NMS real PDF] wrote PageMint editor PDF", { pdfPath, bytes: bytes.length });
    await writeFile(`${pdfPath}.json`, `${JSON.stringify({
      renderer: "pagemint-editor-headless",
      job_id: payload.job_id ?? null,
      bundle_id: payload.bundle_id ?? null,
      edition_id: payload.edition_id ?? null,
      target_user_id: getNumericTargetUserId(payload),
      pagemint_user_id: payload.pagemint_user_id ?? null,
      pagemint_target_id: payload.pagemint_target_id ?? null,
      articleCount: articles.length,
      filledArticleCount: payload.editionPlan?.filledArticleCount ?? 0,
      pageCount: exportPageCount,
      pages: plannedPages.map((page) => ({
        pageNumber: page.pageNumber,
        pageKind: page.pageKind,
        templateId: page.templateId,
        templateName: page.templateName,
        boxCount: page.boxCount,
        nmsArticleCount: page.nmsArticleCount,
        fillArticleCount: page.fillArticleCount,
      })),
      exportDebug,
      generatedAt: new Date().toISOString(),
      exportUrl,
    }, null, 2)}\n`, "utf8");

    return { pdfPath, filename };
  } finally {
    await browser.close();
  }
};

