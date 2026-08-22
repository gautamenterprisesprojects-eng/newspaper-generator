"use client";

import { Group, Line, Text } from "react-konva";
import type { PageMaster } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

type PageFooterProps = {
  pageMaster: PageMaster;
  website?: string;
  pageNumber?: number;
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;

export function PageFooter({
  pageMaster,
  website = "www.thecliffnews.in",
  pageNumber = 1,
}: PageFooterProps) {
  const width = toPoints(pageMaster.width);
  const height = toPoints(pageMaster.height);
  const footerHeight = toPoints(pageMaster.footerHeight);
  const sideInset = toPoints(pageMaster.contentX);
  const y = height - footerHeight;

  return (
    <Group y={y} listening={false}>
      <Line points={[sideInset, 4, width - sideInset, 4]} stroke="#1f1b16" strokeWidth={1} />
      <Text
        x={sideInset}
        y={10}
        width={(width - sideInset * 2) / 2}
        height={14}
        text={website}
        fill="#4f4941"
        fontFamily="Arial"
        fontSize={10}
        wrap="none"
      />
      <Text
        x={sideInset + (width - sideInset * 2) / 2}
        y={10}
        width={(width - sideInset * 2) / 2}
        height={14}
        text={`Page ${pageNumber}`}
        fill="#4f4941"
        fontFamily="Arial"
        fontSize={10}
        align="right"
        wrap="none"
      />
      <Line
        points={[sideInset, footerHeight - 4, width - sideInset, footerHeight - 4]}
        stroke="#1f1b16"
        strokeWidth={0.8}
      />
    </Group>
  );
}
