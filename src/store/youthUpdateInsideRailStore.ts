"use client";

import { create } from "zustand";

export type YouthUpdateInsideRailItem = {
  headline: string;
  body: string;
};

type YouthUpdateInsideRailState = {
  items: YouthUpdateInsideRailItem[];
  setItems: (items: YouthUpdateInsideRailItem[]) => void;
};

/**
 * Holds Youth UPDATE's inside-page "SHORT NEWS" rail content -- three (or
 * however many fit) live newswire items, peeled off the leftover articles
 * importNewswireStories fetches beyond the template's 7 real story slots
 * (see editorStore.ts's isYouthUpdateInsideTemplate branch). Populated
 * imperatively at generation time, not a portal-editable store like
 * youthUpdateTeaserStore.ts -- this content refreshes every generation
 * rather than being publisher-edited, so there is no fallback/save-load
 * round trip to model.
 */
export const useYouthUpdateInsideRailStore = create<YouthUpdateInsideRailState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));

/** Imperative read for the PDF export path, which isn't a React render. */
export const getYouthUpdateInsideRailItems = (): YouthUpdateInsideRailItem[] =>
  useYouthUpdateInsideRailStore.getState().items;
