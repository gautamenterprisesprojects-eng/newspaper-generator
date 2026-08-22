import type { RichTextContent, RichTextDocument } from "@/types/RichText";
import { normalizeRichText } from "./RichTextUtils";

export const parseRichText = (value: RichTextContent | unknown): RichTextDocument =>
  normalizeRichText(value);

export const RichTextParser = {
  parseRichText,
};
