"use client";

import { useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import {
  getYouthUpdateInsideRailGeometry,
  YOUTH_UPDATE_RAIL_FONT_FAMILY,
  YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE,
  YOUTH_UPDATE_RAIL_BODY_FONT_SIZE,
} from "@/engines/MasterPage/YouthUpdateInsideRailGeometry";
import { YOUTH_UPDATE_COLORS } from "@/engines/MasterPage/YouthUpdateMastheadGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { useYouthUpdateInsideRailStore } from "@/store/youthUpdateInsideRailStore";

type YouthUpdateInsideRailProps = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function RailHeadlineLine({
  text,
  x,
  y,
  width,
  fontSize,
  fontFamily,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
}) {
  return (
    <Text
      x={x}
      y={y}
      width={width}
      text={text}
      fontFamily={fontFamily}
      fontSize={fontSize}
      fontStyle="bold"
      fill="#18181b"
      align="center"
    />
  );
}

/**
 * Live-preview render of Youth UPDATE's inside-page "SHORT NEWS" rail —
 * several live headline+body items, each in its own bordered box, stacked
 * under a "SHORT NEWS" title bar. Flowed by YouthUpdateInsideRailGeometry.ts
 * rather than composed article boxes (see that file's doc comment for why).
 * Content comes from youthUpdateInsideRailStore.ts, populated at generation
 * time.
 */
export function YouthUpdateInsideRail({ x, y, width, height }: YouthUpdateInsideRailProps) {
  const items = useYouthUpdateInsideRailStore((state) => state.items);
  const geometry = getYouthUpdateInsideRailGeometry({ x, y, width, height, items });
  const sansSerif = getNewspaperFontStack("sans");
  const [, setFontLoadTick] = useState(0);

  // Tinos isn't part of the shared waitForNewspaperFonts check (it's used
  // nowhere outside this one rail), so it needs its own explicit load --
  // same pattern as the front masthead's Anton wordmark font.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    let active = true;
    void Promise.all([
      document.fonts.load(`700 ${YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE}px "Tinos"`),
      document.fonts.load(`400 ${YOUTH_UPDATE_RAIL_BODY_FONT_SIZE}px "Tinos"`),
    ])
      .then(() => {
        if (active) setFontLoadTick((tick) => tick + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <Group listening={false}>
      <Rect
        x={geometry.titleBar.x}
        y={geometry.titleBar.y}
        width={geometry.titleBar.width}
        height={geometry.titleBar.height}
        fill={YOUTH_UPDATE_COLORS.infoBarFill}
      />
      <Text
        x={geometry.titleBar.x}
        y={geometry.titleBar.y}
        width={geometry.titleBar.width}
        height={geometry.titleBar.height}
        text="SHORT NEWS"
        fontFamily={sansSerif}
        fontSize={geometry.titleBar.height * 0.5}
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
      />
      {geometry.items.map((item, i) => (
        <Group key={i}>
          <Rect
            x={item.box.x}
            y={item.box.y}
            width={item.box.width}
            height={item.box.height}
            stroke={geometry.borderColor}
            strokeWidth={geometry.borderWidth}
          />
          {item.headline.lines.map((line, lineIndex) => (
            <RailHeadlineLine
              key={lineIndex}
              text={line}
              x={item.headline.x}
              y={item.headline.y + lineIndex * geometry.headlineFontSize * geometry.headlineLineHeight}
              width={item.headline.width}
              fontSize={geometry.headlineFontSize}
              fontFamily={YOUTH_UPDATE_RAIL_FONT_FAMILY}
            />
          ))}
          <Text
            x={item.body.x}
            y={item.body.y}
            width={item.body.width}
            height={item.body.height}
            text={item.body.text}
            fontFamily={YOUTH_UPDATE_RAIL_FONT_FAMILY}
            fontSize={geometry.bodyFontSize}
            fontStyle="normal"
            fill="#3a3a3a"
            lineHeight={item.body.lineHeight}
            align="justify"
            wrap="word"
            ellipsis
          />
        </Group>
      ))}
    </Group>
  );
}
