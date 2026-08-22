"use client";

import { useEffect, useMemo, useState } from "react";

type ColorPalettePopoverProps = {
  onSelect: (color: string) => void;
};

const recentColorsKey = "newspaper-editor-recent-colors";

const quickColors = [
  { label: "Black", value: "#111111" },
  { label: "White", value: "#ffffff" },
  { label: "Red", value: "#d92d20" },
  { label: "Dark Red", value: "#7a271a" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#facc15" },
  { label: "Green", value: "#16a34a" },
  { label: "Dark Green", value: "#166534" },
  { label: "Blue", value: "#2563eb" },
  { label: "Dark Blue", value: "#1e3a8a" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Gray", value: "#6b7280" },
];

const clampRgb = (value: number) => Math.min(Math.max(Math.round(value), 0), 255);

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();

  if (!/^[0-9a-f]{6}$/iu.test(normalized)) {
    return { r: 17, g: 17, b: 17 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clampRgb(channel).toString(16).padStart(2, "0"))
    .join("")}`;

export function ColorPalettePopover({ onSelect }: ColorPalettePopoverProps) {
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [hex, setHex] = useState("#111111");
  const [rgb, setRgb] = useState(() => hexToRgb("#111111"));
  const [opacity, setOpacity] = useState(100);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(recentColorsKey);
      const parsed = saved ? (JSON.parse(saved) as string[]) : [];
      setRecentColors(parsed.filter((color) => typeof color === "string").slice(0, 8));
    } catch {
      setRecentColors([]);
    }
  }, []);

  const selectedColor = useMemo(() => {
    if (opacity >= 100) {
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    return `rgba(${clampRgb(rgb.r)}, ${clampRgb(rgb.g)}, ${clampRgb(rgb.b)}, ${(opacity / 100).toFixed(2)})`;
  }, [opacity, rgb]);

  const commitColor = (color: string) => {
    onSelect(color);
    setRecentColors((previous) => {
      const next = [color, ...previous.filter((candidate) => candidate !== color)].slice(0, 8);
      window.localStorage.setItem(recentColorsKey, JSON.stringify(next));

      return next;
    });
  };

  const updateHex = (value: string) => {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    setHex(normalized);

    if (/^#[0-9a-f]{6}$/iu.test(normalized)) {
      setRgb(hexToRgb(normalized));
    }
  };

  const updateRgb = (channel: "r" | "g" | "b", value: number) => {
    const next = {
      ...rgb,
      [channel]: clampRgb(value),
    };

    setRgb(next);
    setHex(rgbToHex(next.r, next.g, next.b));
  };

  return (
    <div className="color-palette-popover" role="dialog" aria-label="Color palette">
      <div className="color-palette-section">
        <span>Quick Colors</span>
        <div className="color-swatch-grid">
          {quickColors.map((color) => (
            <button
              key={color.value}
              type="button"
              className="color-swatch"
              style={{ backgroundColor: color.value }}
              title={color.label}
              aria-label={color.label}
              onClick={() => commitColor(color.value)}
            />
          ))}
        </div>
      </div>

      {recentColors.length ? (
        <div className="color-palette-section">
          <span>Recent</span>
          <div className="color-swatch-grid">
            {recentColors.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch"
                style={{ backgroundColor: color }}
                title={color}
                aria-label={color}
                onClick={() => commitColor(color)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="color-palette-section">
        <span>Custom</span>
        <input
          className="color-picker-input"
          type="color"
          value={/^#[0-9a-f]{6}$/iu.test(hex) ? hex : "#111111"}
          onChange={(event) => updateHex(event.target.value)}
        />
        <label className="color-value-field">
          HEX
          <input value={hex} onChange={(event) => updateHex(event.target.value)} />
        </label>
        <div className="rgb-grid">
          {(["r", "g", "b"] as const).map((channel) => (
            <label key={channel} className="color-value-field">
              {channel.toUpperCase()}
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[channel]}
                onChange={(event) => updateRgb(channel, Number(event.target.value) || 0)}
              />
            </label>
          ))}
        </div>
        <label className="opacity-control">
          <span>Opacity {opacity}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </label>
        <button type="button" className="color-apply-button" onClick={() => commitColor(selectedColor)}>
          Apply Color
        </button>
      </div>
    </div>
  );
}
