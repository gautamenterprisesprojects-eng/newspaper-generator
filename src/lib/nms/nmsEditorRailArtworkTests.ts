import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { editorialAuthorsFromNmsPayload } from "./nmsBundleEditorialAuthors";
import type { NmsBundlePayload } from "./nmsBundleTypes";
import {
  EDITOR_RAIL_FRONT_ARTWORK_SIZE,
  getEditorRailFrontContainDest,
  resolveEditorRailFrontContent,
  substituteEditorRailFrontSvg,
} from "../../engines/MasterPage/EditorRailFrontGeometry";

const fromRail = editorialAuthorsFromNmsPayload({
  editorRail: {
    name: "अमित शर्मा",
    imageUrl: "https://example.com/editor.jpg",
    place: "भोपाल",
    designation: "संपादक",
  },
} as NmsBundlePayload);

assert.equal(fromRail.length, 1);
assert.equal(fromRail[0]?.name, "अमित शर्मा");
assert.equal(fromRail[0]?.imageUrl, "https://example.com/editor.jpg");
assert.equal(fromRail[0]?.location, "भोपाल");
assert.equal(fromRail[0]?.designation, "संपादक");

const empty = resolveEditorRailFrontContent({});
// Only the photo stays gated on a real live value -- with none supplied, it
// leaves the artwork's own baked-in default portrait alone rather than
// forcing in some other default image of unknown crop/pose (see
// EDITOR_RAIL_FRONT_DEFAULT_IMAGE_URL vs the artwork's own photo -- they are
// NOT interchangeable, the former has no visible hands/pose).
assert.equal(empty.overlayPhoto, false);
assert.equal(empty.overlayName, true);
// Place/designation always resolve to a real string (live value or
// default), so they must always be substituted in too -- gating on the
// pre-fallback live value here was the actual bug that shipped: the
// computed default was silently never written into the artwork.
assert.equal(empty.overlayPlace, true);
assert.equal(empty.overlayDesignation, true);
assert.equal(empty.name, "राज बड़खाने");
assert.equal(empty.place, "जबलपुर");
assert.equal(empty.designation, "ब्यूरो चीफ");

const live = resolveEditorRailFrontContent({
  name: "अमित शर्मा",
  imageUrl: "https://example.com/editor.jpg",
  place: "भोपाल",
  designation: "संपादक",
});
assert.equal(live.overlayPhoto, true);
assert.equal(live.overlayName, true);
assert.equal(live.overlayPlace, true);
assert.equal(live.overlayDesignation, true);

// Artwork is "sub editor rail.svg" itself (144x360, a 2:5 card) -- box 1's
// row is sized in TemplateRegistry to match this aspect exactly, so a
// same-aspect box contains with (near) zero letterbox.
assert.equal(EDITOR_RAIL_FRONT_ARTWORK_SIZE.width, 144);
assert.equal(EDITOR_RAIL_FRONT_ARTWORK_SIZE.height, 360);

const sameAspectBox = { x: 10, y: 20, width: 144, height: 360 };
const dest = getEditorRailFrontContainDest(sameAspectBox, EDITOR_RAIL_FRONT_ARTWORK_SIZE.width, EDITOR_RAIL_FRONT_ARTWORK_SIZE.height);
assert.equal(dest.width, 144);
assert.equal(dest.height, 360);
assert.equal(dest.x, 10);
assert.equal(dest.y, 20);

// The live substitution actually used by both the Konva preview
// (EditorRailFront.tsx) and the PDF export (drawEditorRailFrontToCanvas):
// targets the artwork's own stable <g id="..."> wrappers, not whatever
// placeholder text the file currently holds.
const rawSvg = fs.readFileSync(path.join(process.cwd(), "public", "sub editor rail.svg"), "utf8");
const substituted = substituteEditorRailFrontSvg(rawSvg, {
  name: live.name,
  place: live.place,
  designation: live.designation,
});
assert.ok(substituted.includes("अमित शर्मा"), "name not substituted into SVG");
assert.ok(substituted.includes("भोपाल"), "place not substituted into SVG");
assert.ok(substituted.includes("संपादक"), "designation not substituted into SVG");
// Substitution is scoped to the three known text groups -- it must not
// touch the rest of the (large, base64-heavy) document.
assert.equal(substituted.length > rawSvg.length - 500 && substituted.length < rawSvg.length + 500, true);

console.log("editor rail artwork overlays: ok");
