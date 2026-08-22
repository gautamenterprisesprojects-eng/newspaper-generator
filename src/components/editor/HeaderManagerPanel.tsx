"use client";

import { FileText, Newspaper } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  frontHeaderLayouts,
  insideHeaderLayouts,
  normalizeHeaderSystemState,
  resolveDocumentHeaders,
  resolveHeaderTokens,
  validateHeaderAssets,
  validateHeaderSystemState,
} from "@/engines/HeaderSystem";
import type { AssetImportDescriptor } from "@/engines/AssetManager/AssetManagerTypes";
import type { NewspaperDocument } from "@/types/document";
import type {
  FrontHeaderTemplate,
  HeaderLayoutKind,
  HeaderTextSlot,
  InsideHeaderLayoutKind,
  InsideHeaderTemplate,
  PublicationProfile,
} from "@/types/header";

type HeaderManagerPanelProps = {
  document: NewspaperDocument;
  onApplyDraft: (draft: {
    profileId: string;
    profile: PublicationProfile;
    frontLayout: HeaderLayoutKind;
    insideLayout: InsideHeaderLayoutKind;
  }) => void;
  onSaveAs: (name: string) => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onActivate: (headerSetId: string) => void;
  onSetDefault: () => void;
  onExport: () => string;
  onImport: (payload: string) => void;
  onImportLogo: (
    profileId: string,
    role: "color" | "monochrome",
    descriptor: AssetImportDescriptor,
  ) => void;
  activePageId: string;
  activePageSectionName: string;
  onSetLocked: (locked: boolean) => void;
  onSetHidden: (hidden: boolean) => void;
  onResetLayouts: () => void;
  onSetSectionOverride: (input: {
    sectionName: string;
    displayName?: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
    websiteSlug?: string;
  }) => void;
  onRemoveSectionOverride: (sectionName: string) => void;
  onOverrideCurrentPage: (input: {
    sectionName: string;
    layout?: InsideHeaderLayoutKind;
    accentColor?: string;
  }) => void;
  onReturnCurrentPageToMaster: () => void;
  onUndoHeader: () => void;
  onRedoHeader: () => void;
};

const panelStyle = {
  display: "grid",
  gap: 12,
  padding: 12,
  fontFamily: "Arial, sans-serif",
  color: "#211b16",
} satisfies CSSProperties;

const fieldStyle = {
  display: "grid",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
} satisfies CSSProperties;

const inputStyle = {
  border: "1px solid #d8d0c4",
  borderRadius: 4,
  padding: "7px 8px",
  fontSize: 12,
  fontWeight: 400,
  textTransform: "none",
  color: "#211b16",
  background: "#fffdf8",
} satisfies CSSProperties;

const sectionStyle = {
  border: "1px solid #e2dacd",
  borderRadius: 6,
  padding: 10,
  display: "grid",
  gap: 8,
  background: "#fffdf8",
} satisfies CSSProperties;

const titleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0,
} satisfies CSSProperties;

const createUploadId = () =>
  `header-logo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

const readImageDimensions = (source: string) =>
  new Promise<{ width?: number; height?: number }>((resolve) => {
    if (typeof window === "undefined" || !source.startsWith("data:image/")) {
      resolve({});
      return;
    }

    const image = new Image();

    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = source;
  });

const slotPreviewText = (
  slot: HeaderTextSlot,
  profile: PublicationProfile,
  pageNumber: number,
  totalPages: number,
  sectionName: string,
) =>
  resolveHeaderTokens(slot.template, {
    profile,
    pageNumber,
    totalPages,
    sectionName,
  });

const previewTextStyle = (slot: HeaderTextSlot): CSSProperties => ({
  color: slot.color,
  fontFamily: slot.fontFamily === "serif" ? "Georgia, 'Noto Serif Devanagari', serif" : "Arial, sans-serif",
  fontSize: Math.max(7, slot.fontSize * 0.28),
  fontWeight: slot.fontWeight === "bold" ? 700 : 400,
  textAlign: slot.align,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
});

function FrontHeaderPreview({
  front,
  profile,
  totalPages,
}: {
  front: FrontHeaderTemplate;
  profile: PublicationProfile;
  totalPages: number;
}) {
  const bgUrl = "/header paper.jpg";

  return (
    <div
      style={{
        border: "1px solid #d7cec0",
        backgroundImage: `linear-gradient(rgba(255, 254, 249, 0.2), rgba(255, 254, 249, 0.2)), url("${bgUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: 92,
        position: "relative",
      }}
    />
  );
}

