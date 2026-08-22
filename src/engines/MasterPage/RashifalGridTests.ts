import {
  RASHIFAL_FRAME_INSET,
  RASHIFAL_SIGNS,
  RASHIFAL_TITLE_HEIGHT,
  getRashifalGrid,
  parseRashifalReadings,
  toRashifalReadings,
} from "./RashifalGridGeometry";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

// ── Reading extraction ───────────────────────────────────────────────────────
{
  // The live feed returns the signs shuffled — मीन comes back first — and each
  // summary repeats its own dated title before the reading begins.
  const records = [...RASHIFAL_SIGNS]
    .reverse()
    .map((sign, i) => ({
      title: `${sign.hindi} राशिफल 8 Aug 2026`,
      summary: `${sign.hindi} राशिफल 8 Aug 2026: reading number ${i}।`,
    }));

  const readings = toRashifalReadings(records);

  assert(readings.length === 12, `all twelve signs must be read, got ${readings.length}`);
  // Conventional order, regardless of how the feed arrived.
  assert(readings[0].sign === "मेष", `the grid must start at मेष, got ${readings[0].sign}`);
  assert(readings[11].sign === "मीन", `the grid must end at मीन, got ${readings[11].sign}`);
  assert(readings[0].glyph === "♈", "each sign must carry its zodiac glyph");
  assert(
    readings.every((r) => !r.text.includes("8 Aug 2026")),
    "the repeated dated title must be stripped from every reading",
  );
  assert(
    readings.every((r) => !r.text.startsWith(r.sign)),
    "a reading must not repeat its own sign — the cell header already prints it",
  );

  // A feed missing signs yields only what it has, rather than blank cells.
  assert(
    toRashifalReadings([{ title: "मेष राशिफल", summary: "only one" }]).length === 1,
    "a partial feed must produce only the cells it can fill",
  );
  assert(
    toRashifalReadings([{ title: "not a sign", summary: "x" }]).length === 0,
    "a record whose title names no sign must be ignored",
  );
}

