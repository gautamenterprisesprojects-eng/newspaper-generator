import assert from "assert";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import { saveDocument } from "@/engines/DocumentEngine/DocumentSerializer";
import { loadDocument } from "@/engines/DocumentEngine/DocumentLoader";
import type { NewswireStory, PageLanguageMode } from "@/lib/newswire";

class TestOffscreenCanvas {
  private readonly context = {
    font: "",
    measureText(text: string) {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
      let width = 0;

      for (const character of Array.from(text)) {
        if (/\s/u.test(character)) {
          width += fontSize * 0.28;
        } else if (/[\u0900-\u097F]/u.test(character)) {
          width += fontSize * 0.62;
        } else if (/[A-Z]/u.test(character)) {
          width += fontSize * 0.58;
        } else {
          width += fontSize * 0.5;
        }
      }

      return { width };
    },
  };

  getContext() {
    return this.context;
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: TestOffscreenCanvas,
});

const { useEditorStore } = require("./editorStore") as typeof import("./editorStore");

const body = (label: string) =>
  Array.from({ length: 90 }, (_, index) => `${label} sentence ${index + 1}.`).join(" ");

const bodyWords = (label: string, count: number) =>
  `${label} ${Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ")}.`;

const makeArticle = (index: number): NewswireStory => ({
  id: `record-${index}`,
  category: "Sports",
  headline: `हिंदी शीर्षक ${index}।`,
  subheadline: `हिंदी तथ्य ${index}।`,
  body: body(`हिंदी ${index}`),
  shortBody: body(`हिंदी short ${index}`),
  mediumBody: body(`हिंदी medium ${index}`),
  longBody: body(`हिंदी long ${index}`),
  summary: [`हिंदी तथ्य ${index}A`, `हिंदी तथ्य ${index}B`, `हिंदी तथ्य ${index}C`],
  caption: `हिंदी कैप्शन ${index}।`,
  imageUrl: `https://example.com/image-${index}.jpg`,
  imageCaption: `हिंदी कैप्शन ${index}।`,
  sourceTitle: "Source",
  sourceUrl: `https://example.com/story-${index}`,
  publishedAt: null,
  localized: {
    hindi: {
      language: "hindi",
      headline: `हिंदी शीर्षक ${index}।`,
      kicker: "",
      subheadings: [`हिंदी तथ्य ${index}A`, `हिंदी तथ्य ${index}B`, `हिंदी तथ्य ${index}C`],
      subheadline: `हिंदी तथ्य ${index}।`,
      body: body(`हिंदी ${index}`),
      shortBody: body(`हिंदी short ${index}`),
      mediumBody: body(`हिंदी medium ${index}`),
      longBody: body(`हिंदी long ${index}`),
      caption: `हिंदी कैप्शन ${index}।`,
      imageCaption: `हिंदी कैप्शन ${index}।`,
      imageUrl: `https://example.com/image-${index}.jpg`,
      sourceUrl: `https://example.com/story-${index}`,
      category: "Sports",
    },
    english: {
      language: "english",
      headline: `English headline ${index}.`,
      kicker: "",
      subheadings: [`English fact ${index}A`, `English fact ${index}B`, `English fact ${index}C`],
      subheadline: `English fact ${index}.`,
      body: body(`English ${index}`),
      shortBody: body(`English short ${index}`),
      mediumBody: body(`English medium ${index}`),
      longBody: body(`English long ${index}`),
      caption: `English caption ${index}.`,
      imageCaption: `English caption ${index}.`,
      imageUrl: `https://example.com/image-${index}.jpg`,
      sourceUrl: `https://example.com/story-${index}`,
      category: "Sports",
    },
  },
});

