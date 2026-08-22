import { strict as assert } from "node:assert";
import { useEditorStore } from "./editorStore";

const getActiveHeaderSet = () => {
  const state = useEditorStore.getState();
  const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;

  assert(activeHeaderSetId, "expected active Header Set");

  return state.document.headerSystem.headerSets[activeHeaderSetId];
};

const assertHeaderApplyUndoRedo = () => {
  const state = useEditorStore.getState();
  const headerSet = getActiveHeaderSet();
  const profile = state.document.headerSystem.publicationProfiles[headerSet.publicationProfileId];
  const beforeName = profile.publicationName;
  const nextName = `${beforeName} TEST`;

  useEditorStore.getState().applyHeaderSetDraft({
    profileId: profile.id,
    profile: {
      ...profile,
      publicationName: nextName,
    },
    frontLayout: "heritage-institutional",
    insideLayout: "mirrored-facing-pages",
  });

  const changed = useEditorStore.getState();
  const changedHeaderSet = getActiveHeaderSet();
  const changedProfile = changed.document.headerSystem.publicationProfiles[changedHeaderSet.publicationProfileId];

  assert.equal(changedProfile.publicationName, nextName);
  assert.equal(changedHeaderSet.front.layout, "heritage-institutional");
  assert.equal(changedHeaderSet.inside.layout, "mirrored-facing-pages");

  useEditorStore.getState().undoHeaderOperation();

  const undone = useEditorStore.getState();
  const undoneHeaderSet = getActiveHeaderSet();
  const undoneProfile = undone.document.headerSystem.publicationProfiles[undoneHeaderSet.publicationProfileId];

  assert.equal(undoneProfile.publicationName, beforeName);
  assert.notEqual(undoneHeaderSet.front.layout, "heritage-institutional");

  useEditorStore.getState().redoHeaderOperation();

  const redone = useEditorStore.getState();
  const redoneHeaderSet = getActiveHeaderSet();
  const redoneProfile = redone.document.headerSystem.publicationProfiles[redoneHeaderSet.publicationProfileId];

  assert.equal(redoneProfile.publicationName, nextName);
  assert.equal(redoneHeaderSet.front.layout, "heritage-institutional");
  assert.equal(redoneHeaderSet.inside.layout, "mirrored-facing-pages");
};

const assertHeaderOverrideUndoRedo = () => {
  useEditorStore.getState().setActiveHeaderSectionOverride({
    sectionName: "Sports",
    displayName: "SPORTS DESK",
    layout: "section-color-band",
    accentColor: "#a33424",
  });

  let headerSet = getActiveHeaderSet();
  assert(headerSet.sectionOverrides.Sports, "section override should be applied");

  useEditorStore.getState().undoHeaderOperation();
  headerSet = getActiveHeaderSet();
  assert(!headerSet.sectionOverrides.Sports, "section override should be removed by undo");

  useEditorStore.getState().redoHeaderOperation();
  headerSet = getActiveHeaderSet();
  assert(headerSet.sectionOverrides.Sports, "section override should be restored by redo");
};

assertHeaderApplyUndoRedo();
assertHeaderOverrideUndoRedo();

console.log("Smart header integration tests passed: 2");
