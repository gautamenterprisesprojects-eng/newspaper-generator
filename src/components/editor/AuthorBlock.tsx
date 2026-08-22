"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import { getAuthorBlock } from "@/engines/MasterPage/AuthorBlockGeometry";
import {
  EDITORIAL_COLOURS,
  EDITORIAL_PORTRAIT_FRAME,
  EDITORIAL_RAIL,
} from "@/engines/MasterPage/EditorialPageStyle";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

export type AuthorBlockProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  topOffset: number;
  columnSpan: number;
  portraitUrl: string;
  editorName: string;
  summary: string;
  label: string;
  interactionEnabled?: boolean;
  onRequestReplace?: (clientX: number, clientY: number) => void;
  /** Double-click on the name plate — bounds are box-local (relative to x/y above), matching what the generic inline-text-edit system expects everywhere else. */
  onEditName?: (bounds: { x: number; y: number; width: number; height: number }) => void;
};

/**
 * The writer's rail on a signed editorial piece, as page 8 sets it: a section
 * label, the portrait, a solid red name plate, then the summary quoted between
 * oversized quotation marks.
 *
 * Furniture, not composed copy. Geometry comes from `getAuthorBlock`, which the
 * export canvas draws from as well, so the screen and the printed sheet cannot
 * drift apart.
 */
/**
 * The four L-shaped corner marks of the bracket frame, as Konva point arrays.
 *
 * Shared with the export canvas through `getCornerBracketPoints` in the geometry
 * module would be neater, but the arms are pure decoration derived from the
 * picture rect, so both renderers compute them the same way from the same
 * constants.
 */
const getCornerBracketPoints = (rect: { x: number; y: number; width: number; height: number }) => {
  const { armFraction, offset } = EDITORIAL_PORTRAIT_FRAME.cornerBrackets;
  const arm = Math.min(rect.width, rect.height) * armFraction;
  const left = rect.x - offset;
  const right = rect.x + rect.width + offset;
  const top = rect.y - offset;
  const bottom = rect.y + rect.height + offset;

  return [
    [left + arm, top, left, top, left, top + arm],
    [right - arm, top, right, top, right, top + arm],
    [left, bottom - arm, left, bottom, left + arm, bottom],
    [right, bottom - arm, right, bottom, right - arm, bottom],
  ];
};

