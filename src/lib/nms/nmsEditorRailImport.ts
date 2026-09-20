import type { NewswireStory } from "@/lib/newswire";
import { EDITOR_RAIL_FRONT_TEMPLATE_ID } from "@/engines/MasterPage/YouthUpdateConfig";

export const NMS_EDITOR_RAIL_ARTICLE_STORY_NUMBERS = [2, 9, 3, 4, 5, 6, 7, 8] as const;

const buildEditorRailFurnitureStory = (): NewswireStory => ({
  id: "nms-editor-rail-furniture",
  language: "hindi",
  category: "NMS Furniture",
  headline: "संपादकीय परिचय",
  subheadline: "",
  body: "संपादकीय परिचय के लिए आरक्षित स्थान।",
  shortBody: "संपादकीय परिचय के लिए आरक्षित स्थान।",
  mediumBody: "संपादकीय परिचय के लिए आरक्षित स्थान।",
  longBody: "संपादकीय परिचय के लिए आरक्षित स्थान।",
  summary: [],
  caption: "",
  imageCaption: "",
  imageUrl: "",
  place: "",
  sourceTitle: "NMS",
  sourceUrl: "",
  publishedAt: null,
  bylineName: "",
  manualPinned: true,
  manualTargetStoryNumber: 1,
});

/**
 * The editor-rail template has nine layout slots but only eight news boxes.
 * Reserve story 1 for its fixed artwork and pin each planned article to a
 * visible slot so rank-based layout fitting cannot hide a bundle article.
 */
export const prepareNmsEditorRailImportStories = (
  stories: NewswireStory[],
  templateId: string,
): NewswireStory[] => {
  if (templateId !== EDITOR_RAIL_FRONT_TEMPLATE_ID) return stories;

  const printableStories = stories.slice(0, NMS_EDITOR_RAIL_ARTICLE_STORY_NUMBERS.length);
  return [
    buildEditorRailFurnitureStory(),
    ...printableStories.map((story, index) => ({
      ...story,
      manualPinned: true,
      manualTargetStoryNumber: NMS_EDITOR_RAIL_ARTICLE_STORY_NUMBERS[index],
    })),
  ];
};
