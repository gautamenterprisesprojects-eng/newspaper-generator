"use client";

import { Group, Rect, Text } from "react-konva";
import {
  getYouthUpdateInsideHeaderGeometry,
  YOUTH_UPDATE_INSIDE_COLORS,
  YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY,
} from "@/engines/MasterPage/YouthUpdateInsideHeaderGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { useEditorStore } from "@/store/editorStore";

type YouthUpdateInsideHeaderProps = {
  pageWidth: number;
  pageNumber: number;
  sectionName?: string;
};

/**
 * Live-preview render of Youth UPDATE's compact inside-page header. Geometry
 * comes from the shared module so this and the PDF export's
 * drawYouthUpdateInsideHeaderToCanvas are the same header by construction —
 * see YouthUpdateMasthead.tsx for the established pattern this follows.
 */
export function YouthUpdateInsideHeader({ pageWidth, pageNumber, sectionName }: YouthUpdateInsideHeaderProps) {
  const profile = useEditorStore((state) => {
    const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;
    const profileId = activeHeaderSetId
      ? state.document.headerSystem.headerSets[activeHeaderSetId]?.publicationProfileId
      : null;
    return profileId ? state.document.headerSystem.publicationProfiles[profileId] : null;
  });

  const now = new Date();
  const geometry = getYouthUpdateInsideHeaderGeometry({
    pageWidth,
    city: profile?.city || "BHOPAL",
    sectionName,
    dateLabel: now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase(),
    pageNumber,
  });
  const sansSerif = getNewspaperFontStack("sans");
  const condensedFont = `${YOUTH_UPDATE_INSIDE_WORDMARK_FONT_FAMILY}, ${sansSerif}`;

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={pageWidth} height={geometry.height} fill="#ffffff" />
      <Text
        x={geometry.wordmark.x}
        y={geometry.wordmark.y}
        text={geometry.wordmark.youth}
        fontFamily={condensedFont}
        fontSize={geometry.wordmark.fontSize}
        fontStyle="normal"
        fill={YOUTH_UPDATE_INSIDE_COLORS.wordmarkDark}
      />
      <Text
        x={geometry.wordmark.x + geometry.wordmark.youthWidth}
        y={geometry.wordmark.y}
        text={geometry.wordmark.update}
        fontFamily={condensedFont}
        fontSize={geometry.wordmark.fontSize}
        fontStyle="normal"
        fill={YOUTH_UPDATE_INSIDE_COLORS.wordmarkLight}
      />

      <Rect
        x={geometry.cityBar.x}
        y={geometry.cityBar.y}
        width={geometry.cityBar.width}
        height={geometry.cityBar.height}
        fill={YOUTH_UPDATE_INSIDE_COLORS.infoBarFill}
      />
      <Text
        x={geometry.cityBar.x}
        y={geometry.cityBar.y}
        width={geometry.cityBar.width}
        height={geometry.cityBar.height}
        text={geometry.cityBar.text}
        fontFamily={sansSerif}
        fontSize={geometry.cityBar.height * 0.42}
        fontStyle="bold"
        fill={YOUTH_UPDATE_INSIDE_COLORS.infoBarText}
        align="center"
        verticalAlign="middle"
      />

      <Rect
        x={geometry.dateBox.x}
        y={geometry.dateBox.y}
        width={geometry.dateBox.width}
        height={geometry.dateBox.height}
        fill="#eef0f2"
      />
      <Text
        x={geometry.dateBox.x + geometry.dateBox.height * 0.2}
        y={geometry.dateBox.y}
        width={geometry.dateBox.width - geometry.dateBox.height * 1.1}
        height={geometry.dateBox.height}
        text={geometry.dateBox.dateText}
        fontFamily={sansSerif}
        fontSize={geometry.dateBox.height * 0.15}
        fontStyle="bold"
        fill="#1a1a1a"
        align="left"
        verticalAlign="middle"
        wrap="none"
        ellipsis
      />
      <Text
        x={geometry.dateBox.x + geometry.dateBox.width - geometry.dateBox.height}
        y={geometry.dateBox.y}
        width={geometry.dateBox.height}
        height={geometry.dateBox.height}
        text={geometry.dateBox.pageNumber}
        fontFamily={sansSerif}
        fontSize={geometry.dateBox.height * 0.6}
        fontStyle="bold"
        fill="#1a1a1a"
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
