import { create } from "zustand";

export type PublisherEditorialAuthorDefaults = {
  name: string;
  imageUrl: string;
};

export type PublisherEditorialAuthor = PublisherEditorialAuthorDefaults & {
  id: string;
};

type PublisherEditorialAuthorStore = {
  defaults: PublisherEditorialAuthorDefaults | null;
  authors: PublisherEditorialAuthor[];
  selectedAuthors: [
    PublisherEditorialAuthorDefaults | null,
    PublisherEditorialAuthorDefaults | null,
  ];
  setDefaults: (defaults: PublisherEditorialAuthorDefaults | null) => void;
  setAuthors: (authors: PublisherEditorialAuthorDefaults[]) => void;
  selectAuthor: (id: string) => void;
  selectAuthorForRail: (railIndex: 0 | 1, id: string) => void;
};

const normalizeAuthor = (author: PublisherEditorialAuthorDefaults, index: number): PublisherEditorialAuthor => ({
  id: `${index}-${author.name || "author"}`,
  name: author.name.trim(),
  imageUrl: author.imageUrl.trim(),
});

export const usePublisherEditorialAuthorStore = create<PublisherEditorialAuthorStore>((set) => ({
  defaults: null,
  authors: [],
  selectedAuthors: [null, null],
  setDefaults: (defaults) => set({
    defaults,
    authors: defaults ? [normalizeAuthor(defaults, 0)] : [],
    selectedAuthors: defaults ? [defaults, defaults] : [null, null],
  }),
  setAuthors: (authors) => {
    const normalized = authors
      .map(normalizeAuthor)
      .filter((author) => author.name || author.imageUrl);
    const first = normalized[0] ? { name: normalized[0].name, imageUrl: normalized[0].imageUrl } : null;
    const second = normalized[1]
      ? { name: normalized[1].name, imageUrl: normalized[1].imageUrl }
      : first;
    set({
      authors: normalized,
      defaults: first,
      selectedAuthors: [first, second],
    });
  },
  selectAuthor: (id) =>
    set((state) => {
      const author = state.authors.find((candidate) => candidate.id === id);
      if (!author) {
        return {};
      }
      const defaults = { name: author.name, imageUrl: author.imageUrl };
      return { defaults, selectedAuthors: [defaults, state.selectedAuthors[1] ?? defaults] };
    }),
  selectAuthorForRail: (railIndex, id) =>
    set((state) => {
      const author = state.authors.find((candidate) => candidate.id === id);
      if (!author) {
        return {};
      }
      const selectedAuthors: PublisherEditorialAuthorStore["selectedAuthors"] = [...state.selectedAuthors];
      selectedAuthors[railIndex] = { name: author.name, imageUrl: author.imageUrl };
      return {
        selectedAuthors,
        defaults: selectedAuthors[0] ?? state.defaults,
      };
    }),
}));
