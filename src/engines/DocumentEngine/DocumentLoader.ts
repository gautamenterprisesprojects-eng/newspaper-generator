import type { NewspaperDocument } from "@/types/document";
import { createDocument } from "./DocumentEngine";
import { parseDocumentPayload } from "./DocumentSerializer";

export const loadDocument = (payload: string): NewspaperDocument => {
  const parsed = parseDocumentPayload(payload);
  const defaults = createDocument();

  return {
    ...defaults,
    ...parsed.document,
    metadata: {
      ...defaults.metadata,
      ...parsed.document.metadata,
    },
    pages: parsed.document.pages.length > 0 ? parsed.document.pages : defaults.pages,
    stories: parsed.document.stories ?? {},
    assets: parsed.document.assets ?? {},
  };
};
