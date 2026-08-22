"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  PaintBucket,
  Pilcrow,
  Send,
  SendToBack,
  Type,
  Underline,
} from "lucide-react";
import type { ReactNode } from "react";
import type { EditorObjectType, EditorSelectionBounds, EditorialTextAlignment } from "@/types/editor";

type ObjectFloatingToolbarProps = {
  objectType: EditorObjectType;
  bounds: EditorSelectionBounds;
  selectedCount: number;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onTextColor: () => void;
  onFrameColor: () => void;
  onAlign: (alignment: EditorialTextAlignment) => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
};

const iconButton = (
  title: string,
  onClick: () => void,
  children: ReactNode,
) => (
  <button type="button" title={title} aria-label={title} onClick={onClick}>
    {children}
  </button>
);

export function ObjectFloatingToolbar({
  objectType,
  bounds,
  selectedCount,
  onBold,
  onItalic,
  onUnderline,
  onTextColor,
  onFrameColor,
  onAlign,
  onCopyStyle,
  onPasteStyle,
  onBringForward,
  onSendBackward,
}: ObjectFloatingToolbarProps) {
  return (
    <div
      className="object-floating-toolbar"
      style={{
        left: Math.max(8, bounds.x),
        top: Math.max(8, bounds.y - 42),
      }}
      aria-label={`${objectType} object toolbar`}
    >
      {selectedCount > 1 ? <span className="object-toolbar-count">{selectedCount}</span> : null}
      {iconButton("Bold", onBold, <Bold size={14} />)}
      {iconButton("Italic", onItalic, <Italic size={14} />)}
      {iconButton("Underline", onUnderline, <Underline size={14} />)}
      {iconButton("Text Color", onTextColor, <Type size={14} />)}
      {iconButton("Frame Background", onFrameColor, <PaintBucket size={14} />)}
      <span className="object-toolbar-divider" />
      {iconButton("Align Left", () => onAlign("left"), <AlignLeft size={14} />)}
      {iconButton("Align Center", () => onAlign("center"), <AlignCenter size={14} />)}
      {iconButton("Align Right", () => onAlign("right"), <AlignRight size={14} />)}
      {iconButton("Justify", () => onAlign("justify"), <AlignJustify size={14} />)}
      <span className="object-toolbar-divider" />
      {iconButton("Copy Style", onCopyStyle, <Copy size={14} />)}
      {iconButton("Paste Style", onPasteStyle, <Pilcrow size={14} />)}
      {iconButton("Bring Forward", onBringForward, <Send size={14} />)}
      {iconButton("Send Backward", onSendBackward, <SendToBack size={14} />)}
    </div>
  );
}
