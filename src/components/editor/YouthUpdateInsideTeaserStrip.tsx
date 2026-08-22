"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import {
  fitYouthUpdateInsideTeaserHeadline,
  getYouthUpdateInsideTeaserStripGeometry,
} from "@/engines/MasterPage/YouthUpdateInsideTeaserGeometry";
import { measureTextWidth } from "@/engines/TypographyEngine/TextMeasure";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { useYouthUpdateTeasers } from "@/store/youthUpdateTeaserStore";
import {
  loadYouthUpdateInsideAuthorsFromPortal,
  useYouthUpdateInsideAuthor,
} from "@/store/youthUpdateInsideAuthorStore";
import { YOUTH_UPDATE_PUBLISHER_ID } from "@/engines/MasterPage/YouthUpdateConfig";
import {
  useYouthUpdateInsideTeaserLiveStore,
  mergeYouthUpdateInsideTeaserCards,
} from "@/store/youthUpdateInsideTeaserLiveStore";

type YouthUpdateInsideTeaserStripProps = {
  pageWidth: number;
  pageNumber?: number;
  onRequestImageReplace?: (slotIndex: number, clientX: number, clientY: number) => void;
};

function CoverPhoto({ x, y, width, height, imageUrl, onClick }: { x: number; y: number; width: number; height: number; imageUrl: string; onClick?: (evt: any) => void }) {
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

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const cropWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
  const cropHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
  const cropX = (image.naturalWidth - cropWidth) / 2;
  const cropY = Math.max(0, (image.naturalHeight - cropHeight) * 0.25);

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={width}
      height={height}
      crop={{ x: cropX, y: cropY, width: cropWidth, height: cropHeight }}
      listening={!!onClick}
      onClick={onClick}
      onContextMenu={onClick}
    />
  );
}

/**
 * Live-preview render of Youth UPDATE's inside-page promo strip. It uses two
 * equal cards, not the front masthead's four image boxes.
 */
export function YouthUpdateInsideTeaserStrip({ pageWidth, pageNumber, onRequestImageReplace }: YouthUpdateInsideTeaserStripProps) {
  const teaserSlots = useYouthUpdateTeasers();
  const liveItems = useYouthUpdateInsideTeaserLiveStore((state) => state.items);
  const author = useYouthUpdateInsideAuthor(pageNumber);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const publisherId = params.get("publisherId")?.trim() || "";
    if (publisherId !== YOUTH_UPDATE_PUBLISHER_ID) return;

    void loadYouthUpdateInsideAuthorsFromPortal({
      apiBase: params.get("apiBase")?.trim() || "http://localhost:8080/api/v1",
      authToken: params.get("authToken")?.trim() || "",
      publisherId,
    });
  }, []);

  const { headlines, labels, imageUrls } = mergeYouthUpdateInsideTeaserCards(teaserSlots, liveItems);
  const geometry = getYouthUpdateInsideTeaserStripGeometry({
    pageWidth,
    headlines,
    labels,
    imageUrls,
    author,
  });
  const sansSerif = getNewspaperFontStack("sans");
  const displaySerif = getNewspaperFontStack("serif");
  const authorFont = "Anton, Arial Narrow, Impact, sans-serif";

  return (
    <Group listening={false}>
      <Rect x={geometry.author.x} y={geometry.author.y} width={geometry.author.width} height={geometry.author.height} fill="#ffffff" />
      <CoverPhoto {...geometry.author.photo} imageUrl={geometry.author.imageUrl} />
      <Rect
        x={geometry.author.nameplate.x}
        y={geometry.author.nameplate.y}
        width={geometry.author.nameplate.width}
        height={geometry.author.nameplate.height}
        fill="#1797d8"
      />
      <Rect
        x={geometry.author.accent.x}
        y={geometry.author.accent.y}
        width={geometry.author.accent.width}
        height={geometry.author.accent.height}
        fill="#f05223"
      />
      <Text
        {...geometry.author.name}
        fontFamily={authorFont}
        fontSize={Math.max(5, geometry.author.name.height * 0.72)}
        fill="#ffffff"
        align="left"
        verticalAlign="middle"
      />
      <Text
        {...geometry.author.designation}
        fontFamily={authorFont}
        fontSize={Math.max(3, geometry.author.designation.height * 0.64)}
        fill="#e6f7ff"
        align="left"
        verticalAlign="middle"
        letterSpacing={0.8}
      />
      {geometry.boxes.map((box, i) => {
        const baseHeadlineFontSize = Math.max(12, box.headline.height * 0.34);
        const headlineFit = fitYouthUpdateInsideTeaserHeadline({
          text: box.headline.text,
          width: box.headline.width,
          height: box.headline.height,
          baseFontSize: baseHeadlineFontSize,
          measure: (value, fontSize) => measureTextWidth({ text: value, fontFamily: displaySerif, fontSize, fontStyle: "bold" }),
        });
        const headlineFontSize = headlineFit.fontSize;
        const bodyFontSize = Math.max(9.2, baseHeadlineFontSize * 0.58);
        return (
        <Group key={i}>
          <Rect
            x={box.headline.x}
            y={geometry.y}
            width={box.photo.x + box.photo.width - box.headline.x}
            height={geometry.height}
            fill="#fffef9"
          />
          <Text
            x={box.headline.x}
            y={box.headline.y}
            width={headlineFit.width}
            scaleX={headlineFit.scaleX}
            height={box.headline.height}
            text={box.headline.text}
            fontFamily={displaySerif}
            fontSize={headlineFontSize}
            fontStyle="bold"
            fill="#1a1a1a"
            align="left"
            lineHeight={1.05}
            wrap="word"
          />
          <Text
            x={box.body.x}
            y={box.body.y}
            width={box.body.width}
            height={box.body.height}
            text={box.body.text}
            fontFamily={displaySerif || sansSerif}
            fontSize={bodyFontSize}
            fill="#111111"
            align="left"
            lineHeight={1.1}
            wrap="word"
          />
          <CoverPhoto
            x={box.photo.x}
            y={box.photo.y}
            width={box.photo.width}
            height={box.photo.height}
            imageUrl={box.imageUrl}
            onClick={(evt) => onRequestImageReplace?.(i, evt.evt.clientX, evt.evt.clientY)}
          />
        </Group>
        );
      })}
      {geometry.dividerXs.map((x, i) => (
        <Line
          key={i}
          points={[x, geometry.y, x, geometry.y + geometry.height]}
          stroke="#128bd3"
          strokeWidth={1.2}
        />
      ))}
      <Line
        points={[geometry.bottomRule.x1, geometry.bottomRule.y, geometry.bottomRule.x2, geometry.bottomRule.y]}
        stroke="#2fb8ee"
        strokeWidth={1.2}
        dash={[1, 2]}
      />
    </Group>
  );
}
