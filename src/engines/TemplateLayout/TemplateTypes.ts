import type { StoryPriority } from "@/types/editor";

export type TemplateId =
  // Original (locked)
  | "FrontPage5A"
  // Indian Front Page – 6-story
  | "IndianFront6A"
  | "IndianFront6B"
  // Indian Front Page – 7-story
  | "IndianFront7A"
  | "IndianFront7B"
  | "IndianMixed7A"
  // Indian Front Page – 8-story
  | "IndianFront8A"
  | "IndianFront8B"
  // Indian Front Page – 9 & 10-story
  | "IndianFront9A"
  | "IndianFront10A"
  // City page layouts
  | "IndianCity5A"
  | "IndianCity6A"
  // Sports page layouts
  | "IndianSports5A"
  | "IndianColumn5A"
  | "IndianBalance6A"
  // Layout Slot 15 – Professional Newspaper Layout – 10 Stories
  | "ProfessionalNews10A"
  // Advanced Designs – professional layouts modelled on Dainik Bhaskar / Times of India
  | "AdvancedHeroRail7A"
  | "AdvancedMosaicGrid8A"
  | "AdvancedSidebarFeature9A"
  | "AdvancedMagazineCover6A"
  | "AdvancedInfographicSplit7A"
  | "AdvancedSportsBleed6A"
  | "AdvancedEditorialColumn7A"
  | "AdvancedQuadMosaic7A"
  | "AdvancedBannerStack10A"
  | "AdvancedFeatureWrap9A"
  | "Layout16"
  // Dedicated front-page templates (masthead band reserved above row 1)
  | "CliffFront11A"
  | "CliffFront8A"
  // Front-page shape catalogue — one archetype each, see TemplateRegistry
  | "CliffFrontTwinRail10A"
  | "CliffFrontBannerLead9A"
  | "CliffFrontPhotoAnchor8A"
  | "CliffFrontQuadrant7A"
  | "CliffFrontMagazine6A"
  | "CliffFrontStackedBands7A"
  | "CliffFrontLWrap9A"
  | "CliffFrontMosaic12A"
  | "CliffFrontSplitVertical8A"
  | "CliffFrontSkybox10A"
  | "CliffFrontPyramid9A"
  | "CliffFrontHeroPhoto7A"
  | "CliffFrontEightColumn8A"
  | "CliffFrontEightColumn8B"
  | "CliffFrontEightColumn7C"
  | "CliffFrontEightColumn8D"
  | "CliffInsideEightColumn8A"
  | "CliffInsideEightColumn8B"
  | "CliffInsideEightColumn7C"
  | "CliffInsideEightColumn8D"
  | "CliffInsideSixColumn7A"
  | "CliffInsideSixColumn8B"
  | "CliffInsideSixColumn7C"
  | "CliffInsideSixColumn8D"
  // Dedicated editorial/comment page
  | "CliffEditorial8A"
  | "CliffEditorial9A"
  | "AkhandEditorial5A"
  | "AkhandVicharManthan6A"
  // Publisher-exclusive: Youth UPDATE only (see YouthUpdateConfig.ts) --
  // never offered to any other publisher, gated by publisher_id.
  | "CliffFrontYouthUpdate1A"
  | "CliffFrontYouthUpdate2A"
  | "CliffFrontYouthUpdate3A"
  | "CliffFrontYouthUpdate4A"
  | "CliffInsideYouthUpdate1A"
  | "CliffInsideYouthUpdate2A"
  | "CliffInsideYouthUpdate3A"
  | "CliffInsideYouthUpdate4A"
  | "CliffInsideYouthUpdate5A"
  | "CliffInsideYouthUpdate6A"
  | "CliffInsideYouthUpdate7A"
  | "CliffInsideYouthUpdate8A"
  | "CliffInsideYouthUpdate9A"
  | "CliffInsideYouthUpdate10A"
  | "CliffInsideYouthUpdate11A";

/**
 * Places a slot as a boxed sidebar *inside* another slot's rectangle instead of
 * as a peer column in the row.
 *
 * The parent keeps its full width — its banner, kicker and headline still span
 * every column it owns — and only its body divides around the sidebar. This is
 * the pattern behind the front page's boxed sidebar, which a plain row grid
 * cannot express: making the sidebar a peer column would cut the parent's
 * headline down to the remaining columns.
 */
