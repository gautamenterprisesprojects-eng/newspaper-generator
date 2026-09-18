import { isFrontPageTemplate, TEMPLATE_REGISTRY } from "@/engines/TemplateLayout/TemplateRegistry";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import { EDITOR_RAIL_FRONT_TEMPLATE_ID } from "@/engines/MasterPage/YouthUpdateConfig";
import type { NmsBundleArticle, NmsBundlePayload } from "./nmsBundleTypes";
import { textValue } from "./nmsBundleTypes";
import { fetchNationalAndMadhyaPradeshFill } from "./nmsNewsFill";

/**
 * NMS PageMint editions always open with this wizard front layout:
 * "एडिटर रेल फ्रंट पेज (8 बॉक्स)" (CliffFrontEditorRail8A).
 */
export const NMS_FRONT_TEMPLATE_ID: TemplateId = EDITOR_RAIL_FRONT_TEMPLATE_ID;
export const NMS_FRONT_TEMPLATE_NAME =
  TEMPLATE_REGISTRY[EDITOR_RAIL_FRONT_TEMPLATE_ID]?.name ?? "एडिटर रेल फ्रंट पेज (8 बॉक्स)";

export const resolveNmsFrontTemplateId = (payload?: NmsBundlePayload): TemplateId => {
  const extended = payload as NmsBundlePayload & {
    layout?: unknown;
    frontPageLayout?: unknown;
    meta?: { layout?: unknown };
  };
  const candidates = [
    textValue(extended?.layout),
    textValue(extended?.frontPageLayout),
    extended?.meta && typeof extended.meta === "object" ? textValue(extended.meta.layout) : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate in TEMPLATE_REGISTRY && isFrontPageTemplate(candidate as TemplateId)) {
      return candidate as TemplateId;
    }
  }

  return NMS_FRONT_TEMPLATE_ID;
};

const frontLayoutName = (templateId: TemplateId) =>
  TEMPLATE_REGISTRY[templateId]?.name ?? NMS_FRONT_TEMPLATE_NAME;

/**
 * Same inside-page catalogue the generation wizard offers (not Youth UPDATE,
 * not editorial). Box counts come from TEMPLATE_REGISTRY so a "7A" name that
 * actually has 7 slots is planned as 7, not the wizard preview's rounded count.
 */
/**
 * Wizard default inside layout (GenerationWizardModal DEFAULT_INSIDE_LAYOUT).
 * NMS leftover pages use this first — the dense 8-column mix is not the
 * suggested inside sheet.
 */
export const NMS_INSIDE_TEMPLATE_ID: TemplateId = "IndianFront6A";
export const NMS_INSIDE_TEMPLATE_NAME = "इंडियन फ्रंट 6A";

export const NMS_INSIDE_LAYOUTS: Array<{ id: TemplateId; name: string }> = [
  { id: "IndianFront6A", name: "इंडियन फ्रंट 6A" },
  { id: "IndianFront7A", name: "इंडियन फ्रंट 7A" },
  { id: "IndianMixed7A", name: "इंडियन मिक्स्ड 7A" },
  { id: "CliffInsideSixColumn7A", name: "6 Column Inside Anchor Rail" },
  { id: "CliffInsideSixColumn8B", name: "6 Column Inside City Stack" },
  { id: "CliffInsideSixColumn7C", name: "6 Column Inside Offset Lead" },
  { id: "CliffInsideSixColumn8D", name: "6 Column Inside Uneven Mosaic" },
  { id: "CliffInsideEightColumn8A", name: "8 Column Inside Banner Mix" },
  { id: "CliffInsideEightColumn8B", name: "8 Column Inside City Mix" },
  { id: "CliffInsideEightColumn7C", name: "8 Column Inside Anchor Mix" },
  { id: "CliffInsideEightColumn8D", name: "8 Column Inside Lead Mix" },
  { id: "IndianFront7A", name: "इंडियन फ्रंट 7A" },
  { id: "IndianFront7B", name: "इंडियन फ्रंट 7B" },
  { id: "IndianMixed7A", name: "इंडियन मिक्स्ड 7A" },
  { id: "IndianFront8B", name: "इंडियन फ्रंट 8B" },
  { id: "IndianCity5A", name: "इंडियन सिटी 5A" },
  { id: "IndianCity6A", name: "इंडियन सिटी 6A" },
  { id: "IndianColumn5A", name: "इंडियन कॉलम 5A" },
  { id: "IndianBalance6A", name: "इंडियन बैलेंस 6A" },
  { id: "ProfessionalNews10A", name: "प्रोफेशनल न्यूज़पेपर लेआउट (9 खबरें)" },
  { id: "Layout16", name: "लेआउट 16" },
  { id: "AdvancedHeroRail7A", name: "एडवांस्ड हीरो रेल 7A" },
  { id: "AdvancedSidebarFeature9A", name: "एडवांस्ड साइडबार फ़ीचर 9A" },
  { id: "AdvancedMagazineCover6A", name: "एडवांस्ड मैगज़ीन कवर 6A" },
  { id: "AdvancedInfographicSplit7A", name: "एडवांस्ड इन्फोग्राफिक स्प्लिट 7A" },
  { id: "AdvancedEditorialColumn7A", name: "एडवांस्ड एडिटोरियल कॉलम 7A" },
  { id: "AdvancedQuadMosaic7A", name: "एडवांस्ड क्वाड मोज़ाइक 7A" },
  { id: "CliffInsideSixColumn7A", name: "6 Column Inside Anchor Rail" },
  { id: "CliffInsideSixColumn8B", name: "6 Column Inside City Stack" },
  { id: "CliffInsideSixColumn7C", name: "6 Column Inside Offset Lead" },
  { id: "CliffInsideSixColumn8D", name: "6 Column Inside Uneven Mosaic" },
];

