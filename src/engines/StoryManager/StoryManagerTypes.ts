import type { ArticleCompositionMetrics, StoryFrame, StoryPriority, StoryWorkflowStatus } from "@/types/editor";
import type { NewspaperPageId, NewspaperStoryId } from "@/types/document";

export type StoryManagerStatus = StoryWorkflowStatus;

export type StoryManagerFilter = {
  query: string;
  priority: StoryPriority | "all";
  pageId: NewspaperPageId | "all";
  status: StoryManagerStatus | "all";
};

export type StoryManagerCard = {
  id: NewspaperStoryId;
  pageId: NewspaperPageId;
  pageNumber: number;
  headline: string;
  name: string;
  author: string;
  category: string;
  tags: string[];
  priority: StoryPriority;
  status: StoryManagerStatus;
  color: string;
  columns: number;
  width: number;
  height: number;
  fillPercent: number;
  image: boolean;
  factBox: boolean;
  pullQuote: boolean;
  caption: boolean;
  locked: boolean;
  hidden: boolean;
  overflow: boolean;
  frame: StoryFrame | null;
  metrics: ArticleCompositionMetrics | null;
};

export type StoryManagerPageGroup = {
  pageId: NewspaperPageId;
  pageNumber: number;
  cards: StoryManagerCard[];
};

export type StoryManagerVirtualRange = {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  totalHeight: number;
};
