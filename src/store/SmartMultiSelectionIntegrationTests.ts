import { strict as assert } from "node:assert";
import { useEditorStore } from "./editorStore";

const getVisibleStories = () => useEditorStore.getState().stories.filter((story) => !story.hidden);

const selectFirst = (count: number) => {
  const ids = getVisibleStories().slice(0, count).map((story) => story.id);

  useEditorStore.getState().selectStories(ids);

  return ids;
};

const assertSelectMultiple = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = getVisibleStories().slice(0, 2).map((story) => story.id);

  useEditorStore.getState().selectStory(ids[0]);
  useEditorStore.getState().selectStory(ids[1], true);

  assert.equal(useEditorStore.getState().selectedFrameIds.length, 2);
  useEditorStore.getState().selectAllStories();
  assert.equal(useEditorStore.getState().selectedFrameIds.length, getVisibleStories().length);
  useEditorStore.getState().clearSelection();
  assert.equal(useEditorStore.getState().selectedFrameIds.length, 0);
};

const assertDragMultiple = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = selectFirst(2);
  const before = Object.fromEntries(
    useEditorStore.getState().stories
      .filter((story) => ids.includes(story.id))
      .map((story) => [story.id, { x: story.x, y: story.y }]),
  );

  useEditorStore.getState().moveSelectedStories({ x: 12, y: 18 });

  for (const id of ids) {
    const story = useEditorStore.getState().stories.find((item) => item.id === id)!;
    assert(story.x > before[id].x);
    assert(story.y > before[id].y);
  }
};

const assertResizeMultiple = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = selectFirst(2);
  const beforeWidth = useEditorStore.getState().stories.find((story) => story.id === ids[0])!.width;

  useEditorStore.getState().resizeSelectedStoriesUniform(1.1);

  const afterWidth = useEditorStore.getState().stories.find((story) => story.id === ids[0])!.width;
  assert(afterWidth >= beforeWidth);
  assert(useEditorStore.getState().stories.some((story) => ids.includes(story.id) && story.dirtyFlags?.geometryDirty));
};

const assertAlignAndDistribute = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = selectFirst(3);

  useEditorStore.getState().alignSelectedStories("left");

  const aligned = useEditorStore.getState().stories.filter((story) => ids.includes(story.id));
  assert.equal(new Set(aligned.map((story) => story.x)).size, 1);

  useEditorStore.getState().distributeSelectedStories("equal-height");

  const distributed = useEditorStore.getState().stories.filter((story) => ids.includes(story.id));
  assert.equal(new Set(distributed.map((story) => story.height)).size, 1);
};

const assertDeleteDuplicateLockGroup = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = selectFirst(2);
  const beforeCount = useEditorStore.getState().stories.length;

  useEditorStore.getState().setSelectedStoriesLocked(true);
  assert(useEditorStore.getState().stories.filter((story) => ids.includes(story.id)).every((story) => story.locked));
  useEditorStore.getState().setSelectedStoriesLocked(false);
  useEditorStore.getState().duplicateSelectedStories();
  assert.equal(useEditorStore.getState().stories.length, beforeCount + 2);
  useEditorStore.getState().groupSelectedStories();
  assert(useEditorStore.getState().selectedFrameIds.every((frameId) => useEditorStore.getState().document.frames[frameId]?.metadata.groupId));
  useEditorStore.getState().ungroupSelectedStories();
  assert(useEditorStore.getState().selectedFrameIds.every((frameId) => !useEditorStore.getState().document.frames[frameId]?.metadata.groupId));

  useEditorStore.getState().deleteSelectedStories();
  assert.equal(useEditorStore.getState().stories.length, beforeCount);
};

const assertUndoRedo = () => {
  useEditorStore.getState().generateStoryLayout(5);
  const ids = selectFirst(2);
  const first = useEditorStore.getState().stories.find((story) => story.id === ids[0])!;
  const beforeX = first.x;

  useEditorStore.getState().moveSelectedStories({ x: 18, y: 0 });
  assert.equal(useEditorStore.getState().stories.find((story) => story.id === ids[0])!.x, beforeX + 18);

  useEditorStore.getState().undoMultiSelectionOperation();
  assert.equal(useEditorStore.getState().stories.find((story) => story.id === ids[0])!.x, beforeX);

  useEditorStore.getState().redoMultiSelectionOperation();
  assert.equal(useEditorStore.getState().stories.find((story) => story.id === ids[0])!.x, beforeX + 18);
};

assertSelectMultiple();
assertDragMultiple();
assertResizeMultiple();
assertAlignAndDistribute();
assertDeleteDuplicateLockGroup();
assertUndoRedo();

console.log("Smart multi-selection integration tests passed: 8");
