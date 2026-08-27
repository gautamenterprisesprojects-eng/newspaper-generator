"use client";

import { GenerationWizardModal } from "./GenerationWizardModal";
import type { WizardTab } from "./GenerationWizardModal";

import { Activity, AlignCenter, AlignJustify, AlignLeft, AlignRight, Eye, EyeOff, Minus, Plus, SquarePlus, X } from "lucide-react";
import { Profiler, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Group, Layer, Line, Rect, Stage } from "react-konva";
import type Konva from "konva";
import { PDFDocument } from "pdf-lib";
import { AdvertisementManagerPanel } from "@/components/editor/AdvertisementManagerPanel";
import { ArticleInspectorPanel } from "@/components/editor/ArticleInspectorPanel";
import { AssetManagerPanel } from "@/components/editor/AssetManagerPanel";
import { FontDiagnosticsPanel } from "@/components/editor/FontDiagnosticsPanel";
import { HeaderManagerPanel } from "@/components/editor/HeaderManagerPanel";
import { InlineObjectTextEditor } from "@/components/editor/InlineObjectTextEditor";
import { PagePreviewOverlay } from "@/components/editor/PagePreviewOverlay";
import { ObjectFloatingToolbar } from "@/components/editor/ObjectFloatingToolbar";
import { usePublisherEditorialAuthorStore } from "@/store/publisherEditorialAuthorStore";
import { useYouthUpdateTeaserStore, FALLBACK_TEASERS } from "@/store/youthUpdateTeaserStore";
import { useYouthUpdateInsideTeaserLiveStore } from "@/store/youthUpdateInsideTeaserLiveStore";
import {
  DebugLayer,
  GridLayer,
  GhostPreviewLayer,
  GuideLayer,
  BaselineGridLayer,
  MeasurementLayer,
  OverlayLayer,
  PageChromeLayer,
  PerformanceLayer,
  RulerLayer,
  SelectionLayer,
  StoryLayer,
  type EditorGuide,
} from "@/components/editor/CanvasRenderLayers";
import { PerformanceOverlay } from "@/components/editor/PerformanceOverlay";
import { YouthUpdateEditorialRailImage } from "@/components/editor/YouthUpdateEditorialRailImage";
import { YouthUpdateShortNewsBanner } from "@/components/editor/YouthUpdateShortNewsBanner";
import { YouthUpdateInsideRail } from "@/components/editor/YouthUpdateInsideRail";
import { computeImageCoverCrop } from "@/engines/ImagePlacement/computeImageCoverCrop";
import { FrameManagerPanel } from "@/components/editor/FrameManagerPanel";
import { StyleManagerPanel } from "@/components/editor/StyleManagerPanel";
import {
  CommandPalette,
  FloatingWorkspacePanels,
  HistoryPanel,
  NavigatorPanel,
  PanelRoutingMenu,
  PlaceholderPanel,
  QuickSearchPanel,
  ShortcutOverlay,
  usePersistentWorkspaceState,
  WorkspaceDock,
  WorkspaceToolbar,
} from "@/components/editor/workspace/WorkspacePanels";
import { getPageSeparatorRuleStyle } from "@/engines/EditorialStyle/EditorialStyleEngine";
import {
  composeStoriesIncrementally,
  type IncrementalStoryLayout,
  type StoryCompositionCache,
} from "@/engines/IncrementalComposition/IncrementalCompositionEngine";
import {
  createInitialFontManagerState,
  waitForNewspaperFonts,
} from "@/engines/FontManager/FontManagerEngine";
import type { FontManagerState } from "@/engines/FontManager/FontManagerTypes";
import {
  createPerformanceProfiler,
  getMemoryUsageMb,
} from "@/engines/PerformanceProfiler/PerformanceProfilerEngine";
import {
  alignFrameRects,
  createFrameLayoutContext,
  distributeFrameRects,
  getAlignmentTargetBounds,
} from "@/engines/FrameLayout/FrameLayoutInteractionEngine";
import type {
  FrameAlignment,
  FrameAlignmentTarget,
  FrameDistributionAxis,
  FrameLayoutRect,
} from "@/engines/FrameLayout/FrameLayoutInteractionTypes";
import {
  countArticleLayoutNodes,
  countKonvaNodes,
  createStoryRenderHash,
  type KonvaNodeProfile,
} from "@/engines/PerformanceProfiler/RenderPipelineProfilerEngine";
import type { LiveResizePointer } from "@/engines/LayoutTransactionEngine/LiveResizeController";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { applyStyleToRange, normalizeRichText } from "@/engines/RichText/RichTextUtils";
import { normalizeContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import {
  getObjectAlignment,
  setObjectAlignment,
  setObjectJustifyMode,
} from "@/engines/ObjectParagraphStyles/ObjectParagraphStyleEngine";
import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import { calculateStoryDominanceMetrics } from "@/engines/StorySpan/StorySpanEngine";
import { calculatePageLayoutDiagnostics, generateTemplateLayout } from "@/engines/TemplateLayout/TemplateLayoutEngine";
import { getTemplateColumnCount, TEMPLATE_REGISTRY, FRONT_PAGE_TEMPLATE_IDS } from "@/engines/TemplateLayout/TemplateRegistry";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import {
  buildEditorialStories,
  getHealthSlotIndex,
  getTemplateColumnSpans,
  getRashifalSlotIndex,
  type EditorialFeedRecord,
  type RashifalRecord,
} from "@/lib/editorialNewswire";
import { buildHeaderPrintModel, resolveHeaderReservedContentBounds, resolvePageHeader, type HeaderPrintTextOperation } from "@/engines/HeaderSystem";
import {
  NEWSWIRE_CATEGORIES,
  NEWSWIRE_SUBHEADING_PRESETS,
  NEWSWIRE_TINT_PRESETS,
  getPaletteInlineAccent,
  getPaletteSubheadingStyle,
  getPaletteTintColor,
  isNewswireCategory,
  type PageLanguageMode,
  type NewswireCategory,
  type NewswireStory,
  type NewswireSubheadingPreset,
  type NewswireTintPreset,
} from "@/lib/newswire";
import { computeEvenCategoryTargets, computeWeightedCategoryTargets, shuffleNewswireStories } from "@/lib/newswireCategoryMix";
import {
  buildPortalIssueArticleSession,
  isIssueArticleExcluded,
  loadFullIssueUsedArticles,
  loadIssueArticleExclusions,
  normalizeIssueArticleHeadline,
  readPortalIssueArticleSession,
  saveIssueUsedArticles,
} from "@/lib/portalIssueArticleUsage";
import { WIZARD_LAYOUT_DESIGNS, type NewswireImportOptions } from "./GenerationWizardModal";
import { loadStoriesForPage, useEditorStore } from "@/store/editorStore";
import type { WorkspaceCommand, WorkspacePanelId } from "@/engines/WorkspaceManager/WorkspaceManagerTypes";
import { activateDockPanel, toggleDockCollapsed } from "@/engines/WorkspaceManager/WorkspaceManagerEngine";
import type {
  ArticleBoxModel,
  ArticleData,
  ArticleLayout,
  ArticleTextStyle,
  EditorObjectType,
  EditorPerformanceDiagnostics,
  EditorSelectionBounds,
  EditorialTextAlignment,
  ObjectContainerStyle,
  Point,
  StoryFrame,
  TypographyEditingScope,
} from "@/types/editor";
import type { NewspaperPageObject } from "@/types/document";
import type { AssetImportDescriptor } from "@/engines/AssetManager/AssetManagerTypes";
import type { RichTextContent, RichTextStyle } from "@/types/RichText";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { getPressColourBar } from "@/engines/MasterPage/PressColourBarGeometry";
import {
  getYouthUpdateMastheadGeometry,
  YOUTH_UPDATE_COLORS,
  YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX,
  YOUTH_UPDATE_WORDMARK_FONT_FAMILY,
} from "@/engines/MasterPage/YouthUpdateMastheadGeometry";
import {
  YOUTH_UPDATE_FRONT_TEMPLATE_ID,
  YOUTH_UPDATE_FRONT_TEMPLATE_IDS,
  YOUTH_UPDATE_INSIDE_TEMPLATE_IDS,
  YOUTH_UPDATE_PUBLISHER_ID,
  YOUTH_UPDATE_REGISTRATION_NUMBER,
  isYouthUpdateHeaderOnlyInsideTemplateId,
  isYouthUpdateInsideTemplateId,
  isYouthUpdatePortalSession,
} from "@/engines/MasterPage/YouthUpdateConfig";
import { getYouthUpdateTeasersOrFallback } from "@/store/youthUpdateTeaserStore";
import {
  getYouthUpdateInsideTeaserLiveItems,
  mergeYouthUpdateInsideTeaserCards,
} from "@/store/youthUpdateInsideTeaserLiveStore";
import { getYouthUpdateInsideRailItems } from "@/store/youthUpdateInsideRailStore";
import { getYouthUpdateRightDividers, getYouthUpdateHatchDividerTicks } from "@/engines/MasterPage/YouthUpdateBodyDividers";
import { drawYouthUpdateEditorialRailToCanvas } from "@/engines/MasterPage/drawYouthUpdateEditorialRail";
import { drawYouthUpdateShortNewsBannerToCanvas } from "@/engines/MasterPage/drawYouthUpdateShortNewsBanner";
import { drawYouthUpdateInsideHeaderToCanvas } from "@/engines/MasterPage/drawYouthUpdateInsideHeader";
import { drawYouthUpdateInsideTeaserStripToCanvas } from "@/engines/MasterPage/drawYouthUpdateInsideTeaserStrip";
import {
  getYouthUpdateInsideAuthorOrFallback,
  loadYouthUpdateInsideAuthorsFromPortal,
} from "@/store/youthUpdateInsideAuthorStore";
import { drawYouthUpdateInsideRailToCanvas } from "@/engines/MasterPage/drawYouthUpdateInsideRail";
import { parseRashifalReadings } from "@/engines/MasterPage/RashifalGridGeometry";
import { drawRashifalGridToCanvas } from "@/engines/MasterPage/drawRashifalGrid";
import { resolveAuthorBlock } from "@/engines/MasterPage/AuthorBlockGeometry";
import { drawAuthorBlockToCanvas } from "@/engines/MasterPage/drawAuthorBlock";
import {
  drawEditorialBoxRuleToCanvas,
  resolveEditorialBoxRule,
} from "@/engines/MasterPage/EditorialBoxRule";
import {
  drawColumnRulesToCanvas,
  resolveColumnRules,
} from "@/engines/MasterPage/ColumnRuleGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { EDITORIAL_COLOURS, EDITORIAL_RAIL } from "@/engines/MasterPage/EditorialPageStyle";
import { GRID_SIZE, snapValue } from "@/utils/grid";
import { NEWSPAPER_PAGE, POINTS_PER_INCH, RULER_SIZE } from "@/utils/page";

type Viewport = {
  width: number;
  height: number;
};

const LEFT_PANEL_WIDTH = 292;
const RIGHT_INSPECTOR_WIDTH = 320;
const PANEL_GAP = 18;
const TOP_TOOLBAR_HEIGHT = 82;
const BOTTOM_STATUS_HEIGHT = 116;
const PUBLISHER_LEFT_RATIO = 0.25;
const PUBLISHER_CENTER_RATIO = 0.6;
const PUBLISHER_RIGHT_RATIO = 0.15;
const PUBLISHER_COLUMN_PADDING = 12;
const MAJOR_GRID_INTERVAL = POINTS_PER_INCH;
const pageMaster = DEFAULT_PAGE_MASTER;
const layoutArticleCounts = [5, 6, 7, 8, 10, 12];
const wizardAccentPresets = NEWSWIRE_SUBHEADING_PRESETS.filter((preset) => preset.id !== "custom");
/**
 * True when the page on the canvas is one of Youth UPDATE's front pages.
 *
 * Recognised by slot shape rather than by a stored template id, because the
 * committed page keeps only its story frames — the id it was generated from is
 * not carried through. Reads the shapes straight out of TEMPLATE_REGISTRY for
 * every id in YOUTH_UPDATE_FRONT_TEMPLATE_IDS (the same approach
 * getYouthUpdateInsideTemplateIdFromLayoutShape already takes for the inside
 * pages) so adding a front-page design needs no second copy of its geometry
 * here. All eight slots must match exactly, which is what keeps another
 * publisher's 8-story front page from being mistaken for this one.
 */
const isYouthUpdateFrontLayoutShape = (
  storyLayouts: Array<{ story: Pick<StoryFrame, "templateStoryNumber" | "columnStart" | "columnSpan" | "priority"> }>,
) =>
  YOUTH_UPDATE_FRONT_TEMPLATE_IDS.some((templateId) => {
    const template = TEMPLATE_REGISTRY[templateId];
    if (!template) return false;
    return template.slots.every((slot) => {
      const story = storyLayouts.find((item) => item.story.templateStoryNumber === slot.storyNumber)?.story;
      return (
        story?.columnStart === slot.columnStart &&
        story.columnSpan === slot.columnSpan &&
        story.priority === slot.priority
      );
    });
  });

const getYouthUpdateInsideTemplateIdFromLayoutShape = (
  storyLayouts: Array<{ story: Pick<StoryFrame, "templateStoryNumber" | "columnStart" | "columnSpan" | "priority"> }>,
): TemplateId | null => {
  for (const templateId of YOUTH_UPDATE_INSIDE_TEMPLATE_IDS) {
    const template = TEMPLATE_REGISTRY[templateId];
    if (!template) continue;
    const matches = template.slots.every((slot) => {
      const story = storyLayouts.find((item) => item.story.templateStoryNumber === slot.storyNumber)?.story;
      return (
        story?.columnStart === slot.columnStart &&
        story.columnSpan === slot.columnSpan &&
        story.priority === slot.priority
      );
    });
    if (matches) return templateId;
  }
  return null;
};
const wizardLayoutDesigns: Array<{ id: TemplateId; name: string; storyCount: number }> = [
  { id: "IndianFront6A", name: "Indian Front 6A", storyCount: 6 },
  { id: "IndianFront6B", name: "Indian Front 6B", storyCount: 6 },
  { id: "IndianFront7A", name: "Indian Front 7A", storyCount: 7 },
  { id: "IndianFront7B", name: "Indian Front 7B", storyCount: 7 },
  { id: "IndianMixed7A", name: "Indian Mixed 7A", storyCount: 7 },
  { id: "IndianFront8A", name: "Indian Front 8A", storyCount: 8 },
  { id: "IndianFront8B", name: "Indian Front 8B", storyCount: 8 },
  { id: "IndianCity5A", name: "Indian City 5A", storyCount: 5 },
  { id: "IndianCity6A", name: "Indian City 6A", storyCount: 6 },
  { id: "IndianSports5A", name: "Indian Sports 5A", storyCount: 5 },
  { id: "IndianFront9A", name: "Indian Front 9A", storyCount: 9 },
  { id: "IndianFront10A", name: "Indian Front 10A", storyCount: 10 },
  { id: "IndianColumn5A", name: "Indian Column 5A", storyCount: 5 },
  { id: "IndianBalance6A", name: "Indian Balance 6A", storyCount: 6 },
  { id: "ProfessionalNews10A", name: "Professional Newspaper Layout (Exact PDF Scan - 9 Stories)", storyCount: 9 },
];

const wizardLayoutPreviews = wizardLayoutDesigns.reduce(
  (map, layout) => {
    const preview = generateTemplateLayout({
      templateId: layout.id,
      pageWidth: 1000,
      contentX: 0,
      contentY: 0,
      contentWidth: 1000,
      contentHeight: 1000,
      // The template's own grid — six for every news layout, four for the
      // editorial page, whose slots are stated against a four-column sheet.
      columnCount: getTemplateColumnCount(layout.id, 6),
      gutter: 0,
    });

    map.set(layout.id, preview.slots.map((slot) => ({
      ...slot,
      left: `${(slot.x / 1000) * 100}%`,
      top: `${(slot.y / 1000) * 100}%`,
      width: `${(slot.width / 1000) * 100}%`,
      height: `${(slot.height / 1000) * 100}%`,
    })));

    return map;
  },
  new Map<TemplateId, Array<{
    storyNumber: number;
    left: string;
    top: string;
    width: string;
    height: string;
  }>>(),
);

const generationWizardSteps: GenerationWizardStep[] = ["count", "layout", "style", "category"];

type GenerationWizardStep = "count" | "layout" | "style" | "category" | "closed";

const pageLanguageOptions: Array<{ value: PageLanguageMode; label: string; description: string }> = [
  { value: "hindi", label: "Hindi", description: "Generate all article slots in Hindi." },
  { value: "english", label: "English", description: "Generate all article slots in English." },
  { value: "bilingual", label: "Bilingual", description: "Alternate English and Hindi articles." },
];

const isPageLanguageMode = (value: unknown): value is PageLanguageMode =>
  value === "hindi" || value === "english" || value === "bilingual";

const getSafeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "newspaper";

const downloadBytes = (bytes: Uint8Array | ArrayBuffer, filename: string, mimeType: string) => {
  const data = bytes instanceof Uint8Array
    ? bytes.slice().buffer
    : bytes.slice(0);
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
};

const getPortalReturnUrl = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const fallbackUrl = "http://localhost:3001/dashboard?generated=1";
  const rawReturnUrl = new URLSearchParams(window.location.search).get("returnUrl");

  if (!rawReturnUrl) {
    return fallbackUrl;
  }

  try {
    const returnUrl = new URL(rawReturnUrl, window.location.origin);
    // localhost:3001 covers local dev against the portal's own dev server;
    // pagemint1.gautamenterprises.org is the real production portal this
    // allowlist was silently missing -- returnUrl always points there, so
    // every return-to-portal navigation (the Home button, the post-PDF-export
    // redirect) fell through to the dead localhost fallback in production.
    const allowedHosts = new Set([
      "localhost:3001",
      "127.0.0.1:3001",
      "pagemint1.gautamenterprises.org",
    ]);

    if ((returnUrl.protocol === "http:" || returnUrl.protocol === "https:") && allowedHosts.has(returnUrl.host)) {
      return returnUrl.toString();
    }
  } catch {
    return fallbackUrl;
  }

  return fallbackUrl;
};

const redirectToPortalAfterPdfExport = () => {
  const returnUrl = getPortalReturnUrl();

  if (!returnUrl) {
    return;
  }

  // Not 800ms — confirmed live (CDP Browser.downloadProgress) that navigating
  // away this soon cancels the browser's own download of the just-created
  // blob before it finishes writing to disk: a real multi-image edition PDF
  // (~9MB) was still "inProgress" and got cancelled outright at 800ms. There
  // is no page-side signal for "the download finished" to wait on instead
  // (the <a download> blob trick doesn't expose one), so this is a generous
  // fixed delay rather than a precise one.
  window.setTimeout(() => {
    window.location.href = returnUrl;
  }, 4000);
};

// ─── Small inline icons for the publisher action rail ─────────────────────────
// Plain inline SVG rather than an icon library dependency -- five glyphs
// don't justify pulling one in, and this matches how the rest of this file
// already hand-draws its small UI icons.
const PublisherHomeIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path
      d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3.5v-5.5a1.5 1.5 0 0 1 1.5-1.5v0a1.5 1.5 0 0 1 1.5 1.5V20H17a1 1 0 0 0 1-1v-9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PublisherPreviewIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path
      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const PublisherDownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path
      d="M12 3v12m0 0 4.5-4.5M12 15 7.5 10.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PublisherRegenerateIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path
      d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M17 3v4h-4M7 21v-4h4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PublisherNextPageIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <path
      d="M6 4h8l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M13 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9.5 14.5h5m0 0-2-2m2 2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const getPortalLaunchParam = (name: string) => {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
};

const shouldChargeSinglePageOnExport = () => getPortalLaunchParam("chargeOnExport") === "single";

// ─── Portal batch mode: auto-fill every page, unattended ──────────────────────
// mode=batch is launched inside a hidden iframe by the portal dashboard's
// "generate all pages" button. It never shows the wizard UI — it drives the
// exact same store actions ("Load Preloaded News"/"Load Live" call these
// underneath) and the exact same renderDocumentPageToDataUrl/exportDocumentPdf
// the manual wizard/export flow already uses, one page at a time, reporting
// progress to the parent window via postMessage.

type BatchPlannedPage = { page_number: number; category: string; categories: string[]; section: string; header_type: string };
type PortalPagePlan = {
  page_number: number;
  section: string;
  header_type?: string;
  category?: string;
};

const parseBatchPlannedPages = (value: string): BatchPlannedPage[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        page_number: Number(item?.page_number),
        category: String(item?.category || "").trim(),
        categories: Array.isArray(item?.categories)
          ? item.categories.map((c: unknown) => String(c).trim()).filter(Boolean)
          : [],
        section: String(item?.section || "").trim(),
        header_type: String(item?.header_type || "").trim(),
      }))
      .filter((item) => Number.isFinite(item.page_number) && item.page_number > 0);
  } catch {
    return [];
  }
};

// The portal's Settings page now has an explicit "Editorial page" dropdown
// option (header_type === "editorial") -- the authoritative, language-
// independent signal a publisher sets once. The literal-text match stays as
// a fallback for older page plans saved before that option existed (or a
// publisher who just typed "Editorial" as the section name), but a page
// named in Hindi (e.g. "अभिव्यक्ति") or anything else relies on header_type.
const isEditorialPlannedSection = (section: string) => section.trim().toLowerCase() === "editorial";
const isEditorialPlannedPage = (planned: BatchPlannedPage | undefined) =>
  isEditorialPlannedSection(planned?.section ?? "") || planned?.header_type === "editorial";

const parsePortalPagePlan = (value: string): PortalPagePlan[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        page_number: Number(item?.page_number),
        section: String(item?.section || "").trim(),
        header_type: String(item?.header_type || "").trim(),
        category: String(item?.category || "").trim(),
      }))
      .filter((item) => Number.isFinite(item.page_number) && item.page_number > 0);
  } catch {
    return [];
  }
};

const getWizardTabForPortalPage = (page: PortalPagePlan): WizardTab => {
  const headerType = (page.header_type || "").toLowerCase();
  const section = (page.section || "").toLowerCase();

  if (page.page_number === 1) return "front";
  if (headerType === "advertisement") return "advertisement";
  if (headerType === "editorial" || section === "editorial" || /sampadak|संपाद/.test(section)) return "editorial";
  return "inside";
};

// FRONT_PAGE_TEMPLATE_IDS[1] ("CliffFront11A") is excluded from batch mode's
// automatic page-1 rotation on request -- left selectable from the manual
// wizard design picker, just never auto-chosen for an unattended batch run.
const BATCH_FRONT_PAGE_TEMPLATE_IDS = FRONT_PAGE_TEMPLATE_IDS.filter((_, index) => index !== 1);

/**
 * Maps a publisher's page-section label (e.g. "Sports", "Business",
 * "मनोरंजन") to the matching NEWSWIRE_CATEGORY, so a page the publisher
 * named "Sports" actually gets Sports news instead of falling through to
 * whatever the blanket default happens to be. Every real publisher profile
 * checked has `page_section_config[].category` set to an empty string —
 * the section label is the only signal actually available in practice — so
 * this is a best-effort keyword match, not an authoritative mapping.
 * Sections with no match (City, Classifieds, ...) return null and the
 * caller falls through to the existing "Madhya Pradesh" local-news
 * default, same as before this existed.
 */
const inferCategoryFromSection = (section: string): NewswireCategory | null => {
  const normalized = section.trim().toLowerCase();
  if (!normalized) return null;

  const keywordMap: Array<[RegExp, NewswireCategory]> = [
    [/sport|खेल/, "Sports"],
    [/business|commerce|market|trade|finance|व्यापार|वाणिज्य/, "Business"],
    [/entertainment|culture|cinema|film|bollywood|मनोरंजन/, "Entertainment"],
    [/international|world|foreign|विश्व|अंतरराष्ट्रीय/, "International"],
    [/health|medical|wellness|स्वास्थ्य/, "Health"],
    [/nation|national|राष्ट्रीय/, "National"],
  ];

  for (const [pattern, category] of keywordMap) {
    if (pattern.test(normalized)) {
      return category;
    }
  }
  return null;
};

const getPortalOrigin = () => {
  try {
    return new URL(window.document.referrer).origin;
  } catch {
    return "";
  }
};

/**
 * Same request handleLoadLive already makes, including its fallback-detection
 * guard — the newswire route answers 200 + success:true even when every
 * upstream backend failed, substituting built-in stories and flagging it only
 * via meta.baseUrl.
 */
const fetchLiveNewswireOnce = async (
  category: string,
  languageMode: PageLanguageMode,
  limit: number,
): Promise<NewswireStory[] | null> => {
  const response = await fetch(
    `/api/newswire?category=${encodeURIComponent(category)}&language=${languageMode}&limit=${limit}`,
  );
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: NewswireStory[];
    meta?: { baseUrl?: string };
  } | null;

  if (
    response.ok &&
    payload?.success !== false &&
    Array.isArray(payload?.data) &&
    payload.data.length > 0 &&
    payload.meta?.baseUrl !== "fallback"
  ) {
    return payload.data;
  }
  return null;
};

const normalizeHeadlineKey = (headline: string) => headline.trim().toLowerCase();

/**
 * Filters out articles already used elsewhere in this batch run so the same
 * wire story doesn't appear on two pages of one edition. Checks both id and
 * headline — the live upstream can file the same real-world story under
 * different ids for different category queries (syndicated/cross-posted
 * content), which an id-only check would miss.
 */
const isArticleUsed = (article: NewswireStory, usedIds: Set<string>, usedHeadlines: Set<string>) =>
  usedIds.has(article.id) || usedHeadlines.has(normalizeHeadlineKey(article.headline));

/**
 * When a page's own assigned category doesn't have enough fresh, unused live
 * articles to fill it — an expected outcome now that the newswire route
 * itself dedupes and restricts to the last 24h server-side (see
 * src/app/api/newswire/route.ts), on top of thin categories that only ever
 * carry a handful of live articles (Health/Entertainment can run to single
 * digits) — pulls the shortfall from the other categories' live wire instead
 * of conceding straight to the deterministic preloaded pool. Still all live
 * content by the time this returns, just not all filed under the one
 * category the page was nominally assigned; tried in NEWSWIRE_CATEGORIES
 * order, stopping as soon as `needed` is met.
 */
const fetchLiveArticlesFromOtherCategories = async (
  excludeCategory: string,
  languageMode: PageLanguageMode,
  needed: number,
  usedIds: Set<string>,
  usedHeadlines: Set<string>,
): Promise<NewswireStory[]> => {
  const collected: NewswireStory[] = [];

  for (const category of NEWSWIRE_CATEGORIES) {
    if (category === excludeCategory || collected.length >= needed) {
      continue;
    }

    const stillNeeded = needed - collected.length;
    try {
      const live = await fetchLiveNewswireOnce(category, languageMode, Math.ceil(stillNeeded * 1.5) + 2);
      if (!live) continue;
      for (const article of live) {
        if (collected.length >= needed) break;
        if (isArticleUsed(article, usedIds, usedHeadlines)) continue;
        if (collected.some((existing) => existing.id === article.id)) continue;
        collected.push(article);
      }
    } catch {
      // This category failed — move on to the next one rather than giving
      // up to preloaded content over a single category's network hiccup.
    }
  }

  return collected;
};

/** Raw shape of one row from GET /publisher/manual-box-content — see ManualBoxContentInput in the portal's saas_handlers.go. */
type ManualBoxContentRecord = {
  page_number?: number;
  slot_index?: number;
  headline?: string;
  subheadline?: string;
  place?: string;
  body?: string;
  image_url?: string;
  image_caption?: string;
  editor_portrait_url?: string;
  editor_name?: string;
};

/**
 * Fetches this page's manual box content once, raw — both
 * fetchManualArticlesForPage (news pages) and fetchManualEditorialEntriesForPage
 * (Editorial pages) build on this same call so there's exactly one place that
 * knows the endpoint shape. Missing portal identity (opened outside the
 * portal) or a fetch failure both resolve to "nothing seeded" rather than
 * blocking the page — manual content is a bonus, never a dependency.
 */
const fetchManualBoxContentForPage = async (pageNumber: number): Promise<ManualBoxContentRecord[]> => {
  const apiBase = getPortalLaunchParam("apiBase");
  const authToken = getPortalLaunchParam("authToken");
  const publisherId = getPortalLaunchParam("publisherId");
  if (!apiBase || !authToken || !publisherId) {
    return [];
  }

  try {
    const response = await fetch(
      `${apiBase}/publisher/manual-box-content/${publisherId}?page_number=${pageNumber}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const payload = (await response.json().catch(() => null)) as { boxes?: ManualBoxContentRecord[] } | null;
    if (!response.ok || !Array.isArray(payload?.boxes)) {
      return [];
    }
    // Raw, unfiltered — an editorial portrait+name entry legitimately has no
    // headline/body (see fetchManualEditorialEntriesForPage), so filtering
    // here would silently strip it before either consumer sees it. Each
    // consumer applies its own "is this row usable" rule.
    return payload.boxes;
  } catch {
    return [];
  }
};

/**
 * Manual news boxes the publisher supplied on the portal for this issue,
 * shaped as NewswireStory so they flow through the exact same classify →
 * layout → slot-pairing pipeline as wire content (importNewswireStories
 * can't tell the difference). `body` alone drives size classification
 * (classifyArticles falls through body → longBody → ... → headline) and
 * `imageUrl` alone drives image-slot routing, so the empty-string/[]
 * defaults on every other required field are safe — they're only ever
 * interpolated as display strings downstream, never branched on.
 */
const fetchManualArticlesForPage = async (pageNumber: number, category: string): Promise<NewswireStory[]> => {
  const boxes = (await fetchManualBoxContentForPage(pageNumber)).filter(
    (box) => box.headline?.trim() && box.body?.trim(),
  );

  return boxes.map((box, index) => ({
    id: `manual-${pageNumber}-${index}`,
    category,
    headline: box.headline!.trim(),
    subheadline: (box.subheadline || "").trim(),
    body: box.body!.trim(),
    summary: [],
    caption: (box.image_caption || "").trim(),
    imageUrl: box.image_url || "",
    imageCaption: (box.image_caption || "").trim(),
    place: (box.place || "").trim(),
    sourceTitle: "प्रकाशक",
    sourceUrl: "",
    publishedAt: null,
    manualPinned: true,
  }));
};

/**
 * Manual editorial content — same portal source as fetchManualArticlesForPage,
 * but built as EditorialSlotPanel.tsx's own manualEntryToStory does (portrait
 * + author name folded into editorPortraitUrl/bylineName/editorSummary),
 * since Editorial pages never go through the regular newswire shape. Boxes
 * with a filled editor_portrait_url/editor_name are the two signed
 * author-rail entries; any others are plain editorial-category manual
 * stories filling the rest of the page the same way news-page manual boxes
 * do.
 */
const fetchManualEditorialEntriesForPage = async (pageNumber: number): Promise<NewswireStory[]> => {
  // Portrait/name are enrichment on a real entry, not a substitute for one —
  // matches EditorialSlotPanel.tsx's own manualEntryToStory gate (hasCopy =
  // headline || body). A row with only a portrait has no localized copy for
  // getLocalizedArticleContent to select, which throws "Not enough Hindi
  // articles" during import — confirmed live, not just by inspection.
  const boxes = (await fetchManualBoxContentForPage(pageNumber)).filter(
    (box) => box.headline?.trim() && box.body?.trim(),
  );

  return boxes.map((box, index) => {
    const headline = box.headline!.trim();
    const body = box.body!.trim();
    const editorName = (box.editor_name || "").trim();
    const portrait = (box.editor_portrait_url || "").trim();
    const imageCaption = (box.image_caption || "").trim();
    // A box with only a portrait and no story photograph prints the portrait
    // as its image (the सम्पादकीय rail convention) — mirrors
    // EditorialSlotPanel.tsx's manualEntryToStory exactly.
    const primaryImage = box.image_url || portrait;
    const portraitIsPrimary = !box.image_url && Boolean(portrait);

    return {
      id: `manual-editorial-${pageNumber}-${index}`,
      category: "Editorial",
      headline,
      subheadline: (box.subheadline || "").trim(),
      body,
      shortBody: body,
      mediumBody: body,
      longBody: body,
      summary: [],
      caption: portraitIsPrimary ? editorName : imageCaption,
      imageUrl: primaryImage,
      imageCaption: portraitIsPrimary ? editorName : imageCaption,
      place: (box.place || "").trim(),
      sourceTitle: "प्रकाशक",
      sourceUrl: "",
      publishedAt: null,
      bylineName: editorName,
      editorPortraitUrl: portrait,
      editorSummary: body.split(/(?<=[।.!?])\s/)[0] ?? "",
      manualPinned: true,
      localized: {
        hindi: {
          language: "hindi",
          headline,
          kicker: "",
          subheadings: [],
          subheadline: (box.subheadline || "").trim(),
          body,
          shortBody: body,
          mediumBody: body,
          longBody: body,
          caption: portraitIsPrimary ? editorName : imageCaption,
          imageCaption: portraitIsPrimary ? editorName : imageCaption,
          place: (box.place || "").trim(),
          imageUrl: primaryImage,
          sourceUrl: "",
          category: "Editorial",
        },
      },
    } as NewswireStory;
  });
};

const EDITORIAL_TEMPLATE_ID: TemplateId = "CliffEditorial8A";

/**
 * Editorial pages (identified from the publisher's own page plan, not
 * guessed) get the same purpose-built pipeline EditorialSlotPanel.tsx uses
 * interactively — the desk's leader/comment copy and the day's राशिफल,
 * slotted by box width — rather than being treated as one more newswire
 * category. Mirrors EditorialSlotPanel.tsx's handleGenerate (~line 772-800)
 * exactly, minus the manual per-slot overrides that only make sense in the
 * interactive editor.
 */
const fetchEditorialStoriesForPage = async (excludeIds?: Set<string>): Promise<NewswireStory[]> => {
  const columnSpans = getTemplateColumnSpans(EDITORIAL_TEMPLATE_ID);
  try {
    const response = await fetch("/api/editorial?limit=50");
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      articles?: EditorialFeedRecord[];
      rashifal?: RashifalRecord[];
      health?: EditorialFeedRecord[];
    } | null;
    if (payload?.success && Array.isArray(payload.articles) && payload.articles.length > 0) {
      return buildEditorialStories({
        feed: { articles: payload.articles, rashifal: payload.rashifal ?? [], health: payload.health ?? [] },
        columnSpans,
        category: "Editorial",
        rashifalSlotIndex: getRashifalSlotIndex(EDITORIAL_TEMPLATE_ID),
        healthSlotIndex: getHealthSlotIndex(EDITORIAL_TEMPLATE_ID),
      });
    }
  } catch {
    // Live editorial failed; return no stock copy so the issue is visible.
  }
  return [];
};

// WIZARD_LAYOUT_DESIGNS is the wizard's own inside-page catalogue (one entry
// per template, tagged "basic" or "advanced") — deriving these two pools
// from it directly means the batch loop and the interactive wizard can never
// drift apart over which templates exist or how they're categorized.
const ADVANCED_INSIDE_TEMPLATE_IDS: TemplateId[] = WIZARD_LAYOUT_DESIGNS.filter(
  (design) => design.category === "advanced",
).map((design) => design.id);
const BASIC_INSIDE_TEMPLATE_IDS: TemplateId[] = WIZARD_LAYOUT_DESIGNS.filter(
  (design) => design.category === "basic",
).map((design) => design.id);

/**
 * One distinct layout per inside page, per edition — Advance Layouts
 * preferred, basic templates only once every advanced one is already used
 * this run, and reuse only as a last resort once both pools are exhausted
 * (a very large edition). `usedTemplateIds` is scoped to a single batch run.
 */
const pickInsideTemplateId = (usedTemplateIds: Set<TemplateId>): TemplateId => {
  const pickUnused = (pool: TemplateId[]): TemplateId | null => {
    const candidates = pool.filter((id) => !usedTemplateIds.has(id));
    return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  };
  return (
    pickUnused(ADVANCED_INSIDE_TEMPLATE_IDS) ??
    pickUnused(BASIC_INSIDE_TEMPLATE_IDS) ??
    ADVANCED_INSIDE_TEMPLATE_IDS[Math.floor(Math.random() * ADVANCED_INSIDE_TEMPLATE_IDS.length)]
  );
};

const chargeSinglePageAfterRender = async (pageNumberOverride?: number, pageNameOverride?: string) => {
  if (!shouldChargeSinglePageOnExport()) {
    return null;
  }

  const apiBase = getPortalLaunchParam("apiBase") || "http://localhost:8080/api/v1";
  const authToken = getPortalLaunchParam("authToken");
  const publisherId = getPortalLaunchParam("publisherId");
  const selectedPageNumber = pageNumberOverride || Number(getPortalLaunchParam("selectedPageNumber")) || 1;
  const selectedPageName = pageNameOverride || getPortalLaunchParam("selectedPageName") || `Page ${selectedPageNumber}`;
  const issueNumber = getPortalLaunchParam("issueNumber") || `Ank ${new Date().toISOString().slice(0, 10)}`;
  const publicationDate = getPortalLaunchParam("publicationDate") || new Date().toISOString().slice(0, 10);

  if (!publisherId || !authToken) {
    throw new Error("Publisher session missing. Please open the page again from publisher dashboard.");
  }

  const response = await fetch(`${apiBase}/publisher/generator/execute`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      publisher_id: publisherId,
      page_count: 1,
      issue_number_ank: `${issueNumber} - Page ${selectedPageNumber} - ${selectedPageName}`,
      publication_date: publicationDate,
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || "Wallet charge failed. Please try again.");
  }

  return data;
};

const dataUrlToArrayBuffer = async (dataUrl: string) => {
  const response = await fetch(dataUrl);

  return response.arrayBuffer();
};

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

const loadImageElement = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image ${source}`));
    image.src = source;
  });

