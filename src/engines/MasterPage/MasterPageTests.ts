import assert from "node:assert/strict";
import {
  applyMasterToPage,
  createDefaultLayers,
  createDefaultMasterPages,
  createMasterPage,
  deleteMasterPage,
  detachMasterFromPage,
  duplicateMasterPage,
  formatPageNumber,
  getMasterBadgeForPage,
  getResolvedMasterElementsForPage,
  normalizeMasterArchitecture,
  overrideMasterElementOnPage,
  renameMasterPage,
} from "./MasterPageEngine";
import { createDocument } from "@/engines/DocumentEngine/DocumentEngine";

let document = normalizeMasterArchitecture(createDocument());
const page = document.pages[0];

assert.ok(Object.keys(createDefaultLayers()).length >= 8, "Default layer set should include professional DTP layers.");
assert.equal(Object.keys(createDefaultMasterPages()).length, 3, "Default master library should contain A/B/C masters.");
assert.equal(getMasterBadgeForPage(document, page), "A", "Default page should use A master.");
assert.ok(getResolvedMasterElementsForPage(document, page).length > 0, "Master page should resolve running elements.");

document = applyMasterToPage(document, page.id, "master-b");
assert.equal(document.pages[0].masterPageId, "master-b", "Apply master should update page master id.");
assert.equal(getMasterBadgeForPage(document, document.pages[0]), "B", "Page badge should reflect applied master.");

const element = getResolvedMasterElementsForPage(document, document.pages[0])[0];
document = overrideMasterElementOnPage(document, page.id, element.id);
assert.ok(document.pages[0].masterOverrides?.[element.id], "Override should create a local master element copy.");
assert.equal(document.pages[0].masterOverrides?.[element.id].locked, false, "Override copy should become editable.");

document = detachMasterFromPage(document, page.id);
assert.equal(document.pages[0].masterPageId, "none", "Detach should remove inherited master.");

document = createMasterPage(document, "D-Master");
const createdMasterId = Object.keys(document.masters).find((id) => document.masters[id].name === "D-Master");
assert.ok(createdMasterId, "Create master should add a master entry.");

document = renameMasterPage(document, createdMasterId, "D-Master Renamed");
assert.equal(document.masters[createdMasterId].name, "D-Master Renamed", "Rename master should update name.");

document = duplicateMasterPage(document, createdMasterId);
assert.ok(Object.values(document.masters).some((master) => master.name === "D-Master Renamed Copy"));

document = deleteMasterPage(document, createdMasterId);
assert.ok(!document.masters[createdMasterId], "Delete master should remove unused master.");

assert.equal(formatPageNumber({ ...page, numbering: { style: "roman", restartAt: 4, prefix: "A-" } }), "A-IV");
assert.equal(formatPageNumber({ ...page, numbering: { style: "alphabetic", restartAt: 3, prefix: "" } }), "C");

console.log("MasterPageTests passed");
