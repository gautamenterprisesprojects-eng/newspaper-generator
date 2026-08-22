import type { HeaderSet, HeaderSystemState, PublicationProfile } from "@/types/header";
import type { HeaderLayoutKind, InsideHeaderLayoutKind } from "@/types/header";
import type { NewspaperDocument } from "@/types/document";
import { createDefaultHeaderSet, createDefaultPublicationProfile } from "./HeaderDefaults";
import { normalizeHeaderSystemState } from "./HeaderNormalizer";
import { frontHeaderLayouts, insideHeaderLayouts } from "./HeaderLayoutTemplates";

export type HeaderSetExportPayload = {
  schemaVersion: number;
  profile: PublicationProfile;
  headerSet: HeaderSet;
};

export type HeaderValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

/** Returns validation issues for a Header System without mutating it. */
export const validateHeaderSystemState = (
  state: HeaderSystemState,
): HeaderValidationIssue[] => {
  const issues: HeaderValidationIssue[] = [];

  if (state.activeHeaderSetId && !state.headerSets[state.activeHeaderSetId]) {
    issues.push({
      severity: "error",
      code: "missing-active-header-set",
      message: "The active Header Set is missing.",
    });
  }

  for (const headerSet of Object.values(state.headerSets)) {
    const profile = state.publicationProfiles[headerSet.publicationProfileId];

    if (!profile) {
      issues.push({
        severity: "error",
        code: "missing-publication-profile",
        message: `Header Set "${headerSet.name}" references a missing Publication Profile.`,
      });
    }

    if (headerSet.front.height <= 0 || headerSet.inside.height <= 0) {
      issues.push({
        severity: "error",
        code: "invalid-header-height",
        message: `Header Set "${headerSet.name}" has an invalid header height.`,
      });
    }

    if (!profile?.publicationName?.trim() && !profile?.publicationNameHindi?.trim()) {
      issues.push({
        severity: "warning",
        code: "missing-publication-name",
        message: `Header Set "${headerSet.name}" has no publication name.`,
      });
    }

    if (profile?.logoAssetId && !profile.publicationName.trim()) {
      issues.push({
        severity: "warning",
        code: "logo-without-text-fallback",
        message: `Header Set "${headerSet.name}" should keep a text masthead fallback for missing logo output.`,
      });
    }
  }

  return issues;
};

/** Validates Header Set logo references against the document asset registry. */
export const validateHeaderAssets = (
  document: NewspaperDocument,
): HeaderValidationIssue[] => {
  const state = normalizeHeaderSystemState(document.headerSystem, document.metadata, { enableDefaultHeader: false });
  const issues: HeaderValidationIssue[] = [];

  for (const headerSet of Object.values(state.headerSets)) {
    const profile = state.publicationProfiles[headerSet.publicationProfileId];

    if (!profile) {
      continue;
    }

    for (const [assetRole, assetId] of [
      ["logo", profile.logoAssetId],
      ["monochrome-logo", profile.monochromeLogoAssetId],
    ] as const) {
      if (!assetId) {
        continue;
      }

      const asset = document.assets[assetId];

      if (!asset) {
        issues.push({
          severity: "warning",
          code: "missing-logo-asset",
          message: `Header Set "${headerSet.name}" references a missing ${assetRole}; text masthead fallback will be used.`,
        });
        continue;
      }

      if (!["image", "logo", "svg"].includes(asset.type)) {
        issues.push({
          severity: "error",
          code: "unsupported-logo-asset",
          message: `Header Set "${headerSet.name}" references an unsupported ${assetRole} asset type.`,
        });
      }

      if (asset.format === "svg" && /<script|onload=|javascript:/iu.test(asset.source ?? "")) {
        issues.push({
          severity: "error",
          code: "unsafe-svg-logo",
          message: `Header Set "${headerSet.name}" references an SVG logo with unsupported executable content.`,
        });
      }
    }
  }

  return issues;
};

