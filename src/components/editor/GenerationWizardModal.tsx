"use client";

/**
 * GenerationWizardModal
 *
 * PERFORMANCE: All wizard state lives here via a single useReducer.
 * EditorCanvas only holds a single `wizardOpen: boolean`.
 * This prevents the full 4,339-line canvas from re-rendering on every
 * wizard keystroke, checkbox tick, or tab switch.
 *
 * DO NOT add any canvas/story/Konva state here.
 * DO NOT modify any existing engine files.
 * This component is a CONSUMER of existing engines only.
 */

import {
  memo,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import {
  NEWSWIRE_CATEGORIES,
  NEWSWIRE_SUBHEADING_PRESETS,
  getPaletteInlineAccent,
  getPaletteSubheadingStyle,
  getPaletteTintColor,
  type NewswireCategory,
  type NewswireStory,
  type NewswireSubheadingPreset,
  type PageLanguageMode,
} from "@/lib/newswire";
import { getFallbackNewswireStories } from "@/lib/newswireFallback";
import { computeWeightedCategoryTargets, shuffleNewswireStories } from "@/lib/newswireCategoryMix";
import {
  addIssueArticleToExclusions,
  filterUnusedIssueArticles,
  getPortalLaunchParamFromWindow,
  isIssueArticleExcluded,
  loadIssueArticleExclusions,
  readPortalIssueArticleSession,
  type IssueArticleExclusions,
} from "@/lib/portalIssueArticleUsage";
import { generateTemplateLayout } from "@/engines/TemplateLayout/TemplateLayoutEngine";
import { FRONT_PAGE_TEMPLATE_IDS, getTemplateColumnCount } from "@/engines/TemplateLayout/TemplateRegistry";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import {
  YOUTH_UPDATE_FRONT_TEMPLATE_ID,
  YOUTH_UPDATE_INSIDE_TEMPLATE_IDS,
  YOUTH_UPDATE_INSIDE_TEMPLATE_ID,
  YOUTH_UPDATE_PUBLISHER_ID,
  isYouthUpdateFrontTemplateId,
  isYouthUpdateHeaderOnlyInsideTemplateId,
  isYouthUpdateInsideTemplateId,
} from "@/engines/MasterPage/YouthUpdateConfig";
import {
  YOUTH_UPDATE_MASTHEAD_HEIGHT_IN,
  YOUTH_UPDATE_MASTHEAD_HEIGHT_PT,
} from "@/engines/MasterPage/YouthUpdateMastheadGeometry";
import {
  YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_IN,
  YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_IN,
} from "@/engines/MasterPage/YouthUpdateInsideHeaderGeometry";
import {
  FRONT_HEADER_HEIGHT_IN,
  INSIDE_HEADER_HEIGHT_IN,
  FRONT_HEADER_HEIGHT_PT,
  INSIDE_HEADER_HEIGHT_PT,
} from "@/engines/HeaderSystem/HeaderGeometry";
import { NEWSPAPER_PAGE, POINTS_PER_INCH } from "@/utils/page";
import {
  PAGE_AD_PRESETS,
  PAGE_AD_PRESET_ORDER,
  type PageAdvertisement,
} from "@/engines/AdvertisementManager/PageAdvertisementPlacement";
import { composeEditorialPage } from "@/engines/EditorialPageComposer/EditorialPageComposer";
import { balanceHeadline } from "@/engines/TypographyEngine/TypographyEngine";
import { HEADLINE_HIERARCHY_LEVELS } from "@/engines/TypographyEngine/HeadlineHierarchyEngine";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import type { ArticleData } from "@/types/editor";
import type { PageKind } from "@/types/page";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { EditorialSlotPanel } from "./EditorialSlotPanel";
import { AdvertisementPagePanel } from "./AdvertisementPagePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardTab = "front" | "inside" | "editorial" | "advertisement";
type GenerationWizardStep = "layout" | "style" | "category";

/**
 * No tab has a standalone "count" step anymore — every layout card already
 * shows its own story count, and picking a layout (via its Select button)
 * sets the article count to match, the same way the front-page tab always
 * worked. Editorial/Advertisement don't use this step array at all (they
 * render their own panel unconditionally), so in practice this is shared by
 * every tab that does use the step flow.
 */
const WIZARD_STEPS: GenerationWizardStep[] = ["layout", "style", "category"];
const FRONT_WIZARD_STEPS: GenerationWizardStep[] = ["layout", "style", "category"];

const getWizardSteps = (_tab: WizardTab) => WIZARD_STEPS;

export type LayoutDesignCategory = "basic" | "advanced";

/**
 * Front-page-only designs. These reserve the ~6.1cm masthead band above row 1
 * (see HeaderGeometry / getPageKindContentBounds) and are never offered on the
 * inside-page tabs.
 */
export const WIZARD_FRONT_PAGE_DESIGNS: Array<{
  id: TemplateId;
  name: string;
  storyCount: number;
  description: string;
}> = [
  {
    id: "CliffFront8A",
    name: "द क्लिफ न्यूज़ फ्रंट पेज (8 बॉक्स)",
    storyCount: 8,
    description:
      "आठ बॉक्स वाला क्लिफ न्यूज़ पेज: ऊपर मुख्य खबर के साथ सार-समाचार रेल, बीच में एक चौड़ी पट्टी जो 3 │ 1 │ 2 में बंटी है, और नीचे के पैकेज के साथ कार्टून रेल।",
  },
  {
    id: "CliffFrontTwinRail10A",
    name: "ट्विन रेल",
    storyCount: 10,
    description:
      "दोनों किनारों पर रेल, बीच में मुख्य खबर। संतुलित और शांत डिज़ाइन, छोटी खबरों और स्थायी कॉलम के लिए दो अच्छी जगहें।",
  },
  {
    id: "CliffFrontBannerLead9A",
    name: "बैनर लीड",
    storyCount: 9,
    description:
      "मुख्य खबर ऊपर सभी छह कॉलम में फैली है, बाकी सब उसके नीचे। यह सबसे दमदार फ्रंट पेज है — जब कोई एक खबर पूरे दिन पर हावी हो।",
  },
  {
    id: "CliffFrontQuadrant7A",
    name: "क्वाड्रंट",
    storyCount: 6,
    description:
      "तीन लगभग बराबर पट्टियाँ, बड़े-बड़े ब्लॉक में बंटी हुईं, मुख्य खबर के साथ एक रेल। कम पर बड़े बॉक्स — जब दिन की खबरें भारी हों।",
  },
  {
    id: "CliffFrontMagazine6A",
    name: "मैगज़ीन कवर",
    storyCount: 6,
    description:
      "आधे पन्ने पर एक बड़ा पैकेज, ठीक मैगज़ीन कवर की तरह एक ही तस्वीर के साथ। कम खबरें, पर ज़्यादा असर।",
  },
  {
    id: "CliffFrontSplitVertical8A",
    name: "वर्टिकल स्प्लिट",
    storyCount: 8,
    description:
      "पूरा पन्ना दो लंबे हिस्सों में — बाईं तरफ तीन कॉलम में मुख्य खबर, दाईं तरफ दूसरी बड़ी खबर। बराबर वज़न की दो खबरों के लिए।",
  },
  {
    id: "CliffFrontSkybox10A",
    name: "स्काईबॉक्स टीज़र्स",
    storyCount: 10,
    description:
      "मुख्य खबर के ऊपर तीन छोटे टीज़र जो अंदर के पन्नों की ओर ले जाते हैं, नीचे मुख्य खबर पूरे पन्ने पर हावी रहती है।",
  },
  {
    id: "CliffFrontPyramid9A",
    name: "पिरामिड",
    storyCount: 9,
    description:
      "पन्ना जैसे-जैसे नीचे जाए, बॉक्स संकरे होते जाएं — पूरी चौड़ाई की मुख्य खबर, फिर आधे हिस्से, फिर छोटी खबरें, अंत में एक रेल और चौड़ा पैकेज।",
  },
  {
    id: "CliffFrontHeroPhoto7A",
    name: "हीरो फोटो",
    storyCount: 6,
    description:
      "आधे पन्ने पर एक बड़ी तस्वीर वाली मुख्य खबर, साथ में एक और खबर, और नीचे दो शांत पट्टियाँ। एक दमदार तस्वीर के लिए बनाया गया।",
  },
];

/**
 * True only when the wizard is running inside the SaaS portal launch for
 * Youth UPDATE's own publisher_id (see YouthUpdateConfig.ts). Reads the same
 * `publisherId` query param EditorCanvas.tsx's own `getPortalLaunchParam`
 * reads, directly and unmemoized, matching that established convention —
 * this value never changes over a session's lifetime.
 */
function isYouthUpdatePublisherSession(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("publisherId") === YOUTH_UPDATE_PUBLISHER_ID;
}

/**
 * Youth UPDATE's own front pages — publisher-exclusive, never shown to anyone
 * else. See the CliffFrontYouthUpdate definitions in TemplateRegistry.ts and
 * the masthead built into EditorCanvas/YouthUpdateMasthead for the rest of
 * this feature. All four share one masthead, one सम्पादकीय rail and one SHORT
 * NEWS rail; they differ only in how the rest of the page is made up.
 */
const YOUTH_UPDATE_FRONT_LAYOUTS: Array<{
  id: TemplateId;
  name: string;
  storyCount: number;
  description: string;
}> = [
  {
    id: YOUTH_UPDATE_FRONT_TEMPLATE_ID,
    name: "Youth UPDATE — फ्रंट पेज",
    storyCount: 8,
    description:
      "इस पब्लिशर का अपना फ्रंट पेज: पूरा कोडेड मास्टहेड (Youth UPDATE वर्डमार्क, टैगलाइन, चार टीज़र बॉक्स, सूचना पट्टी), सम्पादकीय और शॉर्ट न्यूज़ रेल, मुख्य खबर, और नीचे तीन-भाग वाली पट्टी।",
  },
  {
    id: "CliffFrontYouthUpdate2A",
    name: "Youth UPDATE — दो-भाग ऊपरी पट्टी",
    storyCount: 8,
    description:
      "वही मास्टहेड, वही सम्पादकीय और शॉर्ट न्यूज़ रेल। ऊपर मुख्य खबर के साथ दाईं ओर एक लंबी दूसरी खबर, बीच की पट्टी उल्टे अनुपात में बँटी, और नीचे दो बराबर हिस्से।",
  },
  {
    id: "CliffFrontYouthUpdate3A",
    name: "Youth UPDATE — चौड़ी लीड, चार-भाग पट्टी",
    storyCount: 8,
    description:
      "वही मास्टहेड और दोनों रेल। मुख्य खबर पूरी पाँच कॉलम चौड़ी, उसके नीचे चार खबरों वाली पट्टी (2-2-1), और नीचे दो बराबर हिस्से।",
  },
  {
    id: "CliffFrontYouthUpdate4A",
    name: "Youth UPDATE — दाईं ओर लीड",
    storyCount: 8,
    description:
      "वही मास्टहेड और दोनों रेल। मुख्य खबर दाईं ओर लंगर डाले, उसके बगल में दो कॉलम की खबर, बीच की पट्टी चौड़ी-से-सँकरी, और नीचे 2 + 4 का असमान बँटवारा।",
  },
];

/**
 * The front-page design catalogue the picker actually offers this session.
 * Youth UPDATE sees only its own exclusive designs and nothing else — every
 * other publisher sees the shared catalogue exactly as before, unchanged.
 */
function getFrontPageDesigns(): typeof WIZARD_FRONT_PAGE_DESIGNS {
  return isYouthUpdatePublisherSession() ? YOUTH_UPDATE_FRONT_LAYOUTS : WIZARD_FRONT_PAGE_DESIGNS;
}

/**
 * Youth UPDATE's own inside page — publisher-exclusive, never shown to
 * anyone else. See CliffInsideYouthUpdate1A in TemplateRegistry.ts.
 *
 * `storyCount: 12`, not the template's real 7 -- this drives `state.
 * articleCount` (see the SET_LAYOUT reducer case below), which sets the
 * live-fetch `limit`. The template only has 7 real composed slots; the 5
 * extra articles this over-fetch produces are split in editorStore.ts after
 * the normal 7 are assigned: 3 for the SHORT NEWS rail's live content, 2 for
 * the teaser strip's two right-hand cards' live image+subheadline. Every
 * non-header-only Youth UPDATE inside layout below got the same +2 bump for
 * the teaser cards, on top of whatever margin it already had for the rail.
 */
const YOUTH_UPDATE_INSIDE_LAYOUT: {
  id: TemplateId;
  name: string;
  storyCount: number;
  category: LayoutDesignCategory;
} = {
  id: YOUTH_UPDATE_INSIDE_TEMPLATE_ID,
  name: "Youth UPDATE — इनसाइड पेज",
  storyCount: 12,
  category: "basic",
};

const YOUTH_UPDATE_INSIDE_LAYOUTS: Array<{
  id: TemplateId;
  name: string;
  storyCount: number;
  category: LayoutDesignCategory;
}> = [
  YOUTH_UPDATE_INSIDE_LAYOUT,
  { id: "CliffInsideYouthUpdate2A", name: "Youth UPDATE - Inside 2A", storyCount: 12, category: "basic" },
  { id: "CliffInsideYouthUpdate3A", name: "Youth UPDATE - Inside 3A", storyCount: 13, category: "basic" },
  { id: "CliffInsideYouthUpdate4A", name: "Youth UPDATE - Inside 4A", storyCount: 11, category: "basic" },
  { id: "CliffInsideYouthUpdate5A", name: "Youth UPDATE - Inside 5A", storyCount: 12, category: "basic" },
  { id: "CliffInsideYouthUpdate6A", name: "Youth UPDATE - Inside 6A", storyCount: 13, category: "basic" },
  { id: "CliffInsideYouthUpdate7A", name: "Youth UPDATE - Inside 7A", storyCount: 11, category: "basic" },
  { id: "CliffInsideYouthUpdate8A", name: "Youth UPDATE - Header Only 8A", storyCount: 9, category: "advanced" },
  { id: "CliffInsideYouthUpdate9A", name: "Youth UPDATE - Header Only 9A", storyCount: 8, category: "advanced" },
  { id: "CliffInsideYouthUpdate10A", name: "Youth UPDATE - Header Only 10A", storyCount: 10, category: "advanced" },
  { id: "CliffInsideYouthUpdate11A", name: "Youth UPDATE - Header Only 11A", storyCount: 6, category: "advanced" },
];

/**
 * The inside-page design catalogue the picker actually offers this session.
 * Mirrors getFrontPageDesigns() exactly: Youth UPDATE sees only its own
 * exclusive design, every other publisher sees the shared catalogue
 * unchanged.
 */
function getInsideDesigns(): typeof WIZARD_LAYOUT_DESIGNS {
  return isYouthUpdatePublisherSession() ? YOUTH_UPDATE_INSIDE_LAYOUTS : WIZARD_LAYOUT_DESIGNS;
}

/**
 * Editorial-page-only designs, offered on the Editorial Page tab and nowhere
 * else. Kept out of both the front-page and the inside-page catalogues so those
 * two are unchanged.
 */
export const WIZARD_EDITORIAL_PAGE_DESIGNS: Array<{
  id: TemplateId;
  name: string;
  storyCount: number;
  description: string;
}> = [
  {
    id: "CliffEditorial8A",
    name: "अभिव्यक्ति — संपादकीय पृष्ठ",
    storyCount: 6,
    description:
      "08 अगस्त 2026 के संस्करण के पृष्ठ 8 से लिया गया: एक सम्पादकीय लीडर रेल पूरी गहराई तक, साथ में हस्ताक्षरित विचार मंथन टिप्पणी, नीचे फ़ीचर और आज का राशिफल, और पन्ने के अंत में तीन पैकेज।",
  },
  {
    id: "CliffEditorial9A",
    name: "Editorial — Modern Uneven (9A)",
    storyCount: 6,
    description:
      "A modern, highly uneven mosaic layout: Left Rail, Center Op-Ed (with embedded horoscope), and Right Rail at the top, abruptly broken by a full-span Cartoon and Letters block underneath.",
  },
];

// A function, not a frozen constant: Youth UPDATE's default front-page design
// depends on the session's publisherId, which getFrontPageDesigns() re-checks
// every call rather than deciding once at module load.
const getDefaultFrontLayout = () => getFrontPageDesigns()[0];
const DEFAULT_EDITORIAL_LAYOUT = WIZARD_EDITORIAL_PAGE_DESIGNS[0];
const DEFAULT_INSIDE_LAYOUT: TemplateId = "IndianFront6A";
const DEFAULT_INSIDE_ARTICLE_COUNT = 6;

const INCHES_TO_CM = 2.54;
const FRONT_HEADER_CM = FRONT_HEADER_HEIGHT_IN * INCHES_TO_CM;
const INSIDE_HEADER_CM = INSIDE_HEADER_HEIGHT_IN * INCHES_TO_CM;
/** Share of the preview thumbnail taken up by the masthead band. */
const MASTHEAD_PREVIEW_FRACTION = FRONT_HEADER_HEIGHT_IN / NEWSPAPER_PAGE.heightInches;
/** Same, for Youth UPDATE's own taller coded masthead. */
const YOUTH_UPDATE_MASTHEAD_PREVIEW_FRACTION = YOUTH_UPDATE_MASTHEAD_HEIGHT_IN / NEWSPAPER_PAGE.heightInches;
/** Same, for Youth UPDATE's own inside-page header + teaser strip. */
const YOUTH_UPDATE_INSIDE_MASTHEAD_PREVIEW_FRACTION =
  YOUTH_UPDATE_INSIDE_RESERVED_HEIGHT_IN / NEWSPAPER_PAGE.heightInches;
const YOUTH_UPDATE_INSIDE_HEADER_ONLY_PREVIEW_FRACTION =
  YOUTH_UPDATE_INSIDE_HEADER_ONLY_RESERVED_HEIGHT_IN / NEWSPAPER_PAGE.heightInches;

/** Inside / Editorial / Advertisement page designs. */
export const WIZARD_LAYOUT_DESIGNS: Array<{
  id: TemplateId;
  name: string;
  storyCount: number;
  category: LayoutDesignCategory;
}> = [
  { id: "IndianFront6A", name: "इंडियन फ्रंट 6A", storyCount: 6, category: "basic" },
  { id: "IndianFront7A", name: "इंडियन फ्रंट 7A", storyCount: 6, category: "basic" },
  { id: "IndianFront7B", name: "इंडियन फ्रंट 7B", storyCount: 6, category: "basic" },
  { id: "IndianMixed7A", name: "इंडियन मिक्स्ड 7A", storyCount: 6, category: "basic" },
  { id: "IndianFront8B", name: "इंडियन फ्रंट 8B", storyCount: 8, category: "basic" },
  { id: "IndianCity5A", name: "इंडियन सिटी 5A", storyCount: 5, category: "basic" },
  { id: "IndianCity6A", name: "इंडियन सिटी 6A", storyCount: 6, category: "basic" },
  { id: "IndianColumn5A", name: "इंडियन कॉलम 5A", storyCount: 5, category: "basic" },
  { id: "IndianBalance6A", name: "इंडियन बैलेंस 6A", storyCount: 6, category: "basic" },
  {
    id: "ProfessionalNews10A",
    name: "प्रोफेशनल न्यूज़पेपर लेआउट (9 खबरें)",
    storyCount: 9,
    category: "basic",
  },
  { id: "Layout16", name: "लेआउट 16", storyCount: 6, category: "basic" },
  // ── एडवांस्ड डिज़ाइन — दैनिक भास्कर और टाइम्स ऑफ़ इंडिया से प्रेरित ──
  { id: "AdvancedHeroRail7A", name: "एडवांस्ड हीरो रेल 7A", storyCount: 6, category: "advanced" },
  { id: "AdvancedSidebarFeature9A", name: "एडवांस्ड साइडबार फ़ीचर 9A", storyCount: 9, category: "advanced" },
  { id: "AdvancedMagazineCover6A", name: "एडवांस्ड मैगज़ीन कवर 6A", storyCount: 6, category: "advanced" },
  { id: "AdvancedInfographicSplit7A", name: "एडवांस्ड इन्फोग्राफिक स्प्लिट 7A", storyCount: 6, category: "advanced" },
  { id: "AdvancedEditorialColumn7A", name: "एडवांस्ड एडिटोरियल कॉलम 7A", storyCount: 6, category: "advanced" },
  { id: "AdvancedQuadMosaic7A", name: "एडवांस्ड क्वाड मोज़ाइक 7A", storyCount: 6, category: "advanced" },
];

const WIZARD_ACCENT_PRESETS = NEWSWIRE_SUBHEADING_PRESETS.filter(
  (preset) => preset.id !== "custom",
);

const PAGE_LANGUAGE_OPTIONS: Array<{
  value: PageLanguageMode;
  label: string;
  description: string;
}> = [
  { value: "hindi", label: "हिंदी", description: "सभी लेख हिंदी में बनाएं।" },
  { value: "english", label: "अंग्रेज़ी", description: "सभी लेख अंग्रेज़ी में बनाएं।" },
  { value: "bilingual", label: "द्विभाषी", description: "अंग्रेज़ी और हिंदी लेख बारी-बारी से रखें।" },
];

const isClassifiedLocalMixPage = (): boolean => {
  const value = [
    getPortalLaunchParamFromWindow("selectedPageName"),
    getPortalLaunchParamFromWindow("selectedPageCategory"),
    getPortalLaunchParamFromWindow("pageKind"),
  ].join(" ");
  return /classified|classifed|आस|पास|aas|ass\s*pass|aas\s*paas/i.test(value);
};

const getInsideFetchCategories = (selectedCategory: NewswireCategory): NewswireCategory[] =>
  isClassifiedLocalMixPage() ? ["Madhya Pradesh", "National"] : [selectedCategory];

const getInsideImportCategory = (selectedCategory: NewswireCategory, languageMode: PageLanguageMode): string => {
  if (!isClassifiedLocalMixPage()) return selectedCategory;
  return languageMode === "hindi" ? "आस-पास" : "Classifieds";
};

const selectFreshFallbackStories = (
  category: string,
  limit: number,
  exclusions: IssueArticleExclusions,
): NewswireStory[] => {
  const candidates = getFallbackNewswireStories(category, limit * 3 + 6, exclusions.articleIds);
  return filterUnusedIssueArticles(candidates, exclusions).slice(0, limit);
};

const collectFreshStories = (
  articles: NewswireStory[],
  needed: number,
  exclusions: IssueArticleExclusions,
): NewswireStory[] => {
  const collected: NewswireStory[] = [];
  for (const article of articles) {
    if (collected.length >= needed) break;
    if (isIssueArticleExcluded(article, exclusions)) continue;
    collected.push(article);
    addIssueArticleToExclusions(article, exclusions);
  }
  return collected;
};

// ─── Manual box seeder: real per-box geometry + headline fit-checking ─────────
//
// Mirrors editorStore.ts's `getPageKindContentBounds`/`PAGE_BOUNDS`/gutter math
// exactly (same constants, same formula) so the slot array this produces is
// byte-identical in count and order to the one `importNewswireStories` builds
// at import time — required for `manualTargetSlotIndex` (slot array index) to
// actually point at the box the writer saw on this screen.

const toBoxPoints = (inches: number) => inches * POINTS_PER_INCH;
const MANUAL_SEEDER_CONTENT_BOUNDS_PT = {
  x: toBoxPoints(DEFAULT_PAGE_MASTER.contentX),
  y: toBoxPoints(DEFAULT_PAGE_MASTER.contentY),
  width: toBoxPoints(DEFAULT_PAGE_MASTER.contentWidth),
  height: toBoxPoints(DEFAULT_PAGE_MASTER.contentHeight),
};
// Matches editorStore.ts's PAGE_HEADER_CLEARANCE_PT — the gap between an
// inside page's folio strip and its first story. Front pages don't use this.
const MANUAL_SEEDER_HEADER_CLEARANCE_PT = 10;

const getManualSeederContentBounds = (tab: "front" | "inside", templateId?: TemplateId) => {
  // Youth UPDATE's coded masthead reserves more depth than the standard front
  // band (see getPageKindContentBounds's own override in editorStore.ts) — the
  // seeder's box geometry has to start below the same line the real page does,
  // or its previewed boxes won't match what actually renders.
  const frontHeaderHeight = isYouthUpdateFrontTemplateId(templateId)
    ? YOUTH_UPDATE_MASTHEAD_HEIGHT_PT
    : FRONT_HEADER_HEIGHT_PT;
  const y =
    tab === "front"
      ? Math.max(MANUAL_SEEDER_CONTENT_BOUNDS_PT.y, frontHeaderHeight)
      : Math.max(
          MANUAL_SEEDER_CONTENT_BOUNDS_PT.y,
          INSIDE_HEADER_HEIGHT_PT + MANUAL_SEEDER_HEADER_CLEARANCE_PT,
        );

  return {
    x: MANUAL_SEEDER_CONTENT_BOUNDS_PT.x,
    y,
    width: MANUAL_SEEDER_CONTENT_BOUNDS_PT.width,
    height: Math.max(
      0,
      MANUAL_SEEDER_CONTENT_BOUNDS_PT.y + MANUAL_SEEDER_CONTENT_BOUNDS_PT.height - y,
    ),
  };
};

export type ManualBoxGeometry = {
  /** Array index into `generateTemplateLayout`'s slots — also `manualTargetSlotIndex`. */
  slotIndex: number;
  storyNumber: number;
  columnSpan: number;
  widthPt: number;
  heightPt: number;
  /** Nested sidebars aren't offered in the seeder — targeting them precisely isn't supported yet. */
  isNestedSidebar: boolean;
};

/** Real per-box geometry for the currently selected layout, front/inside tabs only. */
const getManualBoxGeometry = (
  tab: "front" | "inside",
  templateId: TemplateId,
): ManualBoxGeometry[] => {
  const bounds = getManualSeederContentBounds(tab, templateId);
  const columnCount = getTemplateColumnCount(templateId, DEFAULT_PAGE_MASTER.columns);
  const layout = generateTemplateLayout({
    templateId,
    pageWidth: toBoxPoints(DEFAULT_PAGE_MASTER.width),
    contentX: bounds.x,
    contentY: bounds.y,
    contentWidth: bounds.width,
    contentHeight: bounds.height,
    columnCount,
    gutter: toBoxPoints(DEFAULT_PAGE_MASTER.gutter),
  });

  return layout.slots.map((slot: any, slotIndex: number) => ({
    slotIndex,
    storyNumber: slot.storyNumber,
    columnSpan: slot.columnSpan,
    widthPt: slot.width,
    heightPt: slot.height,
    isNestedSidebar: typeof slot.insetParentStoryNumber === "number",
  }));
};

const getRequiredNewswireStoryCount = (
  tab: WizardTab,
  templateId: TemplateId,
  configuredCount: number,
): number => {
  if (tab !== "front" && tab !== "inside") {
    return configuredCount;
  }

  return Math.max(configuredCount, getManualBoxGeometry(tab, templateId).length);
};

/**
 * Headline hierarchy tier a box this wide would render at — used only for
 * its `subheadlineSizeRatio` (how much smaller a subheadline sits under its
 * headline), not for headline sizing itself; see `checkHeadlineFit` for why
 * the headline check uses the composer's real font-size floor instead.
 */
const getHeadlineTierForColumnSpan = (columnSpan: number) => {
  if (columnSpan >= 4) return HEADLINE_HIERARCHY_LEVELS.hero;
  if (columnSpan === 3) return HEADLINE_HIERARCHY_LEVELS.strong;
  if (columnSpan === 2) return HEADLINE_HIERARCHY_LEVELS.medium;
  return HEADLINE_HIERARCHY_LEVELS.small;
};

const MANUAL_BOX_HEADLINE_MAX_LINES = 2;
const MANUAL_BOX_TEXT_PADDING_PT = 8;
/** Uniform floor/ceiling applied to every headline regardless of box width — on top of, not instead of, the real per-box fit check below. */
const MANUAL_HEADLINE_MIN_WORDS = 5;
const MANUAL_HEADLINE_MAX_WORDS = 20;
/** Matches composeArticleBox.ts's `isSingleColumnHeadlineBox` cutoff exactly. */
const SINGLE_COLUMN_WIDTH_RATIO = 0.22;
/** Matches composeArticleBox.ts's `SINGLE_COLUMN_HEADLINE_MAX_WORDS` — a single-column box silently truncates past this at render time, so the seeder enforces the same ceiling instead of letting the renderer cut it invisibly. */
const MANUAL_SINGLE_COLUMN_HEADLINE_MAX_WORDS = 8;
/** Matches composeArticleBox.ts's `headlineMinFontSize` floor — the smallest size the real composer will ever shrink a headline to before giving up. */
const RENDER_HEADLINE_MIN_FONT_SIZE_NARROW = 12;
const RENDER_HEADLINE_MIN_FONT_SIZE_WIDE = 8;

export type HeadlineFitCheck = {
  fits: boolean;
  reason: string | null;
  wrappedLines: string[];
};

/**
 * Runs real text through the same wrap/overflow/orphan-word engine the page
 * renders with (`balanceHeadline`), at this box's real width — using the
 * SAME font-size FLOOR the real composer shrinks down to before giving up
 * (8pt for most boxes, 12pt for single-column ones), not a tier's largest
 * size. Testing at the largest size tests the wrong direction: a bigger font
 * eats more room, so it rejects headlines the real, auto-shrinking renderer
 * would have happily fit at a smaller size. Empty text always "fits"
 * (nothing to reject). Headlines also get the word-count rule, checked
 * first since it's the simpler, more predictable failure to explain — 5–20
 * words normally, or the same 8-word ceiling composeArticleBox.ts already
 * enforces for single-column boxes.
 */
const checkHeadlineFit = (
  text: string,
  box: ManualBoxGeometry,
  kind: "headline" | "subheadline" = "headline",
): HeadlineFitCheck => {
  const trimmed = text.trim();

  if (!trimmed) {
    return { fits: true, reason: null, wrappedLines: [] };
  }

  const isSingleColumnBox = box.widthPt / MANUAL_SEEDER_CONTENT_BOUNDS_PT.width < SINGLE_COLUMN_WIDTH_RATIO;

  if (kind === "headline") {
    const wordCount = trimmed.split(/\s+/u).filter(Boolean).length;
    const maxWords = isSingleColumnBox ? MANUAL_SINGLE_COLUMN_HEADLINE_MAX_WORDS : MANUAL_HEADLINE_MAX_WORDS;
    if (wordCount < MANUAL_HEADLINE_MIN_WORDS) {
      return { fits: false, reason: `Needs at least ${MANUAL_HEADLINE_MIN_WORDS} words.`, wrappedLines: [] };
    }
    if (wordCount > maxWords) {
      return {
        fits: false,
        reason: isSingleColumnBox
          ? `This narrow box only holds ${maxWords} words — longer headlines get cut off.`
          : `Keep it to ${maxWords} words or fewer.`,
        wrappedLines: [],
      };
    }
  }

  const tier = getHeadlineTierForColumnSpan(box.columnSpan);
  const fontFloor = isSingleColumnBox ? RENDER_HEADLINE_MIN_FONT_SIZE_NARROW : RENDER_HEADLINE_MIN_FONT_SIZE_WIDE;
  const fontSize = kind === "headline" ? fontFloor : Math.max(7, Math.round(fontFloor * tier.subheadlineSizeRatio));
  const availableWidth = Math.max(1, box.widthPt - MANUAL_BOX_TEXT_PADDING_PT * 2);
  const maxLines = MANUAL_BOX_HEADLINE_MAX_LINES;

  const result = balanceHeadline({
    headline: trimmed,
    availableWidth,
    fontSize,
    fontFamily: getNewspaperFontStack("serif"),
    maxLines,
    autoBalance: true,
  });

  if (result.overflow) {
    return {
      fits: false,
      reason: `Too long for this box at a readable size — try fewer words.`,
      wrappedLines: result.wrappedLines,
    };
  }

  // balanceHeadline already prefers whatever candidate avoids a lone final
  // word when one exists (its own singleWordFinalLinePenalty) — this only
  // fires when every fitting wrap is forced into one, i.e. genuinely cornered.
  const finalLineWordCount = result.wrappedLines.at(-1)?.trim().split(/\s+/u).filter(Boolean).length ?? 0;
  if (result.wrappedLines.length > 1 && finalLineWordCount <= 1) {
    return {
      fits: false,
      reason: "Leaves an awkward single word on its own line — try a shorter phrase.",
      wrappedLines: result.wrappedLines,
    };
  }

  return { fits: true, reason: null, wrappedLines: result.wrappedLines };
};

// ─── Wizard State (single useReducer — replaces 14 useState hooks) ────────────

type WizardState = {
  tab: WizardTab;
  step: GenerationWizardStep;
  articleCount: number;
  layoutDesign: TemplateId;
  subheadingStyle: NewswireSubheadingPreset;
  subheadingOpacity: number;
  colouredHeadings: boolean;
  tintedStoryBackground: boolean;
  inlineColumnSubheadings: boolean;
  professionalJustification: boolean;
  category: NewswireCategory;
  layoutDesignCategory: LayoutDesignCategory;
  languageMode: PageLanguageMode;
  bylineName: string;
  loading: boolean;
  error: string | null;
  /** Keyed by `ManualBoxGeometry.slotIndex`. Cleared whenever the layout/tab changes box geometry. */
  manualBoxEntries: Record<number, ManualBoxEntry>;
  /** Advertisements embedded within this generated page (front/inside/editorial), separate from the dedicated Advertisement Page tab. A publisher can add several; they're shelf-packed from the bottom-right corner. Cleared on tab switch — ads sized for one page kind's content bounds don't carry over. */
  pageAdvertisements: PageAdvertisementState[];
};

export type PageAdvertisementState = {
  id: string;
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  presetKey: keyof typeof PAGE_AD_PRESETS;
};

export type ManualBoxEntry = {
  headline: string;
  subheadline: string;
  /** Feeds the same `place` field wire content uses — prints as the location half of the byline. */
  place: string;
  body: string;
  imageUrl: string;
  imageCaption: string;
};

export const emptyManualBoxEntry = (): ManualBoxEntry => ({
  headline: "",
  subheadline: "",
  place: "",
  body: "",
  imageUrl: "",
  imageCaption: "",
});

export type WizardAction =
  | { type: "SET_TAB"; tab: WizardTab }
  | { type: "SET_STEP"; step: GenerationWizardStep }
  | { type: "SET_LAYOUT"; layout: TemplateId; storyCount?: number }
  | { type: "SET_LAYOUT_DESIGN_CATEGORY"; layoutDesignCategory: LayoutDesignCategory }
  | { type: "SET_SUBHEADING_STYLE"; style: NewswireSubheadingPreset }
  | { type: "SET_SUBHEADING_OPACITY"; opacity: number }
  | { type: "TOGGLE_COLOURED_HEADINGS"; value: boolean }
  | { type: "TOGGLE_TINTED_BACKGROUND"; value: boolean }
  | { type: "TOGGLE_INLINE_SUBHEADINGS"; value: boolean }
  | { type: "TOGGLE_JUSTIFICATION"; value: boolean }
  | { type: "SET_CATEGORY"; category: NewswireCategory }
  | { type: "SET_LANGUAGE"; language: PageLanguageMode }
  | { type: "SET_BYLINE"; name: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET_ERROR" }
  | { type: "SET_MANUAL_BOX_FIELD"; slotIndex: number; patch: Partial<ManualBoxEntry> }
  | { type: "CLEAR_MANUAL_BOX"; slotIndex: number }
  | { type: "ADD_PAGE_ADVERTISEMENT"; ad: PageAdvertisementState }
  | { type: "REMOVE_PAGE_ADVERTISEMENT"; id: string }
  | { type: "SET_PAGE_AD_PRESET"; id: string; presetKey: keyof typeof PAGE_AD_PRESETS };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_TAB": {
      if (action.tab === state.tab) {
        return { ...state, error: null };
      }

      // Front, editorial and inside each draw from their own layout catalogue,
      // so a tab switch has to swap the selected template too — otherwise a tab
      // would open holding a template that its own picker never lists, and the
      // selection would look lost.
      const movingToFront = action.tab === "front";
      const movingToEditorial = action.tab === "editorial";
      const movingToInside = !movingToFront && !movingToEditorial;
      const cameFromOwnCatalogue = state.tab === "front" || state.tab === "editorial";

      const defaultFrontLayout = getDefaultFrontLayout();
      const layoutDesign = movingToFront
        ? defaultFrontLayout.id
        : movingToEditorial
          ? DEFAULT_EDITORIAL_LAYOUT.id
          : cameFromOwnCatalogue
            ? DEFAULT_INSIDE_LAYOUT
            : state.layoutDesign;
      const articleCount = movingToFront
        ? getRequiredNewswireStoryCount("front", defaultFrontLayout.id, defaultFrontLayout.storyCount)
        : movingToEditorial
          ? DEFAULT_EDITORIAL_LAYOUT.storyCount
          : cameFromOwnCatalogue
            ? getRequiredNewswireStoryCount("inside", DEFAULT_INSIDE_LAYOUT, DEFAULT_INSIDE_ARTICLE_COUNT)
            : state.articleCount;

      return {
        ...state,
        tab: action.tab,
        step: (movingToFront || (movingToInside && cameFromOwnCatalogue)) ? "layout" : state.step,
        layoutDesign,
        articleCount,
        // A different tab's boxes are a different shape entirely — manual
        // entries keyed by slot index would silently point at the wrong box.
        manualBoxEntries: layoutDesign !== state.layoutDesign ? {} : state.manualBoxEntries,
        // Ads sized against one page kind's content bounds (front's masthead
        // band vs inside/editorial's folio strip) don't carry over cleanly.
        pageAdvertisements: action.tab !== state.tab ? [] : state.pageAdvertisements,
        error: null,
      };
    }
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_LAYOUT":
      return {
        ...state,
        layoutDesign: action.layout,
        articleCount: getRequiredNewswireStoryCount(
          state.tab,
          action.layout,
          action.storyCount ?? state.articleCount,
        ),
        // A new layout means a new set of boxes at different slot indices —
        // any manual entries typed for the previous layout no longer refer to
        // anything real, so they're cleared rather than silently mismatched.
        manualBoxEntries: action.layout !== state.layoutDesign ? {} : state.manualBoxEntries,
        error: null,
      };
    case "SET_LAYOUT_DESIGN_CATEGORY":
      return { ...state, layoutDesignCategory: action.layoutDesignCategory, error: null };
    case "SET_SUBHEADING_STYLE":
      return {
        ...state,
        subheadingStyle: action.style,
      };
    case "SET_SUBHEADING_OPACITY":
      return { ...state, subheadingOpacity: action.opacity };
    case "TOGGLE_COLOURED_HEADINGS":
      return { ...state, colouredHeadings: action.value };
    case "TOGGLE_TINTED_BACKGROUND":
      return { ...state, tintedStoryBackground: action.value };
    case "TOGGLE_INLINE_SUBHEADINGS":
      return { ...state, inlineColumnSubheadings: action.value };
    case "TOGGLE_JUSTIFICATION":
      return { ...state, professionalJustification: action.value };
    case "SET_CATEGORY":
      return { ...state, category: action.category };
    case "SET_LANGUAGE":
      return { ...state, languageMode: action.language };
    case "SET_BYLINE":
      return { ...state, bylineName: action.name };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "RESET_ERROR":
      return { ...state, error: null };
    case "SET_MANUAL_BOX_FIELD": {
      const existing = state.manualBoxEntries[action.slotIndex] ?? emptyManualBoxEntry();
      return {
        ...state,
        manualBoxEntries: {
          ...state.manualBoxEntries,
          [action.slotIndex]: { ...existing, ...action.patch },
        },
      };
    }
    case "CLEAR_MANUAL_BOX": {
      const next = { ...state.manualBoxEntries };
      delete next[action.slotIndex];
      return { ...state, manualBoxEntries: next };
    }
    case "ADD_PAGE_ADVERTISEMENT":
      return { ...state, pageAdvertisements: [...state.pageAdvertisements, action.ad] };
    case "REMOVE_PAGE_ADVERTISEMENT":
      return {
        ...state,
        pageAdvertisements: state.pageAdvertisements.filter((ad) => ad.id !== action.id),
      };
    case "SET_PAGE_AD_PRESET":
      return {
        ...state,
        pageAdvertisements: state.pageAdvertisements.map((ad) =>
          ad.id === action.id ? { ...ad, presetKey: action.presetKey } : ad,
        ),
      };
    default:
      return state;
  }
}

