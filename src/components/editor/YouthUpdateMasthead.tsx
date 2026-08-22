"use client";

import { useEffect, useState } from "react";
import { Circle, Group, Image as KonvaImage, Rect, Text } from "react-konva";
import {
  getYouthUpdateMastheadGeometry,
  YOUTH_UPDATE_COLORS,
  YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX,
  YOUTH_UPDATE_WORDMARK_FONT_FAMILY,
} from "@/engines/MasterPage/YouthUpdateMastheadGeometry";
import { YOUTH_UPDATE_REGISTRATION_NUMBER } from "@/engines/MasterPage/YouthUpdateConfig";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { useEditorStore } from "@/store/editorStore";
import { useYouthUpdateTeasers } from "@/store/youthUpdateTeaserStore";

type YouthUpdateMastheadProps = {
  pageWidth: number;
  pageCount: number;
  onRequestImageReplace?: (slotIndex: number, clientX: number, clientY: number) => void;
};

/**
 * One teaser's cutout photo -- "contain"-fit, bottom-aligned, no background
 * fill (the publisher uploads their own pre-cut PNG). Renders nothing at
 * all until an image URL is set and loads, matching the reference's
 * no-background look rather than showing a placeholder box.
 */
function TeaserPhoto({ x, y, width, height, imageUrl, onClick }: { x: number; y: number; width: number; height: number; imageUrl: string; onClick?: (evt: any) => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setImage(null);
    };
    img.src = imageUrl;
    return () => {
      active = false;
    };
  }, [imageUrl]);

  if (!image) return null;

  const isApiPhoto = imageUrl.startsWith("data:image/");
  const scale = isApiPhoto
    ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
    : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = isApiPhoto ? x : x + (width - drawWidth) / 2;
  const drawY = isApiPhoto ? y + (height - drawHeight) / 2 : y + height - drawHeight;

  return (
    <Group clipX={x} clipY={y} clipWidth={width} clipHeight={height} onClick={onClick} onContextMenu={onClick} listening={!!onClick}>
      <KonvaImage image={image} x={drawX} y={drawY} width={drawWidth} height={drawHeight} listening={false} />
    </Group>
  );
}

/**
 * Live-preview render of the Youth UPDATE masthead. Geometry comes from the
 * shared module so this and the PDF export's drawYouthUpdateMastheadToCanvas
 * are the same masthead by construction — see PressColourBar.tsx for the
 * established pattern this follows. Reads the publication profile directly
 * (same fields every other publisher's masthead overlay already uses)
 * rather than threading new props through PageChromeLayer's interface.
 */
