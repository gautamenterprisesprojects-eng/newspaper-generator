import type {
  ArticleLayoutTextBlock,
  ArticleObjectContainerStyles,
  ContainerBackgroundMode,
  FrameBackgroundMode,
  ObjectContainerStyle,
  Point,
  Size,
} from "@/types/editor";

type FrameSize = Partial<Point & Size>;

const toFrameMode = (mode: ContainerBackgroundMode | FrameBackgroundMode): FrameBackgroundMode => {
  if (mode === "container" || mode === "rounded-rectangle") {
    return "frame";
  }

  if (mode === "pill") {
    return "text-only";
  }

  if (mode === "transparent") {
    return "none";
  }

  return mode as FrameBackgroundMode;
};

const transparentStyle = (mode: ContainerBackgroundMode = "transparent"): ObjectContainerStyle => ({
  mode,
  frameMode: toFrameMode(mode),
  contentHorizontalAlignment: "left",
  contentVerticalAlignment: "middle",
  minimumFrameHeight: 0,
  minimumFrameWidth: 0,
  autoFrameHeight: true,
  framePaddingTop: 0,
  framePaddingBottom: 0,
  framePaddingLeft: 0,
  framePaddingRight: 0,
  frameBorderWidth: 0,
  frameBorderColor: "transparent",
  frameBorderStyle: "solid",
  frameBackgroundColor: "transparent",
  frameRadius: 0,
  frameOpacity: 1,
  containerPaddingTop: 0,
  containerPaddingBottom: 0,
  containerPaddingLeft: 0,
  containerPaddingRight: 0,
  containerBorderRadius: 0,
  containerBorderWidth: 0,
  containerBorderColor: "transparent",
  containerBackgroundColor: "transparent",
  containerOpacity: 1,
});

export const defaultContainerStyles: ArticleObjectContainerStyles = {
  // Article containers must anchor their content at the top so headlines start
  // immediately at the top of the story box. `transparentStyle` defaults to
  // "middle" for object-content alignment (correct for kicker/strap/subheadline
  // banners), but for the outer article frame that pushes the entire story
  // downward, leaving visible whitespace above the headline in exports.
  article: { ...transparentStyle("frame"), contentVerticalAlignment: "top" },
  headline: {
    ...transparentStyle("transparent"),
    framePaddingTop: 4,
    framePaddingBottom: 4,
    framePaddingLeft: 6,
    framePaddingRight: 6,
    frameRadius: 0,
    containerPaddingTop: 4,
    containerPaddingBottom: 4,
    containerPaddingLeft: 6,
    containerPaddingRight: 6,
    containerBorderRadius: 0,
  },
  subheadline: {
    ...transparentStyle("frame"),
    framePaddingTop: 4,
    framePaddingBottom: 4,
    framePaddingLeft: 8,
    framePaddingRight: 8,
    frameRadius: 2,
    containerPaddingTop: 4,
    containerPaddingBottom: 4,
    containerPaddingLeft: 8,
    containerPaddingRight: 8,
    containerBorderRadius: 2,
  },
  caption: {
    ...transparentStyle("frame"),
    framePaddingTop: 4,
    framePaddingBottom: 4,
    framePaddingLeft: 6,
    framePaddingRight: 6,
    frameRadius: 2,
    containerPaddingTop: 4,
    containerPaddingBottom: 4,
    containerPaddingLeft: 6,
    containerPaddingRight: 6,
    containerBorderRadius: 2,
    containerBorderWidth: 0.5,
    containerBorderColor: "#11100d",
  },
  credit: transparentStyle("transparent"),
  source: transparentStyle("transparent"),
  kicker: {
    ...transparentStyle("rounded-rectangle"),
    framePaddingTop: 2,
    framePaddingBottom: 2,
    framePaddingLeft: 6,
    framePaddingRight: 6,
    frameRadius: 2,
    containerPaddingTop: 2,
    containerPaddingBottom: 2,
    containerPaddingLeft: 6,
    containerPaddingRight: 6,
    containerBorderRadius: 2,
  },
  strap: {
    ...transparentStyle("rounded-rectangle"),
    framePaddingTop: 2,
    framePaddingBottom: 2,
    framePaddingLeft: 6,
    framePaddingRight: 6,
    frameRadius: 2,
    containerPaddingTop: 2,
    containerPaddingBottom: 2,
    containerPaddingLeft: 6,
    containerPaddingRight: 6,
    containerBorderRadius: 2,
  },
  factBoxHeading: {
    ...transparentStyle("full-width"),
    framePaddingTop: 5,
    framePaddingBottom: 5,
    framePaddingLeft: 8,
    framePaddingRight: 8,
    containerPaddingTop: 5,
    containerPaddingBottom: 5,
    containerPaddingLeft: 8,
    containerPaddingRight: 8,
  },
  factBoxContent: transparentStyle("container"),
  pullQuote: {
    ...transparentStyle("frame"),
    framePaddingTop: 10,
    framePaddingBottom: 10,
    framePaddingLeft: 10,
    framePaddingRight: 10,
    frameRadius: 2,
    containerPaddingTop: 10,
    containerPaddingBottom: 10,
    containerPaddingLeft: 10,
    containerPaddingRight: 10,
    containerBorderRadius: 2,
  },
  bodyCallout: transparentStyle("container"),
};