function createInitialWizardState(defaultByline: string): WizardState {
  const defaultFrontLayout = getDefaultFrontLayout();
  return {
    // The wizard opens on the Front Page tab, which starts at its layout step.
    tab: "front",
    step: "layout",
    articleCount: defaultFrontLayout.storyCount,
    layoutDesign: defaultFrontLayout.id,
    layoutDesignCategory: "basic",
    subheadingStyle: WIZARD_ACCENT_PRESETS[0],
    subheadingOpacity: 100,
    colouredHeadings: false,
    tintedStoryBackground: true,
    inlineColumnSubheadings: true,
    professionalJustification: true,
    category: "Sports",
    languageMode: "hindi",
    bylineName: defaultByline,
    loading: false,
    error: null,
    manualBoxEntries: {},
    pageAdvertisements: [],
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type NewswireImportOptions = {
  templateId?: TemplateId;
  languageMode?: PageLanguageMode;
  bylineName?: string;
  colouredHeadings?: boolean;
  tintedStoryBackground?: boolean;
  tintColor?: string;
  inlineColumnSubheadings?: boolean;
  inlineSubheadingColor?: string;
  palettePreset?: NewswireSubheadingPreset;
  subheadingStyle: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    backgroundOpacity: number;
  };
  headlineAlignment?: ArticleData["typography"]["headlineAlignment"];
  bodyAlignment?: ArticleData["typography"]["bodyAlignment"];
  professionalJustification?: boolean;
  customLayout?: { slots: any[] };
  customStories?: any[];
  /** "front" reserves the masthead band and retypes the page as the front page. */
  pageKind?: PageKind;
  /** Advertisements to embed within this page (front/inside/editorial) — see PageAdvertisementPlacement. */
  pageAdvertisements?: PageAdvertisement[];
};

export type WizardPageSummary = {
  id: string;
  pageNumber: number;
  pageType: "front" | "state" | "city" | "national" | "sports" | "editorial";
  sectionName?: string;
};

type GenerationWizardModalProps = {
  open: boolean;
  defaultBylineName: string;
  defaultLanguageMode: PageLanguageMode;
  onClose: () => void;
  onGenerateStoryLayout: (count: number) => void;
  onImportNewswireStories: (
    category: string,
    articles: NewswireStory[],
    options: NewswireImportOptions,
  ) => void;
  /** The document's current page list, for the Advertisement Page tab's "attach to page N" header picker. */
  pages: WizardPageSummary[];
  activePageNumber: number;
  onSelectPageByNumber: (pageNumber: number) => void;
};

// ─── Layout Preview (lazy — computed only when modal opens) ───────────────────

function useLayoutPreviews() {
  return useMemo(() => {
    const map = new Map<
      TemplateId,
      Array<{
        storyNumber: number;
        left: string;
        top: string;
        width: string;
        height: string;
      }>
    >();
    for (const layout of [
      ...YOUTH_UPDATE_FRONT_LAYOUTS,
      ...YOUTH_UPDATE_INSIDE_LAYOUTS,
      ...WIZARD_FRONT_PAGE_DESIGNS,
      ...WIZARD_EDITORIAL_PAGE_DESIGNS,
      ...WIZARD_LAYOUT_DESIGNS,
    ]) {
      // Front-page previews are drawn below the masthead band so the thumbnail
      // shows the same header reservation the generated page will have. Youth
      // UPDATE's own masthead is taller than the standard front band, and its
      // inside page's own header+teaser strip is taller than the generic
      // folio strip.
      const headerReserve =
        isYouthUpdateFrontTemplateId(layout.id)
          ? YOUTH_UPDATE_MASTHEAD_PREVIEW_FRACTION * 1000
          : isYouthUpdateHeaderOnlyInsideTemplateId(layout.id)
            ? YOUTH_UPDATE_INSIDE_HEADER_ONLY_PREVIEW_FRACTION * 1000
          : (YOUTH_UPDATE_INSIDE_TEMPLATE_IDS as readonly string[]).includes(layout.id)
            ? YOUTH_UPDATE_INSIDE_MASTHEAD_PREVIEW_FRACTION * 1000
            : FRONT_PAGE_TEMPLATE_IDS.includes(layout.id)
              ? MASTHEAD_PREVIEW_FRACTION * 1000
              : 0;
      const preview = generateTemplateLayout({
        templateId: layout.id,
        pageWidth: 1000,
        contentX: 0,
        contentY: headerReserve,
        contentWidth: 1000,
        contentHeight: 1000 - headerReserve,
        // The template's own grid, so the thumbnail matches the page the
        // generator will actually build.
        columnCount: getTemplateColumnCount(layout.id, 6),
        gutter: 0,
      });
      map.set(
        layout.id,
        preview.slots.map((slot) => ({
          ...slot,
          left: `${(slot.x / 1000) * 100}%`,
          top: `${(slot.y / 1000) * 100}%`,
          width: `${(slot.width / 1000) * 100}%`,
          height: `${(slot.height / 1000) * 100}%`,
        })),
      );
    }
    return map;
  }, []);
}

// ─── Front Page Layout Picker (Front Page tab only) ──────────────────────────

function FrontPageLayoutScreen({
  state,
  layoutPreviews,
  dispatch,
  onContinue,
}: {
  state: WizardState;
  layoutPreviews: ReturnType<typeof useLayoutPreviews>;
  dispatch: React.Dispatch<WizardAction>;
  onContinue: () => void;
}) {
  // Re-checked on every render rather than memoized once: cheap (a single URL
  // read), and this screen only ever mounts client-side after the wizard is
  // opened, so there is no server-render pass to stay in sync with.
  const frontPageDesigns = getFrontPageDesigns();
  return (
    <div className="generation-wizard-screen">
      <p className="generation-wizard-note">
        सिर्फ़ फ्रंट पेज डिज़ाइन। हर बॉक्स{" "}
        <strong>{FRONT_HEADER_CM.toFixed(1)} सेमी मास्टहेड पट्टी</strong> के नीचे रहता है — अंदर के
        पन्ने अपनी {INSIDE_HEADER_CM.toFixed(1)} सेमी फोलियो पट्टी और अपनी अलग डिज़ाइन सूची इनसाइड
        पेजेज़ टैब में रखते हैं।
      </p>
      <div className="generation-byline-card">
        <label htmlFor="generation-front-byline-name">बाइलाइन अख़बार का नाम</label>
        <div>
          <input
            id="generation-front-byline-name"
            type="text"
            value={state.bylineName}
            onChange={(e) => dispatch({ type: "SET_BYLINE", name: e.target.value })}
            placeholder="सिटी रिपोर्टर"
          />
          <span>
            {state.bylineName.trim() || "सिटी रिपोर्टर"} <b /> API place
          </span>
        </div>
      </div>
      <div className="generation-layout-grid">
        {frontPageDesigns.map((layout) => {
          const previewSlots = layoutPreviews.get(layout.id) ?? [];
          const isYouthUpdate = isYouthUpdateFrontTemplateId(layout.id);
          const mastheadFraction = isYouthUpdate
            ? YOUTH_UPDATE_MASTHEAD_PREVIEW_FRACTION
            : MASTHEAD_PREVIEW_FRACTION;
          const mastheadCm = isYouthUpdate
            ? YOUTH_UPDATE_MASTHEAD_HEIGHT_IN * INCHES_TO_CM
            : FRONT_HEADER_CM;
          const selectLayout = () =>
            dispatch({ type: "SET_LAYOUT", layout: layout.id, storyCount: layout.storyCount });
          return (
            <div
              key={layout.id}
              role="button"
              tabIndex={0}
              className={`layout-preview-button${state.layoutDesign === layout.id ? " selected" : ""} matching`}
              onClick={selectLayout}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectLayout();
                }
              }}
            >
              <div className="layout-preview-card">
                <div className="layout-preview-count-badge">{layout.storyCount}</div>
                <div className="layout-preview-frame">
                  <div
                    className="layout-preview-masthead"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: "100%",
                      height: `${mastheadFraction * 100}%`,
                      background: "repeating-linear-gradient(135deg,#c8d6e5 0 5px,#b4c6da 5px 10px)",
                      border: "1px solid #7f95ad",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#20364d",
                      letterSpacing: "0.05em",
                    }}
                  >
                    मास्टहेड {mastheadCm.toFixed(1)}सेमी
                  </div>
                  {previewSlots.map((slot) => (
                    <div
                      key={slot.storyNumber}
                      className="layout-preview-slot"
                      style={{
                        left: slot.left,
                        top: slot.top,
                        width: slot.width,
                        height: slot.height,
                      }}
                    >
                      {slot.storyNumber}
                    </div>
                  ))}
                </div>
              </div>
              <div className="layout-preview-meta">
                <strong>{layout.name}</strong>
                <span>{layout.storyCount} खबरें</span>
                <span className="layout-preview-match-label">सिर्फ़ फ्रंट पेज</span>
              </div>
              <button
                type="button"
                className="layout-preview-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  selectLayout();
                  onContinue();
                }}
              >
                चुनें →
              </button>
            </div>
          );
        })}
      </div>
      <p className="generation-wizard-note">
        {frontPageDesigns.find((layout) => layout.id === state.layoutDesign)?.description ?? ""}
      </p>
      <div className="generation-wizard-actions">
        <button type="button" className="primary" onClick={onContinue}>
          आगे बढ़ें
        </button>
      </div>
    </div>
  );
}

