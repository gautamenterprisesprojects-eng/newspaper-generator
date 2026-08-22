import { EDITORIAL_RAIL } from "./EditorialPageStyle";
import {
  AUTHOR_RAIL_GUTTER,
  getAuthorBlock,
  getAuthorRailReservation,
  resolveAuthorBlock,
} from "./AuthorBlockGeometry";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

// A five-column signed comment, the विचार मंथन box on page 8.
{
  const BOX = { x: 100, y: 200, width: 620, height: 430 };
  const block = getAuthorBlock({ ...BOX, topOffset: 60, columnSpan: 5, hasSummary: true });

  // The stack runs label → portrait → name plate → ❝ → summary → ❞, top to
  // bottom, no overlaps — the order page 8 sets it in.
  assert(block.portrait.y >= block.label.y + block.label.height, "the portrait must sit under the label");
  assert(
    block.namePlate.y >= block.portrait.y + block.portrait.height,
    "the name plate must sit under the portrait",
  );
  assert(
    block.openQuote.y >= block.namePlate.y + block.namePlate.height,
    "the opening quote must sit under the name plate",
  );
  assert(block.summary.y >= block.openQuote.y, "the summary must sit under the opening quote");
  assert(
    block.closeQuote.y >= block.summary.y + block.summary.height,
    "the closing quote must sit under the summary",
  );

  // Everything stays inside the box. `frameKind` is a name, not a rectangle.
  for (const [label, rect] of Object.entries(block)) {
    if (typeof rect !== "object") continue;
    assert(
      rect.x >= BOX.x - 0.001 && rect.x + rect.width <= BOX.x + BOX.width + 0.001,
      `${label} must stay within the box horizontally`,
    );
    assert(
      rect.y >= BOX.y - 0.001 && rect.y + rect.height <= BOX.y + BOX.height + 0.001,
      `${label} must stay within the box vertically`,
    );
  }

  // The block starts below the headline the composer has already set.
  assert(block.portrait.y >= BOX.y + 60 - 0.001, "the block must start below the headline block");

  // The rail is a rail, not half the page.
  assert(block.portrait.width < BOX.width * 0.3, "the rail must stay narrow in a wide box");

  // The reserved region covers the whole stack plus the gutter, so the body
  // divides around it rather than running underneath.
  assert(
    block.reserved.width >= block.portrait.width + AUTHOR_RAIL_GUTTER,
    "the reserved region must include the gutter beside the rail",
  );
  assert(
    block.reserved.y + block.reserved.height >= block.summary.y + block.summary.height - 0.001,
    "the reserved region must cover the whole stack",
  );
}

// The one-column leader rail — सम्पादकीय. The portrait has to work at a much
// narrower measure, where a fixed rail width would overflow the box.
{
  const NARROW = { x: 40, y: 100, width: 120, height: 500 };
  const block = getAuthorBlock({ ...NARROW, topOffset: 40, columnSpan: 1, hasSummary: false });

  assert(
    block.portrait.x + block.portrait.width <= NARROW.x + NARROW.width + 0.001,
    "the portrait must fit a one-column rail",
  );
  assert(block.portrait.width > 40, "the portrait must still be large enough to read as one");
  assert(block.summary.height === 0, "a box with no summary must reserve no space for one");
  assert(
    block.reserved.y + block.reserved.height <= NARROW.y + NARROW.height + 0.001,
    "the reserved region must stay inside a narrow box",
  );
}

// The rail must stop above anything nested into the box, not run on behind it.
{
  const BOX = { x: 0, y: 100, width: 600, height: 800, columnSpan: 4 };
  const NESTED_TOP = 520;
  const resolved = resolveAuthorBlock({
    story: {
      ...BOX,
      storyNumber: 2,
      compositionSettings: {
        editorialPageStyle: { suppressByline: true },
        reservedRegions: [
          // The rail's own reservation, starting at the box top.
          { x: 0, y: 100, width: 150, height: 800 },
          // The feature and the horoscope, nested into the lower half.
          { x: 150, y: NESTED_TOP, width: 300, height: 380 },
          { x: 450, y: NESTED_TOP, width: 150, height: 380 },
        ],
      },
      articleData: { editorName: "राजीव त्रिपाठी", editorSummary: "एक लंबी टिप्पणी।" },
    },
    headlineBottom: 60,
  });

  assert(resolved !== null, "the signed comment must resolve a block");
  assert(
    resolved!.contentBottom <= NESTED_TOP,
    `the rail must stop at the nested band, got ${resolved!.contentBottom}`,
  );

  const block = getAuthorBlock(resolved!);
  assert(
    block.closeQuote.y + block.closeQuote.height <= NESTED_TOP + 0.001,
    "the whole rail stack must sit above the nested boxes",
  );
}

