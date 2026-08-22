import { strict as assert } from "node:assert";
import {
  calculateStoryManagerVirtualRange,
  filterStoryManagerCards,
  flattenStoryManagerCards,
} from "./StoryManagerEngine";
import type { StoryManagerPageGroup } from "./StoryManagerTypes";

const pageGroups: StoryManagerPageGroup[] = [
  {
    pageId: "page-1",
    pageNumber: 1,
    cards: [
      {
        id: "story-1",
        pageId: "page-1",
        pageNumber: 1,
        headline: "Lead City Story",
        name: "Lead City Story",
        author: "Reporter",
        category: "city",
        tags: ["metro"],
        priority: "lead",
        status: "ready",
        color: "#b42318",
        columns: 6,
        width: 720,
        height: 420,
        fillPercent: 92,
        image: true,
        factBox: false,
        pullQuote: false,
        caption: true,
        locked: false,
        hidden: false,
        overflow: false,
        frame: {} as never,
        metrics: null,
      },
      {
        id: "story-2",
        pageId: "page-1",
        pageNumber: 1,
        headline: "Business Brief",
        name: "Business Brief",
        author: "Desk",
        category: "business",
        tags: ["market"],
        priority: "brief",
        status: "overflow",
        color: "#166534",
        columns: 1,
        width: 120,
        height: 220,
        fillPercent: 100,
        image: false,
        factBox: false,
        pullQuote: false,
        caption: false,
        locked: false,
        hidden: false,
        overflow: true,
        frame: {} as never,
        metrics: null,
      },
    ],
  },
];

const filteredBySearch = filterStoryManagerCards(pageGroups, {
  query: "market",
  priority: "all",
  pageId: "all",
  status: "all",
});
assert.equal(flattenStoryManagerCards(filteredBySearch).length, 1);
assert.equal(flattenStoryManagerCards(filteredBySearch)[0].id, "story-2");

const filteredByPriority = filterStoryManagerCards(pageGroups, {
  query: "",
  priority: "lead",
  pageId: "all",
  status: "all",
});
assert.equal(flattenStoryManagerCards(filteredByPriority).length, 1);
assert.equal(flattenStoryManagerCards(filteredByPriority)[0].priority, "lead");

const filteredByStatus = filterStoryManagerCards(pageGroups, {
  query: "",
  priority: "all",
  pageId: "all",
  status: "overflow",
});
assert.equal(flattenStoryManagerCards(filteredByStatus).length, 1);
assert.equal(flattenStoryManagerCards(filteredByStatus)[0].status, "overflow");

const virtualRange = calculateStoryManagerVirtualRange({
  itemCount: 100,
  scrollTop: 450,
  viewportHeight: 300,
  itemHeight: 90,
});
assert.equal(virtualRange.startIndex, 1);
assert.equal(virtualRange.endIndex, 13);
assert.equal(virtualRange.offsetTop, 90);
assert.equal(virtualRange.totalHeight, 9000);

console.log("Story manager tests passed: 4");
