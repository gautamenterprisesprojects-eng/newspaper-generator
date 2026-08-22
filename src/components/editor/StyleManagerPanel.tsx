"use client";

import { Copy, Download, FilePlus2, Palette, Search, Trash2, Upload } from "lucide-react";
import { memo, useMemo, useState } from "react";
import {
  getStyleManagerStatus,
  getStyleOverrideSummary,
  listStyles,
  normalizeStyleLibrary,
} from "@/engines/StyleManager/StyleManagerEngine";
import type {
  StyleCreateInput,
  StyleExportFormat,
  StyleFilter,
  StyleImportFormat,
  StyleUpdateInput,
} from "@/engines/StyleManager/StyleManagerTypes";
import type {
  NewspaperDocument,
  NewspaperStyleId,
  NewspaperStyleKind,
  NewspaperStyleTheme,
} from "@/types/document";

type StyleManagerPanelProps = {
  document: NewspaperDocument;
  selectedTargetId: string | null;
  onCreateStyle: (input: StyleCreateInput) => void;
  onDuplicateStyle: (styleId: NewspaperStyleId) => void;
  onRenameStyle: (styleId: NewspaperStyleId, name: string) => void;
  onUpdateStyle: (styleId: NewspaperStyleId, patch: StyleUpdateInput) => void;
  onDeleteStyle: (styleId: NewspaperStyleId) => void;
  onApplyStyle: (targetId: string, styleId: NewspaperStyleId) => void;
  onMarkOverride: (targetId: string) => void;
  onClearOverrides: (targetId: string) => void;
  onImportStyles: (source: string, format: StyleImportFormat) => void;
  onExportStyles: (format: StyleExportFormat) => string;
};

const styleKinds: (NewspaperStyleKind | "all")[] = ["all", "paragraph", "character", "object", "frame", "table", "cell"];
const styleThemes: (NewspaperStyleTheme | "all")[] = ["all", "hindi", "english", "magazine", "tabloid", "broadsheet"];

