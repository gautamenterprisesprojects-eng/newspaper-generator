/**
 * cliffdemo3 NMS-only deterministic palette selection.
 *
 * Manual EditorCanvas pickBatchPalette() uses the same unused-pool structure but
 * Math.random() among unused presets — non-reproducible. We cannot change the
 * wizard. For NMS↔validation parity we keep unused-pool + replace random with a
 * stable FNV-1a index over sorted candidate ids, seeded by job/bundle/page.
 */
import {
  NEWSWIRE_SUBHEADING_PRESETS,
  type NewswireSubheadingPreset,
} from "@/lib/newswire";

export const fnv1a32 = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const buildCliffDemo3PaletteSeedBase = (parts: {
  jobId?: string | null;
  bundleId?: string | null;
  publicationDate?: string | null;
}): string =>
  [
    "cliffdemo3",
    String(parts.jobId || ""),
    String(parts.bundleId || ""),
    String(parts.publicationDate || ""),
  ].join("|");

export const createCliffDemo3DeterministicPalettePicker = (seedBase: string) => {
  const pool = NEWSWIRE_SUBHEADING_PRESETS.filter((preset) => preset.id !== "custom");
  const used = new Set<string>();
  let pageOrdinal = 0;

  return (): NewswireSubheadingPreset => {
    const unused = pool.filter((preset) => !used.has(preset.id));
    const candidates = unused.length > 0 ? unused : pool;
    const ordered = [...candidates].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const seed = `${seedBase}|pageOrdinal:${pageOrdinal}`;
    pageOrdinal += 1;
    const picked = ordered[fnv1a32(seed) % ordered.length] ?? ordered[0];
    used.add(String(picked.id));
    return picked;
  };
};
