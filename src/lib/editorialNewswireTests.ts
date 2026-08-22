import {
  buildEditorialStories,
  buildRashifalStory,
  getHealthSlotIndex,
  getRashifalSlotIndex,
  getTemplateColumnSpans,
  pickEditorialHeadline,
  type EditorialFeedRecord,
  type RashifalRecord,
} from "./editorialNewswire";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const record = (id: number): EditorialFeedRecord => ({
  id,
  category: "editorial",
  title: `short title ${id}`,
  secondary_headline: `the fuller secondary headline for record ${id}`,
  summary: `summary ${id}`,
  article: `### A heading\nFirst paragraph ${id}.\n\n### Another heading\nSecond paragraph ${id}.`,
});

// ── The headline rule ────────────────────────────────────────────────────────
{
  const r = record(1);
  assert(
    pickEditorialHeadline(r, 1) === "short title 1",
    "a one-column box must take the short title",
  );
  for (const span of [2, 3, 4, 5, 6]) {
    assert(
      pickEditorialHeadline(r, span) === "the fuller secondary headline for record 1",
      `a ${span}-column box must take the secondary headline`,
    );
  }

  // Neither field may leave a box headline-less.
  assert(
    pickEditorialHeadline({ secondary_headline: "only long" }, 1) === "only long",
    "a narrow box with no title must fall back to the secondary headline",
  );
  assert(
    pickEditorialHeadline({ title: "only short" }, 4) === "only short",
    "a wide box with no secondary headline must fall back to the title",
  );
}

// ── Slot mapping on the real template ────────────────────────────────────────
{
  const spans = getTemplateColumnSpans("CliffEditorial8A");
  assert(spans.length === 6, `CliffEditorial8A must report 6 spans, got ${spans.length}`);
  assert(spans[0] === 1, "the leader rail must report as one column");
  // Five-column grid: the leader takes one, the comment four (rail + 3 text).
  assert(spans[1] === 4, "the comment slot must report as four columns");

  const rashifalIndex = getRashifalSlotIndex("CliffEditorial8A");
  assert(rashifalIndex === 2, `the horoscope must be slot index 2, got ${rashifalIndex}`);
  const healthIndex = getHealthSlotIndex("CliffEditorial8A");
  assert(healthIndex === 5, `the health package must be slot index 5, got ${healthIndex}`);

  const rashifal: RashifalRecord[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: `राशि${i + 1} राशिफल 8 Aug 2026`,
    summary: `reading ${i + 1}`,
  }));

  const filler = (n: number) => ({
    id: `filler-${n}`,
    category: "editorial",
    headline: `preloaded headline ${n}`,
    subheadline: "",
    body: `preloaded body ${n}`,
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
  });

  const stories = buildEditorialStories({
    feed: {
      articles: [record(1), record(2), record(3), record(4), record(5)],
      rashifal,
      health: [{ ...record(50), category: "Health", title: "health short", secondary_headline: "health headline" }],
    },
    columnSpans: spans,
    category: "editorial",
    rashifalSlotIndex: rashifalIndex,
    healthSlotIndex: healthIndex,
    fillers: [filler(1), filler(2), filler(3)],
  });

  assert(stories.length === 6, `every slot must get a story, got ${stories.length}`);

  // The horoscope lands in its own box and nowhere else.
  assert(stories[2].id === "editorial-rashifal", "slot 3 must carry the horoscope");
  assert(
    stories.filter((s) => s.id === "editorial-rashifal").length === 1,
    "the horoscope must appear exactly once",
  );

  // Narrow boxes took the short title; wide boxes took the long one.
  assert(
    stories[0].headline.startsWith("short title"),
    `the leader rail must take the short title, got "${stories[0].headline}"`,
  );
  assert(
    stories[1].headline.startsWith("the fuller secondary"),
    `the 5-column comment must take the secondary headline, got "${stories[1].headline}"`,
  );
  assert(stories[3].headline.startsWith("the fuller secondary"), "slot 4 must take the next article");
  assert(stories[5].id.startsWith("editorial-health-"), "slot 6 must carry the Health package");
  assert(stories[5].headline === "health headline", "slot 6 must use the fetched Health headline");
  assert(stories[5].subheadline === "", "the Health package must not print a subheadline");
  assert(stories[5].kicker === "हेल्थ डेस्क", "slot 6 must print a Hindi Health Desk label above the headline");
  assert(stories[5].imageUrl === "", "the Health package must be headline and body only, with no image");

  // The unused line is kept as the subheadline rather than discarded.
  assert(
    stories[0].subheadline.startsWith("the fuller secondary"),
    "a narrow box must keep the long line as its subheadline",
  );
  assert(
    stories[1].subheadline.startsWith("short title"),
    "a wide box must keep the short title as its subheadline",
  );

  // Markdown headings must not reach the page as hashes.
  assert(!stories[0].body.includes("###"), "markdown headings must be unwrapped from the body");
  assert(stories[0].body.includes("First paragraph"), "body prose must survive unwrapping");

  // Five filed articles, five article boxes: the desk's five fill the page
  // exactly, with the horoscope in its own box — no piece printed twice and no
  // filler needed.
  const articleStories = stories.filter((s) => s.id !== "editorial-rashifal");
  assert(articleStories.length === 5, `five boxes must carry articles, got ${articleStories.length}`);
  assert(
    articleStories.every((s) => s.headline.length > 0),
    "no article box may be left without a headline",
  );
  const feedStories = articleStories.filter((s) => s.id.startsWith("editorial-"));
  assert(feedStories.length === 5, `all five filed pieces must be used, got ${feedStories.length}`);
  assert(
    new Set(feedStories.map((s) => s.headline)).size === 5,
    "no editorial piece may appear twice on the page",
  );
  // The desk's five pieces now fill every article box exactly, so no preloaded
  // story is drawn. Fillers remain wired for the days the desk files fewer.
  assert(
    articleStories.filter((s) => s.id.startsWith("filler-")).length === 0,
    "a full day's file must not need a preloaded story",
  );
}