/** Saves the active Header Set as a new reusable set with a stable profile copy. */
export const saveHeaderSetAs = (
  state: HeaderSystemState,
  name: string,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const active = normalized.activeHeaderSetId ? normalized.headerSets[normalized.activeHeaderSetId] : null;

  if (!active) {
    return normalized;
  }

  const sourceProfile = normalized.publicationProfiles[active.publicationProfileId] ?? createDefaultPublicationProfile();
  const profileId = createId("publication-profile");
  const headerSetId = createId("header-set");
  const profile: PublicationProfile = {
    ...sourceProfile,
    id: profileId,
  };
  const headerSet: HeaderSet = {
    ...active,
    id: headerSetId,
    name: name.trim() || `${active.name} Copy`,
    publicationProfileId: profileId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return {
    ...normalized,
    publicationProfiles: {
      ...normalized.publicationProfiles,
      [profileId]: profile,
    },
    headerSets: {
      ...normalized.headerSets,
      [headerSetId]: headerSet,
    },
    activeHeaderSetId: headerSetId,
  };
};

/** Duplicates the active Header Set and activates the duplicate. */
export const duplicateActiveHeaderSet = (
  state: HeaderSystemState,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const active = normalized.activeHeaderSetId ? normalized.headerSets[normalized.activeHeaderSetId] : null;

  return active ? saveHeaderSetAs(normalized, `${active.name} Copy`) : normalized;
};

/** Renames a Header Set by id. */
export const renameHeaderSet = (
  state: HeaderSystemState,
  headerSetId: string,
  name: string,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const headerSet = normalized.headerSets[headerSetId];

  if (!headerSet || !name.trim()) {
    return normalized;
  }

  return {
    ...normalized,
    headerSets: {
      ...normalized.headerSets,
      [headerSetId]: {
        ...headerSet,
        name: name.trim(),
        updatedAt: nowIso(),
      },
    },
  };
};

/** Deletes a Header Set when at least one set remains. */
export const deleteHeaderSet = (
  state: HeaderSystemState,
  headerSetId: string,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const entries = Object.entries(normalized.headerSets).filter(([id]) => id !== headerSetId);

  if (entries.length === Object.keys(normalized.headerSets).length || entries.length === 0) {
    return normalized;
  }

  const headerSets = Object.fromEntries(entries);
  const activeHeaderSetId =
    normalized.activeHeaderSetId === headerSetId
      ? entries[0][0]
      : normalized.activeHeaderSetId;

  return {
    ...normalized,
    headerSets,
    activeHeaderSetId,
    defaultHeaderSetId: normalized.defaultHeaderSetId === headerSetId ? activeHeaderSetId : normalized.defaultHeaderSetId,
  };
};

/** Activates an existing Header Set. */
export const activateHeaderSet = (
  state: HeaderSystemState,
  headerSetId: string,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });

  return normalized.headerSets[headerSetId]
    ? {
        ...normalized,
        activeHeaderSetId: headerSetId,
      }
    : normalized;
};

/** Marks an existing Header Set as the default for future document creation. */
export const setDefaultHeaderSet = (
  state: HeaderSystemState,
  headerSetId: string,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });

  return normalized.headerSets[headerSetId]
    ? {
        ...normalized,
        defaultHeaderSetId: headerSetId,
      }
    : normalized;
};

/** Serializes the active Header Set and its Publication Profile to JSON. */
export const exportActiveHeaderSetJson = (
  state: HeaderSystemState,
): string => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const active = normalized.activeHeaderSetId ? normalized.headerSets[normalized.activeHeaderSetId] : null;

  if (!active) {
    throw new Error("No active Header Set to export.");
  }

  const profile = normalized.publicationProfiles[active.publicationProfileId];

  if (!profile) {
    throw new Error("Active Header Set is missing its Publication Profile.");
  }

  return JSON.stringify(
    {
      schemaVersion: normalized.schemaVersion,
      profile,
      headerSet: active,
    } satisfies HeaderSetExportPayload,
    null,
    2,
  );
};

/** Imports a Header Set JSON payload and activates the imported set. */
export const importHeaderSetJson = (
  state: HeaderSystemState,
  payload: string,
): HeaderSystemState => {
  const parsed = JSON.parse(payload) as Partial<HeaderSetExportPayload>;
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });

  if (!parsed.profile || !parsed.headerSet) {
    throw new Error("Invalid Header Set JSON.");
  }

  const profile = createDefaultPublicationProfile(parsed.profile);
  const headerSet = createDefaultHeaderSet(profile, {
    ...parsed.headerSet,
    id: parsed.headerSet.id && !normalized.headerSets[parsed.headerSet.id]
      ? parsed.headerSet.id
      : createId("header-set"),
    publicationProfileId: profile.id,
    updatedAt: nowIso(),
  });

  return {
    ...normalized,
    publicationProfiles: {
      ...normalized.publicationProfiles,
      [profile.id]: profile,
    },
    headerSets: {
      ...normalized.headerSets,
      [headerSet.id]: headerSet,
    },
    activeHeaderSetId: headerSet.id,
  };
};

