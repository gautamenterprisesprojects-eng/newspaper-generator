import { strict as assert } from "node:assert";
import { useEditorStore } from "./editorStore";
import type { ArticleBoxModel, ResizeHandle, StoryFrame } from "@/types/editor";

const rectOf = (story: StoryFrame): ArticleBoxModel => ({
  x: story.x,
  y: story.y,
  width: story.width,
  height: story.height,
});

const getRightResizeCandidate = () => {
  const state = useEditorStore.getState();
  const candidate = state.stories
    .filter((story) => !story.hidden && !story.locked)
    .find((story) =>
      state.stories.some((other) =>
        other.id !== story.id &&
        Math.abs(other.y - story.y) < 2 &&
        other.x > story.x &&
        other.height > 0,
      ),
    );

  assert(candidate, "Expected generated layout to contain a story with a right neighbor.");

  return candidate;
};

const assertFeatureFlagOffDoesNotStartPreview = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(false);

  const story = getRightResizeCandidate();
  useEditorStore.getState().beginLiveResize(story.id, rectOf(story), "e", {
    x: story.x + story.width,
    y: story.y + story.height / 2,
  });
  useEditorStore.getState().updateLiveResize({
    x: story.x + story.width + 24,
    y: story.y + story.height / 2,
  });

  assert.equal(useEditorStore.getState().liveResizePreviewDrawCommands.length, 0);
};

const getPointerForHandle = (story: StoryFrame, handle: ResizeHandle) => ({
  x: handle.includes("w") ? story.x : handle.includes("e") ? story.x + story.width : story.x + story.width / 2,
  y: handle.includes("n") ? story.y : handle.includes("s") ? story.y + story.height : story.y + story.height / 2,
});

const getDraggedPointer = (pointer: { x: number; y: number }, handle: ResizeHandle) => ({
  x: pointer.x + (handle.includes("e") ? 36 : handle.includes("w") ? -36 : 0),
  y: pointer.y + (handle.includes("s") ? 36 : handle.includes("n") ? -36 : 0),
});

const assertAllHandlesPreviewWithoutMutation = () => {
  const handles: ResizeHandle[] = ["e", "w", "n", "s", "ne", "nw", "se", "sw"];

  for (const handle of handles) {
    useEditorStore.getState().generateStoryLayout(5);
    useEditorStore.getState().setSmartLayoutEnabled(true);

    const beforeState = useEditorStore.getState();
    const story = getRightResizeCandidate();
    const beforeStories = beforeState.stories;
    const beforeDocument = beforeState.document;
    const pointer = getPointerForHandle(story, handle);

    useEditorStore.getState().beginLiveResize(story.id, rectOf(story), handle, pointer);
    useEditorStore.getState().updateLiveResize(getDraggedPointer(pointer, handle));

    const previewState = useEditorStore.getState();

    assert.equal(previewState.stories, beforeStories, `${handle} preview mutated stories`);
    assert.equal(previewState.document, beforeDocument, `${handle} preview mutated document`);
    assert(previewState.liveResizePreviewDrawCommands.length > 0, `${handle} did not produce preview`);

    useEditorStore.getState().cancelLiveResize();
  }
};

const assertResizeCommitsOnce = () => {
  useEditorStore.getState().generateStoryLayout(5);
  useEditorStore.getState().setSmartLayoutEnabled(true);

  const beforeState = useEditorStore.getState();
  const story = getRightResizeCandidate();
  const beforeStories = beforeState.stories;
  const beforeDocument = beforeState.document;

  useEditorStore.getState().beginLiveResize(story.id, rectOf(story), "e", {
    x: story.x + story.width,
    y: story.y + story.height / 2,
  });
  useEditorStore.getState().updateLiveResize({
    x: story.x + story.width + 36,
    y: story.y + story.height / 2,
  });

  const previewState = useEditorStore.getState();

  assert.equal(previewState.stories, beforeStories);
  assert.equal(previewState.document, beforeDocument);
  assert(previewState.liveResizePreviewDrawCommands.length > 0);

  useEditorStore.getState().endLiveResize();

  const afterState = useEditorStore.getState();

  assert.equal(afterState.liveResizePreviewDrawCommands.length, 0);
  assert.notEqual(afterState.stories, beforeStories);
  assert.notEqual(afterState.document, beforeDocument);
  assert(afterState.stories.some((item) => item.dirtyFlags?.geometryDirty));
};

assertFeatureFlagOffDoesNotStartPreview();
assertAllHandlesPreviewWithoutMutation();
assertResizeCommitsOnce();

console.log("Smart resize integration tests passed: 3");
