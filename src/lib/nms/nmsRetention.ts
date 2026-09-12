import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { getNmsBundleDir, getNmsGeneratedPdfDir } from "./nmsBundleStorage";

const hoursToMs = (hours: number) => Math.max(0, hours) * 60 * 60 * 1000;
const usedBundleRetentionMs = () => hoursToMs(Number(process.env.NMS_USED_BUNDLE_RETENTION_HOURS || 1));
const generatedPdfRetentionMs = () => hoursToMs(Number(process.env.NMS_GENERATED_PDF_RETENTION_HOURS || 30));

const removeOldFiles = async (dir: string, maxAgeMs: number, extensions: Set<string>) => {
  const now = Date.now();
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const file = path.join(dir, entry);
    try {
      const info = await stat(file);
      if (!info.isFile()) return;
      if (!extensions.has(path.extname(entry).toLowerCase())) return;
      if (now - info.mtimeMs < maxAgeMs) return;
      await rm(file, { force: true });
    } catch {
      // Retention must never break the receive path.
    }
  }));
};

export const cleanupOldNmsArtifacts = async () => {
  await Promise.all([
    removeOldFiles(path.join(getNmsBundleDir(), "used"), usedBundleRetentionMs(), new Set([".json"])),
    removeOldFiles(getNmsGeneratedPdfDir(), generatedPdfRetentionMs(), new Set([".pdf", ".json"])),
  ]);
};
