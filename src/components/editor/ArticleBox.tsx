"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Image as KonvaImage, Line, Rect, Shape, Text } from "react-konva";
import type {
  ArticleBoxModel,
  ArticleLayout,
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleTextStyle,
  EditorObjectType,
  EditorSelectionBounds,
  Point,
  ResizeHandle,
  Size,
} from "@/types/editor";
import type { PerformanceProfiler } from "@/engines/PerformanceProfiler/PerformanceProfilerEngine";
import type { LiveResizeHandle, LiveResizePointer } from "@/engines/LayoutTransactionEngine/LiveResizeController";
import { layoutFrameTextBlock } from "@/engines/FrameLayout/FrameLayoutEngine";
import {
  snapFrameDrag,
  snapFrameResize,
} from "@/engines/FrameLayout/FrameLayoutInteractionEngine";
import type {
  FrameLayoutContext,
  FrameLayoutPreview,
  FrameLayoutRect,
} from "@/engines/FrameLayout/FrameLayoutInteractionTypes";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { createCanvasFontString } from "@/engines/TypographyEngine/TextMeasure";
import { computeImageCoverCrop } from "@/engines/ImagePlacement/computeImageCoverCrop";
import { isYouthUpdatePortalSession } from "@/engines/MasterPage/YouthUpdateConfig";
import { useEditorStore } from "@/store/editorStore";
import { FactBox } from "./FactBox";
import { PullQuote } from "./PullQuote";

const HANDLE_SIZE = 10;
const MIN_SIZE: Size = {
  width: 180,
  height: 240,
};

const performanceNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const handleCursors: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

const handleGeometryRules: Record<
  ResizeHandle,
  {
    canModifyX: boolean;
    canModifyY: boolean;
    canModifyWidth: boolean;
    canModifyHeight: boolean;
  }
> = {
  nw: { canModifyX: true, canModifyY: true, canModifyWidth: true, canModifyHeight: true },
  n: { canModifyX: false, canModifyY: true, canModifyWidth: false, canModifyHeight: true },
  ne: { canModifyX: false, canModifyY: true, canModifyWidth: true, canModifyHeight: true },
  e: { canModifyX: false, canModifyY: false, canModifyWidth: true, canModifyHeight: false },
  se: { canModifyX: false, canModifyY: false, canModifyWidth: true, canModifyHeight: true },
  s: { canModifyX: false, canModifyY: false, canModifyWidth: false, canModifyHeight: true },
  sw: { canModifyX: true, canModifyY: false, canModifyWidth: true, canModifyHeight: true },
  w: { canModifyX: true, canModifyY: false, canModifyWidth: true, canModifyHeight: false },
};

type ArticleBoxProps = {
  articleBox: ArticleBoxModel;
  layout: ArticleLayout;
  selected: boolean;
  selectedObjectType: EditorObjectType;
  selectedParagraphIndex?: number;
  priorityLabel?: string;
  showPriorityLabel?: boolean;
  showCompositionOverlays?: boolean;
  bodyRendererMode?: "line" | "segmented";
  contentMode?: boolean;
  interactionEnabled?: boolean;
  frameLayoutContext?: FrameLayoutContext;
  renderProfiler?: PerformanceProfiler;
  imageSource?: string;
  smartLayoutEnabled?: boolean;
  onSelect: (additive?: boolean) => void;
  onSelectObject: (objectType: EditorObjectType, bounds: EditorSelectionBounds, additive?: boolean) => void;
  onSelectParagraph?: (paragraphIndex: number, bounds: EditorSelectionBounds) => void;
  onEditObject: (objectType: EditorObjectType, bounds: EditorSelectionBounds) => void;
  onContextMenu: (clientX: number, clientY: number) => void;
  onRequestImageReplace?: (clientX: number, clientY: number) => void;
  onMove: (position: Point) => void;
  onResize: (articleBox: ArticleBoxModel) => void;
  onBeginLiveMove?: (articleBox: ArticleBoxModel, pointer: LiveResizePointer) => void;
  onUpdateLiveMove?: (pointer: LiveResizePointer) => void;
  onEndLiveMove?: () => void;
  onCancelLiveMove?: () => void;
  onBeginLiveResize?: (
    articleBox: ArticleBoxModel,
    handle: LiveResizeHandle,
    pointer: LiveResizePointer,
  ) => void;
  onUpdateLiveResize?: (pointer: LiveResizePointer) => void;
  onEndLiveResize?: () => void;
  onCancelLiveResize?: () => void;
};

const RemoteStoryImage = memo(function RemoteStoryImage({
  source,
  x,
  y,
  width,
  height,
  opacity = 1,
  cropOverride,
  fit = "cover",
}: {
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  cropOverride?: { x?: number; y?: number; width?: number; height?: number };
  fit?: "cover" | "contain";
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }

    let active = true;
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => {
      if (active) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (active) {
        setImage(null);
      }
    };
    nextImage.src = source;

    return () => {
      active = false;
    };
  }, [source]);

  if (!image) {
    return null;
  }

  const crop =
    fit === "contain"
      ? {
          sourceX: 0,
          sourceY: 0,
          sourceWidth: image.width,
          sourceHeight: image.height,
        }
      : cropOverride && cropOverride.width && cropOverride.height
      ? {
          sourceX: cropOverride.x ?? 0,
          sourceY: cropOverride.y ?? 0,
          sourceWidth: cropOverride.width,
          sourceHeight: cropOverride.height,
        }
      : computeImageCoverCrop({
          sourceWidth: image.width,
          sourceHeight: image.height,
          frameWidth: width,
          frameHeight: height,
          // Matches composeArticleBox.ts's own bias -- a dead-centre crop
          // cuts evenly off top and bottom, which reads as the subject's
          // head being cut off for a typical news photo.
          focalPointY: 0.3,
        });
  const containScale = fit === "contain" ? Math.min(width / image.width, height / image.height) : 1;
  const renderWidth = fit === "contain" ? image.width * containScale : width;
  const renderHeight = fit === "contain" ? image.height * containScale : height;

  return (
    <KonvaImage
      image={image}
      x={x + (width - renderWidth) / 2}
      y={y + (height - renderHeight) / 2}
      width={renderWidth}
      height={renderHeight}
      crop={{
        x: crop.sourceX,
        y: crop.sourceY,
        width: crop.sourceWidth,
        height: crop.sourceHeight,
      }}
      opacity={opacity}
      listening={false}
    />
  );
});

type ResizeSession = {
  handle: ResizeHandle;
  startArticleBox: ArticleBoxModel;
  startPointer: Point;
};

type FrameInteractionMode = "drag" | "resize";

type FrameInteractionState = {
  mode: FrameInteractionMode;
  preview: FrameLayoutPreview;
};

const setCursor = (stage: Konva.Stage | null, cursor: string) => {
  if (!stage) {
    return;
  }

  stage.container().style.cursor = cursor;
};

const getHandlePosition = (handle: ResizeHandle, articleBox: ArticleBoxModel): Point => {
  const centerX = articleBox.width / 2;
  const centerY = articleBox.height / 2;

  const positions: Record<ResizeHandle, Point> = {
    nw: { x: 0, y: 0 },
    n: { x: centerX, y: 0 },
    ne: { x: articleBox.width, y: 0 },
    e: { x: articleBox.width, y: centerY },
    se: { x: articleBox.width, y: articleBox.height },
    s: { x: centerX, y: articleBox.height },
    sw: { x: 0, y: articleBox.height },
    w: { x: 0, y: centerY },
  };

  return positions[handle];
};

const getPointerInPageCoordinates = (node: Konva.Node): Point | null => {
  const stage = node.getStage();
  const pageGroup = node.getParent()?.getParent();
  const pointer = stage?.getPointerPosition();

  if (!pageGroup || !pointer) {
    return null;
  }

  return pageGroup.getAbsoluteTransform().copy().invert().point(pointer);
};

const resizeFromHandle = (
  handle: ResizeHandle,
  startArticleBox: ArticleBoxModel,
  delta: Point,
): ArticleBoxModel => {
  const rule = handleGeometryRules[handle];
  const nextArticleBox = { ...startArticleBox };

  if (rule.canModifyWidth && !rule.canModifyX) {
    nextArticleBox.width = Math.max(MIN_SIZE.width, startArticleBox.width + delta.x);
  }

  if (rule.canModifyHeight && !rule.canModifyY) {
    nextArticleBox.height = Math.max(MIN_SIZE.height, startArticleBox.height + delta.y);
  }

  if (rule.canModifyX) {
    const width = Math.max(MIN_SIZE.width, startArticleBox.width - delta.x);
    nextArticleBox.x = startArticleBox.x + startArticleBox.width - width;
    nextArticleBox.width = width;
  }

  if (rule.canModifyY) {
    const height = Math.max(MIN_SIZE.height, startArticleBox.height - delta.y);
    nextArticleBox.y = startArticleBox.y + startArticleBox.height - height;
    nextArticleBox.height = height;
  }

  return nextArticleBox;
};

