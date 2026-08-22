import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { getFramePlacementsForPage } from "@/engines/DocumentEngine/DocumentEngine";
import type { IncrementalStoryLayout } from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import type { StoryFrame, StoryPriority } from "@/types/editor";
import type { NewspaperDocument } from "@/types/document";
import type {
  StoryManagerCard,
  StoryManagerFilter,
  StoryManagerPageGroup,
  StoryManagerStatus,
  StoryManagerVirtualRange,
} from "./StoryManagerTypes";

const priorityColors: Record<StoryPriority | "advertisement" | "locked", string> = {
  lead: "#b42318",
  major: "#b45309",
  secondary: "#1d4ed8",
  brief: "#166534",
  filler: "#4b5563",
  advertisement: "#6b7280",
  locked: "#6d28d9",
};

export const getStoryManagerPriorityColor = ({
  priority,
  locked,
}: {
  priority: StoryPriority;
  locked: boolean;
}) => (locked ? priorityColors.locked : priorityColors[priority]);

const normalizeSearch = (value: string) => value.trim().toLowerCase();

export const deriveStoryStatus = ({
  frame,
  metrics,
}: {
  frame: StoryFrame;
  metrics: StoryManagerCard["metrics"];
}): StoryManagerStatus => {
  if (frame.locked) {
    return "locked";
  }

  if (metrics?.overflow) {
    return "overflow";
  }

  if (frame.imageEnabled && !frame.articleData.caption.enabled) {
    return "needs-caption";
  }

  if (!frame.imageEnabled && frame.priority !== "brief" && frame.priority !== "filler") {
    return "needs-image";
  }

  if (richTextToPlainText(frame.articleData.headline).trim().length === 0) {
    return "incomplete";
  }

  return frame.status ?? "draft";
};

export const createStoryManagerCards = ({
  document,
  stories,
  storyLayouts,
}: {
  document: NewspaperDocument;
  stories: StoryFrame[];
  storyLayouts: IncrementalStoryLayout[];
}): StoryManagerPageGroup[] => {
  const framesById = new Map(stories.map((story) => [story.id, story]));
  const layoutMetricsByStoryId = new Map(
    storyLayouts.map(({ story, layout }) => [story.id, layout.metrics]),
  );

  return document.pages.map((page) => {
    const cards: StoryManagerCard[] = [];

    for (const placement of getFramePlacementsForPage(document, page.id)) {
        const frame = framesById.get(placement.storyId);
        const storyObject = document.stories[placement.storyId];

        if (!frame && !storyObject) {
          continue;
        }

        const metrics = frame ? layoutMetricsByStoryId.get(frame.id) ?? null : storyObject?.compositionMetrics ?? null;
        const headline = richTextToPlainText(frame?.articleData.headline ?? storyObject?.headline ?? { spans: [] }).trim();
        const category = frame?.category ?? storyObject?.category ?? page.pageType;
        const locked = Boolean(frame?.locked ?? storyObject?.locked);
        const priority = frame?.priority ?? placement.priority;

        cards.push({
          id: placement.storyId,
          pageId: page.id,
          pageNumber: page.pageNumber,
          headline: headline || "Untitled Story",
          name: frame?.name || storyObject?.name || headline || placement.storyId,
          author: frame?.articleData.author ?? storyObject?.byline.author ?? "",
          category,
          tags: frame?.tags ?? storyObject?.tags ?? [],
          priority,
          status: frame ? deriveStoryStatus({ frame, metrics }) : storyObject?.status ?? "draft",
          color: getStoryManagerPriorityColor({ priority, locked }),
          columns: placement.columnSpan,
          width: Math.round(placement.width),
          height: Math.round(placement.height),
          fillPercent: Math.round(metrics?.fillPercentage ?? metrics?.storyFillPercent ?? 0),
          image: frame?.imageEnabled ?? storyObject?.imageSettings.imageEnabled ?? false,
          factBox: frame?.compositionSettings.enableFactBox ?? false,
          pullQuote: frame?.compositionSettings.enablePullQuote ?? false,
          caption: frame?.articleData.caption.enabled ?? storyObject?.caption.enabled ?? false,
          locked,
          hidden: Boolean(frame?.hidden ?? storyObject?.hidden),
          overflow: Boolean(metrics?.overflow),
          frame: frame ?? null,
          metrics,
        });
      }

    return {
      pageId: page.id,
      pageNumber: page.pageNumber,
      cards,
    };
  });
};

export const filterStoryManagerCards = (
  pageGroups: StoryManagerPageGroup[],
  filter: StoryManagerFilter,
): StoryManagerPageGroup[] => {
  const query = normalizeSearch(filter.query);

  return pageGroups
    .map((page) => ({
      ...page,
      cards: page.cards.filter((card) => {
        if (filter.pageId !== "all" && card.pageId !== filter.pageId) {
          return false;
        }

        if (filter.priority !== "all" && card.priority !== filter.priority) {
          return false;
        }

        if (filter.status !== "all" && card.status !== filter.status) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          card.headline,
          card.name,
          card.author,
          card.category,
          card.priority,
          card.status,
          card.pageNumber.toString(),
          ...card.tags,
        ].some((value) => normalizeSearch(value).includes(query));
      }),
    }))
    .filter((page) => page.cards.length > 0 || filter.pageId !== "all");
};

export const flattenStoryManagerCards = (pageGroups: StoryManagerPageGroup[]) =>
  pageGroups.flatMap((page) => page.cards);

export const calculateStoryManagerVirtualRange = ({
  itemCount,
  scrollTop,
  viewportHeight,
  itemHeight,
  overscan = 4,
}: {
  itemCount: number;
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  overscan?: number;
}): StoryManagerVirtualRange => {
  const firstVisible = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(itemCount, firstVisible + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * itemHeight,
    totalHeight: itemCount * itemHeight,
  };
};
