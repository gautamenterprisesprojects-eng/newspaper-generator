"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  EDITOR_RAIL_FRONT_COLORS,
  getEditorRailFrontCoverCrop,
  getEditorRailFrontGeometry,
  type EditorRailFrontContent,
} from "@/engines/MasterPage/EditorRailFrontGeometry";

export type EditorRailFrontProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  content: EditorRailFrontContent;
};

/**
 * Live-preview twin of drawEditorRailFrontToCanvas: CliffFrontEditorRail8A's
 * left red author rail. Furniture, not composed article copy.
 */
export function EditorRailFront({ x, y, width, height, content }: EditorRailFrontProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const sans = getNewspaperFontStack("sans");
  const geometry = getEditorRailFrontGeometry({ x, y, width, height }, content);

  useEffect(() => {
    if (!content.imageUrl) {
      setImage(null);
      return;
    }
    let active = true;
    const img = new window.Image();
    if (/^https?:/i.test(content.imageUrl)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setImage(null);
    };
    img.src = content.imageUrl;
    return () => {
      active = false;
    };
  }, [content.imageUrl]);

  const crop =
    image && image.naturalWidth > 0 && image.naturalHeight > 0
      ? getEditorRailFrontCoverCrop(
          image.naturalWidth,
          image.naturalHeight,
          geometry.photo.width,
          geometry.photo.height,
        )
      : null;

  return (
    <Group listening={false}>
      <Rect
        x={geometry.box.x}
        y={geometry.box.y}
        width={geometry.box.width}
        height={geometry.box.height}
        fill={EDITOR_RAIL_FRONT_COLORS.background}
      />
      {image && crop ? (
        <KonvaImage
          image={image}
          x={geometry.photo.x}
          y={geometry.photo.y}
          width={geometry.photo.width}
          height={geometry.photo.height}
          crop={crop}
        />
      ) : null}
      <Rect
        x={geometry.namePlate.x}
        y={geometry.namePlate.y}
        width={geometry.namePlate.width}
        height={geometry.namePlate.height}
        fill={EDITOR_RAIL_FRONT_COLORS.namePlate}
      />
      <Rect
        x={geometry.accent.x}
        y={geometry.accent.y}
        width={geometry.accent.width}
        height={geometry.accent.height}
        fill={EDITOR_RAIL_FRONT_COLORS.accentBar}
      />
      <Text
        x={geometry.name.x}
        y={geometry.name.y}
        width={geometry.name.width}
        height={geometry.name.height}
        text={geometry.name.text}
        fontFamily={sans}
        fontStyle="700"
        fontSize={geometry.name.fontSize}
        fill={EDITOR_RAIL_FRONT_COLORS.type}
        wrap="none"
        ellipsis
      />
      {geometry.place.text ? (
        <Text
          x={geometry.place.x}
          y={geometry.place.y}
          width={geometry.place.width}
          height={geometry.place.height}
          text={geometry.place.text}
          fontFamily={sans}
          fontStyle="700"
          fontSize={geometry.place.fontSize}
          fill={EDITOR_RAIL_FRONT_COLORS.type}
          wrap="none"
          ellipsis
        />
      ) : null}
      <Group
        x={geometry.designation.x + geometry.designation.width / 2}
        y={geometry.designation.y + geometry.designation.height / 2}
        rotation={-90}
      >
        <Text
          x={-geometry.designation.height / 2}
          y={-geometry.designation.fontSize / 2}
          width={geometry.designation.height}
          height={geometry.designation.fontSize}
          text={geometry.designation.text}
          fontFamily={sans}
          fontStyle="700"
          fontSize={geometry.designation.fontSize}
          fill={EDITOR_RAIL_FRONT_COLORS.type}
          align="center"
          wrap="none"
        />
      </Group>
    </Group>
  );
}
