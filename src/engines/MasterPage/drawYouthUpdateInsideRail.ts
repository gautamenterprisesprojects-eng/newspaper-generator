import {
  getYouthUpdateInsideRailGeometry,
  YOUTH_UPDATE_RAIL_FONT_FAMILY,
  YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE,
  YOUTH_UPDATE_RAIL_BODY_FONT_SIZE,
} from "./YouthUpdateInsideRailGeometry";
import { YOUTH_UPDATE_COLORS } from "./YouthUpdateMastheadGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import type { YouthUpdateInsideRailItem } from "@/store/youthUpdateInsideRailStore";

/** Word-wraps text inside a canvas context, clipped to a maximum height -- the manual equivalent of Konva Text's wrap+height+ellipsis clipping. */
const fillWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  lineHeight: number,
  justify = false,
) => {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  const bottom = y + height;
  const drawLine = (lineText: string, lineBottom: number, forceJustify: boolean) => {
    if (!forceJustify) {
      context.fillText(lineText, x, lineBottom);
      return;
    }
    const lineWords = lineText.trim().split(/\s+/).filter(Boolean);
    if (lineWords.length < 2) {
      context.fillText(lineText, x, lineBottom);
      return;
    }
    const naturalWidth = context.measureText(lineText).width;
    const extraSpace = Math.max(0, width - naturalWidth);
    const extraPerGap = Math.min(extraSpace / (lineWords.length - 1), context.measureText("m").width * 0.8);
    let cursorX = x;
    for (const word of lineWords) {
      context.fillText(word, cursorX, lineBottom);
      cursorX += context.measureText(word).width + context.measureText(" ").width + extraPerGap;
    }
  };

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > width && line) {
      if (lineY + lineHeight > bottom) return;
      drawLine(line, lineY, justify);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line && lineY + lineHeight <= bottom + 0.5) {
    drawLine(line, lineY, false);
  }
};

/**
 * Paints Youth UPDATE's inside-page "SHORT NEWS" rail onto a 2D canvas --
 * the export-side twin of YouthUpdateInsideRail.tsx. See
 * drawYouthUpdateMastheadToCanvas (EditorCanvas.tsx) for the established
 * pattern this mirrors.
 *
 * Async, and awaits Tinos loading *before* computing the geometry -- the
 * geometry's own text measurement runs synchronously the moment it's
 * called, so if Tinos weren't loaded yet the box would be measured against
 * a fallback font's metrics and drawn with Tinos, the same
 * measure-vs-render mismatch this rail already had to fix once for its
 * headline line-height.
 */
export const drawYouthUpdateInsideRailToCanvas = async (
  context: CanvasRenderingContext2D,
  input: { x: number; y: number; width: number; height: number; items: YouthUpdateInsideRailItem[] },
) => {
  if (typeof globalThis.document !== "undefined" && globalThis.document.fonts?.load) {
    await Promise.all([
      globalThis.document.fonts.load(`700 ${YOUTH_UPDATE_RAIL_HEADLINE_FONT_SIZE}px "Tinos"`),
      globalThis.document.fonts.load(`400 ${YOUTH_UPDATE_RAIL_BODY_FONT_SIZE}px "Tinos"`),
    ]).catch(() => undefined);
  }

  const geometry = getYouthUpdateInsideRailGeometry(input);
  const sansSerif = getNewspaperFontStack("sans");

  context.save();
  context.textBaseline = "top";
  context.textAlign = "left";

  context.fillStyle = YOUTH_UPDATE_COLORS.infoBarFill;
  context.fillRect(geometry.titleBar.x, geometry.titleBar.y, geometry.titleBar.width, geometry.titleBar.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${geometry.titleBar.height * 0.5}px ${sansSerif}`;
  context.fillStyle = "#ffffff";
  context.fillText(
    "SHORT NEWS",
    geometry.titleBar.x + geometry.titleBar.width / 2,
    geometry.titleBar.y + geometry.titleBar.height / 2,
  );
  context.textAlign = "left";
  context.textBaseline = "top";

  for (const item of geometry.items) {
    context.strokeStyle = geometry.borderColor;
    context.lineWidth = geometry.borderWidth;
    context.strokeRect(item.box.x, item.box.y, item.box.width, item.box.height);

    context.font = `bold ${geometry.headlineFontSize}px ${YOUTH_UPDATE_RAIL_FONT_FAMILY}`;
    context.fillStyle = "#18181b";
    const drawHeadlineLine = (lineText: string, lineY: number) => {
      const textWidth = context.measureText(lineText).width;
      context.fillText(lineText, item.headline.x + Math.max(0, item.headline.width - textWidth) / 2, lineY);
    };
    item.headline.lines.slice(0, 2).forEach((line, lineIndex) => {
      drawHeadlineLine(line, item.headline.y + lineIndex * geometry.headlineFontSize * geometry.headlineLineHeight);
    });

    context.font = `normal ${geometry.bodyFontSize}px ${YOUTH_UPDATE_RAIL_FONT_FAMILY}`;
    context.fillStyle = "#3a3a3a";
    fillWrappedText(
      context,
      item.body.text,
      item.body.x,
      item.body.y,
      item.body.width,
      item.body.height,
      geometry.bodyFontSize * item.body.lineHeight,
      true,
    );
  }

  context.restore();
};
