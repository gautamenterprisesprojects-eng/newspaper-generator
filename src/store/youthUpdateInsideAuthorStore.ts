"use client";

import { create } from "zustand";
import {
  YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS,
  YOUTH_UPDATE_INSIDE_AUTHOR_SLOT_DEFAULTS,
  YOUTH_UPDATE_PUBLISHER_ID,
} from "@/engines/MasterPage/YouthUpdateConfig";
import type { YouthUpdateInsideAuthor } from "@/engines/MasterPage/YouthUpdateInsideTeaserGeometry";

export type YouthUpdateInsideAuthorSlots = [YouthUpdateInsideAuthor, YouthUpdateInsideAuthor, YouthUpdateInsideAuthor];

type YouthUpdateInsideAuthorState = {
  authors: YouthUpdateInsideAuthorSlots | null;
  setAuthors: (authors: YouthUpdateInsideAuthorSlots) => void;
};

export const useYouthUpdateInsideAuthorStore = create<YouthUpdateInsideAuthorState>((set) => ({
  authors: null,
  setAuthors: (authors) => set({ authors }),
}));

const FALLBACK_AUTHORS = YOUTH_UPDATE_INSIDE_AUTHOR_SLOT_DEFAULTS.map((author) => ({ ...author })) as YouthUpdateInsideAuthorSlots;

const authorIndexForPage = (pageNumber?: number) => {
  const normalized = Number.isFinite(pageNumber) ? Math.max(2, Math.floor(pageNumber ?? 2)) : 2;
  const seed = normalized * 137 + 101;
  const pseudoRandom = Math.abs(Math.sin(seed) * 10000);
  return Math.floor(pseudoRandom) % 3;
};

export const useYouthUpdateInsideAuthor = (pageNumber?: number): YouthUpdateInsideAuthor =>
  useYouthUpdateInsideAuthorStore((state) => state.authors)?.[authorIndexForPage(pageNumber)] ??
  FALLBACK_AUTHORS[authorIndexForPage(pageNumber)];

export const getYouthUpdateInsideAuthorOrFallback = (pageNumber?: number): YouthUpdateInsideAuthor =>
  (useYouthUpdateInsideAuthorStore.getState().authors ?? FALLBACK_AUTHORS)[authorIndexForPage(pageNumber)];

type PortalInsideAuthorRow = {
  slot_index?: number;
  image_url?: string;
  editor_name?: string;
  designation?: string;
};

type PortalInsideAuthorResponse = {
  authors?: PortalInsideAuthorRow[];
  image_url?: string;
  editor_name?: string;
  designation?: string;
};

let loadedKey: string | null = null;
let inFlightLoad: Promise<YouthUpdateInsideAuthorSlots | null> | null = null;

const normalizePortalAuthors = (body: PortalInsideAuthorResponse): YouthUpdateInsideAuthorSlots => {
  const bySlot = new Map((body.authors ?? []).map((author) => [author.slot_index, author]));
  return [1, 2, 3].map((slotIndex) => {
    const saved = bySlot.get(slotIndex);
    const fallback = YOUTH_UPDATE_INSIDE_AUTHOR_SLOT_DEFAULTS[slotIndex - 1] ?? YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS;
    return {
      imageUrl: saved?.image_url?.trim() || (slotIndex === 1 ? body.image_url?.trim() : "") || fallback.imageUrl,
      name: saved?.editor_name?.trim() || (slotIndex === 1 ? body.editor_name?.trim() : "") || fallback.name,
      designation:
        saved?.designation?.trim() || (slotIndex === 1 ? body.designation?.trim() : "") || fallback.designation,
    };
  }) as YouthUpdateInsideAuthorSlots;
};

export const loadYouthUpdateInsideAuthorsFromPortal = async ({
  apiBase,
  authToken,
  publisherId,
  force = false,
}: {
  apiBase: string;
  authToken: string;
  publisherId: string;
  force?: boolean;
}): Promise<YouthUpdateInsideAuthorSlots | null> => {
  if (publisherId !== YOUTH_UPDATE_PUBLISHER_ID || !authToken || !apiBase) return null;

  const key = `${apiBase}|${publisherId}|${authToken}`;
  if (!force && loadedKey === key && useYouthUpdateInsideAuthorStore.getState().authors) {
    return useYouthUpdateInsideAuthorStore.getState().authors;
  }
  if (!force && inFlightLoad) return inFlightLoad;

  inFlightLoad = (async () => {
    try {
      const response = await fetch(`${apiBase}/publisher/youth-update-inside-author/${publisherId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return null;

      const slots = normalizePortalAuthors((await response.json()) as PortalInsideAuthorResponse);
      useYouthUpdateInsideAuthorStore.getState().setAuthors(slots);
      loadedKey = key;
      return slots;
    } catch {
      return null;
    } finally {
      inFlightLoad = null;
    }
  })();

  return inFlightLoad;
};