const readImageFileAsAssetDescriptor = (file: File): Promise<AssetImportDescriptor> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image file."));
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const probe = new window.Image();

      probe.onload = () => {
        resolve({
          name: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          originalFilename: file.name,
          size: file.size,
          width: probe.naturalWidth,
          height: probe.naturalHeight,
          format: file.name.split(".").pop()?.toLowerCase(),
          source,
          thumbnailUrl: source,
          previewUrl: source,
          modifiedAt: new Date(file.lastModified).toISOString(),
          linkMode: "embedded",
        });
      };
      probe.onerror = () => {
        resolve({
          name: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          originalFilename: file.name,
          size: file.size,
          format: file.name.split(".").pop()?.toLowerCase(),
          source,
          thumbnailUrl: source,
          previewUrl: source,
          modifiedAt: new Date(file.lastModified).toISOString(),
          linkMode: "embedded",
        });
      };
      probe.src = source;
    };
    reader.readAsDataURL(file);
  });

const selectableObjectOrder: EditorObjectType[] = [
  "headline",
  "subheadline",
  "byline",
  "image",
  "caption",
  "credit",
  "source",
  "body",
  "kicker",
  "strap",
  "factBox",
  "factBoxHeading",
  "factBoxContent",
  "pullQuote",
];

const objectFrameStyleKeys: Partial<Record<EditorObjectType, keyof ArticleData["containerStyles"]>> = {
  headline: "headline",
  subheadline: "subheadline",
  caption: "caption",
  credit: "credit",
  source: "source",
  kicker: "kicker",
  strap: "strap",
  factBoxHeading: "factBoxHeading",
  factBoxContent: "factBoxContent",
  factBox: "factBoxContent",
  pullQuote: "pullQuote",
};

const objectTypeLabels: Partial<Record<EditorObjectType, string>> = {
  headline: "Headline",
  subheadline: "Subheadline",
  byline: "Byline",
  location: "Location",
  body: "Body",
  image: "Image",
  caption: "Caption",
  credit: "Image Credit",
  source: "Source",
  kicker: "Kicker",
  strap: "Strap",
  factBox: "Fact Box",
  factBoxHeading: "Fact Box Heading",
  factBoxContent: "Fact Box Content",
  pullQuote: "Pull Quote",
  pageHeader: "Page Header",
  pageFooter: "Page Footer",
  pageNumber: "Page Number",
  advertisement: "Advertisement",
};

type InlineEditSession = {
  storyId: string;
  objectType: EditorObjectType;
  bounds: EditorSelectionBounds;
  value: string;
  originalValue: string;
  textStyle: ArticleTextStyle | null;
};

type PagePreviewState =
  | { status: "loading" }
  | { status: "ready"; dataUrl: string; pageWidth: number; pageHeight: number }
  | { status: "error"; message: string };

type CopiedObjectStyle = {
  richTextStyle: RichTextStyle;
  frameStyle: ObjectContainerStyle | null;
  alignment: EditorialTextAlignment | null;
};

