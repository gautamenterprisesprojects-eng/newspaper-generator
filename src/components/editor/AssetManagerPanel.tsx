"use client";

import {
  AlertTriangle,
  FileImage,
  Image as ImageIcon,
  Link,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import {
  filterAssets,
  getAssetManagerStatus,
  getAssetUsages,
  getAssetWarnings,
} from "@/engines/AssetManager/AssetManagerEngine";
import type { AssetImportDescriptor, AssetManagerFilter } from "@/engines/AssetManager/AssetManagerTypes";
import type { NewspaperAsset, NewspaperAssetId, NewspaperDocument } from "@/types/document";

type AssetManagerPanelProps = {
  document: NewspaperDocument;
  onImportAssets: (assets: AssetImportDescriptor[]) => void;
  onPlaceAsset: (assetId: NewspaperAssetId) => void;
  onDeleteAsset: (assetId: NewspaperAssetId) => void;
  onRelinkAsset: (assetId: NewspaperAssetId, source: string) => void;
  onSetAssetStatus: (assetId: NewspaperAssetId, status: NonNullable<NewspaperAsset["linkStatus"]>) => void;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

const getImageSize = (source: string) =>
  new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new Image();

    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = source;
  });

const fileToAssetDescriptor = async (file: File): Promise<AssetImportDescriptor> => {
  const source = await readFileAsDataUrl(file);
  const size = file.type.startsWith("image/") ? await getImageSize(source) : {};

  return {
    name: file.name.replace(/\.[^.]+$/, ""),
    filename: file.name,
    originalFilename: file.name,
    size: file.size,
    width: size.width,
    height: size.height,
    format: file.name.split(".").pop()?.toLowerCase(),
    source,
    thumbnailUrl: source,
    previewUrl: source,
    modifiedAt: new Date(file.lastModified).toISOString(),
    linkMode: "embedded",
  };
};

