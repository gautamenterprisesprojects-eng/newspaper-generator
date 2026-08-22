import { NEWSPAPER_PAGE, PAGE_MARGIN } from "@/utils/page";
import { editorialTemplates } from "./EditorialTemplates";
import type {
  EditorialTemplate,
  EditorialTemplateDefinition,
  EditorialTemplateRole,
  EditorialTemplateSlot,
  EditorialTemplateVariant,
} from "./EditorialTemplateTypes";

const COLUMN_COUNT = 6;
const variants: EditorialTemplateVariant[] = ["A", "B", "C"];

export const getEditorialRoleForStoryIndex = (storyIndex: number): EditorialTemplateRole => {
  if (storyIndex === 0) {
    return "lead";
  }

  if (storyIndex <= 2) {
    return "major";
  }

  if (storyIndex <= 5) {
    return "medium";
  }

  return "brief";
};

const buildSlots = ({
  definition,
  pageWidth,
  pageHeight,
  pageMargin,
}: {
  definition: EditorialTemplateDefinition;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
}): EditorialTemplateSlot[] => {
  const contentWidth = pageWidth - pageMargin * 2;
  const contentHeight = pageHeight - pageMargin * 2;
  const columnWidth = contentWidth / COLUMN_COUNT;

  return definition.slots.map((slot, index) => {
    return {
      id: slot.slotId,
      x: pageMargin + slot.columnStart * columnWidth,
      y: pageMargin + contentHeight * (slot.yPercent / 100),
      width: slot.columnSpan * columnWidth,
      height: contentHeight * (slot.heightPercent / 100),
      role: getEditorialRoleForStoryIndex(index),
      hasImage: slot.hasImage,
    };
  });
};

export const getEditorialTemplates = (storyCount: number): EditorialTemplate[] =>
  editorialTemplates
    .filter((definition) => definition.storyCount === storyCount)
    .map((definition) => ({
      storyCount: definition.storyCount,
      variant: definition.variant,
      name: definition.name,
      pageWidth: NEWSPAPER_PAGE.width,
      pageHeight: NEWSPAPER_PAGE.height,
      pageMargin: PAGE_MARGIN,
      slots: buildSlots({
        definition,
        pageWidth: NEWSPAPER_PAGE.width,
        pageHeight: NEWSPAPER_PAGE.height,
        pageMargin: PAGE_MARGIN,
      }),
    }));

export const getEditorialTemplate = ({
  storyCount,
  variant,
}: {
  storyCount: number;
  variant?: EditorialTemplateVariant;
}): EditorialTemplate | null => {
  const templates = getEditorialTemplates(storyCount);

  if (templates.length === 0) {
    return null;
  }

  if (variant) {
    return templates.find((template) => template.variant === variant) ?? null;
  }

  return templates[(storyCount - 5) % variants.length];
};

export const getSupportedEditorialTemplateCounts = () =>
  Array.from(new Set(editorialTemplates.map((template) => template.storyCount))).sort(
    (first, second) => first - second,
  );

export const EditorialTemplateEngine = {
  getEditorialRoleForStoryIndex,
  getEditorialTemplate,
  getEditorialTemplates,
  getSupportedEditorialTemplateCounts,
};
