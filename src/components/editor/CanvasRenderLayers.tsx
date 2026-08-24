"use client";

import { memo, Profiler, useCallback, type ReactNode } from "react";
import { Group, Layer, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { ArticleBox } from "@/components/editor/ArticleBox";
import { PressColourBar } from "@/components/editor/PressColourBar";
import { RashifalGrid } from "@/components/editor/RashifalGrid";
import { AuthorBlock } from "@/components/editor/AuthorBlock";
import { resolveAuthorBlock } from "@/engines/MasterPage/AuthorBlockGeometry";
import { resolveEditorialBoxRule } from "@/engines/MasterPage/EditorialBoxRule";
import {
  COLUMN_RULE_COLOUR,
  COLUMN_RULE_WIDTH,
  resolveColumnRules,
} from "@/engines/MasterPage/ColumnRuleGeometry";
import { parseRashifalReadings } from "@/engines/MasterPage/RashifalGridGeometry";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { PageHeader } from "@/components/editor/PageHeader";
import { YouthUpdateMasthead } from "@/components/editor/YouthUpdateMasthead";
import { YouthUpdateInsideHeader } from "@/components/editor/YouthUpdateInsideHeader";
import { YouthUpdateInsideTeaserStrip } from "@/components/editor/YouthUpdateInsideTeaserStrip";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { POINTS_PER_INCH } from "@/utils/page";
import type { ResolvedPageHeader } from "@/types/header";
import type { IncrementalStoryLayout } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type {
  LiveResizeHandle,
  LiveResizePointer,
} from "@/engines/LayoutTransactionEngine/LiveResizeController";
import type { PreviewDrawCommand } from "@/engines/LayoutTransactionEngine/PreviewRenderer";
import type { PerformanceProfiler } from "@/engines/PerformanceProfiler/PerformanceProfilerEngine";
import type { FrameLayoutContext } from "@/engines/FrameLayout/FrameLayoutInteractionTypes";
import type { ArticleBoxModel, EditorObjectType, EditorSelectionBounds, Point } from "@/types/editor";
import type { NewspaperStoryId } from "@/types/document";
import type { PageMaster, PageType } from "@/types/page";
import { NEWSPAPER_PAGE, RULER_SIZE } from "@/utils/page";

type PageOrigin = {
  x: number;
  y: number;
};

type RenderProfilerCallback = (
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
) => void;

export const RulerLayer = memo(function RulerLayer({
  pageOrigin,
  zoom,
  majorGridLinesX,
  majorGridLinesY,
  formatUnit,
}: {
  pageOrigin: PageOrigin;
  zoom: number;
  majorGridLinesX: number[];
  majorGridLinesY: number[];
  formatUnit: (points: number) => string;
}) {
  return (
    <Layer listening={false}>
      <Rect
        x={pageOrigin.x - 18}
        y={pageOrigin.y - 18}
        width={NEWSPAPER_PAGE.width * zoom + 36}
        height={NEWSPAPER_PAGE.height * zoom + 36}
        fill="rgba(36, 31, 24, 0.026)"
        cornerRadius={4}
       listening={false} perfectDrawEnabled={false} />

      <Rect
        x={pageOrigin.x}
        y={pageOrigin.y - RULER_SIZE}
        width={NEWSPAPER_PAGE.width * zoom}
        height={RULER_SIZE}
        fill="#eee9df"
        stroke="#c8c0b3"
        strokeWidth={0.7}
       listening={false} perfectDrawEnabled={false} />
      <Rect
        x={pageOrigin.x - RULER_SIZE}
        y={pageOrigin.y}
        width={RULER_SIZE}
        height={NEWSPAPER_PAGE.height * zoom}
        fill="#eee9df"
        stroke="#c8c0b3"
        strokeWidth={0.7}
       listening={false} perfectDrawEnabled={false} />

      {majorGridLinesX.map((x) => (
        <Group key={`ruler-x-${x}`}>
          <Line
            points={[
              pageOrigin.x + x * zoom,
              pageOrigin.y - RULER_SIZE + 18,
              pageOrigin.x + x * zoom,
              pageOrigin.y,
            ]}
            stroke="#655e53"
            strokeWidth={0.75}
           listening={false} perfectDrawEnabled={false} />
          <Text
            x={pageOrigin.x + x * zoom + 3}
            y={pageOrigin.y - RULER_SIZE + 5}
            text={formatUnit(x)}
            fill="#5c554b"
            fontSize={9}
           listening={false} perfectDrawEnabled={false} />
        </Group>
      ))}

      {majorGridLinesY.map((y) => (
        <Group key={`ruler-y-${y}`}>
          <Line
            points={[
              pageOrigin.x - RULER_SIZE + 18,
              pageOrigin.y + y * zoom,
              pageOrigin.x,
              pageOrigin.y + y * zoom,
            ]}
            stroke="#655e53"
            strokeWidth={0.75}
           listening={false} perfectDrawEnabled={false} />
          <Text
            x={pageOrigin.x - RULER_SIZE + 4}
            y={pageOrigin.y + y * zoom + 3}
            text={formatUnit(y)}
            fill="#5c554b"
            fontSize={9}
           listening={false} perfectDrawEnabled={false} />
        </Group>
      ))}
    </Layer>
  );
});

export type EditorGuide = {
  id: string;
  orientation: "horizontal" | "vertical";
  position: number;
  locked: boolean;
  hidden: boolean;
};

export const PageChromeLayer = memo(function PageChromeLayer({
  pageMaster,
  pageType,
  newspaperName = "THE CLIFF NEWS",
  edition = "National Edition",
  dateLabel = "13 June 2026",
  pageNumber = 1,
  sectionName,
  resolvedHeader = null,
  masterHeaderEnabled = false,
  headerLogoSource,
  frontHeaderTeaser = null,
  useYouthUpdateMasthead = false,
  useYouthUpdateInsideHeader = false,
  useYouthUpdateInsideTeaser = false,
  pageCount = 1,
  onRequestMastheadTeaserReplace,
  onRequestInsideTeaserReplace,
  onRequestFrontTeaserReplace,
}: {
  pageMaster: PageMaster;
  pageType: PageType;
  newspaperName?: string;
  edition?: string;
  dateLabel?: string;
  pageNumber?: number;
  sectionName?: string;
  resolvedHeader?: ResolvedPageHeader | null;
  masterHeaderEnabled?: boolean;
  headerLogoSource?: string;
  frontHeaderTeaser?: {
    headline: string;
    imageUrl: string;
  } | null;
  /** Publisher-exclusive: true only for Youth UPDATE's own front page — see YouthUpdateConfig.ts. */
  useYouthUpdateMasthead?: boolean;
  /** Publisher-exclusive: true only for Youth UPDATE's own inside page — see YouthUpdateConfig.ts. */
  useYouthUpdateInsideHeader?: boolean;
  useYouthUpdateInsideTeaser?: boolean;
  pageCount?: number;
  onRequestMastheadTeaserReplace?: (slotIndex: number, clientX: number, clientY: number) => void;
  onRequestInsideTeaserReplace?: (slotIndex: number, clientX: number, clientY: number) => void;
  onRequestFrontTeaserReplace?: (clientX: number, clientY: number) => void;
}) {
  return (
    <>
      <Rect
        width={NEWSPAPER_PAGE.width}
        height={NEWSPAPER_PAGE.height}
        fill="#fffef9"
        stroke="#d1cabd"
        strokeWidth={0.7}
        shadowColor="rgba(25, 23, 20, 0.44)"
        shadowBlur={26}
        shadowOffsetX={0}
        shadowOffsetY={12}
        shadowOpacity={0.46}
       listening={false} perfectDrawEnabled={false} />
      {useYouthUpdateMasthead && pageType === "front" ? (
        <YouthUpdateMasthead pageWidth={pageMaster.width * POINTS_PER_INCH} pageCount={pageCount} onRequestImageReplace={onRequestMastheadTeaserReplace} />
      ) : useYouthUpdateInsideHeader && pageType !== "front" ? (
        <>
          <YouthUpdateInsideHeader
            pageWidth={pageMaster.width * POINTS_PER_INCH}
            pageNumber={pageNumber}
            sectionName={sectionName}
          />
          {useYouthUpdateInsideTeaser ? (
            <YouthUpdateInsideTeaserStrip pageWidth={pageMaster.width * POINTS_PER_INCH} pageNumber={pageNumber} onRequestImageReplace={onRequestInsideTeaserReplace} />
          ) : null}
        </>
      ) : (
        <PageHeader
          pageMaster={pageMaster}
          pageType={pageType}
          newspaperName={newspaperName}
          dateLabel={dateLabel}
          edition={edition}
          pageNumber={pageNumber}
          sectionName={sectionName ?? pageType}
          resolvedHeader={resolvedHeader}
          masterHeaderEnabled={masterHeaderEnabled}
          logoSource={headerLogoSource}
          frontHeaderTeaser={frontHeaderTeaser}
          onRequestFrontTeaserReplace={onRequestFrontTeaserReplace}
        />
      )}
      {/*
        PageFooter (website + page number) is deliberately not rendered.

        It was preview-only furniture — the PDF export builds its own canvas and
        never drew it, so nothing that ships was losing it — and the printed
        sheet carries no footer line either: the website sits in the masthead,
        and the foot of the page belongs to the press colour strip. Now that the
        strip is drawn there, the two occupy the same 25pt band and overlap.
        Dropping the preview-only text makes the editor match what prints. The
        component itself is still there — restore it by importing PageFooter and
        rendering it here, but give it somewhere to live that the strip is not
        already using.
      */}
      <PressColourBar pageMaster={pageMaster} />
    </>
  );
});

export const GridLayer = memo(function GridLayer({
  minorGridLinesX,
  minorGridLinesY,
  majorGridLinesX,
  majorGridLinesY,
  contentBounds,
  columns,
}: {
  minorGridLinesX: number[];
  minorGridLinesY: number[];
  majorGridLinesX: number[];
  majorGridLinesY: number[];
  contentBounds: { x: number; y: number; width: number; height: number };
  columns: { index: number; x: number; width: number }[];
}) {
  return (
    <>
      {minorGridLinesX.map((x) => (
        <Line
          key={`minor-x-${x}`}
          name="grid-guide"
          points={[x, 0, x, NEWSPAPER_PAGE.height]}
          stroke="#e6e1d8"
          strokeWidth={0.35}
         listening={false} perfectDrawEnabled={false} />
      ))}
      {minorGridLinesY.map((y) => (
        <Line
          key={`minor-y-${y}`}
          name="grid-guide"
          points={[0, y, NEWSPAPER_PAGE.width, y]}
          stroke="#e6e1d8"
          strokeWidth={0.35}
         listening={false} perfectDrawEnabled={false} />
      ))}
      {majorGridLinesX.map((x) => (
        <Line
          key={`major-x-${x}`}
          name="grid-guide"
          points={[x, 0, x, NEWSPAPER_PAGE.height]}
          stroke="#d0c8bc"
          strokeWidth={0.55}
         listening={false} perfectDrawEnabled={false} />
      ))}
      {majorGridLinesY.map((y) => (
        <Line
          key={`major-y-${y}`}
          name="grid-guide"
          points={[0, y, NEWSPAPER_PAGE.width, y]}
          stroke="#d0c8bc"
          strokeWidth={0.55}
         listening={false} perfectDrawEnabled={false} />
      ))}
      <Rect
        x={contentBounds.x}
        y={contentBounds.y}
        width={contentBounds.width}
        height={contentBounds.height}
        stroke="#75add4"
        strokeWidth={0.8}
        dash={[8, 6]}
       listening={false} perfectDrawEnabled={false} />
      {columns.map((column) => (
        <Group key={`column-${column.index}`}>
          <Rect
            name="column-guide"
            x={column.x}
            y={contentBounds.y}
            width={column.width}
            height={contentBounds.height}
            fill="rgba(35, 184, 207, 0.012)"
            stroke="#57b7c8"
            strokeWidth={0.55}
            dash={[4, 6]}
            listening={false}
          />
          <Text
            x={column.x}
            y={contentBounds.y + 4}
            width={column.width}
            height={12}
            text={`${column.index + 1}`}
            fill="#2e8fa0"
            fontFamily="Arial"
            fontSize={9}
            align="center"
            listening={false}
          />
        </Group>
      ))}
    </>
  );
});

export const GuideLayer = memo(function GuideLayer({
  editorialSeparatorLines,
  separatorRule,
  guides = [],
  guideColor = "#1687a7",
  onGuideMove,
  onGuideDelete,
}: {
  editorialSeparatorLines: { points: number[] }[];
  separatorRule: { stroke: string; strokeWidth: number };
  guides?: EditorGuide[];
  guideColor?: string;
  onGuideMove?: (guideId: string, position: number) => void;
  onGuideDelete?: (guideId: string) => void;
}) {
  return (
    <>
      {guides.filter((guide) => !guide.hidden).map((guide) => (
        <Line
          key={guide.id}
          name="custom-guide"
          points={guide.orientation === "vertical"
            ? [guide.position, 0, guide.position, NEWSPAPER_PAGE.height]
            : [0, guide.position, NEWSPAPER_PAGE.width, guide.position]}
          stroke={guide.locked ? "#8b8174" : guideColor}
          strokeWidth={1}
          dash={guide.locked ? [2, 5] : [8, 5]}
          draggable={!guide.locked}
          dragBoundFunc={(pos) =>
            guide.orientation === "vertical"
              ? { x: pos.x, y: 0 }
              : { x: 0, y: pos.y }
          }
          onDragEnd={(event) => {
            const position = guide.orientation === "vertical" ? event.target.x() : event.target.y();
            onGuideMove?.(guide.id, position);
          }}
          onDblClick={() => onGuideDelete?.(guide.id)}
        />
      ))}
      {editorialSeparatorLines.map((line, index) => (
        <Line
          key={`editorial-separator-${index}`}
          name="editorial-guide"
          points={line.points}
          stroke={separatorRule.stroke}
          strokeWidth={separatorRule.strokeWidth}
          listening={false}
        />
      ))}
    </>
  );
});

export const BaselineGridLayer = memo(function BaselineGridLayer({
  spacing,
  color,
}: {
  spacing: number;
  color: string;
}) {
  const lines = [];

  for (let y = 0; y <= NEWSPAPER_PAGE.height; y += Math.max(1, spacing)) {
    lines.push(y);
  }

  return (
    <>
      {lines.map((y) => (
        <Line
          key={`baseline-${y}`}
          name="baseline-guide"
          points={[0, y, NEWSPAPER_PAGE.width, y]}
          stroke={color}
          strokeWidth={0.35}
          opacity={0.62}
          listening={false}
        />
      ))}
    </>
  );
});

export const MeasurementLayer = memo(function MeasurementLayer({
  labels,
}: {
  labels: { id: string; x: number; y: number; text: string }[];
}) {
  return (
    <>
      {labels.map((label) => (
        <Group key={label.id} x={label.x} y={label.y} listening={false}>
          <Rect width={Math.max(48, label.text.length * 6 + 10)} height={18} fill="rgba(17, 24, 39, 0.82)" cornerRadius={3}  listening={false} perfectDrawEnabled={false} />
          <Text x={5} y={4} text={label.text} fill="#fffdf8" fontFamily="Arial" fontSize={10}  listening={false} perfectDrawEnabled={false} />
        </Group>
      ))}
    </>
  );
});

type StoryItemProps = {
  item: IncrementalStoryLayout;
  selected: boolean;
  selectedObjectType: EditorObjectType;
  selectedParagraphIndex: number;
  contentMode: boolean;
  productionView: boolean;
  frameLayoutContext: FrameLayoutContext;
  renderProfiler?: PerformanceProfiler;
  imageSourcesByStoryId: Record<NewspaperStoryId, string>;
  smartLayoutEnabled: boolean;
  onSelectStory: (storyId: string, additive?: boolean) => void;
  onSelectObject: (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds, additive?: boolean) => void;
  onSelectParagraph: (storyId: string, paragraphIndex: number, bounds: EditorSelectionBounds) => void;
  onEditObject: (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds) => void;
  onContextMenu: (storyId: string, clientX: number, clientY: number) => void;
  onRequestImageReplace: (storyId: string, clientX: number, clientY: number) => void;
  onRequestPortraitReplace: (storyId: string, clientX: number, clientY: number) => void;
  onMoveStory: (storyId: string, position: Point) => void;
  onResizeStory: (storyId: string, articleBox: ArticleBoxModel) => void;
  onBeginLiveMove: (storyId: string, articleBox: ArticleBoxModel, pointer: LiveResizePointer) => void;
  onUpdateLiveMove: (pointer: LiveResizePointer) => void;
  onEndLiveMove: () => void;
  onCancelLiveMove: () => void;
  onBeginLiveResize: (
    storyId: string,
    articleBox: ArticleBoxModel,
    handle: LiveResizeHandle,
    pointer: LiveResizePointer,
  ) => void;
  onUpdateLiveResize: (pointer: LiveResizePointer) => void;
  onEndLiveResize: () => void;
  onCancelLiveResize: () => void;
  onRenderProfile: RenderProfilerCallback;
};

const StoryItem = memo(function StoryItem({
  item,
  selected,
  selectedObjectType,
  selectedParagraphIndex,
  contentMode,
  productionView,
  frameLayoutContext,
  renderProfiler,
  imageSourcesByStoryId,
  smartLayoutEnabled,
  onSelectStory,
  onSelectObject,
  onSelectParagraph,
  onEditObject,
  onContextMenu,
  onRequestImageReplace,
  onRequestPortraitReplace,
  onMoveStory,
  onResizeStory,
  onBeginLiveMove,
  onUpdateLiveMove,
  onEndLiveMove,
  onCancelLiveMove,
  onBeginLiveResize,
  onUpdateLiveResize,
  onEndLiveResize,
  onCancelLiveResize,
  onRenderProfile,
}: StoryItemProps) {
  const { story, layout } = item;
  const handleSelect = useCallback((additive?: boolean) => onSelectStory(story.id, additive), [onSelectStory, story.id]);
  const handleSelectObject = useCallback(
    (objectType: EditorObjectType, bounds: EditorSelectionBounds, additive?: boolean) =>
      onSelectObject(story.id, objectType, bounds, additive),
    [onSelectObject, story.id],
  );
  const handleSelectParagraph = useCallback(
    (paragraphIndex: number, bounds: EditorSelectionBounds) =>
      onSelectParagraph(story.id, paragraphIndex, bounds),
    [onSelectParagraph, story.id],
  );
  const handleEditObject = useCallback(
    (objectType: EditorObjectType, bounds: EditorSelectionBounds) => onEditObject(story.id, objectType, bounds),
    [onEditObject, story.id],
  );
  const handleContextMenu = useCallback(
    (clientX: number, clientY: number) => onContextMenu(story.id, clientX, clientY),
    [onContextMenu, story.id],
  );
  const handleRequestImageReplace = useCallback(
    (clientX: number, clientY: number) => onRequestImageReplace(story.id, clientX, clientY),
    [onRequestImageReplace, story.id],
  );
  const handleRequestPortraitReplace = useCallback(
    (clientX: number, clientY: number) => onRequestPortraitReplace(story.id, clientX, clientY),
    [onRequestPortraitReplace, story.id],
  );
  const handleMove = useCallback((position: Point) => onMoveStory(story.id, position), [onMoveStory, story.id]);
  const handleBeginLiveMove = useCallback(
    (articleBox: ArticleBoxModel, pointer: LiveResizePointer) => onBeginLiveMove(story.id, articleBox, pointer),
    [onBeginLiveMove, story.id],
  );
  const handleResize = useCallback(
    (articleBox: ArticleBoxModel) => onResizeStory(story.id, articleBox),
    [onResizeStory, story.id],
  );
  const handleBeginLiveResize = useCallback(
    (articleBox: ArticleBoxModel, handle: LiveResizeHandle, pointer: LiveResizePointer) =>
      onBeginLiveResize(story.id, articleBox, handle, pointer),
    [onBeginLiveResize, story.id],
  );

  /*
    The horoscope is drawn as furniture, not composed as an article: a grid of
    twelve cells with tinted headers and zodiac glyphs, which the article
    composer cannot express — it flows prose and has no notion of a cell.

    Recognised from its own content rather than a flag threaded down from the
    feed, because a flag can be dropped by any conversion on the way and the
    failure would be silent. Every other box returns null here and falls
    through to ArticleBox untouched.
  */
  const rashifalReadings = parseRashifalReadings(
    richTextToPlainText(story.articleData?.headline ?? ""),
    richTextToPlainText(story.articleData?.body ?? ""),
  );

  if (rashifalReadings) {
    return (
      <RashifalGrid
        x={story.x}
        y={story.y}
        width={story.width}
        height={story.height}
        readings={rashifalReadings}
      />
    );
  }

  /*
    The signed editorial comment carries a writer's rail — portrait, name and a
    short summary — drawn over the box after the article. Furniture, not copy:
    the composer has no way to express a portrait with a caption stack beside a
    body that wraps around it.

    Both render paths ask `resolveAuthorBlock`, so a box that gets a rail on
    screen gets one in the PDF too. Every other story resolves to null and is
    untouched.
  */
  // Page 8 rules every package; the news pages separate theirs with white
  // space, so this resolves to null everywhere else.
  const boxRule = resolveEditorialBoxRule(story);
  // Hairlines down the gutters between an inside page's text columns.
  const columnRules = resolveColumnRules(story, layout.body?.columns);
  const authorBlock = story.compositionSettings.editorialPageStyle
    ? resolveAuthorBlock({
        // The slot the box came from decides whether it carries a rail — page 8
        // signs two of its seven pieces, not all of them.
        story: { ...story, storyNumber: story.templateStoryNumber },
        headlineBottom: layout.headline.y + layout.headline.height,
      })
    : null;

  const article = (
    <Profiler id={`ArticleBox:${story.id}`} onRender={onRenderProfile}>
      <ArticleBox
        articleBox={story}
        layout={layout}
        selected={!productionView && selected}
        selectedObjectType={selectedObjectType}
        selectedParagraphIndex={selectedParagraphIndex}
        contentMode={contentMode}
        priorityLabel={story.priority.toUpperCase()}
        showPriorityLabel={story.compositionSettings.showRegionDebug}
        showCompositionOverlays={!productionView}
        bodyRendererMode={story.compositionSettings.bodyRendererMode ?? "line"}
        interactionEnabled={!productionView}
        frameLayoutContext={frameLayoutContext}
        renderProfiler={renderProfiler}
        imageSource={imageSourcesByStoryId[story.id]}
        smartLayoutEnabled={smartLayoutEnabled}
        onSelect={handleSelect}
        onSelectObject={handleSelectObject}
        onSelectParagraph={handleSelectParagraph}
        onEditObject={handleEditObject}
        onContextMenu={handleContextMenu}
        onRequestImageReplace={handleRequestImageReplace}
        onMove={handleMove}
        onResize={handleResize}
        onBeginLiveMove={handleBeginLiveMove}
        onUpdateLiveMove={onUpdateLiveMove}
        onEndLiveMove={onEndLiveMove}
        onCancelLiveMove={onCancelLiveMove}
        onBeginLiveResize={handleBeginLiveResize}
        onUpdateLiveResize={onUpdateLiveResize}
        onEndLiveResize={onEndLiveResize}
        onCancelLiveResize={onCancelLiveResize}
      />
    </Profiler>
  );

  if (!authorBlock && !boxRule && columnRules.length === 0) {
    return article;
  }

  return (
    <>
      {/* The frame goes down first so the copy and the rail sit over it. */}
      {boxRule ? (
        <Rect
          x={boxRule.x}
          y={boxRule.y}
          width={boxRule.width}
          height={boxRule.height}
          stroke={boxRule.stroke}
          strokeWidth={boxRule.strokeWidth}
          listening={false}
        />
      ) : null}
      {article}
      {columnRules.map((rule, index) => (
        <Line
          key={`column-rule-${index}`}
          points={[rule.x, rule.top, rule.x, rule.bottom]}
          stroke={COLUMN_RULE_COLOUR}
          strokeWidth={COLUMN_RULE_WIDTH}
          listening={false}
        />
      ))}
      {authorBlock ? (
        <AuthorBlock
          {...authorBlock}
          interactionEnabled={!productionView}
          onRequestReplace={handleRequestPortraitReplace}
          onEditName={(bounds) => handleEditObject("editorName", bounds)}
        />
      ) : null}
    </>
  );
}, areStoryItemPropsEqual);

function areStoryItemPropsEqual(
  previous: StoryItemProps,
  next: StoryItemProps,
) {
  const reasons = getStoryItemChangeReasons(previous, next);

  if (reasons.length > 0) {
    next.renderProfiler?.recordOperation("why-render", 0, {
      component: `ArticleBox:${next.item.story.id}`,
      storyId: next.item.story.id,
      whyRendered: reasons.join(", "),
    });
  }

  return reasons.length === 0;
}

function getStoryItemChangeReasons(previous: StoryItemProps, next: StoryItemProps) {
  const previousStory = previous.item.story;
  const nextStory = next.item.story;
  const reasons: string[] = [];

  if (previous.item.layout !== next.item.layout) {
    reasons.push("layout changed");
  }

  if (
    previousStory.x !== nextStory.x ||
    previousStory.y !== nextStory.y ||
    previousStory.width !== nextStory.width ||
    previousStory.height !== nextStory.height
  ) {
    reasons.push("geometry changed");
  }

  if (previousStory.priority !== nextStory.priority) {
    reasons.push("priority changed");
  }

  if (
    previousStory.compositionSettings.showRegionDebug !==
    nextStory.compositionSettings.showRegionDebug
  ) {
    reasons.push("debug visibility changed");
  }

  if (
    previousStory.compositionSettings.bodyRendererMode !==
    nextStory.compositionSettings.bodyRendererMode
  ) {
    reasons.push("body renderer changed");
  }

  if (previous.selected !== next.selected) {
    reasons.push("selection changed");
  }

  if (previous.selected || next.selected) {
    if (previous.selectedObjectType !== next.selectedObjectType) {
      reasons.push("selected object changed");
    }

    if (previous.selectedParagraphIndex !== next.selectedParagraphIndex) {
      reasons.push("selected paragraph changed");
    }

    if (previous.contentMode !== next.contentMode) {
      reasons.push("content mode changed");
    }

    if (previous.frameLayoutContext !== next.frameLayoutContext) {
      reasons.push("frame layout context changed");
    }
  }

  if (previous.productionView !== next.productionView) {
    reasons.push("production view changed");
  }

  if (previous.renderProfiler !== next.renderProfiler) {
    reasons.push("profiler reference changed");
  }

  if (
    previous.imageSourcesByStoryId[previousStory.id] !==
    next.imageSourcesByStoryId[nextStory.id]
  ) {
    reasons.push("image source changed");
  }

  if (previous.smartLayoutEnabled !== next.smartLayoutEnabled) {
    reasons.push("smart layout flag changed");
  }

  if (
    previous.onSelectStory !== next.onSelectStory ||
    previous.onSelectObject !== next.onSelectObject ||
    previous.onSelectParagraph !== next.onSelectParagraph ||
    previous.onEditObject !== next.onEditObject ||
    previous.onContextMenu !== next.onContextMenu ||
    previous.onRequestImageReplace !== next.onRequestImageReplace ||
    previous.onRequestPortraitReplace !== next.onRequestPortraitReplace ||
    previous.onMoveStory !== next.onMoveStory ||
    previous.onResizeStory !== next.onResizeStory ||
    previous.onBeginLiveMove !== next.onBeginLiveMove ||
    previous.onUpdateLiveMove !== next.onUpdateLiveMove ||
    previous.onEndLiveMove !== next.onEndLiveMove ||
    previous.onCancelLiveMove !== next.onCancelLiveMove ||
    previous.onBeginLiveResize !== next.onBeginLiveResize ||
    previous.onUpdateLiveResize !== next.onUpdateLiveResize ||
    previous.onEndLiveResize !== next.onEndLiveResize ||
    previous.onCancelLiveResize !== next.onCancelLiveResize ||
    previous.onRenderProfile !== next.onRenderProfile
  ) {
    reasons.push("callback reference changed");
  }

  return reasons;
}

export const StoryLayer = memo(function StoryLayer({
  storyLayouts,
  selectedStoryId,
  selectedStoryIds = [],
  selectedObjectType,
  selectedParagraphIndex,
  contentMode,
  productionView,
  frameLayoutContext,
  renderProfiler,
  imageSourcesByStoryId,
  smartLayoutEnabled,
  onSelectStory,
  onSelectObject,
  onSelectParagraph,
  onEditObject,
  onContextMenu,
  onRequestImageReplace,
  onRequestPortraitReplace,
  onMoveStory,
  onResizeStory,
  onBeginLiveMove,
  onUpdateLiveMove,
  onEndLiveMove,
  onCancelLiveMove,
  onBeginLiveResize,
  onUpdateLiveResize,
  onEndLiveResize,
  onCancelLiveResize,
  onRenderProfile,
}: {
  storyLayouts: IncrementalStoryLayout[];
  selectedStoryId: string | null;
  selectedStoryIds?: string[];
  selectedObjectType: EditorObjectType;
  selectedParagraphIndex: number;
  contentMode: boolean;
  productionView: boolean;
  frameLayoutContext: FrameLayoutContext;
  renderProfiler?: PerformanceProfiler;
  imageSourcesByStoryId: Record<NewspaperStoryId, string>;
  smartLayoutEnabled: boolean;
  onSelectStory: (storyId: string, additive?: boolean) => void;
  onSelectObject: (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds, additive?: boolean) => void;
  onSelectParagraph: (storyId: string, paragraphIndex: number, bounds: EditorSelectionBounds) => void;
  onEditObject: (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds) => void;
  onContextMenu: (storyId: string, clientX: number, clientY: number) => void;
  onRequestImageReplace: (storyId: string, clientX: number, clientY: number) => void;
  onRequestPortraitReplace: (storyId: string, clientX: number, clientY: number) => void;
  onMoveStory: (storyId: string, position: Point) => void;
  onResizeStory: (storyId: string, articleBox: ArticleBoxModel) => void;
  onBeginLiveMove: (storyId: string, articleBox: ArticleBoxModel, pointer: LiveResizePointer) => void;
  onUpdateLiveMove: (pointer: LiveResizePointer) => void;
  onEndLiveMove: () => void;
  onCancelLiveMove: () => void;
  onBeginLiveResize: (
    storyId: string,
    articleBox: ArticleBoxModel,
    handle: LiveResizeHandle,
    pointer: LiveResizePointer,
  ) => void;
  onUpdateLiveResize: (pointer: LiveResizePointer) => void;
  onEndLiveResize: () => void;
  onCancelLiveResize: () => void;
  onRenderProfile: RenderProfilerCallback;
}) {
  return (
    <>
      {storyLayouts.map((item) => (
        <StoryItem
          key={item.story.id}
          item={item}
          selected={item.story.id === selectedStoryId || selectedStoryIds.includes(item.story.id)}
          selectedObjectType={selectedObjectType}
          selectedParagraphIndex={selectedParagraphIndex}
          contentMode={contentMode}
          productionView={productionView}
          frameLayoutContext={frameLayoutContext}
          renderProfiler={renderProfiler}
          imageSourcesByStoryId={imageSourcesByStoryId}
          smartLayoutEnabled={smartLayoutEnabled}
          onSelectStory={onSelectStory}
          onSelectObject={onSelectObject}
          onSelectParagraph={onSelectParagraph}
          onEditObject={onEditObject}
          onContextMenu={onContextMenu}
          onRequestImageReplace={onRequestImageReplace}
          onRequestPortraitReplace={onRequestPortraitReplace}
          onMoveStory={onMoveStory}
          onResizeStory={onResizeStory}
          onBeginLiveMove={onBeginLiveMove}
          onUpdateLiveMove={onUpdateLiveMove}
          onEndLiveMove={onEndLiveMove}
          onCancelLiveMove={onCancelLiveMove}
          onBeginLiveResize={onBeginLiveResize}
          onUpdateLiveResize={onUpdateLiveResize}
          onEndLiveResize={onEndLiveResize}
          onCancelLiveResize={onCancelLiveResize}
          onRenderProfile={onRenderProfile}
        />
      ))}
    </>
  );
});

export const GhostPreviewLayer = memo(function GhostPreviewLayer({
  drawCommands,
}: {
  drawCommands: PreviewDrawCommand[];
}) {
  return (
    <Group listening={false}>
      {drawCommands.map((command) => (
        <Rect
          key={command.id}
          x={command.rect.x}
          y={command.rect.y}
          width={command.rect.width}
          height={command.rect.height}
          stroke={command.stroke}
          strokeWidth={2}
          fill={command.fill}
          opacity={command.opacity}
          dash={command.dash}
          listening={false}
        />
      ))}
    </Group>
  );
});

export const SelectionLayer = memo(function SelectionLayer() {
  return null;
});

export const OverlayLayer = memo(function OverlayLayer() {
  return null;
});

export const DebugLayer = memo(function DebugLayer() {
  return null;
});

export const PerformanceLayer = memo(function PerformanceLayer({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
});
