import {
  CLIFFDEMO3_NMS_CATEGORY,
  CLIFFDEMO3_PAGEMINT_ID,
  isCliffDemo3NewspaperName,
  isCliffDemo3PublisherIdentity,
  isCliffDemo3PublisherSession,
  isNmsBundleCategory,
  pagePlanRequestsNmsBundle,
  shouldUseNmsBundleFeed,
} from "./cliffDemo3Publisher";
import { nmsBundleArticleToNewswireStory } from "./nmsBundleStories";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

assert(CLIFFDEMO3_PAGEMINT_ID === "cliffdemo3", "PageMint id must stay cliffdemo3");
assert(CLIFFDEMO3_NMS_CATEGORY === "NMS Bundle", "settings label must stay NMS Bundle");
assert(isCliffDemo3PublisherIdentity("cliffdemo3"), "username cliffdemo3 is this publisher");
assert(isCliffDemo3PublisherIdentity("CliffDemo3"), "identity match is case-insensitive");
assert(!isCliffDemo3PublisherIdentity("85a50d12-8aa3-4f88-93aa-8153443c1c98"), "Youth UPDATE uuid is not cliffdemo3");
assert(isCliffDemo3NewspaperName("THE CLIFF NEWS"), "English masthead name identifies cliffdemo3");
assert(isCliffDemo3NewspaperName("Cliff News"), "short English masthead name identifies cliffdemo3");
assert(isCliffDemo3NewspaperName("द क्लिफ न्यूज़"), "Hindi masthead name identifies cliffdemo3");
assert(isCliffDemo3NewspaperName("द क्लिफ़ न्यूज़"), "portal profile spelling with nukta still identifies cliffdemo3");
assert(!isCliffDemo3NewspaperName("Youth UPDATE"), "other newspapers must not match");
assert(isCliffDemo3PublisherSession({ publisherId: "cliffdemo3" }), "portal publisherId cliffdemo3 is enough");
assert(
  isCliffDemo3PublisherSession({ newspaperName: "THE CLIFF NEWS" }),
  "launch newspaperName is enough when the portal sends a UUID",
);
assert(
  !isCliffDemo3PublisherSession({ publisherId: "other-publisher", newspaperName: "City Reporter" }),
  "unrelated sessions must stay off the NMS category",
);

assert(isNmsBundleCategory("NMS Bundle"), "exact settings label matches");
assert(isNmsBundleCategory("nms-bundle"), "hyphenated alias matches");
assert(isNmsBundleCategory("NMS"), "the portal's Settings list ships the short NMS");
assert(isNmsBundleCategory("nms"), "short spelling match is case-insensitive");
assert(!isNmsBundleCategory("National"), "existing newswire categories are not NMS Bundle");
assert(!isNmsBundleCategory(""), "an unset category is not an NMS page");
assert(!isNmsBundleCategory("   "), "a blank category is not an NMS page");
assert(pagePlanRequestsNmsBundle(["NMS Bundle"]), "categories[] from Settings is enough");
assert(pagePlanRequestsNmsBundle(["NMS"]), "categories[] as actually stored by the portal is enough");
assert(pagePlanRequestsNmsBundle([], "NMS Bundle"), "legacy category string is enough");
assert(!pagePlanRequestsNmsBundle(["National"], ""), "a National page is not an NMS page");
assert(!pagePlanRequestsNmsBundle([], ""), "an empty page plan is not an NMS page");

assert(
  !shouldUseNmsBundleFeed({ isCliffDemo3: true, isFrontPage: true, plannedCategories: [] }),
  "cliffdemo3 front page uses the mixed category API like other publishers",
);
assert(
  !shouldUseNmsBundleFeed({
    isCliffDemo3: true,
    isFrontPage: true,
    plannedCategories: ["NMS Bundle"],
  }),
  "cliffdemo3 front page stays on the mix even if Settings still lists NMS",
);
assert(
  !shouldUseNmsBundleFeed({ isCliffDemo3: false, isFrontPage: true, plannedCategories: [] }),
  "other publishers keep the mixed front page",
);
assert(
  shouldUseNmsBundleFeed({
    isCliffDemo3: true,
    isFrontPage: false,
    plannedCategories: ["NMS Bundle"],
  }),
  "cliffdemo3 inside page uses NMS when Settings selected it",
);
assert(
  !shouldUseNmsBundleFeed({
    isCliffDemo3: true,
    isFrontPage: false,
    plannedCategories: ["Madhya Pradesh"],
    plannedCategory: "Madhya Pradesh",
  }),
  "cliffdemo3 inside pages keep their existing category chips",
);
assert(
  !shouldUseNmsBundleFeed({
    isCliffDemo3: false,
    isFrontPage: false,
    plannedCategories: ["NMS Bundle"],
  }),
  "NMS Bundle is ignored for every non-cliffdemo3 publisher",
);

const converted = nmsBundleArticleToNewswireStory(
  {
    newsId: "nms-1",
    headline: "क्लिप हेडलाइन",
    body: "पहला पैराग्राफ।\n\nहेडलाइन:\nक्लिप हेडलाइन\n\nदूसरा पैराग्राफ।",
    place: "भोपाल",
    category: "National",
    reporter: { nameHi: "रिपोर्टर" },
    coverImage: { url: "https://example.com/cover.jpg" },
  },
  0,
);
assert(converted.id === "nms-1", "bundle newsId becomes the newswire id");
assert(converted.headline === "क्लिप हेडलाइन", "headline is copied");
assert(!converted.body.includes("हेडलाइन"), "label-only NMS lines are stripped from body");
assert(converted.imageUrl === "https://example.com/cover.jpg", "cover image url is copied");
assert(converted.bylineName === "रिपोर्टर", "Hindi reporter name is used");
assert(converted.language === "hindi", "Devanagari copy is marked Hindi");
assert(converted.sourceTitle === "NMS", "source stays NMS so live newswire is not implied");

console.log("cliffDemo3PublisherTests passed");
