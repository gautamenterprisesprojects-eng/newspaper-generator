import {
  NMS_FRONT_TEMPLATE_ID,
  NMS_FRONT_TEMPLATE_NAME,
  NMS_INSIDE_TEMPLATE_ID,
  getNmsTemplateBoxCount,
  pickNmsInsideTemplateId,
  planNmsSequentialPages,
} from "./nmsSequentialEdition";
import type { NmsBundleArticle } from "./nmsBundleTypes";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const dummyArticles = (count: number): NmsBundleArticle[] =>
  Array.from({ length: count }, (_, index) => ({
    newsId: `nms-${index + 1}`,
    headline: `NMS headline ${index + 1}`,
    body: `NMS body ${index + 1}.`,
  }));

const scriptedPicker = (ids: TemplateId[]) => {
  let index = 0;
  return () => ids[Math.min(index++, ids.length - 1)];
};

assert(getNmsTemplateBoxCount("CliffFront8A") === 8, "CliffFront8A is the 8-box front");
assert(pickNmsInsideTemplateId(new Set()) === NMS_INSIDE_TEMPLATE_ID, "first leftover page uses the wizard inside layout");
assert(getNmsTemplateBoxCount("IndianFront6A") === 6, "wizard inside layout is 6 boxes");
assert(getNmsTemplateBoxCount("AdvancedInfographicSplit7A") === 7, "Infographic Split 7A has 7 boxes");
assert(getNmsTemplateBoxCount("IndianMixed7A") === 7, "Indian Mixed 7A has 7 boxes");
assert(getNmsTemplateBoxCount("CliffInsideSixColumn8B") === 8, "6 Column Inside City Stack has 8 boxes");

const twentyOne = planNmsSequentialPages(
  dummyArticles(21),
  scriptedPicker(["AdvancedInfographicSplit7A", "IndianMixed7A"]),
);

assert(twentyOne.length === 3, "21 NMS stories become front + two inside pages");
assert(twentyOne[0].templateId === NMS_FRONT_TEMPLATE_ID, "page 1 is always CliffFront8A");
assert(twentyOne[0].templateName === NMS_FRONT_TEMPLATE_NAME, "page 1 uses the Cliff 8-box front name");
assert(twentyOne[0].pageKind === "front", "page 1 is the front page");
assert(twentyOne[0].nmsArticleCount === 8, "front consumes 8 NMS stories");
assert(twentyOne[0].fillNeeded === 0, "full NMS front does not pull National/MP");
assert(twentyOne[0].nmsArticles[0]?.newsId === "nms-1", "bundle order is preserved on the front");
assert(twentyOne[0].nmsArticles[7]?.newsId === "nms-8", "front takes the first eight bundle stories");

assert(twentyOne[1].pageKind === "inside", "page 2 is an inside page");
assert(twentyOne[1].templateId === "AdvancedInfographicSplit7A", "first leftover page uses the chosen 7A layout");
assert(twentyOne[1].nmsArticleCount === 7, "7-box inside page consumes 7 remaining NMS stories");
assert(twentyOne[1].fillNeeded === 0, "enough NMS remains, so no wire fill yet");
assert(twentyOne[1].nmsArticles[0]?.newsId === "nms-9", "inside page continues after the front eight");

assert(twentyOne[2].templateId === "IndianMixed7A", "next leftover page picks another inside layout");
assert(twentyOne[2].nmsArticleCount === 6, "last 6 NMS stories land on the last page");
assert(twentyOne[2].fillNeeded === 1, "the leftover 7th box is reserved for National/MP fill");
assert(twentyOne[2].nmsArticles[5]?.newsId === "nms-21", "the last NMS story is used before fill");

const eightOnly = planNmsSequentialPages(dummyArticles(8), scriptedPicker(["IndianMixed7A"]));
assert(eightOnly.length === 1, "exactly 8 NMS stories is a single front page");
assert(eightOnly[0].fillNeeded === 0, "no leftover NMS means no inside page");

const nine = planNmsSequentialPages(dummyArticles(9), scriptedPicker(["AdvancedInfographicSplit7A"]));
assert(nine.length === 2, "9 NMS stories still open an inside page for the leftover 1");
assert(nine[1].nmsArticleCount === 1, "the leftover NMS story is placed first on the inside page");
assert(nine[1].fillNeeded === 6, "the other 6 boxes come from National/MP");

const four = planNmsSequentialPages(dummyArticles(4), scriptedPicker(["IndianMixed7A"]));
assert(four.length === 1, "fewer than 8 NMS stories still generate the Cliff front");
assert(four[0].nmsArticleCount === 4, "all 4 NMS stories go on the front");
assert(four[0].fillNeeded === 4, "the other 4 front boxes come from National/MP");

const shortInside = planNmsSequentialPages(
  dummyArticles(12),
  scriptedPicker(["AdvancedInfographicSplit7A"]),
);
assert(shortInside[1].nmsArticleCount === 4, "4 leftover NMS stories still occupy the inside page");
assert(shortInside[1].fillNeeded === 3, "a 7-box inside page then fills the remaining 3 from National/MP");

assert(
  twentyOne.every((page, index) => index === 0 || page.templateId !== NMS_FRONT_TEMPLATE_ID),
  "inside pages never reuse the Cliff front template",
);

console.log("nmsSequentialEditionTests passed");
