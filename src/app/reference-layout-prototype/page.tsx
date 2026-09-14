"use client";

import { useMemo, useState } from "react";
import { buildReferenceLayoutPrototype, validatePrototypeLayout } from "@/lib/referenceLayoutPrototype/geometry";
import { ReferenceLayoutPrototypeSheet } from "@/lib/referenceLayoutPrototype/ReferenceLayoutPrototypeSheet";

export default function ReferenceLayoutPrototypePage() {
  const layout = useMemo(() => buildReferenceLayoutPrototype(), []);
  const issues = useMemo(() => validatePrototypeLayout(layout), [layout]);
  const [showGrid, setShowGrid] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#d5d2ca",
        color: "#191714",
        fontFamily: '"Cliff Noto Sans Devanagari", system-ui, sans-serif',
        padding: "24px 28px 64px",
      }}
    >
      <style>{`
        html, body { margin: 0; }
        @page { size: 13in 21in; margin: 0; }
        @media print {
          html, body, main {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 13in;
            height: 21in;
            overflow: hidden;
          }
          .prototype-chrome { display: none !important; }
          #prototype-sheet {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <section className="prototype-chrome" style={{ maxWidth: 980, marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d675d" }}>
          Experimental example · {layout.id}
        </p>
        <h1 style={{ margin: "6px 0 10px", fontSize: 28 }}>15 Sep 2026 reference layout prototype</h1>
        <p style={{ margin: "0 0 14px", maxWidth: 760, lineHeight: 1.45 }}>
          Geometry-only proof of the scanned front page. The production template is
          <strong> CliffFrontSep15</strong>, selectable on the Front Page wizard tab.
          The existing masthead is reused as-is. Existing production layouts are not replaced.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <a
            href="/api/reference-layout-prototype/pdf"
            style={{
              background: "#0d5f75",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Download prototype PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #b8b0a1", background: "#fffdf8", cursor: "pointer" }}
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((value) => !value)}
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #b8b0a1", background: "#fffdf8", cursor: "pointer" }}
          >
            {showGrid ? "Hide 6-column grid" : "Show 6-column grid"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: issues.length ? "#9b1c1c" : "#1f6b3a" }}>
          {issues.length === 0
            ? "Validation: no overlap, no overflow, nested boxes contained, header untouched."
            : `Validation found ${issues.length} issue(s): ${issues.map((issue) => issue.message).join(" ")}`}
        </p>
      </section>
      <ReferenceLayoutPrototypeSheet layout={layout} showGrid={showGrid} />
    </main>
  );
}