const toFrameLayoutRect = (articleBox: ArticleBoxModel, id: string): FrameLayoutRect => ({
  id,
  x: articleBox.x,
  y: articleBox.y,
  width: articleBox.width,
  height: articleBox.height,
});

const getHighlightPadding = (fontSize: number) => ({
  x: Math.min(5, Math.max(3, fontSize * 0.24)),
  y: Math.min(3, Math.max(2, fontSize * 0.13)),
  radius: 2,
});

const sanitizeRenderedText = (text: string) =>
  text
    .replace(/_*BYLINE[\s_-]*DOT_*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const BODY_CANVAS_BASELINE_RATIO = 0.78;
const DEBUG_BODY_TYPOGRAPHY =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEBUG_BODY_TYPOGRAPHY === "true";
const DEBUG_HEADLINE_PIPELINE =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEBUG_HEADLINE_PIPELINE === "true";

const defaultImageShapePoints = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const starImageShapePoints = Array.from({ length: 10 }).map((_, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI) / 5;
  const radius = index % 2 === 0 ? 0.5 : 0.22;

  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius,
  };
});

const heartImageShapePoints = [
  { x: 0.5, y: 0.95 },
  { x: 0.08, y: 0.58 },
  { x: 0.05, y: 0.22 },
  { x: 0.26, y: 0.08 },
  { x: 0.5, y: 0.28 },
  { x: 0.74, y: 0.08 },
  { x: 0.95, y: 0.22 },
  { x: 0.92, y: 0.58 },
];

const polygonImageShapePoints = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0.35 },
  { x: 0.82, y: 1 },
  { x: 0.18, y: 1 },
  { x: 0, y: 0.35 },
];

const getImageShapePoints = (image: ArticleLayout["image"]) => {
  if (!image) {
    return defaultImageShapePoints;
  }

  if (image.shapePoints?.length) {
    return image.shapePoints;
  }

  if (image.shapeType === "star") {
    return starImageShapePoints;
  }

  if (image.shapeType === "heart") {
    return heartImageShapePoints;
  }

  if (image.shapeType === "polygon" || image.shapeType === "custom-path") {
    return polygonImageShapePoints;
  }

  return defaultImageShapePoints;
};

