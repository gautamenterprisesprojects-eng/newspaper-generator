"use client";

import { useState } from "react";
import { Bold, Eraser, Highlighter, Italic, Palette, Underline } from "lucide-react";
import type { RichTextStyle } from "@/types/RichText";
import { ColorPalettePopover } from "./ColorPalettePopover";

type FloatingTextToolbarProps = {
  visible: boolean;
  x: number;
  y: number;
  selectionLabel: string;
  onApplyStyle: (style: RichTextStyle) => void;
  onClearFormatting: () => void;
};

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 60];
const fontWeights = [400, 500, 600, 700, 800, 900];

export function FloatingTextToolbar({
  visible,
  x,
  y,
  selectionLabel,
  onApplyStyle,
  onClearFormatting,
}: FloatingTextToolbarProps) {
  const [colorPopover, setColorPopover] = useState<"text" | "background" | null>(null);

  if (!visible) {
    return null;
  }

  const applyColor = (color: string) => {
    if (colorPopover === "background") {
      onApplyStyle({ backgroundColor: color });
    } else {
      onApplyStyle({ color });
    }

    setColorPopover(null);
  };

  return (
    <div
      className="floating-text-toolbar"
      style={{ left: x, top: y }}
      onMouseDown={(event) => event.preventDefault()}
      role="toolbar"
      aria-label="Editorial text formatting"
    >
      <span className="toolbar-selection-label">{selectionLabel}</span>
      <button type="button" className="toolbar-icon-button" title="Bold" aria-label="Bold" onClick={() => onApplyStyle({ bold: true })}>
        <Bold size={16} />
      </button>
      <button
        type="button"
        className="toolbar-icon-button"
        title="Italic"
        aria-label="Italic"
        onClick={() => onApplyStyle({ italic: true })}
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        className="toolbar-icon-button"
        title="Underline"
        aria-label="Underline"
        onClick={() => onApplyStyle({ underline: true })}
      >
        <Underline size={16} />
      </button>

      <div className="toolbar-divider" />

      <label className="toolbar-select-field" title="Font Size">
        <span>Size</span>
        <select
          defaultValue=""
          onChange={(event) => {
            const value = Number(event.target.value);
            if (value > 0) {
              onApplyStyle({ fontSize: value });
            }
          }}
        >
          <option value="" disabled>
            --
          </option>
          {fontSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <label className="toolbar-select-field" title="Font Weight">
        <span>Weight</span>
        <select
          defaultValue=""
          onChange={(event) => {
            const value = Number(event.target.value);
            if (value > 0) {
              onApplyStyle({ fontWeight: value });
            }
          }}
        >
          <option value="" disabled>
            --
          </option>
          {fontWeights.map((weight) => (
            <option key={weight} value={weight}>
              {weight}
            </option>
          ))}
        </select>
      </label>

      <div className="toolbar-divider" />

      <div className="toolbar-popover-anchor">
        <button
          type="button"
          className="toolbar-icon-button"
          title="Text Color"
          aria-label="Text Color"
          onClick={() => setColorPopover(colorPopover === "text" ? null : "text")}
        >
          <Palette size={16} />
        </button>
        {colorPopover === "text" ? <ColorPalettePopover onSelect={applyColor} /> : null}
      </div>

      <div className="toolbar-popover-anchor">
        <button
          type="button"
          className="toolbar-icon-button"
          title="Background Highlight"
          aria-label="Background Highlight"
          onClick={() => setColorPopover(colorPopover === "background" ? null : "background")}
        >
          <Highlighter size={16} />
        </button>
        {colorPopover === "background" ? <ColorPalettePopover onSelect={applyColor} /> : null}
      </div>

      <button
        type="button"
        className="toolbar-icon-button"
        title="Clear Formatting"
        aria-label="Clear Formatting"
        onClick={onClearFormatting}
      >
        <Eraser size={16} />
      </button>
    </div>
  );
}
