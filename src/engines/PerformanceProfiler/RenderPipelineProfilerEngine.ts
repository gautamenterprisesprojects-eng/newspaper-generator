import type Konva from "konva";
import type { ArticleLayout, StoryFrame } from "@/types/editor";

export type KonvaNodeProfile = {
  stageCount: number;
  layerCount: number;
  fastLayerCount: number;
  groupCount: number;
  textNodeCount: number;
  rectCount: number;
  imageNodeCount: number;
  lineCount: number;
  guideCount: number;
  transformerCount: number;
  selectionNodeCount: number;
  totalNodes: number;
  visibleNodes: number;
  hiddenNodes: number;
  destroyedNodes: number;
  createdNodes: number;
};

const emptyKonvaNodeProfile: KonvaNodeProfile = {
  stageCount: 0,
  layerCount: 0,
  fastLayerCount: 0,
  groupCount: 0,
  textNodeCount: 0,
  rectCount: 0,
  imageNodeCount: 0,
  lineCount: 0,
  guideCount: 0,
  transformerCount: 0,
  selectionNodeCount: 0,
  totalNodes: 0,
  visibleNodes: 0,
  hiddenNodes: 0,
  destroyedNodes: 0,
  createdNodes: 0,
};

export const createStoryRenderHash = ({
  story,
  layout,
  selected,
  showCompositionOverlays,
  showPriorityLabel,
}: {
  story: StoryFrame;
  layout: ArticleLayout;
  selected: boolean;
  showCompositionOverlays: boolean;
  showPriorityLabel: boolean;
}) =>
  [
    story.id,
    story.x,
    story.y,
    story.width,
    story.height,
    story.priority,
    selected ? 1 : 0,
    showCompositionOverlays ? 1 : 0,
    showPriorityLabel ? 1 : 0,
    layout.metrics.headlineLines,
    layout.metrics.visibleLines,
    layout.metrics.imageHeight,
    layout.metrics.overflow ? 1 : 0,
    layout.metrics.opticalGlyphCount,
    layout.headline.lineBoxes.length,
    layout.subheadline.lineBoxes.length,
    layout.byline.lineBoxes.length,
    layout.body.columns.map((column) => column.lines.length).join("."),
    layout.caption?.textBlock.lineBoxes.length ?? 0,
  ].join("|");

export const countKonvaNodes = (
  stage: Konva.Stage | null,
  previousTotalNodes = 0,
): KonvaNodeProfile => {
  if (!stage) {
    return emptyKonvaNodeProfile;
  }

  const nodes = [stage, ...stage.find("*")];
  const profile: KonvaNodeProfile = {
    ...emptyKonvaNodeProfile,
    totalNodes: nodes.length,
    createdNodes: Math.max(0, nodes.length - previousTotalNodes),
    destroyedNodes: Math.max(0, previousTotalNodes - nodes.length),
  };

  for (const node of nodes) {
    const className = node.getClassName();

    if (node.isVisible()) {
      profile.visibleNodes += 1;
    } else {
      profile.hiddenNodes += 1;
    }

    if (className === "Stage") profile.stageCount += 1;
    if (className === "Layer") profile.layerCount += 1;
    if (className === "FastLayer") profile.fastLayerCount += 1;
    if (className === "Group") profile.groupCount += 1;
    if (className === "Text") profile.textNodeCount += 1;
    if (className === "Rect") profile.rectCount += 1;
    if (className === "Image") profile.imageNodeCount += 1;
    if (className === "Line") profile.lineCount += 1;
    if (className === "Transformer") profile.transformerCount += 1;

    const name = node.name();
    if (name.includes("guide")) profile.guideCount += 1;
    if (name.includes("selection") || name.includes("resize-handle")) profile.selectionNodeCount += 1;
  }

  return profile;
};

export const countArticleLayoutNodes = (layout: ArticleLayout) => {
  const headlineNodes = layout.headline.lineBoxes.reduce(
    (sum, line) => sum + Math.max(1, line.segments?.length ?? 0),
    0,
  );
  const bodyNodes = layout.body.columns.reduce(
    (sum, column) =>
      sum +
      column.lines.reduce((lineSum, line) => lineSum + Math.max(1, line.segments?.length ?? 0), 0),
    0,
  );
  const captionNodes = layout.caption
    ? layout.caption.textBlock.lineBoxes.reduce(
        (sum, line) => sum + Math.max(1, line.segments?.length ?? 0),
        0,
      )
    : 0;

  return headlineNodes + bodyNodes + captionNodes;
};
