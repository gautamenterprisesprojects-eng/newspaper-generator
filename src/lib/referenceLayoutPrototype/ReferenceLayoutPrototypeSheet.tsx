"use client";

import type { CSSProperties } from "react";
import { FRONT_HEADER_BANNER_SOURCE } from "@/engines/HeaderSystem/HeaderGeometry";
import {
  PROTOTYPE_BORDERS,
  PROTOTYPE_COLOURS,
  type PrototypeArticleBox,
  type PrototypeLayout,
  type RectPt,
} from "./geometry";

const pt = (value: number) => `${value}pt`;

const boxStyle = (r: RectPt, extra: CSSProperties = {}): CSSProperties => ({
  position: "absolute",
  left: pt(r.x),
  top: pt(r.y),
  width: pt(r.width),
  height: pt(r.height),
  overflow: "hidden",
  boxSizing: "border-box",
  ...extra,
});

function StructureLabel({ text }: { text: string }) {
  return (
    <span
      style={{
        position: "absolute",
        top: "1.5pt",
        right: "2pt",
        fontSize: "5.2pt",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#8a5a16",
        background: "rgba(255,253,248,0.86)",
        padding: "0 2pt",
        zIndex: 4,
        pointerEvents: "none",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {text}
    </span>
  );
}

function ImagePlaceholder({ box, label }: { box: RectPt; label: string }) {
  return (
    <div
      style={{
        ...boxStyle(box, {
          background: PROTOTYPE_COLOURS.imageFill,
          border: `${PROTOTYPE_BORDERS.image}pt solid ${PROTOTYPE_COLOURS.imageStroke}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5c564c",
          fontSize: "7.5pt",
          fontFamily: "Arial, sans-serif",
        }),
      }}
    >
      {label}
    </div>
  );
}

function BodyWell({
  box,
  text,
  columns,
  fontSize,
}: {
  box: RectPt;
  text: string;
  columns: number;
  fontSize: number;
}) {
  return (
    <div
      style={{
        ...boxStyle(box, {
          columnCount: Math.max(1, columns),
          columnGap: "7pt",
          columnRule: columns > 1 ? "0.35pt solid #c9c2b6" : "none",
          fontFamily: '"Cliff Noto Serif Devanagari", serif',
          fontSize: pt(fontSize),
          lineHeight: pt(fontSize + 2.6),
          textAlign: "justify",
          color: PROTOTYPE_COLOURS.ink,
          hyphens: "auto",
        }),
      }}
    >
      {text}
    </div>
  );
}

function ArticleTree({ article, nested = false }: { article: PrototypeArticleBox; nested?: boolean }) {
  const outerBorder = nested ? PROTOTYPE_BORDERS.nested : PROTOTYPE_BORDERS.outer;
  const outerFill = nested ? PROTOTYPE_COLOURS.nestedFill : article.role === "cartoon" ? PROTOTYPE_COLOURS.cartoonFill : PROTOTYPE_COLOURS.paper;

  return (
    <>
      <div
        data-box={article.id}
        data-kind={nested ? "nested-outer" : "outer"}
        style={boxStyle(article.outer, {
          background: outerFill,
          border: `${outerBorder}pt solid ${PROTOTYPE_COLOURS.ink}`,
        })}
      >
        <StructureLabel text={nested ? "NESTED OUTER" : "OUTER ARTICLE"} />
      </div>

      {article.kicker ? (
        <div
          style={boxStyle(article.kicker, {
            background: article.kicker.fill,
            color: article.kicker.color,
            display: "flex",
            alignItems: "center",
            padding: "0 5pt",
            fontFamily: '"Cliff Noto Sans Devanagari", sans-serif',
            fontWeight: 700,
            fontSize: "8pt",
            letterSpacing: "0.02em",
          })}
        >
          {article.kicker.text}
        </div>
      ) : null}

      {article.headline ? (
        <div
          style={boxStyle(article.headline, {
            fontFamily: '"Cliff Noto Sans Devanagari", sans-serif',
            fontWeight: 700,
            fontSize: pt(article.headline.fontSize),
            lineHeight: 1.12,
            color: PROTOTYPE_COLOURS.ink,
          })}
        >
          {article.headline.text}
        </div>
      ) : null}

      {article.role !== "rail" ? (
        <div
          data-box={`${article.id}-inner`}
          data-kind="inner"
          style={boxStyle(article.inner, {
            background: PROTOTYPE_COLOURS.innerFill,
            border: `${PROTOTYPE_BORDERS.inner}pt solid ${PROTOTYPE_COLOURS.ink}`,
          })}
        >
          <StructureLabel text="INNER CONTENT" />
        </div>
      ) : null}

      {article.image ? <ImagePlaceholder box={article.image} label={article.image.label} /> : null}

      {article.caption ? (
        <div
          style={boxStyle(article.caption, {
            background: PROTOTYPE_COLOURS.captionFill,
            fontFamily: '"Cliff Noto Sans Devanagari", sans-serif',
            fontSize: pt(article.caption.fontSize),
            fontStyle: "italic",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#3d3933",
          })}
        >
          {article.caption.text}
        </div>
      ) : null}

      {article.role !== "rail" ? (
        <BodyWell box={article.body} text={article.body.text} columns={article.body.columns} fontSize={article.body.fontSize} />
      ) : null}

      {(article.extraBodies ?? []).map((extra, index) => (
        <BodyWell
          key={`${article.id}-extra-${index}`}
          box={extra}
          text={extra.text}
          columns={extra.columns}
          fontSize={extra.fontSize}
        />
      ))}

      {(article.stackedInners ?? []).map((stacked) => (
        <ArticleTree key={stacked.id} article={stacked} nested />
      ))}

      {(article.nested ?? []).map((child) => (
        <ArticleTree key={child.id} article={child} nested />
      ))}
    </>
  );
}

export function ReferenceLayoutPrototypeSheet({
  layout,
  showGrid = false,
}: {
  layout: PrototypeLayout;
  showGrid?: boolean;
}) {
  return (
    <div
      id="prototype-sheet"
      data-layout-id={layout.id}
      style={{
        position: "relative",
        width: pt(layout.page.width),
        height: pt(layout.page.height),
        background: "#ffffff",
        color: PROTOTYPE_COLOURS.ink,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      }}
    >
      <img
        alt="Existing Cliff News masthead — not modified"
        src={FRONT_HEADER_BANNER_SOURCE}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: pt(layout.header.width),
          height: pt(layout.header.height),
          objectFit: "fill",
          display: "block",
        }}
      />

      {showGrid
        ? layout.columns.map((column) => (
            <div
              key={`col-${column.index}`}
              style={{
                position: "absolute",
                left: pt(column.x),
                top: pt(layout.content.y),
                width: pt(column.width),
                height: pt(layout.content.height),
                borderLeft: "0.35pt dashed rgba(30,80,140,0.25)",
                borderRight: "0.35pt dashed rgba(30,80,140,0.25)",
                pointerEvents: "none",
              }}
            />
          ))
        : null}

      {layout.articles.map((article) => (
        <ArticleTree key={article.id} article={article} />
      ))}

      {layout.pressBar.bars.map((bar, index) => (
        <div
          key={`press-bar-${index}`}
          style={{
            position: "absolute",
            left: pt(bar.x),
            top: pt(bar.y),
            width: pt(bar.width),
            height: pt(bar.height),
            borderRadius: pt(bar.cornerRadius),
            background: bar.fill,
          }}
        />
      ))}
      {layout.pressBar.dots.map((dot, index) => (
        <div
          key={`press-dot-${index}`}
          style={{
            position: "absolute",
            left: pt(dot.x - dot.radius),
            top: pt(dot.y - dot.radius),
            width: pt(dot.radius * 2),
            height: pt(dot.radius * 2),
            borderRadius: "50%",
            background: dot.fill,
          }}
        />
      ))}
    </div>
  );
}
