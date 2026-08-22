import { measureParagraph } from "@/engines/TypographyEngine/TypographyEngine";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import type { TextMeasureOptions, TypographyResult } from "@/engines/TypographyEngine/TypographyTypes";
import type { ArticleTextStyle } from "@/types/editor";

export type BylineMetadata = {
  author?: string;
  location?: string;
  agency?: string;
};

export type BylineInput = BylineMetadata & {
  width: number;
};

export type BylineComposition = {
  text: string;
  style: ArticleTextStyle;
  metrics: TypographyResult;
};

export const BYLINE_SEPARATOR = " \u2022 ";

export const bylineStyle: ArticleTextStyle = {
  fill: "#3f3a34",
  fontFamily: getNewspaperFontStack("sans"),
  fontSize: 9.6,
  fontStyle: "600",
  lineHeight: 1.2,
  wrap: "none",
};

const normalizePart = (value?: string) => value?.replace(/\s+/gu, " ").trim() ?? "";

export const formatByline = ({ author, location, agency }: BylineMetadata) => {
  const normalizedLocation = normalizePart(location);
  const normalizedAuthor = normalizePart(author);
  const normalizedAgency = normalizePart(agency);
  const credit =
    normalizedAuthor && normalizedAgency
      ? `${normalizedAuthor}, ${normalizedAgency}`
      : normalizedAuthor || normalizedAgency;

  return [credit, normalizedLocation].filter(Boolean).join(BYLINE_SEPARATOR);
};

export const composeByline = (
  input: BylineInput,
  options?: TextMeasureOptions,
): BylineComposition => {
  const text = formatByline(input);
  const metrics = measureParagraph(
    {
      text,
      width: Math.max(1, input.width),
      fontFamily: bylineStyle.fontFamily,
      fontSize: bylineStyle.fontSize,
      lineHeight: bylineStyle.lineHeight,
      maxLines: 1,
      script: "mixed",
    },
    options,
  );

  return {
    text,
    style: bylineStyle,
    metrics,
  };
};

export const BylineEngine = {
  composeByline,
  formatByline,
};