export function YouthUpdateMasthead({ pageWidth, pageCount, onRequestImageReplace }: YouthUpdateMastheadProps) {
  const profile = useEditorStore((state) => {
    const activeHeaderSetId = state.document.headerSystem.activeHeaderSetId;
    const profileId = activeHeaderSetId ? state.document.headerSystem.headerSets[activeHeaderSetId]?.publicationProfileId : null;
    return profileId ? state.document.headerSystem.publicationProfiles[profileId] : null;
  });
  const teaserSlots = useYouthUpdateTeasers();

  const now = new Date();
  const geometry = getYouthUpdateMastheadGeometry({
    pageWidth,
    teaserHeadlines: teaserSlots.map((t) => t.headline) as [string, string, string, string],
    teaserLabels: teaserSlots.map((t) => t.label) as [string, string, string, string],
    teaserImageUrls: teaserSlots.map((t) => t.imageUrl) as [string, string, string, string],
    volumeLabel: profile?.volumeLabel || "1",
    issueLabel: profile?.issueLabel?.replace(/\D/g, "") || profile?.issueLabel || "1",
    registrationNumber: YOUTH_UPDATE_REGISTRATION_NUMBER,
    city: profile?.city || "BHOPAL",
    dayName: now.toLocaleDateString("en-IN", { weekday: "long" }),
    dateLabel: now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase(),
    pageCount,
    price: profile?.price || "2.00",
  });
  const sansSerif = getNewspaperFontStack("sans");
  const referenceScale = pageWidth / 1600;
  const condensedFont = `${YOUTH_UPDATE_WORDMARK_FONT_FAMILY}, ${sansSerif}`;
  const taglineWidth = 360 * referenceScale;
  const infoBarFontSize = 23 * referenceScale;
  const [, setFontLoadTick] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    let active = true;
    void document.fonts
      .load(`400 ${geometry.wordmark.fontSize}px "${YOUTH_UPDATE_WORDMARK_FONT_FAMILY}"`)
      .then(() => {
        if (active) setFontLoadTick((tick) => tick + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [geometry.wordmark.fontSize]);

  return (
    <Group listening={false}>
      <Text
        x={geometry.tagline.x - taglineWidth}
        y={geometry.tagline.y}
        width={taglineWidth}
        text={geometry.tagline.text}
        fontFamily="Times New Roman, serif"
        fontSize={YOUTH_UPDATE_TAGLINE_FONT_SIZE_REF_PX * referenceScale}
        fontStyle="italic"
        fill={YOUTH_UPDATE_COLORS.tagline}
        align="right"
      />

      <Text
        x={geometry.wordmark.youth.x}
        y={geometry.wordmark.y}
        text={geometry.wordmark.youth.text}
        fontFamily={condensedFont}
        fontSize={geometry.wordmark.fontSize}
        fontStyle="400"
        letterSpacing={geometry.wordmark.letterSpacing}
        fill={geometry.wordmark.youth.color}
      />
      <Text
        x={geometry.wordmark.update.x}
        y={geometry.wordmark.y}
        text={geometry.wordmark.update.text}
        fontFamily={condensedFont}
        fontSize={geometry.wordmark.fontSize}
        fontStyle="400"
        letterSpacing={geometry.wordmark.letterSpacing}
        fill={geometry.wordmark.update.color}
      />
      <Circle x={geometry.dot.x} y={geometry.dot.y} radius={geometry.dot.radius} fill={YOUTH_UPDATE_COLORS.dot} />

      {geometry.teasers.map((teaser, i) => (
        <Group key={i}>
          <TeaserPhoto
            x={teaser.photo.x}
            y={teaser.photo.y}
            width={teaser.photo.width}
            height={teaser.photo.height}
            imageUrl={teaser.imageUrl}
            onClick={(evt) => onRequestImageReplace?.(i, evt.evt.clientX, evt.evt.clientY)}
          />
          <Text
            x={teaser.headline.x}
            y={teaser.headline.y}
            width={teaser.headline.width}
            height={teaser.headline.height}
            text={teaser.headline.text}
            fontFamily={condensedFont}
            fontSize={18 * referenceScale}
            fontStyle="400"
            fill={YOUTH_UPDATE_COLORS.teaserHeadline}
            align="right"
            lineHeight={1.02}
            wrap="word"
            ellipsis
          />
          <Text
            x={teaser.label.x}
            y={teaser.label.y}
            width={teaser.label.width}
            text={teaser.label.text}
            fontFamily={condensedFont}
            fontSize={15 * referenceScale}
            fontStyle="400"
            fill={YOUTH_UPDATE_COLORS.teaserLabel}
            align="right"
            wrap="none"
          />
        </Group>
      ))}

      {geometry.dividerDots.map((divider, i) => (
        <Group key={i}>
          {divider.ys.map((y, j) => (
            <Circle key={j} x={divider.x} y={y} radius={divider.radius} fill={YOUTH_UPDATE_COLORS.divider} />
          ))}
        </Group>
      ))}

      <Rect
        x={geometry.infoBar.x}
        y={geometry.infoBar.y}
        width={geometry.infoBar.width}
        height={geometry.infoBar.height}
        fill={YOUTH_UPDATE_COLORS.infoBarFill}
      />
      {geometry.infoBar.segments.map((segment, i) => (
        <Text
          key={i}
          x={segment.x}
          y={geometry.infoBar.y + geometry.infoBar.height / 2 - infoBarFontSize / 2}
          width={segment.width}
          text={segment.text}
          fontFamily={condensedFont}
          fontSize={infoBarFontSize}
          fontStyle="400"
          fill={YOUTH_UPDATE_COLORS.infoBarText}
          align={segment.align}
        />
      ))}
    </Group>
  );
}