const makeTieredArticle = (index: number): NewswireStory => ({
  ...makeArticle(index),
  headline: `Tier headline ${index}.`,
  subheadline: `Tier fact ${index}.`,
  body: bodyWords(`longtier${index}-`, 900),
  shortBody: bodyWords(`shorttier${index}-`, 60),
  mediumBody: bodyWords(`mediumtier${index}-`, 180),
  longBody: bodyWords(`longtier${index}-`, 900),
  imageUrl: "",
  imageCaption: "",
  caption: "",
  localized: {
    english: {
      language: "english",
      headline: `Tier headline ${index}.`,
      kicker: "",
      subheadings: [`Tier fact ${index}A`, `Tier fact ${index}B`, `Tier fact ${index}C`],
      subheadline: `Tier fact ${index}.`,
      body: bodyWords(`longtier${index}-`, 900),
      shortBody: bodyWords(`shorttier${index}-`, 60),
      mediumBody: bodyWords(`mediumtier${index}-`, 180),
      longBody: bodyWords(`longtier${index}-`, 900),
      caption: "",
      imageCaption: "",
      imageUrl: "",
      sourceUrl: `https://example.com/story-tier-${index}`,
      category: "Sports",
    },
  },
});

const importArticles = (count: number, languageMode?: PageLanguageMode, bylineName = "") => {
  useEditorStore.getState().importNewswireStories(
    "Sports",
    Array.from({ length: count }, (_, index) => makeArticle(index + 1)),
    {
      templateId: count === 7 ? "IndianFront7A" : "IndianFront6A",
      languageMode,
      bylineName,
      colouredHeadings: false,
      tintedStoryBackground: false,
      subheadingStyle: {
        backgroundColor: "#111111",
        textColor: "#ffffff",
        borderColor: "#111111",
        backgroundOpacity: 1,
      },
      bodyAlignment: "justify",
    },
  );

  return useEditorStore.getState().stories;
};

/** Imports local-category fixtures so the local-desk dateline fallback applies. */
const makeLocalStories = (count: number, languageMode?: PageLanguageMode) => {
  useEditorStore.getState().importNewswireStories(
    "Madhya Pradesh",
    Array.from({ length: count }, (_, index) => ({
      ...makeArticle(index + 1),
      category: "Madhya Pradesh",
    })),
    {
      templateId: "IndianFront6A",
      languageMode,
      bylineName: "THE CLIFF NEWS",
      colouredHeadings: false,
      tintedStoryBackground: false,
      subheadingStyle: {
        backgroundColor: "#111111",
        textColor: "#ffffff",
        borderColor: "#111111",
        backgroundOpacity: 1,
      },
      bodyAlignment: "justify",
    },
  );

  return useEditorStore.getState().stories;
};

const importTieredArticles = () => {
  useEditorStore.getState().importNewswireStories(
    "Sports",
    Array.from({ length: 6 }, (_, index) => makeTieredArticle(index + 1)),
    {
      templateId: "IndianFront6A",
      languageMode: "english",
      bylineName: "THE CLIFF NEWS",
      colouredHeadings: false,
      tintedStoryBackground: false,
      subheadingStyle: {
        backgroundColor: "#111111",
        textColor: "#ffffff",
        borderColor: "#111111",
        backgroundOpacity: 1,
      },
      bodyAlignment: "justify",
    },
  );

  return useEditorStore.getState().stories;
};

let stories = importArticles(6, "hindi");
assert.equal(stories.length, 6, "Hindi mode keeps article count");
assert(stories.every((story) => String(story.articleData.headline).includes("हिंदी")), "Hindi mode uses Hindi headlines");

stories = importArticles(6, "english");
assert.equal(stories.length, 6, "English mode keeps article count");
assert(stories.every((story) => String(story.articleData.headline).includes("English")), "English mode uses English headlines");
assert(stories.every((story) => story.articleData.typography.bodyJustifyMode === "justify-all-lines"), "English body uses newspaper justification");
assert(!stories.some((story) => String(story.articleData.headline).includes("हिंदी")), "English mode must not copy Hindi headlines");

stories = importArticles(6, "english", "THE CLIFF NEWS");
assert(stories.every((story) => story.articleData.author === "THE CLIFF NEWS"), "Wizard byline name is applied to imported stories");
// The local-desk place is only a legitimate fallback for local categories. These
// fixtures are Sports wire copy, so stamping the local city on them would be the
// false dateline the byline rules now prevent — the desk is simply unknown.
assert(stories.every((story) => story.articleData.location === ""), "Wire copy gets no invented city dateline when the API supplies no place");
assert(
  makeLocalStories(6, "english").every((story) => story.articleData.location === "Bhopal"),
  "Local-category stories still fall back to the local desk place",
);

