"use client";

import { create } from "zustand";

export type YouthUpdateInsideTeaserLiveItem = {
  imageUrl: string;
  /** The API's third summary bullet (same punchy-title convention as the SHORT NEWS rail's own headline), falling back to the real headline. */
  title: string;
  /** Real article body copy -- flows under the title, wrapped and ellipsis-clipped to however much width/height the card has. */
  body: string;
};

type YouthUpdateInsideTeaserLiveState = {
  items: YouthUpdateInsideTeaserLiveItem[];
  setItems: (items: YouthUpdateInsideTeaserLiveItem[]) => void;
};

/**
 * Holds Youth UPDATE's inside-page teaser strip's two right-hand cards' live
 * content -- image + title + body, peeled off the same leftover article pool
 * as the SHORT NEWS rail (see editorStore.ts's isYouthUpdateInsideTemplate
 * branch), but a distinct slice of it so the rail and these cards never show
 * the same article. Populated imperatively at generation time, same pattern
 * as youthUpdateInsideRailStore.ts.
 *
 * Deliberately NOT the same store as youthUpdateTeaserStore.ts (the front
 * masthead's portal-editable placeholder teasers) -- that store is still
 * shared with the front page and stays publisher-edited; this one is
 * inside-page-only and always live. Fewer than 2 items (an empty array
 * included) means the caller should fall back to the static placeholder
 * store instead of rendering a blank card.
 */
export const useYouthUpdateInsideTeaserLiveStore = create<YouthUpdateInsideTeaserLiveState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));

/** Imperative read for the PDF export path, which isn't a React render. */
export const getYouthUpdateInsideTeaserLiveItems = (): YouthUpdateInsideTeaserLiveItem[] =>
  useYouthUpdateInsideTeaserLiveStore.getState().items;

/**
 * Merges live leftover-article content over the static placeholder teasers
 * for the inside page's two right-hand cards -- per slot, so a generation
 * that only turned up 1 (or 0) spare articles still shows the static
 * placeholder for whichever card has no live item, rather than a blank
 * card. Used by both the Konva live preview and the canvas-export twin so
 * they build the exact same merged content.
 */
export const mergeYouthUpdateInsideTeaserCards = (
  staticSlots: { headline: string; label: string; imageUrl: string }[],
  liveItems: YouthUpdateInsideTeaserLiveItem[],
): {
  headlines: [string, string, string, string];
  labels: [string, string, string, string];
  imageUrls: [string, string, string, string];
} => {
  const headlines = staticSlots.map((slot, i) => liveItems[i]?.title || slot.headline) as [
    string, string, string, string,
  ];
  const labels = staticSlots.map((slot, i) => liveItems[i]?.body || slot.label) as [
    string, string, string, string,
  ];
  const imageUrls = staticSlots.map((slot, i) => liveItems[i]?.imageUrl || slot.imageUrl) as [
    string, string, string, string,
  ];
  return { headlines, labels, imageUrls };
};
