import { updateDocumentPageFromStoryFrames } from "@/engines/DocumentEngine/DocumentEngine";
import { mergeDirtyFlags } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { ArticleBoxModel, StoryFrame } from "@/types/editor";
import type { NewspaperDocument, NewspaperPageId } from "@/types/document";
import type { LayoutSolution } from "./LayoutTransactionTypes";

export type StoryFrameGeometryUpdate = {
  storyId: string;
  before: ArticleBoxModel;
  after: ArticleBoxModel;
};

export type LayoutCommitResult = {
  committed: boolean;
  stories: StoryFrame[];
  document: NewspaperDocument;
  updatedStoryIds: string[];
  dirtyStoryIds: string[];
  geometryUpdates: StoryFrameGeometryUpdate[];
  warnings: string[];
  errors: string[];
};

const rectsEqual = (first: ArticleBoxModel, second: ArticleBoxModel) =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height;

const toArticleBoxModel = (value: ArticleBoxModel): ArticleBoxModel => ({
  x: value.x,
  y: value.y,
  width: value.width,
  height: value.height,
});

/**
 * Applies a validated LayoutSolution to StoryFrame copies and normalized document data.
 *
 * The commit is atomic: invalid solutions return the original stories/document
 * unchanged. The engine does not compose typography directly; it marks dirty
 * flags so the existing IncrementalCompositionEngine can recompose affected
 * stories through the current render pipeline.
 */
export const commitLayoutSolution = ({
  stories,
  document,
  pageId,
  solution,
}: {
  stories: StoryFrame[];
  document: NewspaperDocument;
  pageId: NewspaperPageId;
  solution: LayoutSolution;
}): LayoutCommitResult => {
  if (!solution.valid) {
    return {
      committed: false,
      stories,
      document,
      updatedStoryIds: [],
      dirtyStoryIds: [],
      geometryUpdates: [],
      warnings: [...solution.warnings],
      errors: ["LayoutSolution validation failed; commit rolled back.", ...solution.errors],
    };
  }

  const geometryUpdates: StoryFrameGeometryUpdate[] = [];
  const nextStories = stories.map((story) => {
    const nextRect = solution.after[story.id];

    if (!nextRect) {
      return story;
    }

    const before = toArticleBoxModel(story);
    const after = toArticleBoxModel(nextRect);

    if (rectsEqual(before, after)) {
      return story;
    }

    geometryUpdates.push({
      storyId: story.id,
      before,
      after,
    });

    return {
      ...story,
      ...after,
      dirtyFlags: mergeDirtyFlags(story.dirtyFlags, {
        geometryDirty: true,
        compositionDirty: true,
        renderDirty: true,
      }),
    };
  });
  const updatedStoryIds = geometryUpdates.map((update) => update.storyId).sort();

  if (updatedStoryIds.length === 0) {
    return {
      committed: true,
      stories,
      document,
      updatedStoryIds: [],
      dirtyStoryIds: [],
      geometryUpdates: [],
      warnings: ["LayoutSolution contained no story geometry changes.", ...solution.warnings],
      errors: [],
    };
  }

  return {
    committed: true,
    stories: nextStories,
    document: updateDocumentPageFromStoryFrames(document, nextStories, pageId),
    updatedStoryIds,
    dirtyStoryIds: [...updatedStoryIds],
    geometryUpdates,
    warnings: [...solution.warnings],
    errors: [],
  };
};

/** Public facade for atomic LayoutSolution commits. */
export const LayoutCommitEngine = {
  commitLayoutSolution,
};
