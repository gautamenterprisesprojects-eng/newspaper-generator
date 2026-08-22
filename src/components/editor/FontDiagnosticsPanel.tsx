import type { FontManagerState } from "@/engines/FontManager/FontManagerTypes";

type FontDiagnosticsPanelProps = {
  fontManager: FontManagerState;
  compact?: boolean;
};

export function FontDiagnosticsPanel({ fontManager, compact = false }: FontDiagnosticsPanelProps) {
  return (
    <section className={compact ? "font-diagnostics-panel is-compact" : "font-diagnostics-panel"}>
      <header>
        <strong>Font Diagnostics</strong>
        <span data-status={fontManager.status}>{fontManager.status}</span>
      </header>
      {fontManager.warning ? <p className="font-warning">{fontManager.warning}</p> : null}
      <div className="font-diagnostics-grid">
        {fontManager.diagnostics.map((font) => (
          <div key={font.id} className="font-diagnostic-card">
            <span>{font.role}</span>
            <strong>{font.resolvedFont}</strong>
            <small>Requested: {font.requestedFont}</small>
            <small>Measure: {font.measurementFont}</small>
            <small>Render: {font.renderFont}</small>
            <small>PDF: {font.pdfFont}</small>
            <small>Version: {font.version}</small>
            <em>{font.fallback ? "Fallback warning" : "Loaded"}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