const formatBytes = (size = 0) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const AssetManagerPanel = memo(function AssetManagerPanel({
  document,
  onImportAssets,
  onPlaceAsset,
  onDeleteAsset,
  onRelinkAsset,
  onSetAssetStatus,
}: AssetManagerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const relinkInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<NewspaperAssetId | null>(null);
  const [filter, setFilter] = useState<AssetManagerFilter>({
    query: "",
    type: "all",
    usage: "all",
  });
  const status = useMemo(() => getAssetManagerStatus(document), [document]);
  const assets = useMemo(() => filterAssets(document, filter), [document, filter]);
  const warnings = useMemo(() => getAssetWarnings(document), [document]);
  const warningsByAsset = useMemo(() => {
    const map = new Map<NewspaperAssetId, typeof warnings>();

    warnings.forEach((warning) => {
      map.set(warning.assetId, [...(map.get(warning.assetId) ?? []), warning]);
    });

    return map;
  }, [warnings]);
  const selectedAsset = selectedAssetId ? document.assets[selectedAssetId] ?? null : null;
  const selectedUsages = selectedAsset ? getAssetUsages(document, selectedAsset.id) : [];

  const importFiles = async (files: FileList | File[]) => {
    const descriptors = await Promise.all(Array.from(files).map(fileToAssetDescriptor));

    onImportAssets(descriptors);
    if (descriptors[0]?.id) {
      setSelectedAssetId(descriptors[0].id);
    }
  };

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    await importFiles(files);
  };

  return (
    <aside
      className="asset-manager"
      aria-label="Asset Manager"
      onDragOver={(event) => event.preventDefault()}
      onPaste={(event) => {
        if (event.clipboardData.files.length > 0) {
          void importFiles(event.clipboardData.files);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        void importFiles(event.dataTransfer.files);
      }}
    >
      <header className="asset-manager-header">
        <span>Assets</span>
        <strong>Image Workflow</strong>
        <small>Images / Logos / Ads / Graphics</small>
      </header>

      <section className="asset-manager-status">
        <span>Total {status.total}</span>
        <span>Images {status.images}</span>
        <span>Logos {status.logos}</span>
        <span>Ads {status.advertisements}</span>
        <span>Unused {status.unused}</span>
        <span>Missing {status.missing + status.broken}</span>
      </section>

      <section className="asset-manager-tools">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} /> Import
        </button>
        <button type="button" onClick={() => folderInputRef.current?.click()}>
          Folder
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()}>
          Camera
        </button>
        <button type="button" disabled={!selectedAsset} onClick={() => selectedAsset && onPlaceAsset(selectedAsset.id)}>
          <ImageIcon size={13} /> Place
        </button>
        <button type="button" disabled={!selectedAsset} onClick={() => relinkInputRef.current?.click()}>
          <Link size={13} /> Relink
        </button>
        <button
          type="button"
          disabled={!selectedAsset}
          onClick={() => selectedAsset && onSetAssetStatus(selectedAsset.id, "missing")}
        >
          Missing
        </button>
        <button type="button" disabled={!selectedAsset} onClick={() => selectedAsset && onDeleteAsset(selectedAsset.id)}>
          <Trash2 size={13} /> Delete
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.svg,.pdf"
          hidden
          onChange={(event) => void handleFileInput(event.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept="image/*,.svg,.pdf"
          hidden
          {...{ webkitdirectory: "true" }}
          onChange={(event) => void handleFileInput(event.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => void handleFileInput(event.target.files)}
        />
        <input
          ref={relinkInputRef}
          type="file"
          accept="image/*,.svg,.pdf"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (!file || !selectedAsset) {
              return;
            }

            onRelinkAsset(selectedAsset.id, await readFileAsDataUrl(file));
          }}
        />
      </section>

      <section className="asset-manager-filters">
        <label className="asset-manager-search">
          <Search size={13} />
          <input
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search assets"
          />
        </label>
        <div className="asset-manager-filter-grid">
          <select
            value={filter.type}
            onChange={(event) => setFilter((current) => ({ ...current, type: event.target.value as AssetManagerFilter["type"] }))}
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="logo">Logos</option>
            <option value="advertisement">Advertisements</option>
            <option value="graphic">Graphics</option>
            <option value="svg">SVG</option>
            <option value="pdf">PDF</option>
          </select>
          <select
            value={filter.usage}
            onChange={(event) => setFilter((current) => ({ ...current, usage: event.target.value as AssetManagerFilter["usage"] }))}
          >
            <option value="all">All Usage</option>
            <option value="recent">Recently Used</option>
            <option value="used">Used</option>
            <option value="unused">Unused</option>
            <option value="missing">Missing</option>
            <option value="broken">Broken Links</option>
          </select>
        </div>
      </section>

      <section className="asset-manager-grid" aria-label="Assets">
        {assets.map((asset) => {
          const active = asset.id === selectedAssetId;
          const assetWarnings = warningsByAsset.get(asset.id) ?? [];

          return (
            <button
              type="button"
              key={asset.id}
              className={active ? "active" : ""}
              onClick={() => setSelectedAssetId(asset.id)}
              onDoubleClick={() => onPlaceAsset(asset.id)}
            >
              <span className="asset-thumb">
                {asset.thumbnailUrl && asset.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <FileImage size={18} />
                )}
                {assetWarnings.length > 0 ? <AlertTriangle size={12} /> : null}
              </span>
              <strong>{asset.name}</strong>
              <small>{asset.format?.toUpperCase() ?? asset.type} / {formatBytes(asset.size)}</small>
            </button>
          );
        })}
      </section>

      <section className="asset-manager-detail">
        <div className="frame-manager-panel-title">Selected Asset</div>
        {selectedAsset ? (
          <div className="asset-detail-grid">
            <span>Filename</span><strong>{selectedAsset.filename ?? selectedAsset.name}</strong>
            <span>Size</span><strong>{formatBytes(selectedAsset.size)}</strong>
            <span>Dimensions</span><strong>{selectedAsset.width ?? "-"} x {selectedAsset.height ?? "-"}</strong>
            <span>DPI</span><strong>{selectedAsset.dpi ?? "-"}</strong>
            <span>Color</span><strong>{selectedAsset.colorSpace ?? "Unknown"}</strong>
            <span>Status</span><strong>{selectedAsset.linkStatus ?? "ok"}</strong>
            <span>Usage</span><strong>{selectedUsages.length}</strong>
          </div>
        ) : (
          <p className="asset-empty">Import or select an asset.</p>
        )}
        {selectedAsset ? (
          <div className="asset-usage-list">
            {selectedUsages.map((usage) => (
              <span key={`${usage.frameId}-${usage.pageId}`}>
                Page {usage.pageNumber} / Layer {usage.layer}
              </span>
            ))}
            {(warningsByAsset.get(selectedAsset.id) ?? []).map((warning) => (
              <em key={`${warning.assetId}-${warning.type}`}>{warning.message}</em>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
});
