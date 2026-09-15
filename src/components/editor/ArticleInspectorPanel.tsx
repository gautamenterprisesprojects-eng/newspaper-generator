"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Box,
  ChevronDown,
  ChevronRight,
  Droplet,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Layers,
  LayoutPanelTop,
  LetterText,
  PaintBucket,
  Pilcrow,
  Quote,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Type,
  Underline,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type {
  ArticleCaptionData,
  ArticleCompositionMetrics,
  ArticleCompositionSettings,
  ArticleData,
  CaptionPosition,
  EditorPerformanceDiagnostics,
  EditorObjectType,
  HeadlineLayoutMode,
  ObjectContainerStyle,
  StoryColumnSpan,
  StoryFrame,
  StoryHierarchyVisualStyle,
  StoryImageAlignment,
  StoryImageSettings,
  StoryImageShapePoint,
  StoryImageShapeType,
  StoryImageWrapMode,
  StoryLineHeightMode,
  StoryTypographySettings,
  StoryTypographyWeight,
  TypographyEditingScope,
  UniversalTypographyControls,
  HyphenationJustificationPresetName,
} from "@/types/editor";
import type { RichTextContent, RichTextStyle } from "@/types/RichText";
import type { PageLayoutDiagnostics } from "@/engines/TemplateLayout/TemplateTypes";
import type { StoryDominanceMetrics } from "@/engines/StorySpan/StorySpanEngine";
import type {
  FrameAlignment,
  FrameAlignmentTarget,
  FrameDistributionAxis,
} from "@/engines/FrameLayout/FrameLayoutInteractionTypes";
import type { PageMaster, PageType } from "@/types/page";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import {
  getObjectAlignment,
  getObjectJustifyEngineMode,
  getObjectJustifyMode,
  getObjectLetterSpacing,
  getObjectParagraphStyleBinding,
  getObjectTracking,
  getObjectVerticalAlignment,
  setObjectAlignment,
  setObjectJustifyEngineMode,
  setObjectJustifyMode,
  setObjectLetterSpacing,
  setObjectTracking,
  setObjectVerticalAlignment,
} from "@/engines/ObjectParagraphStyles/ObjectParagraphStyleEngine";
import type { FontManagerState } from "@/engines/FontManager/FontManagerTypes";
import { FontDiagnosticsPanel } from "./FontDiagnosticsPanel";
import { ProfessionalColorPicker } from "./ProfessionalColorPicker";
import {
  normalizeParagraphTypography,
  updateParagraphFormatting,
} from "@/engines/ParagraphTypography/ParagraphTypographyEngine";
import {
  applyHyphenationJustificationPreset,
} from "@/engines/UniversalTypography/UniversalTypographyEngine";

const hjPresetOptions: Array<{ value: HyphenationJustificationPresetName; label: string }> = [
  { value: "newspaper-hindi-body", label: "Newspaper Hindi Body" },
  { value: "newspaper-english-body", label: "Newspaper English Body" },
  { value: "compact-narrow-column", label: "Compact Narrow Column" },
  { value: "relaxed-wide-column", label: "Relaxed Wide Column" },
  { value: "custom", label: "Custom" },
];

type ArticleInspectorPanelProps = {
  articleData: ArticleData;
  compositionSettings: ArticleCompositionSettings;
  metrics: ArticleCompositionMetrics;
  storyId: string;
  interactionMode: "frame" | "content";
  breadcrumb?: string[];
  frameSummary?: {
    frameLabel: string;
    storyTitle: string;
    pageNumber: number | null;
    layer: number | null;
    status: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageMaster: PageMaster;
  pageType: PageType;
  storyPriority: StoryFrame["priority"];
  storyColumnSpan: StoryColumnSpan;
  priorityStyle: StoryHierarchyVisualStyle;
  imageSettings: StoryImageSettings;
  typographySettings: StoryTypographySettings;
  storyHeight: number;
  pageDiagnostics: PageLayoutDiagnostics;
  dominanceMetrics: StoryDominanceMetrics;
  performanceDiagnostics: EditorPerformanceDiagnostics;
  fontManager: FontManagerState;
  selectedParagraphIndex: number;
  paragraphCount: number;
  typographyEditingScope: TypographyEditingScope;
  onArticleChange: <Key extends keyof ArticleData>(key: Key, value: ArticleData[Key]) => void;
  onCompositionChange: <Key extends keyof ArticleCompositionSettings>(
    key: Key,
    value: ArticleCompositionSettings[Key],
  ) => void;
  onImageSettingsChange: <Key extends keyof StoryImageSettings>(
    key: Key,
    value: StoryImageSettings[Key],
  ) => void;
  onTypographySettingsChange: <Key extends keyof StoryTypographySettings>(
    key: Key,
    value: StoryTypographySettings[Key],
  ) => void;
  onResetTypography: () => void;
  onPageTypeChange: (pageType: PageType) => void;
  onStoryPriorityChange: (priority: StoryFrame["priority"]) => void;
  onStoryColumnSpanChange: (columnSpan: StoryColumnSpan) => void;
  onAlignFrames: (alignment: FrameAlignment, target: FrameAlignmentTarget) => void;
  onDistributeFrames: (axis: FrameDistributionAxis) => void;
  selectedObjectType: EditorObjectType;
  onSelectedObjectTypeChange: (objectType: EditorObjectType) => void;
  onSelectedParagraphIndexChange: (index: number) => void;
  onTypographyEditingScopeChange: (scope: TypographyEditingScope) => void;
};

type InspectorObjectType = EditorObjectType;

type InspectorGroupId =
  | "fonts"
  | "typography"
  | "color"
  | "frame"
  | "hj"
  | "paragraph"
  | "layout"
  | "effects"
  | "image"
  | "spacing"
  | "advanced";

type TextFieldKey =
  | "headline"
  | "subheadline"
  | "body"
  | "pullQuote"
  | "factBoxHeading"
  | "caption"
  | "credit";

type CaptionUpdate = Omit<
  Partial<ArticleCaptionData>,
  "captionStyle" | "creditStyle" | "labelStyle" | "labels"
> & {
  captionStyle?: Partial<ArticleCaptionData["captionStyle"]>;
  creditStyle?: Partial<ArticleCaptionData["creditStyle"]>;
  labelStyle?: Partial<ArticleCaptionData["labelStyle"]>;
  labels?: Partial<ArticleCaptionData["labels"]>;
};

const objectOptions: { id: InspectorObjectType; label: string; icon: typeof Type }[] = [
  { id: "headline", label: "Headline", icon: Type },
  { id: "subheadline", label: "Subheadline", icon: LetterText },
  { id: "byline", label: "Byline", icon: Pilcrow },
  { id: "location", label: "Location", icon: Pilcrow },
  { id: "body", label: "Body", icon: Pilcrow },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "caption", label: "Caption", icon: LetterText },
  { id: "credit", label: "Image Credit", icon: LetterText },
  { id: "source", label: "Source", icon: LetterText },
  { id: "kicker", label: "Kicker", icon: Type },
  { id: "strap", label: "Strap", icon: Type },
  { id: "factBox", label: "Fact Box", icon: Box },
  { id: "factBoxHeading", label: "Fact Box Heading", icon: Type },
  { id: "factBoxContent", label: "Fact Box Content", icon: Pilcrow },
  { id: "pullQuote", label: "Pull Quote", icon: Quote },
  { id: "pageHeader", label: "Page Header", icon: LayoutPanelTop },
  { id: "pageFooter", label: "Page Footer", icon: LayoutPanelTop },
  { id: "pageNumber", label: "Page Number", icon: LayoutPanelTop },
  { id: "advertisement", label: "Advertisement", icon: Layers },
];

const objectFrameStyleKeys: Partial<Record<EditorObjectType, keyof ArticleData["containerStyles"]>> = {
  headline: "headline",
  subheadline: "subheadline",
  caption: "caption",
  credit: "credit",
  source: "source",
  kicker: "kicker",
  strap: "strap",
  factBoxHeading: "factBoxHeading",
  factBoxContent: "factBoxContent",
  factBox: "factBoxContent",
  pullQuote: "pullQuote",
};

const typographyWeights: StoryTypographyWeight[] = ["400", "500", "600", "700", "800", "900"];
const storyPriorities: StoryFrame["priority"][] = ["lead", "major", "secondary", "brief", "filler"];
const storyColumnSpans: StoryColumnSpan[] = [1, 2, 3, 4, 5, 6, 7, 8];
const pageTypes: PageType[] = ["front", "state", "city", "national", "sports", "editorial"];
const imageAlignments: StoryImageAlignment[] = ["top-left", "top-right", "center", "bottom", "left", "right", "top"];
const imageWrapModes: StoryImageWrapMode[] = ["none", "rectangular", "newspaper", "contour"];
const imageShapeTypes: StoryImageShapeType[] = ["rectangle", "ellipse", "star", "heart", "polygon", "custom-path"];
const defaultImageCrop = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
  opacity: 0.45,
};
const contourPresets: Record<Exclude<StoryImageShapeType, "ellipse">, StoryImageShapePoint[]> = {
  rectangle: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  star: Array.from({ length: 10 }).map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 0.5 : 0.22;

    return {
      x: Number((0.5 + Math.cos(angle) * radius).toFixed(3)),
      y: Number((0.5 + Math.sin(angle) * radius).toFixed(3)),
    };
  }),
  heart: [
    { x: 0.5, y: 0.95 },
    { x: 0.08, y: 0.58 },
    { x: 0.05, y: 0.22 },
    { x: 0.26, y: 0.08 },
    { x: 0.5, y: 0.28 },
    { x: 0.74, y: 0.08 },
    { x: 0.95, y: 0.22 },
    { x: 0.92, y: 0.58 },
  ],
  polygon: [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.35 },
    { x: 0.82, y: 1 },
    { x: 0.18, y: 1 },
    { x: 0, y: 0.35 },
  ],
  "custom-path": [],
};
const captionPositions: CaptionPosition[] = [
  "below-image",
  "above-image",
  "overlay-bottom",
  "overlay-top",
  "overlay-bottom-gradient",
  "overlay-left",
  "overlay-right",
];
const headlineLayoutModes: HeadlineLayoutMode[] = ["newspaper-fill", "balanced"];
const textAlignments: UniversalTypographyControls["bodyAlignment"][] = ["left", "center", "right", "justify"];
const verticalAlignments: UniversalTypographyControls["headlineVerticalAlignment"][] = ["top", "middle", "bottom"];
const groupLabels: Record<InspectorGroupId, string> = {
  typography: "Typography",
  fonts: "Fonts",
  color: "Color",
  frame: "Frame",
  hj: "H&J",
  paragraph: "Paragraph",
  layout: "Layout",
  effects: "Effects",
  image: "Image",
  spacing: "Spacing",
  advanced: "Advanced",
};
const COLLAPSED_GROUP_STORAGE_KEY = "cliff-newspaper-collapsed-property-groups";

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const valuesEqual = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);
const clampUnit = (value: number) => clampNumber(Number.isFinite(value) ? value : 0, 0, 1);
const formatContourPoints = (points: StoryImageShapePoint[] = []) =>
  points.map((point) => `${Number(point.x.toFixed(3))},${Number(point.y.toFixed(3))}`).join(" ");
