import type { ArticleTextStyle } from "@/types/editor";
import type { RichTextSpan } from "@/types/RichText";

const isRenderableColor = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim() !== "transparent";

export const applyRichTextColorStyle = (
  baseStyle: ArticleTextStyle,
  span: RichTextSpan,
): ArticleTextStyle => ({
  ...baseStyle,
  fill: isRenderableColor(span.color) ? span.color : baseStyle.fill,
    backgroundColor: isRenderableColor(span.backgroundColor)
    ? span.backgroundColor
    : baseStyle.backgroundColor,
  opacity: typeof span.opacity === "number" ? span.opacity : baseStyle.opacity,
});

export const hasRichTextColorStyle = (span: RichTextSpan) =>
  isRenderableColor(span.color) || isRenderableColor(span.backgroundColor);

export const RichTextColorRenderingEngine = {
  applyRichTextColorStyle,
  hasRichTextColorStyle,
};