export type NmsEditionPagePlan = {
  pageNumber: number;
  pageKind: "front" | "inside";
  templateId: TemplateId;
  templateName: string;
  boxCount: number;
  nmsArticleCount: number;
  fillArticleCount: number;
  articles: NmsBundleArticle[];
};

export type NmsEditionPlan = {
  pages: NmsEditionPagePlan[];
  nmsArticleCount: number;
  filledArticleCount: number;
};

const articleKey = (article: NmsBundleArticle, index: number) =>
  String(article.newsId ?? article.headline ?? `nms-${index}`);

export const getNmsTemplateBoxCount = (templateId: TemplateId) => {
  const definition = TEMPLATE_REGISTRY[templateId];
  if (!definition) {
    throw new Error(`Unknown NMS layout template: ${templateId}`);
  }
  return definition.storyCount;
};

export const pickNmsInsideTemplateId = (
  usedTemplateIds: ReadonlySet<TemplateId>,
  _random: () => number = Math.random,
): TemplateId => {
  const pool = NMS_INSIDE_LAYOUTS.map((layout) => layout.id);
  const unused = pool.filter((id) => !usedTemplateIds.has(id));
  const candidates = unused.length > 0 ? unused : pool;
  // Keep the wizard listed order instead of shuffling.
  return candidates[0] ?? pool[0];
};

const insideLayoutName = (templateId: TemplateId) =>
  NMS_INSIDE_LAYOUTS.find((layout) => layout.id === templateId)?.name
  ?? TEMPLATE_REGISTRY[templateId]?.name
  ?? templateId;

export const planNmsSequentialPages = (
  nmsArticles: NmsBundleArticle[],
  pickInside: (usedTemplateIds: ReadonlySet<TemplateId>) => TemplateId = (used) => pickNmsInsideTemplateId(used),
  frontTemplateId: TemplateId = NMS_FRONT_TEMPLATE_ID,
): Array<Omit<NmsEditionPagePlan, "articles" | "fillArticleCount"> & {
  nmsArticles: NmsBundleArticle[];
  fillNeeded: number;
}> => {
  if (nmsArticles.length === 0) {
    throw new Error("NMS bundle has no articles to lay out.");
  }

  const remaining = [...nmsArticles];
  const pages: Array<Omit<NmsEditionPagePlan, "articles" | "fillArticleCount"> & {
    nmsArticles: NmsBundleArticle[];
    fillNeeded: number;
  }> = [];

  const frontBoxCount = getNmsTemplateBoxCount(frontTemplateId);
  const frontNms = remaining.splice(0, frontBoxCount);
  pages.push({
    pageNumber: 1,
    pageKind: "front",
    templateId: frontTemplateId,
    templateName: frontLayoutName(frontTemplateId),
    boxCount: frontBoxCount,
    nmsArticleCount: frontNms.length,
    nmsArticles: frontNms,
    fillNeeded: Math.max(0, frontBoxCount - frontNms.length),
  });

  const usedInside = new Set<TemplateId>();
  while (remaining.length > 0) {
    const templateId = pickInside(usedInside);
    usedInside.add(templateId);
    const boxCount = getNmsTemplateBoxCount(templateId);
    const pageNms = remaining.splice(0, boxCount);
    pages.push({
      pageNumber: pages.length + 1,
      pageKind: "inside",
      templateId,
      templateName: insideLayoutName(templateId),
      boxCount,
      nmsArticleCount: pageNms.length,
      nmsArticles: pageNms,
      fillNeeded: Math.max(0, boxCount - pageNms.length),
    });
  }

  return pages;
};

export const buildNmsSequentialEdition = async (
  nmsArticles: NmsBundleArticle[],
  pickInside?: (usedTemplateIds: ReadonlySet<TemplateId>) => TemplateId,
  frontTemplateId: TemplateId = NMS_FRONT_TEMPLATE_ID,
): Promise<NmsEditionPlan> => {
  const planned = planNmsSequentialPages(nmsArticles, pickInside, frontTemplateId);
  const usedIds = new Set(nmsArticles.map((article, index) => articleKey(article, index)));
  const pages: NmsEditionPagePlan[] = [];

  for (const page of planned) {
    const fillArticles = page.fillNeeded > 0
      ? await fetchNationalAndMadhyaPradeshFill(page.fillNeeded, usedIds)
      : [];
    if (fillArticles.length < page.fillNeeded) {
      throw new Error(
        `Page ${page.pageNumber} (${page.templateName}) needs ${page.fillNeeded} National/Madhya Pradesh fill articles but only ${fillArticles.length} were available.`,
      );
    }
    for (const [index, article] of fillArticles.entries()) {
      usedIds.add(articleKey(article, nmsArticles.length + index));
    }
    pages.push({
      pageNumber: page.pageNumber,
      pageKind: page.pageKind,
      templateId: page.templateId,
      templateName: page.templateName,
      boxCount: page.boxCount,
      nmsArticleCount: page.nmsArticleCount,
      fillArticleCount: fillArticles.length,
      articles: [...page.nmsArticles, ...fillArticles],
    });
  }

  return {
    pages,
    nmsArticleCount: nmsArticles.length,
    filledArticleCount: pages.reduce((sum, page) => sum + page.fillArticleCount, 0),
  };
};