const renderImageShapePath = (
  context: Konva.Context,
  image: NonNullable<ArticleLayout["image"]>,
) => {
  const nativeContext = (
    context as unknown as {
      _context?: CanvasRenderingContext2D;
    }
  )._context;

  if (image.shapeType === "ellipse" && nativeContext) {
    nativeContext.beginPath();
    nativeContext.ellipse(
      image.x + image.width / 2,
      image.y + image.height / 2,
      image.width / 2,
      image.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }

  const points = getImageShapePoints(image);
  context.beginPath();
  points.forEach((point, index) => {
    const x = image.x + point.x * image.width;
    const y = image.y + point.y * image.height;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
};

const drawBodyLine = (
  nativeContext: CanvasRenderingContext2D,
  line: ArticleLayoutTextLine,
) => {
  const drawStyle = line.segments?.[0]?.style ?? line.style;

  nativeContext.save();
  nativeContext.font = createCanvasFontString(
    drawStyle.fontFamily,
    drawStyle.fontSize,
    drawStyle.fontStyle ?? "normal",
  );
  nativeContext.fillStyle = drawStyle.fill;
  nativeContext.globalAlpha = drawStyle.opacity ?? 1;
  nativeContext.textAlign = "left";
  nativeContext.textBaseline = "alphabetic";
  nativeContext.direction = "ltr";
  // The composer wraps this copy with the style's tracking applied, so the
  // renderer has to measure and draw with the same tracking or the two
  // disagree about how wide a line is. With negative tracking (the Youth
  // UPDATE English body carries some) the words measured wider here than the
  // composer had budgeted, the justification gap clamped to zero, and the
  // words printed touching each other. Canvas letterSpacing is part of the
  // saved state, so the restore() below puts it back.
  if (drawStyle.letterSpacing) {
    (nativeContext as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${drawStyle.letterSpacing}px`;
  }

  if (line.style.align === "justify" && line.justify && (!line.segments || line.segments.length === 0)) {
    const text = line.text.trim();
    const words = text.split(/\s+/u).filter(Boolean);

    if (words.length > 1) {
      const wordWidths = words.map((word) => nativeContext.measureText(word).width);
      const totalWordWidth = wordWidths.reduce((sum, width) => sum + width, 0);
      // Bound the LINE, not just the gap.
      //
      // Clamping only the gap at 0 stops words overlapping but does nothing to
      // stop the cursor: when the words measure wider here than the composer
      // budgeted, each one still draws at its full width and the last of them
      // prints past `line.width`, across the gutter and into the next column.
      // Hyphenation cannot prevent this -- it runs at wrap time, and by here
      // the composer has already decided the line fits.
      //
      // Condensing to the measure makes the overflow structurally impossible
      // whatever the size of the disagreement. scaleX is the same lever the
      // kicker fitter and the body condenser already use, and both renderers
      // honour it, so this changes no other behaviour: with no overshoot the
      // factor is exactly 1 and the drawing below is byte-for-byte what it was.
      const lineScaleX =
        totalWordWidth > line.width && totalWordWidth > 0 ? line.width / totalWordWidth : 1;
      const justifyWidth = lineScaleX < 1 ? totalWordWidth : line.width;
      const gap = Math.max(0, (justifyWidth - totalWordWidth) / (words.length - 1));
      let cursor = 0;

      if (lineScaleX < 1) {
        nativeContext.scale(lineScaleX, 1);
      }
      words.forEach((word, index) => {
        nativeContext.fillText(word, cursor, drawStyle.fontSize * BODY_CANVAS_BASELINE_RATIO);
        cursor += wordWidths[index] + gap;
      });
      nativeContext.restore();
      return;
    }
  }

  nativeContext.restore();

  const segments = line.segments && line.segments.length > 0
    ? line.segments
    : [
        {
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          text: line.text,
          style: line.style,
        },
      ];

  for (const segment of segments) {
    nativeContext.save();
    nativeContext.font = createCanvasFontString(
      segment.style.fontFamily,
      segment.style.fontSize,
      segment.style.fontStyle ?? "normal",
    );
    nativeContext.fillStyle = segment.style.fill;
    nativeContext.globalAlpha = segment.style.opacity ?? 1;
    nativeContext.textAlign = "left";
    nativeContext.textBaseline = "alphabetic";
    nativeContext.direction = "ltr";
    const localX = segment.x - line.x;
    const localY = segment.y - line.y;

    // Same bound as the justified branch above, for the lines that never reach
    // it: an unjustified last line of a paragraph, or a single-word line, is
    // drawn here with no width limit, so an overshoot still crossed the gutter.
    const segmentBaselineY = localY + segment.style.fontSize * BODY_CANVAS_BASELINE_RATIO;
    const segmentTextWidth = nativeContext.measureText(segment.text).width;
    if (segment.width > 0 && segmentTextWidth > segment.width) {
      nativeContext.save();
      nativeContext.translate(localX, 0);
      nativeContext.scale(segment.width / segmentTextWidth, 1);
      nativeContext.fillText(segment.text, 0, segmentBaselineY);
      nativeContext.restore();
    } else {
      nativeContext.fillText(segment.text, localX, segmentBaselineY);
    }

    if (segment.style.textDecoration === "underline") {
      const underlineY = localY + segment.style.fontSize * 1.08;
      nativeContext.beginPath();
      nativeContext.moveTo(localX, underlineY);
      nativeContext.lineTo(localX + segment.width, underlineY);
      nativeContext.lineWidth = Math.max(1, segment.style.fontSize * 0.06);
      nativeContext.strokeStyle = segment.style.fill;
      nativeContext.stroke();
    }

    nativeContext.restore();
  }
};

const toBounds =(block: ArticleLayoutTextBlock | null | undefined): EditorSelectionBounds | null => {
  if (!block) {
    return null;
  }

  const frameBounds = layoutFrameTextBlock(block).frameBounds;

  return {
    x: frameBounds?.x ?? block.x,
    y: frameBounds?.y ?? block.y,
    width: frameBounds?.width ?? block.width,
    height: frameBounds?.height ?? block.height,
  };
};

const combineBounds = (bounds: (EditorSelectionBounds | null | undefined)[]): EditorSelectionBounds | null => {
  const available = bounds.filter((bound): bound is EditorSelectionBounds => Boolean(bound));

  if (available.length === 0) {
    return null;
  }

  const left = Math.min(...available.map((bound) => bound.x));
  const top = Math.min(...available.map((bound) => bound.y));
  const right = Math.max(...available.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...available.map((bound) => bound.y + bound.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const getSelectableObjectBounds = (layout: ArticleLayout): { type: EditorObjectType; bounds: EditorSelectionBounds }[] => {
  const entries: { type: EditorObjectType; bounds: EditorSelectionBounds | null }[] = [
    { type: "kicker", bounds: layout.kicker ? { x: layout.kicker.x, y: layout.kicker.y, width: layout.kicker.width, height: layout.kicker.height } : null },
    { type: "strap", bounds: layout.strap ? { x: layout.strap.x, y: layout.strap.y, width: layout.strap.width, height: layout.strap.height } : null },
    { type: "headline", bounds: toBounds(layout.headline) },
    { type: "subheadline", bounds: toBounds(layout.subheadline) },
    { type: "byline", bounds: toBounds(layout.byline) },
    { type: "caption", bounds: toBounds(layout.caption?.textBlock) },
    { type: "credit", bounds: toBounds(layout.caption?.creditBlock) },
    { type: "source", bounds: toBounds(layout.caption?.sourceBlock) },
    { type: "body", bounds: layout.body ? { x: layout.body.x, y: layout.body.y, width: layout.body.width, height: layout.body.height } : null },
    { type: "factBox", bounds: layout.factBox ? { x: layout.factBox.x, y: layout.factBox.y, width: layout.factBox.width, height: layout.factBox.height } : null },
    { type: "factBoxHeading", bounds: toBounds(layout.factBox?.headline) },
    { type: "factBoxContent", bounds: combineBounds(layout.factBox?.bullets.map(toBounds) ?? []) },
    { type: "pullQuote", bounds: layout.pullQuote ? { x: layout.pullQuote.x, y: layout.pullQuote.y, width: layout.pullQuote.width, height: layout.pullQuote.height } : null },
    // Rendered last so its hit-region wins over the body's bounding box where
    // text runs around the photo and the two boxes overlap (click-target
    // z-order only — layout.image's own x/y/width/height is untouched).
    { type: "image", bounds: layout.image ? { x: layout.image.x, y: layout.image.y, width: layout.image.width, height: layout.image.height } : null },
    { type: "image", bounds: layout.editorialFloatImage ? { x: layout.editorialFloatImage.x, y: layout.editorialFloatImage.y, width: layout.editorialFloatImage.width, height: layout.editorialFloatImage.height } : null },
  ];

  return entries.filter((entry): entry is { type: EditorObjectType; bounds: EditorSelectionBounds } =>
    Boolean(entry.bounds && entry.bounds.width > 0 && entry.bounds.height > 0),
  );
};

const renderTextBlock = (
  block: ArticleLayoutTextBlock,
  showCompositionOverlays = true,
  profiler?: PerformanceProfiler,
  stageName?: string,
  storyId?: string,
) => {
  const startedAt = performanceNow();
  const frameLayout = layoutFrameTextBlock(block);
  const displayBlock = frameLayout.block;
  const frameBounds = frameLayout.frameBounds;
  const isDisplayDevanagariText = (text: string, style: ArticleTextStyle) =>
    /[\u0900-\u097F]/u.test(text) &&
    (style.fontSize >= 13 ||
      /\b(600|700|800|900|bold)\b/i.test(style.fontStyle ?? "") ||
      Boolean(style.backgroundColor && style.backgroundColor !== "transparent"));
  const getDisplayInkShiftY = (text: string, style: ArticleTextStyle) =>
    isDisplayDevanagariText(text, style)
      ? Math.min(4, Math.max(2, style.fontSize * 0.1))
      : 0;
  const clipBleed = Math.min(12, Math.max(5, displayBlock.style.fontSize * 0.24));
  const rendered = (
    <Group
      clipX={displayBlock.x}
      clipY={displayBlock.y - clipBleed}
      clipWidth={displayBlock.width}
      clipHeight={displayBlock.height + clipBleed * 2}
    >
      {displayBlock.containerStyle && frameBounds ? (
        <Rect
          x={frameBounds.x}
          y={frameBounds.y}
          width={frameBounds.width}
          height={frameBounds.height}
          fill={
            displayBlock.containerStyle.containerBackgroundColor === "transparent"
              ? undefined
              : displayBlock.containerStyle.containerBackgroundColor
          }
          opacity={displayBlock.containerStyle.containerOpacity}
          stroke={
            displayBlock.containerStyle.containerBorderWidth > 0
              ? displayBlock.containerStyle.containerBorderColor
              : undefined
          }
          strokeWidth={displayBlock.containerStyle.containerBorderWidth}
          dash={frameLayout.borderDash}
          cornerRadius={
            displayBlock.containerStyle.mode === "pill"
              ? frameBounds.height / 2
              : displayBlock.containerStyle.containerBorderRadius
          }
          listening={false}
        />
      ) : null}
      {displayBlock.lineBoxes.map((line, index) =>
        line.segments && line.segments.length > 0 ? (
          <Group key={`${line.text}-${index}`} x={line.x} y={line.y} scaleX={line.scaleX ?? 1}>
            {line.segments.map((segment, segmentIndex) =>
              segment.style.backgroundColor ? (
                (() => {
                  const padding = getHighlightPadding(segment.style.fontSize);

                  return (
                    <Rect
                      key={`${segment.text}-${index}-${segmentIndex}-background`}
                      x={segment.x - line.x - padding.x}
                      y={segment.y - line.y - padding.y / 2}
                      width={segment.width + padding.x * 2}
                      height={segment.height + padding.y}
                      fill={segment.style.backgroundColor}
                      opacity={segment.style.opacity}
                      cornerRadius={padding.radius}
                      listening={false}
                    />
                  );
                })()
              ) : null,
            )}
            {line.segments.map((segment, segmentIndex) =>
              segment.role === "byline-dot" ||
              segment.text.trim() === "\u2022" ||
              /_*BYLINE[\s_-]*DOT_*/i.test(segment.text.trim()) ? (
                <Circle
                  key={`${segment.text}-${index}-${segmentIndex}`}
                  x={segment.x - line.x + segment.width / 2}
                  y={segment.y - line.y + segment.height * 0.56}
                  radius={Math.max(1.8, segment.style.fontSize * 0.22)}
                  fill={segment.style.fill}
                  opacity={segment.style.opacity}
                  listening={false}
                />
              ) : (
                <Text
                  key={`${segment.text}-${index}-${segmentIndex}`}
                  x={segment.x - line.x}
                  y={segment.y - line.y + getDisplayInkShiftY(segment.text, segment.style)}
                  height={segment.height}
                  text={sanitizeRenderedText(segment.text)}
                  {...(segment.constrainWidth === false ? {} : { width: segment.width })}
                  {...segment.style}
                  opacity={segment.style.opacity}
                  textDecoration={segment.style.textDecoration}
                  wrap="none"
                  listening={false}
                  perfectDrawEnabled={false}
                />
              ),
            )}
          </Group>
        ) : (
          <Group key={`${line.text}-${index}`} x={line.x} y={line.y} scaleX={line.scaleX ?? 1}>
            {line.style.backgroundColor
              ? (() => {
                  const padding = getHighlightPadding(line.style.fontSize);

                  return (
                    <Rect
                      x={-padding.x}
                      y={-padding.y / 2}
                      width={line.width + padding.x * 2}
                      height={line.height + padding.y}
                      fill={line.style.backgroundColor}
                      opacity={line.style.opacity}
                      cornerRadius={padding.radius}
                      listening={false}
                    />
                  );
                })()
              : null}
            <Text
              x={0}
              y={getDisplayInkShiftY(line.text, line.style)}
              width={line.width}
              height={line.height}
              text={sanitizeRenderedText(line.text)}
              {...line.style}
              opacity={line.style.opacity}
              textDecoration={line.style.textDecoration}
              wrap="none"
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        ),
      )}
      {showCompositionOverlays && block.overflow ? (
        <Rect
          x={block.x}
          y={block.y}
          width={block.width}
          height={block.height}
          stroke="#b42318"
          strokeWidth={1}
          dash={[3, 3]}
          listening={false}
        />
      ) : null}
    </Group>
  );

  if (stageName) {
    profiler?.recordOperation(stageName, performanceNow() - startedAt, {
      storyId,
      lines: block.lineBoxes.length,
    });
  }

  return rendered;
};

const renderEditorialLabel = (label: ArticleLayout["kicker"]) =>
  label ? (
    <Group>
      <Rect
        x={label.x}
        y={label.y}
        width={label.width}
        height={label.height}
        fill={label.fill}
        stroke={label.stroke}
        strokeWidth={label.strokeWidth}
        cornerRadius={label.cornerRadius}
       listening={false} perfectDrawEnabled={false} />
      {renderTextBlock(label.textBlock, false)}
    </Group>
  ) : null;

const renderCaption = (
  caption: ArticleLayout["caption"],
  profiler?: PerformanceProfiler,
  storyId?: string,
) =>
  caption ? (
    <Group>
      {(caption.fill || (caption.strokeWidth && caption.strokeWidth > 0)) ? (
        <Rect
          x={caption.x}
          y={caption.y}
          width={caption.width}
          height={caption.height}
          fill={caption.fill ?? "transparent"}
          stroke={caption.stroke}
          strokeWidth={caption.strokeWidth}
          cornerRadius={caption.cornerRadius}
          listening={false}
        />
      ) : null}
      <Group>
        {renderTextBlock(caption.textBlock, false, profiler, "caption-render", storyId)}
        {caption.creditBlock ? renderTextBlock(caption.creditBlock, false, profiler, "caption-render", storyId) : null}
        {caption.sourceBlock ? renderTextBlock(caption.sourceBlock, false, profiler, "caption-render", storyId) : null}
      </Group>
    </Group>
  ) : null;

const getRegionLabel = (order: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = alphabet[order % alphabet.length];
  const suffix = order >= alphabet.length ? `${Math.floor(order / alphabet.length) + 1}` : "";

  return `Region ${letter}${suffix}`;
};

const objectLabels: Partial<Record<EditorObjectType, string>> = {
  headline: "Headline",
  subheadline: "Subheadline",
  byline: "Byline",
  location: "Location",
  body: "Body",
  image: "Image",
  caption: "Caption",
  credit: "Image Credit",
  source: "Source",
  kicker: "Kicker",
  strap: "Strap",
  factBox: "Fact Box",
  factBoxHeading: "Fact Box Heading",
  factBoxContent: "Fact Box Content",
  pullQuote: "Pull Quote",
};

const getFrameBadgeText = (articleBox: ArticleBoxModel, layout: ArticleLayout) => {
  const storyId = "id" in articleBox ? String(articleBox.id) : "story";
  const badges = [`Story ${storyId}`, `Layer ${"zIndex" in articleBox ? String(articleBox.zIndex ?? 0) : "0"}`];

  if ("locked" in articleBox && articleBox.locked) {
    badges.push("Locked");
  }

  if ("hidden" in articleBox && articleBox.hidden) {
    badges.push("Hidden");
  }

  if (layout.metrics.overflow) {
    badges.push("Overflow");
  }

  return badges.join("  |  ");
};

const linesEqual = (first: string[], second: string[]) =>
  first.length === second.length && first.every((line, index) => line === second[index]);

const formatDebugLines = (lines: string[]) =>
  lines.map((line, index) => `L${index + 1}: ${line}`).join("\n");

const getCanvasWidth = (text: string, fontFamily: string, fontSize: number, fontStyle = "normal") => {
  if (typeof document === "undefined") {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.font = createCanvasFontString(fontFamily, fontSize, fontStyle);

  return context.measureText(text).width;
};

const getTextNodeWidth = (node: Konva.Text) => {
  const textNode = node as Konva.Text & {
    getTextWidth?: () => number;
    measureSize?: (text: string) => { width: number; height: number };
    fontVariant?: () => string;
  };

  if (typeof textNode.getTextWidth === "function") {
    return textNode.getTextWidth();
  }

  if (typeof textNode.measureSize === "function") {
    return textNode.measureSize(node.text()).width;
  }

  return node.width();
};

function ArticleBoxComponent({
  articleBox,
  layout,
  selected,
  selectedObjectType,
  selectedParagraphIndex = 0,
  priorityLabel,
  showPriorityLabel = false,
  showCompositionOverlays = true,
  bodyRendererMode = "line",
  contentMode = false,
  interactionEnabled = true,
  frameLayoutContext,
  renderProfiler,
  imageSource,
  smartLayoutEnabled = false,
  onSelect,
  onSelectObject,
  onSelectParagraph,
  onEditObject,
  onContextMenu,
  onRequestImageReplace,
  onMove,
  onResize,
  onBeginLiveMove,
  onUpdateLiveMove,
  onEndLiveMove,
  onBeginLiveResize,
  onUpdateLiveResize,
  onEndLiveResize,
}: ArticleBoxProps) {
  const renderStartedAt = performanceNow();
  const storyId = "id" in articleBox ? String(articleBox.id) : "story";
  // Publisher-exclusive: Youth UPDATE's front page suppresses every article
  // box's own frame border (kicker badges keep theirs -- renderEditorialLabel
  // draws that independently). False for every other page/publisher, so
  // nothing else changes.
  const pageType = useEditorStore((state) => state.pageType);
  // Covers both the front page and Youth UPDATE's own inside page (every
  // PageType except "editorial" counts as one or the other) -- editorial
  // pages keep their normal borders, matching every other publisher's.
  const youthUpdateFlatStyle = pageType !== "editorial" && isYouthUpdatePortalSession();
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const frameInteractionRef = useRef<FrameInteractionState | null>(null);
  const [frameInteraction, setFrameInteraction] = useState<FrameInteractionState | null>(null);
  const bodyWordNodeRefs = useRef(
    new Map<
      string,
      {
        node: Konva.Text;
        segment: NonNullable<ArticleLayoutTextBlock["lineBoxes"][number]["segments"]>[number];
      }
    >(),
  );
  const diagnosticsLoggedKeyRef = useRef("");
  const [hoveredObjectType, setHoveredObjectType] = useState<EditorObjectType | null>(null);
  const selectableObjectBounds = useMemo(() => getSelectableObjectBounds(layout), [layout]);
  const headlineWrappedLines = DEBUG_HEADLINE_PIPELINE ? layout.headline.wrappedLines : [];
  const headlineLineBoxText = DEBUG_HEADLINE_PIPELINE ? layout.headline.lineBoxes.map((line) => line.text) : [];
  const chosenCandidate = DEBUG_HEADLINE_PIPELINE ? layout.metrics.headlineChosenCandidate : [];
  const chosenMatchesWrappedLines =
    DEBUG_HEADLINE_PIPELINE && linesEqual(chosenCandidate, headlineWrappedLines);
  const wrappedMatchesLineBoxes =
    DEBUG_HEADLINE_PIPELINE && linesEqual(headlineWrappedLines, headlineLineBoxText);
  const headlinePipelineMismatch =
    DEBUG_HEADLINE_PIPELINE && (!chosenMatchesWrappedLines || !wrappedMatchesLineBoxes);
  const headlineAuditText = DEBUG_HEADLINE_PIPELINE
    ? `${
        headlinePipelineMismatch ? "HEADLINE PIPELINE MISMATCH\n" : ""
      }Chosen Candidate\n${formatDebugLines(chosenCandidate)}\n\nRendered Line Boxes\n${formatDebugLines(
        headlineLineBoxText,
      )}`
    : "";
  const headlineAuditHeight = DEBUG_HEADLINE_PIPELINE
    ? Math.min(150, Math.max(88, 48 + Math.max(chosenCandidate.length, headlineLineBoxText.length) * 18))
    : 0;
  const headlineAuditY = DEBUG_HEADLINE_PIPELINE
    ? Math.max(4, articleBox.height - headlineAuditHeight - 8)
    : 0;
  const bodyDiagnosticsKey = DEBUG_BODY_TYPOGRAPHY
    ? `${storyId}:${layout.body.columns
        .flatMap((column) => column.lines.flatMap((line) => line.segments?.map((segment) => segment.text) ?? []))
        .join("|")}`
    : "";

  const updateFrameInteraction = (state: FrameInteractionState | null) => {
    frameInteractionRef.current = state;
    setFrameInteraction(state);
  };

  if (DEBUG_BODY_TYPOGRAPHY && selected) {
    bodyWordNodeRefs.current.clear();
  }

  useEffect(() => {
    if (!DEBUG_BODY_TYPOGRAPHY || !selected || diagnosticsLoggedKeyRef.current === bodyDiagnosticsKey) {
      return;
    }

    diagnosticsLoggedKeyRef.current = bodyDiagnosticsKey;

    const logDiagnostics = () => {
      const diagnostics = Array.from(bodyWordNodeRefs.current.values()).map(({ node, segment }) => {
        const renderedFontFamily = node.fontFamily();
        const renderedFontSize = node.fontSize();
        const renderedFontStyle = node.fontStyle() || "normal";
        const renderedFontVariant =
          typeof (node as Konva.Text & { fontVariant?: () => string }).fontVariant === "function"
            ? (node as Konva.Text & { fontVariant: () => string }).fontVariant()
            : "normal";
        const actualCanvasWidth = getCanvasWidth(segment.text, renderedFontFamily, renderedFontSize, renderedFontStyle);
        const transformMatrix = node.getTransform().getMatrix();
        const absoluteTransformMatrix = node.getAbsoluteTransform().getMatrix();

        return {
          word: segment.text,
          measuredFontFamily: segment.measuredFontFamily,
          renderedFontFamily,
          measuredFontSize: segment.measuredFontSize,
          renderedFontSize,
          measuredFontWeight: segment.measuredFontWeight,
          renderedFontWeight: renderedFontStyle,
          measuredFontStyle: segment.measuredFontStyle,
          renderedFontStyle,
          renderedFontVariant,
          measuredFontString: segment.measuredFontString,
          renderedFontString: createCanvasFontString(renderedFontFamily, renderedFontSize, renderedFontStyle),
          measuredWidth: segment.measuredWidth,
          renderedWidth: segment.renderedWidth,
          konvaWidth: node.width(),
          konvaNaturalWidth: getTextNodeWidth(node),
          actualCanvasWidth,
          boundingBoxWidth: node.getClientRect({ skipTransform: true }).width,
          boundingBoxHeight: node.getClientRect({ skipTransform: true }).height,
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          letterSpacing: segment.style.letterSpacing ?? 0,
          characterSpacing: segment.style.letterSpacing ?? 0,
          transformMatrix: transformMatrix.join(","),
          absoluteTransformMatrix: absoluteTransformMatrix.join(","),
          sourceFile: "src/components/editor/ArticleBox.tsx + src/engines/ArticleComposer/composeArticleBox.ts",
        };
      });

      if (diagnostics.length > 0) {
        console.table(diagnostics);
        const mismatches = diagnostics.filter((item) => {
          const measuredWidth = Number(item.measuredWidth ?? 0);
          const renderedWidth = Number(item.renderedWidth ?? 0);
          const konvaNaturalWidth = Number(item.konvaNaturalWidth ?? 0);
          const actualCanvasWidth = Number(item.actualCanvasWidth ?? 0);
          const widthMismatch =
            Math.abs(measuredWidth - renderedWidth) > 0.5 ||
            Math.abs(measuredWidth - konvaNaturalWidth) > 0.5 ||
            Math.abs(measuredWidth - actualCanvasWidth) > 0.5;
          const fontMismatch =
            item.measuredFontFamily !== item.renderedFontFamily ||
            item.measuredFontSize !== item.renderedFontSize ||
            item.measuredFontStyle !== item.renderedFontStyle ||
            item.measuredFontString !== item.renderedFontString;

          return widthMismatch || fontMismatch || item.scaleX !== 1 || item.scaleY !== 1 || item.letterSpacing !== 0;
        });

        if (mismatches.length > 0) {
          console.warn("BODY WORD TYPOGRAPHY PIPELINE MISMATCH", {
            responsibleFiles: [
              "src/engines/TypographyEngine/TextMeasure.ts",
              "src/engines/ArticleComposer/composeArticleBox.ts",
              "src/components/editor/ArticleBox.tsx",
            ],
            mismatches,
          });
        }
      }
    };

    const fontsReady = typeof document !== "undefined" ? document.fonts?.ready : undefined;

    if (fontsReady) {
      void fontsReady.then(logDiagnostics);
      return;
    }

    window.setTimeout(logDiagnostics, 0);
  }, [bodyDiagnosticsKey, selected, storyId]);

  const bodyRenderStartedAt = performanceNow();
  const bodyColumnNodes = useMemo(
    () =>
      layout.body.columns.map((column, columnIndex) => (
    <Group key={`body-column-${column.id}`}>
      {showCompositionOverlays && columnIndex > 0 && column.columnIndex > layout.body.columns[columnIndex - 1].columnIndex ? (
        <Line
          points={[
            column.x -
              (column.x -
                layout.body.columns[columnIndex - 1].x -
                layout.body.columns[columnIndex - 1].width) /
                2,
            layout.body.y,
            column.x -
              (column.x -
                layout.body.columns[columnIndex - 1].x -
                layout.body.columns[columnIndex - 1].width) /
                2,
            layout.body.y + layout.body.height,
          ]}
          stroke="#ded7ca"
          strokeWidth={1}
          listening={false}
        />
      ) : null}
      {column.lines.map((line, lineIndex) =>
        line.style.align === "justify" && line.justify ? (
          <Group key={`body-${columnIndex}-${lineIndex}`}>
            <Shape
              x={line.x}
              y={line.y}
              width={line.width}
              height={line.height}
              listening={false}
              sceneFunc={(context) => {
                const nativeContext = (
                  context as unknown as {
                    _context?: CanvasRenderingContext2D;
                  }
                )._context;

                if (!nativeContext) {
                  return;
                }

                drawBodyLine(nativeContext, line);
              }}
            />
          </Group>
        ) : bodyRendererMode === "segmented" && line.segments && line.segments.length > 0 ? (
          <Group key={`body-${columnIndex}-${lineIndex}`}>
            {line.segments.map((segment, segmentIndex) =>
              segment.style.backgroundColor ? (
                (() => {
                  const padding = getHighlightPadding(segment.style.fontSize);

                  return (
                    <Rect
                      key={`body-${columnIndex}-${lineIndex}-${segmentIndex}-background`}
                      x={segment.x - padding.x}
                      y={segment.y - padding.y / 2}
                      width={segment.width + padding.x * 2}
                      height={segment.height + padding.y}
                      fill={segment.style.backgroundColor}
                      opacity={segment.style.opacity}
                      cornerRadius={padding.radius}
                      listening={false}
                    />
                  );
                })()
              ) : null,
            )}
            {line.segments.map((segment, segmentIndex) => (
              <Text
                key={`body-${columnIndex}-${lineIndex}-${segmentIndex}`}
                ref={(node) => {
                  if (DEBUG_BODY_TYPOGRAPHY && selected && node) {
                    bodyWordNodeRefs.current.set(`${columnIndex}:${lineIndex}:${segmentIndex}`, {
                      node,
                      segment,
                    });
                  }
                }}
                x={segment.x}
                y={segment.y}
                height={segment.height}
                text={segment.text}
                {...(segment.constrainWidth === false ? {} : { width: segment.width })}
                {...segment.style}
                opacity={segment.style.opacity}
                textDecoration={segment.style.textDecoration}
                wrap="none"
                listening={false}
                perfectDrawEnabled={false}
              />
            ))}
          </Group>
        ) : (
          <Group key={`body-${columnIndex}-${lineIndex}`}>
            {line.style.backgroundColor
              ? (() => {
                  const padding = getHighlightPadding(line.style.fontSize);

                  return (
                    <Rect
                      x={line.x - padding.x}
                      y={line.y - padding.y / 2}
                      width={line.width + padding.x * 2}
                      height={line.height + padding.y}
                      fill={line.style.backgroundColor}
                      opacity={line.style.opacity}
                      cornerRadius={padding.radius}
                      listening={false}
                    />
                  );
                })()
              : null}
            <Shape
              x={line.x}
              y={line.y}
              width={line.width}
              height={line.height}
              listening={false}
              sceneFunc={(context) => {
                const nativeContext = (
                  context as unknown as {
                    _context?: CanvasRenderingContext2D;
                  }
                )._context;

                if (!nativeContext) {
                  return;
                }

                drawBodyLine(nativeContext, line);
              }}
            />
          </Group>
        ),
      )}
    </Group>
  )),
    [layout.body, bodyRendererMode, showCompositionOverlays, selected],
  );
  renderProfiler?.recordOperation("body-render", performanceNow() - bodyRenderStartedAt, {
    storyId,
    columns: layout.body.columns.length,
    lines: layout.body.columns.reduce((sum, column) => sum + column.lines.length, 0),
    segments: layout.body.columns.reduce(
      (sum, column) =>
        sum +
        column.lines.reduce((lineSum, line) => lineSum + Math.max(1, line.segments?.length ?? 0), 0),
      0,
    ),
    bodyRendererMode,
    visualTextNodes:
      bodyRendererMode === "line"
        ? layout.body.columns.reduce((sum, column) => sum + column.lines.length, 0)
        : layout.body.columns.reduce(
            (sum, column) =>
              sum + column.lines.reduce((lineSum, line) => lineSum + Math.max(1, line.segments?.length ?? 0), 0),
            0,
          ),
  });

  if (
    DEBUG_HEADLINE_PIPELINE &&
    selected
  ) {
    console.log("ArticleBox headline render audit", {
      wrappedLines: headlineWrappedLines,
      lineBoxes: headlineLineBoxText,
      chosenCandidate,
    });

    if (headlinePipelineMismatch) {
      console.warn("HEADLINE PIPELINE MISMATCH", {
        chosenCandidate,
        wrappedLines: headlineWrappedLines,
        renderedLines: headlineLineBoxText,
      });
    }
  }

  renderProfiler?.recordOperation("article-box-render", performanceNow() - renderStartedAt, {
    storyId,
  });

  return (
    <Group
      x={articleBox.x}
      y={articleBox.y}
      draggable={interactionEnabled}
      onClick={(event) => {
        if (!interactionEnabled) {
          return;
        }

        event.cancelBubble = true;
        onSelect(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
      }}
      onTap={(event) => {
        if (!interactionEnabled) {
          return;
        }

        event.cancelBubble = true;
        onSelect(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
      }}
      onContextMenu={(event) => {
        if (!interactionEnabled) {
          return;
        }

        event.cancelBubble = true;
        event.evt.preventDefault();
        onSelect(false);
        onContextMenu(event.evt.clientX, event.evt.clientY);
      }}
      onDragStart={(event) => {
        if (!interactionEnabled) {
          return;
        }

        if (event.target !== event.currentTarget) {
          return;
        }

        event.cancelBubble = true;
        onSelect(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
        const pointer = getPointerInPageCoordinates(event.target);

        if (smartLayoutEnabled && pointer && onBeginLiveMove) {
          onBeginLiveMove(articleBox, pointer);
          updateFrameInteraction(null);
        }
      }}
      onDragMove={(event) => {
        if (!interactionEnabled) {
          return;
        }

        if (event.target !== event.currentTarget) {
          return;
        }

        if (smartLayoutEnabled && onUpdateLiveMove) {
          const pointer = getPointerInPageCoordinates(event.target);

          if (pointer) {
            onUpdateLiveMove(pointer);
          }
          event.target.position({
            x: articleBox.x,
            y: articleBox.y,
          });
          return;
        }

        if (!frameLayoutContext) {
          return;
        }

        const candidate = {
          ...toFrameLayoutRect(articleBox, storyId),
          x: event.target.x(),
          y: event.target.y(),
        };
        const preview = snapFrameDrag(candidate, frameLayoutContext);

        event.target.position({
          x: preview.rect.x,
          y: preview.rect.y,
        });
        updateFrameInteraction({
          mode: "drag",
          preview,
        });
      }}
      onDragEnd={(event) => {
        if (!interactionEnabled) {
          return;
        }

        if (event.target !== event.currentTarget) {
          return;
        }

        event.cancelBubble = true;
        if (smartLayoutEnabled && onEndLiveMove) {
          onEndLiveMove();
          updateFrameInteraction(null);
          event.target.position({
            x: articleBox.x,
            y: articleBox.y,
          });
          return;
        }

        const finalPreview = frameInteractionRef.current?.mode === "drag"
          ? frameInteractionRef.current.preview
          : null;
        updateFrameInteraction(null);
        onMove({
          x: finalPreview?.rect.x ?? event.target.x(),
          y: finalPreview?.rect.y ?? event.target.y(),
        });
      }}
      onMouseEnter={(event) => {
        if (interactionEnabled) {
          setCursor(event.target.getStage(), "move");
        }
      }}
      onMouseLeave={(event) => setCursor(event.target.getStage(), "default")}
    >
      <Rect
        width={articleBox.width}
        height={articleBox.height}
        fill={
          layout.containerStyles?.article?.containerBackgroundColor &&
          layout.containerStyles.article.containerBackgroundColor !== "transparent"
            ? layout.containerStyles.article.containerBackgroundColor
            : "rgba(255, 254, 249, 0.001)"
        }
        stroke={!youthUpdateFlatStyle && layout.containerStyles?.article?.containerBorderWidth ? (layout.containerStyles.article.containerBorderColor || "#000000") : undefined}
        strokeWidth={youthUpdateFlatStyle ? 0 : layout.containerStyles?.article?.containerBorderWidth || 0}
        cornerRadius={layout.containerStyles?.article?.containerBorderRadius || 0}
        listening={false} perfectDrawEnabled={false} />

      {showCompositionOverlays && showPriorityLabel && priorityLabel ? (
        <Text
          x={4}
          y={4}
          width={Math.max(1, articleBox.width - 8)}
          height={14}
          text={priorityLabel}
          fill="#9f5847"
          fontFamily="Arial"
          fontSize={9}
          fontStyle="bold"
          listening={false}
          wrap="none"
        />
      ) : null}

      {renderEditorialLabel(layout.kicker)}
      {renderEditorialLabel(layout.strap)}
      {renderTextBlock(layout.headline, showCompositionOverlays, renderProfiler, "headline-render", storyId)}
      {layout.subheadlineBackground ? (
        <Rect
          x={layout.subheadlineBackground.x}
          y={layout.subheadlineBackground.y}
          width={layout.subheadlineBackground.width}
          height={layout.subheadlineBackground.height}
          fill={layout.subheadlineBackground.fill}
          stroke={layout.subheadlineBackground.stroke}
          strokeWidth={layout.subheadlineBackground.strokeWidth}
          cornerRadius={4}
          listening={false}
        />
      ) : null}
      {renderTextBlock(layout.subheadline, showCompositionOverlays, renderProfiler, "subheadline-render", storyId)}
      {layout.inlineSubheadline ? layout.inlineSubheadline.map((bulletBlock, idx) => (
        renderTextBlock(bulletBlock, showCompositionOverlays, renderProfiler, "subheadline-render", `${storyId}-inline-bullet-${idx}`)
      )) : null}
      {renderTextBlock(layout.byline, showCompositionOverlays, renderProfiler, "subheadline-render", storyId)}

      {layout.image ? (
        <>
          {imageSource ? (
            <RemoteStoryImage
              source={imageSource}
              x={layout.image.x}
              y={layout.image.y}
              width={layout.image.width}
              height={layout.image.height}
              opacity={layout.image.crop?.opacity ?? 1}
              cropOverride={{
                x: layout.image.coverCropX,
                y: layout.image.coverCropY,
                width: layout.image.coverCropWidth,
                height: layout.image.coverCropHeight,
              }}
            />
          ) : null}
          {layout.image.shapeType && layout.image.shapeType !== "rectangle" ? (
            <Shape
              fill={imageSource ? "rgba(255,255,255,0)" : layout.image.fill}
              stroke={layout.image.stroke}
              strokeWidth={layout.image.strokeWidth}
              opacity={layout.image.crop?.opacity ?? 1}
              listening={false}
              perfectDrawEnabled={false}
              sceneFunc={(context, shape) => {
                renderImageShapePath(context, layout.image!);
                context.fillStrokeShape(shape);
              }}
            />
          ) : (
            <Rect
              x={layout.image.x}
              y={layout.image.y}
              width={layout.image.width}
              height={layout.image.height}
              fill={imageSource ? "rgba(255,255,255,0)" : layout.image.fill}
              stroke={layout.image.stroke}
              strokeWidth={layout.image.strokeWidth}
              opacity={layout.image.crop?.opacity ?? 1}
             listening={false} perfectDrawEnabled={false} />
          )}
          {showCompositionOverlays ? layout.image.lines?.map((line, index) => (
            <Line
              key={`image-line-${index}`}
              points={line.points}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
             listening={false} perfectDrawEnabled={false} />
          )) : null}
          {showCompositionOverlays && layout.image.label
            ? renderTextBlock(layout.image.label, showCompositionOverlays, renderProfiler, "image-render", storyId)
            : null}
        </>
      ) : null}

      {renderCaption(layout.caption, renderProfiler, storyId)}

      {layout.factBox ? <FactBox layout={layout.factBox} /> : null}

      <Rect
        x={layout.body.x}
        y={layout.body.y}
        width={layout.body.width}
        height={layout.body.height}
        fill={layout.body.fill}
       listening={false} perfectDrawEnabled={false} />
      {layout.body.dropCap ? (
        <Text
          x={layout.body.dropCap.x}
          y={layout.body.dropCap.y}
          width={layout.body.dropCap.width}
          height={layout.body.dropCap.height}
          text={layout.body.dropCap.text}
          {...layout.body.dropCap.style}
          wrap="none"
         listening={false} perfectDrawEnabled={false} />
      ) : null}
      {bodyColumnNodes}
      {layout.editorialFloatImage ? (
        <>
          {imageSource ? (
            <RemoteStoryImage
              source={imageSource}
              x={layout.editorialFloatImage.x}
              y={layout.editorialFloatImage.y}
              width={layout.editorialFloatImage.width}
              height={layout.editorialFloatImage.height}
              opacity={layout.editorialFloatImage.opacity ?? 1}
            />
          ) : null}
          <Rect
            x={layout.editorialFloatImage.x}
            y={layout.editorialFloatImage.y}
            width={layout.editorialFloatImage.width}
            height={layout.editorialFloatImage.height}
            fill={imageSource ? "rgba(255,255,255,0)" : layout.editorialFloatImage.fill}
            stroke={layout.editorialFloatImage.stroke}
            strokeWidth={layout.editorialFloatImage.strokeWidth}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Rect
            x={layout.editorialFloatImage.x}
            y={layout.editorialFloatImage.y}
            width={layout.editorialFloatImage.width}
            height={layout.editorialFloatImage.height}
            fill="rgba(255,255,255,0.001)"
            onMouseEnter={(event) => setCursor(event.target.getStage(), "pointer")}
            onMouseLeave={(event) => setCursor(event.target.getStage(), "default")}
            onClick={(event) => {
              const bounds = {
                x: layout.editorialFloatImage!.x,
                y: layout.editorialFloatImage!.y,
                width: layout.editorialFloatImage!.width,
                height: layout.editorialFloatImage!.height,
              };

              event.cancelBubble = true;
              onSelect(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
              onSelectObject("image", bounds);
              onRequestImageReplace?.(event.evt.clientX, event.evt.clientY);
            }}
            onTap={(event) => {
              const touchPoint = event.evt.changedTouches?.[0];
              const bounds = {
                x: layout.editorialFloatImage!.x,
                y: layout.editorialFloatImage!.y,
                width: layout.editorialFloatImage!.width,
                height: layout.editorialFloatImage!.height,
              };

              event.cancelBubble = true;
              onSelect(false);
              onSelectObject("image", bounds);
              onRequestImageReplace?.(touchPoint?.clientX ?? 0, touchPoint?.clientY ?? 0);
            }}
          />
        </>
      ) : null}
      {showCompositionOverlays && layout.body.overflow ? (
        <Rect
          x={layout.body.x}
          y={layout.body.y}
          width={layout.body.width}
          height={layout.body.height}
          stroke="#b42318"
          strokeWidth={1}
          dash={[3, 3]}
          listening={false}
        />
      ) : null}
      {layout.pullQuote ? <PullQuote layout={layout.pullQuote} /> : null}
      {layout.decorativeDividers && layout.decorativeDividers.length > 0
        ? layout.decorativeDividers.map((divider, idx) => (
            <Shape
              key={`decorative-divider-${idx}`}
              listening={false}
              sceneFunc={(context) => {
                const native = (
                  context as unknown as { _context?: CanvasRenderingContext2D }
                )._context;
                if (!native) return;
                native.save();
                native.strokeStyle = divider.color;
                native.lineWidth = divider.strokeWidth;
                if (divider.style !== "solid") {
                  native.setLineDash([divider.dotSize, divider.dotSpacing]);
                }
                native.lineDashOffset = 0;
                native.beginPath();
                native.moveTo(divider.x, divider.y);
                native.lineTo(divider.x + divider.width, divider.y);
                native.stroke();
                native.setLineDash([]);
                native.restore();
              }}
            />
          ))
        : null}
      {showCompositionOverlays ? layout.debugTextRegions.map((region) => (
        <Group key={`debug-region-${region.id}`}>
          <Rect
            x={region.x}
            y={region.y}
            width={region.width}
            height={region.height}
            fill={
              region.status === "usable"
                ? "rgba(31, 122, 140, 0.04)"
                : "rgba(180, 35, 24, 0.05)"
            }
            stroke={region.status === "usable" ? "#1f7a8c" : "#b42318"}
            strokeWidth={0.7}
            dash={[4, 5]}
            listening={false}
          />
          <Text
            x={region.x + 4}
            y={region.y + 4}
            width={Math.max(1, region.width - 8)}
            height={Math.min(88, Math.max(18, region.height - 8))}
            text={`${region.id || getRegionLabel(region.order)}  ${region.status.toUpperCase()}\ncol ${
              region.columnIndex + 1
            }  area ${Math.round(region.area)}\nx ${Math.round(region.x)}  y ${Math.round(
              region.y,
            )}\nw ${Math.round(region.width)}  h ${Math.round(
              region.height,
            )}\ncap ${region.capacity}  lines ${region.assignedLineCount}\nrem ${
              region.remainingCapacity
            }${region.discardReasons.length > 0 ? `\n${region.discardReasons.join(", ")}` : ""}`}
            fill={region.status === "usable" ? "#0d5f75" : "#9f1d17"}
            fontFamily="Arial"
            fontSize={8}
            lineHeight={1.1}
            listening={false}
            wrap="none"
          />
        </Group>
      )) : null}

      {interactionEnabled ? selectableObjectBounds.map(({ type, bounds }) => {
        const isSelectedObject = selected && contentMode && selectedObjectType === type;
        const isHoveredObject = hoveredObjectType === type;

        return (
          <Group key={`object-hit-${type}`}>
            {isSelectedObject || isHoveredObject ? (
              <Rect
                x={bounds.x - 2}
                y={bounds.y - 2}
                width={bounds.width + 4}
                height={bounds.height + 4}
                stroke={isSelectedObject ? "#1f6feb" : "#6aa7ff"}
                strokeWidth={isSelectedObject ? 1 : 0.75}
                dash={isSelectedObject ? [] : [3, 3]}
                fill={isHoveredObject && !isSelectedObject ? "rgba(31, 111, 235, 0.035)" : undefined}
                listening={false}
              />
            ) : null}
            {isHoveredObject ? (
              <Group listening={false}>
                <Rect
                  x={bounds.x}
                  y={Math.max(0, bounds.y - 18)}
                  width={Math.min(112, Math.max(58, (objectLabels[type] ?? type).length * 6 + 16))}
                  height={16}
                  fill="rgba(31, 36, 44, 0.88)"
                  cornerRadius={3}
                 listening={false} perfectDrawEnabled={false} />
                <Text
                  x={bounds.x + 6}
                  y={Math.max(0, bounds.y - 15)}
                  width={104}
                  height={12}
                  text={objectLabels[type] ?? type}
                  fill="#fffdf8"
                  fontFamily="Arial"
                  fontSize={9}
                  fontStyle="bold"
                  wrap="none"
                 listening={false} perfectDrawEnabled={false} />
              </Group>
            ) : null}
            {isSelectedObject ? (
              <Rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                stroke="#1f6feb"
                strokeWidth={0.4}
                dash={[2, 4]}
                listening={false}
              />
            ) : null}
            <Rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill="rgba(255,255,255,0.001)"
              onMouseEnter={(event) => {
                setHoveredObjectType(type);
                setCursor(event.target.getStage(), type === "image" ? "pointer" : "text");
              }}
              onMouseLeave={(event) => {
                setHoveredObjectType(null);
                setCursor(event.target.getStage(), "default");
              }}
              onClick={(event) => {
                event.cancelBubble = true;
                onSelect(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
                if (type === "image" && !event.evt.shiftKey && !event.evt.ctrlKey && !event.evt.metaKey) {
                  onSelectObject(type, bounds);
                  onRequestImageReplace?.(event.evt.clientX, event.evt.clientY);
                }
              }}
              onTap={(event) => {
                event.cancelBubble = true;
                onSelect(false);
                if (type === "image") {
                  const touchPoint = event.evt.changedTouches?.[0];
                  onSelectObject(type, bounds);
                  onRequestImageReplace?.(touchPoint?.clientX ?? 0, touchPoint?.clientY ?? 0);
                }
              }}
              onDblClick={(event) => {
                event.cancelBubble = true;
                onSelectObject(type, bounds);
                onEditObject(type, bounds);
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                onSelectObject(type, bounds);
                onEditObject(type, bounds);
              }}
            />
          </Group>
        );
      }) : null}

      {interactionEnabled && selected && contentMode && selectedObjectType === "body"
        ? (layout.paragraphBounds ?? []).map((paragraph) => {
            const isSelectedParagraph = paragraph.index === selectedParagraphIndex;

            return (
              <Group key={`paragraph-hit-${paragraph.index}`}>
                <Rect
                  x={paragraph.x - 2}
                  y={paragraph.y - 2}
                  width={paragraph.width + 4}
                  height={paragraph.height + 4}
                  stroke={isSelectedParagraph ? "#1f6feb" : "#6aa7ff"}
                  strokeWidth={isSelectedParagraph ? 1.1 : 0.65}
                  dash={isSelectedParagraph ? [] : [3, 4]}
                  fill={isSelectedParagraph ? "rgba(31, 111, 235, 0.045)" : "rgba(255,255,255,0.001)"}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    onSelectParagraph?.(paragraph.index, paragraph);
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true;
                    onSelectParagraph?.(paragraph.index, paragraph);
                  }}
                />
                <Text
                  x={paragraph.x + 3}
                  y={Math.max(0, paragraph.y - 14)}
                  width={48}
                  height={12}
                  text={paragraph.label}
                  fill="#1f6feb"
                  fontFamily="Arial"
                  fontSize={8}
                  fontStyle="bold"
                  listening={false}
                  wrap="none"
                />
              </Group>
            );
          })
        : null}

      {DEBUG_HEADLINE_PIPELINE && selected ? (
        <Group listening={false}>
          <Rect
            x={6}
            y={headlineAuditY}
            width={Math.max(1, articleBox.width - 12)}
            height={headlineAuditHeight}
            fill="rgba(255, 254, 249, 0.94)"
            stroke={headlinePipelineMismatch ? "#b42318" : "#0d5f75"}
            strokeWidth={1}
           listening={false} perfectDrawEnabled={false} />
          <Text
            x={10}
            y={headlineAuditY + 6}
            width={Math.max(1, articleBox.width - 20)}
            height={headlineAuditHeight - 12}
            text={headlineAuditText}
            fill={headlinePipelineMismatch ? "#9f1d17" : "#0d3f4a"}
            fontFamily={getNewspaperFontStack("sans")}
            fontSize={8}
            lineHeight={1.15}
            wrap="none"
            listening={false}
          />
        </Group>
      ) : null}

      {selected && frameInteraction ? (
        <Group listening={false}>
          {frameInteraction.preview.guides.map((guide) => (
            <Line
              key={guide.id}
              points={
                guide.orientation === "vertical"
                  ? [
                      guide.position - articleBox.x,
                      -articleBox.y,
                      guide.position - articleBox.x,
                      (frameLayoutContext?.pageHeight ?? articleBox.height) - articleBox.y,
                    ]
                  : [
                      -articleBox.x,
                      guide.position - articleBox.y,
                      (frameLayoutContext?.pageWidth ?? articleBox.width) - articleBox.x,
                      guide.position - articleBox.y,
                    ]
              }
              stroke={guide.kind === "baseline" ? "#8f67d3" : "#1687a7"}
              strokeWidth={1}
              dash={guide.kind === "baseline" ? [3, 4] : [8, 5]}
             listening={false} perfectDrawEnabled={false} />
          ))}
          <Rect
            x={frameInteraction.preview.rect.x - articleBox.x}
            y={frameInteraction.preview.rect.y - articleBox.y}
            width={frameInteraction.preview.rect.width}
            height={frameInteraction.preview.rect.height}
            stroke={frameInteraction.preview.outOfBounds ? "#bd2d25" : "#1687a7"}
            strokeWidth={1.4}
            dash={[9, 5]}
            fill={
              frameInteraction.preview.outOfBounds
                ? "rgba(189, 45, 37, 0.06)"
                : "rgba(22, 135, 167, 0.045)"
            }
           listening={false} perfectDrawEnabled={false} />
          {frameInteraction.preview.collisions.map((collision) => (
            <Rect
              key={`${collision.frameId}-${collision.x}-${collision.y}`}
              x={collision.x - articleBox.x}
              y={collision.y - articleBox.y}
              width={collision.width}
              height={collision.height}
              fill="rgba(189, 45, 37, 0.2)"
              stroke="#bd2d25"
              strokeWidth={1}
              dash={[4, 3]}
             listening={false} perfectDrawEnabled={false} />
          ))}
          {frameInteraction.preview.distanceLabels.map((label) => (
            <Group key={label.id}>
              <Rect
                x={label.x - articleBox.x - 22}
                y={label.y - articleBox.y - 8}
                width={44}
                height={16}
                fill="rgba(21, 28, 32, 0.88)"
                cornerRadius={3}
               listening={false} perfectDrawEnabled={false} />
              <Text
                x={label.x - articleBox.x - 20}
                y={label.y - articleBox.y - 5}
                width={40}
                height={10}
                text={label.text}
                fill="#fffdf8"
                fontFamily="Arial"
                fontSize={8}
                align="center"
                wrap="none"
               listening={false} perfectDrawEnabled={false} />
            </Group>
          ))}
        </Group>
      ) : null}

      {selected ? (
        <>
          <Rect
            name="selection-outline"
            width={articleBox.width}
            height={articleBox.height}
            stroke="#0d5f75"
            strokeWidth={2}
            dash={[7, 4]}
            listening={false}
          />
          <Line
            points={[articleBox.width / 2, 0, articleBox.width / 2, -24]}
            stroke="#0d5f75"
            strokeWidth={1.2}
            listening={false}
          />
          <Rect
            name="rotation-handle"
            x={articleBox.width / 2 - 6}
            y={-36}
            width={12}
            height={12}
            fill="#fffef9"
            stroke="#0d5f75"
            strokeWidth={2}
            cornerRadius={6}
            listening={false}
          />
          <Group listening={false}>
            <Rect
              x={6}
              y={6}
              width={Math.min(articleBox.width - 12, Math.max(150, getFrameBadgeText(articleBox, layout).length * 5.8))}
              height={20}
              fill="rgba(13, 95, 117, 0.92)"
              cornerRadius={3}
             listening={false} perfectDrawEnabled={false} />
            <Text
              x={12}
              y={10}
              width={Math.max(1, articleBox.width - 24)}
              height={12}
              text={getFrameBadgeText(articleBox, layout)}
              fill="#fffdf8"
              fontFamily="Arial"
              fontSize={9}
              fontStyle="bold"
              wrap="none"
             listening={false} perfectDrawEnabled={false} />
          </Group>
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]).map((handle) => {
            const handlePosition = getHandlePosition(handle, articleBox);

            return (
              <Rect
                name="resize-handle"
                key={handle}
                x={handlePosition.x - HANDLE_SIZE / 2}
                y={handlePosition.y - HANDLE_SIZE / 2}
                width={HANDLE_SIZE}
                height={HANDLE_SIZE}
                fill="#fffef9"
                stroke="#0d5f75"
                strokeWidth={2}
                draggable
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  const pointer = getPointerInPageCoordinates(event.target);

                  if (!pointer) {
                    return;
                  }

                  if (smartLayoutEnabled && onBeginLiveResize) {
                    resizeSessionRef.current = {
                      handle,
                      startArticleBox: articleBox,
                      startPointer: pointer,
                    };
                    onBeginLiveResize(articleBox, handle, pointer);
                    updateFrameInteraction(null);
                    return;
                  }

                  resizeSessionRef.current = {
                    handle,
                    startArticleBox: articleBox,
                    startPointer: pointer,
                  };
                  updateFrameInteraction(null);
                }}
                onMouseEnter={(event) => setCursor(event.target.getStage(), handleCursors[handle])}
                onMouseLeave={(event) => setCursor(event.target.getStage(), "default")}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  const session = resizeSessionRef.current;
                  const pointer = getPointerInPageCoordinates(event.target);

                  if (!session || !pointer) {
                    return;
                  }

                  if (smartLayoutEnabled && onUpdateLiveResize) {
                    onUpdateLiveResize(pointer);
                    event.target.position({
                      x: handlePosition.x - HANDLE_SIZE / 2,
                      y: handlePosition.y - HANDLE_SIZE / 2,
                    });
                    return;
                  }

                  const delta = {
                    x: pointer.x - session.startPointer.x,
                    y: pointer.y - session.startPointer.y,
                  };
                  const resized = resizeFromHandle(session.handle, session.startArticleBox, delta);
                  const preview = frameLayoutContext
                    ? snapFrameResize(toFrameLayoutRect(resized, storyId), frameLayoutContext, session.handle)
                    : {
                        rect: toFrameLayoutRect(resized, storyId),
                        guides: [],
                        distanceLabels: [],
                        collisions: [],
                        outOfBounds: false,
                      };

                  updateFrameInteraction({
                    mode: "resize",
                    preview,
                  });
                  event.target.position({
                    x: handlePosition.x - HANDLE_SIZE / 2,
                    y: handlePosition.y - HANDLE_SIZE / 2,
                  });
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const session = resizeSessionRef.current;

                  if (smartLayoutEnabled && onEndLiveResize) {
                    onEndLiveResize();
                    resizeSessionRef.current = null;
                    updateFrameInteraction(null);
                    event.target.position({
                      x: handlePosition.x - HANDLE_SIZE / 2,
                      y: handlePosition.y - HANDLE_SIZE / 2,
                    });
                    return;
                  }

                  const preview = frameInteractionRef.current?.mode === "resize"
                    ? frameInteractionRef.current.preview
                    : null;

                  if (preview) {
                    onResize({
                      ...articleBox,
                      x: preview.rect.x,
                      y: preview.rect.y,
                      width: preview.rect.width,
                      height: preview.rect.height,
                    });
                  }

                  resizeSessionRef.current = null;
                  updateFrameInteraction(null);
                  event.target.position({
                    x: handlePosition.x - HANDLE_SIZE / 2,
                    y: handlePosition.y - HANDLE_SIZE / 2,
                  });
                }}
              />
            );
          })}
        </>
      ) : null}
    </Group>
  );
}

export const ArticleBox = memo(
  ArticleBoxComponent,
  (previous, next) =>
    previous.articleBox.x === next.articleBox.x &&
    previous.articleBox.y === next.articleBox.y &&
    previous.articleBox.width === next.articleBox.width &&
    previous.articleBox.height === next.articleBox.height &&
    previous.layout === next.layout &&
    previous.selected === next.selected &&
    (previous.selected || next.selected
      ? previous.selectedObjectType === next.selectedObjectType &&
        previous.selectedParagraphIndex === next.selectedParagraphIndex &&
        previous.contentMode === next.contentMode &&
        previous.frameLayoutContext === next.frameLayoutContext
      : true) &&
    previous.priorityLabel === next.priorityLabel &&
    previous.showPriorityLabel === next.showPriorityLabel &&
    previous.showCompositionOverlays === next.showCompositionOverlays &&
    previous.bodyRendererMode === next.bodyRendererMode &&
    previous.interactionEnabled === next.interactionEnabled &&
    previous.imageSource === next.imageSource &&
    previous.smartLayoutEnabled === next.smartLayoutEnabled &&
    previous.renderProfiler === next.renderProfiler &&
    previous.onSelect === next.onSelect &&
    previous.onSelectObject === next.onSelectObject &&
    previous.onSelectParagraph === next.onSelectParagraph &&
    previous.onEditObject === next.onEditObject &&
    previous.onContextMenu === next.onContextMenu &&
    previous.onRequestImageReplace === next.onRequestImageReplace &&
    previous.onMove === next.onMove &&
    previous.onResize === next.onResize,
);