// ── Grid geometry ────────────────────────────────────────────────────────────
{
  const BOX = { x: 100, y: 200, width: 240, height: 420 };
  const readings = RASHIFAL_SIGNS.map((s) => ({ sign: s.hindi, glyph: s.glyph, text: "reading" }));
  const grid = getRashifalGrid({ ...BOX, readings });

  assert(grid.cells.length === 12, `the grid must have twelve cells, got ${grid.cells.length}`);
  assert(grid.title.text === "आज का राशिफल", "the block must carry its title");
  assert(
    Math.abs(grid.title.y - (BOX.y + RASHIFAL_FRAME_INSET)) < 0.001 &&
      Math.abs(grid.title.width - (BOX.width - RASHIFAL_FRAME_INSET * 2)) < 0.001,
    "the title bar must sit across the top of the box",
  );

  // Colour runs down the column, so vertically adjacent cells differ — six
  // banded stripes across the rows would read as a table, not a list.
  const column = grid.cells.filter((_, i) => i % 2 === 0);
  for (let i = 1; i < column.length; i += 1) {
    assert(
      column[i].headerFill !== column[i - 1].headerFill,
      "cells down a column must not repeat the same header colour back to back",
    );
  }

  // Two columns of six, filling the box exactly.
  const left = grid.cells.filter((c) => Math.abs(c.x - (BOX.x + RASHIFAL_FRAME_INSET)) < 0.001);
  assert(left.length === 6, `the left column must hold six cells, got ${left.length}`);

  const right = Math.max(...grid.cells.map((c) => c.x + c.width));
  assert(
    Math.abs(right - (BOX.x + BOX.width - RASHIFAL_FRAME_INSET)) < 0.001,
    "the grid must fill its width up to the frame",
  );
  const bottom = Math.max(...grid.cells.map((c) => c.y + c.height));
  assert(
    Math.abs(bottom - (BOX.y + BOX.height - RASHIFAL_FRAME_INSET)) < 0.001,
    "the grid must fill its height up to the frame",
  );
  assert(
    Math.min(...grid.cells.map((c) => c.y)) >= BOX.y + RASHIFAL_TITLE_HEIGHT - 0.001,
    "no cell may overlap the title bar",
  );

  // Cells must not overlap each other.
  for (let a = 0; a < grid.cells.length; a += 1) {
    for (let b = a + 1; b < grid.cells.length; b += 1) {
      const p = grid.cells[a];
      const q = grid.cells[b];
      const overlaps =
        Math.max(p.x, q.x) < Math.min(p.x + p.width, q.x + q.width) - 0.001 &&
        Math.max(p.y, q.y) < Math.min(p.y + p.height, q.y + q.height) - 0.001;
      assert(!overlaps, `cells ${p.sign} and ${q.sign} must not overlap`);
    }
  }

  // The reading sits below the tinted header, inside the padding.
  for (const cell of grid.cells) {
    assert(
      cell.textY >= cell.y + cell.headerHeight,
      `${cell.sign}: the reading must start below its header bar`,
    );
    assert(
      cell.textX >= cell.x && cell.textX + cell.textWidth <= cell.x + cell.width + 0.001,
      `${cell.sign}: the reading must stay inside its cell`,
    );
    assert(cell.textHeight > 0, `${cell.sign}: the cell must leave room for its reading`);
    assert(Boolean(cell.headerFill), `${cell.sign}: every cell header must be tinted`);
    // The body wash must stay near-white: twelve saturated cells would turn the
    // page into a patchwork and fight the type sitting on them.
    assert(
      cell.bodyFill !== cell.headerFill,
      `${cell.sign}: the body wash must be lighter than its header`,
    );
    const channels = [1, 3, 5].map((i) => parseInt(cell.bodyFill.slice(i, i + 2), 16));
    assert(
      channels.every((c) => c > 225),
      `${cell.sign}: the body wash must stay near-white, got ${cell.bodyFill}`,
    );
    // The glyph badge must sit inside its header bar.
    assert(
      cell.glyphCenterY - cell.glyphRadius >= cell.y - 0.001 &&
        cell.glyphCenterY + cell.glyphRadius <= cell.y + cell.headerHeight + 0.001,
      `${cell.sign}: the glyph badge must sit within the header bar`,
    );
    assert(cell.glyphRadius > 0, `${cell.sign}: the glyph badge must have a radius`);
  }

  // ── The devotional frame ───────────────────────────────────────────────
  // Content must sit inside the frame, or the rules cut across a cell.
  assert(grid.frame.ornaments.length === 4, "the frame must carry a medallion at each corner");
  assert(
    grid.frame.ornaments.every((o) => o.innerRadius > 0 && o.innerRadius < o.radius),
    "a corner medallion must have a smaller diamond inset inside it",
  );

  // Devotional motifs: scalloped arcs along the rules, a lotus at each corner,
  // and the kalash at the head of the block.
  const shapes = grid.frame.shapes;
  assert(shapes.length > 40, `the frame must carry its motifs, got ${shapes.length} shapes`);

  const arcs = shapes.filter((s) => s.kind === "arc");
  assert(arcs.length >= 12, `the rules must be scalloped, got ${arcs.length} arcs`);

  // Eight petals plus a seed at each of the four corners.
  const petalsPerLotus = 8;
  for (const corner of grid.frame.ornaments) {
    const near = shapes.filter(
      (s) =>
        s.kind !== "arc" &&
        Math.hypot(s.cx - corner.x, s.cy - corner.y) < 12,
    );
    assert(
      near.length >= petalsPerLotus,
      `a lotus must sit at each corner — found ${near.length} shapes near one`,
    );
  }

  // The kalash is centred on the top rule, not floating off-centre.
  const topCentreX = (grid.frame.ornaments[0].x + grid.frame.ornaments[1].x) / 2;
  const kalashParts = shapes.filter(
    (s) => s.kind !== "arc" && Math.abs(s.cx - topCentreX) < 8 && s.cy < grid.title.y,
  );
  assert(kalashParts.length >= 4, `the kalash must crown the block, found ${kalashParts.length} parts`);

  // Every motif must stay within the box — ornament must not bleed onto a
  // neighbouring story.
  for (const shape of shapes) {
    const reach = shape.kind === "ellipse" ? Math.max(shape.rx, shape.ry) : shape.radius;
    assert(
      shape.cx - reach >= BOX.x - 2 &&
        shape.cx + reach <= BOX.x + BOX.width + 2 &&
        // The kalash crowns the block and rides a little above the top rule;
        // everything else stays within the box.
        shape.cy - reach >= BOX.y - 24 &&
        shape.cy + reach <= BOX.y + BOX.height + 2,
      "every motif must stay inside the box",
    );
  }

  // ── The devotional frame ───────────────────────────────────────────────
  // Content must sit inside the frame, or the rules cut across a cell.
  assert(grid.frame.ornaments.length === 4, "the frame must carry a medallion at each corner");
  assert(
    grid.frame.ornaments.every((o) => o.innerRadius > 0 && o.innerRadius < o.radius),
    "a corner medallion must have a smaller diamond inset inside it",
  );

  assert(
    grid.frame.outer.strokeWidth > grid.frame.inner.strokeWidth,
    "the outer rule must be the heavier of the two",
  );
  assert(
    grid.frame.inner.x > grid.frame.outer.x && grid.frame.inner.y > grid.frame.outer.y,
    "the hairline must sit inside the heavy rule, set off by a gap",
  );
  assert(
    grid.title.x > grid.frame.inner.x && grid.title.y > grid.frame.inner.y,
    "the title must sit inside the frame",
  );
  for (const cell of grid.cells) {
    assert(
      cell.x >= grid.frame.inner.x &&
        cell.y >= grid.frame.inner.y &&
        cell.x + cell.width <= grid.frame.inner.x + grid.frame.inner.width + 0.001 &&
        cell.y + cell.height <= grid.frame.inner.y + grid.frame.inner.height + 0.001,
      `${cell.sign}: every cell must sit inside the frame`,
    );
  }
  // The frame stays within the box it was given.
  assert(
    grid.frame.outer.x >= BOX.x &&
      grid.frame.outer.x + grid.frame.outer.width <= BOX.x + BOX.width + 0.001,
    "the frame must stay inside the box",
  );

  // A feed short of twelve still fills its box rather than leaving a gap.
  const partial = getRashifalGrid({ ...BOX, readings: readings.slice(0, 8) });
  assert(partial.cells.length === 8, "a partial grid must place only the cells it has");
  assert(
    Math.abs(
      Math.max(...partial.cells.map((c) => c.y + c.height)) -
        (BOX.y + BOX.height - RASHIFAL_FRAME_INSET),
    ) < 0.001,
    "a partial grid must still fill the box height",
  );
}

