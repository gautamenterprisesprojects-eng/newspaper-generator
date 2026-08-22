"use client";

import { useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

export type PagePreviewState =
  | { status: "loading" }
  | { status: "ready"; dataUrl: string; pageWidth: number; pageHeight: number }
  | { status: "error"; message: string };

type PagePreviewOverlayProps = {
  preview: PagePreviewState;
  pageLabel: string;
  onClose: () => void;
};

const ZOOM_STEPS = [0.25, 0.35, 0.5, 0.7, 1, 1.25, 1.5, 2];

/**
 * Full-screen, editor-chrome-free look at the page — rendered by the caller
 * through the same canvas the PDF export draws with, so this can't show
 * something the exported file won't. Purely a viewer: no selection, no
 * hit-regions, no rulers.
 */
export function PagePreviewOverlay({ preview, pageLabel, onClose }: PagePreviewOverlayProps) {
  const [zoom, setZoom] = useState(0.7);

  const zoomIn = () => setZoom((current) => ZOOM_STEPS.find((step) => step > current + 0.001) ?? current);
  const zoomOut = () =>
    setZoom((current) => [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? current);

  return (
    <div className="page-preview-overlay" role="dialog" aria-label="Page preview" aria-modal="true">
      <div className="page-preview-header">
        <span>Preview — {pageLabel}</span>
        {preview.status === "ready" ? (
          <div className="page-preview-zoom">
            <button type="button" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut size={14} />
            </button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button type="button" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn size={14} />
            </button>
          </div>
        ) : null}
        <button type="button" className="page-preview-close" onClick={onClose} aria-label="Close preview">
          <X size={16} />
        </button>
      </div>

      <div className="page-preview-body">
        {preview.status === "loading" ? (
          <div className="page-preview-status">
            <span className="page-preview-spinner" />
            <p>Rendering preview…</p>
          </div>
        ) : null}

        {preview.status === "error" ? (
          <div className="page-preview-status page-preview-status-error">
            <p>Couldn&apos;t render the preview.</p>
            <small>{preview.message}</small>
          </div>
        ) : null}

        {preview.status === "ready" ? (
          <div className="page-preview-scroll">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.dataUrl}
              alt={`${pageLabel} preview`}
              className="page-preview-image"
              style={{
                width: preview.pageWidth * zoom,
                height: preview.pageHeight * zoom,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
