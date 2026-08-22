"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import { YOUTH_UPDATE_SHORT_NEWS_IMAGE_URL } from "@/engines/MasterPage/YouthUpdateConfig";

export type YouthUpdateShortNewsBannerProps = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Youth UPDATE's "SHORT NEWS" section banner, painted hardcoded across the
 * top of story 3's box (their front page only) -- furniture, not composed
 * article content. The real headline/byline/body still flow normally below
 * it; editorStore.ts reserves the space for this banner via the headline's
 * own `containerStyles.framePaddingTop` (see isYouthUpdateShortNewsSlot),
 * since composeArticleBox.ts's headline is otherwise always pinned to a
 * fixed top inset regardless of any image. See
 * drawYouthUpdateShortNewsBannerToCanvas for the PDF export's twin.
 *
 * height is sized to the banner's own aspect ratio (1600x551) by the
 * caller, so this fills its box exactly with no crop needed.
 */
export function YouthUpdateShortNewsBanner({ x, y, width, height }: YouthUpdateShortNewsBannerProps) {
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
    img.src = YOUTH_UPDATE_SHORT_NEWS_IMAGE_URL;

    return () => {
      active = false;
    };
  }, []);

  if (!image) return null;

  return (
    <Group listening={false}>
      <KonvaImage image={image} x={x} y={y} width={width} height={height} />
    </Group>
  );
}