const parseContourPoints = (value: string): StoryImageShapePoint[] =>
  value
    .split(/\s+/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return {
        x: clampUnit(x),
        y: clampUnit(y),
      };
    })
    .filter((point): point is StoryImageShapePoint => point !== null);

const getContourPreset = (shapeType: StoryImageShapeType): StoryImageShapePoint[] =>
  shapeType === "ellipse" ? contourPresets.rectangle : contourPresets[shapeType];
const toRichTextDocument = (content: RichTextContent, style: RichTextStyle = {}) => ({
  spans: [
    {
      text: richTextToPlainText(content),
      ...style,
    },
  ],
});

const getRichTextStyle = (content: RichTextContent): RichTextStyle => {
  if (typeof content === "string") {
    return {};
  }

  return content.spans[0] ? {
    bold: content.spans[0].bold,
    italic: content.spans[0].italic,
    underline: content.spans[0].underline,
    color: content.spans[0].color,
    backgroundColor: content.spans[0].backgroundColor,
    opacity: content.spans[0].opacity,
    fontSize: content.spans[0].fontSize,
    fontWeight: content.spans[0].fontWeight,
    characterSpacing: content.spans[0].characterSpacing,
    horizontalScale: content.spans[0].horizontalScale,
    verticalScale: content.spans[0].verticalScale,
    superscript: content.spans[0].superscript,
    subscript: content.spans[0].subscript,
    smallCaps: content.spans[0].smallCaps,
    openTypeFeatures: content.spans[0].openTypeFeatures,
  } : {};
};

function useRafState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const nextValueRef = useRef(initialValue);
  const frameRef = useRef<number | null>(null);

  const setRafValue = useCallback((nextValue: T) => {
    nextValueRef.current = nextValue;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setValue(nextValueRef.current);
    });
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return [value, setRafValue, setValue] as const;
}

const StagedNumberInput = memo(function StagedNumberInput({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const parsed = Number(localValue);
    const nextValue = Number.isFinite(parsed)
      ? clampNumber(parsed, min ?? Number.NEGATIVE_INFINITY, max ?? Number.POSITIVE_INFINITY)
      : value;

    setLocalValue(String(nextValue));

    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }, [localValue, max, min, onCommit, value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      commit();
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
});

const StagedRangeInput = memo(function StagedRangeInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [localValue, setRafValue, setLocalValue] = useRafState(value);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
    setLocalValue(value);
  }, [setLocalValue, value]);

  const commit = useCallback(() => {
    const latestValue = latestValueRef.current;

    if (latestValue !== value) {
      onCommit(latestValue);
    }
  }, [onCommit, value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        latestValueRef.current = nextValue;
        setRafValue(nextValue);
      }}
      onPointerUp={commit}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
    />
  );
});

const StagedColorInput = memo(function StagedColorInput({
  value,
  readOnly = false,
  onCommit,
}: {
  value: string;
  readOnly?: boolean;
  onCommit?: (value: string) => void;
}) {
  const [localValue, setRafValue, setLocalValue] = useRafState(value);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
    setLocalValue(value);
  }, [setLocalValue, value]);

  const commit = useCallback(() => {
    const latestValue = latestValueRef.current;

    if (!readOnly && onCommit && latestValue !== value) {
      onCommit(latestValue);
    }
  }, [onCommit, readOnly, value]);

  return (
    <input
      type="color"
      value={localValue}
      readOnly={readOnly}
      onChange={(event) => {
        latestValueRef.current = event.target.value;
        setRafValue(event.target.value);
      }}
      onPointerUp={commit}
      onBlur={commit}
    />
  );
});

const StagedTextInput = memo(function StagedTextInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commit = useCallback(() => {
    if (localValue !== value) {
      onCommit(localValue);
    }
  }, [localValue, onCommit, value]);

  return (
    <input
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          commit();
        }
      }}
    />
  );
});

const StagedTextarea = memo(function StagedTextarea({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commit = useCallback(() => {
    if (localValue !== value) {
      onCommit(localValue);
    }
  }, [localValue, onCommit, value]);

  return (
    <textarea
      className="contour-points-input"
      value={localValue}
      placeholder={placeholder}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={commit}
    />
  );
});

const FontSizeControl = memo(function FontSizeControl({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commit = useCallback(
    (nextValue: number) => {
      const rounded = Math.round(clampNumber(nextValue, min, max) * 100) / 100;

      setLocalValue(String(rounded));

      if (rounded !== value) {
        onChange(rounded);
      }
    },
    [max, min, onChange, value],
  );

  const applyDelta = useCallback(
    (delta: number) => {
      const parsed = Number(localValue);

      commit((Number.isFinite(parsed) ? parsed : value) + delta);
    },
    [commit, localValue, value],
  );

  return (
    <div className="font-size-control">
      <button type="button" aria-label="Decrease font size" onClick={() => applyDelta(-step)}>
        -
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(event) => {
          setLocalValue(event.target.value);
          const parsed = Number(event.target.value);

          if (Number.isFinite(parsed)) {
            commit(parsed);
          }
        }}
        onWheel={(event) => {
          if (document.activeElement !== event.currentTarget) {
            return;
          }

          event.preventDefault();
          applyDelta(event.deltaY < 0 ? step : -step);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            return;
          }

          event.preventDefault();
          const delta = event.ctrlKey ? 0.5 : event.shiftKey ? 5 : step;

          applyDelta(event.key === "ArrowUp" ? delta : -delta);
        }}
        onBlur={() => {
          const parsed = Number(localValue);
          commit(Number.isFinite(parsed) ? parsed : value);
        }}
      />
      <button type="button" aria-label="Increase font size" onClick={() => applyDelta(step)}>
        +
      </button>
    </div>
  );
});

const PropertyGroup = memo(function PropertyGroup({
  id,
  collapsed,
  onToggle,
  children,
}: {
  id: InspectorGroupId;
  collapsed: boolean;
  onToggle: (id: InspectorGroupId) => void;
  children: ReactNode;
}) {
  return (
    <section className="properties-group">
      <button type="button" className="properties-group-header" onClick={() => onToggle(id)}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>{groupLabels[id]}</span>
      </button>
      {!collapsed ? <div className="properties-group-body">{children}</div> : null}
    </section>
  );
});

