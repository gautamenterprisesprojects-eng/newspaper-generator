import type {
  EditorObjectType,
  EditorialJustifyEngineMode,
  EditorialJustifyMode,
  EditorialTextAlignment,
  EditorialVerticalAlignment,
  UniversalTypographyControls,
} from "@/types/editor";

export type ObjectParagraphStyleBinding = {
  objectType: EditorObjectType;
  alignmentKey?: keyof UniversalTypographyControls;
  verticalAlignmentKey?: keyof UniversalTypographyControls;
  justifyModeKey?: keyof UniversalTypographyControls;
  justifyEngineModeKey?: keyof UniversalTypographyControls;
  trackingKey?: keyof UniversalTypographyControls;
  letterSpacingKey?: keyof UniversalTypographyControls;
  supportsJustify: boolean;
  supportsParagraphSpacing: boolean;
  supportsColumns: boolean;
};

const bindings: Partial<Record<EditorObjectType, ObjectParagraphStyleBinding>> = {
  headline: {
    objectType: "headline",
    alignmentKey: "headlineAlignment",
    verticalAlignmentKey: "headlineVerticalAlignment",
    trackingKey: "headlineTracking",
    letterSpacingKey: "headlineLetterSpacing",
    supportsJustify: false,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  subheadline: {
    objectType: "subheadline",
    alignmentKey: "subheadlineAlignment",
    verticalAlignmentKey: "subheadlineVerticalAlignment",
    justifyModeKey: "subheadlineJustifyMode",
    justifyEngineModeKey: "subheadlineJustifyEngineMode",
    trackingKey: "subheadlineTracking",
    letterSpacingKey: "subheadlineLetterSpacing",
    supportsJustify: true,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  body: {
    objectType: "body",
    alignmentKey: "bodyAlignment",
    justifyModeKey: "bodyJustifyMode",
    justifyEngineModeKey: "bodyJustifyEngineMode",
    trackingKey: "bodyTracking",
    letterSpacingKey: "bodyLetterSpacing",
    supportsJustify: true,
    supportsParagraphSpacing: true,
    supportsColumns: true,
  },
  caption: {
    objectType: "caption",
    alignmentKey: "captionAlignment",
    justifyModeKey: "captionJustifyMode",
    justifyEngineModeKey: "captionJustifyEngineMode",
    trackingKey: "captionTracking",
    letterSpacingKey: "captionLetterSpacing",
    supportsJustify: true,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  credit: {
    objectType: "credit",
    alignmentKey: "creditAlignment",
    justifyModeKey: "creditJustifyMode",
    justifyEngineModeKey: "creditJustifyEngineMode",
    supportsJustify: true,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  source: {
    objectType: "source",
    alignmentKey: "sourceAlignment",
    justifyModeKey: "sourceJustifyMode",
    justifyEngineModeKey: "sourceJustifyEngineMode",
    supportsJustify: true,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  factBoxHeading: {
    objectType: "factBoxHeading",
    alignmentKey: "factBoxHeadlineAlignment",
    supportsJustify: false,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  factBoxContent: {
    objectType: "factBoxContent",
    alignmentKey: "factBoxContentAlignment",
    justifyModeKey: "factBoxContentJustifyMode",
    justifyEngineModeKey: "factBoxContentJustifyEngineMode",
    supportsJustify: true,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
  pullQuote: {
    objectType: "pullQuote",
    alignmentKey: "pullQuoteAlignment",
    verticalAlignmentKey: "pullQuoteVerticalAlignment",
    supportsJustify: false,
    supportsParagraphSpacing: false,
    supportsColumns: false,
  },
};

export const getObjectParagraphStyleBinding = (
  objectType: EditorObjectType,
): ObjectParagraphStyleBinding => bindings[objectType] ?? {
  objectType,
  supportsJustify: false,
  supportsParagraphSpacing: false,
  supportsColumns: false,
};

export const getObjectAlignment = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
): EditorialTextAlignment => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.alignmentKey
    ? (typography[binding.alignmentKey] as EditorialTextAlignment)
    : "left";
};

export const setObjectAlignment = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
  alignment: EditorialTextAlignment,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  if (!binding.alignmentKey) {
    return {};
  }

  const nextAlignment = !binding.supportsJustify && alignment === "justify" ? "left" : alignment;

  return {
    [binding.alignmentKey]: nextAlignment,
  } as Partial<UniversalTypographyControls>;
};

export const getObjectVerticalAlignment = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
): EditorialVerticalAlignment => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.verticalAlignmentKey
    ? (typography[binding.verticalAlignmentKey] as EditorialVerticalAlignment)
    : "top";
};

export const setObjectVerticalAlignment = (
  objectType: EditorObjectType,
  verticalAlignment: EditorialVerticalAlignment,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.verticalAlignmentKey
    ? ({ [binding.verticalAlignmentKey]: verticalAlignment } as Partial<UniversalTypographyControls>)
    : {};
};

export const getObjectJustifyMode = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
): EditorialJustifyMode => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.justifyModeKey
    ? (typography[binding.justifyModeKey] as EditorialJustifyMode)
    : typography.bodyJustifyMode;
};

export const setObjectJustifyMode = (
  objectType: EditorObjectType,
  justifyMode: EditorialJustifyMode,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.justifyModeKey
    ? ({ [binding.justifyModeKey]: justifyMode } as Partial<UniversalTypographyControls>)
    : {};
};

export const getObjectJustifyEngineMode = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
): EditorialJustifyEngineMode => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.justifyEngineModeKey
    ? (typography[binding.justifyEngineModeKey] as EditorialJustifyEngineMode)
    : typography.bodyJustifyEngineMode;
};

export const setObjectJustifyEngineMode = (
  objectType: EditorObjectType,
  justifyEngineMode: EditorialJustifyEngineMode,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.justifyEngineModeKey
    ? ({ [binding.justifyEngineModeKey]: justifyEngineMode } as Partial<UniversalTypographyControls>)
    : {};
};

export const getObjectLetterSpacing = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
) => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.letterSpacingKey
    ? (typography[binding.letterSpacingKey] as number)
    : 0;
};

export const getObjectTracking = (
  typography: UniversalTypographyControls,
  objectType: EditorObjectType,
) => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.trackingKey
    ? (typography[binding.trackingKey] as number)
    : 0;
};

export const setObjectTracking = (
  objectType: EditorObjectType,
  tracking: number,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.trackingKey
    ? ({ [binding.trackingKey]: tracking } as Partial<UniversalTypographyControls>)
    : {};
};

export const setObjectLetterSpacing = (
  objectType: EditorObjectType,
  letterSpacing: number,
): Partial<UniversalTypographyControls> => {
  const binding = getObjectParagraphStyleBinding(objectType);

  return binding.letterSpacingKey
    ? ({ [binding.letterSpacingKey]: letterSpacing } as Partial<UniversalTypographyControls>)
    : {};
};
