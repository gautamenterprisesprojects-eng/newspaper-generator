"use client";

import { Circle, Group, Rect } from "react-konva";
import { getPressColourBar } from "@/engines/MasterPage/PressColourBarGeometry";
import type { PageMaster } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

type PressColourBarProps = {
  pageMaster: PageMaster;
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

/**
 * Draws the press colour control strip at the foot of the sheet.
 *
 * Geometry comes from `getPressColourBarGeometry` rather than being written out
 * here, because the PDF export rasterises its own canvas instead of this layer
 * tree — the two renderers have to read the same numbers or they drift apart.
 */
export function PressColourBar({ pageMaster }: PressColourBarProps) {
  const { dots, bars } = getPressColourBar({
    pageWidth: toPoints(pageMaster.width),
    pageHeight: toPoints(pageMaster.height),
    contentBottom: toPoints(pageMaster.contentY + pageMaster.contentHeight),
  });

  return (
    <Group listening={false}>
      {bars.map((bar, index) => (
        <Rect
          key={`press-bar-${index}`}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          cornerRadius={bar.cornerRadius}
          fill={bar.fill}
        />
      ))}
      {dots.map((dot, index) => (
        <Circle key={`press-dot-${index}`} x={dot.x} y={dot.y} radius={dot.radius} fill={dot.fill} />
      ))}
    </Group>
  );
}