// ── Recognising the block from its own content ───────────────────────────────
{
  const body = RASHIFAL_SIGNS.map((s) => `${s.hindi}: reading for ${s.hindi}।`).join(" ");
  const readings = parseRashifalReadings("आज का राशिफल", body)!;

  assert(Boolean(readings), "a horoscope story must be recognised");
  assert(readings.length === 12, `all twelve readings must be recovered, got ${readings.length}`);
  assert(readings[0].sign === "मेष" && readings[11].sign === "मीन", "readings must come back in order");
  assert(
    readings[3].text === "reading for कर्क।",
    `each reading must be cut at the next sign, got "${readings[3].text}"`,
  );
  assert(
    readings.every((r) => !r.text.includes(":")),
    "a reading must not swallow the following sign's marker",
  );

  // Everything else on the page must fall through to the article renderer.
  assert(
    parseRashifalReadings("प्रधानमंत्री मोदी के संबोधन", body) === null,
    "a story that is not headlined राशिफल must not be treated as one",
  );
  assert(
    parseRashifalReadings("आज का राशिफल", "मेष: only one sign here।") === null,
    "a couple of stray matches must not be mistaken for a horoscope",
  );
  assert(parseRashifalReadings("आज का राशिफल", "") === null, "an empty body yields no grid");

  // A partial feed still draws, so a short day is not a blank box.
  const partial = RASHIFAL_SIGNS.slice(0, 7)
    .map((s) => `${s.hindi}: reading।`)
    .join(" ");
  assert(parseRashifalReadings("आज का राशिफल", partial)?.length === 7, "a partial feed must still draw");
}

console.log("RashifalGrid tests passed");
