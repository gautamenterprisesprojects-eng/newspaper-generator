"use client";

import { Group, Rect, Text } from "react-konva";
import type { ArticleLayoutTextBlock, FactBoxLayout } from "@/types/editor";
import { layoutFrameTextBlock } from "@/engines/FrameLayout/FrameLayoutEngine";

type FactBoxProps = {
  layout: FactBoxLayout;
};

const renderTextBlock = (block: ArticleLayoutTextBlock) => {
  const frameLayout = layoutFrameTextBlock(block);
  const displayBlock = frameLayout.block;
  const frameBounds = frameLayout.frameBounds;

  return (
    <Group>
      {displayBlock.containerStyle && frameBounds ? (
      <Rect
        x={frameBounds.x}
        y={frameBounds.y}
        width={frameBounds.width}
        height={frameBounds.height}
        fill={displayBlock.containerStyle.containerBackgroundColor === "transparent" ? undefined : displayBlock.containerStyle.containerBackgroundColor}
        opacity={displayBlock.containerStyle.containerOpacity}
        stroke={displayBlock.containerStyle.containerBorderWidth > 0 ? displayBlock.containerStyle.containerBorderColor : undefined}
        strokeWidth={displayBlock.containerStyle.containerBorderWidth}
        dash={frameLayout.borderDash}
        cornerRadius={
          displayBlock.containerStyle.mode === "pill"
            ? frameBounds.height / 2
            : displayBlock.containerStyle.containerBorderRadius
        }
        listening={false}
      />
    ) : null}
    {displayBlock.lineBoxes.map((line, index) =>
      line.segments && line.segments.length > 0 ? (
        <Group key={`${line.text}-${index}`}>
          {line.segments.map((segment, segmentIndex) =>
            segment.style.backgroundColor ? (
              <Rect
                key={`${segment.text}-${index}-${segmentIndex}-background`}
                x={segment.x}
                y={segment.y}
                width={segment.width}
                height={segment.height}
                fill={segment.style.backgroundColor}
                listening={false}
              />
            ) : null,
          )}
          {line.segments.map((segment, segmentIndex) => (
            <Text
              key={`${segment.text}-${index}-${segmentIndex}`}
              x={segment.x}
              y={segment.y}
              width={segment.width}
              height={segment.height}
              text={segment.text}
              {...segment.style}
              textDecoration={segment.style.textDecoration}
              wrap="none"
             listening={false} perfectDrawEnabled={false} />
          ))}
        </Group>
      ) : (
        <Text
          key={`${line.text}-${index}`}
          x={line.x}
          y={line.y}
          width={line.width}
          height={line.height}
          text={line.text}
          {...line.style}
          textDecoration={line.style.textDecoration}
          wrap="none"
         listening={false} perfectDrawEnabled={false} />
      ),
    )}
    </Group>
  );
};

export function FactBox({ layout }: FactBoxProps) {
  return (
    <Group>
      <Rect
        x={layout.x}
        y={layout.y}
        width={layout.width}
        height={layout.height}
        fill={layout.fill}
        stroke={layout.stroke}
        strokeWidth={layout.strokeWidth}
        cornerRadius={layout.borderRadius}
       listening={false} perfectDrawEnabled={false} />
      {renderTextBlock(layout.headline)}
      {layout.bullets.map((bullet, index) => (
        <Group key={`fact-box-bullet-${index}`}>{renderTextBlock(bullet)}</Group>
      ))}
    </Group>
  );
}
