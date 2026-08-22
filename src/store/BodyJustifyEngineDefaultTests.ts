import { strict as assert } from "node:assert";
import { DEFAULT_BODY_JUSTIFY_ENGINE } from "@/engines/UniversalTypography/UniversalTypographyEngine";
import type { NewswireStory } from "@/lib/newswire";
import type { StoryFrame } from "@/types/editor";
import { useEditorStore } from "./editorStore";

const assertBodyBrowser = (story: StoryFrame, message: string) => {
  assert.equal(story.articleData.typography.bodyJustifyEngineMode, DEFAULT_BODY_JUSTIFY_ENGINE, message);
  assert.equal(story.articleData.typography.bodyJustifyEngineMode, "browser", message);
  assert.equal(story.articleData.typography.hjPreset, "newspaper-hindi-body", message);
};

const assertDisplayDefaultsUnchanged = (story: StoryFrame) => {
  assert.equal(story.articleData.typography.justifyEngineMode, "newspaper");
  assert.equal(story.articleData.typography.subheadlineJustifyEngineMode, "newspaper");
  assert.equal(story.articleData.typography.captionJustifyEngineMode, "newspaper");
};

const assertNewStoryDefaultsToBrowser = () => {
  const beforeIds = new Set(useEditorStore.getState().stories.map((story) => story.id));

  useEditorStore.getState().createStory();
  const created = useEditorStore.getState().stories.find((story) => !beforeIds.has(story.id));

  assert(created, "Expected createStory() to add a story.");
  assertBodyBrowser(created, "Newly created body story must default to Browser.");
  assertDisplayDefaultsUnchanged(created);
};

const assertGeneratedLayoutsDefaultToBrowser = () => {
  useEditorStore.getState().generateStoryLayout(5);

  for (const story of useEditorStore.getState().stories) {
    assertBodyBrowser(story, "Auto-generated story bodies must default to Browser.");
    assertDisplayDefaultsUnchanged(story);
  }
};

const assertNewswireImportsDefaultToBrowser = () => {
  const article: NewswireStory = {
    id: "newswire-body-default",
    category: "Sports",
    headline: "City road project brings relief",
    subheadline: "Three-column body default test",
    body: "The city desk said the project will improve traffic flow and help local businesses across the district.",
    summary: ["The project begins next month"],
    caption: "",
    imageCaption: "",
    imageUrl: "",
    sourceTitle: "Local Desk",
    sourceUrl: "",
    publishedAt: null,
  };

  useEditorStore.getState().importNewswireStories("Sports", [article], {
    subheadingStyle: {
      backgroundColor: "#111111",
      textColor: "#ffffff",
      borderColor: "#111111",
      backgroundOpacity: 1,
    },
    bodyAlignment: "justify",
  });

  const imported = useEditorStore.getState().stories.find((story) => story.articleData.headline === article.headline);

  assert(imported, "Expected imported newswire story to be added.");
  assertBodyBrowser(imported, "Imported body story must default to Browser.");
  assertDisplayDefaultsUnchanged(imported);
};

const assertDuplicatePreservesExplicitEngine = () => {
  useEditorStore.getState().generateStoryLayout(1);
  const source = useEditorStore.getState().stories[0];
  const beforeIds = new Set(useEditorStore.getState().stories.map((story) => story.id));

  useEditorStore.getState().selectStory(source.id);
  useEditorStore.getState().updateSelectedStoryArticleData("typography", {
    ...source.articleData.typography,
    bodyJustifyEngineMode: "newspaper",
  });
  useEditorStore.getState().duplicateStory(source.id);

  const duplicated = useEditorStore.getState().stories.find((story) => !beforeIds.has(story.id));

  assert(duplicated, "Expected duplicateStory() to add a copy.");
  assert.equal(duplicated.articleData.typography.bodyJustifyEngineMode, "newspaper");
};

assertNewStoryDefaultsToBrowser();
assertGeneratedLayoutsDefaultToBrowser();
assertNewswireImportsDefaultToBrowser();
assertDuplicatePreservesExplicitEngine();

console.log("Body justify engine default integration tests passed: 4");
