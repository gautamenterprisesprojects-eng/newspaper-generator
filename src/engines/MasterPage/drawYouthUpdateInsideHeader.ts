import {
  getYouthUpdateInsideHeaderGeometry,
  YOUTH_UPDATE_INSIDE_COLORS,
  YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY,
} from "./YouthUpdateInsideHeaderGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";

/**
 * Paints Youth UPDATE's compact inside-page header onto a 2D canvas -- the
 * export-side twin of YouthUpdateInsideHeader.tsx. The PDF export builds its
 * own canvas rather than rasterising the Konva layer tree, so this has to be
 * drawn here as well, at the same geometry (see
 * drawYouthUpdateMastheadToCanvas in EditorCanvas.tsx for the established
 * pattern this mirrors).
 */
export const drawYouthUpdateInsideHeaderToCanvas = async (
  context: CanvasRenderingContext2D,
  input: { pageWidth: number; city: string; sectionName?: string; dateLabel: string; pageNumber: number },
) => {
  const geometry = getYouthUpdateInsideHeaderGeometry(input);
  const sansSerif = getNewspaperFontStack("sans");
  const condensedFont = `"${YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY}", ${sansSerif}`;

  if (typeof globalThis.document !== "undefined" && globalThis.document.fonts?.load) {
    await globalThis.document.fonts
      .load(`normal ${geometry.wordmark.fontSize}px "${YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY}"`)
      .catch(() => undefined);
  }

  context.save();
  context.textBaseline = "top";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, input.pageWidth, geometry.height);

  context.textAlign = "left";
  context.font = `normal ${geometry.wordmark.fontSize}px ${condensedFont}`;
  context.fillStyle = YOUTH_UPDATE_INSIDE_COLORS.wordmarkDark;
  context.fillText(geometry.wordmark.youth, geometry.wordmark.x, geometry.wordmark.y);
  context.fillStyle = YOUTH_UPDATE_INSIDE_COLORS.wordmarkLight;
  context.fillText(
    geometry.wordmark.update,
    geometry.wordmark.x + geometry.wordmark.youthWidth,
    geometry.wordmark.y,
  );

  context.fillStyle = YOUTH_UPDATE_INSIDE_COLORS.infoBarFill;
  context.fillRect(geometry.cityBar.x, geometry.cityBar.y, geometry.cityBar.width, geometry.cityBar.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${geometry.cityBar.height * 0.42}px ${sansSerif}`;
  context.fillStyle = YOUTH_UPDATE_INSIDE_COLORS.infoBarText;
  context.fillText(
    geometry.cityBar.text,
    geometry.cityBar.x + geometry.cityBar.width / 2,
    geometry.cityBar.y + geometry.cityBar.height / 2,
  );

  context.fillStyle = "#eef0f2";
  context.fillRect(geometry.dateBox.x, geometry.dateBox.y, geometry.dateBox.width, geometry.dateBox.height);
  context.textAlign = "left";
  context.font = `bold ${geometry.dateBox.height * 0.15}px ${sansSerif}`;
  context.fillStyle = "#1a1a1a";
  context.fillText(
    geometry.dateBox.dateText,
    geometry.dateBox.x + geometry.dateBox.height * 0.2,
    geometry.dateBox.y + geometry.dateBox.height / 2,
  );
  context.textAlign = "center";
  context.font = `bold ${geometry.dateBox.height * 0.6}px ${sansSerif}`;
  context.fillText(
    geometry.dateBox.pageNumber,
    geometry.dateBox.x + geometry.dateBox.width - geometry.dateBox.height / 2,
    geometry.dateBox.y + geometry.dateBox.height / 2,
  );

  context.restore();
};
