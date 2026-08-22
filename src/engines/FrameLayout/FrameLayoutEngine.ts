import type {
  ArticleLayoutTextBlock,
  ArticleLayoutTextLine,
  ArticleLayoutTextSegment,
  EditorSelectionBounds,
  ObjectContainerStyle,
  Point,
  Size,
} from "@/types/editor";

export type FrameContentLayout = {
  block: ArticleLayoutTextBlock;
  frameBounds: EditorSelectionBounds | null;
  contentBounds: EditorSelectionBounds | null;
  borderDash: number[];
};

const getFrameDash = (style: ObjectContainerStyle | undefined, frameBounds: Size | null) => {
  if (!style || style.frameBorderStyle === "solid" || style.frameBorderWidth <= 0) {
    return [];
  }

  if (style.frameBorderStyle === "dotted") {
    const dot = Math.max(1, style.frameBorderWidth);

    return [dot, dot * 1.8];
  }

  const base = Math.max(3, Math.min(frameBounds?.width ?? 8, frameBounds?.height ?? 8) * 0.08);

  return [base, Math.max(2, base * 0.65)];
};

const getTextBounds = (block: ArticleLayoutTextBlock): EditorSelectionBounds => ({
  x: block.layoutBounds?.x ?? block.x,
  y: block.layoutBounds?.y ?? block.y,
  width: block.layoutBounds?.width ?? block.width,
  height: block.layoutBounds?.height ?? block.height,
});

const getEffectiveFrameBounds = (block: ArticleLayoutTextBlock): EditorSelectionBounds | null => {
  const style = block.containerStyle;
  const rawFrameBounds = block.frameBounds ?? block.containerBounds;

  if (!style || !rawFrameBounds) {
    return null;
  }

  const textBounds = getTextBounds(block);
  const contentDrivenHeight =
    textBounds.height + style.framePaddingTop + style.framePaddingBottom;
  const width = Math.max(rawFrameBounds.width, style.minimumFrameWidth);
  const height = Math.max(
    style.autoFrameHeight ? Math.max(rawFrameBounds.height, contentDrivenHeight) : rawFrameBounds.height,
    style.minimumFrameHeight,
  );

  return {
    x: rawFrameBounds.x,
    y: rawFrameBounds.y,
    width,
    height,
  };
};

const getContentBounds = (
  frameBounds: EditorSelectionBounds,
  style: ObjectContainerStyle,
): EditorSelectionBounds => ({
  x: frameBounds.x + style.framePaddingLeft,
  y: frameBounds.y + style.framePaddingTop,
  width: Math.max(1, frameBounds.width - style.framePaddingLeft - style.framePaddingRight),
  height: Math.max(1, frameBounds.height - style.framePaddingTop - style.framePaddingBottom),
});

const getVerticalOffset = (
  textBounds: EditorSelectionBounds,
  contentBounds: EditorSelectionBounds,
  style: ObjectContainerStyle,
) => {
  if (style.contentVerticalAlignment === "bottom") {
    return contentBounds.y + contentBounds.height - textBounds.height - textBounds.y;
  }

  if (style.contentVerticalAlignment === "middle") {
    return contentBounds.y + Math.max(0, contentBounds.height - textBounds.height) / 2 - textBounds.y;
  }

  return contentBounds.y - textBounds.y;
};

const getLineTargetX = (
  line: ArticleLayoutTextLine,
  contentBounds: EditorSelectionBounds,
  style: ObjectContainerStyle,
) => {
  const alignment =
    style.contentHorizontalAlignment === "justify"
      ? line.style.align ?? "left"
      : style.contentHorizontalAlignment;
  const lineWidth = Math.min(line.width, contentBounds.width);

  if (alignment === "right") {
    return contentBounds.x + contentBounds.width - lineWidth;
  }

  if (alignment === "center") {
    return contentBounds.x + Math.max(0, contentBounds.width - lineWidth) / 2;
  }

  return contentBounds.x;
};

const shiftSegment = (
  segment: ArticleLayoutTextSegment,
  offset: Point,
): ArticleLayoutTextSegment => ({
  ...segment,
  x: segment.x + offset.x,
  y: segment.y + offset.y,
});

const layoutLine = (
  line: ArticleLayoutTextLine,
  contentBounds: EditorSelectionBounds,
  verticalOffset: number,
  style: ObjectContainerStyle,
): ArticleLayoutTextLine => {
  const targetX = getLineTargetX(line, contentBounds, style);
  const offset = {
    x: targetX - line.x,
    y: verticalOffset,
  };

  return {
    ...line,
    x: line.x + offset.x,
    y: line.y + offset.y,
    segments: line.segments?.map((segment) => shiftSegment(segment, offset)),
  };
};

export const layoutFrameTextBlock = (block: ArticleLayoutTextBlock): FrameContentLayout => {
  const style = block.containerStyle;
  const frameBounds = getEffectiveFrameBounds(block);

  if (!style || !frameBounds) {
    return {
      block,
      frameBounds: null,
      contentBounds: null,
      borderDash: [],
    };
  }

  const contentBounds = getContentBounds(frameBounds, style);
  const textBounds = getTextBounds(block);
  const verticalOffset = getVerticalOffset(textBounds, contentBounds, style);
  const lineBoxes = block.lineBoxes.map((line) =>
    layoutLine(line, contentBounds, verticalOffset, style),
  );

  return {
    block: {
      ...block,
      frameBounds,
      containerBounds: frameBounds,
      lineBoxes,
    },
    frameBounds,
    contentBounds,
    borderDash: getFrameDash(style, frameBounds),
  };
};

export const FrameLayoutEngine = {
  layoutFrameTextBlock,
};
