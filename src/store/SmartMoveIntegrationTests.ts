import { strict as assert } from "node:assert";
import { useEditorStore } from "./editorStore";
import { runLayoutKernelShadowMove } from "@/engines/LayoutTransactionEngine/LayoutKernelAdapter";
import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import type { ArticleBoxModel, StoryFrame } from "@/types/editor";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const PAGE_RECT = {
  x: 0,
  y: 0,
  width: toPoints(DEFAULT_PAGE_MASTER.width),
  height: toPoints(DEFAULT_PAGE_MASTER.height),
};

const CONTENT_BOUNDS = {
  x: toPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toPoints(DEFAULT_PAGE_MASTER.contentHeight),
};

const createLayoutColumns = () =>
  createColumnGrid({
    pageWidth: DEFAULT_PAGE_MASTER.width,
    contentX: DEFAULT_PAGE_MASTER.contentX,
    contentWidth: DEFAULT_PAGE_MASTER.contentWidth,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter: DEFAULT_PAGE_MASTER.gutter,
  }).map((column) => ({
    index: column.index + 1,
    x: toPoints(column.x),
    y: CONTENT_BOUNDS.y,
    width: toPoints(column.width),
    height: CONTENT_BOUNDS.height,
  }));

const rectOf = (story: StoryFrame): ArticleBoxModel => ({
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

type MoveCandidate = {
  story: StoryFrame;
  dx: number;
  dy: number;
};

const toFrame = (story: StoryFrame, index: number) => ({
  id: story.id,
  pageId: useEditorStore.getState().activePageId,
  storyId: story.id,
  kind: "story" as const,
  locked: Boolean(story.locked),
  hidden: Boolean(story.hidden),
  pinned: false,
  priority: story.priority,
  columnStart: story.columnStart,
  columnSpan: story.columnSpan,
  zIndex: index,
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

const isValidMoveCandidate = (story: StoryFrame, dx: number, dy: number) => {
  const state = useEditorStore.getState();
  const requested = {
    x: story.x + dx,
    y: story.y + dy,
    width: story.width,
    height: story.height,
  };
  const diff = runLayoutKernelShadowMove({
    pageId: state.activePageId,
    pageBounds: PAGE_RECT,
    contentBounds: CONTENT_BOUNDS,
    columns: createLayoutColumns(),
    frames: state.stories.map(toFrame),
    sourceFrameId: story.id,
    before: rectOf(story),
    requested,
  });

  return diff.solution.valid && diff.geometryDifferences.length > 0;
};

const moveDeltas = [
  { dx: 36, dy: 24 },
  { dx: 36, dy: 0 },
  { dx: 0, dy: 24 },
  { dx: -36, dy: 24 },
  { dx: 36, dy: -24 },
  { dx: -36, dy: 0 },
  { dx: 0, dy: -24 },
];

const getCandidate = (needsMoveRoom = false): MoveCandidate => {
  const story = useEditorStore.getState().stories.find((item) => !item.hidden && !item.locked);
  const roomyStory = useEditorStore.getState().stories.flatMap((item) =>
    moveDeltas.map(({ dx, dy }) => ({ story: item, dx, dy })),
  ).find(({ story: item, dx, dy }) =>
    !item.hidden &&
    !item.locked &&
    item.x + item.width + Math.max(0, dx) <= 918 &&
    item.y + item.height + Math.max(0, dy) <= 1494 &&
    item.x + Math.min(0, dx) >= 18 &&
    item.y + Math.min(0, dy) >= 54 &&
    isValidMoveCandidate(item, dx, dy),
  );

  assert(needsMoveRoom ? roomyStory : story, "Expected a movable story.");

  return needsMoveRoom ? roomyStory! : { story: story!, dx: 36, dy: 24 };
};

const assertMovePreviewDoesNotMutate = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);

  const before = useEditorStore.getState();
  const { story, dx } = getCandidate(true);
  const start = { x: story.x + story.width / 2, y: story.y + story.height / 2 };

  useEditorStore.getState().beginLiveMove(story.id, rectOf(story), start);
  useEditorStore.getState().updateLiveMove({ x: start.x + dx, y: start.y });

  const preview = useEditorStore.getState();

  assert.equal(preview.stories, before.stories);
  assert.equal(preview.document, before.document);
  assert(preview.liveResizePreviewDrawCommands.length > 0);

  useEditorStore.getState().cancelLiveMove();
};

const assertMoveCommitsOnce = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);

  const before = useEditorStore.getState();
  const { story, dx, dy } = getCandidate(true);
  const start = { x: story.x + story.width / 2, y: story.y + story.height / 2 };

  useEditorStore.getState().beginLiveMove(story.id, rectOf(story), start);
  useEditorStore.getState().updateLiveMove({ x: start.x + dx, y: start.y + dy });
  useEditorStore.getState().endLiveMove();

  const after = useEditorStore.getState();

  assert.equal(after.liveResizePreviewDrawCommands.length, 0);
  assert.notEqual(after.stories, before.stories);
  assert.notEqual(after.document, before.document);
  assert(after.stories.some((item) => item.dirtyFlags?.geometryDirty));
};

