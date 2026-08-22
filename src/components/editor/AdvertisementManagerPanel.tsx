"use client";

import { AlertTriangle, BadgeDollarSign, FilePlus2, Search, SquarePlus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import {
  filterAdvertisements,
  getAdvertisementDashboard,
  getAdvertisementManagerStatus,
  getAdvertisementWarnings,
  getPageAdvertisementOccupancy,
} from "@/engines/AdvertisementManager/AdvertisementManagerEngine";
import type { AdvertisementBookingInput, AdvertisementFilter } from "@/engines/AdvertisementManager/AdvertisementManagerTypes";
import type {
  NewspaperAdvertisementId,
  NewspaperAdvertisementStatus,
  NewspaperAssetId,
  NewspaperDocument,
} from "@/types/document";

type AdvertisementManagerPanelProps = {
  document: NewspaperDocument;
  activePageId: string;
  onCreateAdvertisement: (input: AdvertisementBookingInput) => void;
  onUpdateStatus: (adId: NewspaperAdvertisementId, status: NewspaperAdvertisementStatus) => void;
  onCreateAdFrame: (adId?: NewspaperAdvertisementId | null) => void;
  onAutoPlace: () => void;
  onPlaceInSelectedFrame: (adId: NewspaperAdvertisementId) => void;
  onReplaceArtwork: (adId: NewspaperAdvertisementId, assetId: NewspaperAssetId | null) => void;
};

const lifecycle: NewspaperAdvertisementStatus[] = [
  "booked",
  "reserved",
  "artwork-received",
  "approved",
  "placed",
  "printed",
  "archived",
  "cancelled",
  "expired",
];

export const AdvertisementManagerPanel = memo(function AdvertisementManagerPanel({
  document,
  activePageId,
  onCreateAdvertisement,
  onUpdateStatus,
  onCreateAdFrame,
  onAutoPlace,
  onPlaceInSelectedFrame,
  onReplaceArtwork,
}: AdvertisementManagerPanelProps) {
  const [selectedAdId, setSelectedAdId] = useState<NewspaperAdvertisementId | null>(null);
  const [filter, setFilter] = useState<AdvertisementFilter>({
    query: "",
    status: "all",
    section: "all",
  });
  const status = useMemo(() => getAdvertisementManagerStatus(document), [document]);
  const dashboard = useMemo(() => getAdvertisementDashboard(document), [document]);
  const warnings = useMemo(() => getAdvertisementWarnings(document), [document]);
  const warningsByAd = useMemo(() => {
    const map = new Map<NewspaperAdvertisementId, typeof warnings>();

    warnings.forEach((warning) => {
      map.set(warning.adId, [...(map.get(warning.adId) ?? []), warning]);
    });

    return map;
  }, [warnings]);
  const advertisements = useMemo(() => filterAdvertisements(document, filter), [document, filter]);
  const selectedAd = selectedAdId ? document.advertisements?.[selectedAdId] ?? null : null;
  const activeOccupancy = useMemo(() => getPageAdvertisementOccupancy(document, activePageId), [activePageId, document]);
  const sections = useMemo(
    () => [...new Set(Object.values(document.advertisements ?? {}).map((ad) => ad.section).filter(Boolean))],
    [document.advertisements],
  );
  const artworkAssets = useMemo(
    () => Object.values(document.assets).filter((asset) => asset.type === "image" || asset.type === "advertisement" || asset.type === "pdf"),
    [document.assets],
  );

  const createQuickBooking = () => {
    onCreateAdvertisement({
      client: `Client ${Object.keys(document.advertisements ?? {}).length + 1}`,
      brand: "Display Ad",
      section: "City",
      pagePreference: "any",
      width: 180,
      height: 120,
      columns: 2,
      depth: 120,
      colorMode: "cmyk",
      priority: "normal",
    });
  };

  return (
    <aside className="advertisement-manager" aria-label="Advertisement Manager">
      <header className="advertisement-manager-header">
        <span>Advertisements</span>
        <strong>Booking & Placement</strong>
        <small>Reserved / Placed / Pending / Expired</small>
      </header>

      <section className="advertisement-manager-status">
        <span>Total {status.total}</span>
        <span>Reserved {status.reserved}</span>
        <span>Placed {status.placed}</span>
        <span>Pending {status.pending}</span>
        <span>Expired {status.expired}</span>
        <span>Unplaced {status.unplaced}</span>
      </section>

      <section className="advertisement-dashboard">
        <span>Revenue</span><strong>{dashboard.revenuePlaceholder}</strong>
        <span>Occupied</span><strong>{dashboard.occupiedSpace.toFixed(1)}%</strong>
        <span>Booked</span><strong>{dashboard.booked}</strong>
        <span>Printed</span><strong>{dashboard.printed}</strong>
        <span>Cancelled</span><strong>{dashboard.cancelled}</strong>
      </section>

      <section className="advertisement-manager-tools">
        <button type="button" onClick={createQuickBooking}><FilePlus2 size={13} /> Book</button>
        <button type="button" onClick={() => onCreateAdFrame(selectedAdId)}><SquarePlus size={13} /> Frame</button>
        <button type="button" onClick={onAutoPlace}>Auto Place</button>
        <button type="button" disabled={!selectedAd} onClick={() => selectedAd && onPlaceInSelectedFrame(selectedAd.id)}>
          Place
        </button>
      </section>

      <section className="advertisement-manager-filters">
        <label className="advertisement-manager-search">
          <Search size={13} />
          <input
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search ads"
          />
        </label>
        <div className="advertisement-filter-grid">
          <select
            value={filter.status}
            onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value as AdvertisementFilter["status"] }))}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            {lifecycle.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={filter.section}
            onChange={(event) => setFilter((current) => ({ ...current, section: event.target.value }))}
          >
            <option value="all">All Sections</option>
            {sections.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
        </div>
      </section>

      <section className="advertisement-list">
        {advertisements.map((advertisement) => {
          const active = advertisement.id === selectedAdId;
          const adWarnings = warningsByAd.get(advertisement.id) ?? [];

          return (
            <button
              type="button"
              key={advertisement.id}
              className={active ? "active" : ""}
              onClick={() => setSelectedAdId(advertisement.id)}
              onDoubleClick={() => onPlaceInSelectedFrame(advertisement.id)}
            >
              <span>
                <BadgeDollarSign size={14} />
                <strong>{advertisement.client}</strong>
                {adWarnings.length > 0 ? <AlertTriangle size={12} /> : null}
              </span>
              <small>{advertisement.bookingId} / {advertisement.status}</small>
              <em>{advertisement.columns} col x {advertisement.depth} / {advertisement.colorMode.toUpperCase()}</em>
            </button>
          );
        })}
      </section>

      <section className="advertisement-detail">
        <div className="frame-manager-panel-title">Preview</div>
        {selectedAd ? (
          <>
            <div className="advertisement-detail-grid">
              <span>Client</span><strong>{selectedAd.client}</strong>
              <span>Booking</span><strong>{selectedAd.bookingId}</strong>
              <span>Brand</span><strong>{selectedAd.brand || "-"}</strong>
              <span>Dimensions</span><strong>{selectedAd.width} x {selectedAd.height}</strong>
              <span>Publication</span><strong>{selectedAd.edition}</strong>
              <span>Placement</span><strong>{selectedAd.linkedFrameId ?? "Unplaced"}</strong>
            </div>
            <select value={selectedAd.status} onChange={(event) => onUpdateStatus(selectedAd.id, event.target.value as NewspaperAdvertisementStatus)}>
              {lifecycle.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select
              value={selectedAd.artworkAssetId ?? ""}
              onChange={(event) => onReplaceArtwork(selectedAd.id, event.target.value || null)}
            >
              <option value="">No Artwork</option>
              {artworkAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            {(warningsByAd.get(selectedAd.id) ?? []).map((warning) => (
              <em key={`${warning.adId}-${warning.type}`}>{warning.message}</em>
            ))}
          </>
        ) : (
          <p className="asset-empty">Select or book an advertisement.</p>
        )}
      </section>

      {activeOccupancy ? (
        <section className="advertisement-occupancy">
          <div className="frame-manager-panel-title">Page Occupancy</div>
          <span>Editorial</span><strong>{activeOccupancy.editorialPercent.toFixed(1)}%</strong>
          <span>Advertisement</span><strong>{activeOccupancy.advertisementPercent.toFixed(1)}%</strong>
          <span>Reserved</span><strong>{activeOccupancy.reservedPercent.toFixed(1)}%</strong>
          <span>Free</span><strong>{activeOccupancy.freePercent.toFixed(1)}%</strong>
          <span>Columns</span><strong>{activeOccupancy.occupiedColumns} used / {activeOccupancy.remainingColumns} free</strong>
        </section>
      ) : null}
    </aside>
  );
});
