import { promises as fs } from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), ".data", "newswire-usage.json");
// Comfortably outlives the 24h freshness window this exists to back --
// once an id has aged out of "last 24 hours" it can never be selected
// again anyway, so retaining its used-marker past that point is moot.
const RETENTION_MS = 48 * 60 * 60 * 1000;

type UsageRecord = Record<string, number>;

const readStore = async (): Promise<UsageRecord> => {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as UsageRecord;
  } catch {
    return {};
  }
};

const writeStore = async (data: UsageRecord): Promise<void> => {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(data), "utf8");
  } catch {
    // Best-effort persistence -- a write failure just means the next
    // request re-derives a slightly stale used-set, not a hard failure.
  }
};

const prune = (data: UsageRecord): UsageRecord => {
  const cutoff = Date.now() - RETENTION_MS;
  const pruned: UsageRecord = {};
  for (const [id, usedAt] of Object.entries(data)) {
    if (usedAt >= cutoff) {
      pruned[id] = usedAt;
    }
  }
  return pruned;
};

/**
 * Article ids served to any caller recently enough that the same id would
 * otherwise be picked again -- backed by a JSON file (not in-memory) so it
 * survives the dev server restarts this project's workflow goes through
 * often, and shared across every fetch site rather than each one tracking
 * its own separate history.
 */
export const getRecentlyUsedNewswireIds = async (): Promise<Set<string>> => {
  const data = prune(await readStore());
  return new Set(Object.keys(data));
};

/**
 * Same data as getRecentlyUsedNewswireIds, but with the "used at" timestamp
 * kept rather than collapsed to a Set — lets a caller that's run out of
 * fresh-and-unused options rank its last-resort repeats by how long ago
 * each one was shown, so a forced repeat reaches for the article that has
 * rested the longest instead of any already-used one at random.
 */
export const getRecentlyUsedNewswireTimestamps = async (): Promise<Record<string, number>> =>
  prune(await readStore());

export const markNewswireIdsUsed = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  const data = prune(await readStore());
  const now = Date.now();
  for (const id of ids) {
    data[id] = now;
  }
  await writeStore(data);
};