export function AuthorBlock({
  x,
  y,
  width,
  height,
  topOffset,
  columnSpan,
  portraitUrl,
  editorName,
  summary,
  label,
  interactionEnabled = false,
  onRequestReplace,
  onEditName,
}: AuthorBlockProps) {
  const [portrait, setPortrait] = useState<HTMLImageElement | null>(null);
  const serif = getNewspaperFontStack("serif");

  useEffect(() => {
    if (!portraitUrl) {
      setPortrait(null);
      return;
    }

    let active = true;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (active) setPortrait(image);
    };
    image.onerror = () => {
      if (active) setPortrait(null);
    };
    image.src = portraitUrl;

    return () => {
      active = false;
    };
  }, [portraitUrl]);

  const hasSummary = Boolean(summary.trim());
  const block = getAuthorBlock({ x, y, width, height, topOffset, columnSpan, hasSummary });

  return (
    <Group>
      <Group listening={false}>
      {/* Section label — सम्पादकीय / विचार मंथन — in italic display type. */}
      {label ? (
        <Text
          x={block.label.x}
          y={block.label.y}
          width={block.label.width}
          height={block.label.height}
          text={label}
          fill={EDITORIAL_COLOURS.ink}
          fontFamily={serif}
          fontStyle="italic 700"
          fontSize={EDITORIAL_RAIL.labelFontSize}
          align="center"
          wrap="none"
          ellipsis
        />
      ) : null}

      {/* Portrait. The frame is drawn whether or not the image has loaded, so
          the rail keeps its shape rather than collapsing mid-load. */}
      <Rect
        x={block.portrait.x}
        y={block.portrait.y}
        width={block.portrait.width}
        height={block.portrait.height}
        fill="#EFEBE3"
      />
      {portrait ? (
        <KonvaImage
          image={portrait}
          x={block.portrait.x}
          y={block.portrait.y}
          width={block.portrait.width}
          height={block.portrait.height}
        />
      ) : null}

      {/* The frame goes over the picture, and the two rails wear different
          ones — see EDITORIAL_PORTRAIT_FRAME. */}
      {block.frameKind === "doubleRule" ? (
        <>
          <Rect
            x={block.portrait.x}
            y={block.portrait.y}
            width={block.portrait.width}
            height={block.portrait.height}
            stroke={EDITORIAL_PORTRAIT_FRAME.doubleRule.colour}
            strokeWidth={EDITORIAL_PORTRAIT_FRAME.doubleRule.outerWidth}
          />
          <Rect
            x={block.portrait.x + EDITORIAL_PORTRAIT_FRAME.doubleRule.innerInset}
            y={block.portrait.y + EDITORIAL_PORTRAIT_FRAME.doubleRule.innerInset}
            width={Math.max(0, block.portrait.width - EDITORIAL_PORTRAIT_FRAME.doubleRule.innerInset * 2)}
            height={Math.max(0, block.portrait.height - EDITORIAL_PORTRAIT_FRAME.doubleRule.innerInset * 2)}
            stroke={EDITORIAL_PORTRAIT_FRAME.doubleRule.colour}
            strokeWidth={EDITORIAL_PORTRAIT_FRAME.doubleRule.innerWidth}
          />
        </>
      ) : (
        getCornerBracketPoints(block.portrait).map((points, index) => (
          <Line
            key={index}
            points={points}
            stroke={EDITORIAL_PORTRAIT_FRAME.cornerBrackets.colour}
            strokeWidth={EDITORIAL_PORTRAIT_FRAME.cornerBrackets.width}
            lineCap="square"
          />
        ))
      )}

      {/* Name plate: white type on solid accent, the full width of the rail. */}
      <Rect
        x={block.namePlate.x}
        y={block.namePlate.y}
        width={block.namePlate.width}
        height={block.namePlate.height}
        fill={EDITORIAL_COLOURS.accent}
      />
      <Text
        x={block.namePlate.x}
        y={block.namePlate.y + (block.namePlate.height - EDITORIAL_RAIL.namePlateFontSize) / 2}
        width={block.namePlate.width}
        text={editorName}
        fill={EDITORIAL_COLOURS.onAccent}
        fontFamily={serif}
        fontStyle="700"
        fontSize={EDITORIAL_RAIL.namePlateFontSize}
        align="center"
        wrap="none"
        ellipsis
      />

      {/* The summary, quoted. Centred and ragged — the rail is far too narrow
          to justify without the word gaps pulling apart. */}
      {hasSummary && block.summary.height > 0 ? (
        <>
          <Text
            x={block.openQuote.x}
            y={block.openQuote.y}
            width={block.openQuote.width}
            text={"“"}
            fill={EDITORIAL_COLOURS.quoteGlyph}
            fontFamily={serif}
            fontStyle="700"
            fontSize={EDITORIAL_RAIL.quoteFontSize}
            align="center"
          />
          <Text
            x={block.summary.x}
            y={block.summary.y}
            width={block.summary.width}
            height={block.summary.height}
            text={summary}
            fill={EDITORIAL_COLOURS.ink}
            fontFamily={serif}
            fontSize={EDITORIAL_RAIL.summaryFontSize}
            fontStyle={EDITORIAL_RAIL.summaryFontStyle}
            lineHeight={EDITORIAL_RAIL.summaryLineHeight}
            align="center"
            wrap="word"
            ellipsis
          />
          <Text
            x={block.closeQuote.x}
            y={block.closeQuote.y}
            width={block.closeQuote.width}
            text={"”"}
            fill={EDITORIAL_COLOURS.quoteGlyph}
            fontFamily={serif}
            fontStyle="700"
            fontSize={EDITORIAL_RAIL.quoteFontSize}
            align="center"
          />
        </>
      ) : null}
      </Group>
      {interactionEnabled && onRequestReplace ? (
        <Rect
          x={block.portrait.x}
          y={block.portrait.y}
          width={block.portrait.width}
          height={block.portrait.height}
          fill="rgba(255,255,255,0.001)"
          onMouseEnter={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = "pointer";
          }}
          onMouseLeave={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = "default";
          }}
          onClick={(event) => {
            event.cancelBubble = true;
            onRequestReplace(event.evt.clientX, event.evt.clientY);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            const touchPoint = event.evt.changedTouches?.[0];
            onRequestReplace(touchPoint?.clientX ?? 0, touchPoint?.clientY ?? 0);
          }}
        />
      ) : null}
      {interactionEnabled && onEditName ? (
        <Rect
          x={block.namePlate.x}
          y={block.namePlate.y}
          width={block.namePlate.width}
          height={block.namePlate.height}
          fill="rgba(255,255,255,0.001)"
          onMouseEnter={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = "text";
          }}
          onMouseLeave={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = "default";
          }}
          onDblClick={(event) => {
            event.cancelBubble = true;
            onEditName({
              x: block.namePlate.x - x,
              y: block.namePlate.y - y,
              width: block.namePlate.width,
              height: block.namePlate.height,
            });
          }}
          onDblTap={(event) => {
            event.cancelBubble = true;
            onEditName({
              x: block.namePlate.x - x,
              y: block.namePlate.y - y,
              width: block.namePlate.width,
              height: block.namePlate.height,
            });
          }}
        />
      ) : null}
    </Group>
  );
}