type RulerUnit = "in" | "mm" | "px";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const getInitialViewport = (): Viewport => {
  if (typeof window !== "undefined") {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  return {
    width: 1200,
    height: 900,
  };
};

const initialViewport: Viewport = getInitialViewport();

const emptyKonvaNodeProfile: KonvaNodeProfile = {
  stageCount: 0,
  layerCount: 0,
  fastLayerCount: 0,
  groupCount: 0,
  textNodeCount: 0,
  rectCount: 0,
  imageNodeCount: 0,
  lineCount: 0,
  guideCount: 0,
  transformerCount: 0,
  selectionNodeCount: 0,
  totalNodes: 0,
  visibleNodes: 0,
  hiddenNodes: 0,
  destroyedNodes: 0,
  createdNodes: 0,
};

const buildSequence = (limit: number, step: number) => {
  const values: number[] = [];

  for (let value = 0; value <= limit; value += step) {
    values.push(value);
  }

  return values;
};

const getWorkspaceRect = (viewport: Viewport, _hasInspector: boolean) => {
  const left = viewport.width * PUBLISHER_LEFT_RATIO + PUBLISHER_COLUMN_PADDING;
  const right = viewport.width * PUBLISHER_RIGHT_RATIO + PUBLISHER_COLUMN_PADDING;
  const top = PUBLISHER_COLUMN_PADDING;
  const bottom = PUBLISHER_COLUMN_PADDING;

  return {
    left,
    top,
    width: Math.max(1, viewport.width * PUBLISHER_CENTER_RATIO - PUBLISHER_COLUMN_PADDING * 2),
    height: Math.max(1, viewport.height - top - bottom),
  };
};

const getPageOrigin = (
  viewport: Viewport,
  zoom: number,
  hasInspector: boolean,
  pagePanOffset: { x: number; y: number },
) => {
  const scaledPageWidth = NEWSPAPER_PAGE.width * zoom;
  const workspace = getWorkspaceRect(viewport, hasInspector);
  const centeredX = workspace.left + (workspace.width - scaledPageWidth) / 2;
  const topY = workspace.top + RULER_SIZE;

  return {
    x: centeredX + pagePanOffset.x,
    y: Math.max(workspace.top + RULER_SIZE, topY) + pagePanOffset.y,
  };
};

const clampPublisherPanOffset = (
  current: { x: number; y: number },
  viewport: Viewport,
  zoom: number,
  hasInspector: boolean,
) => {
  const workspace = getWorkspaceRect(viewport, hasInspector);
  const baseOrigin = getPageOrigin(viewport, zoom, hasInspector, { x: 0, y: 0 });
  const scaledPageWidth = NEWSPAPER_PAGE.width * zoom;
  const scaledPageHeight = NEWSPAPER_PAGE.height * zoom;
  const minVisible = 96;
  const minX = workspace.left + minVisible - (baseOrigin.x + scaledPageWidth);
  const maxX = workspace.left + workspace.width - minVisible - baseOrigin.x;
  const minY = workspace.top + minVisible - (baseOrigin.y + scaledPageHeight);
  const maxY = workspace.top + workspace.height - minVisible - baseOrigin.y;

  return {
    x: Math.min(Math.max(current.x, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(current.y, Math.min(minY, maxY)), Math.max(minY, maxY)),
  };
};

const formatMeasurement = (points: number, unit: RulerUnit) => {
  if (unit === "mm") {
    return `${Math.round((points / POINTS_PER_INCH) * 25.4)}mm`;
  }

  if (unit === "px") {
    return `${Math.round(points)}px`;
  }

  return `${Number((points / POINTS_PER_INCH).toFixed(2))}in`;
};
const toPoints = (inches: number) => inches * POINTS_PER_INCH;

const rangesTouch = (firstEnd: number, secondStart: number) => Math.abs(firstEnd - secondStart) < 1;
const SEPARATOR_RULE_PADDING = 5;

// Horizontal row-divider rules were removed entirely (repeated feedback: they
// stuck to the box below, or vanished next to bordered boxes, across several
// attempts at fixing the underlying tolerance/positioning issues) — the user
// asked for the line gone rather than continuing to retune it. Only the
// vertical rules between side-by-side articles in the same row remain.
// A box narrower than this fraction of the page's content width counts as
// "1 column" for the stacked-divider rule below — matches the same 0.22
// threshold composeArticleBox.ts uses to decide a box is single-column.
const NARROW_COLUMN_WIDTH_RATIO = 0.22;

const getEditorialSeparatorLines = (
  storyLayouts: { story: { x: number; y: number; width: number; height: number }; layout: ArticleLayout }[],
  pageContentWidth: number,
) => {
  const stories = storyLayouts.map(({ story }) => story);
  const vertical: { points: number[] }[] = [];

  // Group into rows (same y/height), then draw a separator only between
  // ADJACENT boxes within a row. Comparing every pair regardless of
  // adjacency (the old approach) meant a 3+-box row's non-adjacent pair
  // (e.g. the leftmost and rightmost of three) still got a "separator" —
  // its midpoint calculation spanned clean across the middle box and landed
  // the line INSIDE it, reading as a stray vertical division line inside a
  // single article box instead of between two actual neighbours.
  const rows: { x: number; y: number; width: number; height: number }[][] = [];
  for (const story of stories) {
    const row = rows.find(
      (candidate) =>
        candidate.length > 0 &&
        Math.abs(candidate[0].y - story.y) < 1 &&
        Math.abs(candidate[0].height - story.height) < 1,
    );
    if (row) {
      row.push(story);
    } else {
      rows.push([story]);
    }
  }

  for (const row of rows) {
    const sortedRow = [...row].sort((a, b) => a.x - b.x);

    for (let index = 0; index < sortedRow.length - 1; index += 1) {
      const first = sortedRow[index];
      const second = sortedRow[index + 1];

      if (rangesTouch(first.x + first.width, second.x)) {
        vertical.push({
          points: [
            first.x + first.width,
            first.y + SEPARATOR_RULE_PADDING,
            first.x + first.width,
            first.y + first.height - SEPARATOR_RULE_PADDING,
          ],
        });
      } else {
        const separatorX = first.x + first.width + (second.x - first.x - first.width) / 2;
        vertical.push({
          points: [separatorX, first.y + SEPARATOR_RULE_PADDING, separatorX, first.y + first.height - SEPARATOR_RULE_PADDING],
        });
      }
    }
  }

  // A short, centred (70% width) rule between two 1-column boxes stacked
  // directly on top of each other in the same column lane — and ONLY that
  // case. Grouping by exact x/width match (rounded) naturally excludes a
  // 1-column box sitting above/below a wider (2-6 col) box, since they never
  // share a lane: no explicit priority/columnSpan check needed, the
  // geometry itself enforces "only between two 1-column boxes."
  const narrowDividers: { points: number[] }[] = [];
  const isNarrowColumnStory = (story: { width: number }) =>
    pageContentWidth > 0 && story.width / pageContentWidth < NARROW_COLUMN_WIDTH_RATIO;
  const lanes = new Map<string, { x: number; y: number; width: number; height: number }[]>();

  for (const story of stories) {
    if (!isNarrowColumnStory(story)) {
      continue;
    }

    const laneKey = `${Math.round(story.x)}-${Math.round(story.width)}`;
    const lane = lanes.get(laneKey) ?? [];
    lane.push(story);
    lanes.set(laneKey, lane);
  }

  for (const lane of lanes.values()) {
    const stacked = [...lane].sort((a, b) => a.y - b.y);

    for (let index = 0; index < stacked.length - 1; index += 1) {
      const upper = stacked[index];
      const lower = stacked[index + 1];
      const gapTop = upper.y + upper.height;
      const gapBottom = lower.y;

      if (gapBottom <= gapTop) {
        continue;
      }

      const lineY = gapTop + (gapBottom - gapTop) / 2;
      const dividerWidth = upper.width * 0.7;
      const dividerX = upper.x + (upper.width - dividerWidth) / 2;
      narrowDividers.push({ points: [dividerX, lineY, dividerX + dividerWidth, lineY] });
    }
  }

  return [...vertical, ...narrowDividers];
};

/**
 * Edges of stories that draw their own outline (tinted boxes, narrow-column
 * badge boxes). Their border already divides them from their neighbours, so a
 * page separator rule running along the same edge shows up as a second,
 * doubled line — these edges are used to suppress those rules.
 */
const getBorderedStoryEdges = (
  storyLayouts: { story: { x: number; y: number; width: number; height: number }; layout: ArticleLayout }[],
) =>
  storyLayouts
    .filter(({ layout }) => (layout.containerStyles?.article?.containerBorderWidth ?? 0) > 0)
    .map(({ story }) => ({
      left: story.x,
      right: story.x + story.width,
      // Box outlines now always draw at the story's true top/bottom edge —
      // see the boxTop/boxHeight fix in the draw loop below.
      top: story.y,
      bottom: story.y + story.height,
    }));

// Generous enough to catch a rule drawn at the midpoint of a column gutter
// (~4.3pt from either box edge) as well as one drawn exactly on a shared edge.
// Only valid for the vertical/gutter case below — row gaps are a separate,
// much tighter tolerance (see SEPARATOR_ROW_BORDER_TOLERANCE).
const SEPARATOR_BORDER_TOLERANCE = 6;

// Row gaps between stacked boxes are a real, deliberate design gap (min
// 3-8pt, see RowGapEngine) — not a coincidental overlap with the box below's
// own top border. Using the 6pt gutter tolerance here treated every row gap
// as "the same line" as the box's border and suppressed the divider rule
// entirely. Now that the rule is centred in the gap (see getEditorialSeparatorLines),
// true coincidence with a border only happens at a near-zero gap, so this
// only needs to catch rounding error, not real design gaps.
const SEPARATOR_ROW_BORDER_TOLERANCE = 1;

const isSeparatorOnBorderedEdge = (
  points: number[],
  edges: ReturnType<typeof getBorderedStoryEdges>,
) => {
  const [x1, y1, x2, y2] = points;
  const isVertical = Math.abs(x1 - x2) < 0.5;

  return edges.some((edge) => {
    if (isVertical) {
      const runsAlongSide =
        Math.abs(x1 - edge.left) <= SEPARATOR_BORDER_TOLERANCE ||
        Math.abs(x1 - edge.right) <= SEPARATOR_BORDER_TOLERANCE;
      const overlapsVertically = Math.min(y1, y2) < edge.bottom && Math.max(y1, y2) > edge.top;
      return runsAlongSide && overlapsVertically;
    }

    const runsAlongEnd =
      Math.abs(y1 - edge.top) <= SEPARATOR_ROW_BORDER_TOLERANCE ||
      Math.abs(y1 - edge.bottom) <= SEPARATOR_ROW_BORDER_TOLERANCE;
    const overlapsHorizontally = Math.min(x1, x2) < edge.right && Math.max(x1, x2) > edge.left;
    return runsAlongEnd && overlapsHorizontally;
  });
};

/**
 * A horizontal row rule commonly spans several boxes in the same row. Only
 * one of them being bordered (e.g. the page's single badge box) used to drop
 * the whole rule via isSeparatorOnBorderedEdge, wiping out the divider above
 * every other box in that row too. This clips out just the x-range directly
 * over a bordered box's edge and keeps the rest of the rule; vertical rules
 * stay all-or-nothing since they only ever run the height of one row.
 */
const clipEditorialSeparators = (
  separators: { points: number[] }[],
  edges: ReturnType<typeof getBorderedStoryEdges>,
) =>
  separators.flatMap((separator) => {
    const [x1, y1, x2] = separator.points;
    const isVertical = Math.abs(x1 - x2) < 0.5;

    if (isVertical) {
      return isSeparatorOnBorderedEdge(separator.points, edges) ? [] : [separator];
    }

    const blockingRanges = edges
      .filter(
        (edge) =>
          Math.abs(y1 - edge.top) <= SEPARATOR_ROW_BORDER_TOLERANCE ||
          Math.abs(y1 - edge.bottom) <= SEPARATOR_ROW_BORDER_TOLERANCE,
      )
      .map((edge) => ({ start: Math.max(x1, edge.left), end: Math.min(x2, edge.right) }))
      .filter((range) => range.end > range.start)
      .sort((first, second) => first.start - second.start);

    const clipped: { points: number[] }[] = [];
    let cursor = x1;

    for (const range of blockingRanges) {
      if (range.start - cursor >= 36) {
        clipped.push({ points: [cursor, y1, range.start, y1] });
      }
      cursor = Math.max(cursor, range.end);
    }

    if (x2 - cursor >= 36) {
      clipped.push({ points: [cursor, y1, x2, y1] });
    }

    return clipped;
  });

const removeSeparatorsNearYouthUpdateBlueRules = (
  separators: { points: number[] }[],
  blueRules: { x: number; y: number; height: number }[],
) => {
  const tolerance = 4;
  return separators.filter((separator) => {
    const [x1, y1, x2, y2] = separator.points;
    const isVertical = Math.abs(x1 - x2) < 0.5;
    if (!isVertical) return true;

    return !blueRules.some((rule) => {
      const closeX = Math.abs(x1 - rule.x) <= tolerance;
      const overlapsY = Math.max(y1, rule.y) <= Math.min(y2, rule.y + rule.height);
      return closeX && overlapsY;
    });
  });
};

const removeYouthUpdateHatchTicksNearKickers = (
  ticks: { x: number; y1: number; y2: number }[],
  storyLayouts: { story: { x: number; y: number }; layout: ArticleLayout }[],
  protectedBounds: { x: number; y: number; width: number; height: number }[] = [],
) => {
  const horizontalPadding = 7;
  const verticalPadding = 3;
  const skipBounds = [
    ...protectedBounds.map((bounds) => ({
      x1: bounds.x - horizontalPadding,
      x2: bounds.x + bounds.width + horizontalPadding,
      y1: bounds.y - verticalPadding,
      y2: bounds.y + bounds.height + verticalPadding,
    })),
    ...storyLayouts.flatMap(({ story, layout }) => {
      if (!layout.kicker) return [];
      // A badge kicker paints a filled box around its text, so its painted
      // edges sit outside the text bounds measured here by its own padding.
      // A flat 3pt allowance was narrower than that box on larger kickers and
      // the hatch ticks printed across the badge. Scaling the vertical
      // allowance with the kicker's own height covers the badge at every tier
      // while leaving small plain kickers effectively where they were.
      // A full kicker-height of clearance above and below, not half. The badge
      // box is drawn larger than the text measured here, and a tick is itself
      // ~4pt tall, so a half-height allowance still left ticks touching the
      // badge's painted edge on the larger kickers. These ticks are decorative
      // band separators -- dropping a few extra either side of a badge costs
      // nothing visually, while one printing across it is immediately obvious.
      const kickerVerticalPadding = Math.max(verticalPadding, layout.kicker.height);
      return [
        {
          x1: story.x + layout.kicker.x - horizontalPadding,
          x2: story.x + layout.kicker.x + layout.kicker.width + horizontalPadding,
          y1: story.y + layout.kicker.y - kickerVerticalPadding,
          y2: story.y + layout.kicker.y + layout.kicker.height + kickerVerticalPadding,
        },
      ];
    }),
  ];

  if (skipBounds.length === 0) return ticks;

  return ticks.filter(
    (tick) =>
      !skipBounds.some(
        (bounds) =>
          tick.x >= bounds.x1 &&
          tick.x <= bounds.x2 &&
          Math.max(tick.y1, bounds.y1) <= Math.min(tick.y2, bounds.y2),
      ),
  );
};

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const contentLayerRef = useRef<Konva.Layer | null>(null);
  const compositionCacheRef = useRef<StoryCompositionCache>(new Map());
  const profilerRef = useRef(createPerformanceProfiler());
  const renderHashCacheRef = useRef(new Map<string, { hash: string; version: number }>());
  const layoutNodeCountsRef = useRef(new Map<string, number>());
  const previousKonvaNodeCountRef = useRef(0);
  const renderStartRef = useRef(0);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [renderDiagnostics, setRenderDiagnostics] = useState({
    renderTimeMs: 0,
    fps: 0,
    konvaNodes: emptyKonvaNodeProfile,
  });
  const [inlineEditSession, setInlineEditSession] = useState<InlineEditSession | null>(null);
  const [copiedObjectStyle, setCopiedObjectStyle] = useState<CopiedObjectStyle | null>(null);
  const [frameContextMenu, setFrameContextMenu] = useState<{ storyId: string; x: number; y: number } | null>(null);
  const [imageReplacePopup, setImageReplacePopup] = useState<{ storyId: string; target: "photo" | "portrait" | "masthead-teaser" | "inside-teaser" | "akhand-front-teaser"; x: number; y: number } | null>(null);
  const imageReplaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pagePreview, setPagePreview] = useState<PagePreviewState | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [nextPagePickerOpen, setNextPagePickerOpen] = useState(false);
  const [wizardPreferredTab, setWizardPreferredTab] = useState<WizardTab | undefined>(undefined);
  const [fontManager, setFontManager] = useState<FontManagerState>(() => createInitialFontManagerState());
  const [workspaceState, setWorkspaceState] = usePersistentWorkspaceState();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [workspaceHistory, setWorkspaceHistory] = useState<string[]>([]);
  const [pagePanOffset, setPagePanOffset] = useState({ x: 0, y: 0 });
  const [isCtrlPanning, setIsCtrlPanning] = useState(false);
  const [rulerUnit, setRulerUnit] = useState<RulerUnit>("in");
  const [customGuides, setCustomGuides] = useState<EditorGuide[]>([]);
  const [guidesHidden, setGuidesHidden] = useState(false);
  const [guidesLocked, setGuidesLocked] = useState(false);
  const [baselineVisible, setBaselineVisible] = useState(false);
  const [baselineSpacing, setBaselineSpacing] = useState(12);
  const [baselineColor, setBaselineColor] = useState("#8f67d3");
  const [baselineSnap, setBaselineSnap] = useState(true);
  const [pageSetupDraft, setPageSetupDraft] = useState({
    marginTop: pageMaster.contentY,
    marginLeft: pageMaster.contentX,
    marginRight: pageMaster.width - pageMaster.contentX - pageMaster.contentWidth,
    marginBottom: pageMaster.height - pageMaster.contentY - pageMaster.contentHeight,
    columns: pageMaster.columns,
    gutter: pageMaster.gutter,
  });
  // PERFORMANCE: All 14 wizard state hooks moved into GenerationWizardModal
  // via a single useReducer. EditorCanvas only tracks one boolean here,
  // eliminating full canvas re-renders during every wizard interaction.
  const [wizardOpen, setWizardOpen] = useState(false);
  const portalSinglePageWizardAutoOpenedRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const stories = useEditorStore((state) => state.stories);
  const document = useEditorStore((state) => state.document);
  const activePageId = useEditorStore((state) => state.activePageId);
  const canvasMode = useEditorStore((state) => state.canvasMode);
  const selectedFrameId = useEditorStore((state) => state.selectedFrameId);
  const selectedFrameIds = useEditorStore((state) => state.selectedFrameIds);
  const selectedStoryId = useEditorStore((state) => state.selectedStoryId);
  const selectedStoryIds = useMemo(
    () =>
      selectedFrameIds
        .map((frameId) => document.frames[frameId]?.storyId)
        .filter((storyId): storyId is string => Boolean(storyId)),
    [document.frames, selectedFrameIds],
  );
  const selectedObjectType = useEditorStore((state) => state.selectedObjectType);
  const selectedObjects = useEditorStore((state) => state.selectedObjects);
  const selectedRichTextRange = useEditorStore((state) => state.selectedRichTextRange);
  const selectedParagraphIndex = useEditorStore((state) => state.selectedParagraphIndex);
  const typographyEditingScope = useEditorStore((state) => state.typographyEditingScope);
  const editingMode = useEditorStore((state) => state.editingMode);
  const selectionBounds = useEditorStore((state) => state.selectionBounds);
  const placementWarning = useEditorStore((state) => state.placementWarning);
  const pageType = useEditorStore((state) => state.pageType);
  const applyHeaderSetDraft = useEditorStore((state) => state.applyHeaderSetDraft);
  const saveActiveHeaderSetAs = useEditorStore((state) => state.saveActiveHeaderSetAs);
  const duplicateActiveHeaderSetAction = useEditorStore((state) => state.duplicateActiveHeaderSet);
  const renameActiveHeaderSet = useEditorStore((state) => state.renameActiveHeaderSet);
  const deleteActiveHeaderSet = useEditorStore((state) => state.deleteActiveHeaderSet);
  const activateHeaderSetAction = useEditorStore((state) => state.activateHeaderSet);
  const setActiveHeaderSetAsDefault = useEditorStore((state) => state.setActiveHeaderSetAsDefault);
  const exportActiveHeaderSet = useEditorStore((state) => state.exportActiveHeaderSet);
  const importHeaderSet = useEditorStore((state) => state.importHeaderSet);
  const importHeaderLogoAsset = useEditorStore((state) => state.importHeaderLogoAsset);
  const setActiveHeaderLocked = useEditorStore((state) => state.setActiveHeaderLocked);
  const setActiveHeaderHidden = useEditorStore((state) => state.setActiveHeaderHidden);
  const resetActiveHeaderLayouts = useEditorStore((state) => state.resetActiveHeaderLayouts);
  const setActiveHeaderSectionOverride = useEditorStore((state) => state.setActiveHeaderSectionOverride);
  const removeActiveHeaderSectionOverride = useEditorStore((state) => state.removeActiveHeaderSectionOverride);
  const overrideActivePageHeader = useEditorStore((state) => state.overrideActivePageHeader);
  const returnActivePageToMasterHeader = useEditorStore((state) => state.returnActivePageToMasterHeader);
  const undoHeaderOperation = useEditorStore((state) => state.undoHeaderOperation);
  const redoHeaderOperation = useEditorStore((state) => state.redoHeaderOperation);
  const productionView = useEditorStore((state) => state.productionView);
  const performanceProfilerEnabled = useEditorStore((state) => state.performanceProfilerEnabled);
  const zoom = useEditorStore((state) => state.zoom);
  const smartLayoutEnabled = useEditorStore((state) => state.smartLayout.enabled);
  const liveResizePreviewDrawCommands = useEditorStore((state) => state.liveResizePreviewDrawCommands);
  const createStory = useEditorStore((state) => state.createStory);
  const generateStoryLayout = useEditorStore((state) => state.generateStoryLayout);
  const importNewswireStories = useEditorStore((state) => state.importNewswireStories);
  const replaceStoryArticleFromNewswire = useEditorStore((state) => state.replaceStoryArticleFromNewswire);
  const clearPlacementWarning = useEditorStore((state) => state.clearPlacementWarning);
  const selectStory = useEditorStore((state) => state.selectStory);
  const selectAllStories = useEditorStore((state) => state.selectAllStories);
  const selectObject = useEditorStore((state) => state.selectObject);
  const setSelectedObjectType = useEditorStore((state) => state.setSelectedObjectType);
  const setSelectedRichTextRange = useEditorStore((state) => state.setSelectedRichTextRange);
  const setSelectedParagraphIndex = useEditorStore((state) => state.setSelectedParagraphIndex);
  const setTypographyEditingScope = useEditorStore((state) => state.setTypographyEditingScope);
  const setEditingMode = useEditorStore((state) => state.setEditingMode);
  const setCaretPosition = useEditorStore((state) => state.setCaretPosition);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const alignSelectedStories = useEditorStore((state) => state.alignSelectedStories);
  const distributeSelectedStories = useEditorStore((state) => state.distributeSelectedStories);
  const deleteSelectedStories = useEditorStore((state) => state.deleteSelectedStories);
  const moveSelectedStories = useEditorStore((state) => state.moveSelectedStories);
  const undoMultiSelectionOperation = useEditorStore((state) => state.undoMultiSelectionOperation);
  const redoMultiSelectionOperation = useEditorStore((state) => state.redoMultiSelectionOperation);
  const updateSelectedStoryArticleData = useEditorStore(
    (state) => state.updateSelectedStoryArticleData,
  );
  const updateSelectedStoryCompositionSettings = useEditorStore(
    (state) => state.updateSelectedStoryCompositionSettings,
  );
  const updateSelectedStoryImageSettings = useEditorStore(
    (state) => state.updateSelectedStoryImageSettings,
  );
  const updateSelectedStoryTypographySettings = useEditorStore(
    (state) => state.updateSelectedStoryTypographySettings,
  );
  const resetSelectedStoryTypographyToPriorityDefaults = useEditorStore(
    (state) => state.resetSelectedStoryTypographyToPriorityDefaults,
  );
  const updateSelectedStoryPriority = useEditorStore(
    (state) => state.updateSelectedStoryPriority,
  );
  const renameStory = useEditorStore((state) => state.renameStory);
  const duplicateStory = useEditorStore((state) => state.duplicateStory);
  const deleteStory = useEditorStore((state) => state.deleteStory);
  const confirmSmartDelete = useEditorStore((state) => state.confirmSmartDelete);
  const cancelSmartDelete = useEditorStore((state) => state.cancelSmartDelete);
  const reorderStory = useEditorStore((state) => state.reorderStory);
  const setStoryLocked = useEditorStore((state) => state.setStoryLocked);
  const setStoryHidden = useEditorStore((state) => state.setStoryHidden);
  const updateStoryPriority = useEditorStore((state) => state.updateStoryPriority);
  const updateSelectedStoryColumnSpan = useEditorStore(
    (state) => state.updateSelectedStoryColumnSpan,
  );
  const setPageType = useEditorStore((state) => state.setPageType);
  const toggleProductionView = useEditorStore((state) => state.toggleProductionView);
  const togglePerformanceProfiler = useEditorStore((state) => state.togglePerformanceProfiler);
  const moveStory = useEditorStore((state) => state.moveStory);
  const beginLiveMove = useEditorStore((state) => state.beginLiveMove);
  const updateLiveMove = useEditorStore((state) => state.updateLiveMove);
  const endLiveMove = useEditorStore((state) => state.endLiveMove);
  const cancelLiveMove = useEditorStore((state) => state.cancelLiveMove);
  const resizeStory = useEditorStore((state) => state.resizeStory);
  const beginLiveResize = useEditorStore((state) => state.beginLiveResize);
  const updateLiveResize = useEditorStore((state) => state.updateLiveResize);
  const endLiveResize = useEditorStore((state) => state.endLiveResize);
  const cancelLiveResize = useEditorStore((state) => state.cancelLiveResize);
  const setZoom = useEditorStore((state) => state.setZoom);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const selectFrame = useEditorStore((state) => state.selectFrame);
  const renameFrame = useEditorStore((state) => state.renameFrame);
  const setFrameLocked = useEditorStore((state) => state.setFrameLocked);
  const setFrameHidden = useEditorStore((state) => state.setFrameHidden);
  const reorderFrameLayer = useEditorStore((state) => state.reorderFrameLayer);
  const moveFrameBefore = useEditorStore((state) => state.moveFrameBefore);
  const duplicateSelectedFrame = useEditorStore((state) => state.duplicateSelectedFrame);
  const deleteSelectedFrame = useEditorStore((state) => state.deleteSelectedFrame);
  const groupSelectedFrames = useEditorStore((state) => state.groupSelectedFrames);
  const ungroupSelectedFrames = useEditorStore((state) => state.ungroupSelectedFrames);
  const soloFrame = useEditorStore((state) => state.soloFrame);
  const setActivePage = useEditorStore((state) => state.setActivePage);
  const addEditionPage = useEditorStore((state) => state.addEditionPage);
  const duplicateActivePage = useEditorStore((state) => state.duplicateActivePage);
  const deleteActivePage = useEditorStore((state) => state.deleteActivePage);
  const moveActivePage = useEditorStore((state) => state.moveActivePage);
  const updateActivePageProperties = useEditorStore((state) => state.updateActivePageProperties);
  const createMasterPage = useEditorStore((state) => state.createMasterPage);
  const duplicateMasterPage = useEditorStore((state) => state.duplicateMasterPage);
  const renameMasterPage = useEditorStore((state) => state.renameMasterPage);
  const deleteMasterPage = useEditorStore((state) => state.deleteMasterPage);
  const applyMasterToActivePage = useEditorStore((state) => state.applyMasterToActivePage);
  const detachActivePageMaster = useEditorStore((state) => state.detachActivePageMaster);
  const overrideActivePageMasterElement = useEditorStore((state) => state.overrideActivePageMasterElement);
  const importAssets = useEditorStore((state) => state.importAssets);
  // The inside folio's category field (see inside-header-live.svg /
  // HeaderResolver's {{section}} token) reads page.sectionName, which
  // importNewswireStories itself never touches — only the wizard/quick-panel
  // caller here knows which category was actually chosen. Wrapping it here
  // (used by both the "AI News" dock panel and the full generation wizard)
  // keeps that page.sectionName always current with whatever content the
  // page was last generated with, front pages excepted (their masthead has
  // no category field to show).
  const handleImportNewswireStoriesWithSection = useCallback(
    (category: string, articles: NewswireStory[], options: NewswireImportOptions) => {
      const resolvedOptions: NewswireImportOptions = options?.pageKind === "editorial"
        ? {
            ...options,
            editorialAuthorDefaults: usePublisherEditorialAuthorStore.getState().defaults,
            editorialAuthorSelections: usePublisherEditorialAuthorStore.getState().selectedAuthors,
          }
        : options;

      importNewswireStories(category, articles, resolvedOptions);
      void saveIssueUsedArticles(readPortalIssueArticleSession(), articles);

      // A portal-configured page (the publisher's own Settings page plan)
      // already carries its deliberate name -- e.g. "राष्ट्रीय समाचार" --
      // set the moment the page was opened (see openWizardForPortalPage).
      // Overwriting it here with the fetched category label was clobbering
      // that real name with the raw category value instead -- worse, the
      // wizard's own manual-picker state ("category" passed in here isn't
      // always this page's actual planned category; see getInsideImportCategory
      // in GenerationWizardModal.tsx), so a page like "राष्ट्रीय समाचार"
      // could end up relabeled with a completely unrelated category's name.
      // Only a page with no portal plan at all (the manual/non-portal
      // editor flow, which starts genuinely unnamed) still wants this
      // auto-naming.
      const currentPageNumber = useEditorStore.getState().document.pages.find(
        (page) => page.id === useEditorStore.getState().activePageId,
      )?.pageNumber;
      const hasPortalPagePlan = parsePortalPagePlan(getPortalLaunchParam("pageSections")).some(
        (plan) => plan.page_number === currentPageNumber,
      );

      if (!hasPortalPagePlan) {
        if (resolvedOptions?.pageKind === "inside") {
          updateActivePageProperties({ sectionName: category });
        } else if (resolvedOptions?.pageKind === "editorial") {
          updateActivePageProperties({ sectionName: "Editorial" });
        }
      }
    },
    [importNewswireStories, updateActivePageProperties],
  );
  const placeAssetInSelectedFrame = useEditorStore((state) => state.placeAssetInSelectedFrame);
  const deleteAsset = useEditorStore((state) => state.deleteAsset);
  const relinkAsset = useEditorStore((state) => state.relinkAsset);
  const replaceStoryImage = useEditorStore((state) => state.replaceStoryImage);
  const setFrontTeaserImageOverride = useEditorStore((state) => state.setFrontTeaserImageOverride);
  const setFrontTeaserAutoPick = useEditorStore((state) => state.setFrontTeaserAutoPick);
  const setAssetStatus = useEditorStore((state) => state.setAssetStatus);
  const createAdvertisementBooking = useEditorStore((state) => state.createAdvertisementBooking);
  const updateAdvertisementLifecycle = useEditorStore((state) => state.updateAdvertisementLifecycle);
  const createAdvertisementFrameAction = useEditorStore((state) => state.createAdvertisementFrame);
  const autoPlaceAdvertisementsAction = useEditorStore((state) => state.autoPlaceAdvertisements);
  const placeAdvertisementInSelectedFrame = useEditorStore((state) => state.placeAdvertisementInSelectedFrame);
  const replaceAdvertisementArtwork = useEditorStore((state) => state.replaceAdvertisementArtwork);
  const createDocumentStyle = useEditorStore((state) => state.createDocumentStyle);
  const duplicateDocumentStyle = useEditorStore((state) => state.duplicateDocumentStyle);
  const renameDocumentStyle = useEditorStore((state) => state.renameDocumentStyle);
  const updateDocumentStyle = useEditorStore((state) => state.updateDocumentStyle);
  const deleteDocumentStyle = useEditorStore((state) => state.deleteDocumentStyle);
  const applyDocumentStyle = useEditorStore((state) => state.applyDocumentStyle);
  const markDocumentStyleOverride = useEditorStore((state) => state.markDocumentStyleOverride);
  const clearDocumentStyleOverrides = useEditorStore((state) => state.clearDocumentStyleOverrides);
  const importDocumentStyles = useEditorStore((state) => state.importDocumentStyles);
  const exportDocumentStyles = useEditorStore((state) => state.exportDocumentStyles);
  const setCanvasMode = useEditorStore((state) => state.setCanvasMode);
  const liveMoveAnimationFrameRef = useRef<number | null>(null);
  const liveResizeAnimationFrameRef = useRef<number | null>(null);
  const pendingLiveMovePointerRef = useRef<LiveResizePointer | null>(null);
  const pendingLiveResizePointerRef = useRef<LiveResizePointer | null>(null);
  const selectedStyleTargetId = selectedFrameId
    ? editingMode === "text" || selectedObjects.length > 0
      ? `${selectedFrameId}:${selectedObjectType}`
      : selectedFrameId
    : selectedStoryId
      ? `${selectedStoryId}:${selectedObjectType}`
      : null;



  const runWorkspaceCommand = useCallback((label: string, run: () => void) => {
    run();
    setWorkspaceHistory((current) => [label, ...current].slice(0, 24));
  }, []);
  // PERFORMANCE: wizard open/close is now a single boolean.
  // All import logic lives inside GenerationWizardModal.
  const openGenerationWizard = useCallback(() => {
    setWizardPreferredTab(undefined);
    setWizardOpen(true);
    setWorkspaceHistory((current) => ["Open Layout Wizard", ...current].slice(0, 24));
  }, [setWorkspaceHistory]);

  useEffect(() => {
    if (portalSinglePageWizardAutoOpenedRef.current) {
      return;
    }

    const isPortalSinglePageLaunch =
      Boolean(getPortalLaunchParam("publisherId")) &&
      getPortalLaunchParam("mode") === "single" &&
      Boolean(getPortalLaunchParam("selectedPageNumber"));

    if (!isPortalSinglePageLaunch || getPortalLaunchParam("autoOpenLayoutWizard") === "false") {
      return;
    }

    portalSinglePageWizardAutoOpenedRef.current = true;
    setWizardOpen(true);
    setWorkspaceHistory((current) => ["Open Layout Wizard", ...current].slice(0, 24));
  }, [setWorkspaceHistory]);
  const activateWorkspacePanel = useCallback((dockId: "left" | "right" | "bottom", panelId: WorkspacePanelId) => {
    setWorkspaceState((current) => activateDockPanel(current, dockId, panelId));
    setWorkspaceHistory((current) => [`Open ${panelId}`, ...current].slice(0, 24));
  }, [setWorkspaceState]);
  const fitPage = useCallback(() => {
    setZoom(0.45);
    setWorkspaceHistory((current) => ["Fit Page", ...current].slice(0, 24));
  }, [setZoom]);
  const fitWidth = useCallback(() => {
    setZoom(0.72);
    setWorkspaceHistory((current) => ["Fit Width", ...current].slice(0, 24));
  }, [setZoom]);
  const fitSelection = useCallback(() => {
    setZoom(Math.max(zoom, 0.95));
    setWorkspaceHistory((current) => ["Fit Selection", ...current].slice(0, 24));
  }, [setZoom, zoom]);
  const selectPageByNumber = useCallback((pageNumber: number) => {
    const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber);

    if (page) {
      setActivePage(page.id);
      setWorkspaceHistory((current) => [`Go To Page ${pageNumber}`, ...current].slice(0, 24));
    }
  }, [document.pages, setActivePage]);
  // Minimal, wizard-facing view of the page list — lets the Advertisement Page
  // tab offer "attach to page N" without handing the whole live document (and
  // its constant re-render churn) into the wizard's props.
  const wizardPageSummaries = useMemo(
    () =>
      document.pages.map((page) => ({
        id: page.id,
        pageNumber: page.pageNumber,
        pageType: page.pageType,
        sectionName: page.sectionName,
      })),
    [document.pages],
  );
  const workspaceCommands = useMemo<WorkspaceCommand[]>(() => [
    {
      id: "save",
      label: "Save",
      group: "File",
      shortcut: "Ctrl+S",
      run: () => runWorkspaceCommand("Save", () => undefined),
    },
    {
      id: "save-as",
      label: "Save As",
      group: "File",
      shortcut: "Ctrl+Shift+S",
      run: () => runWorkspaceCommand("Save As", () => undefined),
    },
    {
      id: "print",
      label: "Print",
      group: "File",
      shortcut: "Ctrl+P",
      run: () => runWorkspaceCommand("Print", () => undefined),
    },
    {
      id: "create-story",
      label: "Create Story",
      group: "Story",
      shortcut: "N",
      run: () => runWorkspaceCommand("Create Story", createStory),
    },
    {
      id: "generate-layout",
      label: "Generate News Layout",
      group: "Story",
      shortcut: "G",
      run: () => openGenerationWizard(),
    },
    {
      id: "continue-story",
      label: "Continue Story",
      group: "Story",
      run: () => runWorkspaceCommand("Continue Story Placeholder", () => undefined),
    },
    {
      id: "toggle-production",
      label: "Toggle Production View",
      group: "View",
      shortcut: "V",
      run: () => runWorkspaceCommand("Toggle Production View", toggleProductionView),
    },
    {
      id: "toggle-guides",
      label: "Toggle Guides",
      group: "View",
      run: () => runWorkspaceCommand("Toggle Guides", toggleProductionView),
    },
    {
      id: "toggle-grid",
      label: "Toggle Grid",
      group: "View",
      run: () => runWorkspaceCommand("Toggle Grid", toggleProductionView),
    },
    {
      id: "toggle-baseline",
      label: "Toggle Baseline",
      group: "View",
      run: () => runWorkspaceCommand("Toggle Baseline", toggleProductionView),
    },
    {
      id: "duplicate-frame",
      label: "Duplicate Frame",
      group: "Edit",
      run: () => runWorkspaceCommand("Duplicate Frame", duplicateSelectedFrame),
    },
    {
      id: "delete-frame",
      label: "Delete Frame",
      group: "Edit",
      run: () => runWorkspaceCommand("Delete Frame", deleteSelectedFrame),
    },
    {
      id: "place-image",
      label: "Place Image",
      group: "File",
      run: () => activateWorkspacePanel("left", "assets"),
    },
    {
      id: "create-advertisement",
      label: "Create Advertisement",
      group: "Story",
      run: () => activateWorkspacePanel("left", "advertisements"),
    },
    {
      id: "apply-style",
      label: "Apply Style",
      group: "Edit",
      run: () => activateWorkspacePanel("left", "styles"),
    },
    {
      id: "preflight",
      label: "Run Preflight",
      group: "Output",
      run: () => activateWorkspacePanel("bottom", "preflight"),
    },
    {
      id: "export-pdf",
      label: "Export PDF (whole edition)",
      group: "Output",
      run: () => void exportCurrentPagePdf(),
    },
    {
      id: "export-current-page-pdf",
      label: "Export current page as PDF",
      group: "Output",
      run: () => void exportSinglePagePdf(),
    },
    {
      id: "go-to-page",
      label: "Go To Page",
      group: "View",
      run: () => activateWorkspacePanel("right", "navigator"),
    },
    {
      id: "fit-width",
      label: "Fit Width",
      group: "View",
      run: fitWidth,
    },
    {
      id: "fit-page",
      label: "Fit Page",
      group: "View",
      run: fitPage,
    },
    {
      id: "fit-selection",
      label: "Fit Selection",
      group: "View",
      run: fitSelection,
    },
    {
      id: "open-assets",
      label: "Open Assets Panel",
      group: "Panels",
      run: () => activateWorkspacePanel("left", "assets"),
    },
    {
      id: "open-styles",
      label: "Open Styles Panel",
      group: "Panels",
      run: () => activateWorkspacePanel("left", "styles"),
    },
    {
      id: "open-advertisements",
      label: "Open Advertisements Panel",
      group: "Panels",
      run: () => activateWorkspacePanel("left", "advertisements"),
    },
    {
      id: "open-properties",
      label: "Open Properties Panel",
      group: "Panels",
      run: () => activateWorkspacePanel("right", "properties"),
    },
    {
      id: "open-navigator",
      label: "Open Navigator Panel",
      group: "Panels",
      run: () => activateWorkspacePanel("right", "navigator"),
    },
    {
      id: "focus-search",
      label: "Focus Quick Search",
      group: "Panels",
      shortcut: "Ctrl+F",
      run: () => activateWorkspacePanel("right", "quick-search"),
    },
    {
      id: "panel-layout",
      label: "Panel Layout",
      group: "Workspace",
      run: () => activateWorkspacePanel("bottom", "output"),
    },
    {
      id: "quick-actions",
      label: "Quick Actions",
      group: "Tools",
      run: () => setCommandPaletteOpen(true),
    },
  ], [
    activateWorkspacePanel,
    clearPlacementWarning,
    createStory,
    deleteSelectedFrame,
    duplicateSelectedFrame,
    fitPage,
    fitSelection,
    fitWidth,
    openGenerationWizard,
    runWorkspaceCommand,
    toggleProductionView,
  ]);

  renderStartRef.current =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  useEffect(() => {
    let active = true;

    waitForNewspaperFonts()
      .then((state) => {
        if (active) {
          setFontManager(state);
        }
      })
      .catch((error) => {
        if (active) {
          setFontManager({
            ready: false,
            status: "error",
            diagnostics: [],
            warning: error instanceof Error ? error.message : "Font loading failed.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        activateWorkspacePanel("right", "quick-search");
      }
      if (event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        activateWorkspacePanel("right", "quick-search");
      }
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setShortcutOverlayOpen((current) => !current);
      }
      if (event.altKey && event.key === "1") {
        setWorkspaceState((current) => toggleDockCollapsed(current, "left"));
      }
      if (event.altKey && event.key === "2") {
        setWorkspaceState((current) => toggleDockCollapsed(current, "right"));
      }
      if (event.altKey && event.key === "3") {
        setWorkspaceState((current) => toggleDockCollapsed(current, "bottom"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateWorkspacePanel, setWorkspaceState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedZoom = Number(window.localStorage.getItem("cliff-news-workspace-zoom"));
    const storedPageId = window.localStorage.getItem("cliff-news-workspace-active-page");

    if (Number.isFinite(storedZoom) && storedZoom > 0) {
      setZoom(storedZoom);
    }
    if (storedPageId && document.pages.some((page) => page.id === storedPageId)) {
      setActivePage(storedPageId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cliff-news-workspace-zoom", String(zoom));
  }, [zoom]);

  useEffect(() => {
    window.localStorage.setItem("cliff-news-workspace-active-page", activePageId);
  }, [activePageId]);

  const compositionResult = useMemo(
    () =>
      composeStoriesIncrementally({
        stories,
        productionView,
        cache: compositionCacheRef.current,
        profiler: performanceProfilerEnabled ? profilerRef.current : undefined,
      }),
    [stories, productionView, performanceProfilerEnabled],
  );
  const storyLayouts = compositionResult.storyLayouts;
  const visibleStoryLayouts = useMemo(
    () => storyLayouts.filter(({ story }) => !story.hidden),
    [storyLayouts],
  );
  const isYouthUpdateFrontLayout = useMemo(
    () =>
      pageType === "front" &&
      getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID &&
      isYouthUpdateFrontLayoutShape(storyLayouts),
    [pageType, storyLayouts],
  );
  const isYouthUpdateInsideLayout = useMemo(
    () =>
      pageType !== "front" &&
      getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID &&
      Boolean(getYouthUpdateInsideTemplateIdFromLayoutShape(storyLayouts)),
    [pageType, storyLayouts],
  );
  const youthUpdateInsideTemplateId = useMemo(
    () =>
      pageType !== "front" && getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID
        ? getYouthUpdateInsideTemplateIdFromLayoutShape(storyLayouts)
        : null,
    [pageType, storyLayouts],
  );
  const youthUpdateInsideHeaderOnly = isYouthUpdateHeaderOnlyInsideTemplateId(youthUpdateInsideTemplateId);
  // Youth UPDATE's own hardcoded editor photo/EDITORIAL banner, drawn over
  // story 1's box on their front page only -- every other publisher's story
  // 1 (whatever template they're on) stays null and completely untouched.
  const youthUpdateEditorialRailBox = useMemo(() => {
    if (!isYouthUpdateFrontLayout) {
      return null;
    }
    const railStory = visibleStoryLayouts.find((item) => item.story.templateStoryNumber === 1)?.story;
    if (!railStory) return null;
    // Extended to story 2's left edge so the rail's blue touches the lead
    // story's border directly -- the template's real column gutter would
    // otherwise leave a visible sliver of white between them, which reads as
    // a stray gap next to a hardcoded, edge-to-edge graphic. Purely a wider
    // paint rect: story 1's actual box (and the gutter the layout engine
    // reserves) is untouched, so nothing about how the page composes changes.
    // The neighbour is found by position, not by story number: story 2 is the
    // rail's right-hand neighbour on 1A/2A/3A, but on 4A the lead is anchored
    // to the right and a different story sits beside the rail. Taking the
    // nearest box that starts to the right of the rail and shares its band
    // works on all four.
    const nextStory = visibleStoryLayouts
      .map((item) => item.story)
      .filter(
        (story) =>
          story.x > railStory.x &&
          story.y < railStory.y + railStory.height &&
          story.y + story.height > railStory.y,
      )
      .sort((a, b) => a.x - b.x)[0];
    const width = nextStory ? Math.max(railStory.width, nextStory.x - railStory.x) : railStory.width;
    return { x: railStory.x, y: railStory.y, width, height: railStory.height };
  }, [isYouthUpdateFrontLayout, visibleStoryLayouts]);
  // Youth UPDATE: "SHORT NEWS" banner painted across the top of story 3's
  // box -- the real headline/byline/body render normally below it, in the
  // top padding editorStore.ts's isYouthUpdateShortNewsSlot reserves.
  const youthUpdateShortNewsBanner = useMemo(() => {
    if (!isYouthUpdateFrontLayout) return null;
    const story = visibleStoryLayouts.find((item) => item.story.templateStoryNumber === 3)?.story;
    if (!story) return null;
    return { x: story.x, y: story.y, width: story.width, height: story.width * (551 / 1600) };
  }, [isYouthUpdateFrontLayout, visibleStoryLayouts]);
  // Youth UPDATE: right-edge rule after every box, skipped where the box
  // already sits at the paper's own right edge -- and skipped for the
  // editorial rail (story 1), whose own photo/banner treatment already
  // reads as a distinct column without one.
  const youthUpdateRightDividers = useMemo(() => {
    if (!isYouthUpdateFrontLayout) return [];
    const contentRightEdge = (DEFAULT_PAGE_MASTER.contentX + DEFAULT_PAGE_MASTER.contentWidth) * 72;
    return getYouthUpdateRightDividers(
      visibleStoryLayouts
        .filter((item) => item.story.templateStoryNumber !== 1)
        .map(({ story }) => story),
      contentRightEdge,
    );
  }, [isYouthUpdateFrontLayout, visibleStoryLayouts]);
  // Youth UPDATE: a low hatched rule under the top band and under the middle
  // band. Both bands are measured off the two rails rather than off a list of
  // story numbers -- story 1 is always the top band's rail and story 3 always
  // the middle band's on every one of this publisher's front pages, while the
  // stories beside them are numbered differently from design to design.
  // Every box in a band shares that band's bottom edge (rowRhythm sets one
  // height per row), so one rail is enough to place each rule.
  const youthUpdateHatchDividerTicks = useMemo(() => {
    if (!isYouthUpdateFrontLayout) return [];
    const rowBottom = (railStoryNumber: number) => {
      const rail = visibleStoryLayouts.find(
        (item) => item.story.templateStoryNumber === railStoryNumber,
      )?.story;
      return rail ? rail.y + rail.height : 0;
    };
    const contentX = DEFAULT_PAGE_MASTER.contentX * 72;
    const contentWidth = DEFAULT_PAGE_MASTER.contentWidth * 72;
    const ticks = [rowBottom(1), rowBottom(3)]
      .filter((centerY) => centerY > 0)
      .flatMap((centerY) => getYouthUpdateHatchDividerTicks(contentX, contentWidth, centerY, 4, 4));
    // Both rails are furniture with their own drawn edges, so a rule crossing
    // either of them reads as a stray line through a box rather than as a band
    // separator. Only the editorial rail (story 1) used to be protected, which
    // left the row rule printing straight across the SHORT NEWS box (story 3).
    const shortNewsBox = visibleStoryLayouts.find(
      (item) => item.story.templateStoryNumber === 3,
    )?.story;
    return removeYouthUpdateHatchTicksNearKickers(ticks, visibleStoryLayouts, [
      ...(youthUpdateEditorialRailBox ? [youthUpdateEditorialRailBox] : []),
      ...(shortNewsBox
        ? [{ x: shortNewsBox.x, y: shortNewsBox.y, width: shortNewsBox.width, height: shortNewsBox.height }]
        : []),
    ]);
  }, [isYouthUpdateFrontLayout, visibleStoryLayouts, youthUpdateEditorialRailBox]);
  // Youth UPDATE inside page: the "SHORT NEWS" rail's reserved rectangle --
  // the empty column-1 strip beside story 1 (lead) and stories 2-3
  // (secondary row), which the template deliberately leaves unclaimed (see
  // CliffInsideYouthUpdate1A in TemplateRegistry.ts). Painted as furniture,
  // not a real story -- see YouthUpdateInsideRailGeometry.ts.
  const youthUpdateInsideRailBounds = useMemo(() => {
    if (!isYouthUpdateInsideLayout) return null;
    const lead = visibleStoryLayouts.find((item) => item.story.templateStoryNumber === 1)?.story;
    const secondaryB = visibleStoryLayouts.find((item) => item.story.templateStoryNumber === 3)?.story;
    if (!lead || !secondaryB) return null;
    const contentX = DEFAULT_PAGE_MASTER.contentX * 72;
    return {
      x: contentX,
      y: lead.y,
      width: Math.max(0, lead.x - contentX),
      height: secondaryB.y + secondaryB.height - lead.y,
    };
  }, [isYouthUpdateInsideLayout, visibleStoryLayouts]);
  // Youth UPDATE inside page: same right-edge/hatch divider theme as the
  // front page, driven by the same generic geometry helpers.
  const youthUpdateInsideRightDividers = useMemo(() => {
    if (!isYouthUpdateInsideLayout) return [];
    const contentRightEdge = (DEFAULT_PAGE_MASTER.contentX + DEFAULT_PAGE_MASTER.contentWidth) * 72;
    return getYouthUpdateRightDividers(
      visibleStoryLayouts.map(({ story }) => story),
      contentRightEdge,
    );
  }, [isYouthUpdateInsideLayout, visibleStoryLayouts]);
  const youthUpdateInsideHatchDividerTicks = useMemo(() => {
    if (!isYouthUpdateInsideLayout) return [];
    const rowBottom = (storyNumbers: number[]) =>
      Math.max(
        0,
        ...visibleStoryLayouts
          .filter((item) => storyNumbers.includes(item.story.templateStoryNumber ?? -1))
          .map((item) => item.story.y + item.story.height),
      );
    const contentX = DEFAULT_PAGE_MASTER.contentX * 72;
    const contentWidth = DEFAULT_PAGE_MASTER.contentWidth * 72;
    const ticks = [rowBottom([1, 2, 3]), rowBottom([4, 5, 6])]
      .filter((centerY) => centerY > 0)
      .flatMap((centerY) => getYouthUpdateHatchDividerTicks(contentX, contentWidth, centerY, 4, 4));
    return removeYouthUpdateHatchTicksNearKickers(ticks, visibleStoryLayouts);
  }, [isYouthUpdateInsideLayout, visibleStoryLayouts]);
  const imageSourcesByStoryIdRef = useRef<Record<string, string>>({});
  const imageSourcesByStoryId = useMemo(() => {
    const next = Object.fromEntries(
      stories.flatMap((story) => {
        const documentStory = document.stories[story.id];
        const photoAssetId = documentStory?.photo ?? null;
        const asset = photoAssetId ? document.assets[photoAssetId] : null;
        const source = asset?.previewUrl || asset?.thumbnailUrl || asset?.source || "";

        return source ? [[story.id, getPrintableImageSource(source)]] : [];
      }),
    );
    const prev = imageSourcesByStoryIdRef.current;
    const nextKeys = Object.keys(next);
    const prevKeys = Object.keys(prev);
    if (
      nextKeys.length === prevKeys.length &&
      nextKeys.every((key) => prev[key] === next[key])
    ) {
      return prev;
    }
    imageSourcesByStoryIdRef.current = next;
    return next;
  }, [document.assets, document.stories, stories]);
  const frontTeaserImageOverrideUrl = useMemo(() => {
    const activeHeaderSetId = document.headerSystem.activeHeaderSetId;
    const headerSet = activeHeaderSetId ? document.headerSystem.headerSets[activeHeaderSetId] : null;
    return headerSet?.front.teaserImageOverrideUrl || "";
  }, [document.headerSystem]);
  // Picking the teaser from the front page's OWN placed stories (the
  // earlier approach) can't reliably avoid duplicating whichever one of
  // them is also prominently shown elsewhere on the page -- "skip the
  // first story" assumed index 0 was always the big lead box, but any
  // story with an image can end up as the teaser's only other candidate,
  // including the very one used in another visible box (confirmed live:
  // the teaser repeated the same headline as a regular front-page story).
  // Fetching the teaser its own dedicated live article instead -- excluded
  // against both the portal's per-issue "already used" ledger and this
  // page's own current headlines -- guarantees it's never the same story
  // as anything else on the page or issue, and is a real live photo rather
  // than whatever a page story's own (possibly still-loading/fallback)
  // image happens to be.
  const frontTeaserFetchKeyRef = useRef<string | null>(null);
  const [frontTeaserFetchedArticle, setFrontTeaserFetchedArticle] = useState<{ headline: string; imageUrl: string } | null>(null);
  useEffect(() => {
    if (pageType !== "front") {
      return;
    }
    const storyIdsKey = visibleStoryLayouts.map(({ story }) => story.id).join(",");
    if (!storyIdsKey || frontTeaserFetchKeyRef.current === storyIdsKey) {
      return;
    }
    frontTeaserFetchKeyRef.current = storyIdsKey;
    let cancelled = false;
    (async () => {
      try {
        const issueSession = readPortalIssueArticleSession();
        const targets = computeWeightedCategoryTargets(6).filter((entry) => entry.target > 0);
        // Exclusions and the category pool are independent network calls --
        // run them together instead of sequentially so the effect resolves
        // in roughly the slower of the two rather than their sum.
        const [exclusions, perCategoryResults] = await Promise.all([
          loadIssueArticleExclusions(issueSession),
          Promise.all(
            targets.map(async ({ category }) => {
              try {
                const response = await fetch(`/api/newswire?category=${encodeURIComponent(category)}&language=hindi&limit=6`);
                const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: NewswireStory[] } | null;
                return payload?.success !== false && Array.isArray(payload?.data) ? payload.data : [];
              } catch {
                return [];
              }
            }),
          ),
        ]);
        if (cancelled) return;

        for (const { story } of visibleStoryLayouts) {
          const headline = richTextToPlainText(story.articleData?.headline ?? "").replace(/\s+/g, " ").trim();
          if (headline) {
            exclusions.normalizedHeadlines.add(normalizeIssueArticleHeadline(headline));
          }
        }

        const picked = shuffleNewswireStories(perCategoryResults.flat()).find(
          (article) => article.imageUrl && article.headline && !isIssueArticleExcluded(article, exclusions),
        );
        if (picked && !cancelled) {
          setFrontTeaserFetchedArticle({ headline: picked.headline, imageUrl: picked.imageUrl });
          // Also saved into the document itself (not just this component's
          // local state) so the PDF export's separate, synchronous drawing
          // pass -- which cannot run this async fetch -- shows the exact
          // same teaser the live preview just picked, instead of falling
          // back to a different story already on this page. See
          // setFrontTeaserAutoPick's own comment and autoTeaserHeadline/
          // autoTeaserImageUrl on FrontHeaderTemplate.
          setFrontTeaserAutoPick(picked.headline, picked.imageUrl);
          // Deliberately not persisted to the portal's per-issue ledger:
          // saveIssueUsedArticles replaces that page's *entire* saved list
          // rather than appending, and this page's own regular stories
          // already have their own save call (in
          // handleImportNewswireStoriesWithSection) -- calling it again
          // here with just the teaser article would wipe that list out
          // instead of adding to it. The exclusion check above already
          // keeps the teaser from repeating anything on this page or
          // already recorded elsewhere; not recording the teaser itself
          // only risks a future regeneration picking the same photo again,
          // which is a far smaller problem than losing this page's own
          // dedup record.
        }
      } catch {
        // Non-fatal -- frontHeaderTeaser below falls back to picking a
        // second story already on the page while this fetch is in flight
        // or if it never resolves, same as before this dedicated fetch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageType, visibleStoryLayouts]);
  const frontHeaderTeaser = useMemo(() => {
    if (pageType !== "front") {
      return null;
    }

    if (frontTeaserFetchedArticle) {
      return {
        headline: frontTeaserFetchedArticle.headline,
        imageUrl: frontTeaserImageOverrideUrl || frontTeaserFetchedArticle.imageUrl,
      };
    }

    const candidates = visibleStoryLayouts
      .map(({ story }) => ({
        headline: richTextToPlainText(story.articleData?.headline ?? "").replace(/\s+/g, " ").trim(),
        imageUrl: imageSourcesByStoryId[story.id],
      }))
      .filter((candidate) => candidate.headline && candidate.imageUrl);

    // The masthead teaser box duplicated the front page's own lead story
    // when it just reused the first image+headline story here -- that
    // story is already the big splash printed elsewhere on the same page
    // (identical headline in both places). A second candidate reads as a
    // genuinely separate item instead; only fall back to the first/only
    // one when the page has nothing else to offer. This whole branch is
    // now only a stand-in while the dedicated fetch above is in flight (or
    // if it fails) -- it can still coincidentally repeat a page story, the
    // fetched article above is the real fix.
    const picked = candidates[1] ?? candidates[0];
    if (!picked) {
      return null;
    }

    return { headline: picked.headline, imageUrl: frontTeaserImageOverrideUrl || picked.imageUrl };
  }, [frontTeaserFetchedArticle, frontTeaserImageOverrideUrl, imageSourcesByStoryId, pageType, visibleStoryLayouts]);
  const layoutNodeCounts = useMemo(
    () =>
      new Map(
        storyLayouts.map(({ story, layout }) => [
          story.id,
          countArticleLayoutNodes(layout),
        ]),
      ),
    [storyLayouts],
  );
  layoutNodeCountsRef.current = layoutNodeCounts;
  const profilerSnapshot = performanceProfilerEnabled ? profilerRef.current.getSnapshot() : null;
  const getRenderStageDuration = (stage: string) =>
    profilerSnapshot?.renderStageBreakdown.find((entry) => entry.stage === stage)?.durationMs ?? 0;
  const renderCacheStats = useMemo(() => {
    let hits = 0;
    let misses = 0;
    const activeStoryIds = new Set(visibleStoryLayouts.map(({ story }) => story.id));

    for (const cachedStoryId of renderHashCacheRef.current.keys()) {
      if (!activeStoryIds.has(cachedStoryId)) {
        renderHashCacheRef.current.delete(cachedStoryId);
      }
    }

    for (const { story, layout } of visibleStoryLayouts) {
      const hash = createStoryRenderHash({
        story,
        layout,
        selected: !productionView && story.id === selectedStoryId,
        showCompositionOverlays: !productionView,
        showPriorityLabel: story.compositionSettings.showRegionDebug,
      });
      const cached = renderHashCacheRef.current.get(story.id);

      if (cached?.hash === hash) {
        hits += 1;
      } else {
        misses += 1;
        renderHashCacheRef.current.set(story.id, {
          hash,
          version: (cached?.version ?? 0) + 1,
        });
      }
    }

    const total = Math.max(1, hits + misses);

    return {
      hits,
      misses,
      hitPercent: Math.round((hits / total) * 1000) / 10,
      missPercent: Math.round((misses / total) * 1000) / 10,
    };
  }, [visibleStoryLayouts, productionView, selectedStoryId, selectedObjectType]);
  const performanceDiagnostics: EditorPerformanceDiagnostics = {
    ...compositionResult.diagnostics,
    renderTimeMs: renderDiagnostics.renderTimeMs,
    fps: renderDiagnostics.fps,
    averageFrameTimeMs: renderDiagnostics.renderTimeMs,
    worstFrameTimeMs: profilerSnapshot?.worstFrameTimeMs ?? renderDiagnostics.renderTimeMs,
    averageFps: profilerSnapshot?.averageFps ?? renderDiagnostics.fps,
    minimumFps: profilerSnapshot?.minimumFps ?? renderDiagnostics.fps,
    maximumFps: profilerSnapshot?.maximumFps ?? renderDiagnostics.fps,
    memoryUsageMb: getMemoryUsageMb(),
    konvaNodes: renderDiagnostics.konvaNodes.totalNodes,
    stageCount: renderDiagnostics.konvaNodes.stageCount,
    layerCount: renderDiagnostics.konvaNodes.layerCount,
    fastLayerCount: renderDiagnostics.konvaNodes.fastLayerCount,
    groupCount: renderDiagnostics.konvaNodes.groupCount,
    textNodeCount: renderDiagnostics.konvaNodes.textNodeCount,
    rectCount: renderDiagnostics.konvaNodes.rectCount,
    imageNodeCount: renderDiagnostics.konvaNodes.imageNodeCount,
    lineCount: renderDiagnostics.konvaNodes.lineCount,
    guideCount: renderDiagnostics.konvaNodes.guideCount,
    transformerCount: renderDiagnostics.konvaNodes.transformerCount,
    selectionNodeCount: renderDiagnostics.konvaNodes.selectionNodeCount,
    totalNodes: renderDiagnostics.konvaNodes.totalNodes,
    visibleNodes: renderDiagnostics.konvaNodes.visibleNodes,
    hiddenNodes: renderDiagnostics.konvaNodes.hiddenNodes,
    destroyedNodes: renderDiagnostics.konvaNodes.destroyedNodes,
    createdNodes: renderDiagnostics.konvaNodes.createdNodes,
    renderCacheHitPercent: renderCacheStats.hitPercent,
    renderCacheMissPercent: renderCacheStats.missPercent,
    storiesRepainted: renderCacheStats.misses,
    hotPathOperations: profilerSnapshot?.hotPathOperations ?? compositionResult.diagnostics.hotPathOperations,
    slowReactComponents: profilerSnapshot?.slowReactComponents ?? [],
    slowStories: profilerSnapshot?.slowStories ?? [],
    renderStageBreakdown: profilerSnapshot?.renderStageBreakdown ?? [],
    editorCanvasRenderTimeMs: getRenderStageDuration("editor-canvas-render"),
    canvasLayerRenderTimeMs: getRenderStageDuration("canvas-layer-render"),
    storyRenderTimeMs: getRenderStageDuration("story-render"),
    articleBoxRenderTimeMs: getRenderStageDuration("article-box-render"),
    headlineRenderTimeMs: getRenderStageDuration("headline-render"),
    subheadlineRenderTimeMs: getRenderStageDuration("subheadline-render"),
    bodyRenderTimeMs: getRenderStageDuration("body-render"),
    imageRenderTimeMs: getRenderStageDuration("image-render"),
    captionRenderTimeMs: getRenderStageDuration("caption-render"),
    factBoxRenderTimeMs: getRenderStageDuration("factbox-render"),
    pullQuoteRenderTimeMs: getRenderStageDuration("pullquote-render"),
    selectionRenderTimeMs: getRenderStageDuration("selection-render"),
    guidesRenderTimeMs: getRenderStageDuration("guides-render"),
    gridRenderTimeMs: getRenderStageDuration("grid-render"),
    reactRenderTimeMs: getRenderStageDuration("react-render"),
    reactCommitTimeMs: getRenderStageDuration("react-commit"),
    konvaBatchDrawTimeMs: getRenderStageDuration("konva-batch-draw"),
  };
  const selectedStoryLayout = storyLayouts.find(({ story }) => story.id === selectedStoryId) ?? null;
  const selectedParagraphCount = Math.max(
    1,
    selectedStoryLayout?.story.articleData.bodyParagraphs?.length ??
      selectedStoryLayout?.layout.paragraphBounds?.length ??
      0,
  );
  const selectedParagraphContext =
    selectedObjectType === "body"
      ? `Paragraph ${Math.min(selectedParagraphIndex + 1, selectedParagraphCount)} / ${selectedParagraphCount}`
      : objectTypeLabels[selectedObjectType] ?? selectedObjectType;
  const pageOrigin = useMemo(
    () => getPageOrigin(viewport, zoom, Boolean(selectedStoryLayout), pagePanOffset),
    [selectedStoryLayout, viewport, zoom, pagePanOffset],
  );
  const activePage = useMemo(
    () => document.pages.find((page) => page.id === activePageId) ?? document.pages[0] ?? null,
    [activePageId, document.pages],
  );
  const portalPagePlan = useMemo(() => {
    const planned = parsePortalPagePlan(getPortalLaunchParam("pageSections"));

    if (planned.length > 0) {
      return planned.sort((first, second) => first.page_number - second.page_number);
    }

    return document.pages.map((page) => ({
      page_number: page.pageNumber,
      section: page.sectionName || `Page ${page.pageNumber}`,
      header_type: page.pageType === "editorial" ? "editorial" : page.pageNumber === 1 ? "front" : "normal",
      category: page.sectionName || "",
    }));
  }, [document.pages]);
  const resolvedPageHeader = useMemo(
    () => (activePage ? resolvePageHeader(document, activePage.id) : null),
    [activePage, document],
  );
  const headerLogoSource = useMemo(() => {
    if (!resolvedPageHeader) {
      return "";
    }

    const profile = document.headerSystem.publicationProfiles[resolvedPageHeader.profileId];
    const assetId = profile?.logoAssetId ?? profile?.monochromeLogoAssetId ?? null;
    const asset = assetId ? document.assets[assetId] : null;
    const source = asset?.previewUrl ?? asset?.thumbnailUrl ?? asset?.source ?? "";

    return source ? getPrintableImageSource(source) : "";
  }, [document.assets, document.headerSystem.publicationProfiles, resolvedPageHeader]);
  const masterHeaderEnabled = Boolean(document.headerSystem.activeHeaderSetId);
  const drawHeaderTextOperation = (
    context: CanvasRenderingContext2D,
    operation: HeaderPrintTextOperation,
  ) => {
    const fontFamily =
      operation.fontFamily === "serif"
        ? "'Noto Serif Devanagari', Georgia, serif"
        : operation.fontFamily === "condensed"
          ? "'Arial Narrow', Arial, sans-serif"
          : "Arial, sans-serif";
    context.fillStyle = operation.color;
    context.font = `${operation.fontWeight === "bold" ? "700" : "400"} ${operation.fontSize}px ${fontFamily}`;
    context.textBaseline = "top";
    context.textAlign = operation.align;
    context.fillText(
      operation.text,
      operation.align === "center"
        ? operation.x + operation.width / 2
        : operation.align === "right"
          ? operation.x + operation.width
          : operation.x,
      operation.y,
    );
  };
  /**
   * Paints the press colour control strip onto the export canvas.
   *
   * Shapes come from the shared geometry module, so this and the on-screen
   * `PressColourBar` are the same strip by construction.
   */
  const drawPressColourBarToCanvas = (
    context: CanvasRenderingContext2D,
    page: NewspaperPageObject,
    pageWidth: number,
    pageHeight: number,
  ) => {
    const master = page.masterPage;
    const contentY = (master.contentY ?? DEFAULT_PAGE_MASTER.contentY) * 72;
    const contentHeight = (master.contentHeight ?? DEFAULT_PAGE_MASTER.contentHeight) * 72;
    const { dots, bars } = getPressColourBar({
      pageWidth,
      pageHeight,
      contentBottom: contentY + contentHeight,
    });

    context.save();
    for (const bar of bars) {
      context.fillStyle = bar.fill;
      context.beginPath();
      // roundRect is available in every browser this app targets; fall back to a
      // plain rect rather than dropping the bar if it is missing.
      if (typeof context.roundRect === "function") {
        context.roundRect(bar.x, bar.y, bar.width, bar.height, bar.cornerRadius);
      } else {
        context.rect(bar.x, bar.y, bar.width, bar.height);
      }
      context.fill();
    }
    for (const dot of dots) {
      context.fillStyle = dot.fill;
      context.beginPath();
      context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

  /**
   * Paints the Youth UPDATE masthead onto the export canvas -- the PDF
   * export's own path, mirroring drawPressColourBarToCanvas above. Reads
   * the same publication profile fields (city/price/volumeLabel/issueLabel)
   * every other publisher's masthead overlay already uses; only the
   * registration number is specific to this one paper, since nothing else
   * in the system carries a press registration number today.
   */
  const drawYouthUpdateMastheadToCanvas = async (
    context: CanvasRenderingContext2D,
    pageWidth: number,
  ) => {
    const activeHeaderSetId = document.headerSystem.activeHeaderSetId;
    const profileId = activeHeaderSetId ? document.headerSystem.headerSets[activeHeaderSetId]?.publicationProfileId : null;
    const profile = profileId ? document.headerSystem.publicationProfiles[profileId] : null;
    const teaserSlots = getYouthUpdateTeasersOrFallback();

    const now = new Date();
    const geometry = getYouthUpdateMastheadGeometry({
      pageWidth,
      teaserHeadlines: teaserSlots.map((t) => t.headline) as [string, string, string, string],
      teaserLabels: teaserSlots.map((t) => t.label) as [string, string, string, string],
      teaserImageUrls: teaserSlots.map((t) => t.imageUrl) as [string, string, string, string],
      volumeLabel: profile?.volumeLabel || "1",
      issueLabel: profile?.issueLabel?.replace(/\D/g, "") || profile?.issueLabel || "1",
      registrationNumber: YOUTH_UPDATE_REGISTRATION_NUMBER,
      city: profile?.city || "BHOPAL",
      dayName: now.toLocaleDateString("en-IN", { weekday: "long" }),
      dateLabel: now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase(),
      pageCount: document.pages.length,
      price: profile?.price || "2.00",
    });

    const sansSerif = getNewspaperFontStack("sans");
    const referenceScale = pageWidth / 1600;
    const condensedFont = `"${YOUTH_UPDATE_WORDMARK_FONT_FAMILY}", ${sansSerif}`;
    if (typeof globalThis.document !== "undefined" && globalThis.document.fonts?.load) {
      await globalThis.document.fonts
        .load(`400 ${geometry.wordmark.fontSize}px "${YOUTH_UPDATE_WORDMARK_FONT_FAMILY}"`)
        .catch(() => undefined);
    }
    context.save();
    context.textBaseline = "top";

    context.textAlign = "right";
    context.font = `italic 400 ${YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX * referenceScale}px "Times New Roman", serif`;
    context.fillStyle = YOUTH_UPDATE_COLORS.tagline;
    context.fillText(geometry.tagline.text, geometry.tagline.x, geometry.tagline.y);

    context.textAlign = "left";
    context.font = `400 ${geometry.wordmark.fontSize}px ${condensedFont}`;
    context.fillStyle = geometry.wordmark.youth.color;
    fillCanvasText(context, geometry.wordmark.youth.text, geometry.wordmark.youth.x, geometry.wordmark.y, geometry.wordmark.letterSpacing);
    context.fillStyle = geometry.wordmark.update.color;
    fillCanvasText(context, geometry.wordmark.update.text, geometry.wordmark.update.x, geometry.wordmark.y, geometry.wordmark.letterSpacing);

    context.fillStyle = YOUTH_UPDATE_COLORS.dot;
    context.beginPath();
    context.arc(geometry.dot.x, geometry.dot.y, geometry.dot.radius, 0, Math.PI * 2);
    context.fill();

    // Each teaser's cutout photo -- "contain"-fit, bottom-aligned, no
    // background fill, same as the live preview's TeaserPhoto. Loaded and
    // drawn before the text so the headline/label print over it if they
    // ever overlap.
    for (const teaser of geometry.teasers) {
      if (!teaser.imageUrl) continue;
      const image = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = teaser.imageUrl;
      });
      if (!image) continue;
      const isApiPhoto = teaser.imageUrl.startsWith("data:image/");
      const scale = isApiPhoto
        ? Math.max(teaser.photo.width / image.naturalWidth, teaser.photo.height / image.naturalHeight)
        : Math.min(teaser.photo.width / image.naturalWidth, teaser.photo.height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = isApiPhoto ? teaser.photo.x : teaser.photo.x + (teaser.photo.width - drawWidth) / 2;
      const drawY = isApiPhoto
        ? teaser.photo.y + (teaser.photo.height - drawHeight) / 2
        : teaser.photo.y + teaser.photo.height - drawHeight;
      context.save();
      context.beginPath();
      context.rect(teaser.photo.x, teaser.photo.y, teaser.photo.width, teaser.photo.height);
      context.clip();
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      context.restore();
    }

    geometry.teasers.forEach((teaser) => {
      context.textAlign = "right";
      context.font = `400 ${18 * referenceScale}px ${condensedFont}`;
      context.fillStyle = YOUTH_UPDATE_COLORS.teaserHeadline;
      const words = teaser.headline.text.split(" ");
      let line = "";
      let lineY = teaser.headline.y;
      const lineHeight = 18.4 * referenceScale;
      const anchorX = teaser.headline.x + teaser.headline.width;
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (context.measureText(testLine).width > teaser.headline.width && line) {
          context.fillText(line, anchorX, lineY);
          line = word;
          lineY += lineHeight;
          if (lineY > teaser.headline.y + teaser.headline.height) break;
        } else {
          line = testLine;
        }
      }
      if (line && lineY <= teaser.headline.y + teaser.headline.height) {
        context.fillText(line, anchorX, lineY);
      }

      context.font = `400 ${15 * referenceScale}px ${condensedFont}`;
      context.fillStyle = YOUTH_UPDATE_COLORS.teaserLabel;
      context.fillText(teaser.label.text, teaser.label.x + teaser.label.width, teaser.label.y);
    });

    context.fillStyle = YOUTH_UPDATE_COLORS.divider;
    for (const divider of geometry.dividerDots) {
      for (const y of divider.ys) {
        context.beginPath();
        context.arc(divider.x, y, divider.radius, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.fillStyle = YOUTH_UPDATE_COLORS.infoBarFill;
    context.fillRect(geometry.infoBar.x, geometry.infoBar.y, geometry.infoBar.width, geometry.infoBar.height);
    context.font = `400 ${23 * referenceScale}px ${condensedFont}`;
    context.fillStyle = YOUTH_UPDATE_COLORS.infoBarText;
    context.textBaseline = "middle";
    for (const segment of geometry.infoBar.segments) {
      context.textAlign = segment.align;
      const anchorX = segment.align === "left" ? segment.x : segment.align === "right" ? segment.x + segment.width : segment.x + segment.width / 2;
      context.fillText(segment.text, anchorX, geometry.infoBar.y + geometry.infoBar.height / 2);
    }

    context.restore();
  };

  const drawResolvedHeaderToCanvas = async (
    context: CanvasRenderingContext2D,
    page: NewspaperPageObject,
    pageWidth: number,
  ) => {
    const headerPrintModel = await buildHeaderPrintModel(document, page.id);

    if (!headerPrintModel) {
      if (masterHeaderEnabled) {
        return;
      }

      context.fillStyle = "#111111";
      context.font = "700 12px 'Noto Serif Devanagari', serif";
      context.fillText(document.metadata.newspaperName, 18, 22);
      context.strokeStyle = "#111111";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, 34);
      context.lineTo(pageWidth, 34);
      context.stroke();
      return;
    }

    for (const operation of headerPrintModel.operations) {
      if (operation.kind === "text") {
        drawHeaderTextOperation(context, operation);
      } else if (operation.kind === "rule") {
        context.strokeStyle = operation.color;
        context.lineWidth = operation.width;
        context.beginPath();
        context.moveTo(operation.x1, operation.y1);
        context.lineTo(operation.x2, operation.y2);
        context.stroke();
      } else if (operation.kind === "rect") {
        context.fillStyle = operation.color;
        context.fillRect(operation.x, operation.y, operation.width, operation.height);
      } else {
        try {
          const logo = await loadImageElement(operation.source);
          if (operation.id === "header-banner" || operation.id === "front-header-banner" || operation.id === "inside-header-banner") {
            context.drawImage(logo, operation.x, operation.y, operation.width, operation.height);
          } else {
            const logoRatio = logo.width / Math.max(1, logo.height);
            const frameRatio = operation.width / Math.max(1, operation.height);
            const drawWidth = logoRatio > frameRatio ? operation.width : operation.height * logoRatio;
            const drawHeight = logoRatio > frameRatio ? operation.width / logoRatio : operation.height;

            context.drawImage(
              logo,
              operation.x + (operation.width - drawWidth) / 2,
              operation.y + (operation.height - drawHeight) / 2,
              drawWidth,
              drawHeight,
            );
          }
        } catch {
          // Missing or broken logo assets fall back to the text masthead.
        }
      }
    }

  };
  const applyPrintTextStyle = (
    context: CanvasRenderingContext2D,
    style: ArticleLayout["headline"]["style"],
  ) => {
    const weightMatch = style.fontStyle?.match(/\b(400|500|600|700|800|900|bold)\b/i);
    const rawWeight = weightMatch?.[1];
    const weight = rawWeight
      ? (rawWeight.toLowerCase() === "bold" ? "700" : rawWeight)
      : "400";
    const italic = style.fontStyle?.includes("italic") ? "italic " : "";

    context.font = `${italic}${weight} ${style.fontSize}px ${style.fontFamily}, 'Noto Serif Devanagari', serif`;
    context.fillStyle = style.fill || "#111111";
    context.textBaseline = "top";
    context.textAlign = style.align === "center" ? "center" : style.align === "right" ? "right" : "left";
  };
  const sanitizeCanvasText = (text: string) =>
    text
      .replace(/_*BYLINE[\s_-]*DOT_*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  const isDisplayDevanagariText = (text: string, style: ArticleLayout["headline"]["style"]) =>
    /[\u0900-\u097F]/u.test(text) &&
    (style.fontSize >= 13 ||
      /\b(600|700|800|900|bold)\b/i.test(style.fontStyle ?? "") ||
      Boolean(style.backgroundColor && style.backgroundColor !== "transparent"));
  const getDisplayInkShiftY = (text: string, style: ArticleLayout["headline"]["style"]) =>
    isDisplayDevanagariText(text, style)
      ? Math.min(4, Math.max(2, style.fontSize * 0.1))
      : 0;
  const fillCanvasText = (
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    letterSpacing = 0,
  ) => {
    if (!letterSpacing || /[\u0900-\u097F]/u.test(text)) {
      context.fillText(text, x, y);
      return;
    }

    let nextX = x;
    for (const character of Array.from(text)) {
      context.fillText(character, nextX, y);
      nextX += context.measureText(character).width + letterSpacing;
    }
  };
  const drawCanvasBylineDot = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    fontSize: number,
  ) => {
    context.save();
    context.fillStyle = fill || "#b42318";
    context.beginPath();
    context.arc(x + width / 2, y + height * 0.5, Math.max(1.8, fontSize * 0.22), 0, Math.PI * 2);
    context.fill();
    context.restore();
  };
  const drawTextBlockToCanvas = (
    context: CanvasRenderingContext2D,
    block: ArticleLayout["headline"] | null | undefined,
    offsetX: number,
    offsetY: number,
  ) => {
    if (!block) {
      return;
    }

    if (block.containerBounds) {
      const hasBg = block.containerStyle?.containerBackgroundColor && block.containerStyle.containerBackgroundColor !== "transparent";
      const hasBorder = block.containerStyle?.containerBorderWidth && block.containerStyle.containerBorderWidth > 0 && block.containerStyle.containerBorderColor !== "transparent";

      if (hasBg || hasBorder) {
        context.save();
        context.globalAlpha = block.containerStyle?.containerOpacity ?? 1;
        
        if (hasBg) {
          context.fillStyle = block.containerStyle!.containerBackgroundColor;
          context.fillRect(
            offsetX + block.containerBounds.x,
            offsetY + block.containerBounds.y,
            block.containerBounds.width,
            block.containerBounds.height,
          );
        }

        if (hasBorder) {
          context.strokeStyle = block.containerStyle!.containerBorderColor;
          context.lineWidth = block.containerStyle!.containerBorderWidth;
          context.strokeRect(
            offsetX + block.containerBounds.x,
            offsetY + block.containerBounds.y,
            block.containerBounds.width,
            block.containerBounds.height,
          );
        }
        
        context.restore();
      }
    }

    const clipBleed = Math.min(12, Math.max(5, block.style.fontSize * 0.24));
    context.save();
    context.beginPath();
    context.rect(offsetX + block.x, offsetY + block.y - clipBleed, block.width, block.height + clipBleed * 2);
    context.clip();

    for (const line of block.lineBoxes) {
      if (line.segments?.length) {
        context.save();
        if (line.scaleX && line.scaleX !== 1) {
          context.translate(offsetX + line.x, offsetY + line.y);
          context.scale(line.scaleX, 1);
          context.translate(-(offsetX + line.x), -(offsetY + line.y));
        }
        for (const segment of line.segments) {
          const segmentText = segment.text.trim();
          if (segment.role === "byline-dot" || segmentText === "\u2022" || /_*BYLINE[\s_-]*DOT_*/i.test(segmentText)) {
            drawCanvasBylineDot(
              context,
              offsetX + (segment.x ?? line.x),
              offsetY + (segment.y ?? line.y),
              segment.width,
              segment.height,
              segment.style.fill,
              segment.style.fontSize,
            );
            continue;
          }
          const printableText = sanitizeCanvasText(segment.text);
          if (!printableText) {
            continue;
          }
          applyPrintTextStyle(context, segment.style);
          context.textAlign = "left";
          fillCanvasText(
            context,
            printableText,
            offsetX + (segment.x ?? line.x),
            offsetY + (segment.y ?? line.y) + getDisplayInkShiftY(printableText, segment.style),
            segment.style.letterSpacing ?? 0,
          );
        }
        context.restore();
      } else {
        const printableText = sanitizeCanvasText(line.text);
        if (!printableText) {
          continue;
        }
        applyPrintTextStyle(context, line.style);
        const x =
          line.style.align === "center"
            ? offsetX + line.x + line.width / 2
            : line.style.align === "right"
              ? offsetX + line.x + line.width
              : offsetX + line.x;

        context.save();
        if (line.scaleX && line.scaleX !== 1) {
          context.translate(offsetX + line.x, offsetY + line.y);
          context.scale(line.scaleX, 1);
          context.translate(-(offsetX + line.x), -(offsetY + line.y));
        }
        fillCanvasText(
          context,
          printableText,
          x,
          offsetY + line.y + getDisplayInkShiftY(printableText, line.style),
          line.style.letterSpacing ?? 0,
        );
        context.restore();
      }
    }

    context.restore();
  };
  const drawStoryLayoutToCanvas = async (
    context: CanvasRenderingContext2D,
    { story, layout }: IncrementalStoryLayout,
    imageSourceOverrides?: Record<string, string>,
    // Publisher-exclusive: Youth UPDATE's front page suppresses every
    // article box's own frame border. Passed by the caller (which has the
    // real `page` this story belongs to during a multi-page export) rather
    // than read from outer-scope state, which only reflects whichever page
    // happens to be active in the editor right now. Undefined everywhere
    // else, so every other page/publisher is untouched.
    youthUpdateFlatStyle = false,
  ) => {
    if (
      layout.containerStyles?.article?.containerBackgroundColor &&
      layout.containerStyles.article.containerBackgroundColor !== "transparent"
    ) {
      context.fillStyle = layout.containerStyles.article.containerBackgroundColor;
    } else {
      context.fillStyle = "#fffef9";
    }
    const radius = layout.containerStyles?.article?.containerBorderRadius;
    // Every story's box background/border draws at its true story.y/height,
    // full stop — a badge box used to shift this down and shrink the height
    // to dodge its own pill's overhang, but that made a badge box's border
    // start lower and read shorter than a normal box sitting beside it in the
    // same row. The pill still straddles above this (unshifted) top edge on
    // its own — see kickerTopInset in composeArticleBox — so "badge going
    // above the border" is unaffected; only the box itself stops moving.
    const boxTop = story.y;
    const boxHeight = story.height;
    if (radius && context.roundRect) {
      context.beginPath();
      context.roundRect(story.x, boxTop, story.width, boxHeight, radius);
      context.fill();
    } else {
      context.fillRect(story.x, boxTop, story.width, boxHeight);
    }

    if (!youthUpdateFlatStyle && layout.containerStyles?.article?.containerBorderWidth) {
      context.strokeStyle = layout.containerStyles.article.containerBorderColor || "#000000";
      context.lineWidth = layout.containerStyles.article.containerBorderWidth;
      if (radius && context.roundRect) {
        context.beginPath();
        context.roundRect(story.x, boxTop, story.width, boxHeight, radius);
        context.stroke();
      } else {
        context.strokeRect(story.x, boxTop, story.width, boxHeight);
      }
    }

    // Not imageSourcesByStoryId alone — that memo is built from the single
    // active page's `stories`/`document.stories`, which importNewswireStories
    // overwrites per page (story ids collide across pages, "story-1",
    // "story-2", ... restarting each call — see batchPageStoriesSnapshotRef's
    // own comment). imageSourceOverrides, when supplied, is a snapshot taken
    // right after THIS page's own import (before a later page's import can
    // clobber document.stories' photo references) — see
    // batchPageImageSourcesRef. Falls back to imageSourcesByStoryId for the
    // normal (non-batch, single-active-page) case, where it's already correct.
    const imageSource = imageSourceOverrides?.[story.id] ?? imageSourcesByStoryId[story.id] ?? "";
    if (layout.image) {
      // Photos on a subset of stories are drawn with rounded corners; clipping
      // to a rounded path is what actually rounds the bitmap itself.
      const imageRadius = layout.image.cornerRadius ?? 0;
      const roundsImage = imageRadius > 0 && Boolean(context.roundRect);
      if (roundsImage) {
        context.save();
        context.beginPath();
        context.roundRect(
          story.x + layout.image.x,
          story.y + layout.image.y,
          layout.image.width,
          layout.image.height,
          imageRadius,
        );
        context.clip();
      }
      if (imageSource) {
        try {
          const storyImage = await loadImageElement(imageSource);
          const imgNaturalW = storyImage.naturalWidth || storyImage.width;
          const imgNaturalH = storyImage.naturalHeight || storyImage.height;

          const isPureAd =
            (story as any)?.role === "advertisement" ||
            (layout.image.coverCropWidth && Math.abs(layout.image.coverCropWidth - imgNaturalW) < 2);

          const crop = isPureAd
            ? {
                sourceX: layout.image.coverCropX ?? 0,
                sourceY: layout.image.coverCropY ?? 0,
                sourceWidth: layout.image.coverCropWidth ?? imgNaturalW,
                sourceHeight: layout.image.coverCropHeight ?? imgNaturalH,
              }
            : computeImageCoverCrop({
                sourceWidth: imgNaturalW,
                sourceHeight: imgNaturalH,
                frameWidth: layout.image.width,
                frameHeight: layout.image.height,
                // Matches composeArticleBox.ts's own bias -- keeps the top
                // of the subject from being cut off by a dead-centre crop.
                focalPointY: 0.3,
              });

          context.drawImage(
            storyImage,
            crop.sourceX,
            crop.sourceY,
            crop.sourceWidth,
            crop.sourceHeight,
            story.x + layout.image.x,
            story.y + layout.image.y,
            layout.image.width,
            layout.image.height,
          );
        } catch {
          context.fillStyle = layout.image.fill ?? "#eee8dc";
          context.fillRect(story.x + layout.image.x, story.y + layout.image.y, layout.image.width, layout.image.height);
        }
      } else {
        context.fillStyle = layout.image.fill ?? "#eee8dc";
        context.fillRect(story.x + layout.image.x, story.y + layout.image.y, layout.image.width, layout.image.height);
      }

      if (roundsImage) {
        context.restore();
      }
    }

    // Hard-clip the kicker to this story's own box. It's fit-to-width via a
    // measured font-size search, and Devanagari glyph shaping can render
    // slightly wider than the measurement predicted — clipping guarantees
    // it can never visually bleed into a neighboring article regardless.
    if (layout.kicker?.textBlock) {
      context.save();
      if (layout.kicker.fill && layout.kicker.fill !== "transparent") {
        context.fillStyle = layout.kicker.fill;
        if (context.roundRect && layout.kicker.cornerRadius) {
          context.beginPath();
          context.roundRect(story.x + layout.kicker.x, story.y + layout.kicker.y, layout.kicker.width, layout.kicker.height, layout.kicker.cornerRadius);
          context.fill();
        } else {
          context.fillRect(story.x + layout.kicker.x, story.y + layout.kicker.y, layout.kicker.width, layout.kicker.height);
        }
      }
      if (layout.kicker.strokeWidth && layout.kicker.stroke && layout.kicker.stroke !== "transparent") {
        context.strokeStyle = layout.kicker.stroke;
        context.lineWidth = layout.kicker.strokeWidth;
        if (context.roundRect && layout.kicker.cornerRadius) {
          context.beginPath();
          context.roundRect(story.x + layout.kicker.x, story.y + layout.kicker.y, layout.kicker.width, layout.kicker.height, layout.kicker.cornerRadius);
          context.stroke();
        } else {
          context.strokeRect(story.x + layout.kicker.x, story.y + layout.kicker.y, layout.kicker.width, layout.kicker.height);
        }
      }
      drawTextBlockToCanvas(context, layout.kicker.textBlock, story.x, story.y);
      context.restore();
    }
    drawTextBlockToCanvas(context, layout.strap?.textBlock, story.x, story.y);
    drawTextBlockToCanvas(context, layout.headline, story.x, story.y);
    // The reversed banner behind the subheadline.
    //
    // The on-screen canvas draws this rect (ArticleBox) and the export did not,
    // which is exactly the trap this codebase sets: two render paths, one of
    // them missing a piece. On the sheet the banner vanished, its white type
    // landed on white paper, and the depth the composer had reserved for it
    // printed as a white gap under the headline — the "gap only in the PDF".
    if (layout.subheadlineBackground) {
      const banner = layout.subheadlineBackground;
      context.save();

      if (banner.fill && banner.fill !== "transparent") {
        context.fillStyle = banner.fill;
        context.beginPath();
        if (context.roundRect) {
          context.roundRect(story.x + banner.x, story.y + banner.y, banner.width, banner.height, 4);
          context.fill();
        } else {
          context.fillRect(story.x + banner.x, story.y + banner.y, banner.width, banner.height);
        }
      }

      if (banner.strokeWidth && banner.stroke && banner.stroke !== "transparent") {
        context.strokeStyle = banner.stroke;
        context.lineWidth = banner.strokeWidth;
        context.strokeRect(story.x + banner.x, story.y + banner.y, banner.width, banner.height);
      }

      context.restore();
    }

    drawTextBlockToCanvas(context, layout.subheadline, story.x, story.y);
    if (layout.inlineSubheadline) {
      for (const bulletBlock of layout.inlineSubheadline) {
        drawTextBlockToCanvas(context, bulletBlock, story.x, story.y);
      }
    }
    drawTextBlockToCanvas(context, layout.byline, story.x, story.y);

    // The drop cap is drawn in the live Konva preview (ArticleBox.tsx) but
    // was never drawn here -- the export builds its own separate canvas, so
    // anything not explicitly drawn in both places silently vanishes from
    // the PDF while still showing on screen. Same simple text style path
    // the body's own segments already use below, not `drawTextBlockToCanvas`
    // (that expects a multi-line `lineBoxes` block; a drop cap is one glyph).
    if (layout.body.dropCap) {
      const dropCap = layout.body.dropCap;
      const printableDropCapText = sanitizeCanvasText(dropCap.text);
      if (printableDropCapText) {
        applyPrintTextStyle(context, dropCap.style);
        context.textAlign = "left";
        const inkShiftY = getDisplayInkShiftY(printableDropCapText, dropCap.style);
        fillCanvasText(
          context,
          printableDropCapText,
          story.x + dropCap.x,
          story.y + dropCap.y + inkShiftY,
        );
      }
    }

    for (const column of layout.body.columns) {
      for (const line of column.lines) {
        if (line.segments?.length) {
          const segmentStart = line.segments[0]?.x ?? line.x;
          const segmentEnd = line.segments.reduce(
            (end, segment) => Math.max(end, segment.x + segment.width),
            segmentStart,
          );
          const segmentGapCount = Math.max(0, line.segments.length - 1);
          const extraGap = line.justify && segmentGapCount > 0
            ? Math.max(0, line.width - (segmentEnd - segmentStart)) / segmentGapCount
            : 0;

          for (const [segmentIndex, segment] of line.segments.entries()) {
            const segmentText = segment.text.trim();
            if (segment.role === "byline-dot" || segmentText === "\u2022" || /_*BYLINE[\s_-]*DOT_*/i.test(segmentText)) {
              drawCanvasBylineDot(
                context,
                story.x + segment.x + extraGap * segmentIndex,
                story.y + segment.y,
                segment.width,
                segment.height,
                segment.style.fill,
                segment.style.fontSize,
              );
              continue;
            }
            const printableText = sanitizeCanvasText(segment.text);
            if (!printableText) {
              continue;
            }
            applyPrintTextStyle(context, segment.style);
            context.textAlign = "left";
            context.fillText(printableText, story.x + segment.x + extraGap * segmentIndex, story.y + segment.y);
          }
        } else if (line.style.align === "justify" && line.justify) {
          const words = sanitizeCanvasText(line.text).split(/\s+/u).filter(Boolean);
          // Measured and drawn with the line's own tracking, matching the
          // width the composer wrapped to — see the same fix in ArticleBox's
          // drawBodyLine. Without it a negatively-tracked body measures wider
          // here than the composer budgeted and the words print touching.
          context.save();
          const applyJustifiedStyle = () => {
            applyPrintTextStyle(context, line.style);
            if (line.style.letterSpacing) {
              (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
                `${line.style.letterSpacing}px`;
            }
          };
          const wordWidths = words.map((word) => {
            applyJustifiedStyle();
            return context.measureText(word).width;
          });
          const totalWordWidth = wordWidths.reduce((sum, width) => sum + width, 0);
          // Bound the line, not just the gap -- see the matching comment in
          // ArticleBox.tsx's justify branch. Without this the cursor walks past
          // line.width and the last word prints across the gutter. Here the
          // words are drawn at absolute page coordinates, so condensing needs a
          // translate to the line's own origin before the scale; the cursor
          // then runs from 0 inside that transform.
          const lineScaleX =
            totalWordWidth > line.width && totalWordWidth > 0 ? line.width / totalWordWidth : 1;
          const justifyWidth = lineScaleX < 1 ? totalWordWidth : line.width;
          const gap =
            words.length > 1 ? Math.max(0, (justifyWidth - totalWordWidth) / (words.length - 1)) : 0;
          const lineOriginX = story.x + line.x;
          if (lineScaleX < 1) {
            context.translate(lineOriginX, 0);
            context.scale(lineScaleX, 1);
          }
          let cursor = lineScaleX < 1 ? 0 : lineOriginX;

          words.forEach((word, index) => {
            applyJustifiedStyle();
            context.fillText(word, cursor, story.y + line.y);
            cursor += wordWidths[index] + gap;
          });
          context.restore();
        } else {
          const printableText = sanitizeCanvasText(line.text);
          if (!printableText) {
            continue;
          }
          applyPrintTextStyle(context, line.style);
          // The justified branch above bounds its line; this one has to as
          // well. A line that is not justified (the last of a paragraph under
          // justify-except-last, or a single-word line) took this path and was
          // drawn with no width bound at all, so any measure-vs-draw overshoot
          // still printed across the gutter -- which is why clamping only the
          // justified branch reduced the problem without ending it.
          const printableWidth = context.measureText(printableText).width;
          if (line.width > 0 && printableWidth > line.width) {
            context.save();
            context.translate(story.x + line.x, 0);
            context.scale(line.width / printableWidth, 1);
            context.fillText(printableText, 0, story.y + line.y);
            context.restore();
          } else {
            context.fillText(printableText, story.x + line.x, story.y + line.y);
          }
        }
      }
    }

    if (layout.caption) {
      context.save();
      // Clip to caption container bounds so text never overflows the caption box
      context.beginPath();
      context.rect(story.x + layout.caption.x, story.y + layout.caption.y, layout.caption.width, layout.caption.height);
      context.clip();

      const capStrokeWidth = layout.caption.strokeWidth ?? 0;
      if (layout.caption.fill || capStrokeWidth > 0) {
        if (layout.caption.fill) {
          context.fillStyle = layout.caption.fill;
          context.fillRect(story.x + layout.caption.x, story.y + layout.caption.y, layout.caption.width, layout.caption.height);
        }
        if (layout.caption.stroke && capStrokeWidth > 0) {
          context.strokeStyle = layout.caption.stroke;
          context.lineWidth = capStrokeWidth;
          context.strokeRect(story.x + layout.caption.x, story.y + layout.caption.y, layout.caption.width, layout.caption.height);
        }
      }
      drawTextBlockToCanvas(context, layout.caption.textBlock, story.x, story.y);
      drawTextBlockToCanvas(context, layout.caption.creditBlock, story.x, story.y);
      drawTextBlockToCanvas(context, layout.caption.sourceBlock, story.x, story.y);
      context.restore();
    }

    if (layout.factBox) {
      context.save();
      if (layout.factBox.fill) {
        context.fillStyle = layout.factBox.fill;
        context.fillRect(
          story.x + layout.factBox.x,
          story.y + layout.factBox.y,
          layout.factBox.width,
          layout.factBox.height,
        );
      }
      if (layout.factBox.stroke && layout.factBox.strokeWidth > 0) {
        context.strokeStyle = layout.factBox.stroke;
        context.lineWidth = layout.factBox.strokeWidth;
        context.strokeRect(
          story.x + layout.factBox.x,
          story.y + layout.factBox.y,
          layout.factBox.width,
          layout.factBox.height,
        );
      }
      context.restore();
      drawTextBlockToCanvas(context, layout.factBox.headline, story.x, story.y);
      for (const bulletBlock of layout.factBox.bullets) {
        drawTextBlockToCanvas(context, bulletBlock, story.x, story.y);
      }
    }

    if (layout.pullQuote) {
      context.save();
      if (layout.pullQuote.fill) {
        context.fillStyle = layout.pullQuote.fill;
        context.fillRect(
          story.x + layout.pullQuote.x,
          story.y + layout.pullQuote.y,
          layout.pullQuote.width,
          layout.pullQuote.height,
        );
      }
      if (layout.pullQuote.stroke && layout.pullQuote.strokeWidth > 0) {
        context.strokeStyle = layout.pullQuote.stroke;
        context.lineWidth = layout.pullQuote.strokeWidth;
        context.strokeRect(
          story.x + layout.pullQuote.x,
          story.y + layout.pullQuote.y,
          layout.pullQuote.width,
          layout.pullQuote.height,
        );
      }
      context.restore();
      drawTextBlockToCanvas(context, layout.pullQuote.textBlock, story.x, story.y);
    }

    if (layout.decorativeDividers?.length) {
      context.save();
      const captionTextTop = layout.caption?.textBlock.lineBoxes.reduce(
        (top, line) => Math.min(top, line.y),
        layout.caption.textBlock.y,
      );
      const captionTextBottom = layout.caption?.textBlock.lineBoxes.reduce(
        (bottom, line) => Math.max(bottom, line.y + line.height),
        layout.caption.textBlock.y,
      );
      for (const divider of layout.decorativeDividers) {
        if (
          layout.caption &&
          captionTextTop !== undefined &&
          captionTextBottom !== undefined &&
          divider.x < layout.caption.x + layout.caption.width &&
          divider.x + divider.width > layout.caption.x &&
          divider.y >= captionTextTop - 1 &&
          divider.y <= captionTextBottom + 1
        ) {
          continue;
        }
        context.strokeStyle = divider.color;
        context.lineWidth = divider.strokeWidth;
        context.setLineDash(divider.style === "solid" ? [] : [divider.dotSize, divider.dotSpacing]);
        context.beginPath();
        context.moveTo(story.x + divider.x, story.y + divider.y);
        context.lineTo(story.x + divider.x + divider.width, story.y + divider.y);
        context.stroke();
      }
      context.setLineDash([]);
      context.restore();
    }
  };
  const renderDocumentPageToDataUrl = async (
    page: NewspaperPageObject,
    pageStoryLayouts: IncrementalStoryLayout[],
    // Print export needs true 300dpi; an on-screen preview doesn't — passing
    // a lower dpi here draws through this exact same code, just onto a
    // smaller canvas, so the preview stays fast without being a different
    // rendering path from the PDF.
    dpi = 300,
    // Batch mode's per-page photo snapshot (batchPageImageSourcesRef) —
    // undefined outside batch mode, where imageSourcesByStoryId is already
    // correctly scoped to the one page being rendered.
    imageSourceOverrides?: Record<string, string>,
  ) => {
    // English-language stories (see composeArticleBox.ts's contentLanguage
    // check) compose with Tinos, but canvas text -- unlike DOM text -- never
    // triggers @font-face loading on its own. waitForNewspaperFonts() fires
    // a best-effort Tinos load at app mount, but nothing downstream of that
    // actually blocks on it before this function starts drawing, so a page
    // rendered soon enough after mount could still measure/draw some lines
    // before the font file finishes loading and silently fall back for
    // just those lines. Awaiting it here, right before the canvas exists,
    // removes that race outright.
    if (typeof window.document !== "undefined" && window.document.fonts?.load) {
      await Promise.all([
        window.document.fonts.load(`400 16px "Tinos"`).catch(() => undefined),
        window.document.fonts.load(`700 16px "Tinos"`).catch(() => undefined),
      ]);
    }

    const pageWidth = (page.masterPage.width ?? DEFAULT_PAGE_MASTER.width) * 72;
    const pageHeight = (page.masterPage.height ?? DEFAULT_PAGE_MASTER.height) * 72;
    const canvas = window.document.createElement("canvas");
    const scale = dpi / 72;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to create print canvas.");
    }

    canvas.width = Math.round(pageWidth * scale);
    canvas.height = Math.round(pageHeight * scale);
    context.save();
    context.scale(scale, scale);
    context.fillStyle = "#fffef9";
    context.fillRect(0, 0, pageWidth, pageHeight);

    // Publisher-exclusive: Youth UPDATE's front page (and its own inside
    // page) get a flat, borderless body style plus a few decorative accents
    // (right-edge rules, hatch dividers) -- every other page/publisher stays
    // false. The layout-shape check guards against a stray page that merely
    // shares the publisher_id but wasn't actually built on either template.
    const youthUpdateFlatStyle =
      isYouthUpdatePortalSession() &&
      (page.pageType === "front"
        ? isYouthUpdateFrontLayoutShape(pageStoryLayouts)
        : Boolean(getYouthUpdateInsideTemplateIdFromLayoutShape(pageStoryLayouts)));

    if (!youthUpdateFlatStyle) {
      await drawResolvedHeaderToCanvas(context, page, pageWidth);
    }

    context.save();
    context.strokeStyle = separatorRule.stroke;
    context.lineWidth = separatorRule.strokeWidth;
    const pageContentWidth = (page.masterPage.contentWidth ?? DEFAULT_PAGE_MASTER.contentWidth) * 72;
    const borderedStoryEdges = getBorderedStoryEdges(pageStoryLayouts);
    let resolvedSeparators = clipEditorialSeparators(getEditorialSeparatorLines(pageStoryLayouts, pageContentWidth), borderedStoryEdges);
    if (youthUpdateFlatStyle) {
      const contentRightEdge =
        (page.masterPage.contentX ?? DEFAULT_PAGE_MASTER.contentX) * 72 + pageContentWidth;
      const blueRules = getYouthUpdateRightDividers(
        pageStoryLayouts
          .filter((item) => page.pageType !== "front" || item.story.templateStoryNumber !== 1)
          .map(({ story }) => story),
        contentRightEdge,
      );
      resolvedSeparators = removeSeparatorsNearYouthUpdateBlueRules(resolvedSeparators, blueRules);
    }
    for (const separator of resolvedSeparators) {
      // Only the vertical rules between side-by-side articles are drawn now
      // (horizontal row rules were removed) — matches the interactive canvas.
      const [x1, y1, x2, y2] = separator.points;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }
    context.restore();

    for (const storyLayout of pageStoryLayouts) {
      // The horoscope prints as a grid of cells, not as flowed prose. Same
      // branch as the on-screen canvas in CanvasRenderLayers, reading the same
      // geometry — the export builds its own canvas, so it has to be drawn
      // twice or the sheet and the screen disagree.
      const { story } = storyLayout;
      const rashifalReadings = parseRashifalReadings(
        richTextToPlainText(story.articleData?.headline ?? ""),
        richTextToPlainText(story.articleData?.body ?? ""),
      );

      if (rashifalReadings) {
        drawRashifalGridToCanvas(context, {
          x: story.x,
          y: story.y,
          width: story.width,
          height: story.height,
          readings: rashifalReadings,
          // Kept in lockstep with CanvasRenderLayers's own RashifalGrid call --
          // see its comment for why Vichar-Manthan asks for 3 and fits.
          columns: story.compositionSettings.editorialTemplateId === "AkhandVicharManthan6A" ? 3 : undefined,
          fitToContent: story.compositionSettings.editorialTemplateId === "AkhandVicharManthan6A",
        });
        continue;
      }

      await drawStoryLayoutToCanvas(context, storyLayout, imageSourceOverrides, youthUpdateFlatStyle);

      if (storyLayout.layout.editorialFloatImage) {
        const floatImageSource = imageSourceOverrides?.[story.id] ?? imageSourcesByStoryId[story.id] ?? "";

        if (floatImageSource) {
          try {
            const floatImage = await loadImageElement(floatImageSource);
            const frame = storyLayout.layout.editorialFloatImage;
            const crop = computeImageCoverCrop({
              sourceWidth: floatImage.naturalWidth || floatImage.width,
              sourceHeight: floatImage.naturalHeight || floatImage.height,
              frameWidth: frame.width,
              frameHeight: frame.height,
              // Matches composeArticleBox.ts's own bias -- keeps the top of
              // the subject from being cut off by a dead-centre crop.
              focalPointY: 0.3,
            });

            context.save();
            context.globalAlpha = frame.opacity ?? 1;
            context.drawImage(
              floatImage,
              crop.sourceX,
              crop.sourceY,
              crop.sourceWidth,
              crop.sourceHeight,
              story.x + frame.x,
              story.y + frame.y,
              frame.width,
              frame.height,
            );
            context.restore();
          } catch {
            const frame = storyLayout.layout.editorialFloatImage;
            context.fillStyle = frame.fill ?? "#F5F0E6";
            context.fillRect(story.x + frame.x, story.y + frame.y, frame.width, frame.height);
          }
        } else {
          const frame = storyLayout.layout.editorialFloatImage;
          context.fillStyle = frame.fill ?? "#F5F0E6";
          context.fillRect(story.x + frame.x, story.y + frame.y, frame.width, frame.height);
        }
      }

      // The editorial writer's rail is drawn over the composed article, the
      // same branch the on-screen canvas takes in CanvasRenderLayers. The
      // export builds its own canvas, so it has to be drawn here as well or the
      // portrait would appear on screen and not on the sheet.
      // The editorial page rules every package. Drawn before the rail so the
      // frame sits under the furniture, matching the on-screen order.
      const editorialBoxRule = resolveEditorialBoxRule(story);

      if (editorialBoxRule) {
        drawEditorialBoxRuleToCanvas(context, editorialBoxRule);
      }

      // Hairlines down the gutters of an inside page's text columns, from the
      // same geometry the on-screen canvas uses.
      drawColumnRulesToCanvas(
        context,
        resolveColumnRules(story, storyLayout.layout.body?.columns),
      );

      const authorBlock = story.compositionSettings.editorialPageStyle
        ? resolveAuthorBlock({
            story: { ...story, storyNumber: story.templateStoryNumber },
            headlineBottom: storyLayout.layout.headline.y + storyLayout.layout.headline.height,
            bodyTop: storyLayout.layout.body?.y,
          })
        : null;

      if (authorBlock) {
        await drawAuthorBlockToCanvas(context, authorBlock);
      }
    }

    // Youth UPDATE's own masthead and hardcoded editorial-rail photo, gated
    // on both this being their real portal session AND the front page
    // specifically — every other publisher's front page, and this same
    // publisher's inside pages, are completely unaffected since the
    // condition is false for both.
    if (
      page.pageType === "front" &&
      getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID &&
      isYouthUpdateFrontLayoutShape(pageStoryLayouts)
    ) {
      const railStoryLayout = pageStoryLayouts.find(
        (storyLayout) => storyLayout.story.templateStoryNumber === 1,
      );
      if (railStoryLayout) {
        // Extended to its right-hand neighbour's left edge so the rail's blue
        // touches that story's border — same reasoning, and the same
        // find-by-position rather than find-by-story-number, as the
        // live-preview overlay (youthUpdateEditorialRailBox).
        const nextStory = pageStoryLayouts
          .map((item) => item.story)
          .filter(
            (story) =>
              story.x > railStoryLayout.story.x &&
              story.y < railStoryLayout.story.y + railStoryLayout.story.height &&
              story.y + story.height > railStoryLayout.story.y,
          )
          .sort((a, b) => a.x - b.x)[0];
        const width = nextStory
          ? Math.max(railStoryLayout.story.width, nextStory.x - railStoryLayout.story.x)
          : railStoryLayout.story.width;
        await drawYouthUpdateEditorialRailToCanvas(context, {
          x: railStoryLayout.story.x,
          y: railStoryLayout.story.y,
          width,
          height: railStoryLayout.story.height,
        });
        context.fillStyle = "#fffef9";
        context.fillRect(
          railStoryLayout.story.x,
          railStoryLayout.story.y + railStoryLayout.story.height - 8,
          width,
          11,
        );
      }
      const shortNewsStoryLayout = pageStoryLayouts.find(
        (storyLayout) => storyLayout.story.templateStoryNumber === 3,
      );
      if (shortNewsStoryLayout) {
        await drawYouthUpdateShortNewsBannerToCanvas(context, {
          x: shortNewsStoryLayout.story.x,
          y: shortNewsStoryLayout.story.y,
          width: shortNewsStoryLayout.story.width,
          height: shortNewsStoryLayout.story.width * (551 / 1600),
        });
      }
      await drawYouthUpdateMastheadToCanvas(context, pageWidth);
    }

    // Youth UPDATE's own inside-page header, teaser strip and "SHORT NEWS"
    // rail -- gated on this being their real portal session AND their
    // inside page specifically, mirroring the front-page block above.
    if (
      page.pageType !== "front" &&
      getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID &&
      getYouthUpdateInsideTemplateIdFromLayoutShape(pageStoryLayouts)
    ) {
      const youthInsideTemplateId = getYouthUpdateInsideTemplateIdFromLayoutShape(pageStoryLayouts);
      const isYouthInsideHeaderOnly = isYouthUpdateHeaderOnlyInsideTemplateId(youthInsideTemplateId);
      const activeHeaderSetId = document.headerSystem.activeHeaderSetId;
      const profileId = activeHeaderSetId
        ? document.headerSystem.headerSets[activeHeaderSetId]?.publicationProfileId
        : null;
      const profile = profileId ? document.headerSystem.publicationProfiles[profileId] : null;
      const now = new Date();
      await drawYouthUpdateInsideHeaderToCanvas(context, {
        pageWidth,
        city: profile?.city || "BHOPAL",
        sectionName: page.sectionName || "Normal Page",
        dateLabel: now
          .toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
          .toUpperCase(),
        pageNumber: page.pageNumber ?? 1,
      });
      if (!isYouthInsideHeaderOnly) {
        await loadYouthUpdateInsideAuthorsFromPortal({
          apiBase: getPortalLaunchParam("apiBase") || "http://localhost:8080/api/v1",
          authToken: getPortalLaunchParam("authToken") || "",
          publisherId: getPortalLaunchParam("publisherId") || "",
        });
        const teaserSlots = getYouthUpdateTeasersOrFallback();
        const liveTeaserItems = getYouthUpdateInsideTeaserLiveItems();
        const { headlines, labels, imageUrls } = mergeYouthUpdateInsideTeaserCards(teaserSlots, liveTeaserItems);
        await drawYouthUpdateInsideTeaserStripToCanvas(context, {
          pageWidth,
          headlines,
          labels,
          imageUrls,
          author: getYouthUpdateInsideAuthorOrFallback(page.pageNumber ?? 1),
        });
      }

      const leadLayout = pageStoryLayouts.find((item) => item.story.templateStoryNumber === 1);
      const secondaryBLayout = pageStoryLayouts.find((item) => item.story.templateStoryNumber === 3);
      if (!isYouthInsideHeaderOnly && leadLayout && secondaryBLayout) {
        const contentX = (page.masterPage.contentX ?? DEFAULT_PAGE_MASTER.contentX) * 72;
        await drawYouthUpdateInsideRailToCanvas(context, {
          x: contentX,
          y: leadLayout.story.y,
          width: Math.max(0, leadLayout.story.x - contentX),
          height: secondaryBLayout.story.y + secondaryBLayout.story.height - leadLayout.story.y,
          items: getYouthUpdateInsideRailItems(),
        });
      }
    }

    // Youth UPDATE: right-edge rule after every box (skipped at the paper's
    // own right edge) and a low hatched rule after each of this template's
    // own row groups -- front and inside pages use different row/story
    // groupings (see the matching Konva memos in EditorCanvas.tsx's render
    // function above), so this branches on page kind.
    if (youthUpdateFlatStyle) {
      const isFront = page.pageType === "front";
      const contentRightEdge =
        (page.masterPage.contentX ?? DEFAULT_PAGE_MASTER.contentX) * 72 + pageContentWidth;
      const rightDividers = getYouthUpdateRightDividers(
        pageStoryLayouts
          .filter((item) => !isFront || item.story.templateStoryNumber !== 1)
          .map(({ story }) => story),
        contentRightEdge,
      );
      context.strokeStyle = YOUTH_UPDATE_COLORS.bodyDivider;
      context.lineWidth = 1;
      for (const divider of rightDividers) {
        context.beginPath();
        context.moveTo(divider.x, divider.y);
        context.lineTo(divider.x, divider.y + divider.height);
        context.stroke();
      }

      const rowBottom = (storyNumbers: number[]) =>
        Math.max(
          0,
          ...pageStoryLayouts
            .filter((item) => storyNumbers.includes(item.story.templateStoryNumber ?? -1))
            .map((item) => item.story.y + item.story.height),
        );
      // Front pages: the two bands are measured off the rails alone (stories 1
      // and 3), which sit in the same band on every one of this publisher's
      // front-page designs while the stories beside them are numbered
      // differently from design to design. Inside pages keep their own groups.
      const dividerRowGroups = isFront ? [[1], [3]] : [[1, 2, 3], [4, 5, 6]];
      context.fillStyle = YOUTH_UPDATE_COLORS.bodyDivider;
      for (const group of dividerRowGroups) {
        const centerY = rowBottom(group);
        if (centerY <= 0) continue;
        const ticks = removeYouthUpdateHatchTicksNearKickers(
          getYouthUpdateHatchDividerTicks(
            (page.masterPage.contentX ?? DEFAULT_PAGE_MASTER.contentX) * 72,
            pageContentWidth,
            centerY,
            4,
            4,
          ),
          pageStoryLayouts,
          isFront
            ? // Both rails, same reasoning as the live-preview memo: story 1 is
              // the editorial rail and story 3 the SHORT NEWS box, and a band
              // rule crossing either reads as a stray line through a box.
              pageStoryLayouts
                .filter((item) => item.story.templateStoryNumber === 1 || item.story.templateStoryNumber === 3)
                .map(({ story }) => ({ x: story.x, y: story.y, width: story.width, height: story.height }))
            : [],
        );
        for (const tick of ticks) {
          context.fillRect(tick.x, tick.y1, 1.4, tick.y2 - tick.y1);
        }
      }
    }

    // Press colour control strip, drawn last so it sits over the empty band
    // below the content box. This export builds its own canvas rather than
    // rasterising the Konva layer tree, so the strip has to be drawn here as
    // well as in PressColourBar — both read the same geometry module so the
    // printed sheet and the on-screen page cannot disagree.
    drawPressColourBarToCanvas(context, page, pageWidth, pageHeight);

    context.restore();

    return {
      dataUrl: canvas.toDataURL("image/png"),
      pageHeight,
      pageWidth,
    };
  };
  /**
   * Render a single page into a fresh PDFDocument (used by both full-edition
   * export and per-page export). Kept as a helper so both entry points share
   * exactly the same rendering path.
   *
   * Returns { added: true } on success; { added: false, error } when the
   * page failed to render — the caller decides whether to abort the whole
   * export or continue with remaining pages.
   */
  async function addPageToPdf(
    pdfDoc: import("pdf-lib").PDFDocument,
    pageModel: (typeof document.pages)[number],
    exportCompositionCache: StoryCompositionCache,
  ): Promise<{ added: true } | { added: false; error: Error }> {
    try {
      // In batch mode, importNewswireStories names every page's story frames
      // "story-1", "story-2", ... restarting at 1 per page, and
      // document.stories is one flat map shared by the whole document — so a
      // later page's import can silently overwrite an earlier page's entries
      // under the same keys. batchPageStoriesSnapshotRef (populated by the
      // batch importing-phase effect, empty outside batch mode) captures each
      // page's own stories right after its own import, before that can
      // happen; consult it first so the exported PDF matches what the
      // on-screen batch thumbnails already show, and matches exporting the
      // same page individually.
      const pageStories =
        batchPageStoriesSnapshotRef.current.get(pageModel.id) ??
        (pageModel.id === activePageId
          ? stories
          : loadStoriesForPage(document, pageModel.id));
      const pageStoryLayouts = composeStoriesIncrementally({
        stories: pageStories,
        productionView: true,
        cache: exportCompositionCache,
      }).storyLayouts.filter(({ story }) => !story.hidden);
      const { dataUrl, pageHeight, pageWidth } = await renderDocumentPageToDataUrl(
        pageModel,
        pageStoryLayouts,
        300,
        batchPageImageSourcesRef.current.get(pageModel.id),
      );
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const pageImage = await pdfDoc.embedPng(await dataUrlToArrayBuffer(dataUrl));
      page.drawImage(pageImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      return { added: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Log per-page failure explicitly so it's visible in the console and
      // the workspace history, rather than being swallowed inside the loop.
      console.error(`[PDF export] Failed to render page ${pageModel.id}:`, error);
      return { added: false, error };
    }
  }

  async function exportDocumentPdf(filename: string, onProgress?: (completed: number, total: number) => void) {
    const pdfDoc = await PDFDocument.create();
    const exportCompositionCache: StoryCompositionCache = new Map();
    const pages = document.pages.length > 0 ? document.pages : activePage ? [activePage] : [];

    if (pages.length === 0) {
      throw new Error("No pages are available to export.");
    }

    const failedPages: { pageId: string; error: Error }[] = [];

    for (let index = 0; index < pages.length; index += 1) {
      const pageModel = pages[index];
      const result = await addPageToPdf(pdfDoc, pageModel, exportCompositionCache);
      if (!result.added) {
        failedPages.push({ pageId: pageModel.id, error: result.error });
      }
      onProgress?.(index + 1, pages.length);
    }

    // If EVERY page failed there is nothing to save — surface the error.
    if (pdfDoc.getPageCount() === 0) {
      throw new Error(
        `PDF export failed on all ${pages.length} page(s). First error: ${failedPages[0]?.error.message ?? "unknown"}`,
      );
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    downloadBytes(pdfBytes, filename, "application/pdf");

    // Surface partial failures so the user knows some pages didn't make it,
    // rather than silently exporting a truncated PDF.
    if (failedPages.length > 0) {
      const message = `PDF exported with ${failedPages.length} of ${pages.length} page(s) failed. See console for details.`;
      setWorkspaceHistory((current) => [message, ...current].slice(0, 24));
      window.alert(message);
    }
  }

  async function exportCurrentPagePdf() {
    setWorkspaceHistory((current) => [`Export PDF started for ${document.pages.length || 1} page(s)`, ...current].slice(0, 24));

    try {
      const filename = `${getSafeFilenamePart(document.metadata.newspaperName)}-edition.pdf`;

      await exportDocumentPdf(filename);
      setWorkspaceHistory((current) => [`Exported PDF ${filename}`, ...current].slice(0, 24));
    } catch (error) {
      console.error("Export PDF failed", error);
      window.alert(`Export PDF failed: ${error instanceof Error ? error.message : "unknown error"}`);
      setWorkspaceHistory((current) => [
        `Export PDF failed: ${error instanceof Error ? error.message : "unknown error"}`,
        ...current,
      ].slice(0, 24));
    }
  }

  /**
   * Export a single page (by id, defaults to the currently active page) as a
   * standalone PDF. Requested in the plan under Phase 5 — users want to grab
   * one page without downloading the whole edition.
   */
  async function exportSinglePagePdf(pageId?: string) {
    const targetId = pageId ?? activePageId;
    const pageModel = document.pages.find((p) => p.id === targetId) ?? activePage;
    if (!pageModel) {
      window.alert("No page to export.");
      return;
    }
    const pageIndex = document.pages.findIndex((p) => p.id === pageModel.id);
    const filenamePageNumber = pageModel.pageNumber || (pageIndex >= 0 ? pageIndex + 1 : 1);
    const portalPlanForPage = portalPagePlan.find((page) => page.page_number === filenamePageNumber);
    const filename = `${getSafeFilenamePart(document.metadata.newspaperName)}-page-${filenamePageNumber}.pdf`;
    setWorkspaceHistory((current) => [`Export page PDF started (${filename})`, ...current].slice(0, 24));
    try {
      const pdfDoc = await PDFDocument.create();
      const result = await addPageToPdf(pdfDoc, pageModel, new Map());
      if (!result.added) {
        throw result.error;
      }
      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await chargeSinglePageAfterRender(
        filenamePageNumber,
        portalPlanForPage?.section || pageModel.sectionName || `Page ${filenamePageNumber}`,
      );
      downloadBytes(pdfBytes, filename, "application/pdf");
      setWorkspaceHistory((current) => [`Exported ${filename}`, ...current].slice(0, 24));
    } catch (error) {
      console.error("Export page PDF failed", error);
      window.alert(`Export page failed. पैसा नहीं कटा है, कृपया Try Again करें: ${error instanceof Error ? error.message : "unknown error"}`);
      setWorkspaceHistory((current) => [
        `Export page failed, no charge: ${error instanceof Error ? error.message : "unknown error"}`,
        ...current,
      ].slice(0, 24));
    }
  }

  // ── Portal batch mode ────────────────────────────────────────────────────
  // Two phases, each its own effect, on purpose: importNewswireStories is a
  // synchronous store write, but renderDocumentPageToDataUrl below is a
  // closure over this render's `document` — calling it in the same tick as
  // the import (before React has re-rendered with the fresh document) would
  // silently render the PREVIOUS page's content one step behind. Splitting
  // "import everything" (phase 1, pure store writes, no closures involved)
  // from "render everything" (phase 2, started only once phase 1's state
  // transition guarantees a fresh render already happened) avoids that class
  // of bug by construction rather than by careful ordering.
  async function handlePublisherDownloadPdf() {
    if (pdfExporting) {
      return;
    }

    setPdfExporting(true);
    try {
      if (getPortalLaunchParam("mode") === "single") {
        await exportSinglePagePdf(activePageId);
      } else {
        await exportCurrentPagePdf();
      }
    } finally {
      setPdfExporting(false);
    }
  }

  const openNextPagePicker = useCallback(() => {
    setNextPagePickerOpen(true);
  }, []);

  const openWizardForPortalPage = useCallback(
    (pagePlan: PortalPagePlan) => {
      const tab = getWizardTabForPortalPage(pagePlan);

      if (getPortalLaunchParam("mode") === "single") {
        const nextPageType = tab === "front" ? "front" : "city";
        const nextSectionName =
          tab === "front"
            ? "Front Page"
            : tab === "advertisement"
              ? pagePlan.section || "Advertisement Page"
              : pagePlan.section || pagePlan.category || "Normal Page";

        useEditorStore.setState((state) => ({
          pageType: nextPageType,
          document: {
            ...state.document,
            pages: state.document.pages.map((page) =>
              page.id === state.activePageId
                ? {
                    ...page,
                    pageNumber: pagePlan.page_number,
                    pageType: nextPageType,
                    sectionName: nextSectionName,
                    updatedAt: new Date().toISOString(),
                  }
                : page,
            ),
          },
        }));
      } else {
        selectPageByNumber(pagePlan.page_number);
      }

      setWizardPreferredTab(tab);
      setNextPagePickerOpen(false);
      setWizardOpen(true);
      setWorkspaceHistory((current) => [
        `Open Layout Wizard for page ${pagePlan.page_number}`,
        ...current,
      ].slice(0, 24));
    },
    [selectPageByNumber, setWorkspaceHistory],
  );

  const isBatchMode = getPortalLaunchParam("mode") === "batch";
  const [batchPhase, setBatchPhase] = useState<
    { kind: "importing" } | { kind: "rendering"; index: number } | { kind: "done" } | null
  >(null);
  const batchCompositionCacheRef = useRef<StoryCompositionCache>(new Map());
  const batchUsedFallbackRef = useRef<Map<string, boolean>>(new Map());
  // importNewswireStories names each page's story frames "story-1", "story-2",
  // ... restarting from 1 every call — fine for the single-active-page world
  // this was built for, but in batch mode every page shares one document, so
  // page 2's "story-1" silently overwrites page 1's "story-1" in the flat
  // document.stories map once page 2 imports. Snapshotting each page's own
  // stories immediately after ITS import (before any later page can clobber
  // the shared map) and rendering from that snapshot sidesteps the collision
  // entirely, without touching the shared ID-generation/composition code that
  // every other (non-batch) flow also depends on.
  const batchPageStoriesSnapshotRef = useRef<Map<string, typeof stories>>(new Map());
  // The same collision hits photo references too, but StoryFrame (what the
  // line above snapshots) never carries the photo asset id at all — only
  // NewspaperStoryObject (document.stories[id]) does; the frame-conversion
  // step (createStoryFrameFromDocumentPlacement) reads it just long enough to
  // pull the asset's width/height and then drops it. So the render path has
  // always re-resolved images via document.stories[story.id]?.photo — fine
  // for a single active page, wrong for every other page once a later page's
  // import has overwritten that entry. This snapshot captures each page's
  // resolved image URLs (not just asset ids, so no second document.assets
  // lookup is needed later) right after that page's own import, the same
  // moment batchPageStoriesSnapshotRef captures its stories.
  const batchPageImageSourcesRef = useRef<Map<string, Record<string, string>>>(new Map());
  // Scoped to one batch run — reset at the start of each "importing" phase.
  const batchUsedTemplateIdsRef = useRef<Set<TemplateId>>(new Set());
  const batchUsedArticleIdsRef = useRef<Set<string>>(new Set());
  // Same-story-different-id can happen when the live upstream files one
  // real-world item under more than one category — id-only dedup misses
  // that, so headline is tracked alongside it (see dedupeAndFill).
  const batchUsedHeadlinesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isBatchMode || batchPhase !== null) {
      return;
    }

    const expectedPageCount = Math.max(1, Math.min(64, Number(getPortalLaunchParam("pageCount")) || 1));

    // document always starts with 1 page — wait for PortalLaunchBootstrap's
    // own effect to finish resizing to the real count before starting, so
    // this never races a sibling component's setup.
    if (document.pages.length !== expectedPageCount) {
      return;
    }

    batchUsedTemplateIdsRef.current = new Set();
    batchUsedArticleIdsRef.current = new Set();
    batchUsedHeadlinesRef.current = new Set();
    setBatchPhase({ kind: "importing" });
  }, [isBatchMode, batchPhase, document.pages.length]);

  useEffect(() => {
    if (batchPhase?.kind !== "importing") {
      return;
    }

    let cancelled = false;
    const plannedPages = parseBatchPlannedPages(getPortalLaunchParam("pageSections"));
    const languageMode: PageLanguageMode = "hindi";
    const preset = NEWSWIRE_SUBHEADING_PRESETS[0];

    (async () => {
      const initialPages = useEditorStore.getState().document.pages;
      const portalOrigin = getPortalOrigin();
      // Persisted server-side (portal backend increments this once per
      // "generate all pages" click) so consecutive editions never repeat the
      // same front-page design. Defaults to 0 for launches without it
      // (outside the portal, or an older portal build).
      const frontTemplateIndex = Number(getPortalLaunchParam("frontTemplateIndex")) || 0;

      // Seed this run's in-memory dedup (batchUsedArticleIdsRef/-Headlines)
      // from the portal's persisted per-issue ledger before any page is
      // fetched -- without this, batch mode's dedup only ever knew about
      // articles used earlier in this SAME run, so a page regenerated later
      // via the single-page wizard (which does read/write this same ledger,
      // see readPortalIssueArticleSession) could still repeat whatever a
      // batch run had already used, and vice versa. pageNumber=1 here is
      // just a placeholder to satisfy buildPortalIssueArticleSession's
      // validation -- loadFullIssueUsedArticles ignores it and always asks
      // for the whole issue's ledger (exclude_page_number=0, no real page).
      const issueSessionBase = buildPortalIssueArticleSession(1, "batch-seed");
      if (issueSessionBase) {
        const fullLedger = await loadFullIssueUsedArticles(issueSessionBase);
        fullLedger.articleIds.forEach((id) => batchUsedArticleIdsRef.current.add(id));
        fullLedger.normalizedHeadlines.forEach((headline) => batchUsedHeadlinesRef.current.add(headline));
      }

      const buildOptions = (templateId: TemplateId, pageKind: NewswireImportOptions["pageKind"]): NewswireImportOptions => ({
        templateId,
        pageKind,
        languageMode,
        bylineName: "",
        colouredHeadings: false,
        tintedStoryBackground: true,
        tintColor: getPaletteTintColor(preset),
        inlineColumnSubheadings: true,
        inlineSubheadingColor: getPaletteInlineAccent(preset),
        palettePreset: preset,
        subheadingStyle: getPaletteSubheadingStyle(preset, 1),
        bodyAlignment: "justify",
        professionalJustification: true,
        editorialAuthorDefaults: pageKind === "editorial"
          ? usePublisherEditorialAuthorStore.getState().defaults
          : null,
        editorialAuthorSelections: pageKind === "editorial"
          ? usePublisherEditorialAuthorStore.getState().selectedAuthors
          : undefined,
      });

      for (let index = 0; index < initialPages.length; index += 1) {
        if (cancelled) {
          return;
        }

        const pageModel = useEditorStore.getState().document.pages[index];
        const planned = plannedPages.find((item) => item.page_number === index + 1);
        const isFront = pageModel.pageType === "front";
        const isEditorial = isEditorialPlannedPage(planned);
        // planned.category is an explicit publisher choice, read directly
        // when it's a real NEWSWIRE_CATEGORY value -- this is the direct
        // read path the portal's profile page-plan editor writes into, and
        // it generalizes to any publisher's own page count/order/section
        // names, not just this one's 8-page layout. Validated rather than
        // cast blindly: the portal's own category list drifted from this
        // one until 2026-08-16 ("Madhyapradesh" vs "Madhya Pradesh",
        // "National/State" vs "National", plus "Science"/"Technology" which
        // don't exist here at all), so an existing profile can still carry
        // a stale value that isn't one of these seven strings. When it's
        // missing or invalid, infer from the section label ("Sports" ->
        // Sports news, etc.).
        //
        // Front pages never use a single category, regardless of what's
        // set here or what the section infers to -- a real front page mixes
        // categories (national/state lead, a supporting international
        // story, a touch of sports/business), the same rule the manual
        // wizard's front-page flow already follows (see
        // FRONT_PAGE_CATEGORY_WEIGHTS in newswireCategoryMix.ts). A page
        // whose section matches no known category (Classifieds, or any
        // future publisher's section label this repo has never seen) gets
        // an even cross-category mix rather than silently defaulting to one
        // category that may have nothing to do with the page.
        // A publisher can now pick more than one category for a page from
        // the portal's Settings page (e.g. Sports + Business on one page,
        // since a longer edition has more pages than the 7 base categories)
        // — that arrives here as plannedPages[].categories. Two or more
        // valid entries means "mix just these", handled by its own branch
        // below rather than falling through to specificCategory (a single
        // category) or the all-7-category Mixed fallback.
        const plannedCategoriesRaw = planned?.categories ?? [];
        const explicitCategories: NewswireCategory[] = isFront
          ? []
          : plannedCategoriesRaw.filter(isNewswireCategory);

        const plannedCategory = planned?.category;
        const specificCategory: NewswireCategory | null = isFront || explicitCategories.length > 1
          ? null
          : explicitCategories[0]
            || (plannedCategory && isNewswireCategory(plannedCategory) ? plannedCategory : null)
            || inferCategoryFromSection(planned?.section ?? "");
        const categoryLabel = explicitCategories.length > 1 ? explicitCategories.join(" + ") : specificCategory ?? "Mixed";

        useEditorStore.getState().setActivePage(pageModel.id);

        let imported = false;
        let lastError: unknown = null;
        let usedFallback = false;

        if (isEditorial) {
          // The editorial page has its own purpose-built content model
          // (राशिफल + desk copy, slotted by box width) rather than the
          // regular newswire/manual-article path — manual content for this
          // page kind is overlaid straight onto matching slot positions
          // instead of merged into a pool, the same "decided per slot, not
          // ranked" rule the desk feed itself already follows. Slots 0/1
          // (array index == storyNumber-1) are सम्पादकीय / विचार मंथन, the two
          // portrait+name rails — see fetchManualEditorialEntriesForPage.
          try {
            const [manualEditorialEntries, editorialStories] = await Promise.all([
              fetchManualEditorialEntriesForPage(index + 1),
              fetchEditorialStoriesForPage(batchUsedArticleIdsRef.current),
            ]);
            if (cancelled) {
              return;
            }
            const mergedEditorialStories = editorialStories.map(
              (story, slotIndex) => manualEditorialEntries[slotIndex] ?? story,
            );
            useEditorStore
              .getState()
              .importNewswireStories("Editorial", mergedEditorialStories, buildOptions(EDITORIAL_TEMPLATE_ID, "editorial"));
            imported = true;
            for (const article of mergedEditorialStories) {
              batchUsedArticleIdsRef.current.add(article.id);
              batchUsedHeadlinesRef.current.add(normalizeHeadlineKey(article.headline));
            }
          } catch (error) {
            lastError = error;
          }
        } else {
          // Youth UPDATE's pages always use their publisher-exclusive
          // templates (see YouthUpdateConfig.ts). Every other publisher keeps
          // the existing front rotation and inside-page picker unchanged.
          const isYouthUpdatePublisher = getPortalLaunchParam("publisherId") === YOUTH_UPDATE_PUBLISHER_ID;
          const templateId: TemplateId = isFront
            ? isYouthUpdatePublisher
              ? YOUTH_UPDATE_FRONT_TEMPLATE_ID
              : BATCH_FRONT_PAGE_TEMPLATE_IDS[frontTemplateIndex % BATCH_FRONT_PAGE_TEMPLATE_IDS.length]
            : isYouthUpdatePublisher
              ? YOUTH_UPDATE_INSIDE_TEMPLATE_IDS[(index - 1) % YOUTH_UPDATE_INSIDE_TEMPLATE_IDS.length]
              : pickInsideTemplateId(batchUsedTemplateIdsRef.current);
          if (!isFront) {
            batchUsedTemplateIdsRef.current.add(templateId);
          }
          const templateStoryCount = TEMPLATE_REGISTRY[templateId]?.storyCount ?? (isFront ? 8 : 6);
          const options = buildOptions(templateId, isFront ? "front" : "inside");

          const manualArticles = await fetchManualArticlesForPage(index + 1, categoryLabel);
          if (cancelled) {
            return;
          }

          // Strict rule: never use the deterministic preloaded pool for a
          // news page — every article here comes from a live category API.
          // Manual articles fill their own guaranteed slots first; the wire
          // feed only needs to cover what's left.
          const remaining = Math.max(0, templateStoryCount - manualArticles.length);

          try {
            let freshLive: NewswireStory[] = [];

            if (remaining > 0) {
              if (explicitCategories.length > 1) {
                // Publisher chose more than one category for this page
                // (e.g. Sports + Business) — an even split across exactly
                // those categories, reusing the same weighted-target/rounding
                // logic the front page and the "no category match" fallback
                // already use, just restricted to this page's own set
                // instead of all seven.
                const evenWeights = Object.fromEntries(
                  explicitCategories.map((category) => [category, 1 / explicitCategories.length]),
                ) as Partial<Record<NewswireCategory, number>>;
                const targets = computeWeightedCategoryTargets(remaining, evenWeights).filter((entry) => entry.target > 0);
                const perCategoryResults = await Promise.all(
                  targets.map(async ({ category: targetCategory, target }): Promise<NewswireStory[]> => {
                    try {
                      return (await fetchLiveNewswireOnce(targetCategory, languageMode, target)) ?? [];
                    } catch {
                      return [];
                    }
                  }),
                );
                if (cancelled) {
                  return;
                }
                freshLive = shuffleNewswireStories(perCategoryResults.flat()).filter(
                  (a) => !isArticleUsed(a, batchUsedArticleIdsRef.current, batchUsedHeadlinesRef.current),
                );
              } else if (specificCategory) {
                // A named category (publisher's own choice, or inferred
                // from the section label): try it first, over-fetched so
                // cross-page dedup below has real headroom to filter from.
                const overfetchLimit = Math.ceil(remaining * 1.5) + 2;
                const primaryLive = await fetchLiveNewswireOnce(specificCategory, languageMode, overfetchLimit);
                if (cancelled) {
                  return;
                }
                freshLive = (primaryLive ?? []).filter(
                  (a) => !isArticleUsed(a, batchUsedArticleIdsRef.current, batchUsedHeadlinesRef.current),
                );
              } else {
                // Front page, or a section with no category match: pull a
                // real cross-category mix instead of one guessed category —
                // weighted editorial priority for the front page, an even
                // split otherwise (see newswireCategoryMix.ts).
                const targets = (isFront ? computeWeightedCategoryTargets(remaining) : computeEvenCategoryTargets(remaining))
                  .filter((entry) => entry.target > 0);
                const perCategoryResults = await Promise.all(
                  targets.map(async ({ category: targetCategory, target }): Promise<NewswireStory[]> => {
                    try {
                      return (await fetchLiveNewswireOnce(targetCategory, languageMode, target)) ?? [];
                    } catch {
                      return [];
                    }
                  }),
                );
                if (cancelled) {
                  return;
                }
                freshLive = shuffleNewswireStories(perCategoryResults.flat()).filter(
                  (a) => !isArticleUsed(a, batchUsedArticleIdsRef.current, batchUsedHeadlinesRef.current),
                );
              }

              // Still short — pull the remainder from whatever categories
              // haven't already been drained on this page. Still entirely
              // live content either way; nothing here ever touches the
              // deterministic preloaded pool.
              if (!specificCategory && freshLive.length < remaining) {
                const stillNeeded = remaining - freshLive.length;
                const mixedIn = await fetchLiveArticlesFromOtherCategories(
                  specificCategory ?? "",
                  languageMode,
                  stillNeeded,
                  new Set([...batchUsedArticleIdsRef.current, ...freshLive.map((a) => a.id)]),
                  new Set([...batchUsedHeadlinesRef.current, ...freshLive.map((a) => normalizeHeadlineKey(a.headline))]),
                );
                if (cancelled) {
                  return;
                }
                freshLive = [...freshLive, ...mixedIn];
              }
            }

            // No padding, no fallback: a page proceeds with however many
            // real live articles were actually found, even if that's fewer
            // than the template's ideal count — a thin page is still real
            // news. Only a genuinely empty page (nothing manual, nothing
            // live anywhere) counts as a failure for this page.
            const wireArticles = freshLive.slice(0, remaining);
            const merged = [...manualArticles, ...wireArticles];
            if (merged.length === 0) {
              throw new Error("No live news articles could be found for this page.");
            }
            useEditorStore.getState().importNewswireStories(categoryLabel, merged, options);
            imported = true;
            usedFallback = false;
            for (const article of merged) {
              batchUsedArticleIdsRef.current.add(article.id);
              batchUsedHeadlinesRef.current.add(normalizeHeadlineKey(article.headline));
            }
            // Persist this page's articles to the portal's per-issue ledger
            // too (not just the in-memory refs above), so a page later
            // regenerated individually via the single-page wizard -- which
            // reads/writes this same ledger -- knows to avoid them, and vice
            // versa (see the ledger seed at the top of this batch run).
            void saveIssueUsedArticles(
              buildPortalIssueArticleSession(index + 1, planned?.section || pageModel.sectionName || `Page ${index + 1}`),
              merged,
            );
          } catch (error) {
            lastError = error;
          }
        }

        // Capture this page's own stories — and, separately, its resolved
        // photo URLs (StoryFrame itself never carries the photo asset id) —
        // immediately after its own import, before the next page's import
        // can overwrite the shared document.stories map under the same
        // "story-1", "story-2", ... keys (see notes on both refs).
        if (imported) {
          const freshState = useEditorStore.getState();
          batchPageStoriesSnapshotRef.current.set(pageModel.id, freshState.stories);
          const imageSources: Record<string, string> = {};
          for (const storyFrame of freshState.stories) {
            const documentStory = freshState.document.stories[storyFrame.id];
            const photoAssetId = documentStory?.photo ?? null;
            const asset = photoAssetId ? freshState.document.assets[photoAssetId] : null;
            const source = asset?.previewUrl || asset?.thumbnailUrl || asset?.source || "";
            if (source) {
              imageSources[storyFrame.id] = getPrintableImageSource(source);
            }
          }
          batchPageImageSourcesRef.current.set(pageModel.id, imageSources);
        }

        batchUsedFallbackRef.current.set(pageModel.id, usedFallback);

        if (!imported && portalOrigin) {
          window.parent.postMessage(
            {
              type: "batch-error",
              pageNumber: index + 1,
              message: lastError instanceof Error ? lastError.message : "Unable to fill this page with news.",
            },
            portalOrigin,
          );
        }
      }

      if (!cancelled) {
        setBatchPhase({ kind: "rendering", index: 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [batchPhase?.kind]);

  useEffect(() => {
    if (batchPhase?.kind !== "rendering") {
      return;
    }

    const pages = document.pages;
    const portalOrigin = getPortalOrigin();

    if (batchPhase.index >= pages.length) {
      if (portalOrigin) {
        window.parent.postMessage({ type: "batch-complete" }, portalOrigin);
      }
      setBatchPhase({ kind: "done" });
      return;
    }

    const pageModel = pages[batchPhase.index];
    const pageNumber = batchPhase.index + 1;
    let cancelled = false;

    (async () => {
      try {
        const pageStories =
          batchPageStoriesSnapshotRef.current.get(pageModel.id) ??
          (pageModel.id === activePageId ? stories : loadStoriesForPage(document, pageModel.id));
        const pageStoryLayouts = composeStoriesIncrementally({
          stories: pageStories,
          productionView: true,
          cache: batchCompositionCacheRef.current,
        }).storyLayouts.filter(({ story }) => !story.hidden);
        const { dataUrl } = await renderDocumentPageToDataUrl(
          pageModel,
          pageStoryLayouts,
          150,
          batchPageImageSourcesRef.current.get(pageModel.id),
        );

        if (cancelled) {
          return;
        }
        if (portalOrigin) {
          window.parent.postMessage(
            {
              type: "page-ready",
              pageNumber,
              thumbnail: dataUrl,
              usedFallback: batchUsedFallbackRef.current.get(pageModel.id) ?? false,
            },
            portalOrigin,
          );
        }
      } catch (error) {
        if (!cancelled && portalOrigin) {
          window.parent.postMessage(
            {
              type: "batch-error",
              pageNumber,
              message: error instanceof Error ? error.message : "Unable to render this page.",
            },
            portalOrigin,
          );
        }
      } finally {
        if (!cancelled) {
          setBatchPhase({ kind: "rendering", index: batchPhase.index + 1 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchPhase, activePageId]);

  useEffect(() => {
    if (!isBatchMode) {
      return;
    }

    const handleParentMessage = (event: MessageEvent) => {
      const portalOrigin = getPortalOrigin();

      if (!portalOrigin || event.origin !== portalOrigin || event.data?.type !== "trigger-download") {
        return;
      }

      void (async () => {
        try {
          const filename = `${getSafeFilenamePart(document.metadata.newspaperName)}-edition.pdf`;
          // Deliberately not exportCurrentPagePdf() — that also redirects
          // back to the portal on success, which would tear down this
          // iframe mid-conversation with its parent window.
          await exportDocumentPdf(filename, (completed, total) => {
            window.parent.postMessage({ type: "download-progress", completed, total }, portalOrigin);
          });
          window.parent.postMessage({ type: "download-complete" }, portalOrigin);
        } catch (error) {
          window.parent.postMessage(
            {
              type: "batch-error",
              pageNumber: 0,
              message: error instanceof Error ? error.message : "Export failed.",
            },
            portalOrigin,
          );
        }
      })();
    };

    window.addEventListener("message", handleParentMessage);

    return () => window.removeEventListener("message", handleParentMessage);
  }, [isBatchMode, document.metadata.newspaperName]);

  const closePagePreview = () => setPagePreview(null);

  /**
   * Renders the active page through the exact same drawing code the PDF
   * export uses (`renderDocumentPageToDataUrl`), just at screen dpi instead
   * of print dpi. Two render paths (this canvas vs the editing canvas) have
   * drifted before — routing the preview through the export's own code is
   * what makes it trustworthy rather than a second guess.
   */
  async function openPagePreview() {
    if (pagePreview?.status === "loading") {
      return;
    }

    setPagePreview({ status: "loading" });

    // Let the loading state actually paint before the heavy synchronous
    // canvas draw below runs — otherwise the state update and the draw land
    // in the same tick and the UI looks frozen instead of working.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    try {
      const pageModel = activePage;

      if (!pageModel) {
        throw new Error("No active page to preview.");
      }

      const pageStoryLayouts = composeStoriesIncrementally({
        stories,
        productionView: true,
        cache: new Map(),
      }).storyLayouts.filter(({ story }) => !story.hidden);

      const { dataUrl, pageWidth, pageHeight } = await renderDocumentPageToDataUrl(
        pageModel,
        pageStoryLayouts,
        150,
      );

      setPagePreview({ status: "ready", dataUrl, pageWidth, pageHeight });
    } catch (error) {
      setPagePreview({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to render preview.",
      });
    }
  }

  const selectedFrame = selectedFrameId ? document.frames[selectedFrameId] : null;
  const selectedFrameLabel = selectedFrame
    ? selectedFrame.frameType === "article"
      ? objectTypeLabels[selectedObjectType] ?? selectedObjectType
      : selectedFrame.frameType
    : "none";
  const activePageFrameCount = activePage?.frameIds.length ?? 0;
  const assetCount = Object.keys(document.assets).length;
  const advertisementCount = Object.keys(document.advertisements).length;
  const oversetCount = storyLayouts.filter(({ layout }) => layout.metrics.overflow).length;
  const missingAssetCount = Object.values(document.assets).filter((asset) => asset.linkStatus && asset.linkStatus !== "ok").length;
  const preflightErrorCount = oversetCount + missingAssetCount;
  const mouseCoordinatesLabel = selectionBounds
    ? `${Math.round(selectionBounds.x)}, ${Math.round(selectionBounds.y)}`
    : "-";
  const inspectorBreadcrumb = useMemo(
    () =>
      [
        document.metadata.newspaperName,
        activePage ? `Page ${activePage.pageNumber}` : null,
        selectedStoryLayout?.story.name ?? selectedStoryId,
        selectedFrame?.metadata.name ?? selectedFrame?.frameType,
      ].filter((item): item is string => Boolean(item)),
    [activePage, document.metadata.newspaperName, selectedFrame, selectedStoryId, selectedStoryLayout],
  );
  const inspectorFrameSummary = useMemo(() => {
    if (!selectedFrame || !selectedStoryLayout) {
      return null;
    }

    return {
      frameLabel: `${objectTypeLabels[selectedObjectType] ?? selectedFrame.frameType} Frame`,
      storyTitle: selectedStoryLayout.story.name ?? selectedStoryLayout.story.id,
      pageNumber: activePage?.pageNumber ?? null,
      layer: selectedFrame.zIndex,
      status: [
        selectedFrame.hidden ? "Hidden" : "Visible",
        selectedFrame.locked ? "Locked" : "Unlocked",
        selectedStoryLayout.layout.metrics.overflow ? "Overflow" : "No Overflow",
      ].join(" / "),
      x: selectedFrame.bounds.x,
      y: selectedFrame.bounds.y,
      width: selectedFrame.bounds.width,
      height: selectedFrame.bounds.height,
    };
  }, [activePage?.pageNumber, selectedFrame, selectedObjectType, selectedStoryLayout]);
  const minorGridLinesX = useMemo(() => buildSequence(NEWSPAPER_PAGE.width, GRID_SIZE), []);
  const minorGridLinesY = useMemo(() => buildSequence(NEWSPAPER_PAGE.height, GRID_SIZE), []);
  const majorGridLinesX = useMemo(
    () => buildSequence(NEWSPAPER_PAGE.width, MAJOR_GRID_INTERVAL),
    [],
  );
  const majorGridLinesY = useMemo(
    () => buildSequence(NEWSPAPER_PAGE.height, MAJOR_GRID_INTERVAL),
    [],
  );

  const contentBounds = useMemo(
    () => {
      const baseY = toPoints(pageSetupDraft.marginTop);
      const baseBottom = toPoints(pageMaster.height - pageSetupDraft.marginBottom);
      const reservedBounds = activePage ? resolveHeaderReservedContentBounds(document, activePage.id) : null;
      const y = Math.max(baseY, reservedBounds?.y ?? baseY);

      return {
        x: toPoints(pageSetupDraft.marginLeft),
        y,
        width: toPoints(Math.max(1, pageMaster.width - pageSetupDraft.marginLeft - pageSetupDraft.marginRight)),
        height: Math.max(1, baseBottom - y),
      };
    },
    [
      activePage,
      document,
      pageSetupDraft.marginBottom,
      pageSetupDraft.marginLeft,
      pageSetupDraft.marginRight,
      pageSetupDraft.marginTop,
    ],
  );
  const columns = useMemo(
    () =>
      createColumnGrid({
        pageWidth: pageMaster.width,
        contentX: pageSetupDraft.marginLeft,
        contentWidth: Math.max(1, pageMaster.width - pageSetupDraft.marginLeft - pageSetupDraft.marginRight),
        columnCount: pageSetupDraft.columns,
        gutter: pageSetupDraft.gutter,
      }).map((column) => ({
        ...column,
        x: toPoints(column.x),
        width: toPoints(column.width),
      })),
    [pageSetupDraft.columns, pageSetupDraft.gutter, pageSetupDraft.marginLeft, pageSetupDraft.marginRight],
  );
  const frameLayoutContext = useMemo(
    () =>
      createFrameLayoutContext({
        pageWidth: NEWSPAPER_PAGE.width,
        pageHeight: NEWSPAPER_PAGE.height,
        contentBounds,
        columns,
        frames: stories.map((story) => ({
          id: story.id,
          x: story.x,
          y: story.y,
          width: story.width,
          height: story.height,
          hidden: story.hidden,
          locked: story.locked,
        })),
        baselineGridSize: baselineSnap ? baselineSpacing : 1,
        snapTolerance: 4,
        allowOutsidePage: false,
        collisionMode: "warn",
      }),
    [baselineSnap, baselineSpacing, columns, contentBounds, stories],
  );
  const editorialSeparatorLines = useMemo(
    () => {
      const borderedStoryEdges = getBorderedStoryEdges(storyLayouts);
      const clipped = clipEditorialSeparators(getEditorialSeparatorLines(storyLayouts, contentBounds.width), borderedStoryEdges);
      if (isYouthUpdateFrontLayout) {
        return removeSeparatorsNearYouthUpdateBlueRules(clipped, youthUpdateRightDividers);
      }
      if (isYouthUpdateInsideLayout) {
        return removeSeparatorsNearYouthUpdateBlueRules(clipped, youthUpdateInsideRightDividers);
      }
      return clipped;
    },
    [
      storyLayouts,
      contentBounds.width,
      isYouthUpdateFrontLayout,
      isYouthUpdateInsideLayout,
      youthUpdateRightDividers,
      youthUpdateInsideRightDividers,
    ],
  );
  const pageDiagnostics = useMemo(
    () =>
      calculatePageLayoutDiagnostics({
        stories,
        imageAreas: storyLayouts.map(({ layout }) =>
          layout.image ? layout.image.width * layout.image.height : 0,
        ),
        contentArea: contentBounds.width * contentBounds.height,
        contentHeight: contentBounds.height,
      }),
    [stories, storyLayouts, contentBounds],
  );
  const dominanceMetrics = useMemo(
    () =>
      calculateStoryDominanceMetrics({
        selectedStoryId,
        stories,
        imageAreas: storyLayouts.map(({ layout }) =>
          layout.image ? layout.image.width * layout.image.height : 0,
        ),
        headlineAreas: storyLayouts.map(({ layout }) => layout.headline.width * layout.headline.height),
        pageArea: NEWSPAPER_PAGE.width * NEWSPAPER_PAGE.height,
        contentArea: contentBounds.width * contentBounds.height,
      }),
    [selectedStoryId, stories, storyLayouts, contentBounds],
  );
  const visibleGuides = useMemo(
    () => customGuides.map((guide) => ({
      ...guide,
      locked: guide.locked || guidesLocked,
      hidden: guide.hidden || guidesHidden,
    })),
    [customGuides, guidesHidden, guidesLocked],
  );
  const measurementLabels = useMemo(() => {
    const selectedStories = stories.filter((story) => selectedStoryIds.includes(story.id));
    const targets = selectedStories.length > 0
      ? selectedStories
      : selectedStoryId
        ? stories.filter((story) => story.id === selectedStoryId)
        : [];

    return targets.map((story) => ({
      id: `measure-${story.id}`,
      x: story.x,
      y: Math.max(0, story.y - 22),
      text: `${formatMeasurement(story.width, rulerUnit)} x ${formatMeasurement(story.height, rulerUnit)}`,
    }));
  }, [rulerUnit, selectedStoryId, selectedStoryIds, stories]);
  const addGuide = useCallback((orientation: EditorGuide["orientation"], position: number) => {
    setCustomGuides((current) => [
      ...current,
      {
        id: `guide-${Date.now().toString(36)}-${current.length}`,
        orientation,
        position: Math.max(0, Math.min(orientation === "vertical" ? NEWSPAPER_PAGE.width : NEWSPAPER_PAGE.height, position)),
        locked: guidesLocked,
        hidden: false,
      },
    ]);
  }, [guidesLocked]);
  const moveGuide = useCallback((guideId: string, position: number) => {
    setCustomGuides((current) =>
      current.map((guide) =>
        guide.id === guideId
          ? {
              ...guide,
              position: snapValue(position),
            }
          : guide,
      ),
    );
  }, []);
  const deleteGuide = useCallback((guideId: string) => {
    setCustomGuides((current) => current.filter((guide) => guide.id !== guideId));
  }, []);
  const separatorRule = useMemo(() => getPageSeparatorRuleStyle(), []);

  const getViewportBounds = useCallback(
    (storyId: string, bounds: EditorSelectionBounds): EditorSelectionBounds | null => {
      const story = stories.find((item) => item.id === storyId);

      if (!story) {
        return null;
      }

      return {
        x: pageOrigin.x + (story.x + bounds.x) * zoom,
        y: pageOrigin.y + (story.y + bounds.y) * zoom,
        width: Math.max(1, bounds.width * zoom),
        height: Math.max(1, bounds.height * zoom),
      };
    },
    [pageOrigin, stories, zoom],
  );

  const selectedViewportBounds = useMemo(() => {
    if (!selectedStoryId || !selectionBounds) {
      return null;
    }

    return getViewportBounds(selectedStoryId, selectionBounds);
  }, [getViewportBounds, selectedStoryId, selectionBounds]);

  const getObjectRichContent = useCallback((storyId: string, objectType: EditorObjectType): RichTextContent | null => {
    const story = stories.find((item) => item.id === storyId);

    if (!story) {
      return null;
    }

    const { articleData } = story;

    if (objectType === "headline" || objectType === "subheadline" || objectType === "body") {
      return articleData[objectType];
    }

    if (objectType === "caption") {
      return articleData.caption.text;
    }

    if (objectType === "credit") {
      return articleData.caption.creditText;
    }

    if (objectType === "pullQuote") {
      return articleData.pullQuote.text;
    }

    if (objectType === "factBoxHeading") {
      return articleData.factBox.headline;
    }

    if (objectType === "kicker" || objectType === "strap") {
      return articleData[objectType].text;
    }

    return null;
  }, [stories]);

  const updateObjectRichContent = useCallback(
    (objectType: EditorObjectType, content: RichTextContent) => {
      const story = selectedStoryLayout?.story;

      if (!story) {
        return;
      }

      if (objectType === "headline" || objectType === "subheadline" || objectType === "body") {
        updateSelectedStoryArticleData(objectType, content);
        return;
      }

      if (objectType === "caption") {
        updateSelectedStoryArticleData("caption", {
          ...story.articleData.caption,
          text: content,
        });
        return;
      }

      if (objectType === "credit") {
        updateSelectedStoryArticleData("caption", {
          ...story.articleData.caption,
          creditText: content,
        });
        return;
      }

      if (objectType === "pullQuote") {
        updateSelectedStoryArticleData("pullQuote", {
          ...story.articleData.pullQuote,
          text: content,
        });
        return;
      }

      if (objectType === "factBoxHeading") {
        updateSelectedStoryArticleData("factBox", {
          ...story.articleData.factBox,
          headline: content,
        });
        return;
      }

      if (objectType === "kicker" || objectType === "strap") {
        updateSelectedStoryArticleData(objectType, {
          ...story.articleData[objectType],
          text: content,
        });
      }
    },
    [selectedStoryLayout, updateSelectedStoryArticleData],
  );

  const applyObjectRichStyle = useCallback(
    (style: RichTextStyle) => {
      if (!selectedStoryId) {
        return;
      }

      const content = getObjectRichContent(selectedStoryId, selectedObjectType);

      if (content === null) {
        return;
      }

      const plainText = richTextToPlainText(content);
      const range = selectedRichTextRange ?? { start: 0, end: plainText.length };
      const nextContent = applyStyleToRange(
        content,
        range.start,
        range.end > range.start ? range.end : plainText.length,
        style,
      );

      updateObjectRichContent(selectedObjectType, nextContent);
    },
    [getObjectRichContent, selectedObjectType, selectedRichTextRange, selectedStoryId, updateObjectRichContent],
  );

  const updateSelectedFrameStyle = useCallback(
    (style: Partial<ObjectContainerStyle>) => {
      const story = selectedStoryLayout?.story;
      const frameStyleKey = objectFrameStyleKeys[selectedObjectType];

      if (!story || !frameStyleKey) {
        return;
      }

      const nextContainerStyles = normalizeContainerStyles({
        ...story.articleData.containerStyles,
        [frameStyleKey]: {
          ...story.articleData.containerStyles[frameStyleKey],
          ...style,
        },
      });

      updateSelectedStoryArticleData("containerStyles", nextContainerStyles);
    },
    [selectedObjectType, selectedStoryLayout, updateSelectedStoryArticleData],
  );

  const updateSelectedAlignment = useCallback(
    (alignment: EditorialTextAlignment) => {
      const story = selectedStoryLayout?.story;

      if (!story) {
        return;
      }

      updateSelectedStoryArticleData("typography", {
        ...story.articleData.typography,
        ...setObjectAlignment(story.articleData.typography, selectedObjectType, alignment),
        ...(selectedObjectType === "body" && alignment === "justify"
          ? setObjectJustifyMode("body", "justify-all-lines")
          : {}),
      });
    },
    [selectedObjectType, selectedStoryLayout, updateSelectedStoryArticleData],
  );
  const selectedAlignment = selectedStoryLayout
    ? getObjectAlignment(selectedStoryLayout.story.articleData.typography, selectedObjectType)
    : "left";

  const copySelectedObjectStyle = useCallback(() => {
    if (!selectedStoryId || !selectedStoryLayout) {
      return;
    }

    const content = getObjectRichContent(selectedStoryId, selectedObjectType);
    const firstSpan = content ? normalizeRichText(content).spans[0] : null;
    const frameStyleKey = objectFrameStyleKeys[selectedObjectType];
    const frameStyle = frameStyleKey
      ? (normalizeContainerStyles(selectedStoryLayout.story.articleData.containerStyles)[frameStyleKey] ?? null)
      : null;

    setCopiedObjectStyle({
      richTextStyle: firstSpan
        ? {
            bold: firstSpan.bold,
            italic: firstSpan.italic,
            underline: firstSpan.underline,
            color: firstSpan.color,
            backgroundColor: firstSpan.backgroundColor,
            opacity: firstSpan.opacity,
            fontSize: firstSpan.fontSize,
            fontWeight: firstSpan.fontWeight,
          }
        : {},
      frameStyle,
      alignment: selectedStoryLayout.story.articleData.typography.bodyAlignment,
    });
  }, [getObjectRichContent, selectedObjectType, selectedStoryId, selectedStoryLayout]);

  const pasteCopiedObjectStyle = useCallback(() => {
    if (!copiedObjectStyle) {
      return;
    }

    applyObjectRichStyle(copiedObjectStyle.richTextStyle);

    if (copiedObjectStyle.frameStyle) {
      updateSelectedFrameStyle(copiedObjectStyle.frameStyle);
    }
  }, [applyObjectRichStyle, copiedObjectStyle, updateSelectedFrameStyle]);

  const deleteSelectedObject = useCallback(() => {
    if (selectedStoryIds.length > 1 && selectedObjectType === "headline") {
      deleteSelectedStories();
      return;
    }

    if (!selectedStoryId || !selectedStoryLayout) {
      return;
    }

    if (selectedObjectType === "image") {
      updateSelectedStoryImageSettings("imageEnabled", false);
      return;
    }

    if (selectedObjectType === "caption" || selectedObjectType === "credit" || selectedObjectType === "source") {
      updateSelectedStoryArticleData("caption", {
        ...selectedStoryLayout.story.articleData.caption,
        enabled: selectedObjectType === "caption" ? false : selectedStoryLayout.story.articleData.caption.enabled,
        showCredit: selectedObjectType === "credit" ? false : selectedStoryLayout.story.articleData.caption.showCredit,
        showSource: selectedObjectType === "source" ? false : selectedStoryLayout.story.articleData.caption.showSource,
      });
      return;
    }

    if (selectedObjectType === "factBox" || selectedObjectType === "factBoxHeading" || selectedObjectType === "factBoxContent") {
      updateSelectedStoryCompositionSettings("enableFactBox", false);
      return;
    }

    if (selectedObjectType === "pullQuote") {
      updateSelectedStoryCompositionSettings("enablePullQuote", false);
      return;
    }

    if (selectedObjectType === "kicker" || selectedObjectType === "strap") {
      updateSelectedStoryArticleData(selectedObjectType, {
        ...selectedStoryLayout.story.articleData[selectedObjectType],
        enabled: false,
      });
      return;
    }

    deleteStory(selectedStoryId);
  }, [
    deleteSelectedStories,
    deleteStory,
    selectedObjectType,
    selectedStoryIds.length,
    selectedStoryId,
    selectedStoryLayout,
    updateSelectedStoryArticleData,
    updateSelectedStoryCompositionSettings,
    updateSelectedStoryImageSettings,
  ]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateViewport = (width: number, height: number) => {
      const nextWidth = Math.max(1, Math.round(width));
      const nextHeight = Math.max(1, Math.round(height));

      setViewport((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateViewport(rect.width, rect.height);
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        updateViewport(entry.contentRect.width, entry.contentRect.height);
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const startedAt = renderStartRef.current;
    const finishedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    if (performanceProfilerEnabled) {
      const renderTimeMs = Math.max(0, Math.round((finishedAt - startedAt) * 100) / 100);
      const konvaNodes = countKonvaNodes(stageRef.current, previousKonvaNodeCountRef.current);
      previousKonvaNodeCountRef.current = konvaNodes.totalNodes;
      profilerRef.current.recordOperation("render", renderTimeMs);
      profilerRef.current.recordOperation("editor-canvas-render", renderTimeMs);
      profilerRef.current.recordOperation("react-commit", renderTimeMs);
      profilerRef.current.recordFrame(renderTimeMs);
      const drawStartedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      contentLayerRef.current?.batchDraw();
      const drawFinishedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      profilerRef.current.recordOperation("konva-draw", drawFinishedAt - drawStartedAt);
      profilerRef.current.recordOperation("konva-batch-draw", drawFinishedAt - drawStartedAt);
      setRenderDiagnostics((current) =>
        Math.abs(current.renderTimeMs - renderTimeMs) > 1 ||
        current.konvaNodes.totalNodes !== konvaNodes.totalNodes ||
        current.konvaNodes.createdNodes !== konvaNodes.createdNodes ||
        current.konvaNodes.destroyedNodes !== konvaNodes.destroyedNodes
          ? {
              ...current,
              renderTimeMs,
              konvaNodes,
            }
          : current,
      );
    } else {
      contentLayerRef.current?.batchDraw();
    }
  }, [storyLayouts, zoom, viewport, selectedStoryId, selectedObjectType, productionView, performanceProfilerEnabled]);

  useEffect(() => {
    if (!performanceProfilerEnabled) {
      return;
    }

    let frameCount = 0;
    let lastSample =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    let animationFrame = 0;

    const sample = () => {
      frameCount += 1;
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const elapsed = now - lastSample;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        setRenderDiagnostics((current) =>
          current.fps === fps
            ? current
            : {
                ...current,
                fps,
              },
        );
        frameCount = 0;
        lastSample = now;
      }

      animationFrame = requestAnimationFrame(sample);
    };

    animationFrame = requestAnimationFrame(sample);

    return () => cancelAnimationFrame(animationFrame);
  }, [performanceProfilerEnabled]);

  const handleWheel = useCallback((event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();

    if (event.evt.ctrlKey || event.evt.metaKey) {
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const nextZoom = Math.min(2.4, Math.max(0.2, zoom + direction * 0.05));

      setZoom(nextZoom);
      setPagePanOffset((current) =>
        clampPublisherPanOffset(current, viewport, nextZoom, Boolean(selectedStoryLayout)),
      );
      return;
    }

    setPagePanOffset((current) =>
      clampPublisherPanOffset(
        {
          x: current.x - event.evt.deltaX,
          y: current.y - event.evt.deltaY,
        },
        viewport,
        zoom,
        Boolean(selectedStoryLayout),
      ),
    );
  }, [selectedStoryLayout, setZoom, viewport, zoom]);

  const handleStageMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      const isCtrl = event.evt.ctrlKey || event.evt.metaKey;

      if (isCtrl && event.target === event.target.getStage()) {
        panStartRef.current = {
          x: event.evt.clientX,
          y: event.evt.clientY,
        };
        setIsCtrlPanning(true);
        if (stage) {
          stage.container().style.cursor = "grabbing";
        }
        event.evt.preventDefault();
        return;
      }

      if (event.target === event.target.getStage()) {
        const pointer = stage?.getPointerPosition();

        if (pointer && pointer.y >= pageOrigin.y - RULER_SIZE && pointer.y < pageOrigin.y && pointer.x >= pageOrigin.x) {
          addGuide("vertical", (pointer.x - pageOrigin.x) / zoom);
          event.evt.preventDefault();
          return;
        }

        if (pointer && pointer.x >= pageOrigin.x - RULER_SIZE && pointer.x < pageOrigin.x && pointer.y >= pageOrigin.y) {
          addGuide("horizontal", (pointer.y - pageOrigin.y) / zoom);
          event.evt.preventDefault();
          return;
        }
      }

      if (event.target === event.target.getStage()) {
        clearSelection();
      }
    },
    [addGuide, clearSelection, pageOrigin, zoom],
  );

  const handleStageMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isCtrlPanning || !panStartRef.current) {
        return;
      }

      const nextPoint = {
        x: event.evt.clientX,
        y: event.evt.clientY,
      };

      const dx = nextPoint.x - panStartRef.current.x;
      const dy = nextPoint.y - panStartRef.current.y;

      panStartRef.current = nextPoint;
      setPagePanOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
      event.evt.preventDefault();
    },
    [isCtrlPanning],
  );

  const handleStageMouseUp = useCallback(() => {
    if (isCtrlPanning) {
      setIsCtrlPanning(false);
      panStartRef.current = null;
      if (stageRef.current) {
        stageRef.current.container().style.cursor = "default";
      }
    }
  }, [isCtrlPanning]);

  const handleSelectStory = useCallback(
    (storyId: string, additive = false) => {
      const frameId = activePage?.frameIds.find((candidateFrameId) => document.frames[candidateFrameId]?.storyId === storyId);

      if (frameId) {
        selectFrame(frameId, additive);
        return;
      }

      selectStory(storyId);
    },
    [activePage?.frameIds, document.frames, selectFrame, selectStory],
  );

  const handleSelectObject = useCallback(
    (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds, additive = false) => {
      selectObject(storyId, objectType, bounds, additive);
    },
    [selectObject],
  );
  const handleSelectParagraph = useCallback(
    (storyId: string, paragraphIndex: number, bounds: EditorSelectionBounds) => {
      selectObject(storyId, "body", bounds);
      setSelectedParagraphIndex(paragraphIndex);
      setTypographyEditingScope("paragraph");
    },
    [selectObject, setSelectedParagraphIndex, setTypographyEditingScope],
  );
  const handleFrameContextMenu = useCallback(
    (storyId: string, clientX: number, clientY: number) => {
      setFrameContextMenu({ storyId, x: clientX, y: clientY });
    },
    [],
  );

  const handleRequestImageReplace = useCallback(
    (storyId: string, clientX: number, clientY: number) => {
      setImageReplacePopup({ storyId, target: "photo", x: clientX, y: clientY });
    },
    [],
  );

  const handleRequestPortraitReplace = useCallback(
    (storyId: string, clientX: number, clientY: number) => {
      setImageReplacePopup({ storyId, target: "portrait", x: clientX, y: clientY });
    },
    [],
  );

  const handleRequestMastheadTeaserReplace = useCallback(
    (slotIndex: number, clientX: number, clientY: number) => {
      setImageReplacePopup({ storyId: slotIndex.toString(), target: "masthead-teaser", x: clientX, y: clientY });
    },
    [],
  );

  const handleRequestInsideTeaserReplace = useCallback(
    (slotIndex: number, clientX: number, clientY: number) => {
      setImageReplacePopup({ storyId: slotIndex.toString(), target: "inside-teaser", x: clientX, y: clientY });
    },
    [],
  );

  const handleRequestFrontTeaserReplace = useCallback((clientX: number, clientY: number) => {
    setImageReplacePopup({ storyId: "", target: "akhand-front-teaser", x: clientX, y: clientY });
  }, []);

  const handleImageReplaceFileChange = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      const target = imageReplacePopup;

      setImageReplacePopup(null);

      if (!file || !target) {
        return;
      }

      const descriptor = await readImageFileAsAssetDescriptor(file);

      if (target.target === "akhand-front-teaser") {
        setFrontTeaserImageOverride(descriptor.source ?? "");
        return;
      }

      if (target.target === "masthead-teaser") {
        const slotIndex = parseInt(target.storyId, 10);
        const store = useYouthUpdateTeaserStore.getState();
        const currentTeasers = store.teasers || FALLBACK_TEASERS;
        const newTeasers = [...currentTeasers];
        newTeasers[slotIndex] = { ...newTeasers[slotIndex], imageUrl: descriptor.source ?? "" };
        store.setTeasers(newTeasers as any);
        return;
      }

      if (target.target === "inside-teaser") {
        const slotIndex = parseInt(target.storyId, 10);
        const store = useYouthUpdateInsideTeaserLiveStore.getState();
        const currentItems = store.items || [];
        const newItems = [...currentItems];
        
        if (!newItems[slotIndex]) {
          const fallbackStore = useYouthUpdateTeaserStore.getState();
          const fallbackSlot = (fallbackStore.teasers || FALLBACK_TEASERS)[slotIndex];
          newItems[slotIndex] = {
            title: fallbackSlot.headline,
            body: fallbackSlot.label,
            imageUrl: descriptor.source ?? ""
          };
        } else {
          newItems[slotIndex] = { ...newItems[slotIndex], imageUrl: descriptor.source ?? "" };
        }
        
        store.setItems(newItems);
        return;
      }

      if (target.target === "portrait") {
        // The rail portrait is a plain URL field on the story's article data,
        // not an asset-store entry — same field the wizard's own upload sets.
        selectStory(target.storyId);
        updateSelectedStoryArticleData("editorPortraitUrl", descriptor.source);
        return;
      }

      replaceStoryImage(target.storyId, descriptor);
    },
    [imageReplacePopup, replaceStoryImage, selectStory, setFrontTeaserImageOverride, updateSelectedStoryArticleData],
  );

  useEffect(() => {
    if (!imageReplacePopup) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target?.closest(".image-replace-popup")) {
        setImageReplacePopup(null);
      }
    };

    window.document.addEventListener("mousedown", closeOnOutsideClick);

    return () => window.document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [imageReplacePopup]);

  const commitObjectText = useCallback(
    (storyId: string, objectType: EditorObjectType, text: string) => {
      const story = stories.find((item) => item.id === storyId);

      if (!story) {
        return;
      }

      selectObject(storyId, objectType);

      if (objectType === "headline" || objectType === "subheadline" || objectType === "body") {
        updateSelectedStoryArticleData(objectType, text);
        return;
      }

      if (objectType === "caption") {
        updateSelectedStoryArticleData("caption", {
          ...story.articleData.caption,
          text,
        });
        return;
      }

      if (objectType === "credit") {
        updateSelectedStoryArticleData("caption", {
          ...story.articleData.caption,
          creditText: text,
        });
        return;
      }

      if (objectType === "source") {
        updateSelectedStoryArticleData("caption", {
          ...story.articleData.caption,
          source: text,
        });
        return;
      }

      if (objectType === "pullQuote") {
        updateSelectedStoryArticleData("pullQuote", {
          ...story.articleData.pullQuote,
          text,
        });
        return;
      }

      if (objectType === "factBoxHeading") {
        updateSelectedStoryArticleData("factBox", {
          ...story.articleData.factBox,
          headline: text,
        });
        return;
      }

      if (objectType === "factBoxContent") {
        updateSelectedStoryArticleData("factBox", {
          ...story.articleData.factBox,
          bullets: text.split(/\n+/u).filter(Boolean),
        });
        return;
      }

      if (objectType === "kicker" || objectType === "strap") {
        updateSelectedStoryArticleData(objectType, {
          ...story.articleData[objectType],
          text,
        });
        return;
      }

      if (objectType === "byline") {
        updateSelectedStoryArticleData("author", text);
        return;
      }

      if (objectType === "location") {
        updateSelectedStoryArticleData("location", text);
        return;
      }

      if (objectType === "editorName") {
        updateSelectedStoryArticleData("editorName", text);
      }
    },
    [selectObject, stories, updateSelectedStoryArticleData],
  );

  const getObjectText = useCallback((storyId: string, objectType: EditorObjectType) => {
    const story = stories.find((item) => item.id === storyId);

    if (!story) {
      return null;
    }

    const { articleData } = story;

    if (objectType === "headline" || objectType === "subheadline" || objectType === "body") {
      return richTextToPlainText(articleData[objectType]);
    }

    if (objectType === "caption") {
      return richTextToPlainText(articleData.caption.text);
    }

    if (objectType === "credit") {
      return richTextToPlainText(articleData.caption.creditText);
    }

    if (objectType === "source") {
      return articleData.caption.source;
    }

    if (objectType === "pullQuote") {
      return richTextToPlainText(articleData.pullQuote.text);
    }

    if (objectType === "factBoxHeading") {
      return richTextToPlainText(articleData.factBox.headline);
    }

    if (objectType === "factBoxContent") {
      return articleData.factBox.bullets.map(richTextToPlainText).join("\n");
    }

    if (objectType === "kicker" || objectType === "strap") {
      return richTextToPlainText(articleData[objectType].text);
    }

    if (objectType === "byline") {
      return articleData.author;
    }

    if (objectType === "location") {
      return articleData.location;
    }

    if (objectType === "editorName") {
      return articleData.editorName ?? "";
    }

    return null;
  }, [stories]);

  const getObjectTextStyle = useCallback(
    (storyId: string, objectType: EditorObjectType): ArticleTextStyle | null => {
      const found = storyLayouts.find(({ story }) => story.id === storyId);

      if (!found) {
        return null;
      }

      const { layout } = found;

      switch (objectType) {
        case "headline":
          return layout.headline.style;
        case "subheadline":
          return layout.subheadline.style;
        case "byline":
          return layout.byline.style;
        case "kicker":
          return layout.kicker?.textBlock.style ?? null;
        case "strap":
          return layout.strap?.textBlock.style ?? null;
        case "caption":
          return layout.caption?.textBlock.style ?? null;
        case "credit":
          return layout.caption?.creditBlock?.style ?? null;
        case "source":
          return layout.caption?.sourceBlock?.style ?? null;
        case "pullQuote":
          return layout.pullQuote?.textBlock.style ?? null;
        case "factBoxHeading":
          return layout.factBox?.headline.style ?? null;
        case "factBoxContent":
          return layout.factBox?.bullets[0]?.style ?? null;
        case "body":
          return layout.body.columns[0]?.lines[0]?.style ?? null;
        case "editorName":
          // Not part of the composed layout — the name plate is furniture
          // AuthorBlock draws itself, styled to match exactly.
          return {
            fill: EDITORIAL_COLOURS.onAccent,
            fontFamily: getNewspaperFontStack("serif"),
            fontSize: EDITORIAL_RAIL.namePlateFontSize,
            lineHeight: 1,
            fontStyle: "700",
            align: "center",
          };
        default:
          return null;
      }
    },
    [storyLayouts],
  );

  const handleEditObject = useCallback(
    (storyId: string, objectType: EditorObjectType, bounds: EditorSelectionBounds) => {
      const frame = Object.values(document.frames).find(
        (candidate) => candidate.storyId === storyId && candidate.pageId === activePageId,
      );

      if (frame?.locked) {
        return;
      }

      const currentText = getObjectText(storyId, objectType);
      const viewportBounds = getViewportBounds(storyId, bounds);

      if (currentText === null || !viewportBounds) {
        return;
      }

      selectObject(storyId, objectType, bounds);
      setEditingMode("text");
      setCaretPosition(currentText.length);
      setSelectedRichTextRange({ start: 0, end: currentText.length });
      setInlineEditSession({
        storyId,
        objectType,
        bounds: viewportBounds,
        value: currentText,
        originalValue: currentText,
        textStyle: getObjectTextStyle(storyId, objectType),
      });
    },
    [
      activePageId,
      document.frames,
      getObjectTextStyle,
      getObjectText,
      getViewportBounds,
      selectObject,
      setCaretPosition,
      setEditingMode,
      setSelectedRichTextRange,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isFormField =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable;

      if (isFormField) {
        return;
      }

      if (event.key === "Escape") {
        if (pagePreview) {
          setPagePreview(null);
          return;
        }
        if (inlineEditSession) {
          setInlineEditSession(null);
        }
        setEditingMode("none");
        setCaretPosition(null);
        setSelectedRichTextRange(null);
        return;
      }

      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        const activeIndex = document.pages.findIndex((page) => page.id === activePageId);
        const direction = event.key === "PageDown" ? 1 : -1;
        const nextPage = document.pages[Math.min(Math.max(activeIndex + direction, 0), document.pages.length - 1)];

        if (nextPage) {
          setActivePage(nextPage.id);
        }

        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ";") {
        event.preventDefault();
        setGuidesHidden((value) => !value);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setGuidesLocked((value) => !value);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setBaselineVisible((value) => !value);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        setRulerUnit((value) => value === "in" ? "mm" : value === "mm" ? "px" : "in");
        return;
      }

      if (!selectedStoryId) {
        return;
      }

      if (
        selectedObjectType === "body" &&
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(
          Math.max(selectedParagraphIndex + direction, 0),
          selectedParagraphCount - 1,
        );
        setSelectedParagraphIndex(nextIndex);
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const currentIndex = selectableObjectOrder.indexOf(selectedObjectType);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          (currentIndex + direction + selectableObjectOrder.length) % selectableObjectOrder.length;

        selectObject(selectedStoryId, selectableObjectOrder[nextIndex]);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        applyObjectRichStyle({ bold: true });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        applyObjectRichStyle({ italic: true });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        applyObjectRichStyle({ underline: true });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedObjectStyle();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteCopiedObjectStyle();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateStory(selectedStoryId);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoMultiSelectionOperation();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && ((event.shiftKey && event.key.toLowerCase() === "z") || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redoMultiSelectionOperation();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAllStories();
        return;
      }

      if (event.key === "Enter" && liveResizePreviewDrawCommands.length > 0 && placementWarning?.includes("Smart delete preview")) {
        event.preventDefault();
        confirmSmartDelete();
        return;
      }

      if (event.key === "Escape" && liveResizePreviewDrawCommands.length > 0 && placementWarning?.includes("Smart delete preview")) {
        event.preventDefault();
        cancelSmartDelete();
        return;
      }

      if (event.key === "Escape" && editingMode === "none") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedObject();
        return;
      }

      if (event.key === "Enter" && editingMode === "none" && selectionBounds) {
        event.preventDefault();
        handleEditObject(selectedStoryId, selectedObjectType, selectionBounds);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editingMode,
    activePageId,
    document.pages,
    inlineEditSession,
    pagePreview,
    selectionBounds,
    applyObjectRichStyle,
    cancelSmartDelete,
    confirmSmartDelete,
    copySelectedObjectStyle,
    clearSelection,
    deleteSelectedObject,
    duplicateStory,
    handleEditObject,
    pasteCopiedObjectStyle,
    placementWarning,
    redoMultiSelectionOperation,
    selectObject,
    selectAllStories,
    setActivePage,
    selectedParagraphCount,
    selectedParagraphIndex,
    selectedObjectType,
    selectedStoryId,
    liveResizePreviewDrawCommands.length,
    setCaretPosition,
    setEditingMode,
    setSelectedParagraphIndex,
    setSelectedRichTextRange,
    undoMultiSelectionOperation,
  ]);

  const handleMoveStory = useCallback(
    (storyId: string, position: Point) => {
      if (selectedStoryIds.length > 1 && selectedStoryIds.includes(storyId)) {
        const story = stories.find((item) => item.id === storyId);

        if (story) {
          moveSelectedStories({
            x: position.x - story.x,
            y: position.y - story.y,
          });
          return;
        }
      }

      moveStory(storyId, position);
    },
    [moveSelectedStories, moveStory, selectedStoryIds, stories],
  );

  const handleBeginLiveMove = useCallback(
    (
      storyId: string,
      articleBox: ArticleBoxModel,
      pointer: Parameters<typeof beginLiveMove>[2],
    ) => {
      beginLiveMove(storyId, articleBox, pointer);
    },
    [beginLiveMove],
  );

  const handleUpdateLiveMove = useCallback(
    (pointer: LiveResizePointer) => {
      pendingLiveMovePointerRef.current = pointer;

      if (liveMoveAnimationFrameRef.current !== null) {
        return;
      }

      liveMoveAnimationFrameRef.current = window.requestAnimationFrame(() => {
        liveMoveAnimationFrameRef.current = null;
        const pendingPointer = pendingLiveMovePointerRef.current;
        pendingLiveMovePointerRef.current = null;

        if (pendingPointer) {
          updateLiveMove(pendingPointer);
        }
      });
    },
    [updateLiveMove],
  );

  const handleEndLiveMove = useCallback(() => {
    if (liveMoveAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveMoveAnimationFrameRef.current);
      liveMoveAnimationFrameRef.current = null;
    }
    if (pendingLiveMovePointerRef.current) {
      updateLiveMove(pendingLiveMovePointerRef.current);
      pendingLiveMovePointerRef.current = null;
    }
    endLiveMove();
  }, [endLiveMove, updateLiveMove]);

  const handleCancelLiveMove = useCallback(() => {
    if (liveMoveAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveMoveAnimationFrameRef.current);
      liveMoveAnimationFrameRef.current = null;
    }
    pendingLiveMovePointerRef.current = null;
    cancelLiveMove();
  }, [cancelLiveMove]);

  const handleResizeStory = useCallback(
    (storyId: string, articleBox: ArticleBoxModel) => {
      resizeStory(storyId, articleBox);
    },
    [resizeStory],
  );

  const handleBeginLiveResize = useCallback(
    (
      storyId: string,
      articleBox: ArticleBoxModel,
      handle: Parameters<typeof beginLiveResize>[2],
      pointer: Parameters<typeof beginLiveResize>[3],
    ) => {
      beginLiveResize(storyId, articleBox, handle, pointer);
    },
    [beginLiveResize],
  );

  const handleUpdateLiveResize = useCallback(
    (pointer: LiveResizePointer) => {
      pendingLiveResizePointerRef.current = pointer;

      if (liveResizeAnimationFrameRef.current !== null) {
        return;
      }

      liveResizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        liveResizeAnimationFrameRef.current = null;
        const pendingPointer = pendingLiveResizePointerRef.current;
        pendingLiveResizePointerRef.current = null;

        if (pendingPointer) {
          updateLiveResize(pendingPointer);
        }
      });
    },
    [updateLiveResize],
  );

  const handleEndLiveResize = useCallback(() => {
    if (liveResizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveResizeAnimationFrameRef.current);
      liveResizeAnimationFrameRef.current = null;
    }
    if (pendingLiveResizePointerRef.current) {
      updateLiveResize(pendingLiveResizePointerRef.current);
      pendingLiveResizePointerRef.current = null;
    }
    endLiveResize();
  }, [endLiveResize, updateLiveResize]);

  const handleCancelLiveResize = useCallback(() => {
    if (liveResizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveResizeAnimationFrameRef.current);
      liveResizeAnimationFrameRef.current = null;
    }
    pendingLiveResizePointerRef.current = null;
    cancelLiveResize();
  }, [cancelLiveResize]);

  useEffect(() => () => {
    if (liveMoveAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveMoveAnimationFrameRef.current);
    }
    if (liveResizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveResizeAnimationFrameRef.current);
    }
  }, []);

  const getSelectedFrameStoryRects = useCallback((): FrameLayoutRect[] => {
    const storyIds = selectedFrameIds
      .map((frameId) => document.frames[frameId]?.storyId)
      .filter((storyId): storyId is string => Boolean(storyId));
    const resolvedStoryIds = storyIds.length > 0
      ? storyIds
      : selectedStoryId
        ? [selectedStoryId]
        : [];
    const uniqueStoryIds = [...new Set(resolvedStoryIds)];

    return uniqueStoryIds.flatMap((storyId) => {
      const story = stories.find((item) => item.id === storyId);

      if (!story) {
        return [];
      }

      return [{
        id: story.id,
        x: story.x,
        y: story.y,
        width: story.width,
        height: story.height,
        hidden: story.hidden,
        locked: story.locked,
      }];
    });
  }, [document.frames, selectedFrameIds, selectedStoryId, stories]);

  const handleAlignSelectedFrames = useCallback(
    (alignment: FrameAlignment, target: FrameAlignmentTarget) => {
      const selectedRects = getSelectedFrameStoryRects().filter((rect) => !rect.locked);

      if (selectedRects.length === 0) {
        return;
      }

      const targetBounds = getAlignmentTargetBounds(selectedRects, target, frameLayoutContext);
      const alignedRects = alignFrameRects(selectedRects, alignment, targetBounds);

      for (const rect of alignedRects) {
        moveStory(rect.id, {
          x: rect.x,
          y: rect.y,
        });
      }
    },
    [frameLayoutContext, getSelectedFrameStoryRects, moveStory],
  );

  const handleDistributeSelectedFrames = useCallback(
    (axis: FrameDistributionAxis) => {
      const selectedRects = getSelectedFrameStoryRects().filter((rect) => !rect.locked);

      if (selectedRects.length < 3) {
        return;
      }

      const distributedRects = distributeFrameRects(selectedRects, axis);

      for (const rect of distributedRects) {
        moveStory(rect.id, {
          x: rect.x,
          y: rect.y,
        });
      }
    },
    [getSelectedFrameStoryRects, moveStory],
  );

  const handleZoomToStory = useCallback(
    (storyId: string) => {
      selectStory(storyId);
      setZoom(1);
    },
    [selectStory, setZoom],
  );

  const handleZoomToFrame = useCallback(
    (frameId: string) => {
      selectFrame(frameId, false);
      setZoom(Math.max(zoom, 0.85));
    },
    [selectFrame, setZoom, zoom],
  );
  const handleSelectFrameObject = useCallback(
    (frameId: string, objectType: EditorObjectType, additive = false) => {
      selectFrame(frameId, additive);
      setSelectedObjectType(objectType);
    },
    [selectFrame, setSelectedObjectType],
  );

  const handleReactRenderProfile = useCallback(
    (
      id: string,
      phase: "mount" | "update" | "nested-update",
      actualDuration: number,
      baseDuration: number,
    ) => {
      if (!performanceProfilerEnabled) {
        return;
      }

      profilerRef.current.recordOperation("react-render", actualDuration, {
        component: id,
        phase,
        baseDuration,
        whyRendered: phase === "mount" ? "mounted" : "props/state changed",
      });

      if (id === "CanvasLayer") {
        profilerRef.current.recordOperation("canvas-layer-render", actualDuration, {
          component: id,
          phase,
        });
      }

      if (id === "GridLayer") {
        profilerRef.current.recordOperation("grid-render", actualDuration, {
          component: id,
          phase,
        });
      }

      if (id === "GuideLayer") {
        profilerRef.current.recordOperation("guides-render", actualDuration, {
          component: id,
          phase,
        });
      }

      if (id === "SelectionLayer") {
        profilerRef.current.recordOperation("selection-render", actualDuration, {
          component: id,
          phase,
        });
      }

      if (id === "StoryLayer") {
        profilerRef.current.recordOperation("story-layer-render", actualDuration, {
          component: id,
          phase,
        });
      }

      if (id.startsWith("ArticleBox:")) {
        const storyId = id.replace("ArticleBox:", "");

        profilerRef.current.recordOperation("story-render", actualDuration, {
          component: id,
          storyId,
          nodeCount: layoutNodeCountsRef.current.get(storyId) ?? 0,
        });
      }
    },
    [performanceProfilerEnabled],
  );

  const commitInlineEdit = useCallback(() => {
    if (!inlineEditSession) {
      return;
    }

    if (inlineEditSession.value !== inlineEditSession.originalValue) {
      commitObjectText(inlineEditSession.storyId, inlineEditSession.objectType, inlineEditSession.value);
    }

    setInlineEditSession(null);
    setEditingMode("none");
    setCaretPosition(null);
    setSelectedRichTextRange(null);
  }, [commitObjectText, inlineEditSession, setCaretPosition, setEditingMode, setSelectedRichTextRange]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEditSession(null);
    setEditingMode("none");
    setCaretPosition(null);
    setSelectedRichTextRange(null);
  }, [setCaretPosition, setEditingMode, setSelectedRichTextRange]);

  const propertiesPanel = selectedStoryLayout ? (
    <ArticleInspectorPanel
      articleData={selectedStoryLayout.story.articleData}
      compositionSettings={selectedStoryLayout.story.compositionSettings}
      metrics={selectedStoryLayout.layout.metrics}
      storyId={selectedStoryLayout.story.id}
      interactionMode={editingMode === "text" || selectedObjects.length > 0 ? "content" : "frame"}
      breadcrumb={inspectorBreadcrumb}
      frameSummary={inspectorFrameSummary ?? undefined}
      pageMaster={pageMaster}
      pageType={pageType}
      storyPriority={selectedStoryLayout.story.priority}
      storyColumnSpan={selectedStoryLayout.story.columnSpan}
      priorityStyle={selectedStoryLayout.hierarchyStyle}
      imageSettings={{
        imageEnabled: selectedStoryLayout.story.imageEnabled,
        imageAlignment: selectedStoryLayout.story.imageAlignment,
        imageColumnSpan: selectedStoryLayout.story.imageColumnSpan,
        imageHeight: selectedStoryLayout.story.imageHeight,
        imageHeightMode: selectedStoryLayout.story.imageHeightMode,
        imageHeightPreset: selectedStoryLayout.story.imageHeightPreset,
        imageHeightProtection: selectedStoryLayout.story.imageHeightProtection,
        autoSizeImage: selectedStoryLayout.story.autoSizeImage,
        imageWrapMode: selectedStoryLayout.story.imageWrapMode,
        imageShapeType: selectedStoryLayout.story.imageShapeType,
        imageShapePoints: selectedStoryLayout.story.imageShapePoints,
        imageCrop: selectedStoryLayout.story.imageCrop,
        wrapContourPoints: selectedStoryLayout.story.wrapContourPoints,
        wrapTextOffset: selectedStoryLayout.story.wrapTextOffset,
      }}
      typographySettings={{
        headlineFontSize: selectedStoryLayout.story.headlineFontSize,
        subheadlineFontSize: selectedStoryLayout.story.subheadlineFontSize,
        bodyFontSize: selectedStoryLayout.story.bodyFontSize,
        headlineLineHeight: selectedStoryLayout.story.headlineLineHeight,
        subheadlineLineHeight: selectedStoryLayout.story.subheadlineLineHeight,
        bodyLineHeight: selectedStoryLayout.story.bodyLineHeight,
        headlineLineHeightMode: selectedStoryLayout.story.headlineLineHeightMode,
        subheadlineLineHeightMode: selectedStoryLayout.story.subheadlineLineHeightMode,
        bodyLineHeightMode: selectedStoryLayout.story.bodyLineHeightMode,
        headlineLeadingValue: selectedStoryLayout.story.headlineLeadingValue,
        subheadlineLeadingValue: selectedStoryLayout.story.subheadlineLeadingValue,
        bodyLeadingValue: selectedStoryLayout.story.bodyLeadingValue,
        headlineWeight: selectedStoryLayout.story.headlineWeight,
        subheadlineWeight: selectedStoryLayout.story.subheadlineWeight,
        autoFitHeadline: selectedStoryLayout.story.autoFitHeadline,
        autoBalanceHeadline: selectedStoryLayout.story.autoBalanceHeadline,
        enableHyphenation: selectedStoryLayout.story.enableHyphenation,
        forceFullWidthHeadlines: selectedStoryLayout.story.forceFullWidthHeadlines,
        headlineLayoutMode: selectedStoryLayout.story.headlineLayoutMode,
      }}
      storyHeight={selectedStoryLayout.story.height}
      pageDiagnostics={pageDiagnostics}
      dominanceMetrics={dominanceMetrics}
      performanceDiagnostics={performanceDiagnostics}
      fontManager={fontManager}
      selectedParagraphIndex={selectedParagraphIndex}
      paragraphCount={selectedParagraphCount}
      typographyEditingScope={typographyEditingScope}
      onArticleChange={updateSelectedStoryArticleData}
      onCompositionChange={updateSelectedStoryCompositionSettings}
      onImageSettingsChange={updateSelectedStoryImageSettings}
      onTypographySettingsChange={updateSelectedStoryTypographySettings}
      onResetTypography={resetSelectedStoryTypographyToPriorityDefaults}
      onPageTypeChange={setPageType}
      onStoryPriorityChange={updateSelectedStoryPriority}
      onStoryColumnSpanChange={updateSelectedStoryColumnSpan}
      onAlignFrames={handleAlignSelectedFrames}
      onDistributeFrames={handleDistributeSelectedFrames}
      selectedObjectType={selectedObjectType}
      onSelectedObjectTypeChange={setSelectedObjectType}
      onSelectedParagraphIndexChange={setSelectedParagraphIndex}
      onTypographyEditingScopeChange={setTypographyEditingScope}
    />
  ) : (
    <PlaceholderPanel title="Properties" />
  );
  const leftWorkspacePanels: Partial<Record<WorkspacePanelId, ReactNode>> = {
    frames: (
      <FrameManagerPanel
        document={document}
        activePageId={activePageId}
        selectedFrameId={selectedFrameId}
        selectedFrameIds={selectedFrameIds}
        selectedObjectType={selectedObjectType}
        contentMode={editingMode === "text" || selectedObjects.length > 0}
        onSelectPage={setActivePage}
        onSelectFrame={selectFrame}
        onSelectObject={handleSelectFrameObject}
        onZoomToFrame={handleZoomToFrame}
        onRenameFrame={renameFrame}
        onSetFrameLocked={setFrameLocked}
        onSetFrameHidden={setFrameHidden}
        onReorderFrame={reorderFrameLayer}
        onMoveFrameBefore={moveFrameBefore}
        onDuplicateFrame={duplicateSelectedFrame}
        onDeleteFrame={deleteSelectedFrame}
        onGroupFrames={groupSelectedFrames}
        onUngroupFrames={ungroupSelectedFrames}
        onSoloFrame={soloFrame}
        onAddPage={addEditionPage}
        onDuplicatePage={duplicateActivePage}
        onDeletePage={deleteActivePage}
        onMovePage={moveActivePage}
        onCreateMaster={createMasterPage}
        onDuplicateMaster={duplicateMasterPage}
        onRenameMaster={renameMasterPage}
        onDeleteMaster={deleteMasterPage}
        onApplyMasterToActivePage={applyMasterToActivePage}
        onDetachActivePageMaster={detachActivePageMaster}
        onOverrideMasterElement={overrideActivePageMasterElement}
        onImportNewswireStories={handleImportNewswireStoriesWithSection}
        onReplaceStoryArticle={replaceStoryArticleFromNewswire}
        compactPublisherMode
      />
    ),
    assets: (
      <AssetManagerPanel
        document={document}
        onImportAssets={importAssets}
        onPlaceAsset={placeAssetInSelectedFrame}
        onDeleteAsset={deleteAsset}
        onRelinkAsset={relinkAsset}
        onSetAssetStatus={setAssetStatus}
      />
    ),
    advertisements: (
      <AdvertisementManagerPanel
        document={document}
        activePageId={activePageId}
        onCreateAdvertisement={createAdvertisementBooking}
        onUpdateStatus={updateAdvertisementLifecycle}
        onCreateAdFrame={createAdvertisementFrameAction}
        onAutoPlace={autoPlaceAdvertisementsAction}
        onPlaceInSelectedFrame={placeAdvertisementInSelectedFrame}
        onReplaceArtwork={replaceAdvertisementArtwork}
      />
    ),
    styles: (
      <StyleManagerPanel
        document={document}
        selectedTargetId={selectedStyleTargetId}
        onCreateStyle={createDocumentStyle}
        onDuplicateStyle={duplicateDocumentStyle}
        onRenameStyle={renameDocumentStyle}
        onUpdateStyle={updateDocumentStyle}
        onDeleteStyle={deleteDocumentStyle}
        onApplyStyle={applyDocumentStyle}
        onMarkOverride={markDocumentStyleOverride}
        onClearOverrides={clearDocumentStyleOverrides}
        onImportStyles={importDocumentStyles}
        onExportStyles={exportDocumentStyles}
      />
    ),
    pages: <PlaceholderPanel title="Pages" />,
    masters: (
      <HeaderManagerPanel
        document={document}
        onApplyDraft={applyHeaderSetDraft}
        onSaveAs={saveActiveHeaderSetAs}
        onDuplicate={duplicateActiveHeaderSetAction}
        onRename={renameActiveHeaderSet}
        onDelete={deleteActiveHeaderSet}
        onActivate={activateHeaderSetAction}
        onSetDefault={setActiveHeaderSetAsDefault}
        onExport={exportActiveHeaderSet}
        onImport={importHeaderSet}
        onImportLogo={importHeaderLogoAsset}
        activePageId={activePageId}
        activePageSectionName={activePage?.sectionName ?? pageType}
        onSetLocked={setActiveHeaderLocked}
        onSetHidden={setActiveHeaderHidden}
        onResetLayouts={resetActiveHeaderLayouts}
        onSetSectionOverride={setActiveHeaderSectionOverride}
        onRemoveSectionOverride={removeActiveHeaderSectionOverride}
        onOverrideCurrentPage={overrideActivePageHeader}
        onReturnCurrentPageToMaster={returnActivePageToMasterHeader}
        onUndoHeader={undoHeaderOperation}
        onRedoHeader={redoHeaderOperation}
      />
    ),
    layers: <PlaceholderPanel title="Layers" />,
    preflight: <PlaceholderPanel title="Preflight" />,
  };
  const rightWorkspacePanels: Partial<Record<WorkspacePanelId, ReactNode>> = {
    properties: propertiesPanel,
    navigator: (
      <NavigatorPanel
        zoom={zoom}
        onZoomChange={setZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitPage={fitPage}
        onFitWidth={fitWidth}
        onFitSelection={fitSelection}
        pageCount={document.pages.length}
        activePageNumber={activePage?.pageNumber ?? 1}
        onSelectPage={selectPageByNumber}
      />
    ),
    history: <HistoryPanel history={workspaceHistory} />,
    "quick-search": <QuickSearchPanel document={document} commands={workspaceCommands} />,
    swatches: <PlaceholderPanel title="Swatches" />,
    profiler: <PlaceholderPanel title="Profiler" />,
    output: <PanelRoutingMenu state={workspaceState} onStateChange={setWorkspaceState} />,
  };
  const bottomWorkspacePanels: Partial<Record<WorkspacePanelId, ReactNode>> = {
    preflight: <PlaceholderPanel title="Preflight" />,
    output: <PanelRoutingMenu state={workspaceState} onStateChange={setWorkspaceState} />,
    console: <PlaceholderPanel title="Console" />,
    threads: <PlaceholderPanel title="Threads" />,
    history: <HistoryPanel history={workspaceHistory} />,
  };

  return (
    <main
      className={`editor-shell has-story-manager${selectedStoryLayout ? " has-inspector" : ""}`}
      ref={containerRef}
    >
      <div className="publisher-focused-shell" aria-label="Publisher page workspace">
        <section className="publisher-focused-left" aria-label="Live page layout">
          {leftWorkspacePanels.frames}
        </section>
        <section className="publisher-focused-center" aria-hidden="true" />
        <section className="publisher-focused-actions" aria-label="Page actions">
          <button
            type="button"
            className="publisher-action-button home"
            onClick={() => {
              const url = getPortalReturnUrl();
              if (url) window.location.href = url;
            }}
          >
            <PublisherHomeIcon />
            <span>होम</span>
          </button>
          <button
            type="button"
            className="publisher-action-button"
            onClick={() => void openPagePreview()}
            disabled={pagePreview?.status === "loading"}
          >
            <PublisherPreviewIcon />
            <span>प्रीव्यू</span>
          </button>
          <button
            type="button"
            className="publisher-action-button"
            onClick={() => void handlePublisherDownloadPdf()}
            disabled={pdfExporting}
          >
            {pdfExporting ? (
              <>
                <span className="publisher-button-loader" aria-hidden="true" />
                <span>PDF बन रहा है</span>
              </>
            ) : (
              <>
                <PublisherDownloadIcon />
                <span>PDF डाउनलोड</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="publisher-action-button"
            onClick={openGenerationWizard}
          >
            <PublisherRegenerateIcon />
            <span>रीजनरेट पेज</span>
          </button>
          <button
            type="button"
            className="publisher-action-button primary"
            onClick={openNextPagePicker}
          >
            <PublisherNextPageIcon />
            <span>अगला पेज बनाएं</span>
          </button>
        </section>
      </div>

      {fontManager.status !== "loaded" ? (
        <div className="font-diagnostics-shell">
          <FontDiagnosticsPanel fontManager={fontManager} />
        </div>
      ) : null}

      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
      >
        {!productionView ? (
          <Profiler id="RulerLayer" onRender={handleReactRenderProfile}>
            <RulerLayer
              pageOrigin={pageOrigin}
              zoom={zoom}
              majorGridLinesX={majorGridLinesX}
              majorGridLinesY={majorGridLinesY}
              formatUnit={(points) => formatMeasurement(points, rulerUnit)}
            />
          </Profiler>
        ) : null}

        <Layer ref={contentLayerRef}>
          <Profiler id="CanvasLayer" onRender={handleReactRenderProfile}>
            <Group x={pageOrigin.x} y={pageOrigin.y} scaleX={zoom} scaleY={zoom}>
              <Profiler id="PageChromeLayer" onRender={handleReactRenderProfile}>
                <PageChromeLayer
                  pageMaster={pageMaster}
                  pageType={pageType}
                  newspaperName={document.metadata.newspaperName}
                  edition={document.metadata.edition}
                  dateLabel={document.metadata.date}
                  pageNumber={activePage?.pageNumber ?? 1}
                  sectionName={activePage?.sectionName ?? pageType}
                  resolvedHeader={resolvedPageHeader}
                  masterHeaderEnabled={masterHeaderEnabled}
                  headerLogoSource={headerLogoSource}
                  frontHeaderTeaser={frontHeaderTeaser}
                  useYouthUpdateMasthead={isYouthUpdateFrontLayout}
                  useYouthUpdateInsideHeader={isYouthUpdateInsideLayout}
                  useYouthUpdateInsideTeaser={isYouthUpdateInsideLayout && !youthUpdateInsideHeaderOnly}
                  pageCount={document.pages.length}
                  onRequestMastheadTeaserReplace={handleRequestMastheadTeaserReplace}
                  onRequestInsideTeaserReplace={handleRequestInsideTeaserReplace}
                  onRequestFrontTeaserReplace={handleRequestFrontTeaserReplace}
                />
              </Profiler>

              {!productionView ? (
                <Profiler id="GridLayer" onRender={handleReactRenderProfile}>
                  <GridLayer
                    minorGridLinesX={minorGridLinesX}
                    minorGridLinesY={minorGridLinesY}
                    majorGridLinesX={majorGridLinesX}
                    majorGridLinesY={majorGridLinesY}
                    contentBounds={contentBounds}
                    columns={columns}
                  />
                </Profiler>
              ) : null}

              {!productionView && baselineVisible ? (
                <BaselineGridLayer spacing={baselineSpacing} color={baselineColor} />
              ) : null}

              <Profiler id="GuideLayer" onRender={handleReactRenderProfile}>
                <GuideLayer
                  editorialSeparatorLines={editorialSeparatorLines}
                  separatorRule={separatorRule}
                  guides={visibleGuides}
                  onGuideMove={moveGuide}
                  onGuideDelete={deleteGuide}
                />
              </Profiler>

              <Profiler id="StoryLayer" onRender={handleReactRenderProfile}>
                <StoryLayer
                  storyLayouts={visibleStoryLayouts}
                  selectedStoryId={selectedStoryId}
                  selectedStoryIds={selectedStoryIds}
                  selectedObjectType={selectedObjectType}
                  selectedParagraphIndex={selectedParagraphIndex}
                  contentMode={editingMode === "text" || selectedObjects.length > 0}
                  productionView={productionView}
                  frameLayoutContext={frameLayoutContext}
                  renderProfiler={performanceProfilerEnabled ? profilerRef.current : undefined}
                  imageSourcesByStoryId={imageSourcesByStoryId}
                  smartLayoutEnabled={smartLayoutEnabled}
                  onSelectStory={handleSelectStory}
                  onSelectObject={handleSelectObject}
                  onSelectParagraph={handleSelectParagraph}
                  onEditObject={handleEditObject}
                  onContextMenu={handleFrameContextMenu}
                  onRequestImageReplace={handleRequestImageReplace}
                  onRequestPortraitReplace={handleRequestPortraitReplace}
                  onMoveStory={handleMoveStory}
                  onResizeStory={handleResizeStory}
                  onBeginLiveMove={handleBeginLiveMove}
                  onUpdateLiveMove={handleUpdateLiveMove}
                  onEndLiveMove={handleEndLiveMove}
                  onCancelLiveMove={handleCancelLiveMove}
                  onBeginLiveResize={handleBeginLiveResize}
                  onUpdateLiveResize={handleUpdateLiveResize}
                  onEndLiveResize={handleEndLiveResize}
                  onCancelLiveResize={handleCancelLiveResize}
                  onRenderProfile={handleReactRenderProfile}
                />
              </Profiler>

              {youthUpdateEditorialRailBox ? (
                <Group listening={false}>
                  <YouthUpdateEditorialRailImage
                    x={youthUpdateEditorialRailBox.x}
                    y={youthUpdateEditorialRailBox.y}
                    width={youthUpdateEditorialRailBox.width}
                    height={youthUpdateEditorialRailBox.height}
                  />
                  <Rect
                    x={youthUpdateEditorialRailBox.x}
                    y={youthUpdateEditorialRailBox.y + youthUpdateEditorialRailBox.height - 8}
                    width={youthUpdateEditorialRailBox.width}
                    height={11}
                    fill="#fffef9"
                  />
                </Group>
              ) : null}

              {youthUpdateShortNewsBanner ? (
                <YouthUpdateShortNewsBanner
                  x={youthUpdateShortNewsBanner.x}
                  y={youthUpdateShortNewsBanner.y}
                  width={youthUpdateShortNewsBanner.width}
                  height={youthUpdateShortNewsBanner.height}
                />
              ) : null}

              {youthUpdateRightDividers.length > 0 || youthUpdateHatchDividerTicks.length > 0 ? (
                <Group listening={false}>
                  {youthUpdateRightDividers.map((divider, i) => (
                    <Line
                      key={`right-${i}`}
                      points={[divider.x, divider.y, divider.x, divider.y + divider.height]}
                      stroke={YOUTH_UPDATE_COLORS.bodyDivider}
                      strokeWidth={1}
                    />
                  ))}
                  {youthUpdateHatchDividerTicks.map((tick, i) => (
                    <Line
                      key={`hatch-${i}`}
                      points={[tick.x, tick.y1, tick.x, tick.y2]}
                      stroke={YOUTH_UPDATE_COLORS.bodyDivider}
                      strokeWidth={1.4}
                    />
                  ))}
                </Group>
              ) : null}

              {youthUpdateInsideRailBounds ? (
                <YouthUpdateInsideRail
                  x={youthUpdateInsideRailBounds.x}
                  y={youthUpdateInsideRailBounds.y}
                  width={youthUpdateInsideRailBounds.width}
                  height={youthUpdateInsideRailBounds.height}
                />
              ) : null}

              {youthUpdateInsideRightDividers.length > 0 || youthUpdateInsideHatchDividerTicks.length > 0 ? (
                <Group listening={false}>
                  {youthUpdateInsideRightDividers.map((divider, i) => (
                    <Line
                      key={`inside-right-${i}`}
                      points={[divider.x, divider.y, divider.x, divider.y + divider.height]}
                      stroke={YOUTH_UPDATE_COLORS.bodyDivider}
                      strokeWidth={1}
                    />
                  ))}
                  {youthUpdateInsideHatchDividerTicks.map((tick, i) => (
                    <Line
                      key={`inside-hatch-${i}`}
                      points={[tick.x, tick.y1, tick.x, tick.y2]}
                      stroke={YOUTH_UPDATE_COLORS.bodyDivider}
                      strokeWidth={1.4}
                    />
                  ))}
                </Group>
              ) : null}

              {!productionView ? (
                <MeasurementLayer labels={measurementLabels} />
              ) : null}

              {!productionView && liveResizePreviewDrawCommands.length > 0 ? (
                <Profiler id="GhostPreviewLayer" onRender={handleReactRenderProfile}>
                  <GhostPreviewLayer drawCommands={liveResizePreviewDrawCommands} />
                </Profiler>
              ) : null}

              <Profiler id="SelectionLayer" onRender={handleReactRenderProfile}>
                <SelectionLayer />
              </Profiler>
              <Profiler id="DebugLayer" onRender={handleReactRenderProfile}>
                <DebugLayer />
              </Profiler>
              <Profiler id="OverlayLayer" onRender={handleReactRenderProfile}>
                <OverlayLayer />
              </Profiler>
            </Group>
          </Profiler>
        </Layer>
      </Stage>

      {nextPagePickerOpen ? (
        <div className="publisher-page-picker-backdrop" onClick={() => setNextPagePickerOpen(false)}>
          <div className="publisher-page-picker" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="publisher-page-picker-close"
              onClick={() => setNextPagePickerOpen(false)}
              aria-label="Close page picker"
            >
              <X size={17} strokeWidth={2.2} />
            </button>
            <div className="publisher-page-picker-heading">
              <span>एक पेज बनाएं</span>
              <strong>कौन सा पेज तैयार करना है?</strong>
            </div>
            <div className="publisher-page-picker-grid">
              {portalPagePlan.map((pagePlan) => {
                const tab = getWizardTabForPortalPage(pagePlan);
                const isCurrent = pagePlan.page_number === (activePage?.pageNumber ?? 1);
                const typeLabel =
                  tab === "front"
                    ? "फ्रंट पेज"
                    : tab === "editorial"
                      ? "एडिटोरियल"
                      : tab === "advertisement"
                        ? "विज्ञापन"
                        : "इनसाइड पेज";

                return (
                  <button
                    key={pagePlan.page_number}
                    type="button"
                    className={isCurrent ? "active" : ""}
                    onClick={() => openWizardForPortalPage(pagePlan)}
                  >
                    <span>{pagePlan.page_number}</span>
                    <strong>{pagePlan.section || `Page ${pagePlan.page_number}`}</strong>
                    <em>{typeLabel}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="story-toolbar" aria-label="Story controls">
        <div className="toolbar-group" data-label="FILE">
          <button type="button" className="secondary" onClick={() => setWorkspaceHistory((current) => ["Save", ...current].slice(0, 24))}>
            <span>Save</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <button type="button" className="secondary" onClick={() => setWorkspaceHistory((current) => ["Save As", ...current].slice(0, 24))}>
            <span>Save As</span>
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void openPagePreview()}
            disabled={pagePreview?.status === "loading"}
            title="Full-screen look at the current page, rendered the same way the PDF export draws it"
          >
            <span>Preview</span>
          </button>
          <button type="button" className="secondary" onClick={() => void exportCurrentPagePdf()} title="Export the whole edition as one multi-page PDF">
            <span>Export PDF</span>
          </button>
          <button type="button" className="secondary" onClick={() => void exportSinglePagePdf()} title="Export only the current page as a standalone PDF">
            <span>Export Page</span>
          </button>
          <button type="button" className="secondary" onClick={() => setWorkspaceHistory((current) => ["Print", ...current].slice(0, 24))}>
            <span>Print</span>
          </button>
        </div>
        <div className="toolbar-group" data-label="EDIT">
          <button type="button" className="secondary" onClick={undoMultiSelectionOperation}>
            <span>Undo</span>
            <kbd>Ctrl+Z</kbd>
          </button>
          <button type="button" className="secondary" onClick={redoMultiSelectionOperation}>
            <span>Redo</span>
            <kbd>Ctrl+Y</kbd>
          </button>
        </div>
        <div className="toolbar-group alignment-toolbar-group" data-label="ALIGN">
          <button
            type="button"
            className={`secondary icon-only${selectedAlignment === "left" ? " active" : ""}`}
            disabled={!selectedStoryLayout}
            onClick={() => selectedStoryIds.length > 1 ? alignSelectedStories("left") : updateSelectedAlignment("left")}
            title="Align Left"
            aria-label="Align Left"
          >
            <AlignLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`secondary icon-only${selectedAlignment === "center" ? " active" : ""}`}
            disabled={!selectedStoryLayout}
            onClick={() => selectedStoryIds.length > 1 ? alignSelectedStories("center-horizontal") : updateSelectedAlignment("center")}
            title="Align Center"
            aria-label="Align Center"
          >
            <AlignCenter size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`secondary icon-only${selectedAlignment === "right" ? " active" : ""}`}
            disabled={!selectedStoryLayout}
            onClick={() => selectedStoryIds.length > 1 ? alignSelectedStories("right") : updateSelectedAlignment("right")}
            title="Align Right"
            aria-label="Align Right"
          >
            <AlignRight size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`secondary icon-only${selectedAlignment === "justify" ? " active" : ""}`}
            disabled={!selectedStoryLayout}
            onClick={() => selectedStoryIds.length > 1 ? distributeSelectedStories("horizontal-spacing") : updateSelectedAlignment("justify")}
            title="Justify"
            aria-label="Justify"
          >
            <AlignJustify size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="toolbar-group" data-label="STORY">
          <button type="button" className="primary" onClick={openGenerationWizard}>
            <SquarePlus size={16} strokeWidth={2.2} />
            <span>Generate Layout</span>
            <kbd>G</kbd>
          </button>
          <button type="button" className="secondary" onClick={createStory}>
            <SquarePlus size={16} strokeWidth={2.2} />
            <span>Create Story</span>
            <kbd>N</kbd>
          </button>
          <button type="button" className="secondary" onClick={() => setWorkspaceHistory((current) => ["Continue Story Placeholder", ...current].slice(0, 24))}>
            <span>Continue Story</span>
          </button>
        </div>
        <div className="toolbar-group" data-label="VIEW">
          <button type="button" className="secondary" onClick={toggleProductionView}>
            {productionView ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
            <span>{productionView ? "Edit" : "Production"}</span>
            <kbd>V</kbd>
          </button>
          <button type="button" className="secondary" onClick={toggleProductionView}>
            <span>Grid</span>
          </button>
          <button type="button" className="secondary" onClick={() => setGuidesHidden((value) => !value)}>
            <span>{guidesHidden ? "Show Guides" : "Hide Guides"}</span>
          </button>
          <button type="button" className={`secondary${baselineVisible ? " active" : ""}`} onClick={() => setBaselineVisible((value) => !value)}>
            <span>Baseline</span>
          </button>
        </div>
        <div className="toolbar-group dtp-toolbar-group" data-label="DTP">
          <select value={rulerUnit} onChange={(event) => setRulerUnit(event.target.value as RulerUnit)} title="Ruler units">
            <option value="in">inch</option>
            <option value="mm">mm</option>
            <option value="px">pixels</option>
          </select>
          <button type="button" className="secondary" onClick={() => setGuidesLocked((value) => !value)}>
            <span>{guidesLocked ? "Unlock" : "Lock"}</span>
          </button>
          <label className="mini-field">
            <span>Base</span>
            <input type="number" min={2} max={36} value={baselineSpacing} onChange={(event) => setBaselineSpacing(Number(event.target.value) || 12)} />
          </label>
          <input type="color" value={baselineColor} onChange={(event) => setBaselineColor(event.target.value)} title="Baseline color" />
          <label className="mini-toggle">
            <input type="checkbox" checked={baselineSnap} onChange={(event) => setBaselineSnap(event.target.checked)} />
            <span>Snap</span>
          </label>
          <label className="mini-field">
            <span>Cols</span>
            <input type="number" min={1} max={12} value={pageSetupDraft.columns} onChange={(event) => setPageSetupDraft((current) => ({ ...current, columns: Math.max(1, Number(event.target.value) || 1) }))} />
          </label>
          <label className="mini-field">
            <span>Gut</span>
            <input type="number" min={0} step={0.01} value={pageSetupDraft.gutter} onChange={(event) => setPageSetupDraft((current) => ({ ...current, gutter: Math.max(0, Number(event.target.value) || 0) }))} />
          </label>
        </div>
        <div className="toolbar-group" data-label="TOOLS">
          <button type="button" className="secondary" onClick={() => activateWorkspacePanel("right", "quick-search")}>
            <span>Search</span>
            <kbd>Ctrl+K</kbd>
          </button>
          <button type="button" className="secondary" onClick={() => setCommandPaletteOpen(true)}>
            <span>Commands</span>
            <kbd>Ctrl+Shift+P</kbd>
          </button>
          <button type="button" className="secondary" onClick={() => activateWorkspacePanel("left", "assets")}>
            <span>Place Image</span>
          </button>
        </div>
        <div className="toolbar-group" data-label="WORKSPACE">
          <button type="button" className="secondary" onClick={() => activateWorkspacePanel("bottom", "output")}>
            <span>Panel Layout</span>
          </button>
          <button type="button" className="secondary" onClick={() => setShortcutOverlayOpen(true)}>
            <span>Shortcuts</span>
            <kbd>?</kbd>
          </button>
        </div>
        <div className="toolbar-group" data-label="PERFORMANCE">
          <button type="button" className="secondary" onClick={togglePerformanceProfiler}>
            <Activity size={16} strokeWidth={2.2} />
            <span>{performanceProfilerEnabled ? "Hide Profiler" : "Profiler"}</span>
            <kbd>P</kbd>
          </button>
          <span className="toolbar-fps">{Math.round(performanceDiagnostics.fps)} FPS</span>
        </div>
      </div>

      {/* PERFORMANCE: GenerationWizardModal is a memoised component with its own
          useReducer — EditorCanvas never re-renders on wizard interactions. */}
      <GenerationWizardModal
        open={wizardOpen}
        defaultBylineName={document.metadata.newspaperName ?? ""}
        defaultLanguageMode="hindi"
        onClose={() => {
          setWizardOpen(false);
          setWizardPreferredTab(undefined);
          // Surface the zoom/fit controls the moment a page finishes
          // generating, so the user can immediately check it at a glance.
          setWorkspaceState((current) => activateDockPanel(current, "right", "navigator"));
        }}
        onGenerateStoryLayout={generateStoryLayout}
        onImportNewswireStories={handleImportNewswireStoriesWithSection}
        pages={wizardPageSummaries}
        activePageNumber={activePage?.pageNumber ?? 1}
        onSelectPageByNumber={selectPageByNumber}
        preferredTab={wizardPreferredTab}
      />



      {placementWarning ? (
        <div className="placement-warning" role="status">
          <span>{placementWarning}</span>
          <button
            type="button"
            onClick={clearPlacementWarning}
            aria-label="Dismiss placement warning"
            title="Dismiss"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}

      <div className="zoom-control" aria-label="Zoom controls">
        <button type="button" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
          <Minus size={17} strokeWidth={2.2} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
          <Plus size={17} strokeWidth={2.2} />
        </button>
      </div>

      <div className="edition-status-bar" aria-label="Edition status">
        <div className="status-zone status-zone-left">
          <span>{document.metadata.newspaperName}</span>
          <span>Edition {document.metadata.edition}</span>
          <span>Publication {document.publication}</span>
          <span>Workspace {workspaceState.workspaces.find((workspace) => workspace.id === workspaceState.activeWorkspaceId)?.name ?? "Editorial"}</span>
        </div>
        <div className="status-zone status-zone-center">
          <span>Page {activePage?.pageNumber ?? "-"} / {document.pages.length}</span>
          <span>Zoom {Math.round(zoom * 100)}%</span>
          <span>Stories {stories.length}</span>
          <span>Frames {activePageFrameCount}</span>
          <span>Selected Objects {selectedObjects.length}</span>
          <span>Assets {assetCount}</span>
          <span>Ads {advertisementCount}</span>
          <span>Guides {customGuides.filter((guide) => !guide.hidden).length}</span>
        </div>
        <div className="status-zone status-zone-right">
          <span>Selected {selectedFrameLabel}</span>
          <span>Context {selectedParagraphContext}</span>
          <span>Mouse {mouseCoordinatesLabel}</span>
          <label>Top <input type="number" value={pageSetupDraft.marginTop} step={0.01} onChange={(event) => setPageSetupDraft((current) => ({ ...current, marginTop: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label>Left <input type="number" value={pageSetupDraft.marginLeft} step={0.01} onChange={(event) => setPageSetupDraft((current) => ({ ...current, marginLeft: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label>Right <input type="number" value={pageSetupDraft.marginRight} step={0.01} onChange={(event) => setPageSetupDraft((current) => ({ ...current, marginRight: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label>Bottom <input type="number" value={pageSetupDraft.marginBottom} step={0.01} onChange={(event) => setPageSetupDraft((current) => ({ ...current, marginBottom: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <span>Tool {editingMode === "text" ? "Text" : typographyEditingScope === "selection" ? "Selection" : "Frame"}</span>
          <span>FPS {Math.round(performanceDiagnostics.fps)}</span>
          <span>Preflight {preflightErrorCount}</span>
          <span>Modified *</span>
        </div>
      </div>

      {!productionView && selectedStoryId && selectedViewportBounds && editingMode === "none" ? (
        <ObjectFloatingToolbar
          objectType={selectedObjectType}
          bounds={selectedViewportBounds}
          selectedCount={Math.max(1, selectedObjects.length)}
          onBold={() => applyObjectRichStyle({ bold: true })}
          onItalic={() => applyObjectRichStyle({ italic: true })}
          onUnderline={() => applyObjectRichStyle({ underline: true })}
          onTextColor={() => applyObjectRichStyle({ color: "#b42318" })}
          onFrameColor={() =>
            updateSelectedFrameStyle({
              frameMode: "frame",
              mode: "frame",
              frameBackgroundColor: "#fff3bf",
            })
          }
          onAlign={updateSelectedAlignment}
          onCopyStyle={copySelectedObjectStyle}
          onPasteStyle={pasteCopiedObjectStyle}
          onBringForward={() => reorderStory(selectedStoryId, "down")}
          onSendBackward={() => reorderStory(selectedStoryId, "up")}
        />
      ) : null}

      {inlineEditSession ? (
        <InlineObjectTextEditor
          objectType={inlineEditSession.objectType}
          bounds={inlineEditSession.bounds}
          textStyle={inlineEditSession.textStyle}
          zoom={zoom}
          value={inlineEditSession.value}
          onChange={(value) =>
            setInlineEditSession((current) => (current ? { ...current, value } : current))
          }
          onSelectionChange={(start, end) => {
            setSelectedRichTextRange({ start, end });
            setCaretPosition(end);
          }}
          onCommit={commitInlineEdit}
          onCancel={cancelInlineEdit}
        />
      ) : null}

      {pagePreview ? (
        <PagePreviewOverlay
          preview={pagePreview}
          pageLabel={`Page ${activePage?.pageNumber ?? "-"}`}
          onClose={closePagePreview}
        />
      ) : null}

      {imageReplacePopup ? (
        <div
          className="frame-manager-context-menu frame-canvas-context-menu image-replace-popup"
          style={{ left: imageReplacePopup.x + 8, top: imageReplacePopup.y + 8 }}
        >
          <button type="button" onClick={() => imageReplaceFileInputRef.current?.click()}>
            Replace Image
          </button>
          <button type="button" onClick={() => setImageReplacePopup(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      <input
        ref={imageReplaceFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleImageReplaceFileChange(event.target.files);
          event.target.value = "";
        }}
      />

      {frameContextMenu && selectedFrame ? (
        <div
          className="frame-manager-context-menu frame-canvas-context-menu"
          style={{ left: frameContextMenu.x, top: frameContextMenu.y }}
          onMouseLeave={() => setFrameContextMenu(null)}
        >
          <button type="button" onClick={() => { duplicateSelectedFrame(); setFrameContextMenu(null); }}>Duplicate</button>
          <button type="button" onClick={() => { deleteSelectedFrame(); setFrameContextMenu(null); }}>Delete</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { setFrameLocked(selectedFrame.id, !selectedFrame.locked); setFrameContextMenu(null); }}>
            {selectedFrame.locked ? "Unlock" : "Lock"}
          </button>
          <button type="button" onClick={() => { setFrameHidden(selectedFrame.id, !selectedFrame.hidden); setFrameContextMenu(null); }}>
            {selectedFrame.hidden ? "Show" : "Hide"}
          </button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { reorderFrameLayer(selectedFrame.id, "bring-forward"); setFrameContextMenu(null); }}>Bring Forward</button>
          <button type="button" onClick={() => { reorderFrameLayer(selectedFrame.id, "send-backward"); setFrameContextMenu(null); }}>Send Back</button>
          <button type="button" onClick={() => { reorderFrameLayer(selectedFrame.id, "bring-to-front"); setFrameContextMenu(null); }}>Bring To Front</button>
          <button type="button" onClick={() => { reorderFrameLayer(selectedFrame.id, "send-to-back"); setFrameContextMenu(null); }}>Send To Back</button>
          <span className="frame-manager-menu-separator" />
          <button type="button" onClick={() => { addGuide("vertical", selectedFrame.bounds.x); setFrameContextMenu(null); }}>Guide at Left Edge</button>
          <button type="button" onClick={() => { addGuide("horizontal", selectedFrame.bounds.y); setFrameContextMenu(null); }}>Guide at Top Edge</button>
          <button type="button" onClick={() => { setGuidesLocked((value) => !value); setFrameContextMenu(null); }}>
            {guidesLocked ? "Unlock Guides" : "Lock Guides"}
          </button>
          <span className="frame-manager-menu-separator" />
          <button type="button" disabled>Convert</button>
          <button type="button" disabled>Link Story</button>
          <button type="button" disabled>Detach Story</button>
          <button type="button" disabled>Fit Frame to Content</button>
          <button type="button" disabled>Fit Content to Frame</button>
          <button type="button" disabled>Center Content</button>
        </div>
      ) : null}

      {performanceProfilerEnabled ? (
        <PerformanceLayer>
          <PerformanceOverlay diagnostics={performanceDiagnostics} />
        </PerformanceLayer>
      ) : null}
    </main>
  );
}
