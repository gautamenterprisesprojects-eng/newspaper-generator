import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { getNumericTargetUserId } from "./nmsBundleTypes";
import { getNmsGeneratedPdfDir, sanitizeFilePart } from "./nmsBundleStorage";

type HeadlessWindow = typeof window & {
  __NMS_EXPORT_READY?: boolean;
  __NMS_EXPORT_ERROR?: string;
  __PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF?: () => Promise<number[]>;
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
  const exportUrl = `${baseUrl}/?nmsExport=1&job=${encodeURIComponent(String(payload.job_id || payload.bundle_id || "latest"))}`;

  const browser = await chromium.launch({
    headless: true,
    executablePath: getChromeExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(Number(process.env.NMS_HEADLESS_EXPORT_TIMEOUT_MS || 120000));
    await page.setViewportSize({ width: 1400, height: 1800 });
    await page.goto(exportUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const nmsWindow = window as HeadlessWindow;
      if (nmsWindow.__NMS_EXPORT_ERROR) throw new Error(nmsWindow.__NMS_EXPORT_ERROR);
      return Boolean(nmsWindow.__NMS_EXPORT_READY && nmsWindow.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF);
    });
    await page.evaluate(async () => document.fonts?.ready);
    const bytes = await page.evaluate(async () => {
      const exporter = (window as HeadlessWindow).__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF;
      if (!exporter) throw new Error("PageMint editor PDF exporter is not available.");
      return exporter();
    });

    if (!Array.isArray(bytes) || bytes.length < 1000) {
      throw new Error("PageMint real editor export returned an empty PDF.");
    }

    await writeFile(pdfPath, Buffer.from(bytes));
    await writeFile(`${pdfPath}.json`, `${JSON.stringify({
      renderer: "pagemint-editor-headless",
      job_id: payload.job_id ?? null,
      bundle_id: payload.bundle_id ?? null,
      edition_id: payload.edition_id ?? null,
      target_user_id: getNumericTargetUserId(payload),
      pagemint_user_id: payload.pagemint_user_id ?? null,
      pagemint_target_id: payload.pagemint_target_id ?? null,
      articleCount: articles.length,
      generatedAt: new Date().toISOString(),
      exportUrl,
    }, null, 2)}\n`, "utf8");

    return { pdfPath, filename };
  } finally {
    await browser.close();
  }
};

