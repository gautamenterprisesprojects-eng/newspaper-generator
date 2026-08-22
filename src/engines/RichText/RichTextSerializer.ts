import type { RichTextContent, RichTextDocument } from "@/types/RichText";
import { normalizeRichText, richTextToPlainText } from "./RichTextUtils";

export const serializeRichTextToPlainText = (value: RichTextContent): string =>
  richTextToPlainText(value);

export const serializeRichTextToJSON = (value: RichTextContent): RichTextDocument =>
  normalizeRichText(value);

export const RichTextSerializer = {
  serializeRichTextToJSON,
  serializeRichTextToPlainText,
};
