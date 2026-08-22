"use client";

import { Arc, Circle, Ellipse, Group, Rect, Text } from "react-konva";
import {
  RASHIFAL_GLYPH_FONT,
  getRashifalGrid,
  type RashifalReading,
} from "@/engines/MasterPage/RashifalGridGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

type RashifalGridProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  readings: RashifalReading[];
  title?: string;
};

/**
 * Draws the आज का राशिफल block as a grid of twelve cells.
 *
 * Furniture, not an article: the geometry comes from `getRashifalGrid`, which
 * the export canvas draws from as well, so the screen and the printed sheet
 * cannot drift apart.
 */
export function RashifalGrid({ x, y, width, height, readings, title }: RashifalGridProps) {
  const grid = getRashifalGrid({ x, y, width, height, readings, title });
  const serif = getNewspaperFontStack("serif");
  const sans = getNewspaperFontStack("sans");

  return (
    <Group listening={false}>
      {/* Devotional frame: double rule with corner diamonds, the treatment
          Indian papers give astrological and पंचांग panels. */}
      <Rect
        x={grid.frame.outer.x}
        y={grid.frame.outer.y}
        width={grid.frame.outer.width}
        height={grid.frame.outer.height}
        stroke={grid.frame.stroke}
        strokeWidth={grid.frame.outer.strokeWidth}
      />
      <Rect
        x={grid.frame.inner.x}
        y={grid.frame.inner.y}
        width={grid.frame.inner.width}
        height={grid.frame.inner.height}
        stroke={grid.frame.stroke}
        strokeWidth={grid.frame.inner.strokeWidth}
      />
      {/* Devotional motifs: scalloped arcs along the rules, a lotus at each
          corner, and the kalash at the head of the block. Drawn from primitives
          the geometry emits, so this renderer needs no notion of a lotus. */}
      {grid.frame.shapes.map((shape, index) => {
        const key = `rashifal-shape-${index}`;

        if (shape.kind === "ellipse") {
          return (
            <Ellipse
              key={key}
              x={shape.cx}
              y={shape.cy}
              radiusX={shape.rx}
              radiusY={shape.ry}
              rotation={(shape.rotation * 180) / Math.PI}
              fill={shape.fill}
            />
          );
        }

        if (shape.kind === "circle") {
          return <Circle key={key} x={shape.cx} y={shape.cy} radius={shape.radius} fill={shape.fill} />;
        }

        return (
          <Arc
            key={key}
            x={shape.cx}
            y={shape.cy}
            innerRadius={shape.radius}
            outerRadius={shape.radius}
            angle={((shape.to - shape.from) * 180) / Math.PI}
            rotation={(shape.from * 180) / Math.PI}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
          />
        );
      })}

      {/* Block title */}
      <Rect
        x={grid.title.x + 4}
        y={grid.title.y + 2.5}
        width={grid.title.width - 8}
        height={grid.title.height - 7}
        fill="#FFF7E8"
        stroke="#9C1C1C"
        strokeWidth={1.2}
        cornerRadius={5}
      />
      <Text
        x={grid.title.x}
        y={grid.title.y + 5.4}
        width={grid.title.width}
        text={grid.title.text}
        align="center"
        fill="#9C1C1C"
        fontFamily={serif}
        fontStyle="900"
        fontSize={17}
        letterSpacing={0}
        shadowColor="#F2D59D"
        shadowBlur={0}
        shadowOffsetY={0.7}
      />

      {grid.cells.map((cell) => (
        <Group key={cell.sign}>
          {/* Body wash, so the cell reads as one object with its header */}
          <Rect
            x={cell.x}
            y={cell.y}
            width={cell.width}
            height={cell.height}
            fill={cell.bodyFill}
            stroke={cell.headerFill}
            strokeWidth={0.4}
            cornerRadius={2}
          />
          {/* Tinted header carrying the sign and its glyph */}
          <Rect
            x={cell.x}
            y={cell.y}
            width={cell.width}
            height={cell.headerHeight}
            fill={cell.headerFill}
            cornerRadius={[2, 2, 0, 0]}
          />
          {/* The glyph sits in a light disc, which reads as a designed mark
              rather than a stray character on a coloured bar. */}
          <Circle
            x={cell.glyphCenterX}
            y={cell.glyphCenterY}
            radius={cell.glyphRadius}
            fill="#FFFFFF"
            opacity={0.9}
          />
          <Text
            x={cell.glyphCenterX - cell.glyphRadius}
            y={cell.glyphCenterY - cell.glyphRadius + 0.6}
            width={cell.glyphRadius * 2}
            height={cell.glyphRadius * 2}
            text={cell.glyph}
            align="center"
            fill={cell.headerFill}
            fontFamily={RASHIFAL_GLYPH_FONT}
            fontSize={cell.glyphRadius * 1.6}
          />
          <Text
            x={cell.glyphCenterX + cell.glyphRadius + 3}
            y={cell.y + 4}
            width={cell.width - (cell.glyphCenterX + cell.glyphRadius + 3 - cell.x) - 3}
            text={cell.sign}
            fill="#FFFFFF"
            fontFamily={serif}
            fontStyle="700"
            fontSize={9}
            wrap="none"
            ellipsis
          />
          {/* The reading. Ragged right — a cell this narrow cannot be
              justified without the word gaps pulling apart. */}
          <Text
            x={cell.textX}
            y={cell.textY}
            width={cell.textWidth}
            height={cell.textHeight}
            text={cell.text}
            fill="#2A2621"
            fontFamily={serif}
            fontSize={7.4}
            lineHeight={1.18}
            align="left"
            wrap="word"
            ellipsis
          />
          {cell.metaText ? (
            <>
              <Rect
                x={cell.metaX - 1}
                y={cell.metaY - 1}
                width={cell.metaWidth + 2}
                height={cell.metaHeight + 1}
                fill="#FFFFFF"
                opacity={0.68}
                cornerRadius={1.5}
              />
              {[
                { text: cell.metaLeftText, x: cell.metaX, align: "left" as const },
                {
                  text: cell.metaCenterText,
                  x: cell.metaX + cell.metaWidth / 3,
                  align: "center" as const,
                },
                {
                  text: cell.metaRightText,
                  x: cell.metaX + (cell.metaWidth / 3) * 2,
                  align: "right" as const,
                },
              ].map((item) => (
                <Text
                  key={`${cell.sign}-${item.align}`}
                  x={item.x}
                  y={cell.metaY}
                  width={cell.metaWidth / 3}
                  height={cell.metaHeight}
                  text={item.text}
                  fill="#7B2E12"
                  fontFamily={sans}
                  fontStyle="700"
                  fontSize={5.3}
                  lineHeight={1}
                  align={item.align}
                  wrap="none"
                  ellipsis
                />
              ))}
            </>
          ) : null}
        </Group>
      ))}
    </Group>
  );
}
