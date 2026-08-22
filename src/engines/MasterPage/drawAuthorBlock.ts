import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { getAuthorBlock } from "./AuthorBlockGeometry";
import {
  EDITORIAL_COLOURS,
  EDITORIAL_PORTRAIT_FRAME,
  EDITORIAL_RAIL,
} from "./EditorialPageStyle";

/**
 * Paints the editorial writer's rail onto a 2D canvas.
 *
 * The PDF export builds its own canvas rather than rasterising the Konva layer
 * tree, so this is the export-side twin of the `AuthorBlock` component. Both
 * read `getAuthorBlock`, so the only thing that can differ between screen and
 * sheet is the drawing calls — not the layout.
 *
 * Async because the portrait has to be decoded before it can be drawn; the
 * export awaits each story in turn, so this fits its existing flow.
 */
export const drawAuthorBlockToCanvas = async (
  context: CanvasRenderingContext2D,
  {
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
  }: {
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
  },
) => {
  const hasSummary = Boolean(summary.trim());
  const block = getAuthorBlock({ x, y, width, height, topOffset, columnSpan, hasSummary });
  const serif = getNewspaperFontStack("serif");

  context.save();
  context.textBaseline = "top";

  // Section label.
  if (label) {
    context.fillStyle = EDITORIAL_COLOURS.ink;
    context.font = `italic 700 ${EDITORIAL_RAIL.labelFontSize}px ${serif}`;
    context.textAlign = "center";
    context.fillText(
      label,
      block.label.x + block.label.width / 2,
      block.label.y,
      Math.max(1, block.label.width),
    );
  }

  // Picture ground first, so the rail keeps its shape even if the image fails.
  context.fillStyle = "#EFEBE3";
  context.fillRect(block.portrait.x, block.portrait.y, block.portrait.width, block.portrait.height);

  if (portraitUrl) {
    const portrait = await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      // A portrait that will not load must not fail the whole page export.
      image.onerror = () => resolve(null);
      image.src = portraitUrl;
    });

    if (portrait) {
      context.drawImage(
        portrait,
        block.portrait.x,
        block.portrait.y,
        block.portrait.width,
        block.portrait.height,
      );
    }
  }

  // The frame goes over the picture, and the two rails wear different ones.
  if (block.frameKind === "doubleRule") {
    const { outerWidth, innerWidth, innerInset, colour } = EDITORIAL_PORTRAIT_FRAME.doubleRule;
    context.strokeStyle = colour;
    context.lineWidth = outerWidth;
    context.strokeRect(block.portrait.x, block.portrait.y, block.portrait.width, block.portrait.height);
    context.lineWidth = innerWidth;
    context.strokeRect(
      block.portrait.x + innerInset,
      block.portrait.y + innerInset,
      Math.max(0, block.portrait.width - innerInset * 2),
      Math.max(0, block.portrait.height - innerInset * 2),
    );
  } else {
    const { width: strokeWidth, armFraction, offset, colour } = EDITORIAL_PORTRAIT_FRAME.cornerBrackets;
    const arm = Math.min(block.portrait.width, block.portrait.height) * armFraction;
    const left = block.portrait.x - offset;
    const right = block.portrait.x + block.portrait.width + offset;
    const top = block.portrait.y - offset;
    const bottom = block.portrait.y + block.portrait.height + offset;

    context.strokeStyle = colour;
    context.lineWidth = strokeWidth;
    context.lineCap = "square";

    for (const [ax, ay, bx, by, cx, cy] of [
      [left + arm, top, left, top, left, top + arm],
      [right - arm, top, right, top, right, top + arm],
      [left, bottom - arm, left, bottom, left + arm, bottom],
      [right, bottom - arm, right, bottom, right - arm, bottom],
    ]) {
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      context.lineTo(cx, cy);
      context.stroke();
    }
  }

  // Name plate: white type on solid accent.
  context.fillStyle = EDITORIAL_COLOURS.accent;
  context.fillRect(
    block.namePlate.x,
    block.namePlate.y,
    block.namePlate.width,
    block.namePlate.height,
  );
  context.fillStyle = EDITORIAL_COLOURS.onAccent;
  context.font = `700 ${EDITORIAL_RAIL.namePlateFontSize}px ${serif}`;
  context.textAlign = "center";
  context.fillText(
    editorName,
    block.namePlate.x + block.namePlate.width / 2,
    block.namePlate.y + (block.namePlate.height - EDITORIAL_RAIL.namePlateFontSize) / 2,
    Math.max(1, block.namePlate.width),
  );

  // Summary, quoted. Wrapped and centred by hand and clipped to the rail —
  // canvas has no wrapping of its own, and the rail must never spill into the
  // copy beside it.
  if (hasSummary && block.summary.height > 0) {
    context.fillStyle = EDITORIAL_COLOURS.quoteGlyph;
    context.font = `700 ${EDITORIAL_RAIL.quoteFontSize}px ${serif}`;
    context.fillText("“", block.openQuote.x + block.openQuote.width / 2, block.openQuote.y);

    context.fillStyle = EDITORIAL_COLOURS.ink;
    context.font = `${EDITORIAL_RAIL.summaryFontStyle} ${EDITORIAL_RAIL.summaryFontSize}px ${serif}`;
    const lineHeight = EDITORIAL_RAIL.summaryFontSize * EDITORIAL_RAIL.summaryLineHeight;
    const maxLines = Math.max(1, Math.floor(block.summary.height / lineHeight));
    const centreX = block.summary.x + block.summary.width / 2;
    let line = "";
    let lineIndex = 0;

    for (const word of summary.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;

      if (context.measureText(candidate).width <= block.summary.width || !line) {
        line = candidate;
        continue;
      }

      context.fillText(line, centreX, block.summary.y + lineIndex * lineHeight);
      lineIndex += 1;
      line = word;

      if (lineIndex >= maxLines) {
        line = "";
        break;
      }
    }

    if (line && lineIndex < maxLines) {
      context.fillText(line, centreX, block.summary.y + lineIndex * lineHeight);
    }

    context.fillStyle = EDITORIAL_COLOURS.quoteGlyph;
    context.font = `700 ${EDITORIAL_RAIL.quoteFontSize}px ${serif}`;
    context.fillText("”", block.closeQuote.x + block.closeQuote.width / 2, block.closeQuote.y);
  }

  context.restore();
};
