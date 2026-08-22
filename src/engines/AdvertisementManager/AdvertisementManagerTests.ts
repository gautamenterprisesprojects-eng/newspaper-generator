import assert from "node:assert/strict";
import { createDocument } from "@/engines/DocumentEngine/DocumentEngine";
import {
  addAdvertisement,
  autoPlaceAdvertisements,
  createAdvertisementFrame,
  getAdvertisementDashboard,
  getAdvertisementManagerStatus,
  getAdvertisementPlacements,
  getAdvertisementWarnings,
  getPageAdvertisementOccupancy,
  replaceAdvertisementArtwork,
  updateAdvertisementStatus,
} from "./AdvertisementManagerEngine";

let document = createDocument();
document = addAdvertisement(document, {
  id: "ad-1",
  bookingId: "BK-100",
  client: "Raj Motors",
  brand: "Raj Motors",
  section: "City",
  pagePreference: 1,
  width: 180,
  height: 120,
  columns: 2,
  depth: 120,
});

assert.equal(Object.keys(document.advertisements).length, 1);
assert.equal(getAdvertisementManagerStatus(document).pending, 1);
assert.ok(getAdvertisementWarnings(document).some((warning) => warning.type === "missing-artwork"));

document = createAdvertisementFrame({
  document,
  pageId: document.pages[0].id,
  bounds: { x: 72, y: 720, width: 200, height: 140 },
});
document = updateAdvertisementStatus(document, "ad-1", "reserved");
document = autoPlaceAdvertisements(document);

assert.equal(getAdvertisementPlacements(document).length, 1);
assert.equal(document.advertisements["ad-1"].status, "placed");
assert.equal(document.frames[document.advertisements["ad-1"].linkedFrameId ?? ""].frameType, "advertisement");

document = replaceAdvertisementArtwork(document, "ad-1", "asset-artwork");
assert.equal(document.advertisements["ad-1"].artworkAssetId, "asset-artwork");

const occupancy = getPageAdvertisementOccupancy(document, document.pages[0].id);
assert.ok(occupancy);
assert.ok(occupancy.advertisementPercent > 0);

const dashboard = getAdvertisementDashboard(document);
assert.equal(dashboard.total, 1);
assert.equal(dashboard.booked, 0);

console.log("AdvertisementManagerTests passed");
