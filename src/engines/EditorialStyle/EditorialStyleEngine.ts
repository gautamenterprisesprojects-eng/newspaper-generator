import type { ArticleTextStyle, StoryPriority, StoryTypographyWeight } from "@/types/editor";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

export type EditorialStyleInput = {
  priority: StoryPriority;
  headlineSize: number;
  subheadlineSize: number;
  bodySize: number;
  headlineLineHeight?: number;
  subheadlineLineHeight?: number;
  bodyLineHeight?: number;
  headlineWeight?: StoryTypographyWeight;
  subheadlineWeight?: StoryTypographyWeight;
  /**
   * Overrides the body's default font family (baseSans) when set. Every
   * existing caller omits this and gets today's exact font -- it exists so
   * English-language stories can opt into a proper English newspaper serif
   * instead of the Devanagari-tuned sans stack, without changing anything
   * for Hindi content. See composeArticleBox.ts's contentLanguage check.
   */
  bodyFontFamily?: string;
};

export type EditorialRuleStyle = {
  stroke: string;
  strokeWidth: number;
};

export type EditorialStyleSet = {
  headline: ArticleTextStyle;
  subheadline: ArticleTextStyle;
  dateline: ArticleTextStyle;
  reporter: ArticleTextStyle;
  body: ArticleTextStyle;
  caption: ArticleTextStyle;
  separatorRule: EditorialRuleStyle;
};

const baseSans = getNewspaperFontStack("sans");
const baseSerif = getNewspaperFontStack("serif");

/**
 * English newspaper body serif (Tinos, a Times New Roman metric clone,
 * registered in globals.css) -- baseSans's Latin glyphs come from the
 * Devanagari-tuned Noto Sans stack, which justifies English narrow-column
 * copy with visibly wide, uneven word-gaps (no hyphenation, wide default
 * character widths). Only ever used when a story's contentLanguage is
 * explicitly "english" (see composeArticleBox.ts) -- Hindi/Devanagari body
 * copy always keeps baseSans, completely unaffected by this constant
 * existing.
 */
export const ENGLISH_NEWSPAPER_BODY_FONT_FAMILY = `"Tinos", Georgia, "Times New Roman", serif`;

const getHeadlineWeight = (priority: StoryPriority) => {
  if (priority === "lead") {
    return "900";
  }

  if (priority === "major") {
    return "800";
  }

  if (priority === "secondary") {
    return "700";
  }

  return "600";
};

const getHeadlineLineHeight = (priority: StoryPriority) => {
  if (priority === "lead") return 1.25;
  if (priority === "major") return 1.26;
  if (priority === "secondary") return 1.28;

  return 1.3;
};

export const createEditorialStyles = ({
  priority,
  headlineSize,
  subheadlineSize,
  bodySize,
  headlineLineHeight,
  subheadlineLineHeight,
  bodyLineHeight,
  headlineWeight,
  subheadlineWeight,
  bodyFontFamily,
}: EditorialStyleInput): EditorialStyleSet => ({
  headline: {
    fill: "#11100d",
    fontFamily: baseSerif,
    fontSize: headlineSize,
    fontStyle: headlineWeight ?? getHeadlineWeight(priority),
    letterSpacing: 0,
    lineHeight: headlineLineHeight ?? getHeadlineLineHeight(priority),
    wrap: "none",
  },
  subheadline: {
    fill: "#3f3a34",
    fontFamily: baseSans,
    fontSize: subheadlineSize,
    fontStyle: subheadlineWeight ?? (priority === "lead" ? "600" : "normal"),
    letterSpacing: 0,
    lineHeight: subheadlineLineHeight ?? 1,
    wrap: "none",
  },
  dateline: {
    fill: "#181512",
    fontFamily: baseSans,
    fontSize: 9,
    fontStyle: "bold",
    letterSpacing: 0,
    lineHeight: 1,
    wrap: "none",
  },
  reporter: {
    fill: "#4c453d",
    fontFamily: baseSans,
    fontSize: Math.max(8.4, bodySize * 0.72),
    fontStyle: "600",
    letterSpacing: 0,
    lineHeight: 1.15,
    wrap: "none",
  },
  body: {
    fill: "#29251f",
    fontFamily: bodyFontFamily ?? baseSans,
    fontSize: bodySize,
    letterSpacing: 0,
    lineHeight: bodyLineHeight ?? 1.35,
    wrap: "none",
  },
  caption: {
    fill: "#4f4a43",
    fontFamily: baseSans,
    fontSize: Math.min(9, Math.max(8.5, bodySize * 0.72)),
    fontStyle: "normal",
    letterSpacing: 0,
    lineHeight: 1.12,
    wrap: "none",
  },
  separatorRule: {
    stroke: "#3a352f",
    strokeWidth: priority === "lead" ? 1.0 : 0.75,
  },
});

export const getPageSeparatorRuleStyle = (): EditorialRuleStyle => ({
  stroke: "#29251f",
  strokeWidth: 0.75,
});

export const EditorialStyleEngine = {
  createEditorialStyles,
  getPageSeparatorRuleStyle,
};