function InsideHeaderPreview({
  inside,
  profile,
  pageNumber,
  totalPages,
}: {
  inside: InsideHeaderTemplate;
  profile: PublicationProfile;
  pageNumber: number;
  totalPages: number;
}) {
  const bgUrl = "/header paper.jpg";

  return (
    <div
      style={{
        border: "1px solid #d7cec0",
        backgroundImage: `linear-gradient(rgba(255, 254, 249, 0.15), rgba(255, 254, 249, 0.15)), url("${bgUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: 46,
        position: "relative",
      }}
    />
  );
}

export function HeaderManagerPanel({
  document,
  onApplyDraft,
  onSaveAs,
  onDuplicate,
  onRename,
  onDelete,
  onActivate,
  onSetDefault,
  onExport,
  onImport,
  onImportLogo,
  activePageId,
  activePageSectionName,
  onSetLocked,
  onSetHidden,
  onResetLayouts,
  onSetSectionOverride,
  onRemoveSectionOverride,
  onOverrideCurrentPage,
  onReturnCurrentPageToMaster,
  onUndoHeader,
  onRedoHeader,
}: HeaderManagerPanelProps) {
  const headerSystem = useMemo(
    () => normalizeHeaderSystemState(document.headerSystem, document.metadata, { enableDefaultHeader: true }),
    [document.headerSystem, document.metadata],
  );
  const activeHeaderSet = headerSystem.activeHeaderSetId
    ? headerSystem.headerSets[headerSystem.activeHeaderSetId]
    : null;
  const profile = activeHeaderSet
    ? headerSystem.publicationProfiles[activeHeaderSet.publicationProfileId]
    : null;
  const [draftProfile, setDraftProfile] = useState<PublicationProfile | null>(profile);
  const [frontLayout, setFrontLayout] = useState<HeaderLayoutKind>(activeHeaderSet?.front.layout ?? "classic-centered");
  const [insideLayout, setInsideLayout] = useState<InsideHeaderLayoutKind>(activeHeaderSet?.inside.layout ?? "classic-rule-folio");
  const [overrideSectionName, setOverrideSectionName] = useState(activePageSectionName);
  const [overrideDisplayName, setOverrideDisplayName] = useState(activePageSectionName);
  const [overrideLayout, setOverrideLayout] = useState<InsideHeaderLayoutKind>("section-color-band");
  const [overrideAccentColor, setOverrideAccentColor] = useState("#0f6f83");
  const [overrideWebsiteSlug, setOverrideWebsiteSlug] = useState("");
  const resolvedHeaders = resolveDocumentHeaders({
    ...document,
    headerSystem,
  });
  const validationIssues = [
    ...validateHeaderSystemState(headerSystem),
    ...validateHeaderAssets({ ...document, headerSystem }),
  ];
  const dirty = Boolean(
    draftProfile &&
      profile &&
      (JSON.stringify(draftProfile) !== JSON.stringify(profile) ||
        frontLayout !== activeHeaderSet?.front.layout ||
        insideLayout !== activeHeaderSet?.inside.layout),
  );

  useEffect(() => {
    setDraftProfile(profile);
    setFrontLayout(activeHeaderSet?.front.layout ?? "classic-centered");
    setInsideLayout(activeHeaderSet?.inside.layout ?? "classic-rule-folio");
  }, [activeHeaderSet?.front.layout, activeHeaderSet?.inside.layout, activeHeaderSet?.publicationProfileId, profile]);

  useEffect(() => {
    setOverrideSectionName(activePageSectionName);
    setOverrideDisplayName(activePageSectionName);
  }, [activePageSectionName]);

  if (!activeHeaderSet || !profile || !draftProfile) {
    return <div style={panelStyle}>No active header set.</div>;
  }

  const handleLogoUpload = async (file: File | null, role: "color" | "monochrome") => {
    if (!file) {
      return;
    }

    const format = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["png", "jpg", "jpeg", "svg"];

    if (!allowed.includes(format)) {
      window.alert("Header logos must be PNG, JPEG, or SVG.");
      return;
    }

    if (file.size > 2_500_000) {
      window.alert("Header logo must be 2.5 MB or smaller.");
      return;
    }

    if (format === "svg") {
      const svgText = await file.text();

      if (/<script|onload=|javascript:/iu.test(svgText)) {
        window.alert("Unsupported SVG content. Remove scripts or event handlers before importing.");
        return;
      }
    }

    const source = await readFileAsDataUrl(file);
    const dimensions = await readImageDimensions(source);
    const id = createUploadId();

    onImportLogo(profile.id, role, {
      id,
      name: file.name.replace(/\.[^.]+$/u, "") || "Header Logo",
      filename: file.name,
      originalFilename: file.name,
      size: file.size,
      format,
      source,
      thumbnailUrl: source,
      previewUrl: source,
      width: dimensions.width,
      height: dimensions.height,
      tags: ["header", "logo"],
    });
    setDraftProfile((current) =>
      current
        ? {
            ...current,
            logoAssetId: role === "color" ? id : current.logoAssetId,
            monochromeLogoAssetId: role === "monochrome" ? id : current.monochromeLogoAssetId,
          }
        : current,
    );
  };

  return (
    <div style={panelStyle}>
      <section style={sectionStyle}>
        <h3 style={titleStyle}>Header Set</h3>
        <label style={fieldStyle}>
          Active Set
          <select
            style={inputStyle}
            value={activeHeaderSet.id}
            onChange={(event) => onActivate(event.target.value)}
          >
            {Object.values(headerSystem.headerSets).map((headerSet) => (
              <option key={headerSet.id} value={headerSet.id}>{headerSet.name}</option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button type="button" style={inputStyle} onClick={() => onRename(window.prompt("Rename Header Set", activeHeaderSet.name) ?? activeHeaderSet.name)}>
            Rename
          </button>
          <button type="button" style={inputStyle} onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" style={inputStyle} onClick={() => onSaveAs(window.prompt("Save Header Set As", `${activeHeaderSet.name} Copy`) ?? "")}>
            Save As
          </button>
          <button type="button" style={inputStyle} onClick={onSetDefault}>
            Set Default
          </button>
          <button type="button" style={inputStyle} onClick={onUndoHeader}>
            Undo Header
          </button>
          <button type="button" style={inputStyle} onClick={onRedoHeader}>
            Redo Header
          </button>
          <button
            type="button"
            style={inputStyle}
            onClick={() => {
              const exported = onExport();
              void navigator.clipboard?.writeText(exported);
              window.alert("Header Set JSON copied to clipboard.");
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            style={inputStyle}
            onClick={() => {
              const payload = window.prompt("Paste Header Set JSON");

              if (payload) {
                onImport(payload);
              }
            }}
          >
            Import JSON
          </button>
          <button
            type="button"
            style={{ ...inputStyle, color: "#a33424" }}
            onClick={() => {
              if (window.confirm("Delete the active Header Set?")) {
                onDelete();
              }
            }}
          >
            Delete
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}><Newspaper size={14} /> Publication Profile</h3>
        <label style={fieldStyle}>
          Publication
          <input
            style={inputStyle}
            value={draftProfile.publicationName}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, publicationName: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Hindi Name
          <input
            style={inputStyle}
            value={draftProfile.publicationNameHindi ?? ""}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, publicationNameHindi: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Edition
          <input
            style={inputStyle}
            value={draftProfile.editionName}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, editionName: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Date
          <input
            style={inputStyle}
            type="date"
            value={draftProfile.date}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, date: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          City
          <input
            style={inputStyle}
            value={draftProfile.city}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, city: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Price
          <input
            style={inputStyle}
            value={draftProfile.price}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, price: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Website
          <input
            style={inputStyle}
            value={draftProfile.website ?? ""}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, website: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Volume
          <input
            style={inputStyle}
            value={draftProfile.volumeLabel ?? ""}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, volumeLabel: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Issue
          <input
            style={inputStyle}
            value={draftProfile.issueLabel ?? ""}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, issueLabel: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Registration
          <input
            style={inputStyle}
            value={draftProfile.registrationNumber ?? ""}
            onChange={(event) => setDraftProfile((current) => current ? { ...current, registrationNumber: event.target.value } : current)}
          />
        </label>
        <label style={fieldStyle}>
          Logo
          <input
            style={inputStyle}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => void handleLogoUpload(event.target.files?.[0] ?? null, "color")}
          />
        </label>
        <label style={fieldStyle}>
          Monochrome Logo
          <input
            style={inputStyle}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => void handleLogoUpload(event.target.files?.[0] ?? null, "monochrome")}
          />
        </label>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}><FileText size={14} /> Header Layouts</h3>
        <label style={fieldStyle}>
          Front Page
          <select
            style={inputStyle}
            value={frontLayout}
            onChange={(event) => setFrontLayout(event.target.value as HeaderLayoutKind)}
          >
            {Object.keys(frontHeaderLayouts).map((layout) => (
              <option key={layout} value={layout}>{layout}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Inside Pages
          <select
            style={inputStyle}
            value={insideLayout}
            onChange={(event) => setInsideLayout(event.target.value as InsideHeaderLayoutKind)}
          >
            {Object.keys(insideHeaderLayouts).map((layout) => (
              <option key={layout} value={layout}>{layout}</option>
            ))}
          </select>
        </label>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}>Master Header Controls</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button type="button" style={inputStyle} onClick={() => onSetLocked(!activeHeaderSet.locked)}>
            {activeHeaderSet.locked ? "Unlock Header" : "Lock Header"}
          </button>
          <button type="button" style={inputStyle} onClick={() => onSetHidden(!activeHeaderSet.hidden)}>
            {activeHeaderSet.hidden ? "Show Header" : "Hide Header"}
          </button>
          <button type="button" style={inputStyle} onClick={onResetLayouts}>
            Reset Layout
          </button>
          <button type="button" style={inputStyle} onClick={onReturnCurrentPageToMaster}>
            Return Page to Master
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#6b6258" }}>Active page override target: {activePageSectionName} ({activePageId})</div>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}>Section Override</h3>
        <label style={fieldStyle}>
          Section
          <input
            style={inputStyle}
            value={overrideSectionName}
            onChange={(event) => setOverrideSectionName(event.target.value)}
          />
        </label>
        <label style={fieldStyle}>
          Display Name
          <input
            style={inputStyle}
            value={overrideDisplayName}
            onChange={(event) => setOverrideDisplayName(event.target.value)}
          />
        </label>
        <label style={fieldStyle}>
          Folio Layout
          <select
            style={inputStyle}
            value={overrideLayout}
            onChange={(event) => setOverrideLayout(event.target.value as InsideHeaderLayoutKind)}
          >
            {Object.keys(insideHeaderLayouts).map((layout) => (
              <option key={layout} value={layout}>{layout}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Accent Colour
          <input
            style={inputStyle}
            type="color"
            value={overrideAccentColor}
            onChange={(event) => setOverrideAccentColor(event.target.value)}
          />
        </label>
        <label style={fieldStyle}>
          Website / Slug
          <input
            style={inputStyle}
            value={overrideWebsiteSlug}
            onChange={(event) => setOverrideWebsiteSlug(event.target.value)}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button
            type="button"
            style={inputStyle}
            onClick={() =>
              onSetSectionOverride({
                sectionName: overrideSectionName,
                displayName: overrideDisplayName,
                layout: overrideLayout,
                accentColor: overrideAccentColor,
                websiteSlug: overrideWebsiteSlug,
              })
            }
          >
            Apply Section
          </button>
          <button type="button" style={inputStyle} onClick={() => onRemoveSectionOverride(overrideSectionName)}>
            Remove Section
          </button>
          <button
            type="button"
            style={inputStyle}
            onClick={() =>
              onOverrideCurrentPage({
                sectionName: overrideDisplayName || activePageSectionName,
                layout: overrideLayout,
                accentColor: overrideAccentColor,
              })
            }
          >
            Override Page
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}>Preview</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Front page</div>
          <FrontHeaderPreview front={frontHeaderLayouts[frontLayout]} profile={draftProfile} totalPages={document.pages.length} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Odd inside</div>
              <InsideHeaderPreview inside={insideHeaderLayouts[insideLayout]} profile={draftProfile} pageNumber={3} totalPages={document.pages.length} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Even inside</div>
              <InsideHeaderPreview inside={insideHeaderLayouts[insideLayout]} profile={draftProfile} pageNumber={2} totalPages={document.pages.length} />
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={titleStyle}>Live Validation</h3>
        <div>Resolved headers: {resolvedHeaders.length} / {document.pages.length}</div>
        <div>Protected: {activeHeaderSet.protected ? "yes" : "no"}</div>
        <div>Locked: {activeHeaderSet.locked ? "yes" : "no"}</div>
        <div>Default: {headerSystem.defaultHeaderSetId === activeHeaderSet.id ? "yes" : "no"}</div>
        <div>Front reserve: {activeHeaderSet.front.height}px</div>
        <div>Inside reserve: {activeHeaderSet.inside.height}px</div>
        {validationIssues.length > 0 ? (
          <div style={{ display: "grid", gap: 4 }}>
            {validationIssues.map((issue) => (
              <div key={`${issue.code}-${issue.message}`} style={{ color: issue.severity === "error" ? "#a33424" : "#7d5d12" }}>
                {issue.message}
              </div>
            ))}
          </div>
        ) : (
          <div>No header validation issues.</div>
        )}
      </section>
      <button
        type="button"
        disabled={!dirty}
        onClick={() =>
          onApplyDraft({
            profileId: profile.id,
            profile: draftProfile,
            frontLayout,
            insideLayout,
          })
        }
        style={{
          ...inputStyle,
          cursor: dirty ? "pointer" : "default",
          background: dirty ? "#0f6f83" : "#e7e0d6",
          color: dirty ? "#fffdf8" : "#6b6258",
          fontWeight: 700,
        }}
      >
        Apply Header Set
      </button>
    </div>
  );
}