const assertLockedMoveRollsBack = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);

  const { story } = getCandidate();
  useEditorStore.getState().setStoryLocked(story.id, true);
  const lockedStory = useEditorStore.getState().stories.find((item) => item.id === story.id)!;
  const before = useEditorStore.getState();
  const start = { x: lockedStory.x + lockedStory.width / 2, y: lockedStory.y + lockedStory.height / 2 };

  useEditorStore.getState().beginLiveMove(lockedStory.id, rectOf(lockedStory), start);
  useEditorStore.getState().updateLiveMove({ x: start.x + 36, y: start.y });
  useEditorStore.getState().endLiveMove();

  const after = useEditorStore.getState();

  assert.equal(after.stories, before.stories);
  assert.equal(after.document, before.document);
  assert.equal(after.liveResizePreviewDrawCommands.length, 0);
  assert.equal(after.placementWarning, "Locked story cannot be moved");
};

const assertMoveAdapterRespectsAdsAndLockedFrames = () => {
  const frames = [
    {
      id: "source",
      pageId: "page-1",
      kind: "story",
      locked: false,
      hidden: false,
      pinned: false,
      priority: "secondary",
      zIndex: 0,
      x: 20,
      y: 20,
      width: 180,
      height: 160,
    },
    {
      id: "ad",
      pageId: "page-1",
      kind: "advertisement",
      locked: false,
      hidden: false,
      pinned: false,
      priority: "secondary",
      zIndex: 1,
      x: 220,
      y: 20,
      width: 180,
      height: 160,
    },
    {
      id: "locked",
      pageId: "page-1",
      kind: "story",
      locked: true,
      hidden: false,
      pinned: false,
      priority: "secondary",
      zIndex: 2,
      x: 20,
      y: 220,
      width: 180,
      height: 120,
    },
  ] as const;
  const diff = runLayoutKernelShadowMove({
    pageId: "page-1",
    pageBounds: { x: 0, y: 0, width: 640, height: 820 },
    contentBounds: { x: 20, y: 20, width: 600, height: 760 },
    columns: [
      { index: 1, x: 20, y: 20, width: 180, height: 760 },
      { index: 2, x: 220, y: 20, width: 180, height: 760 },
      { index: 3, x: 420, y: 20, width: 200, height: 760 },
    ],
    frames: frames as never,
    sourceFrameId: "source",
    before: { x: 20, y: 20, width: 180, height: 160 },
    requested: { x: 80, y: 80, width: 180, height: 160 },
  });

  assert.equal(diff.solution.after.ad.x, 220);
  assert.equal(diff.solution.after.locked.y, 220);
};

assertMovePreviewDoesNotMutate();
assertMoveCommitsOnce();
assertLockedMoveRollsBack();
assertMoveAdapterRespectsAdsAndLockedFrames();

console.log("Smart move integration tests passed: 4");