export type TemplateSlotInset = {
  /** The slot this box sits inside. Must be a peer slot in the same row. */
  parentStoryNumber: number;
  /**
   * Where the sidebar's top edge sits, as a fraction of the parent's height.
   * Set it below the parent's banner + headline block so the two never collide;
   * the sidebar then runs to the foot of the parent box.
   */
  topFraction: number;
};

export type TemplateStorySlotDefinition = {
  storyNumber: number;
  row: number;
  columnStart: number;
  columnSpan: number;
  priority: StoryPriority;
  /** When set, this slot is nested inside its parent rather than beside it. */
  insetInto?: TemplateSlotInset;
  /**
   * Shortens only this frame's bottom edge by the given number of points.
   *
   * Used by editorial-page templates to avoid every adjacent box ending on the
   * same horizontal rule. Omitted by normal news/front/inside templates, so
   * their full-row geometry remains unchanged.
   */
  bottomTrimPt?: number;
  /** Shortens the bottom by a fraction of the computed frame height. */
  bottomTrimFraction?: number;
  /**
   * Pulls the frame's top edge upward while keeping its bottom edge anchored.
   *
   * Used sparingly for editorial pages when a lower story should absorb space
   * released by a shortened inset story above it.
   */
  topExtendPt?: number;
  /** Pulls the top upward by a fraction of the computed frame height. */
  topExtendFraction?: number;
};

export type TemplateRowRhythm = {
  row: number;
  baseRatio: number;
  receivesRemainingSpace: boolean;
  /**
   * Replaces the priority-derived floor (`getStoryHierarchyStyle().minimumHeight`)
   * for this row.
   *
   * Those floors are sized for generic pages and are taller than some bands of a
   * real front page — a lead's 560pt beats any ratio at broadsheet height, which
   * pushes the top band deep and starves the rest. A template whose band depths
   * are measured off a printed page states them here instead. Templates that omit
   * it keep the priority floors exactly as before.
   */
  minimumHeight?: number;
};

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  storyCount: number;
  rowRhythm?: TemplateRowRhythm[];
  slots: TemplateStorySlotDefinition[];
  /**
   * Columns this template's `columnStart`/`columnSpan` are stated against.
   *
   * Omitted by every news template, which are all drawn on the page master's
   * six columns. The editorial page is traced off a printed sheet set on four,
   * and forcing it onto six needs 1.5-column units that cannot be expressed —
   * so it states its own grid here and the layout engine builds the column
   * rhythm to match. Callers resolve it with `getTemplateColumnCount`.
   */
  columnCount?: number;
  /**
   * Story numbers whose box ends where their nested boxes begin.
   *
   * By default a slot hosting insets keeps its full height and the insets are
   * drawn over its lower half — right for a sidebar, which the parent's copy
   * flows around. The editorial page nests a whole band beneath its signed
   * comment instead, and there `reservedRegions` is not enough: it steers the
   * body around the band, but copy the region cannot hold is still placed, and
   * it printed straight through the nested feature's headline.
   *
   * Listing a slot here trims its rectangle to the top of its insets, so the
   * copy physically cannot run past them. Omitted by every news template, whose
   * nested sidebars keep the existing behaviour exactly.
   */
  trimToInsets?: number[];
};

export type TemplateLayoutInput = {
  templateId: TemplateId;
  pageWidth: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  columnCount: number;
  gutter: number;
};

export type TemplateStoryFrameSlot = {
  storyNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  columnStart: number;
  columnSpan: number;
  priority: StoryPriority;
  /**
   * Set on a nested sidebar: the story number of the box it sits inside. The
   * caller must reserve this rectangle in the parent's body so the parent's
   * text flows around it (see `ArticleCompositionSettings.reservedRegions`).
   */
  insetParentStoryNumber?: number;
};

export type TemplateLayoutResult = {
  templateId: TemplateId;
  storyCount: number;
  slots: TemplateStoryFrameSlot[];
};

export type PageLayoutDiagnostics = {
  pageFillPercent: number;
  unusedArea: number;
  averageRowGap: number;
  largestRowGap: number;
  rowDensityPercent: number;
  largestStoryPercent: number;
  smallestStoryPercent: number;
  averageStorySize: number;
  totalImageAreaPercent: number;
  textAreaPercent: number;
  editorialDensityPercent: number;
  imageDensityPercent: number;
  whitespacePercent: number;
  pageUtilizationPercent: number;
};