// ─── Shared Layout Picker (reused by Inside and Editorial tabs) ───────────────

function LayoutPickerScreen({
  state,
  layoutPreviews,
  dispatch,
  onGenerateStoryLayout,
  onContinue,
}: {
  state: WizardState;
  layoutPreviews: ReturnType<typeof useLayoutPreviews>;
  dispatch: React.Dispatch<WizardAction>;
  onGenerateStoryLayout: (count: number) => void;
  onContinue: () => void;
}) {
  const visibleLayouts = getInsideDesigns().filter(
    (layout) => layout.category === state.layoutDesignCategory,
  );

  const selectAndContinue = (layout: (typeof visibleLayouts)[number]) => {
    const requiredCount = getRequiredNewswireStoryCount(state.tab, layout.id, layout.storyCount);
    dispatch({ type: "SET_LAYOUT", layout: layout.id, storyCount: requiredCount });
    onGenerateStoryLayout(requiredCount);
    onContinue();
  };

  return (
    <div className="generation-wizard-screen">
      <div className="layout-category-tabs" role="tablist" aria-label="लेआउट डिज़ाइन श्रेणी">
        <button
          type="button"
          role="tab"
          aria-selected={state.layoutDesignCategory === "basic"}
          className={`layout-category-tab${state.layoutDesignCategory === "basic" ? " active" : ""}`}
          onClick={() => dispatch({ type: "SET_LAYOUT_DESIGN_CATEGORY", layoutDesignCategory: "basic" })}
        >
          बेसिक डिज़ाइन
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.layoutDesignCategory === "advanced"}
          className={`layout-category-tab${state.layoutDesignCategory === "advanced" ? " active" : ""}`}
          onClick={() => dispatch({ type: "SET_LAYOUT_DESIGN_CATEGORY", layoutDesignCategory: "advanced" })}
        >
          एडवांस्ड डिज़ाइन
        </button>
      </div>
      <p className="generation-wizard-note">
        {visibleLayouts.length} {state.layoutDesignCategory === "basic" ? "बेसिक" : "एडवांस्ड"} लेआउट
        टेम्पलेट दिखाए जा रहे हैं। चुनी गई लेख संख्या: {state.articleCount}.
      </p>
      <div className="generation-byline-card">
        <label htmlFor="generation-byline-name">बाइलाइन अख़बार का नाम</label>
        <div>
          <input
            id="generation-byline-name"
            type="text"
            value={state.bylineName}
            onChange={(e) => dispatch({ type: "SET_BYLINE", name: e.target.value })}
            placeholder="सिटी रिपोर्टर"
          />
          <span>
            {state.bylineName.trim() || "सिटी रिपोर्टर"} <b /> API place
          </span>
        </div>
      </div>
      <div className="generation-layout-grid">
        {visibleLayouts.map((layout) => {
          const previewSlots = layoutPreviews.get(layout.id) ?? [];
          const requiredCount = getRequiredNewswireStoryCount(state.tab, layout.id, layout.storyCount);
          const isMatching = requiredCount === state.articleCount;
          const selectLayout = () => dispatch({ type: "SET_LAYOUT", layout: layout.id, storyCount: requiredCount });
          return (
            <div
              key={layout.id}
              role="button"
              tabIndex={0}
              className={`layout-preview-button${state.layoutDesign === layout.id ? " selected" : ""}${isMatching ? " matching" : ""}`}
              onClick={selectLayout}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectLayout();
                }
              }}
            >
              <div className="layout-preview-card">
                <div className="layout-preview-count-badge">{requiredCount}</div>
                <div className="layout-preview-frame">
                  {previewSlots.map((slot) => (
                    <div
                      key={slot.storyNumber}
                      className="layout-preview-slot"
                      style={{
                        left: slot.left,
                        top: slot.top,
                        width: slot.width,
                        height: slot.height,
                      }}
                    >
                      {slot.storyNumber}
                    </div>
                  ))}
                </div>
              </div>
              <div className="layout-preview-meta">
                <strong>{layout.name}</strong>
                <span>{requiredCount} खबरें</span>
                {isMatching ? (
                  <span className="layout-preview-match-label">चुनी गई संख्या से मेल खाता है</span>
                ) : null}
              </div>
              <button
                type="button"
                className="layout-preview-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  selectAndContinue(layout);
                }}
              >
                चुनें →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page Advertisement (optional, embedded within this generated page —
// not the separate, ad-only Advertisement Page tab). A publisher can add
// several ads to one page; the real generate handlers turn them all into
// customLayout/customStories via buildPageAdvertisementsLayout, which
// shelf-packs every ad from the bottom-right corner and fills whatever's
// left with real stories. ──────────────────────────────────────────────

export function PageAdvertisementControl({
  pageAdvertisements,
  dispatch,
}: {
  pageAdvertisements: PageAdvertisementState[];
  dispatch: React.Dispatch<WizardAction>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelected = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          dispatch({
            type: "ADD_PAGE_ADVERTISEMENT",
            ad: {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              dataUrl,
              originalWidth: img.naturalWidth,
              originalHeight: img.naturalHeight,
              presetKey: "2-col",
            },
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [dispatch],
  );

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8f9fa", borderRadius: 8, border: "1.5px solid #d0d7de" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: "#111" }}>
        <span>विज्ञापन जोड़ें</span>
        <span style={{ fontSize: 10, background: "#fff3e0", color: "#b45309", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>वैकल्पिक</span>
      </div>
      <p style={{ fontSize: 11, color: "#555", margin: "4px 0 10px", lineHeight: 1.45 }}>
        एक या अधिक विज्ञापन जोड़ें — वे पन्ने के नीचे-दाएँ कोने से एक साथ जुड़ते हैं; बची हुई जगह असली खबरों से भर जाती है।
      </p>

      {pageAdvertisements.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
          {pageAdvertisements.map((ad) => (
            <div key={ad.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <img
                src={ad.dataUrl}
                alt="विज्ञापन पूर्वावलोकन"
                style={{ width: 72, height: 72, objectFit: "contain", background: "#fff", border: "1px solid #d0d7de", borderRadius: 4 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <select
                  value={ad.presetKey}
                  onChange={(e) =>
                    dispatch({ type: "SET_PAGE_AD_PRESET", id: ad.id, presetKey: e.target.value as keyof typeof PAGE_AD_PRESETS })
                  }
                  style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #d0d7de", fontSize: 12 }}
                >
                  {PAGE_AD_PRESET_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {PAGE_AD_PRESETS[key]!.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => dispatch({ type: "REMOVE_PAGE_ADVERTISEMENT", id: ad.id })}
                >
                  हटाएं
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFileSelected(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="secondary"
        onClick={() => fileInputRef.current?.click()}
      >
        {pageAdvertisements.length > 0 ? "एक और विज्ञापन जोड़ें" : "विज्ञापन की तस्वीर अपलोड करें"}
      </button>
    </div>
  );
}

// ─── Shared Style Screen (reused by Front, Inside, Editorial tabs) ────────────

function StyleScreen({
  state,
  dispatch,
  onBack,
  onContinue,
}: {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="generation-wizard-screen">
      <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8f9fa", borderRadius: 8, border: "1.5px solid #d0d7de" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
          <input
            type="checkbox"
            checked={state.colouredHeadings}
            onChange={(e) => dispatch({ type: "TOGGLE_COLOURED_HEADINGS", value: e.target.checked })}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#1565c0" }}
          />
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>रंगीन हेडलाइन</span>
            <span style={{ fontSize: 10, background: "#e3f2fd", color: "#1565c0", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>एडिटोरियल स्टाइल</span>
          </span>
        </label>
        <p style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.45, margin: "4px 0 0 28px" }}>
          पेशेवर एडिटोरियल हेडलाइन स्टाइलिंग जोड़ता है (लगभग 25% खबरों को गहरा लाल, गहरा नीला, या गहरा हरा रंग मिलता है)।
        </p>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
            <input
              type="checkbox"
              checked={state.tintedStoryBackground}
              onChange={(e) => dispatch({ type: "TOGGLE_TINTED_BACKGROUND", value: e.target.checked })}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#2e7d32" }}
            />
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>हल्के रंग की पृष्ठभूमि</span>
              <span style={{ fontSize: 10, background: "#e8f5e9", color: "#2e7d32", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>विज़ुअल हायरार्की</span>
            </span>
          </label>
          <p style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.45, margin: "4px 0 0 28px" }}>
            लगभग 1/3 खबरों पर अपने-आप 20–30% हल्के रंग की पृष्ठभूमि लगाता है, ताकि पन्ना बेहतर दिखे।
          </p>
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
            <input
              type="checkbox"
              checked={state.professionalJustification}
              onChange={(e) => dispatch({ type: "TOGGLE_JUSTIFICATION", value: e.target.checked })}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#8b1e1e" }}
            />
            <span>प्रोफेशनल न्यूज़पेपर जस्टिफिकेशन</span>
          </label>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0 28px", lineHeight: 1.45 }}>
            शब्दों की दूरी को नियंत्रित रखते हुए बॉडी कॉलम को दोनों किनारों से बराबर करता है।
          </p>
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
            <input
              type="checkbox"
              checked={state.inlineColumnSubheadings}
              onChange={(e) => dispatch({ type: "TOGGLE_INLINE_SUBHEADINGS", value: e.target.checked })}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#b42318" }}
            />
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>इनलाइन कॉलम सबहेडिंग (न्यूज़पेपर बुलेट)</span>
              <span style={{ fontSize: 10, background: "#ffebee", color: "#c62828", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>असली अख़बार जैसा लुक</span>
            </span>
          </label>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0 28px", lineHeight: 1.45 }}>
            पहले टेक्स्ट कॉलम की शुरुआत में लाल बिंदी के साथ मोटे सार बुलेट पॉइंट लगाता है।
          </p>
        </div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 12, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        अख़बार का रंग पैलेट
      </div>
      <div className="generation-style-grid">
        {WIZARD_ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={state.subheadingStyle.id === preset.id ? "selected" : ""}
            onClick={() => dispatch({ type: "SET_SUBHEADING_STYLE", style: preset })}
          >
            <i style={{ background: preset.backgroundColor, borderColor: preset.borderColor }} />
            <span>{preset.label}</span>
            {preset.palette ? (
              <span style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                {Object.values(preset.palette).map((color) => (
                  <span key={color} style={{ width: 12, height: 12, borderRadius: 2, background: color, border: "1px solid rgba(0,0,0,0.18)" }} />
                ))}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <label className="generation-opacity-control">
        <span>सबहेडिंग की गहराई</span>
        <input
          type="range"
          min="15"
          max="100"
          step="5"
          value={state.subheadingOpacity}
          onChange={(e) => dispatch({ type: "SET_SUBHEADING_OPACITY", opacity: Number(e.target.value) })}
        />
        <strong>{state.subheadingOpacity}%</strong>
      </label>
      <div className="generation-wizard-actions">
        <button type="button" className="secondary" onClick={onBack}>
          वापस
        </button>
        <button type="button" className="primary" onClick={onContinue}>
          आगे बढ़ें
        </button>
      </div>
    </div>
  );
}

// ─── Manual Box Seeder (left panel on the Category step) ──────────────────────
//
// Optional, per-box authoring — headline/subheadline/kicker/photo/caption
// typed here for a specific box print exactly as written; every box left
// empty is filled by the existing wire/preloaded pipeline on the right,
// completely untouched. Converts to `NewswireStory` objects with
// `manualPinned`/`manualTargetSlotIndex` set, merged in by the "Load"
// handlers below — see `manualBoxEntryToStory`.

/** ~1050 words fills a full-width band at body size — same figure EditorialSlotPanel's own capacity hint uses, scaled here by this box's real height instead of a row-rhythm lookup. */
const estimateBodyWordCapacity = (box: ManualBoxGeometry) => {
  const depth = box.heightPt / Math.max(1, MANUAL_SEEDER_CONTENT_BOUNDS_PT.height);
  return Math.max(40, Math.round((box.columnSpan / 6) * depth * 1050 * 6));
};

function manualBoxEntryToStory(entry: ManualBoxEntry, box: ManualBoxGeometry): NewswireStory {
  const headline = entry.headline.trim();
  const subheadline = entry.subheadline.trim();
  const place = entry.place.trim();
  const body = entry.body.trim();
  const imageUrl = entry.imageUrl.trim();
  const imageCaption = entry.imageCaption.trim();

  const localized = {
    headline,
    kicker: "",
    subheadings: [],
    subheadline,
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    caption: imageCaption,
    imageCaption,
    place,
    imageUrl,
    sourceUrl: "",
    category: "Manual",
  };

  return {
    id: `manual-box-${box.slotIndex}-${Date.now()}`,
    category: "Manual",
    headline,
    subheadline,
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    summary: [],
    caption: imageCaption,
    imageUrl,
    imageCaption,
    place,
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
    manualPinned: true,
    manualTargetSlotIndex: box.slotIndex,
    localized: {
      hindi: { ...localized, language: "hindi" },
      english: { ...localized, language: "english" },
    },
  } as NewswireStory;
}

/** A box counts as done once its two mandatory fields are filled and every optional field that IS filled fits. */
const isManualBoxEntryComplete = (entry: ManualBoxEntry, box: ManualBoxGeometry): boolean => {
  if (!entry.headline.trim() || !entry.body.trim()) return false;
  return (
    checkHeadlineFit(entry.headline, box, "headline").fits &&
    checkHeadlineFit(entry.subheadline, box, "subheadline").fits
  );
};

const ManualBoxCard = memo(function ManualBoxCard({
  box,
  entry,
  dispatch,
  onPickImage,
}: {
  box: ManualBoxGeometry;
  entry: ManualBoxEntry;
  dispatch: React.Dispatch<WizardAction>;
  onPickImage: (slotIndex: number, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headlineFit = useMemo(() => checkHeadlineFit(entry.headline, box, "headline"), [entry.headline, box]);
  const subheadlineFit = useMemo(() => checkHeadlineFit(entry.subheadline, box, "subheadline"), [entry.subheadline, box]);
  const bodyCapacity = useMemo(() => estimateBodyWordCapacity(box), [box]);
  const bodyWords = entry.body.trim() ? entry.body.trim().split(/\s+/).length : 0;
  const hasContent = Boolean(
    entry.headline.trim() || entry.subheadline.trim() || entry.place.trim() || entry.body.trim() || entry.imageUrl.trim(),
  );
  const allFit = headlineFit.fits && subheadlineFit.fits;

  const setField = (patch: Partial<ManualBoxEntry>) =>
    dispatch({ type: "SET_MANUAL_BOX_FIELD", slotIndex: box.slotIndex, patch });

  return (
    <div className={`manual-box-card${hasContent ? " filled" : ""}${hasContent && !allFit ? " invalid" : ""}`}>
      <div className="manual-box-card-header">
        <span>बॉक्स {box.storyNumber}</span>
        <span className="manual-box-card-span">{box.columnSpan}-कॉलम</span>
        {hasContent ? (
          <button
            type="button"
            className="manual-box-clear-btn"
            onClick={() => dispatch({ type: "CLEAR_MANUAL_BOX", slotIndex: box.slotIndex })}
          >
            साफ़ करें
          </button>
        ) : null}
      </div>

      <label className="manual-box-field">
        <span>स्थान का नाम</span>
        <input
          value={entry.place}
          onChange={(e) => setField({ place: e.target.value })}
          placeholder="वैकल्पिक — बाइलाइन में डेटलाइन की तरह छपेगा, जैसे भोपाल"
        />
      </label>

      <label className="manual-box-field">
        <span>हेडलाइन * ({MANUAL_HEADLINE_MIN_WORDS}–{MANUAL_HEADLINE_MAX_WORDS} शब्द)</span>
        <textarea
          rows={2}
          value={entry.headline}
          onChange={(e) => setField({ headline: e.target.value })}
          placeholder="इस बॉक्स की हेडलाइन"
        />
        {entry.headline.trim() ? (
          headlineFit.fits ? (
            <em className="manual-box-fit-ok">इस तरह फ़िट होगी: {headlineFit.wrappedLines.join(" / ")}</em>
          ) : (
            <em className="manual-box-fit-bad">{headlineFit.reason}</em>
          )
        ) : (
          <em className="manual-box-fit-hint">
            {MANUAL_HEADLINE_MIN_WORDS} से {MANUAL_HEADLINE_MAX_WORDS} शब्द लिखें।
          </em>
        )}
      </label>

      <label className="manual-box-field">
        <span>सबहेडलाइन</span>
        <textarea
          rows={2}
          value={entry.subheadline}
          onChange={(e) => setField({ subheadline: e.target.value })}
          placeholder="वैकल्पिक"
        />
        {entry.subheadline.trim() && !subheadlineFit.fits ? (
          <em className="manual-box-fit-bad">{subheadlineFit.reason}</em>
        ) : null}
      </label>

      <label className="manual-box-field">
        <span>मुख्य लेख *</span>
        <textarea
          rows={4}
          value={entry.body}
          onChange={(e) => setField({ body: e.target.value })}
          placeholder="लेख का पूरा टेक्स्ट"
        />
        <em className="manual-box-fit-hint">
          {bodyWords === 0
            ? `इस बॉक्स में लगभग ${bodyCapacity} शब्द आ सकते हैं।`
            : bodyWords > bodyCapacity
              ? `${bodyWords} शब्द — फ़िट करने के लिए अंत को पूर्ण विराम पर काटा जाएगा।`
              : `${bodyWords} में से लगभग ${bodyCapacity} शब्द।`}
        </em>
      </label>

      <div className="manual-box-field manual-box-image-picker">
        <span>{entry.imageUrl ? "तस्वीर चुनी गई" : "तस्वीर (वैकल्पिक)"}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickImage(box.slotIndex, file);
            e.target.value = "";
          }}
        />
        <button type="button" className="manual-box-choose-btn" onClick={() => fileInputRef.current?.click()}>
          {entry.imageUrl ? "तस्वीर बदलें" : "तस्वीर चुनें"}
        </button>
        {entry.imageUrl ? (
          <button type="button" onClick={() => setField({ imageUrl: "" })}>
            हटाएं
          </button>
        ) : null}
      </div>

      <label className="manual-box-field">
        <span>तस्वीर का कैप्शन</span>
        <input
          value={entry.imageCaption}
          onChange={(e) => setField({ imageCaption: e.target.value })}
          placeholder="वैकल्पिक"
        />
      </label>
    </div>
  );
});

const ManualBoxPopup = memo(function ManualBoxPopup({
  box,
  entry,
  dispatch,
  onPickImage,
  onClose,
}: {
  box: ManualBoxGeometry;
  entry: ManualBoxEntry;
  dispatch: React.Dispatch<WizardAction>;
  onPickImage: (slotIndex: number, file: File) => void;
  onClose: () => void;
}) {
  return (
    <div className="manual-box-popup-backdrop" onClick={onClose}>
      <div className="manual-box-popup" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="manual-box-popup-close" onClick={onClose} aria-label="बंद करें">
          <X size={16} strokeWidth={2.2} />
        </button>
        <ManualBoxCard box={box} entry={entry} dispatch={dispatch} onPickImage={onPickImage} />
        <button type="button" className="manual-box-popup-done" onClick={onClose}>
          हो गया
        </button>
      </div>
    </div>
  );
});

const ManualBoxSeeder = memo(function ManualBoxSeeder({
  state,
  dispatch,
  layoutPreviews,
}: {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  layoutPreviews: ReturnType<typeof useLayoutPreviews>;
}) {
  const tab = state.tab === "front" ? "front" : "inside";
  const boxes = useMemo(
    () => getManualBoxGeometry(tab, state.layoutDesign).filter((box) => !box.isNestedSidebar),
    [tab, state.layoutDesign],
  );
  const boxByStoryNumber = useMemo(() => new Map(boxes.map((box) => [box.storyNumber, box])), [boxes]);
  // Reuses the exact same thumbnail geometry the layout-picker screens already
  // show, joined to this tab's real (masthead/folio-aware) box geometry by
  // story number, so clicking a numbered box opens the popup for the right one.
  const previewSlots = layoutPreviews.get(state.layoutDesign) ?? [];

  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  // A different layout means different boxes at different slot indices — a
  // popup left open from the previous layout would be editing a box that no
  // longer means the same thing, so close it.
  useEffect(() => {
    setSelectedSlotIndex(null);
  }, [tab, state.layoutDesign]);

  const selectedBox = selectedSlotIndex !== null ? boxes.find((box) => box.slotIndex === selectedSlotIndex) ?? null : null;

  const handlePickImage = useCallback(
    (slotIndex: number, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = typeof reader.result === "string" ? reader.result : "";
        if (imageUrl) {
          dispatch({ type: "SET_MANUAL_BOX_FIELD", slotIndex, patch: { imageUrl } });
        }
      };
      reader.readAsDataURL(file);
    },
    [dispatch],
  );

  return (
    <div className="manual-box-seeder">
      <div className="manual-box-seeder-header">
        <strong>अपने खुद के लेख लिखें</strong>
        <p>
          वैकल्पिक। नीचे लेआउट में किसी नंबर वाले बॉक्स पर क्लिक करके उसकी हेडलाइन और मुख्य लेख खुद
          लिखें — जो बॉक्स छोड़ देंगे, वह दाईं ओर श्रेणी चुनते ही अपने-आप भर जाएगा।
        </p>
      </div>

      <div className="manual-box-diagram-card">
        <div className="manual-box-diagram-frame">
          {previewSlots.map((slot) => {
            const box = boxByStoryNumber.get(slot.storyNumber);
            if (!box) return null;
            const entry = state.manualBoxEntries[box.slotIndex];
            const complete = Boolean(entry && isManualBoxEntryComplete(entry, box));
            const hasContent = Boolean(
              entry &&
                (entry.headline.trim() ||
                  entry.subheadline.trim() ||
                  entry.place.trim() ||
                  entry.body.trim() ||
                  entry.imageUrl.trim()),
            );
            const status = complete ? "done" : hasContent ? "partial" : "empty";
            return (
              <button
                key={slot.storyNumber}
                type="button"
                className={`manual-box-diagram-slot status-${status}`}
                style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height }}
                onClick={() => setSelectedSlotIndex(box.slotIndex)}
                title={`बॉक्स ${box.storyNumber} — ${box.columnSpan}-कॉलम`}
              >
                {slot.storyNumber}
              </button>
            );
          })}
        </div>
      </div>

      {selectedBox ? (
        <ManualBoxPopup
          box={selectedBox}
          entry={state.manualBoxEntries[selectedBox.slotIndex] ?? emptyManualBoxEntry()}
          dispatch={dispatch}
          onPickImage={handlePickImage}
          onClose={() => setSelectedSlotIndex(null)}
        />
      ) : null}
    </div>
  );
});

// ─── Category Screen (reused by Front and Inside tabs) ───────────────────────

function CategoryScreen({
  state,
  dispatch,
  onBack,
  onEditLayout,
  onLoadPreloaded,
  onLoadLive,
}: {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onBack: () => void;
  onEditLayout: () => void;
  onLoadPreloaded: () => void;
  onLoadLive: () => void;
}) {
  // How many boxes are still open for the API to fill, once the manual boxes
  // written on the left are subtracted out — recomputed from the same
  // geometry/completeness rules the seeder itself uses, so this number is
  // never out of sync with what "Generate Page" is actually about to do.
  const remaining = useMemo(() => {
    if (state.tab !== "front" && state.tab !== "inside") {
      return null;
    }
    const boxes = getManualBoxGeometry(state.tab, state.layoutDesign);
    const seeded = boxes.filter((box) => {
      const entry = state.manualBoxEntries[box.slotIndex];
      return entry && isManualBoxEntryComplete(entry, box);
    }).length;
    return { total: boxes.length, seeded, remaining: boxes.length - seeded };
  }, [state.tab, state.layoutDesign, state.manualBoxEntries]);

  return (
    <div className="generation-wizard-screen">
      {remaining ? (
        <div className="generation-category-remaining">
          {/* key forces a remount on every change, which replays the CSS pop
              animation below — the clearest way to make an update to this
              number visibly register without extra JS state to manage. */}
          <strong key={remaining.remaining} className="generation-category-remaining-number">
            {remaining.remaining}
          </strong>
          <span>
            {state.tab === "front"
              ? remaining.seeded > 0
                ? `${remaining.seeded} बॉक्स हाथ से लिखे गए। बाकी बॉक्स अलग-अलग श्रेणियों की मिली-जुली खबरों से अपने-आप भर जाएंगे — असली फ्रंट पेज की तरह।`
                : "बॉक्स राष्ट्रीय (30%), मध्य प्रदेश (30%), अंतरराष्ट्रीय (20%), खेल (10%) और व्यापार (10%) खबरों के मिश्रण से अपने-आप भर जाएंगे — असली फ्रंट पेज की तरह।"
              : remaining.seeded > 0
                ? `${remaining.seeded} बॉक्स हाथ से लिखे गए। बाकी बॉक्स नीचे दी गई श्रेणी से अपने-आप भर जाएंगे।`
                : "बाईं ओर खाली छोड़े गए बॉक्स नीचे दी गई श्रेणी से अपने-आप भर जाएंगे।"}
          </span>
        </div>
      ) : null}
      <div style={{ fontWeight: 600, fontSize: 12, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        पन्ने की भाषा
      </div>
      <div className="generation-category-grid" style={{ marginBottom: 14 }}>
        {PAGE_LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={state.languageMode === option.value ? "selected" : ""}
            onClick={() => dispatch({ type: "SET_LANGUAGE", language: option.value })}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
      {state.tab === "front" ? null : (
        <div className="generation-category-grid">
          {NEWSWIRE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={state.category === category ? "selected" : ""}
              onClick={() => dispatch({ type: "SET_CATEGORY", category })}
            >
              {category}
            </button>
          ))}
        </div>
      )}
      {state.error ? <p className="generation-wizard-error">{state.error}</p> : null}
      <div className="generation-wizard-actions">
        <button type="button" className="secondary" onClick={onBack}>
          वापस
        </button>
        <button type="button" className="secondary" onClick={onEditLayout}>
          लेआउट बदलें
        </button>
        <button
          type="button"
          className="primary"
          disabled={state.languageMode !== "hindi"}
          onClick={onLoadPreloaded}
          title={
            state.languageMode === "hindi"
              ? "जांच के लिए तस्वीरों सहित तैयार हिंदी खबरें तुरंत लोड करें"
              : "तैयार खबरें सिर्फ़ हिंदी में हैं। अंग्रेज़ी या द्विभाषी पन्नों के लिए पन्ना बनाएं इस्तेमाल करें।"
          }
        >
          {state.languageMode === "hindi" ? "तैयार खबरें लोड करें" : "सिर्फ़ हिंदी में तैयार"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={state.loading}
          onClick={onLoadLive}
        >
          {state.loading ? "लोड हो रहा है..." : "पन्ना बनाएं"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab label ────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<WizardTab, string> = {
  front: "फ्रंट पेज",
  inside: "इनसाइड पेजेज़",
  editorial: "एडिटोरियल पेज",
  advertisement: "विज्ञापन पेज",
};

const TABS: WizardTab[] = ["front", "inside", "editorial", "advertisement"];

// ─── Main Modal Component ─────────────────────────────────────────────────────

export const GenerationWizardModal = memo(function GenerationWizardModal({
  open,
  defaultBylineName,
  defaultLanguageMode,
  onClose,
  onGenerateStoryLayout,
  onImportNewswireStories,
  pages,
  activePageNumber,
  onSelectPageByNumber,
}: GenerationWizardModalProps) {
  const bylineSyncedRef = useRef(false);
  const [state, dispatch] = useReducer(
    wizardReducer,
    defaultBylineName,
    createInitialWizardState,
  );

  // Sync language mode from document settings (only once)
  useEffect(() => {
    if (defaultLanguageMode && defaultLanguageMode !== state.languageMode) {
      dispatch({ type: "SET_LANGUAGE", language: defaultLanguageMode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLanguageMode]);

  // Sync byline from document settings (only once)
  useEffect(() => {
    if (!bylineSyncedRef.current && !state.bylineName.trim() && defaultBylineName) {
      bylineSyncedRef.current = true;
      dispatch({ type: "SET_BYLINE", name: defaultBylineName });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBylineName]);

  // Lazy layout previews — computed only when modal opens
  const layoutPreviews = useLayoutPreviews();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const buildImportOptions = useCallback((): NewswireImportOptions => {
    // Youth UPDATE's front page (and its own inside page) has a fixed
    // black-headline/cyan-accent theme, not a publisher-customizable
    // palette -- override whatever the style step's swatches produced
    // rather than let a colourful pick drift the design away from the
    // reference. Every other layout keeps its own chosen style untouched.
    const isYouthUpdateFront =
      isYouthUpdateFrontTemplateId(state.layoutDesign) || isYouthUpdateInsideTemplateId(state.layoutDesign);
    const effectiveSubheadingStyle = isYouthUpdateFront ? NEWSWIRE_SUBHEADING_PRESETS[0] : state.subheadingStyle;
    return {
      templateId: state.layoutDesign,
      pageKind: state.tab === "front" ? "front" : state.tab === "editorial" ? "editorial" : "inside",
      languageMode: state.languageMode,
      bylineName: state.bylineName,
      colouredHeadings: isYouthUpdateFront ? false : state.colouredHeadings,
      tintedStoryBackground: state.tintedStoryBackground,
      tintColor: getPaletteTintColor(effectiveSubheadingStyle),
      inlineColumnSubheadings: state.inlineColumnSubheadings,
      inlineSubheadingColor: getPaletteInlineAccent(effectiveSubheadingStyle),
      palettePreset: effectiveSubheadingStyle,
      subheadingStyle: getPaletteSubheadingStyle(effectiveSubheadingStyle, state.subheadingOpacity / 100),
      bodyAlignment: "justify",
      professionalJustification: state.professionalJustification,
      pageAdvertisements: state.pageAdvertisements.length > 0 ? state.pageAdvertisements : undefined,
    };
  }, [state]);

  /**
   * Converts any filled manual boxes to pinned `NewswireStory` objects, or
   * returns an error message if any filled box still fails its fit check —
   * "Load" is blocked rather than silently dropping the offending box, so an
   * oversized headline can't reach the page just because it was never fixed.
   */
  const getManualBoxStories = useCallback((): { stories: NewswireStory[] } | { error: string } => {
    if (state.tab !== "front" && state.tab !== "inside") {
      return { stories: [] };
    }

    const boxes = getManualBoxGeometry(state.tab, state.layoutDesign);
    const stories: NewswireStory[] = [];

    for (const box of boxes) {
      const entry = state.manualBoxEntries[box.slotIndex];
      if (!entry) continue;

      const hasContent = Boolean(
        entry.headline.trim() || entry.subheadline.trim() || entry.place.trim() || entry.body.trim() || entry.imageUrl.trim(),
      );
      if (!hasContent) continue;

      if (!entry.headline.trim() || !entry.body.trim()) {
        return {
          error: `Box ${box.storyNumber}: headline and body are both required, or click Clear to leave this box automatic.`,
        };
      }

      const headlineFit = checkHeadlineFit(entry.headline, box, "headline");
      const subheadlineFit = checkHeadlineFit(entry.subheadline, box, "subheadline");
      const failed = !headlineFit.fits ? headlineFit : !subheadlineFit.fits ? subheadlineFit : null;

      if (failed) {
        return { error: `Box ${box.storyNumber}: ${failed.reason}` };
      }

      stories.push(manualBoxEntryToStory(entry, box));
    }

    return { stories };
  }, [state.tab, state.layoutDesign, state.manualBoxEntries]);

  const handleLoadLive = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "RESET_ERROR" });
    try {
      const manualResult = getManualBoxStories();
      if ("error" in manualResult) {
        throw new Error(manualResult.error);
      }

      const requiredArticleCount = getRequiredNewswireStoryCount(state.tab, state.layoutDesign, state.articleCount);
      const needed = Math.max(0, requiredArticleCount - manualResult.stories.length);
      const issueSession = readPortalIssueArticleSession();
      const exclusions = await loadIssueArticleExclusions(issueSession);
      const fetchCategories = getInsideFetchCategories(state.category);
      const livePool: NewswireStory[] = [];

      for (const category of fetchCategories) {
        const response = await fetch(
          `/api/newswire?category=${encodeURIComponent(category)}&language=${state.languageMode}&limit=${Math.ceil(needed * 1.8) + 6}`,
        );
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: NewswireStory[];
          error?: string;
          meta?: { baseUrl?: string; warning?: string };
        } | null;
        if (!response.ok || payload?.success === false || !Array.isArray(payload?.data)) {
          if (fetchCategories.length === 1) {
            throw new Error(payload?.error ?? "Unable to load news for this category.");
          }
          continue;
        }
        // The newswire route answers 200 + success:true even when every upstream
        // backend failed, substituting built-in preloaded stories and flagging it
        // only via meta.baseUrl. Importing those silently is what made "Load Live"
        // produce pages built from short, identically-padded filler articles that
        // no amount of text fitting could grow to fill their boxes. Surface it as
        // an error instead so live means live.
        if (payload.meta?.baseUrl === "fallback") {
          if (fetchCategories.length === 1) {
            throw new Error(
              payload.meta.warning
                ? `लाइव न्यूज़वायर उपलब्ध नहीं है — ${payload.meta.warning}`
                : "लाइव न्यूज़वायर अभी उपलब्ध नहीं है। 'तैयार खबरें' का उपयोग करें, या फिर से कोशिश करें।",
            );
          }
          continue;
        }
        livePool.push(...payload.data);
      }

      const liveStories = collectFreshStories(shuffleNewswireStories(livePool), needed, exclusions);
      const fallbackStories = liveStories.length < needed
        ? fetchCategories.flatMap((category) =>
            selectFreshFallbackStories(category, needed - liveStories.length, exclusions),
          ).slice(0, needed - liveStories.length)
        : [];
      onImportNewswireStories(getInsideImportCategory(state.category, state.languageMode), [...manualResult.stories, ...liveStories, ...fallbackStories], buildImportOptions());
      onClose();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "खबरें लोड नहीं हो सकीं।",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.category, state.languageMode, state.articleCount, state.layoutDesign, state.tab, buildImportOptions, onImportNewswireStories, onClose, getManualBoxStories]);

  const handleLoadPreloaded = useCallback(async () => {
    dispatch({ type: "RESET_ERROR" });
    try {
      if (state.languageMode !== "hindi") {
        throw new Error("तैयार खबरें सिर्फ़ हिंदी में हैं। अंग्रेज़ी या द्विभाषी पन्नों के लिए पन्ना बनाएं इस्तेमाल करें।");
      }
      const manualResult = getManualBoxStories();
      if ("error" in manualResult) {
        throw new Error(manualResult.error);
      }
      const requiredArticleCount = getRequiredNewswireStoryCount(state.tab, state.layoutDesign, state.articleCount);
      const needed = Math.max(0, requiredArticleCount - manualResult.stories.length);
      const issueSession = readPortalIssueArticleSession();
      const exclusions = await loadIssueArticleExclusions(issueSession);
      const fallback = getInsideFetchCategories(state.category)
        .flatMap((category) => selectFreshFallbackStories(category, needed, exclusions))
        .slice(0, needed);
      onImportNewswireStories(getInsideImportCategory(state.category, state.languageMode), [...manualResult.stories, ...fallback], buildImportOptions());
      onClose();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "तैयार खबरें लोड नहीं हो सकीं।",
      });
    }
  }, [state.category, state.articleCount, state.languageMode, state.layoutDesign, state.tab, buildImportOptions, onImportNewswireStories, onClose, getManualBoxStories]);

  /**
   * Front page only: a real front page mixes categories (a national lead,
   * a sports box, a business box, ...) rather than filling every box from
   * one category, so there's no single category to pick here at all. Pulls
   * a share from every category in parallel and lets the existing
   * rank-by-word-count slot pairing in importNewswireStories (unaffected by
   * which category a story carries) sort out which article lands where.
   */
  const handleLoadLiveMixed = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "RESET_ERROR" });
    try {
      const manualResult = getManualBoxStories();
      if ("error" in manualResult) {
        throw new Error(manualResult.error);
      }

      const requiredArticleCount = getRequiredNewswireStoryCount(state.tab, state.layoutDesign, state.articleCount);
      const needed = Math.max(0, requiredArticleCount - manualResult.stories.length);
      const issueSession = readPortalIssueArticleSession();
      const exclusions = await loadIssueArticleExclusions(issueSession);
      if (needed === 0) {
        onImportNewswireStories("Mixed", manualResult.stories, buildImportOptions());
        onClose();
        return;
      }

      const categoryTargets = computeWeightedCategoryTargets(needed).filter((entry) => entry.target > 0);

      const perCategoryResults = await Promise.all(
        categoryTargets.map(async ({ category, target }): Promise<{ category: NewswireCategory; target: number; stories: NewswireStory[] }> => {
          try {
            const response = await fetch(
              `/api/newswire?category=${encodeURIComponent(category)}&language=${state.languageMode}&limit=${target * 2 + 4}`,
            );
            const payload = (await response.json().catch(() => null)) as {
              success?: boolean;
              data?: NewswireStory[];
              meta?: { baseUrl?: string };
            } | null;
            if (!response.ok || payload?.success === false || !Array.isArray(payload?.data)) {
              return { category, target, stories: [] };
            }
            // "Load Live" means live -- a category that silently fell back to
            // canned filler is worse than a category that's simply thin right
            // now, since the other six categories can cover the gap it leaves.
            if (payload.meta?.baseUrl === "fallback") {
              return { category, target, stories: [] };
            }
            return { category, target, stories: payload.data };
          } catch {
            return { category, target, stories: [] };
          }
        }),
      );

      const liveArticles = shuffleNewswireStories(
        perCategoryResults.flatMap(({ target, stories }) =>
          collectFreshStories(shuffleNewswireStories(stories), target, exclusions),
        ),
      ).slice(0, needed);

      if (liveArticles.length === 0) {
        throw new Error("लाइव न्यूज़वायर अभी उपलब्ध नहीं है। 'तैयार खबरें' का उपयोग करें, या फिर से कोशिश करें।");
      }

      const liveStories = liveArticles;
      const fallbackStories = liveStories.length < needed
        ? shuffleNewswireStories(
            computeWeightedCategoryTargets(needed - liveStories.length)
              .filter((entry) => entry.target > 0)
              .flatMap(({ category, target }) => selectFreshFallbackStories(category, target, exclusions)),
          ).slice(0, needed - liveStories.length)
        : [];
      onImportNewswireStories("Mixed", [...manualResult.stories, ...liveStories, ...fallbackStories], buildImportOptions());
      onClose();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "खबरें लोड नहीं हो सकीं।",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.articleCount, state.languageMode, state.layoutDesign, state.tab, buildImportOptions, onImportNewswireStories, onClose, getManualBoxStories]);

  const handleLoadPreloadedMixed = useCallback(async () => {
    dispatch({ type: "RESET_ERROR" });
    try {
      if (state.languageMode !== "hindi") {
        throw new Error("तैयार खबरें सिर्फ़ हिंदी में हैं। अंग्रेज़ी या द्विभाषी पन्नों के लिए पन्ना बनाएं इस्तेमाल करें।");
      }
      const manualResult = getManualBoxStories();
      if ("error" in manualResult) {
        throw new Error(manualResult.error);
      }

      const requiredArticleCount = getRequiredNewswireStoryCount(state.tab, state.layoutDesign, state.articleCount);
      const needed = Math.max(0, requiredArticleCount - manualResult.stories.length);
      const issueSession = readPortalIssueArticleSession();
      const exclusions = await loadIssueArticleExclusions(issueSession);
      const fallback = needed > 0
        ? shuffleNewswireStories(
            computeWeightedCategoryTargets(needed)
              .filter((entry) => entry.target > 0)
              .flatMap(({ category, target }) => selectFreshFallbackStories(category, target, exclusions)),
          ).slice(0, needed)
        : [];

      onImportNewswireStories("Mixed", [...manualResult.stories, ...fallback], buildImportOptions());
      onClose();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "तैयार खबरें लोड नहीं हो सकीं।",
      });
    }
  }, [state.articleCount, state.languageMode, state.layoutDesign, state.tab, buildImportOptions, onImportNewswireStories, onClose, getManualBoxStories]);

  // ── Step header text ───────────────────────────────────────────────────────

  const stepLabel = useMemo(() => {
    if (state.tab === "editorial") return "एडिटोरियल पेज सेटअप";
    if (state.tab === "advertisement") return "विज्ञापन पेज सेटअप";
    switch (state.step) {
      case "layout":
        return state.tab === "front" ? "फ्रंट पेज का डिज़ाइन चुनें" : "लेआउट डिज़ाइन चुनें";
      case "style": return "अख़बार का रंग पैलेट चुनें";
      case "category": return "श्रेणी चुनें";
    }
  }, [state.tab, state.step]);

  const activeSteps = getWizardSteps(state.tab);

  if (!open) return null;

  return (
    <div
      className="generation-wizard-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="न्यूज़ लेआउट बनाएं"
    >
      <div className={`generation-wizard-panel step-${state.step} tab-${state.tab}`}>
        {/* Header */}
        <div className="generation-wizard-header">
          <div>
            <span>लेआउट बिल्डर</span>
            <strong>{stepLabel}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="बंद करें">
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        {/* 4 Tabs */}
        <div className="generation-wizard-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={state.tab === tab}
              className={`generation-wizard-tab${state.tab === tab ? " active" : ""}`}
              // Front and inside are now separate flows with separate layout
              // catalogues, so SET_TAB resets the step and the selected template
              // for the tab being opened.
              onClick={() => dispatch({ type: "SET_TAB", tab })}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── Front Page / Inside Pages ──
            Same 3-screen tail (style → category), but the Front Page tab skips
            the count step and picks from the front-page-only catalogue. */}
        {(state.tab === "front" || state.tab === "inside") ? (
          <>
            {/* Step indicators */}
            <div className="generation-wizard-steps" aria-hidden="true">
              {activeSteps.map((step, index) => (
                <span
                  key={step}
                  className={activeSteps.indexOf(state.step) >= index ? "active" : ""}
                >
                  {index + 1}
                </span>
              ))}
            </div>

            {/* Layout step — front page draws from its own catalogue */}
            {state.step === "layout" ? (
              state.tab === "front" ? (
                <FrontPageLayoutScreen
                  state={state}
                  layoutPreviews={layoutPreviews}
                  dispatch={dispatch}
                  onContinue={() => dispatch({ type: "SET_STEP", step: "style" })}
                />
              ) : (
                <LayoutPickerScreen
                  state={state}
                  layoutPreviews={layoutPreviews}
                  dispatch={dispatch}
                  onGenerateStoryLayout={onGenerateStoryLayout}
                  onContinue={() => dispatch({ type: "SET_STEP", step: "style" })}
                />
              )
            ) : null}

            {/* Style step */}
            {state.step === "style" ? (
              <StyleScreen
                state={state}
                dispatch={dispatch}
                onBack={() => dispatch({ type: "SET_STEP", step: "layout" })}
                onContinue={() => dispatch({ type: "SET_STEP", step: "category" })}
              />
            ) : null}

            {/* Category step — split screen: manual box seeder (left) + the
                existing category/language picker (right), unchanged */}
            {state.step === "category" ? (
              <div className="generation-category-split">
                <ManualBoxSeeder state={state} dispatch={dispatch} layoutPreviews={layoutPreviews} />
                <CategoryScreen
                  state={state}
                  dispatch={dispatch}
                  onBack={() => dispatch({ type: "SET_STEP", step: "style" })}
                  onEditLayout={() => dispatch({ type: "SET_STEP", step: "layout" })}
                  onLoadPreloaded={state.tab === "front" ? handleLoadPreloadedMixed : handleLoadPreloaded}
                  onLoadLive={() => void (state.tab === "front" ? handleLoadLiveMixed() : handleLoadLive())}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {/* ── Editorial Page ── */}
        {state.tab === "editorial" ? (
          <EditorialSlotPanel
            state={state}
            dispatch={dispatch}
            layoutPreviews={layoutPreviews}
            onImportNewswireStories={onImportNewswireStories}
            buildImportOptions={buildImportOptions}
            onClose={onClose}
          />
        ) : null}

        {/* ── Advertisement Page ── */}
        {state.tab === "advertisement" ? (
          <AdvertisementPagePanel
            state={state}
            dispatch={dispatch}
            layoutPreviews={layoutPreviews}
            onImportNewswireStories={onImportNewswireStories}
            buildImportOptions={buildImportOptions}
            onClose={onClose}
            pages={pages}
            activePageNumber={activePageNumber}
            onSelectPageByNumber={onSelectPageByNumber}
          />
        ) : null}
      </div>
    </div>
  );
});