stories = importArticles(6, "english", "THE CLIFF NEWS");
stories[0].articleData.location = "";
useEditorStore.getState().importNewswireStories(
  "Sports",
  Array.from({ length: 6 }, (_, index) => ({
    ...makeArticle(index + 1),
    place: index === 0 ? "New Delhi" : "",
  })),
  {
    templateId: "IndianFront6A",
    languageMode: "english",
    bylineName: "THE CLIFF NEWS",
    colouredHeadings: false,
    tintedStoryBackground: false,
    subheadingStyle: {
      backgroundColor: "#111111",
      textColor: "#ffffff",
      borderColor: "#111111",
      backgroundOpacity: 1,
    },
    bodyAlignment: "justify",
  },
);
assert.equal(useEditorStore.getState().stories[0].articleData.location, "New Delhi", "Explicit API place is carried into the byline location");

useEditorStore.getState().importNewswireStories(
  "Sports",
  Array.from({ length: 6 }, (_, index) => ({
    ...makeArticle(index + 1),
    body: index === 0 ? "New Delhi : Datelined sports copy starts here. More copy follows." : makeArticle(index + 1).body,
    localized: {
      english: {
        ...makeArticle(index + 1).localized!.english!,
        body: index === 0 ? "New Delhi : Datelined sports copy starts here. More copy follows." : makeArticle(index + 1).localized!.english!.body,
        longBody: index === 0 ? "New Delhi : Datelined sports copy starts here. More copy follows." : makeArticle(index + 1).localized!.english!.longBody,
      },
    },
  })),
  {
    templateId: "IndianFront6A",
    languageMode: "english",
    bylineName: "THE CLIFF NEWS",
    colouredHeadings: false,
    tintedStoryBackground: false,
    subheadingStyle: {
      backgroundColor: "#111111",
      textColor: "#ffffff",
      borderColor: "#111111",
      backgroundOpacity: 1,
    },
    bodyAlignment: "justify",
  },
);
assert(
  useEditorStore.getState().stories.some((story) => story.articleData.location === "New Delhi"),
  "Dateline place is carried into the byline location when explicit API place is empty",
);

stories = importArticles(6, "hindi", "THE CLIFF NEWS");
assert(stories.every((story) => story.articleData.author === "सिटी रिपोर्टर"), "Hindi stories use Hindi byline label when wizard label is English");

stories = importArticles(6, "bilingual");
assert.deepEqual(stories.map((story) => String(story.articleData.headline).includes("English") ? "english" : "hindi"), [
  "english",
  "hindi",
  "english",
  "hindi",
  "english",
  "hindi",
]);
assert.equal(stories.filter((story) => String(story.articleData.headline).includes("English")).length, 3);
assert.equal(stories.filter((story) => String(story.articleData.headline).includes("हिंदी")).length, 3);
assert.equal(new Set(stories.map((story) => richTextToPlainText(story.articleData.body).match(/\d+/)?.[0])).size, 6);

stories = importArticles(7, "bilingual");
assert.deepEqual(stories.map((story) => String(story.articleData.headline).includes("English") ? "english" : "hindi"), [
  "english",
  "hindi",
  "english",
  "hindi",
  "english",
  "hindi",
  "english",
]);
assert.equal(stories.filter((story) => String(story.articleData.headline).includes("English")).length, 4);
assert.equal(stories.filter((story) => String(story.articleData.headline).includes("हिंदी")).length, 3);

stories = importArticles(6);
assert(stories.every((story) => String(story.articleData.headline).includes("हिंदी")), "Missing languageMode uses legacy Hindi default");

stories = importTieredArticles();
assert(
  stories.some((story) => richTextToPlainText(story.articleData.body).includes("longtier")),
  "Layout-aware import upgrades underfilled frames to the 1000-word long body tier",
);

importArticles(6, "english");
const loaded = loadDocument(saveDocument(useEditorStore.getState().document));
assert.equal(loaded.settings.languageMode, "english", "Saved and loaded projects retain languageMode");

console.log("Newswire language import tests passed");
