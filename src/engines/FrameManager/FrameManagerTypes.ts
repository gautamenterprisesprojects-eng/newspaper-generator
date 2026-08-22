import type {
  NewspaperDocument,
  NewspaperFrameId,
  NewspaperFrameObject,
  NewspaperFrameType,
  NewspaperPageId,
} from "@/types/document";

export type FrameLayerAction =
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back";

export type FrameManagerFilter = {
  query: string;
  pageId: NewspaperPageId | "all";
  frameType: NewspaperFrameType | "all";
  onlyLocked: boolean;
  onlyHidden: boolean;
  onlyOverflow: boolean;
};

export type FrameManagerCard = {
  frameId: NewspaperFrameId;
  pageId: NewspaperPageId;
  pageNumber: number;
  frameType: NewspaperFrameType;
  frameName: string;
  storyName: string;
  storyId: string | null;
  author: string;
  tags: string[];
  locked: boolean;
  hidden: boolean;
  overflow: boolean;
  selected: boolean;
  zIndex: number;
  color: string;
  frame: NewspaperFrameObject;
};

export type FrameManagerPageGroup = {
  pageId: NewspaperPageId;
  pageNumber: number;
  sectionName: string;
  cards: FrameManagerCard[];
};

export type FrameManagerStatus = {
  frameCount: number;
  storyCount: number;
  imageFrames: number;
  overflowFrames: number;
  visibleFrames: number;
  lockedFrames: number;
  hiddenFrames: number;
  selectedFrames: number;
};

export type FrameManagerVirtualRange = {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  totalHeight: number;
};

export type FrameManagerOperationResult = {
  document: NewspaperDocument;
  changedFrameIds: NewspaperFrameId[];
};