const normalizeStyle = (
  style: Partial<ObjectContainerStyle> | undefined,
  fallback: ObjectContainerStyle,
): ObjectContainerStyle => {
  const merged = {
    ...fallback,
    ...(style ?? {}),
  };
  const mode = merged.mode === "container" ? "frame" : merged.mode;
  const frameMode = style?.frameMode ?? toFrameMode(mode);
  const contentHorizontalAlignment =
    style?.contentHorizontalAlignment ?? fallback.contentHorizontalAlignment ?? "left";
  const contentVerticalAlignment =
    style?.contentVerticalAlignment ?? fallback.contentVerticalAlignment ?? "middle";
  const minimumFrameHeight = style?.minimumFrameHeight ?? fallback.minimumFrameHeight ?? 0;
  const minimumFrameWidth = style?.minimumFrameWidth ?? fallback.minimumFrameWidth ?? 0;
  const autoFrameHeight = style?.autoFrameHeight ?? fallback.autoFrameHeight ?? true;
  const fallbackFramePaddingTop = fallback.framePaddingTop || fallback.containerPaddingTop;
  const fallbackFramePaddingBottom = fallback.framePaddingBottom || fallback.containerPaddingBottom;
  const fallbackFramePaddingLeft = fallback.framePaddingLeft || fallback.containerPaddingLeft;
  const fallbackFramePaddingRight = fallback.framePaddingRight || fallback.containerPaddingRight;
  const fallbackFrameBorderWidth = fallback.frameBorderWidth || fallback.containerBorderWidth;
  const fallbackFrameBorderColor =
    fallback.frameBorderColor === "transparent" ? fallback.containerBorderColor : fallback.frameBorderColor;
  const fallbackFrameBackgroundColor =
    fallback.frameBackgroundColor === "transparent"
      ? fallback.containerBackgroundColor
      : fallback.frameBackgroundColor;
  const fallbackFrameRadius = fallback.frameRadius || fallback.containerBorderRadius;
  const pickNumberAlias = (
    frameValue: number | undefined,
    containerValue: number | undefined,
    fallbackFrameValue: number,
  ) => {
    if (frameValue !== undefined && frameValue !== fallbackFrameValue) {
      return frameValue;
    }

    if (containerValue !== undefined && containerValue !== fallbackFrameValue) {
      return containerValue;
    }

    return frameValue ?? containerValue ?? fallbackFrameValue;
  };
  const pickColorAlias = (
    frameValue: string | undefined,
    containerValue: string | undefined,
    fallbackFrameValue: string,
  ) => {
    if (frameValue && frameValue !== fallbackFrameValue) {
      return frameValue;
    }

    if (containerValue && containerValue !== fallbackFrameValue) {
      return containerValue;
    }

    return frameValue ?? containerValue ?? fallbackFrameValue;
  };
  const framePaddingTop = pickNumberAlias(style?.framePaddingTop, style?.containerPaddingTop, fallbackFramePaddingTop);
  const framePaddingBottom =
    pickNumberAlias(style?.framePaddingBottom, style?.containerPaddingBottom, fallbackFramePaddingBottom);
  const framePaddingLeft = pickNumberAlias(style?.framePaddingLeft, style?.containerPaddingLeft, fallbackFramePaddingLeft);
  const framePaddingRight =
    pickNumberAlias(style?.framePaddingRight, style?.containerPaddingRight, fallbackFramePaddingRight);
  const frameBorderWidth = pickNumberAlias(style?.frameBorderWidth, style?.containerBorderWidth, fallbackFrameBorderWidth);
  const frameBorderColor = pickColorAlias(style?.frameBorderColor, style?.containerBorderColor, fallbackFrameBorderColor);
  const frameBorderStyle = style?.frameBorderStyle ?? fallback.frameBorderStyle ?? "solid";
  const frameBackgroundColor =
    pickColorAlias(style?.frameBackgroundColor, style?.containerBackgroundColor, fallbackFrameBackgroundColor);
  const frameRadius = pickNumberAlias(style?.frameRadius, style?.containerBorderRadius, fallbackFrameRadius);
  const frameOpacity = Math.min(
    Math.max(pickNumberAlias(style?.frameOpacity, style?.containerOpacity, fallback.frameOpacity ?? fallback.containerOpacity), 0),
    1,
  );

  return {
    ...merged,
    mode,
    frameMode,
    contentHorizontalAlignment,
    contentVerticalAlignment,
    minimumFrameHeight,
    minimumFrameWidth,
    autoFrameHeight,
    framePaddingTop,
    framePaddingBottom,
    framePaddingLeft,
    framePaddingRight,
    frameBorderWidth,
    frameBorderColor,
    frameBorderStyle,
    frameBackgroundColor,
    frameRadius,
    frameOpacity,
    containerPaddingTop: framePaddingTop,
    containerPaddingBottom: framePaddingBottom,
    containerPaddingLeft: framePaddingLeft,
    containerPaddingRight: framePaddingRight,
    containerBorderWidth: frameBorderWidth,
    containerBorderColor: frameBorderColor,
    containerBackgroundColor: frameBackgroundColor,
    containerBorderRadius: frameRadius,
    containerOpacity: frameOpacity,
  };
};

