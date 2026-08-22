import type {
  StoryHierarchyVisualStyle,
  StoryPriority,
  StoryTypographySettings,
} from "@/types/editor";

const priorityStyles: Record<StoryPriority, StoryHierarchyVisualStyle> = {
  lead: {
    // Lead story: 44pt headline, body font size ~9.6pt
    headlineSize: 44,
    subheadlineSize: 16,
    bodySize: 9.6,
    showSubheadline: true,
    minimumHeight: 560,
  },
  major: {
    // Major stories: 28pt headline, body font size ~9.3pt
    headlineSize: 28,
    subheadlineSize: 14,
    bodySize: 9.3,
    showSubheadline: true,
    minimumHeight: 380,
  },
  secondary: {
    // Secondary: 20pt headline, body font size ~9.0pt
    headlineSize: 20,
    subheadlineSize: 12.5,
    bodySize: 9.0,
    showSubheadline: false,
    minimumHeight: 270,
  },
  brief: {
    // Brief: 14pt headline, body font size ~8.8pt
    headlineSize: 14,
    subheadlineSize: 0,
    bodySize: 8.8,
    showSubheadline: false,
    minimumHeight: 150,
  },
  filler: {
    headlineSize: 12,
    subheadlineSize: 0,
    bodySize: 8.5,
    showSubheadline: false,
    minimumHeight: 100,
  },
};


export const getStoryHierarchyStyle = (priority: StoryPriority): StoryHierarchyVisualStyle => ({
  ...priorityStyles[priority],
});

export const getDefaultStoryTypographySettings = (
  priority: StoryPriority,
): StoryTypographySettings => {
  const style = priorityStyles[priority];
  const subheadlineFontSize = Math.max(10, style.subheadlineSize);

  // Devanagari Newspaper Leading Standard:
  //   Headlines: 1.28× (clearance for top matras)
  //   Subheadlines: 1.25×
  //   Body: 1.38× (prevents Devanagari upper matras from touching upper descenders)
  const headlineLeading = style.headlineSize * 1.28;
  const subheadlineLeading = subheadlineFontSize * 1.25;
  const bodyLeading = style.bodySize * 1.38;

  if (priority === "lead") {
    return {
      headlineFontSize: style.headlineSize,
      subheadlineFontSize,
      bodyFontSize: style.bodySize,
      headlineLineHeight: 1.28,
      subheadlineLineHeight: 1.25,
      bodyLineHeight: 1.38,
      headlineLineHeightMode: "auto",
      subheadlineLineHeightMode: "auto",
      bodyLineHeightMode: "auto",
      headlineLeadingValue: headlineLeading,
      subheadlineLeadingValue: subheadlineLeading,
      bodyLeadingValue: bodyLeading,
      headlineWeight: "900",
      subheadlineWeight: "600",
      autoFitHeadline: true,
      autoBalanceHeadline: true,
      enableHyphenation: false,
      forceFullWidthHeadlines: false,
      headlineLayoutMode: "newspaper-fill",
    };
  }

  if (priority === "major") {
    return {
      headlineFontSize: style.headlineSize,
      subheadlineFontSize,
      bodyFontSize: style.bodySize,
      headlineLineHeight: 1.28,
      subheadlineLineHeight: 1.25,
      bodyLineHeight: 1.38,
      headlineLineHeightMode: "auto",
      subheadlineLineHeightMode: "auto",
      bodyLineHeightMode: "auto",
      headlineLeadingValue: headlineLeading,
      subheadlineLeadingValue: subheadlineLeading,
      bodyLeadingValue: bodyLeading,
      headlineWeight: "800",
      subheadlineWeight: "500",
      // Phase 1.6: only "lead" gets autoFit so its headline can grow to
      // dominate the page. Non-lead stories stay pinned to their fixed
      // hierarchy size so the main headline appears only in the main section.
      autoFitHeadline: false,
      autoBalanceHeadline: true,
      enableHyphenation: false,
      forceFullWidthHeadlines: false,
      headlineLayoutMode: "newspaper-fill",
    };
  }

  if (priority === "secondary") {
    return {
      headlineFontSize: style.headlineSize,
      subheadlineFontSize,
      bodyFontSize: style.bodySize,
      headlineLineHeight: 1.28,
      subheadlineLineHeight: 1.25,
      bodyLineHeight: 1.38,
      headlineLineHeightMode: "auto",
      subheadlineLineHeightMode: "auto",
      bodyLineHeightMode: "auto",
      headlineLeadingValue: headlineLeading,
      subheadlineLeadingValue: subheadlineLeading,
      bodyLeadingValue: bodyLeading,
      headlineWeight: "700",
      subheadlineWeight: "400",
      autoFitHeadline: false,
      autoBalanceHeadline: true,
      enableHyphenation: false,
      forceFullWidthHeadlines: false,
      headlineLayoutMode: "newspaper-fill",
    };
  }

  return {
    headlineFontSize: style.headlineSize,
    subheadlineFontSize,
    bodyFontSize: style.bodySize,
    headlineLineHeight: 1.28,
    subheadlineLineHeight: 1.25,
    bodyLineHeight: 1.38,
    headlineLineHeightMode: "auto",
    subheadlineLineHeightMode: "auto",
    bodyLineHeightMode: "auto",
    headlineLeadingValue: headlineLeading,
    subheadlineLeadingValue: subheadlineLeading,
    bodyLeadingValue: bodyLeading,
    headlineWeight: "600",
    subheadlineWeight: "400",
    autoFitHeadline: false,
    autoBalanceHeadline: true,
    enableHyphenation: false,
    forceFullWidthHeadlines: false,
    headlineLayoutMode: "newspaper-fill",
  };
};


export const getPriorityDisplayName = (priority: StoryPriority) => {
  const labels: Record<StoryPriority, string> = {
    lead: "Lead Story",
    major: "Major Story",
    secondary: "Secondary Story",
    brief: "Brief Story",
    filler: "Filler Story",
  };

  return labels[priority];
};

export const STORY_HIERARCHY_STYLE_TABLE = priorityStyles;
