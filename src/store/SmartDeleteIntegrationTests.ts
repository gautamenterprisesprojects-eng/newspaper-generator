import { strict as assert } from "node:assert";
import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import { createDocumentFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { createCleanDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import { createLiveResizeController } from "@/engines/LayoutTransactionEngine/LiveResizeController";
import { runLayoutKernelShadowDelete } from "@/engines/LayoutTransactionEngine/LayoutKernelAdapter";
import type { StoryFrame } from "@/types/editor";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";
import { prototypeArticle } from "@/data/prototypeArticle";
import { useEditorStore } from "./editorStore";

const toPoints = (inches: number) => inches * POINTS_PER_INCH;
const pageBounds = {
  x: 0,
  y: 0,
  width: toPoints(DEFAULT_PAGE_MASTER.width),
  height: toPoints(DEFAULT_PAGE_MASTER.height),
};
const contentBounds = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};
const columns = createColumnGrid({
  pageWidth: DEFAULT_PAGE_MASTER.width,
  contentX: DEFAULT_PAGE_MASTER.contentX,
  contentWidth: DEFAULT_PAGE_MASTER.contentWidth,
  columnCount: DEFAULT_PAGE_MASTER.columns,
  gutter: DEFAULT_PAGE_MASTER.gutter,
}).map((column) => ({
  index: column.index + 1,
  x: toPoints(column.x),
  y: contentBounds.y,
  width: toPoints(column.width),
  height: contentBounds.height,
}));

const rectOf = (story: StoryFrame) => ({
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

const toFrame = (story: StoryFrame, index: number) => ({
  id: story.id,
  pageId: "page-1",
  storyId: story.id,
  kind: "story" as const,
  locked: Boolean(story.locked),
  hidden: Boolean(story.hidden),
  pinned: false,
  priority: story.priority,
  columnStart: story.columnStart,
  columnSpan: story.columnSpan,
  zIndex: index,
  ...rectOf(story),
});

const story = (overrides: Partial<StoryFrame> & Pick<StoryFrame, "id">): StoryFrame => ({
  x: 18,
  y: 54,
  width: 294,
  height: 320,
  priority: "secondary",
  columnStart: 1,
  columnSpan: 2,
  imageEnabled: false,
  imageAlignment: "top-left",
  imageColumnSpan: 1,
  imageHeight: 80,
  imageHeightMode: "auto",
  imageHeightPreset: "tiny",
  imageHeightProtection: true,
  autoSizeImage: true,
  imageWrapMode: "none",
  headlineFontSize: 22,
  subheadlineFontSize: 13,
  bodyFontSize: 11,
  headlineLineHeight: 1,
  subheadlineLineHeight: 1,
  bodyLineHeight: 1,
  headlineWeight: "800",
  subheadlineWeight: "600",
  autoFitHeadline: true,
  autoBalanceHeadline: true,
  enableHyphenation: true,
  forceFullWidthHeadlines: false,
  headlineLayoutMode: "newspaper-fill",
  articleData: prototypeArticle,
  compositionSettings: {
    showRegionDebug: false,
    bodyRendererMode: "line",
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  },
  dirtyFlags: createCleanDirtyFlags(),
  ...overrides,
});

const assertDeletePreviewDoesNotMutate = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);
  const candidate = useEditorStore.getState().stories.find((item) => !item.locked && item.priority !== "lead")!;
  const before = useEditorStore.getState();

  useEditorStore.getState().deleteStory(candidate.id);

  const preview = useEditorStore.getState();
  assert.equal(preview.stories, before.stories);
  assert.equal(preview.document, before.document);
  assert(preview.liveResizePreviewDrawCommands.length > 0);
  useEditorStore.getState().cancelSmartDelete();
};

const assertDeleteCommitRemovesOneStory = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);
  const candidate = useEditorStore.getState().stories.find((item) => item.priority === "brief") ??
    useEditorStore.getState().stories.find((item) => !item.locked && item.priority !== "lead")!;
  const beforeCount = useEditorStore.getState().stories.length;

  useEditorStore.getState().deleteStory(candidate.id);
  useEditorStore.getState().confirmSmartDelete();

  const after = useEditorStore.getState();
  assert.equal(after.stories.length, beforeCount - 1);
  assert(!after.stories.some((item) => item.id === candidate.id));
  assert.equal(after.liveResizePreviewDrawCommands.length, 0);
};