export const normalizeContainerStyles = (
  styles: Partial<ArticleObjectContainerStyles> | undefined,
): ArticleObjectContainerStyles => ({
  article: styles?.article ? normalizeStyle(styles.article, defaultContainerStyles.article ?? transparentStyle("frame")) : undefined,
  headline: normalizeStyle(styles?.headline, defaultContainerStyles.headline),
  subheadline: normalizeStyle(styles?.subheadline, defaultContainerStyles.subheadline),
  caption: normalizeStyle(styles?.caption, defaultContainerStyles.caption),
  credit: normalizeStyle(styles?.credit, defaultContainerStyles.credit),
  source: normalizeStyle(styles?.source, defaultContainerStyles.source),
  kicker: normalizeStyle(styles?.kicker, defaultContainerStyles.kicker),
  strap: normalizeStyle(styles?.strap, defaultContainerStyles.strap),
  factBoxHeading: normalizeStyle(styles?.factBoxHeading, defaultContainerStyles.factBoxHeading),
  factBoxContent: normalizeStyle(styles?.factBoxContent, defaultContainerStyles.factBoxContent),
  pullQuote: normalizeStyle(styles?.pullQuote, defaultContainerStyles.pullQuote),
  bodyCallout: normalizeStyle(styles?.bodyCallout, defaultContainerStyles.bodyCallout),
});

const hasVisibleContainer = (style: ObjectContainerStyle) =>
  style.frameMode !== "none" &&
  style.mode !== "transparent" &&
  style.mode !== "none" &&
  ((style.frameBackgroundColor && style.frameBackgroundColor !== "transparent") ||
    style.frameBorderWidth > 0);

export const applyContainerStyleToTextBlock = (
  block: ArticleLayoutTextBlock,
  style: ObjectContainerStyle,
  frame?: FrameSize,
): ArticleLayoutTextBlock => {
  const normalizedStyle = normalizeStyle(style, transparentStyle(style.mode));

  if (!hasVisibleContainer(normalizedStyle)) {
    return block;
  }

  const mode = normalizedStyle.frameMode;
  const paddingLeft = normalizedStyle.framePaddingLeft;
  const paddingRight = normalizedStyle.framePaddingRight;
  const paddingTop = normalizedStyle.framePaddingTop;
  const paddingBottom = normalizedStyle.framePaddingBottom;
  const fillsFrame =
    mode === "frame" || mode === "full-width" || mode === "banner";
  const width =
    fillsFrame
      ? Math.max(frame?.width ?? 0, block.width + paddingLeft + paddingRight)
      : block.width + paddingLeft + paddingRight;
  const height =
    fillsFrame
      ? Math.max(frame?.height ?? 0, block.height + paddingTop + paddingBottom)
      : block.height + paddingTop + paddingBottom;
  const x =
    fillsFrame
      ? frame?.x ?? block.x
      : block.x - paddingLeft;
  const y = fillsFrame ? frame?.y ?? block.y : block.y - paddingTop;
  const frameBounds = {
    x,
    y,
    width,
    height,
  };

  return {
    ...block,
    layoutBounds: {
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
    },
    frameBounds,
    containerStyle: normalizedStyle,
    containerBounds: frameBounds,
  };
};

export const ContainerBackgroundEngine = {
  applyContainerStyleToTextBlock,
  defaultContainerStyles,
  normalizeContainerStyles,
};