// ── The horoscope block ──────────────────────────────────────────────────────
{
  const rashifal: RashifalRecord[] = [
    {
      id: 1,
      title: "मेष राशिफल 8 Aug 2026",
      summary: "कामकाज में धैर्य रखें और खर्च संभालकर करें। परिवार का सहयोग मिलेगा और दिन सामान्य रहेगा।",
    },
    {
      id: 2,
      title: "वृषभ राशिफल 8 Aug 2026",
      summary: "नई योजना पर आगे बढ़ सकते हैं। बातचीत में संयम रखें और जरूरी काम समय पर पूरा करें।",
    },
  ];
  const story = buildRashifalStory(rashifal, "editorial")!;

  assert(story.headline === "आज का राशिफल", "the horoscope box must be titled आज का राशिफल");
  // The dated title is stripped so the sign reads as a lead-in.
  assert(story.body.includes("मेष: कामकाज में धैर्य रखें"), "each entry must lead with its sign alone");
  assert(!story.body.includes("8 Aug 2026"), "the repeated date must not print twelve times");

  const fallbackStory = buildRashifalStory([], "editorial");
  assert(
    fallbackStory !== null && fallbackStory.body.includes("मीन:"),
    "an empty feed must use the fallback horoscope set",
  );

  // Justifying a narrow horoscope column stretches the word gaps until the type
  // pulls apart, so the box opts out of justification explicitly.
  assert(story.raggedRight === true, "the horoscope box must be set ragged right, not justified");
}

// ── Full live readings and metadata must survive into the grid ───────────────
{
  // The Cliff horoscope feed sends compact per-sign predictions plus footer
  // metadata. Keep the full prediction here; the grid renderer owns visual
  // fitting and places lucky details in a separate footer band.
  const long =
    "धन से जुड़े काम सोच-समझकर करें और अनावश्यक खर्च से बचें। परिवार और रिश्तों में बातचीत शांत रखें, सहयोग मिलेगा। कामकाज में धैर्य और योजना से आगे बढ़ना लाभ देगा। सकारात्मक सोच बनाए रखें।";
  const signs = ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"];
  const story = buildRashifalStory(
    signs.map((sign, i) => ({
      id: i + 1,
      title: `${sign} राशिफल 8 Aug 2026`,
      summary: long,
      luckyNumber: i + 1,
      luckyColor: "पीला",
      compatibility: "सिंह",
    })),
    "editorial",
  )!;

  for (const sign of signs) {
    assert(story.body.includes(`${sign}:`), `${sign} must appear in the horoscope box`);
  }

  assert(story.body.includes(long), "the full live prediction must not be word-limited");
  assert(
    story.body.includes("[[meta:शुभ अंक=1;शुभ रंग=पीला;राशि अनुकूलता=सिंह]]"),
    "the footer metadata must be carried with each sign for grid rendering",
  );
}

// ── The dated title must not print twice per cell ────────────────────────────
{
  // The feed's summary repeats its own title before the reading begins, so a
  // cell printed "मीन: मीन राशिफल 8 Aug 2026: धन से…" — the sign and the date
  // twice over, in a box that has no room to waste.
  const story = buildRashifalStory(
    [
      {
        id: 1,
        title: "मीन राशिफल 8 Aug 2026",
        summary: "मीन राशिफल 8 Aug 2026: धन से जुड़े काम सोच-समझकर करें।",
      },
    ],
    "editorial",
  )!;

  assert(story.body.includes("मीन: धन से"), `the reading must follow the sign directly, got "${story.body}"`);
  assert(!story.body.includes("8 Aug 2026"), "the date must not print inside the reading");
  assert(
    story.body.split("मीन:").length - 1 === 1,
    `the sign must appear once per cell, got "${story.body}"`,
  );
}

console.log("editorialNewswire tests passed");