const IconToggle = memo(function IconToggle({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`property-icon-button${active ? " active" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
});

const Field = memo(function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="property-field">
      <span>{label}</span>
      {children}
    </label>
  );
});

export function ArticleInspectorPanel({
  articleData,
  compositionSettings,
  metrics,
  storyId,
  interactionMode,
  breadcrumb,
  frameSummary,
  pageMaster,
  pageType,
  storyPriority,
  storyColumnSpan,
  priorityStyle,
  imageSettings,
  typographySettings,
  storyHeight,
  pageDiagnostics,
  dominanceMetrics,
  performanceDiagnostics,
  fontManager,
  selectedParagraphIndex,
  paragraphCount,
  typographyEditingScope,
  onArticleChange,
  onCompositionChange,
  onImageSettingsChange,
  onTypographySettingsChange,
  onResetTypography,
  onPageTypeChange,
  onStoryPriorityChange,
  onStoryColumnSpanChange,
  onAlignFrames,
  onDistributeFrames,
  selectedObjectType,
  onSelectedObjectTypeChange,
  onSelectedParagraphIndexChange,
  onTypographyEditingScopeChange,
}: ArticleInspectorPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<InspectorGroupId>>(
    () => {
      if (typeof window === "undefined") {
        return new Set(["effects", "advanced"]);
      }

      const stored = window.localStorage.getItem(COLLAPSED_GROUP_STORAGE_KEY);

      if (!stored) {
        return new Set(["effects", "advanced"]);
      }

      try {
        return new Set(JSON.parse(stored) as InspectorGroupId[]);
      } catch {
        return new Set(["effects", "advanced"]);
      }
    },
  );
  const selectedObject = selectedObjectType;
  const maxImageColumnSpan = Math.max(1, metrics.columnCount);
  const maxImageHeight = Math.max(1, Math.floor(storyHeight - 36));
  const imageCrop = imageSettings.imageCrop ?? defaultImageCrop;
  const contourText = formatContourPoints(imageSettings.wrapContourPoints ?? []);
  const [imageCropDrag, setImageCropDrag] = useState<{
    pointerX: number;
    pointerY: number;
    cropX: number;
    cropY: number;
  } | null>(null);
  const selectedOption = objectOptions.find((option) => option.id === selectedObject) ?? objectOptions[0];
  const isTextObject = !["image", "pageHeader", "pageFooter", "pageNumber", "advertisement", "factBox"].includes(
    selectedObject,
  );
  const selectedLabel = selectedOption.label;
  const currentTextField: TextFieldKey =
    selectedObject === "subheadline"
      ? "subheadline"
      : selectedObject === "body"
        ? "body"
        : selectedObject === "pullQuote"
          ? "pullQuote"
          : selectedObject === "factBoxHeading"
            ? "factBoxHeading"
            : selectedObject === "caption"
              ? "caption"
              : selectedObject === "credit"
                ? "credit"
                : "headline";
  const currentRichText = useMemo(() => {
    if (currentTextField === "subheadline") {
      return articleData.subheadline;
    }
    if (currentTextField === "body") {
      return articleData.body;
    }
    if (currentTextField === "pullQuote") {
      return articleData.pullQuote.text;
    }
    if (currentTextField === "factBoxHeading") {
      return articleData.factBox.headline;
    }
    if (currentTextField === "caption") {
      return articleData.caption.text;
    }
    if (currentTextField === "credit") {
      return articleData.caption.creditText;
    }

    return articleData.headline;
  }, [articleData, currentTextField]);
  const currentStyle = getRichTextStyle(currentRichText);
  const paragraphBinding = getObjectParagraphStyleBinding(selectedObject);
  const selectedObjectAlignment = getObjectAlignment(articleData.typography, selectedObject);
  const selectedObjectJustifyMode = getObjectJustifyMode(articleData.typography, selectedObject);
  const selectedObjectJustifyEngineMode = getObjectJustifyEngineMode(articleData.typography, selectedObject);
  const selectedObjectVerticalAlignment = getObjectVerticalAlignment(articleData.typography, selectedObject);
  const selectedObjectTracking = getObjectTracking(articleData.typography, selectedObject);
  const selectedObjectLetterSpacing = getObjectLetterSpacing(articleData.typography, selectedObject);
  const bodyParagraphs = useMemo(
    () =>
      normalizeParagraphTypography({
        content: articleData.body,
        existing: articleData.bodyParagraphs,
      }),
    [articleData.body, articleData.bodyParagraphs],
  );
  const clampedParagraphIndex = Math.min(
    Math.max(selectedParagraphIndex, 0),
    Math.max(bodyParagraphs.length - 1, 0),
  );
  const selectedParagraph = bodyParagraphs[clampedParagraphIndex] ?? bodyParagraphs[0] ?? null;
  const selectedParagraphFormatting = selectedParagraph?.formatting ?? null;
  const normalizedContainerStyles = useMemo(
    () => normalizeContainerStyles(articleData.containerStyles),
    [articleData.containerStyles],
  );
  const selectedFrameStyleKey = objectFrameStyleKeys[selectedObject];
  const selectedFrameStyle = selectedFrameStyleKey ? normalizedContainerStyles[selectedFrameStyleKey] : null;
  const [frameAlignmentTarget, setFrameAlignmentTarget] = useState<FrameAlignmentTarget>("margins");

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_GROUP_STORAGE_KEY, JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  const toggleGroup = (id: InspectorGroupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const updateTypography = <Key extends keyof StoryTypographySettings>(
    key: Key,
    value: StoryTypographySettings[Key],
  ) => {
    if (valuesEqual(typographySettings[key], value)) {
      return;
    }

    onTypographySettingsChange(key, value);
  };

  const renderLineSpacingControl = ({
    label,
    fontSize,
    lineHeight,
    mode,
    modeKey,
    leadingValue,
    leadingValueKey,
  }: {
    label: string;
    fontSize: number;
    lineHeight: number;
    mode: StoryLineHeightMode | undefined;
    modeKey: "headlineLineHeightMode" | "subheadlineLineHeightMode" | "bodyLineHeightMode";
    leadingValue: number | undefined;
    leadingValueKey: "headlineLeadingValue" | "subheadlineLeadingValue" | "bodyLeadingValue";
  }) => {
    const loadedMode = mode as string | undefined;
    const resolvedMode = loadedMode === "manual" ? "exactly" : mode ?? "auto";
    const displayValue =
      resolvedMode === "auto"
        ? fontSize
        : resolvedMode === "percentage"
          ? leadingValue ?? Math.round(lineHeight * 100)
          : leadingValue ?? Number((fontSize * lineHeight).toFixed(2));
    const valueLabel = resolvedMode === "percentage" ? "%" : "pt";

    return (
      <Field label={label}>
        <div className="line-spacing-control">
          <select
            value={resolvedMode}
            onChange={(event) => updateTypography(modeKey, event.target.value as StoryLineHeightMode)}
          >
            <option value="auto">Auto ({fontSize.toFixed(1)} pt)</option>
            <option value="exactly">Exactly</option>
            <option value="at-least">At Least</option>
            <option value="percentage">Percentage</option>
          </select>
          <div className="leading-value-control">
            <StagedNumberInput
              value={displayValue}
              min={resolvedMode === "percentage" ? 50 : 1}
              max={resolvedMode === "percentage" ? 300 : 200}
              step={resolvedMode === "percentage" ? 1 : 0.25}
              disabled={resolvedMode === "auto"}
              onCommit={(value) => updateTypography(leadingValueKey, value)}
            />
            <span>{valueLabel}</span>
          </div>
          <button
            type="button"
            className="property-mini-button"
            disabled={resolvedMode === "auto"}
            onClick={() => updateTypography(modeKey, "auto")}
          >
            Auto
          </button>
          <button
            type="button"
            className="property-mini-button"
            disabled={resolvedMode === "auto" && lineHeight === 1}
            onClick={() => updateTypography(modeKey, "auto")}
          >
            Reset
          </button>
        </div>
      </Field>
    );
  };

  const updateImageSetting = <Key extends keyof StoryImageSettings>(
    key: Key,
    value: StoryImageSettings[Key],
  ) => {
    if (valuesEqual(imageSettings[key], value)) {
      return;
    }

    onImageSettingsChange(key, value);
  };

  const updateImageCrop = useCallback(
    (update: Partial<NonNullable<StoryImageSettings["imageCrop"]>>) => {
      updateImageSetting("imageCrop", {
        ...defaultImageCrop,
        ...(imageSettings.imageCrop ?? {}),
        ...update,
      });
    },
    [imageSettings.imageCrop, updateImageSetting],
  );

  const applyContourPreset = useCallback(
    (shapeType: StoryImageShapeType) => {
      updateImageSetting("imageShapeType", shapeType);
      updateImageSetting("wrapContourPoints", getContourPreset(shapeType));
    },
    [updateImageSetting],
  );

  const handleImageCropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setImageCropDrag({
        pointerX: event.clientX,
        pointerY: event.clientY,
        cropX: imageCrop.x,
        cropY: imageCrop.y,
      });
    },
    [imageCrop.x, imageCrop.y],
  );

  const handleImageCropPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!imageCropDrag) {
        return;
      }

      updateImageCrop({
        x: Math.round(imageCropDrag.cropX + event.clientX - imageCropDrag.pointerX),
        y: Math.round(imageCropDrag.cropY + event.clientY - imageCropDrag.pointerY),
      });
    },
    [imageCropDrag, updateImageCrop],
  );

  const handleImageCropPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setImageCropDrag(null);
  }, []);

  const handleImageCropWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      updateImageCrop({
        zoom: Math.round(clampNumber(imageCrop.zoom + delta, 0.1, 5) * 100) / 100,
      });
    },
    [imageCrop.zoom, updateImageCrop],
  );

  const updateCompositionSetting = <Key extends keyof ArticleCompositionSettings>(
    key: Key,
    value: ArticleCompositionSettings[Key],
  ) => {
    if (valuesEqual(compositionSettings[key], value)) {
      return;
    }

    onCompositionChange(key, value);
  };

  const updateUniversalTypography = (
    update: Partial<UniversalTypographyControls>,
  ) => {
    const nextTypography = {
      ...articleData.typography,
      ...update,
    };

    if (valuesEqual(articleData.typography, nextTypography)) {
      return;
    }

    onArticleChange("typography", nextTypography);
  };

  const updateCustomHyphenationJustification = (
    update: Partial<UniversalTypographyControls>,
  ) => updateUniversalTypography({ ...update, hjPreset: "custom" });

  const applySelectedHyphenationJustificationPreset = (
    presetName: HyphenationJustificationPresetName,
  ) => {
    updateUniversalTypography(applyHyphenationJustificationPreset(articleData.typography, presetName));
  };

  const updateSelectedParagraphFormatting = (
    update: Partial<NonNullable<typeof selectedParagraphFormatting>>,
  ) => {
    if (!selectedParagraph) {
      return;
    }

    const nextParagraphs = updateParagraphFormatting(
      bodyParagraphs,
      clampedParagraphIndex,
      update,
    );

    if (valuesEqual(articleData.bodyParagraphs, nextParagraphs)) {
      return;
    }

    onArticleChange("bodyParagraphs", nextParagraphs);
  };

  const updateSelectedObjectAlignment = (alignment: UniversalTypographyControls["bodyAlignment"]) => {
    updateUniversalTypography({
      ...setObjectAlignment(articleData.typography, selectedObject, alignment),
      ...(selectedObject === "body" && alignment === "justify"
        ? setObjectJustifyMode("body", "justify-all-lines")
        : {}),
    });
  };

  const updateSelectedObjectJustifyMode = (justifyMode: UniversalTypographyControls["justifyMode"]) => {
    updateUniversalTypography(setObjectJustifyMode(selectedObject, justifyMode));
  };

  const updateSelectedObjectJustifyEngineMode = (
    justifyEngineMode: UniversalTypographyControls["justifyEngineMode"],
  ) => {
    updateUniversalTypography(setObjectJustifyEngineMode(selectedObject, justifyEngineMode));
  };

  const updateSelectedObjectVerticalAlignment = (
    verticalAlignment: UniversalTypographyControls["headlineVerticalAlignment"],
  ) => {
    updateUniversalTypography(setObjectVerticalAlignment(selectedObject, verticalAlignment));
  };

  const updateSelectedObjectLetterSpacing = (letterSpacing: number) => {
    updateUniversalTypography(setObjectLetterSpacing(selectedObject, letterSpacing));
  };

  const updateSelectedObjectTracking = (tracking: number) => {
    updateUniversalTypography(setObjectTracking(selectedObject, tracking));
  };

  const getBodyFontSizeValue = () => {
    if (typographyEditingScope === "paragraph") {
      return selectedParagraphFormatting?.fontSize ?? typographySettings.bodyFontSize;
    }

    if (typographyEditingScope === "selection") {
      return currentStyle.fontSize ?? typographySettings.bodyFontSize;
    }

    return typographySettings.bodyFontSize;
  };

  const updateBodyFontSize = (fontSize: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ fontSize });
      return;
    }

    if (typographyEditingScope === "selection") {
      updateSelectedRichTextStyle({ fontSize });
      return;
    }

    updateTypography("bodyFontSize", fontSize);
  };

  const getBodyLeadingModeValue = () =>
    typographyEditingScope === "paragraph"
      ? selectedParagraphFormatting?.leadingMode ?? "auto"
      : typographySettings.bodyLineHeightMode ?? "auto";

  const getBodyLeadingValue = () =>
    typographyEditingScope === "paragraph"
      ? selectedParagraphFormatting?.leadingValue ?? getBodyFontSizeValue()
      : typographySettings.bodyLeadingValue ?? getBodyFontSizeValue();

  const updateBodyLeadingMode = (leadingMode: StoryLineHeightMode) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ leadingMode });
      return;
    }

    updateTypography("bodyLineHeightMode", leadingMode);
  };

  const updateBodyLeadingValue = (leadingValue: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ leadingValue });
      return;
    }

    updateTypography("bodyLeadingValue", leadingValue);
  };

  const getBodyTrackingValue = () =>
    typographyEditingScope === "paragraph"
      ? selectedParagraphFormatting?.tracking ?? selectedObjectTracking
      : selectedObjectTracking;

  const updateBodyTracking = (tracking: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ tracking });
      return;
    }

    updateSelectedObjectTracking(tracking);
  };

  const getBodyCharacterSpacingValue = () => {
    if (typographyEditingScope === "paragraph") {
      return selectedParagraphFormatting?.characterSpacing ?? selectedObjectLetterSpacing;
    }

    if (typographyEditingScope === "selection") {
      return currentStyle.characterSpacing ?? selectedObjectLetterSpacing;
    }

    return selectedObjectLetterSpacing;
  };

  const updateBodyCharacterSpacing = (characterSpacing: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ characterSpacing });
      return;
    }

    if (typographyEditingScope === "selection") {
      updateSelectedRichTextStyle({ characterSpacing });
      return;
    }

    updateSelectedObjectLetterSpacing(characterSpacing);
  };

  const getBodyHorizontalScaleValue = () => {
    if (typographyEditingScope === "paragraph") {
      return selectedParagraphFormatting?.horizontalScale ?? 100;
    }

    if (typographyEditingScope === "selection") {
      return currentStyle.horizontalScale ?? 100;
    }

    return 100;
  };

  const updateBodyHorizontalScale = (horizontalScale: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ horizontalScale });
      return;
    }

    if (typographyEditingScope === "selection") {
      updateSelectedRichTextStyle({ horizontalScale });
    }
  };

  const getBodyVerticalScaleValue = () => {
    if (typographyEditingScope === "paragraph") {
      return selectedParagraphFormatting?.verticalScale ?? 100;
    }

    if (typographyEditingScope === "selection") {
      return currentStyle.verticalScale ?? 100;
    }

    return 100;
  };

  const updateBodyVerticalScale = (verticalScale: number) => {
    if (typographyEditingScope === "paragraph") {
      updateSelectedParagraphFormatting({ verticalScale });
      return;
    }

    if (typographyEditingScope === "selection") {
      updateSelectedRichTextStyle({ verticalScale });
    }
  };

  const updateSelectedRichText = (content: RichTextContent) => {
    if (valuesEqual(currentRichText, content)) {
      return;
    }

    if (currentTextField === "subheadline") {
      onArticleChange("subheadline", content);
      return;
    }
    if (currentTextField === "body") {
      onArticleChange("body", content);
      return;
    }
    if (currentTextField === "pullQuote") {
      onArticleChange("pullQuote", {
        ...articleData.pullQuote,
        text: content,
      });
      return;
    }
    if (currentTextField === "factBoxHeading") {
      onArticleChange("factBox", {
        ...articleData.factBox,
        headline: content,
      });
      return;
    }
    if (currentTextField === "caption") {
      onArticleChange("caption", {
        ...articleData.caption,
        text: content,
      });
      return;
    }
    if (currentTextField === "credit") {
      onArticleChange("caption", {
        ...articleData.caption,
        creditText: content,
      });
      return;
    }

    onArticleChange("headline", content);
  };

  const updateSelectedRichTextStyle = (style: RichTextStyle) => {
    updateSelectedRichText(toRichTextDocument(currentRichText, {
      ...currentStyle,
      ...style,
    }));
  };

  const updateSelectedFrameStyle = (style: Partial<ObjectContainerStyle>) => {
    if (!selectedFrameStyleKey) {
      return;
    }

    const nextContainerStyles = normalizeContainerStyles({
      ...normalizedContainerStyles,
      [selectedFrameStyleKey]: {
        ...normalizedContainerStyles[selectedFrameStyleKey],
        ...style,
      },
    });

    if (valuesEqual(articleData.containerStyles, nextContainerStyles)) {
      return;
    }

    onArticleChange("containerStyles", nextContainerStyles);
  };

  const setSelectedFrameMode = (frameMode: ObjectContainerStyle["frameMode"]) => {
    updateSelectedFrameStyle({
      frameMode,
      mode: frameMode === "none" ? "none" : frameMode,
    });
  };

  const clearSelectedRichTextStyle = () => {
    updateSelectedRichText(richTextToPlainText(currentRichText));
  };

  const updateCaption = (update: CaptionUpdate) => {
    const nextCaption = {
      ...articleData.caption,
      ...update,
      captionStyle: {
        ...articleData.caption.captionStyle,
        ...(update.captionStyle ?? {}),
      },
      creditStyle: {
        ...articleData.caption.creditStyle,
        ...(update.creditStyle ?? {}),
      },
      labelStyle: {
        ...articleData.caption.labelStyle,
        ...(update.labelStyle ?? {}),
      },
      labels: {
        ...articleData.caption.labels,
        ...(update.labels ?? {}),
      },
    };

    if (valuesEqual(articleData.caption, nextCaption)) {
      return;
    }

    onArticleChange("caption", nextCaption);
  };

  return (
    <aside className="article-inspector properties-panel" aria-label="Object properties">
      <header className="properties-header">
        <div>
          <span>Object Properties</span>
          <strong>{frameSummary?.frameLabel ?? `${selectedLabel} Frame`}</strong>
          {breadcrumb && breadcrumb.length > 0 ? (
            <em className="properties-breadcrumb">{breadcrumb.join(" > ")}</em>
          ) : null}
        </div>
        <small>{frameSummary ? `Page ${frameSummary.pageNumber ?? "-"} / Layer ${frameSummary.layer ?? "-"}` : storyId}</small>
      </header>

      {frameSummary ? (
        <section className="properties-frame-summary" aria-label="Frame summary">
          <span>Story</span><strong>{frameSummary.storyTitle}</strong>
          <span>Status</span><strong>{frameSummary.status}</strong>
          <span>Position</span><strong>{Math.round(frameSummary.x)}, {Math.round(frameSummary.y)}</strong>
          <span>Dimensions</span><strong>{Math.round(frameSummary.width)} x {Math.round(frameSummary.height)}</strong>
        </section>
      ) : null}

      {interactionMode === "frame" ? (
        <>
          <section className="frame-mode-banner" aria-label="Frame editing mode">
            <strong>Frame Mode</strong>
            <span>Double click text or image content to edit it.</span>
          </section>

          <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
            <div className="property-readout">
              <span>X</span>
              <strong>{frameSummary ? Math.round(frameSummary.x) : "-"}</strong>
              <span>Y</span>
              <strong>{frameSummary ? Math.round(frameSummary.y) : "-"}</strong>
              <span>Width</span>
              <strong>{frameSummary ? Math.round(frameSummary.width) : "-"}</strong>
              <span>Height</span>
              <strong>{frameSummary ? Math.round(frameSummary.height) : "-"}</strong>
              <span>Layer</span>
              <strong>{frameSummary?.layer ?? "-"}</strong>
              <span>Status</span>
              <strong>{frameSummary?.status ?? "Visible"}</strong>
            </div>
            <Field label="Align To">
              <select
                value={frameAlignmentTarget}
                onChange={(event) => setFrameAlignmentTarget(event.target.value as FrameAlignmentTarget)}
              >
                <option value="margins">Margins</option>
                <option value="page">Page</option>
                <option value="selection">Selection</option>
                <option value="columns">Columns</option>
                <option value="spread">Spread</option>
              </select>
            </Field>
            <div className="frame-align-grid" aria-label="Frame alignment controls">
              <button type="button" onClick={() => onAlignFrames("left", frameAlignmentTarget)}>
                Left
              </button>
              <button type="button" onClick={() => onAlignFrames("center", frameAlignmentTarget)}>
                Center
              </button>
              <button type="button" onClick={() => onAlignFrames("right", frameAlignmentTarget)}>
                Right
              </button>
              <button type="button" onClick={() => onAlignFrames("top", frameAlignmentTarget)}>
                Top
              </button>
              <button type="button" onClick={() => onAlignFrames("middle", frameAlignmentTarget)}>
                Middle
              </button>
              <button type="button" onClick={() => onAlignFrames("bottom", frameAlignmentTarget)}>
                Bottom
              </button>
            </div>
            <div className="frame-align-grid frame-align-grid--two" aria-label="Frame distribution controls">
              <button type="button" onClick={() => onDistributeFrames("horizontal")}>
                Distribute H
              </button>
              <button type="button" onClick={() => onDistributeFrames("vertical")}>
                Distribute V
              </button>
            </div>
          </PropertyGroup>

          <PropertyGroup id="frame" collapsed={collapsedGroups.has("frame")} onToggle={toggleGroup}>
            <p className="property-empty-state">
              Position, size, layer, lock, hide and duplicate actions are frame-level operations. Text styling appears after entering content mode.
            </p>
          </PropertyGroup>

          <PropertyGroup id="advanced" collapsed={collapsedGroups.has("advanced")} onToggle={toggleGroup}>
            <div className="property-readout">
              <span>Story Density</span>
              <strong>{metrics.storyDensityPercent.toFixed(1)}%</strong>
              <span>Overflow</span>
              <strong>{metrics.overflow ? "Yes" : "No"}</strong>
              <span>Frame</span>
              <strong>{storyId}</strong>
            </div>
          </PropertyGroup>
        </>
      ) : (
        <>

      <section className="object-picker" aria-label="Selectable objects">
        {objectOptions.map((option) => {
          const Icon = option.icon;

          return (
            <button
              type="button"
              key={option.id}
              className={selectedObject === option.id ? "active" : ""}
              onClick={() => onSelectedObjectTypeChange(option.id)}
              title={option.label}
            >
              <Icon size={14} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </section>

      {isTextObject ? (
        <>
          <PropertyGroup id="typography" collapsed={collapsedGroups.has("typography")} onToggle={toggleGroup}>
            <div className="property-icon-row">
              <IconToggle active={Boolean(currentStyle.bold)} title="Bold" onClick={() => updateSelectedRichTextStyle({ bold: !currentStyle.bold })}>
                <Bold size={15} />
              </IconToggle>
              <IconToggle active={Boolean(currentStyle.italic)} title="Italic" onClick={() => updateSelectedRichTextStyle({ italic: !currentStyle.italic })}>
                <Italic size={15} />
              </IconToggle>
              <IconToggle active={Boolean(currentStyle.underline)} title="Underline" onClick={() => updateSelectedRichTextStyle({ underline: !currentStyle.underline })}>
                <Underline size={15} />
              </IconToggle>
              <IconToggle title="Clear Formatting" onClick={clearSelectedRichTextStyle}>
                <Eraser size={15} />
              </IconToggle>
            </div>

            <Field label="Font Family">
              <select disabled value="Cliff Noto Devanagari">
                <option>Cliff Noto Devanagari</option>
              </select>
            </Field>

            {selectedObject === "headline" ? (
              <>
                <Field label="Font Size">
                  <FontSizeControl
                    value={typographySettings.headlineFontSize}
                    min={12}
                    max={60}
                    onChange={(value) => updateTypography("headlineFontSize", value)}
                  />
                </Field>
                <Field label="Font Weight">
                  <select
                    value={typographySettings.headlineWeight}
                    onChange={(event) => updateTypography("headlineWeight", event.target.value as StoryTypographyWeight)}
                  >
                    {typographyWeights.map((weight) => (
                      <option key={weight} value={weight}>{weight}</option>
                    ))}
                  </select>
                </Field>
                {renderLineSpacingControl({
                  label: "Line Spacing",
                  fontSize: typographySettings.headlineFontSize,
                  lineHeight: typographySettings.headlineLineHeight,
                  mode: typographySettings.headlineLineHeightMode,
                  modeKey: "headlineLineHeightMode",
                  leadingValue: typographySettings.headlineLeadingValue,
                  leadingValueKey: "headlineLeadingValue",
                })}
              </>
            ) : null}

            {selectedObject === "subheadline" ? (
              <>
                <Field label="Size">
                  <FontSizeControl
                    value={typographySettings.subheadlineFontSize}
                    min={10}
                    max={30}
                    onChange={(value) => updateTypography("subheadlineFontSize", value)}
                  />
                </Field>
                <Field label="Weight">
                  <select
                    value={typographySettings.subheadlineWeight}
                    onChange={(event) => updateTypography("subheadlineWeight", event.target.value as StoryTypographyWeight)}
                  >
                    {typographyWeights.map((weight) => (
                      <option key={weight} value={weight}>{weight}</option>
                    ))}
                  </select>
                </Field>
                {renderLineSpacingControl({
                  label: "Line Spacing",
                  fontSize: typographySettings.subheadlineFontSize,
                  lineHeight: typographySettings.subheadlineLineHeight,
                  mode: typographySettings.subheadlineLineHeightMode,
                  modeKey: "subheadlineLineHeightMode",
                  leadingValue: typographySettings.subheadlineLeadingValue,
                  leadingValueKey: "subheadlineLeadingValue",
                })}
              </>
            ) : null}

            {selectedObject === "body" ? (
              <>
                <div className="property-readout property-readout-inline">
                  <span>Scope</span>
                  <strong>
                    {typographyEditingScope === "story"
                      ? "Entire Story"
                      : typographyEditingScope === "paragraph"
                        ? "Current Paragraph"
                        : "Selected Text"}
                  </strong>
                </div>
                <div className="property-icon-row">
                  {(["story", "paragraph", "selection"] as TypographyEditingScope[]).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      className={`property-mini-button${typographyEditingScope === scope ? " active" : ""}`}
                      onClick={() => onTypographyEditingScopeChange(scope)}
                    >
                      {scope === "story" ? "Story" : scope === "paragraph" ? "Paragraph" : "Text"}
                    </button>
                  ))}
                </div>
                <Field label="Paragraph">
                  <div className="condense-expand-control">
                    <button
                      type="button"
                      className="property-mini-button"
                      disabled={clampedParagraphIndex <= 0}
                      onClick={() => onSelectedParagraphIndexChange(clampedParagraphIndex - 1)}
                    >
                      Prev
                    </button>
                    <select
                      value={clampedParagraphIndex}
                      onChange={(event) => onSelectedParagraphIndexChange(Number(event.target.value))}
                    >
                      {bodyParagraphs.map((paragraph) => (
                        <option key={paragraph.id} value={paragraph.index}>
                          P{paragraph.index + 1}: {paragraph.preview || "Empty"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="property-mini-button"
                      disabled={clampedParagraphIndex >= Math.max(paragraphCount, bodyParagraphs.length) - 1}
                      onClick={() => onSelectedParagraphIndexChange(clampedParagraphIndex + 1)}
                    >
                      Next
                    </button>
                  </div>
                </Field>
                <Field label="Body Size">
                  <FontSizeControl
                    value={getBodyFontSizeValue()}
                    min={8}
                    max={60}
                    step={0.1}
                    onChange={updateBodyFontSize}
                  />
                </Field>
                <Field label="Leading">
                  <div className="line-spacing-control">
                    <select
                      value={getBodyLeadingModeValue()}
                      disabled={typographyEditingScope === "selection"}
                      onChange={(event) => updateBodyLeadingMode(event.target.value as StoryLineHeightMode)}
                    >
                      <option value="auto">Auto ({getBodyFontSizeValue().toFixed(1)} pt)</option>
                      <option value="exactly">Exactly</option>
                      <option value="at-least">At Least</option>
                      <option value="percentage">Percentage</option>
                    </select>
                    <div className="leading-value-control">
                      <StagedNumberInput
                        value={getBodyLeadingModeValue() === "auto" ? getBodyFontSizeValue() : getBodyLeadingValue()}
                        min={getBodyLeadingModeValue() === "percentage" ? 50 : 1}
                        max={getBodyLeadingModeValue() === "percentage" ? 300 : 200}
                        step={getBodyLeadingModeValue() === "percentage" ? 1 : 0.25}
                        disabled={typographyEditingScope === "selection" || getBodyLeadingModeValue() === "auto"}
                        onCommit={updateBodyLeadingValue}
                      />
                      <span>{getBodyLeadingModeValue() === "percentage" ? "%" : "pt"}</span>
                    </div>
                    <button
                      type="button"
                      className="property-mini-button"
                      disabled={typographyEditingScope === "selection" || getBodyLeadingModeValue() === "auto"}
                      onClick={() => updateBodyLeadingMode("auto")}
                    >
                      Reset Auto
                    </button>
                  </div>
                </Field>
                <Field label="Tracking">
                  <div className="condense-expand-control">
                    <input
                      type="range"
                      min={-50}
                      max={100}
                      step={1}
                      value={getBodyTrackingValue()}
                      disabled={typographyEditingScope === "selection"}
                      onChange={(event) => updateBodyTracking(Number(event.target.value))}
                    />
                    <StagedNumberInput
                      value={getBodyTrackingValue()}
                      min={-50}
                      max={100}
                      step={1}
                      disabled={typographyEditingScope === "selection"}
                      onCommit={updateBodyTracking}
                    />
                  </div>
                </Field>
                <Field label="Character Spacing">
                  <div className="condense-expand-control">
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={getBodyCharacterSpacingValue()}
                      onChange={(event) => updateBodyCharacterSpacing(Number(event.target.value))}
                    />
                    <StagedNumberInput
                      value={getBodyCharacterSpacingValue()}
                      min={-100}
                      max={100}
                      step={1}
                      onCommit={updateBodyCharacterSpacing}
                    />
                  </div>
                </Field>
                <Field label="Horizontal Scale">
                  <div className="condense-expand-control">
                    <input
                      type="range"
                      min={80}
                      max={120}
                      step={1}
                      value={getBodyHorizontalScaleValue()}
                      disabled={typographyEditingScope === "story"}
                      onChange={(event) => updateBodyHorizontalScale(Number(event.target.value))}
                    />
                    <StagedNumberInput
                      value={getBodyHorizontalScaleValue()}
                      min={80}
                      max={120}
                      step={1}
                      disabled={typographyEditingScope === "story"}
                      onCommit={updateBodyHorizontalScale}
                    />
                  </div>
                </Field>
                <Field label="Vertical Scale">
                  <div className="condense-expand-control">
                    <input
                      type="range"
                      min={80}
                      max={140}
                      step={1}
                      value={getBodyVerticalScaleValue()}
                      disabled={typographyEditingScope === "story"}
                      onChange={(event) => updateBodyVerticalScale(Number(event.target.value))}
                    />
                    <StagedNumberInput
                      value={getBodyVerticalScaleValue()}
                      min={80}
                      max={140}
                      step={1}
                      disabled={typographyEditingScope === "story"}
                      onCommit={updateBodyVerticalScale}
                    />
                  </div>
                </Field>
              </>
            ) : null}
          </PropertyGroup>

          <PropertyGroup id="color" collapsed={collapsedGroups.has("color")} onToggle={toggleGroup}>
            <div className="property-icon-row">
              <IconToggle title="Text Color" onClick={() => updateSelectedRichTextStyle({ color: "#b42318" })}>
                <Droplet size={15} />
              </IconToggle>
              <IconToggle title="Frame Fill" onClick={() => updateSelectedFrameStyle({ frameMode: "frame", mode: "frame", frameBackgroundColor: "#fff3bf" })}>
                <Highlighter size={15} />
              </IconToggle>
              <IconToggle title="Reverse Frame" onClick={() => {
                updateSelectedFrameStyle({ frameMode: "frame", mode: "frame", frameBackgroundColor: "#111111" });
                updateSelectedRichTextStyle({ color: "#ffffff" });
              }}>
                <PaintBucket size={15} />
              </IconToggle>
            </div>
            <div className="property-field property-field-wide">
              <span>Text Color</span>
              <ProfessionalColorPicker
                value={currentStyle.color ?? "#111111"}
                opacity={currentStyle.opacity ?? 1}
                onChange={(value) => updateSelectedRichTextStyle({ color: value })}
                onOpacityChange={(value) => updateSelectedRichTextStyle({ opacity: value })}
              />
            </div>
            {selectedFrameStyle ? (
              <>
                <Field label="Frame Mode">
                  <select
                    value={selectedFrameStyle.frameMode}
                    onChange={(event) => setSelectedFrameMode(event.target.value as ObjectContainerStyle["frameMode"])}
                  >
                    <option value="none">None</option>
                    <option value="text-only">Text Only</option>
                    <option value="frame">Frame</option>
                    <option value="full-width">Full Width</option>
                    <option value="banner">Banner</option>
                  </select>
                </Field>
                <div className="property-field property-field-wide">
                  <span>Frame Fill</span>
                  <ProfessionalColorPicker
                    value={
                      selectedFrameStyle.frameBackgroundColor === "transparent"
                        ? "#fff3bf"
                        : selectedFrameStyle.frameBackgroundColor
                    }
                    opacity={selectedFrameStyle.frameOpacity}
                    onChange={(value) =>
                      updateSelectedFrameStyle({
                        frameMode: selectedFrameStyle.frameMode === "none" ? "frame" : selectedFrameStyle.frameMode,
                        mode: selectedFrameStyle.mode === "none" || selectedFrameStyle.mode === "transparent" ? "frame" : selectedFrameStyle.mode,
                        frameBackgroundColor: value,
                      })
                    }
                    onOpacityChange={(value) => updateSelectedFrameStyle({ frameOpacity: value })}
                  />
                </div>
              </>
            ) : null}
          </PropertyGroup>

          {selectedFrameStyle ? (
            <PropertyGroup id="frame" collapsed={collapsedGroups.has("frame")} onToggle={toggleGroup}>
              <Field label="Padding Top">
                <StagedNumberInput
                  value={selectedFrameStyle.framePaddingTop}
                  min={0}
                  max={48}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ framePaddingTop: value })}
                />
              </Field>
              <Field label="Padding Bottom">
                <StagedNumberInput
                  value={selectedFrameStyle.framePaddingBottom}
                  min={0}
                  max={48}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ framePaddingBottom: value })}
                />
              </Field>
              <Field label="Padding Left">
                <StagedNumberInput
                  value={selectedFrameStyle.framePaddingLeft}
                  min={0}
                  max={48}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ framePaddingLeft: value })}
                />
              </Field>
              <Field label="Padding Right">
                <StagedNumberInput
                  value={selectedFrameStyle.framePaddingRight}
                  min={0}
                  max={48}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ framePaddingRight: value })}
                />
              </Field>
              <Field label="Vertical Alignment">
                <select
                  value={selectedFrameStyle.contentVerticalAlignment}
                  onChange={(event) =>
                    updateSelectedFrameStyle({
                      contentVerticalAlignment: event.target.value as ObjectContainerStyle["contentVerticalAlignment"],
                    })
                  }
                >
                  {verticalAlignments.map((alignment) => (
                    <option key={alignment} value={alignment}>{alignment}</option>
                  ))}
                </select>
              </Field>
              <Field label="Border Radius">
                <StagedNumberInput
                  value={selectedFrameStyle.frameRadius}
                  min={0}
                  max={48}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ frameRadius: value })}
                />
              </Field>
              <Field label="Border Width">
                <StagedNumberInput
                  value={selectedFrameStyle.frameBorderWidth}
                  min={0}
                  max={8}
                  step={0.5}
                  onCommit={(value) => updateSelectedFrameStyle({ frameBorderWidth: value })}
                />
              </Field>
              <Field label="Border Color">
                <StagedColorInput
                  value={
                    selectedFrameStyle.frameBorderColor === "transparent"
                      ? "#d9d3c8"
                      : selectedFrameStyle.frameBorderColor
                  }
                  onCommit={(value) => updateSelectedFrameStyle({ frameBorderColor: value })}
                />
              </Field>
              <Field label="Border Style">
                <select
                  value={selectedFrameStyle.frameBorderStyle}
                  onChange={(event) =>
                    updateSelectedFrameStyle({
                      frameBorderStyle: event.target.value as ObjectContainerStyle["frameBorderStyle"],
                    })
                  }
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </Field>
              <Field label="Frame Height Mode">
                <select
                  value={selectedFrameStyle.autoFrameHeight ? "auto" : "fixed"}
                  onChange={(event) => updateSelectedFrameStyle({ autoFrameHeight: event.target.value === "auto" })}
                >
                  <option value="auto">Auto</option>
                  <option value="fixed">Fixed</option>
                </select>
              </Field>
            </PropertyGroup>
          ) : null}

          <PropertyGroup id="paragraph" collapsed={collapsedGroups.has("paragraph")} onToggle={toggleGroup}>
            <div className="property-icon-row">
              <IconToggle
                active={selectedObjectAlignment === "left"}
                title="Align Left"
                onClick={() => updateSelectedObjectAlignment("left")}
              >
                <AlignLeft size={15} />
              </IconToggle>
              <IconToggle
                active={selectedObjectAlignment === "center"}
                title="Align Center"
                onClick={() => updateSelectedObjectAlignment("center")}
              >
                <AlignCenter size={15} />
              </IconToggle>
              <IconToggle
                active={selectedObjectAlignment === "right"}
                title="Align Right"
                onClick={() => updateSelectedObjectAlignment("right")}
              >
                <AlignRight size={15} />
              </IconToggle>
              {paragraphBinding.supportsJustify ? (
                <IconToggle
                  active={selectedObjectAlignment === "justify"}
                  title="Justify"
                  onClick={() => updateSelectedObjectAlignment("justify")}
                >
                  <AlignJustify size={15} />
                </IconToggle>
              ) : null}
            </div>
            {selectedObject === "headline" ? (
              <>
                <Field label="Headline Fill Mode">
                  <select
                    value={typographySettings.headlineLayoutMode}
                    onChange={(event) => updateTypography("headlineLayoutMode", event.target.value as HeadlineLayoutMode)}
                  >
                    {headlineLayoutModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </Field>
                <label className="property-toggle">
                  <input
                    type="checkbox"
                    checked={typographySettings.autoFitHeadline}
                    onChange={(event) => updateTypography("autoFitHeadline", event.target.checked)}
                  />
                  Auto Fit
                </label>
                <label className="property-toggle">
                  <input
                    type="checkbox"
                    checked={typographySettings.autoBalanceHeadline}
                    onChange={(event) => updateTypography("autoBalanceHeadline", event.target.checked)}
                  />
                  Balance
                </label>
              </>
            ) : null}
            {paragraphBinding.verticalAlignmentKey ? (
              <Field label="Vertical Alignment">
                <select
                  value={selectedObjectVerticalAlignment}
                  onChange={(event) =>
                    updateSelectedObjectVerticalAlignment(
                      event.target.value as UniversalTypographyControls["headlineVerticalAlignment"],
                    )
                  }
                >
                  {verticalAlignments.map((alignment) => (
                    <option key={alignment} value={alignment}>{alignment}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            {paragraphBinding.supportsJustify ? (
              <>
                <Field label="Justify Mode">
                  <select
                    value={selectedObjectJustifyMode}
                    onChange={(event) => updateSelectedObjectJustifyMode(event.target.value as UniversalTypographyControls["justifyMode"])}
                  >
                    <option value="justify-except-last">Justify Except Last</option>
                    <option value="justify-all-lines">Justify All Lines</option>
                  </select>
                </Field>
                <Field label="Justify Engine">
                  <select
                    value={selectedObjectJustifyEngineMode}
                    onChange={(event) =>
                      updateSelectedObjectJustifyEngineMode(event.target.value as UniversalTypographyControls["justifyEngineMode"])
                    }
                  >
                    <option value="newspaper">Newspaper</option>
                    <option value="browser">Browser</option>
                  </select>
                </Field>
              </>
            ) : null}
            {selectedObject === "body" ? (
              <>
                <Field label="Columns">
                  <StagedNumberInput
                    value={articleData.columnCount}
                    min={1}
                    max={6}
                    onCommit={(value) => onArticleChange("columnCount", value)}
                  />
                </Field>
                <label className="property-toggle">
                  <input
                    type="checkbox"
                    checked={compositionSettings.enableDropCap}
                    onChange={(event) => updateCompositionSetting("enableDropCap", event.target.checked)}
                  />
                  Drop Cap
                </label>
                <label className="property-toggle">
                  <input
                    type="checkbox"
                    checked={typographySettings.enableHyphenation}
                    onChange={(event) => updateTypography("enableHyphenation", event.target.checked)}
                  />
                  Hyphenation
                </label>
                <label className="property-toggle">
                  <input
                    type="checkbox"
                    checked={compositionSettings.opticalTypography}
                    onChange={(event) => updateCompositionSetting("opticalTypography", event.target.checked)}
                  />
                  Optical Alignment
                </label>
              </>
            ) : null}
          </PropertyGroup>
        </>
      ) : null}

      {selectedObject === "body" ? (
        <PropertyGroup id="hj" collapsed={collapsedGroups.has("hj")} onToggle={toggleGroup}>
          <Field label="Preset">
            <select
              value={articleData.typography.hjPreset}
              onChange={(event) =>
                applySelectedHyphenationJustificationPreset(event.target.value as HyphenationJustificationPresetName)
              }
            >
              {hjPresetOptions.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Word Spacing Min">
            <StagedNumberInput
              value={articleData.typography.hjWordSpacingMin}
              min={80}
              max={100}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjWordSpacingMin: value })}
            />
          </Field>
          <Field label="Word Spacing Max">
            <StagedNumberInput
              value={articleData.typography.hjWordSpacingMax}
              min={100}
              max={140}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjWordSpacingMax: value })}
            />
          </Field>
          <Field label="Tracking Min">
            <StagedNumberInput
              value={articleData.typography.hjTrackingMin}
              min={-10}
              max={0}
              step={0.5}
              onCommit={(value) => updateCustomHyphenationJustification({ hjTrackingMin: value })}
            />
          </Field>
          <Field label="Tracking Max">
            <StagedNumberInput
              value={articleData.typography.hjTrackingMax}
              min={0}
              max={10}
              step={0.5}
              onCommit={(value) => updateCustomHyphenationJustification({ hjTrackingMax: value })}
            />
          </Field>
          <label className="property-toggle">
              <input
                type="checkbox"
                checked={articleData.typography.hjHyphenation}
                onChange={(event) => updateCustomHyphenationJustification({ hjHyphenation: event.target.checked })}
              />
            Hyphenation
          </label>
          <Field label="Max Hyphens">
            <StagedNumberInput
              value={articleData.typography.hjMaximumConsecutiveHyphens}
              min={0}
              max={6}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjMaximumConsecutiveHyphens: value })}
            />
          </Field>
          <Field label="Min Word">
            <StagedNumberInput
              value={articleData.typography.hjMinimumWordLength}
              min={4}
              max={24}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjMinimumWordLength: value })}
            />
          </Field>
          <Field label="Before Hyphen">
            <StagedNumberInput
              value={articleData.typography.hjMinimumBeforeHyphen}
              min={2}
              max={12}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjMinimumBeforeHyphen: value })}
            />
          </Field>
          <Field label="After Hyphen">
            <StagedNumberInput
              value={articleData.typography.hjMinimumAfterHyphen}
              min={2}
              max={12}
              step={1}
              onCommit={(value) => updateCustomHyphenationJustification({ hjMinimumAfterHyphen: value })}
            />
          </Field>
          <Field label="Optimization">
            <select
              value={articleData.typography.hjOptimizationLevel}
              onChange={(event) =>
                updateCustomHyphenationJustification({
                  hjOptimizationLevel: event.target.value as UniversalTypographyControls["hjOptimizationLevel"],
                })
              }
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
            </select>
          </Field>
          <div className="property-readout">
            <span>Quality</span>
            <strong>{metrics.hjParagraphQuality.toFixed(1)}</strong>
            <span>River</span>
            <strong>{metrics.riverScore.toFixed(1)}</strong>
            <span>Gray Value</span>
            <strong>{metrics.hjGrayValue.toFixed(1)}</strong>
            <span>Gray Balance</span>
            <strong>{metrics.hjGrayBalanceScore.toFixed(1)}</strong>
            <span>Avg Word</span>
            <strong>{metrics.averageSpacing.toFixed(2)}</strong>
            <span>Avg Tracking</span>
            <strong>{metrics.hjAverageTracking.toFixed(2)}</strong>
            <span>Tracking Var</span>
            <strong>{metrics.hjTrackingVariance.toFixed(3)}</strong>
            <span>Gap Var</span>
            <strong>{metrics.hjGapVariance.toFixed(3)}</strong>
            <span>Hyphens</span>
            <strong>{metrics.hjHyphenCount}</strong>
            <span>Passes</span>
            <strong>{metrics.hjOptimizationPasses}</strong>
            <span>Candidates</span>
            <strong>{metrics.hjParagraphCandidates}</strong>
            <span>Accepted</span>
            <strong>{metrics.hjAcceptedCandidates}</strong>
            <span>Rejected</span>
            <strong>{metrics.hjRejectedCandidates}</strong>
            <span>Beam</span>
            <strong>{metrics.hjBeamWidth}</strong>
            <span>Cache</span>
            <strong>{metrics.hjCacheHit ? "Hit" : "Miss"}</strong>
            <span>Optimize</span>
            <strong>{metrics.hjOptimizationTimeMs.toFixed(2)} ms</strong>
            <span>Compose</span>
            <strong>{metrics.hjCompositionTimeMs.toFixed(2)} ms</strong>
            <span>Badness</span>
            <strong>{metrics.hjFinalBadness.toFixed(1)}</strong>
            <span>Candidate</span>
            <strong>{metrics.selectedParagraphCandidate}</strong>
          </div>
        </PropertyGroup>
      ) : null}

      {selectedObject === "image" ? (
        <>
          <PropertyGroup id="image" collapsed={collapsedGroups.has("image")} onToggle={toggleGroup}>
            <label className="property-toggle">
              <input
                type="checkbox"
                checked={imageSettings.imageEnabled}
                onChange={(event) => updateImageSetting("imageEnabled", event.target.checked)}
              />
              Image Enabled
            </label>
            <Field label="Fit">
              <select disabled value="contain">
                <option>Contain</option>
                <option>Fill</option>
                <option>Crop</option>
              </select>
            </Field>
            <Field label="Alignment">
              <select
                value={imageSettings.imageAlignment}
                onChange={(event) => updateImageSetting("imageAlignment", event.target.value as StoryImageAlignment)}
              >
                {imageAlignments.map((alignment) => (
                  <option key={alignment} value={alignment}>{alignment}</option>
                ))}
              </select>
            </Field>
            <Field label="Image Width">
              <StagedNumberInput
                value={imageSettings.imageColumnSpan}
                min={1}
                max={maxImageColumnSpan}
                onCommit={(value) => updateImageSetting("imageColumnSpan", value)}
              />
            </Field>
            <Field label="Image Height">
              <StagedNumberInput
                value={imageSettings.imageHeight}
                min={1}
                max={maxImageHeight}
                onCommit={(value) => updateImageSetting("imageHeight", value)}
              />
            </Field>
            <Field label="Wrap">
              <select
                value={imageSettings.imageWrapMode}
                onChange={(event) => updateImageSetting("imageWrapMode", event.target.value as StoryImageWrapMode)}
              >
                {imageWrapModes.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </Field>
            <Field label="Shape">
              <select
                value={imageSettings.imageShapeType ?? "rectangle"}
                onChange={(event) => applyContourPreset(event.target.value as StoryImageShapeType)}
              >
                {imageShapeTypes.map((shapeType) => (
                  <option key={shapeType} value={shapeType}>{shapeType}</option>
                ))}
              </select>
            </Field>
            <div className="property-field property-field-wide">
              <span>Shape Preview</span>
              <div
                className={`image-shape-preview image-shape-preview-${imageSettings.imageShapeType ?? "rectangle"}`}
                onPointerDown={handleImageCropPointerDown}
                onPointerMove={handleImageCropPointerMove}
                onPointerUp={handleImageCropPointerEnd}
                onPointerCancel={handleImageCropPointerEnd}
                onWheel={handleImageCropWheel}
              >
                <div
                  className="image-shape-preview-media"
                  style={{
                    opacity: imageCrop.opacity,
                    transform: `translate(${imageCrop.x}px, ${imageCrop.y}px) scale(${imageCrop.zoom}) rotate(${imageCrop.rotation}deg)`,
                  }}
                />
                <span>IMAGE</span>
              </div>
            </div>
            <Field label="Crop X">
              <StagedNumberInput
                value={imageCrop.x}
                min={-300}
                max={300}
                step={1}
                onCommit={(value) => updateImageCrop({ x: value })}
              />
            </Field>
            <Field label="Crop Y">
              <StagedNumberInput
                value={imageCrop.y}
                min={-300}
                max={300}
                step={1}
                onCommit={(value) => updateImageCrop({ y: value })}
              />
            </Field>
            <Field label="Zoom">
              <StagedNumberInput
                value={imageCrop.zoom}
                min={0.1}
                max={5}
                step={0.05}
                onCommit={(value) => updateImageCrop({ zoom: value })}
              />
            </Field>
            <Field label="Rotate">
              <StagedNumberInput
                value={imageCrop.rotation}
                min={-180}
                max={180}
                step={1}
                onCommit={(value) => updateImageCrop({ rotation: value })}
              />
            </Field>
            {imageSettings.imageWrapMode === "contour" ? (
              <>
                <Field label="Text Offset">
                  <StagedNumberInput
                    value={imageSettings.wrapTextOffset ?? 1}
                    min={0}
                    max={36}
                    step={0.25}
                    onCommit={(value) => updateImageSetting("wrapTextOffset", value)}
                  />
                </Field>
                <div className="property-field property-field-wide">
                  <span>Anchor Points</span>
                  <StagedTextarea
                    value={contourText}
                    placeholder="0,0 1,0 1,1 0,1"
                    onCommit={(value) => updateImageSetting("wrapContourPoints", parseContourPoints(value))}
                  />
                </div>
                <div className="property-field property-field-wide">
                  <span>Contour Preset</span>
                  <div className="property-button-row">
                    {imageShapeTypes.map((shapeType) => (
                      <button
                        key={shapeType}
                        type="button"
                        onClick={() => applyContourPreset(shapeType)}
                      >
                        {shapeType}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <label className="property-toggle">
              <input
                type="checkbox"
                checked={imageSettings.autoSizeImage}
                onChange={(event) => updateImageSetting("autoSizeImage", event.target.checked)}
              />
              Lock Ratio / Auto Size
            </label>
          </PropertyGroup>
          <PropertyGroup id="effects" collapsed={collapsedGroups.has("effects")} onToggle={toggleGroup}>
            <Field label="Opacity">
              <StagedRangeInput value={1} min={0} max={1} step={0.05} onCommit={() => undefined} />
            </Field>
            <Field label="Border Width">
              <StagedNumberInput disabled value={1} onCommit={() => undefined} />
            </Field>
            <Field label="Border Color">
              <StagedColorInput readOnly value="#d9d3c8" />
            </Field>
          </PropertyGroup>
        </>
      ) : null}

      {selectedObject === "caption" || selectedObject === "credit" || selectedObject === "source" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={articleData.caption.enabled}
              onChange={(event) => updateCaption({ enabled: event.target.checked })}
            />
            Show Caption
          </label>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={articleData.caption.showCredit}
              onChange={(event) => updateCaption({ showCredit: event.target.checked })}
            />
            Show Credit
          </label>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={articleData.caption.showSource}
              onChange={(event) => updateCaption({ showSource: event.target.checked })}
            />
            Show Source
          </label>
          <Field label="Caption Position">
            <select
              value={articleData.caption.position}
              onChange={(event) => updateCaption({ position: event.target.value as CaptionPosition })}
            >
              {captionPositions.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </Field>
          <Field label="Prefix Label">
            <StagedTextInput
              value={
                selectedObject === "source"
                  ? articleData.caption.labels.source
                  : selectedObject === "credit"
                    ? articleData.caption.labels.credit
                    : articleData.caption.labels.caption
              }
              onCommit={(value) =>
                updateCaption({
                  labels: {
                    [selectedObject === "source" ? "source" : selectedObject === "credit" ? "credit" : "caption"]:
                      value,
                  },
                })
              }
            />
          </Field>
        </PropertyGroup>
      ) : null}

      {selectedObject === "factBox" || selectedObject === "factBoxContent" || selectedObject === "factBoxHeading" || selectedObject === "headline" || selectedObject === "body" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={compositionSettings.enableFactBox}
              onChange={(event) => updateCompositionSetting("enableFactBox", event.target.checked)}
            />
            Enable Fact Box
          </label>
          <Field label="Background">
            <StagedColorInput readOnly value={articleData.factBoxTheme.background} />
          </Field>
          <Field label="Border">
            <StagedColorInput readOnly value={articleData.factBoxTheme.border} />
          </Field>
          <Field label="Bullet Style">
            <select disabled value="disc">
              <option>Disc</option>
            </select>
          </Field>
        </PropertyGroup>
      ) : null}

      {selectedObject === "pullQuote" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={compositionSettings.enablePullQuote}
              onChange={(event) => updateCompositionSetting("enablePullQuote", event.target.checked)}
            />
            Enable Pull Quote
          </label>
          <Field label="Quote Marks">
            <select disabled value="classic">
              <option>Classic</option>
            </select>
          </Field>
          <Field label="Background">
            <StagedColorInput readOnly value={articleData.pullQuoteTheme.backgroundColor} />
          </Field>
        </PropertyGroup>
      ) : null}

      {selectedObject === "kicker" || selectedObject === "strap" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <label className="property-toggle">
            <input
              type="checkbox"
              checked={articleData[selectedObject].enabled}
              onChange={(event) =>
                onArticleChange(selectedObject, {
                  ...articleData[selectedObject],
                  enabled: event.target.checked,
                })
              }
            />
            Show {selectedLabel}
          </label>
        </PropertyGroup>
      ) : null}

      {selectedObject === "byline" || selectedObject === "location" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <Field label="Reporter">
            <StagedTextInput value={articleData.author} onCommit={(value) => onArticleChange("author", value)} />
          </Field>
          <Field label="Location">
            <StagedTextInput value={articleData.location} onCommit={(value) => onArticleChange("location", value)} />
          </Field>
          <Field label="Agency">
            <StagedTextInput value={articleData.agency} onCommit={(value) => onArticleChange("agency", value)} />
          </Field>
        </PropertyGroup>
      ) : null}

      {selectedObject === "pageHeader" || selectedObject === "pageFooter" || selectedObject === "pageNumber" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <Field label="Page Type">
            <select value={pageType} onChange={(event) => onPageTypeChange(event.target.value as PageType)}>
              {pageTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </Field>
          <div className="property-readout">
            <span>Page Width</span>
            <strong>{pageMaster.width} in</strong>
            <span>Page Height</span>
            <strong>{pageMaster.height} in</strong>
            <span>Header</span>
            <strong>{pageMaster.headerHeight} in</strong>
            <span>Footer</span>
            <strong>{pageMaster.footerHeight} in</strong>
          </div>
        </PropertyGroup>
      ) : null}

      {selectedObject === "advertisement" ? (
        <PropertyGroup id="layout" collapsed={collapsedGroups.has("layout")} onToggle={toggleGroup}>
          <p className="property-empty-state">Advertisement objects are reserved for a future ad workflow.</p>
        </PropertyGroup>
      ) : null}

      <PropertyGroup id="spacing" collapsed={collapsedGroups.has("spacing")} onToggle={toggleGroup}>
        <Field label="Story Priority">
          <select value={storyPriority} onChange={(event) => onStoryPriorityChange(event.target.value as StoryFrame["priority"])}>
            {storyPriorities.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
        </Field>
        <Field label="Story Width">
          <select
            value={storyColumnSpan}
            onChange={(event) => onStoryColumnSpanChange(Number(event.target.value) as StoryColumnSpan)}
          >
            {storyColumnSpans.map((span) => (
              <option key={span} value={span}>{span} columns</option>
            ))}
          </select>
        </Field>
        {paragraphBinding.letterSpacingKey ? (
          <>
            <Field label="Tracking">
              <div className="condense-expand-control">
                <input
                  type="range"
                  min={-50}
                  max={100}
                  step={1}
                  value={selectedObjectTracking}
                  onChange={(event) => updateSelectedObjectTracking(Number(event.target.value))}
                />
                <StagedNumberInput
                  value={selectedObjectTracking}
                  min={-50}
                  max={100}
                  step={1}
                  onCommit={updateSelectedObjectTracking}
                />
              </div>
            </Field>
            <Field label="Character Spacing">
              <div className="condense-expand-control">
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={selectedObjectLetterSpacing}
                  onChange={(event) => updateSelectedObjectLetterSpacing(Number(event.target.value))}
                />
                <StagedNumberInput
                  value={selectedObjectLetterSpacing}
                  min={-100}
                  max={100}
                  step={1}
                  onCommit={updateSelectedObjectLetterSpacing}
                />
              </div>
            </Field>
            <Field label="Condense / Expand">
              <div className="property-readout property-readout-inline">
                <span>{selectedObjectTracking < 0 ? "Condensed" : selectedObjectTracking > 0 ? "Expanded" : "Normal"}</span>
                <strong>{selectedObjectTracking}</strong>
              </div>
            </Field>
          </>
        ) : null}
        {paragraphBinding.supportsParagraphSpacing ? (
          <>
            <Field label="Paragraph Gap">
              <StagedNumberInput
                value={articleData.typography.paragraphGap}
                min={0}
                max={36}
                onCommit={(value) => updateUniversalTypography({ paragraphGap: value })}
              />
            </Field>
            <Field label="First Line Indent">
              <StagedNumberInput
                value={articleData.typography.firstLineIndent}
                min={0}
                max={72}
                onCommit={(value) => updateUniversalTypography({ firstLineIndent: value })}
              />
            </Field>
          </>
        ) : null}
      </PropertyGroup>

      <PropertyGroup id="advanced" collapsed={collapsedGroups.has("advanced")} onToggle={toggleGroup}>
        <div className="property-readout">
          <span>Headline Lines</span>
          <strong>{metrics.headlineLines}</strong>
          <span>Body Lines</span>
          <strong>{metrics.bodyLines}</strong>
          <span>Fill</span>
          <strong>{metrics.fillPercentage.toFixed(1)}%</strong>
          <span>Overflow</span>
          <strong>{metrics.overflow ? "Yes" : "No"}</strong>
          <span>Density</span>
          <strong>{metrics.storyDensityPercent.toFixed(1)}%</strong>
          <span>Lead Score</span>
          <strong>{dominanceMetrics.leadDominanceScore.toFixed(1)}</strong>
          <span>Page Utilization</span>
          <strong>{pageDiagnostics.pageUtilizationPercent.toFixed(1)}%</strong>
          <span>Render</span>
          <strong>{performanceDiagnostics.renderTimeMs.toFixed(2)} ms</strong>
          <span>Body Renderer</span>
          <strong>{compositionSettings.bodyRendererMode === "segmented" ? "Legacy" : "Line"}</strong>
          <span>Default Headline</span>
          <strong>{priorityStyle.headlineSize} pt</strong>
        </div>
        <Field label="Body Renderer">
          <select
            value={compositionSettings.bodyRendererMode ?? "line"}
            onChange={(event) =>
              updateCompositionSetting(
                "bodyRendererMode",
                event.target.value as NonNullable<ArticleCompositionSettings["bodyRendererMode"]>,
              )
            }
          >
            <option value="line">Line Renderer</option>
            <option value="segmented">Segmented Legacy</option>
          </select>
        </Field>
      </PropertyGroup>

      <PropertyGroup id="fonts" collapsed={collapsedGroups.has("fonts")} onToggle={toggleGroup}>
        <FontDiagnosticsPanel fontManager={fontManager} compact />
      </PropertyGroup>

        </>
      )}

      <footer className="properties-footer">
        <button type="button" onClick={onResetTypography}>
          <RotateCcw size={14} />
          Reset
        </button>
        <button type="button" onClick={() => updateCompositionSetting("showRegionDebug", !compositionSettings.showRegionDebug)}>
          <Settings2 size={14} />
          Debug
        </button>
        <button type="button" disabled title="History engine integration pending">
          <SlidersHorizontal size={14} />
          Undo Step
        </button>
      </footer>
    </aside>
  );
}