const assertLockedDeleteRejects = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);
  const candidate = useEditorStore.getState().stories.find((item) => !item.locked)!;
  useEditorStore.getState().setStoryLocked(candidate.id, true);
  const before = useEditorStore.getState();

  useEditorStore.getState().deleteStory(candidate.id);

  const after = useEditorStore.getState();
  assert.equal(after.stories, before.stories);
  assert.equal(after.document, before.document);
  assert.equal(after.placementWarning, "Locked story cannot be deleted");
};

const assertDeleteRollbackPreservesState = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);
  const candidate = useEditorStore.getState().stories.find((item) => !item.locked)!;
  const before = useEditorStore.getState();

  useEditorStore.getState().deleteStory(candidate.id);
  useEditorStore.getState().cancelSmartDelete();

  const after = useEditorStore.getState();
  assert.equal(after.stories, before.stories);
  assert.equal(after.document, before.document);
  assert.equal(after.liveResizePreviewDrawCommands.length, 0);
};

const assertDeleteStoryTypesAndAds = () => {
  const frames = [
    story({ id: "lead", priority: "lead", role: "lead", columnSpan: 3 }),
    story({ id: "brief", priority: "brief", role: "brief", x: 330, columnStart: 3, columnSpan: 1 }),
    story({ id: "photo", priority: "major", imageEnabled: true, imageHeight: 180, x: 480, columnStart: 4 }),
    story({ id: "beside-ad", priority: "secondary", x: 630, columnStart: 5 }),
    story({ id: "neighbor", priority: "filler", y: 390 }),
  ];
  const layoutFrames = frames.map(toFrame);
  const withAd = [
    ...layoutFrames,
    {
      ...layoutFrames[3],
      id: "ad-1",
      storyId: undefined,
      kind: "advertisement" as const,
      locked: false,
      x: 780,
      width: 120,
    },
  ];

  for (const id of ["lead", "brief", "photo", "beside-ad"]) {
    const diff = runLayoutKernelShadowDelete({
      pageId: "page-1",
      pageBounds,
      contentBounds,
      columns,
      frames: withAd,
      sourceFrameId: id,
    });

    assert.equal(diff.solution.valid, true);
    assert.equal(diff.solution.after["ad-1"].x, 780);
  }
};

const assertDeleteSessionTransactionSupportsUndoRedo = () => {
  const stories = [
    story({ id: "delete-me" }),
    story({ id: "repair", y: 390, priority: "filler" }),
  ];
  const document = createDocumentFromStoryFrames(stories);
  const controller = createLiveResizeController();

  controller.beginDelete({
    pageId: "page-1",
    pageBounds,
    contentBounds,
    columns,
    frames: stories.map(toFrame),
    sourceFrameId: "delete-me",
    commitContext: {
      stories,
      document,
      pageId: document.pages[0].id,
    },
  });
  const preview = controller.updateDelete({ force: true });
  const end = controller.endDelete();
  const undone = controller["compositionSessionManager"].undo();
  const redone = controller["compositionSessionManager"].redo();

  assert(preview);
  assert.equal(end.committed, true);
  assert(end.transaction);
  assert.equal(undone?.operation, "delete-story");
  assert.equal(redone?.id, undone?.id);
};

assertDeletePreviewDoesNotMutate();
assertDeleteCommitRemovesOneStory();
assertLockedDeleteRejects();
assertDeleteRollbackPreservesState();
assertDeleteStoryTypesAndAds();
assertDeleteSessionTransactionSupportsUndoRedo();

console.log("Smart delete integration tests passed: 10");