const updateActiveHeaderSet = (
  state: HeaderSystemState,
  update: (headerSet: HeaderSet) => HeaderSet,
): HeaderSystemState => {
  const normalized = normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  const activeHeaderSetId = normalized.activeHeaderSetId;

  if (!activeHeaderSetId || !normalized.headerSets[activeHeaderSetId]) {
    return normalized;
  }

  return {
    ...normalized,
    headerSets: {
      ...normalized.headerSets,
      [activeHeaderSetId]: update(normalized.headerSets[activeHeaderSetId]),
    },
  };
};

/** Toggles whether the active master header is locked from accidental editing. */
export const setActiveHeaderLocked = (
  state: HeaderSystemState,
  locked: boolean,
): HeaderSystemState =>
  updateActiveHeaderSet(state, (headerSet) => ({
    ...headerSet,
    locked,
    updatedAt: nowIso(),
  }));

/** Toggles whether the active master header is rendered. */
export const setActiveHeaderHidden = (
  state: HeaderSystemState,
  hidden: boolean,
): HeaderSystemState =>
  updateActiveHeaderSet(state, (headerSet) => ({
    ...headerSet,
    hidden,
    updatedAt: nowIso(),
  }));

/** Resets the active Header Set layouts to a selected front/inside pair. */
export const resetActiveHeaderLayouts = (
  state: HeaderSystemState,
  frontLayout: HeaderLayoutKind,
  insideLayout: InsideHeaderLayoutKind,
): HeaderSystemState =>
  updateActiveHeaderSet(state, (headerSet) => ({
    ...headerSet,
    front: frontHeaderLayouts[frontLayout],
    inside: insideHeaderLayouts[insideLayout],
    updatedAt: nowIso(),
  }));

/** Applies or replaces a section-level inside-header override on the active Header Set. */
export const setSectionInsideHeaderOverride = (
  state: HeaderSystemState,
  sectionName: string,
  input: {
    displayName?: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
    websiteSlug?: string;
  },
): HeaderSystemState => {
  const normalizedSection = sectionName.trim();

  if (!normalizedSection) {
    return normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  }

  return updateActiveHeaderSet(state, (headerSet) => {
    const baseInside = input.layout ? insideHeaderLayouts[input.layout] : headerSet.inside;
    const override = {
      sectionName: input.displayName?.trim() || normalizedSection,
      inside: {
        ...baseInside,
        accentColor: input.accentColor || baseInside.accentColor,
        center: {
          ...baseInside.center,
          template: input.displayName?.trim() || normalizedSection,
        },
        right: input.websiteSlug
          ? {
              ...baseInside.right,
              template: `${baseInside.right.template} | ${input.websiteSlug}`,
            }
          : baseInside.right,
      },
    };

    return {
      ...headerSet,
      sectionOverrides: {
        ...headerSet.sectionOverrides,
        [normalizedSection]: override,
      },
      updatedAt: nowIso(),
    };
  });
};

/** Removes a section-level override from the active Header Set. */
export const removeSectionHeaderOverride = (
  state: HeaderSystemState,
  sectionName: string,
): HeaderSystemState =>
  updateActiveHeaderSet(state, (headerSet) => {
    const sectionOverrides = { ...headerSet.sectionOverrides };
    delete sectionOverrides[sectionName];

    return {
      ...headerSet,
      sectionOverrides,
      updatedAt: nowIso(),
    };
  });

/** Applies a page-local override without duplicating the full Header Set into the page model. */
export const setPageInsideHeaderOverride = (
  state: HeaderSystemState,
  pageId: string,
  input: {
    sectionName: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
  },
): HeaderSystemState => {
  if (!pageId) {
    return normalizeHeaderSystemState(state, {}, { enableDefaultHeader: true });
  }

  return updateActiveHeaderSet(state, (headerSet) => {
    const baseInside = input.layout ? insideHeaderLayouts[input.layout] : headerSet.inside;

    return {
      ...headerSet,
      perPageOverrides: {
        ...headerSet.perPageOverrides,
        [pageId]: {
          sectionName: input.sectionName || "Page Override",
          inside: {
            ...baseInside,
            accentColor: input.accentColor || baseInside.accentColor,
            center: {
              ...baseInside.center,
              template: input.sectionName || baseInside.center.template,
            },
          },
        },
      },
      updatedAt: nowIso(),
    };
  });
};

/** Returns a page to the active master header by removing its page-local override. */
export const removePageHeaderOverride = (
  state: HeaderSystemState,
  pageId: string,
): HeaderSystemState =>
  updateActiveHeaderSet(state, (headerSet) => {
    const perPageOverrides = { ...headerSet.perPageOverrides };
    delete perPageOverrides[pageId];

    return {
      ...headerSet,
      perPageOverrides,
      updatedAt: nowIso(),
    };
  });