export const StyleManagerPanel = memo(function StyleManagerPanel({
  document,
  selectedTargetId,
  onCreateStyle,
  onDuplicateStyle,
  onRenameStyle,
  onUpdateStyle,
  onDeleteStyle,
  onApplyStyle,
  onMarkOverride,
  onClearOverrides,
  onImportStyles,
  onExportStyles,
}: StyleManagerPanelProps) {
  const [selectedStyleId, setSelectedStyleId] = useState<NewspaperStyleId | null>(null);
  const [filter, setFilter] = useState<StyleFilter>({ query: "", kind: "all", theme: "all" });
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");

  const library = useMemo(() => normalizeStyleLibrary(document.styles), [document.styles]);
  const status = useMemo(() => getStyleManagerStatus(document), [document]);
  const overrideSummary = useMemo(() => getStyleOverrideSummary(document), [document]);
  const styles = useMemo(() => listStyles(document, filter), [document, filter]);
  const selectedStyle = selectedStyleId ? library.styles[selectedStyleId] ?? null : null;
  const selectedTargetStyleId = selectedTargetId ? library.assignments[selectedTargetId] : null;
  const selectedTargetHasOverride = selectedTargetId ? Boolean(library.overrides[selectedTargetId]) : false;

  const createFilteredStyle = () => {
    const kind = filter.kind === "all" ? "paragraph" : filter.kind;
    const theme = filter.theme === "all" ? library.activeTheme : filter.theme;
    onCreateStyle({
      name: `New ${kind[0].toUpperCase()}${kind.slice(1)} Style`,
      kind,
      theme,
    });
  };

  const renameSelectedStyle = () => {
    if (!selectedStyle) {
      return;
    }

    onRenameStyle(selectedStyle.id, `${selectedStyle.name} Renamed`);
  };

  const updateSelectedColor = () => {
    if (!selectedStyle) {
      return;
    }

    if (selectedStyle.kind === "paragraph") {
      onUpdateStyle(selectedStyle.id, {
        settings: {
          color: selectedStyle.settings.color === "#b42318" ? "#161412" : "#b42318",
        } as never,
      });
    }
    if (selectedStyle.kind === "object") {
      onUpdateStyle(selectedStyle.id, {
        settings: {
          fill: selectedStyle.settings.fill === "#fff4cf" ? "transparent" : "#fff4cf",
        } as never,
      });
    }
    if (selectedStyle.kind === "frame") {
      onUpdateStyle(selectedStyle.id, {
        settings: {
          background: selectedStyle.settings.background === "#fff4cf" ? "transparent" : "#fff4cf",
        } as never,
      });
    }
  };

  return (
    <aside className="style-manager" aria-label="Style Manager">
      <header className="style-manager-header">
        <span>Styles</span>
        <strong>Document Style System</strong>
        <small>Paragraph / Character / Object / Frame / Table / Cell</small>
      </header>

      <section className="style-manager-status">
        <span>Total {status.total}</span>
        <span>Para {status.paragraph}</span>
        <span>Char {status.character}</span>
        <span>Object {status.object}</span>
        <span>Frame {status.frame}</span>
        <span>Overrides {status.overrides}</span>
      </section>

      <section className="style-manager-filters">
        <label className="style-manager-search">
          <Search size={13} />
          <input
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search styles"
          />
        </label>
        <div className="style-filter-grid">
          <select
            value={filter.kind}
            onChange={(event) => setFilter((current) => ({ ...current, kind: event.target.value as StyleFilter["kind"] }))}
          >
            {styleKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          <select
            value={filter.theme}
            onChange={(event) => setFilter((current) => ({ ...current, theme: event.target.value as StyleFilter["theme"] }))}
          >
            {styleThemes.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
          </select>
        </div>
      </section>

      <section className="style-manager-tools">
        <button type="button" onClick={createFilteredStyle}><FilePlus2 size={13} /> Create</button>
        <button type="button" disabled={!selectedStyle} onClick={() => selectedStyle && onDuplicateStyle(selectedStyle.id)}>
          <Copy size={13} /> Duplicate
        </button>
        <button type="button" disabled={!selectedStyle} onClick={renameSelectedStyle}>Rename</button>
        <button type="button" disabled={!selectedStyle} onClick={() => selectedStyle && onDeleteStyle(selectedStyle.id)}>
          <Trash2 size={13} /> Delete
        </button>
      </section>

      <section className="style-list">
        {styles.map((style) => {
          const active = style.id === selectedStyleId;
          const assigned = style.id === selectedTargetStyleId;

          return (
            <button
              type="button"
              key={style.id}
              className={`${active ? "active" : ""}${assigned ? " assigned" : ""}`}
              onClick={() => setSelectedStyleId(style.id)}
              onDoubleClick={() => selectedTargetId && onApplyStyle(selectedTargetId, style.id)}
            >
              <span>
                <Palette size={14} />
                <strong>{style.name}{assigned ? " +" : ""}</strong>
              </span>
              <small>{style.kind} / {style.theme ?? "theme"}</small>
              <em>{style.id}</em>
            </button>
          );
        })}
      </section>

      <section className="style-detail">
        <div className="frame-manager-panel-title">Selected Style</div>
        {selectedStyle ? (
          <>
            <div className="style-detail-grid">
              <span>Name</span><strong>{selectedStyle.name}</strong>
              <span>Kind</span><strong>{selectedStyle.kind}</strong>
              <span>Theme</span><strong>{selectedStyle.theme ?? "-"}</strong>
              <span>Based On</span><strong>{selectedStyle.basedOnId ?? "-"}</strong>
            </div>
            <button type="button" onClick={updateSelectedColor}>Toggle Preview Color</button>
            <button type="button" disabled={!selectedTargetId} onClick={() => selectedTargetId && onApplyStyle(selectedTargetId, selectedStyle.id)}>
              Apply To Selection
            </button>
          </>
        ) : (
          <p className="asset-empty">Select a style.</p>
        )}
      </section>

      <section className="style-detail">
        <div className="frame-manager-panel-title">Overrides</div>
        <div className="style-detail-grid">
          <span>Assignments</span><strong>{overrideSummary.totalAssignments}</strong>
          <span>Overrides</span><strong>{overrideSummary.overrideCount}</strong>
          <span>Selection</span><strong>{selectedTargetId ?? "None"}</strong>
          <span>Selection +</span><strong>{selectedTargetHasOverride ? "Yes" : "No"}</strong>
        </div>
        <div className="style-manager-tools compact">
          <button type="button" disabled={!selectedTargetId} onClick={() => selectedTargetId && onMarkOverride(selectedTargetId)}>
            Mark +
          </button>
          <button type="button" disabled={!selectedTargetId} onClick={() => selectedTargetId && onClearOverrides(selectedTargetId)}>
            Clear
          </button>
        </div>
      </section>

      <section className="style-import-export">
        <div className="frame-manager-panel-title">Import / Export</div>
        <textarea
          value={importText || exportText}
          onChange={(event) => {
            setImportText(event.target.value);
            setExportText("");
          }}
          placeholder="Paste JSON style package"
        />
        <div className="style-manager-tools compact">
          <button type="button" onClick={() => onImportStyles(importText, "json")}>
            <Upload size={13} /> Import
          </button>
          <button
            type="button"
            onClick={() => {
              const exported = onExportStyles("json");
              setExportText(exported);
              setImportText("");
            }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </section>
    </aside>
  );
});
