import assert from "node:assert/strict";
import { createDocument } from "@/engines/DocumentEngine/DocumentEngine";
import {
  applyStyle,
  clearStyleOverrides,
  createStyle,
  deleteStyle,
  duplicateStyle,
  exportStyles,
  getStyleManagerStatus,
  getStyleOverrideSummary,
  importStyles,
  listStyles,
  markStyleOverride,
  normalizeStyleLibrary,
  renameStyle,
  updateStyle,
} from "./StyleManagerEngine";

let document = createDocument();
let status = getStyleManagerStatus(document);

assert.ok(status.paragraph >= 6);
assert.ok(status.character >= 2);
assert.ok(status.object >= 2);
assert.ok(status.frame >= 2);
assert.ok(status.table >= 1);
assert.ok(status.cell >= 1);

document = createStyle(document, {
  name: "Election Headline",
  kind: "paragraph",
  theme: "hindi",
});

const created = listStyles(document, { query: "Election", kind: "paragraph", theme: "all" })[0];
assert.equal(created.name, "Election Headline");

document = renameStyle(document, created.id, "Election Banner");
assert.equal(normalizeStyleLibrary(document.styles).styles[created.id].name, "Election Banner");

document = updateStyle(document, created.id, {
  settings: {
    fontSize: 32,
    color: "#b42318",
  } as never,
});
assert.equal((normalizeStyleLibrary(document.styles).styles[created.id].settings as { fontSize: number }).fontSize, 32);

document = duplicateStyle(document, created.id);
assert.ok(listStyles(document, { query: "Copy", kind: "paragraph", theme: "all" }).length >= 1);

const applyResult = applyStyle(document, "story-1:headline", created.id);
document = applyResult.document;
assert.deepEqual(applyResult.affectedTargets, ["story-1:headline"]);
assert.equal(normalizeStyleLibrary(document.styles).assignments["story-1:headline"], created.id);

document = markStyleOverride(document, "story-1:headline");
assert.equal(getStyleOverrideSummary(document).overrideCount, 1);

document = clearStyleOverrides(document, "story-1:headline");
assert.equal(getStyleOverrideSummary(document).overrideCount, 0);

const exported = exportStyles(document, "json");
assert.ok(exported.includes("Election Banner"));

const importedDocument = importStyles(createDocument(), exported, "json");
assert.ok(listStyles(importedDocument, { query: "Election Banner", kind: "paragraph", theme: "all" }).length >= 1);

document = deleteStyle(document, created.id);
assert.equal(normalizeStyleLibrary(document.styles).styles[created.id], undefined);

console.log("StyleManagerTests passed");
