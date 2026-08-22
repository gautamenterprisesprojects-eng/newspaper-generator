"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import { YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL } from "@/engines/MasterPage/YouthUpdateConfig";

export type YouthUpdateEditorialRailImageProps = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Youth UPDATE's own editor photo + "EDITORIAL" banner, drawn hardcoded over
 * story 1's box on their front page -- furniture, not composed article
 * content. See drawYouthUpdateEditorialRailToCanvas for the PDF export's
 * twin.
 *
 * Fitted with "contain", not the app's usual cover-crop: the source image is
 * proportionally taller than this box, and the whole point of a hardcoded
 * portrait + banner is that both ends stay visible -- cropping the top of
 * the photo or the bottom of "EDITORIAL" would defeat it. The box's own
 * blue fills whatever sliver is left on the sides instead.
 */
export function YouthUpdateEditorialRailImage({ x, y, width, height }: YouthUpdateEditorialRailImageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setImage(null);
    };
    img.src = YOUTH_UPDATE_EDITORIAL_RAIL_IMAGE_URL;

    return () => {
      active = false;
    };
  }, []);

  if (!image) {
    // Keeps the rail's shape (and the page's blue accent) while the image
    // loads, rather than leaving a hole -- matches AuthorBlock's own
    // ground-first pattern for its portrait.
    return <Rect x={x} y={y} width={width} height={height} fill="#1d5fa8" listening={false} />;
  }

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={width} height={height} fill="#1d5fa8" />
      <KonvaImage image={image} x={drawX} y={drawY} width={drawWidth} height={drawHeight} />
    </Group>
  );
}
