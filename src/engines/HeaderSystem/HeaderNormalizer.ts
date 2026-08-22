import type { HeaderSet, HeaderSystemState, PublicationProfile } from "@/types/header";
import {
  HEADER_SYSTEM_SCHEMA_VERSION,
  createDefaultHeaderSet,
  createDefaultHeaderSystemState,
  createDefaultPublicationProfile,
} from "./HeaderDefaults";

/** Normalizes persisted header data while preserving legacy documents that have no active header. */
export const normalizeHeaderSystemState = (
  state: Partial<HeaderSystemState> | null | undefined,
  metadata: {
    newspaperName?: string;
    edition?: string;
    date?: string;
    language?: string;
  } = {},
  options: { enableDefaultHeader: boolean } = { enableDefaultHeader: false },
): HeaderSystemState => {
  if (!state && !options.enableDefaultHeader) {
    return {
      schemaVersion: HEADER_SYSTEM_SCHEMA_VERSION,
      publicationProfiles: {},
      headerSets: {},
      activeHeaderSetId: null,
      sectionHeaderSetOverrides: {},
      defaultHeaderSetId: null,
    };
  }

  const fallback = createDefaultHeaderSystemState(metadata);
  const profiles = state?.publicationProfiles ?? (options.enableDefaultHeader ? fallback.publicationProfiles : {});
  const normalizedProfiles: Record<string, PublicationProfile> = Object.fromEntries(
    Object.entries(profiles).map(([id, profile]) => [
      id,
      createDefaultPublicationProfile({
        ...profile,
        id: profile.id ?? id,
      }),
    ]),
  );
  const headerSetsSource = state?.headerSets ?? (options.enableDefaultHeader ? fallback.headerSets : {});
  const fallbackProfile =
    Object.values(normalizedProfiles)[0] ??
    createDefaultPublicationProfile({
      publicationName: metadata.newspaperName,
      editionName: metadata.edition,
      date: metadata.date,
    });
  const normalizedHeaderSets: Record<string, HeaderSet> = Object.fromEntries(
    Object.entries(headerSetsSource).map(([id, headerSet]) => [
      id,
      createDefaultHeaderSet(normalizedProfiles[headerSet.publicationProfileId] ?? fallbackProfile, {
        ...headerSet,
        id: headerSet.id ?? id,
      }),
    ]),
  );
  const activeHeaderSetId =
    state?.activeHeaderSetId && normalizedHeaderSets[state.activeHeaderSetId]
      ? state.activeHeaderSetId
      : options.enableDefaultHeader
        ? Object.keys(normalizedHeaderSets)[0] ?? null
        : null;

  return {
    schemaVersion: state?.schemaVersion ?? HEADER_SYSTEM_SCHEMA_VERSION,
    publicationProfiles: normalizedProfiles,
    headerSets: normalizedHeaderSets,
    activeHeaderSetId,
    sectionHeaderSetOverrides: state?.sectionHeaderSetOverrides ?? {},
    defaultHeaderSetId: state?.defaultHeaderSetId ?? activeHeaderSetId,
  };
};
