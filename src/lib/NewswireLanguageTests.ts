import assert from "assert";
import {
  getLocalizedArticleContent,
  getSlotLanguage,
  hasMeaningfulLocalizedContent,
  selectLocalizedBody,
  type NewswireStory,
} from "./newswire";

const makeStory = (): NewswireStory => ({
  id: "record-1",
  category: "Sports",
  headline: "हिंदी शीर्षक।",
  subheadline: "हिंदी तथ्य एक।",
  body: "हिंदी लंबी खबर।",
  shortBody: "हिंदी सौ शब्द।",
  mediumBody: "हिंदी तीन सौ शब्द।",
  longBody: "हिंदी हजार शब्द।",
  summary: ["हिंदी तथ्य एक", "हिंदी तथ्य दो", "हिंदी तथ्य तीन"],
  caption: "हिंदी कैप्शन।",
  imageUrl: "https://example.com/image.jpg",
  imageCaption: "हिंदी कैप्शन।",
  sourceTitle: "Source",
  sourceUrl: "https://example.com/story",
  publishedAt: null,
  localized: {
    hindi: {
      language: "hindi",
      headline: "हिंदी शीर्षक।",
      kicker: "",
      subheadings: ["हिंदी तथ्य एक", "हिंदी तथ्य दो", "हिंदी तथ्य तीन"],
      subheadline: "हिंदी तथ्य एक।",
      body: "हिंदी हजार शब्द।",
      shortBody: "हिंदी सौ शब्द।",
      mediumBody: "हिंदी तीन सौ शब्द।",
      longBody: "हिंदी हजार शब्द।",
      caption: "हिंदी कैप्शन।",
      imageCaption: "हिंदी कैप्शन।",
      imageUrl: "https://example.com/image.jpg",
      sourceUrl: "https://example.com/story",
      category: "Sports",
    },
    english: {
      language: "english",
      headline: "English headline.",
      kicker: "",
      subheadings: ["English fact one", "English fact two", "English fact three"],
      subheadline: "English fact one.",
      body: "English thousand-word story.",
      shortBody: "English two hundred fifty words.",
      mediumBody: "English five hundred words.",
      longBody: "English one thousand words.",
      caption: "English caption.",
      imageCaption: "English caption.",
      imageUrl: "https://example.com/image.jpg",
      sourceUrl: "https://example.com/story",
      category: "Sports",
    },
  },
});

assert.deepEqual(
  Array.from({ length: 1 }, (_, index) => getSlotLanguage("bilingual", index)),
  ["english"],
);
assert.deepEqual(
  Array.from({ length: 2 }, (_, index) => getSlotLanguage("bilingual", index)),
  ["english", "hindi"],
);
assert.deepEqual(
  Array.from({ length: 3 }, (_, index) => getSlotLanguage("bilingual", index)),
  ["english", "hindi", "english"],
);
assert.deepEqual(
  Array.from({ length: 6 }, (_, index) => getSlotLanguage("bilingual", index)),
  ["english", "hindi", "english", "hindi", "english", "hindi"],
);
assert.deepEqual(
  Array.from({ length: 7 }, (_, index) => getSlotLanguage("bilingual", index)),
  ["english", "hindi", "english", "hindi", "english", "hindi", "english"],
);
assert.equal(Array.from({ length: 6 }, (_, index) => getSlotLanguage("bilingual", index)).filter((lang) => lang === "english").length, 3);
assert.equal(Array.from({ length: 6 }, (_, index) => getSlotLanguage("bilingual", index)).filter((lang) => lang === "hindi").length, 3);
assert.equal(Array.from({ length: 7 }, (_, index) => getSlotLanguage("bilingual", index)).filter((lang) => lang === "english").length, 4);
assert.equal(Array.from({ length: 7 }, (_, index) => getSlotLanguage("bilingual", index)).filter((lang) => lang === "hindi").length, 3);

const story = makeStory();
const hindi = getLocalizedArticleContent(story, "hindi", 250);
const english = getLocalizedArticleContent(story, "english", 1000);

assert.equal(getSlotLanguage(undefined, 0), "hindi");
assert.equal(getSlotLanguage("hindi", 4), "hindi");
assert.equal(getSlotLanguage("english", 4), "english");
assert.equal(hindi?.headline, "हिंदी शीर्षक।");
assert.equal(english?.headline, "English headline.");
assert.equal(english?.body, "English one thousand words.");
assert.equal(selectLocalizedBody(story.localized?.english ?? {}, 250), "English two hundred fifty words.");
assert.equal(selectLocalizedBody(story.localized?.english ?? {}, 500), "English five hundred words.");
assert.equal(selectLocalizedBody(story.localized?.english ?? {}, 1000), "English one thousand words.");
assert.equal(english?.imageUrl, hindi?.imageUrl);
assert.deepEqual(english?.subheadings, ["English fact one", "English fact two", "English fact three"]);
assert.equal(hasMeaningfulLocalizedContent(story, "english", 500), true);
assert.equal(hasMeaningfulLocalizedContent({ ...story, localized: { hindi: story.localized?.hindi } }, "english", 500), false);

console.log("Newswire language helper tests passed");
