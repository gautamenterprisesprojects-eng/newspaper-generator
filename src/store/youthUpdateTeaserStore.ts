"use client";

import { create } from "zustand";
import {
  YOUTH_UPDATE_TEASER_HEADLINES,
  YOUTH_UPDATE_TEASER_IMAGE_URLS,
  YOUTH_UPDATE_TEASER_LABELS,
} from "@/engines/MasterPage/YouthUpdateConfig";

export type YouthUpdateTeaserSlot = {
  imageUrl: string;
  headline: string;
  label: string;
};

type YouthUpdateTeaserState = {
  /** Null until PortalLaunchBootstrap's profile fetch resolves -- callers fall back to the static placeholder config until then. */
  teasers: [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot] | null;
  setTeasers: (
    teasers: [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot],
  ) => void;
};

/**
 * Holds Youth UPDATE's own daily-editable masthead teaser content (image +
 * headline + category label, per slot) -- publisher-exclusive, populated by
 * PortalLaunchBootstrap's profile fetch when the session's publisherId is
 * theirs. A dedicated store rather than new fields on the shared
 * PublicationProfile type: every other publisher's profile shape, and every
 * other reader of it, stays byte-for-byte untouched.
 */
export const useYouthUpdateTeaserStore = create<YouthUpdateTeaserState>((set) => ({
  teasers: null,
  setTeasers: (teasers) => set({ teasers }),
}));

export const FALLBACK_TEASERS: [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot] =
  [0, 1, 2, 3].map((i) => ({
    imageUrl: YOUTH_UPDATE_TEASER_IMAGE_URLS[i],
    headline: YOUTH_UPDATE_TEASER_HEADLINES[i],
    label: YOUTH_UPDATE_TEASER_LABELS[i],
  })) as [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot];

/** Reactive read for Konva components -- re-renders once the portal fetch resolves. */
export const useYouthUpdateTeasers = (): [
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
] => useYouthUpdateTeaserStore((state) => state.teasers) ?? FALLBACK_TEASERS;

/** Imperative read for the PDF export path, which isn't a React render. */
export const getYouthUpdateTeasersOrFallback = (): [
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
  YouthUpdateTeaserSlot,
] => useYouthUpdateTeaserStore.getState().teasers ?? FALLBACK_TEASERS;