// The leader's rail must leave NO gap between its name plate and the copy.
//
// The rail is reserved before the headline is composed, so the reservation
// allows a fixed depth for it. Hanging the stack from the headline meant every
// point of surplus printed as white space under the plate — and with no summary
// in this rail the plate is the last thing in it, so the hole was conspicuous.
// Pinning the stack to the foot of the reserved band moves the surplus above
// the portrait, under the headline, where it reads as ordinary spacing.
{
  const BOX = { x: 0, y: 100, width: 175, height: 1120, columnSpan: 1 };
  const regions = getAuthorRailReservation({ ...BOX, storyNumber: 1 })!;

  assert(regions !== null, "the leader must reserve a band for its rail");
  assert(regions.length === 2, "the leader reserves a full-width header band and a narrow picture band");

  // The header band spans the measure; the picture band leaves room beside it
  // for the copy to set in.
  assert(regions[0].width === BOX.width, "the label band must span the measure");
  assert(
    regions[1].width < BOX.width * 0.55,
    `the picture band must leave copy beside it, got ${regions[1].width} of ${BOX.width}`,
  );

  const reservation = { y: regions[0].y, height: regions[0].height + regions[1].height };

  // Within the headline allowance the plate lands flush with the band's foot.
  // The measured headline on the generated page is about 57pt, and the band
  // clears headlines up to 62, so these sit inside it.
  for (const headlineBottom of [30, 45, 60]) {
    const block = getAuthorBlock({
      ...BOX,
      topOffset: headlineBottom + 6,
      hasSummary: false,
      contentBottom: BOX.y + BOX.height,
    });
    const reservationBottom = reservation.y + reservation.height;
    const plateBottom = block.namePlate.y + block.namePlate.height;

    // The plate stops just short of the band's foot: the copy resumes at the
    // foot, so a plate flush with it would have text hard against its edge.
    const clearance = reservationBottom - plateBottom;
    assert(
      Math.abs(clearance - EDITORIAL_RAIL.plateClearance) < 0.001,
      `the plate must clear the copy below it by ${EDITORIAL_RAIL.plateClearance}pt (headline ${headlineBottom}: got ${clearance})`,
    );
    assert(
      block.label.y >= BOX.y + headlineBottom,
      "the label must never print above the composed headline",
    );
    assert(block.summary.height === 0, "the leader's rail carries no summary");
  }

  // Beyond it — a headline deeper than the band allows for — the stack stays
  // under the headline rather than printing across it, and overruns the band by
  // exactly the excess. Degrading this way round is deliberate: a rail sliding
  // a few points into the copy is far less damaging than a portrait printed
  // over the headline.
  {
    const deep = getAuthorBlock({
      ...BOX,
      topOffset: 120 + 6,
      hasSummary: false,
      contentBottom: BOX.y + BOX.height,
    });

    assert(deep.label.y >= BOX.y + 120, "a deep headline must still not be printed across");
    assert(
      deep.namePlate.y + deep.namePlate.height <= BOX.y + BOX.height,
      "the stack must stay inside the box even when the headline overruns the band",
    );
  }
}

// The comment's rail centres its headshot in its column; the leader's is pinned
// left so its copy can wrap around the picture's right shoulder.
{
  const COMMENT = { x: 0, y: 0, width: 720, height: 600, columnSpan: 4 };
  const comment = getAuthorBlock({ ...COMMENT, topOffset: 90, hasSummary: true });
  const railWidth = COMMENT.width / COMMENT.columnSpan;
  const leftGap = comment.portrait.x - COMMENT.x;
  const rightGap = COMMENT.x + railWidth - (comment.portrait.x + comment.portrait.width);

  assert(
    Math.abs(leftGap - rightGap) < 12,
    `the comment's headshot must sit centred in its rail (left ${leftGap}, right ${rightGap})`,
  );
  assert(
    Math.abs(comment.namePlate.x - comment.portrait.x) < 0.001,
    "the name plate must sit directly under the picture it labels",
  );

  const LEADER = { x: 0, y: 0, width: 175, height: 1120, columnSpan: 1 };
  const leader = getAuthorBlock({ ...LEADER, topOffset: 60, hasSummary: false });
  assert(
    leader.portrait.x - LEADER.x < 8,
    "the leader's headshot must stay hard against the left of its column",
  );
}

// A shallow box must not let the summary run past the foot.
{
  const SHALLOW = { x: 0, y: 0, width: 400, height: 150 };
  const block = getAuthorBlock({ ...SHALLOW, topOffset: 30, columnSpan: 3, hasSummary: true });

  assert(
    block.summary.y + block.summary.height <= SHALLOW.y + SHALLOW.height + 0.001,
    "the summary must be clipped to the box, not overflow it",
  );
}

// The writer's rail is editorial-only furniture, and within the editorial page
// it belongs to page 8's two signed pieces only.
//
// Two ways this has gone wrong. `editorName` is filled by the store on every
// story from the wizard's byline, on every page kind, so a resolver keyed off
// the name drew a rail over all eight boxes of a front page — on top of the
// copy, because only editorial pages reserve room for it. And keyed off the
// page alone it drew a rail on all six editorial boxes, where the printed page
// has two. The gate is therefore `editorialPageStyle` AND the slot number.
{
  const BOX = { x: 0, y: 0, width: 600, height: 400, columnSpan: 3 };
  const articleData = { editorName: "राजीव त्रिपाठी", editorPortraitUrl: "", editorSummary: "" };
  const editorial = { editorialPageStyle: { suppressByline: true } };

  assert(
    resolveAuthorBlock({
      story: { ...BOX, storyNumber: 2, compositionSettings: {}, articleData },
      headlineBottom: 50,
    }) === null,
    "a front/inside page story must never resolve an author block",
  );

  assert(
    resolveAuthorBlock({
      story: { ...BOX, storyNumber: 2, compositionSettings: editorial, articleData },
      headlineBottom: 50,
    }) !== null,
    "the signed comment must resolve an author block",
  );

  assert(
    resolveAuthorBlock({
      story: { ...BOX, storyNumber: 1, compositionSettings: editorial, articleData },
      headlineBottom: 50,
    }) !== null,
    "the सम्पादकीय leader must resolve an author block",
  );

  // The feature, the horoscope, the health package, the voices column and the
  // letters column: photographs, yes; author rails, no.
  for (const storyNumber of [3, 4, 5, 6, 7]) {
    assert(
      resolveAuthorBlock({
        story: { ...BOX, storyNumber, compositionSettings: editorial, articleData },
        headlineBottom: 50,
      }) === null,
      `editorial slot ${storyNumber} must not carry an author rail`,
    );
  }
}

console.log("AuthorBlock tests passed");
