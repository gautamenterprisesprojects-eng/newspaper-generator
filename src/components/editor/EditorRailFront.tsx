"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import {
  EDITOR_RAIL_FRONT_ARTWORK_URL,
  EDITOR_RAIL_FRONT_COLORS,
  getEditorRailFrontContainDest,
  resolveEditorRailFrontSvgSource,
  type EditorRailFrontContent,
} from "@/engines/MasterPage/EditorRailFrontGeometry";

export type EditorRailFrontProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  content: EditorRailFrontContent;
};

const loadImage = (src: string, crossOrigin: boolean) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const imageToDataUrl = async (source: string): Promise<string | undefined> => {
  const printable = source.startsWith("http") ? `/api/print-image?url=${encodeURIComponent(source)}` : source;
  const image = await loadImage(printable, /^https?:/i.test(printable));
  if (!image || image.naturalWidth <= 0) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(image, 0, 0);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
};

/**
 * Live-preview twin of drawEditorRailFrontToCanvas: CliffFrontEditorRail8A's
 * left author rail. Resolves the same live-substituted SVG (name/place/
 * designation baked into the artwork's own <text>, portrait swapped into its
 * own <image>) and draws it as a single contain-fitted Konva Image -- no
 * separate overlay Text/Image nodes, so there is nothing that can drift out
 * of step with the artwork's own font/position choices.
 */
export function EditorRailFront({ x, y, width, height, content }: EditorRailFrontProps) {
  const [artwork, setArtwork] = useState<HTMLImageElement | null>(null);
  const box = { x, y, width, height };
  const dest = getEditorRailFrontContainDest(box);

  useEffect(() => {
    let active = true;

    (async () => {
      const photoDataUrl = content.overlayPhoto && content.imageUrl
        ? await imageToDataUrl(content.imageUrl)
        : undefined;
      if (!active) return;

      try {
        const svgSource = await resolveEditorRailFrontSvgSource(EDITOR_RAIL_FRONT_ARTWORK_URL, {
          name: content.name,
          place: content.overlayPlace ? content.place : "",
          designation: content.overlayDesignation ? content.designation : "",
          photoDataUrl,
        });
        if (!active) return;
        const image = await loadImage(svgSource, false);
        if (active) setArtwork(image);
      } catch {
        if (active) setArtwork(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [content.name, content.place, content.designation, content.imageUrl, content.overlayPhoto, content.overlayPlace, content.overlayDesignation]);

  return (
    <Group listening={false}>
      <Rect x={box.x} y={box.y} width={box.width} height={box.height} fill={EDITOR_RAIL_FRONT_COLORS.background} />
      {artwork ? (
        <KonvaImage image={artwork} x={dest.x} y={dest.y} width={dest.width} height={dest.height} />
      ) : null}
    </Group>
  );
}
