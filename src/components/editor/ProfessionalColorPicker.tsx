"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Hsv = {
  h: number;
  s: number;
  v: number;
};

type ProfessionalColorPickerProps = {
  value: string;
  opacity?: number;
  onChange: (value: string) => void;
  onOpacityChange?: (value: number) => void;
};

const newspaperPalette = ["#111111", "#3d3830", "#6b6257", "#b42318", "#8f1d14", "#1f5f86", "#0d5f75", "#f2e6c9"];
const brandPalette = ["#000000", "#ffffff", "#d32f2f", "#b42318", "#1565c0", "#0d5f75", "#f6c343", "#fff3bf"];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const toHexPart = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
const rgbToHex = ({ r, g, b }: Rgb) => `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;

const hexToRgb = (hex: string): Rgb => {
  const normalized = hex.trim().replace("#", "");
  const safe = /^[0-9a-f]{6}$/iu.test(normalized) ? normalized : "111111";

  return {
    r: Number.parseInt(safe.slice(0, 2), 16),
    g: Number.parseInt(safe.slice(2, 4), 16),
    b: Number.parseInt(safe.slice(4, 6), 16),
  };
};

const rgbToHsv = ({ r, g, b }: Rgb): Hsv => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const s = max === 0 ? 0 : delta / max;
  let h = 0;

  if (delta !== 0) {
    if (max === red) {
      h = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      h = 60 * ((blue - red) / delta + 2);
    } else {
      h = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s,
    v: max,
  };
};

const hsvToRgb = ({ h, s, v }: Hsv): Rgb => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb = { r: 0, g: 0, b: 0 };

  if (h < 60) {
    rgb = { r: c, g: x, b: 0 };
  } else if (h < 120) {
    rgb = { r: x, g: c, b: 0 };
  } else if (h < 180) {
    rgb = { r: 0, g: c, b: x };
  } else if (h < 240) {
    rgb = { r: 0, g: x, b: c };
  } else if (h < 300) {
    rgb = { r: x, g: 0, b: c };
  } else {
    rgb = { r: c, g: 0, b: x };
  }

  return {
    r: (rgb.r + m) * 255,
    g: (rgb.g + m) * 255,
    b: (rgb.b + m) * 255,
  };
};

const rgbToHslString = ({ r, g, b }: Rgb) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = rgbToHsv({ r, g, b }).h;

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

export const ProfessionalColorPicker = memo(function ProfessionalColorPicker({
  value,
  opacity = 1,
  onChange,
  onOpacityChange,
}: ProfessionalColorPickerProps) {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value)));
  const [hexInput, setHexInput] = useState(value);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const nextColorRef = useRef(value);

  const rgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const hex = useMemo(() => rgbToHex(rgb), [rgb]);
  const hueColor = useMemo(() => rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 })), [hsv.h]);

  useEffect(() => {
    setHsv(rgbToHsv(hexToRgb(value)));
    setHexInput(value);
  }, [value]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const emitColor = useCallback(
    (nextColor: string) => {
      nextColorRef.current = nextColor;

      if (rafRef.current !== null) {
        return;
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const color = nextColorRef.current;
        onChange(color);
        setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8));
      });
    },
    [onChange],
  );

  const setColorFromHsv = (nextHsv: Hsv) => {
    const safeHsv = {
      h: clamp(nextHsv.h, 0, 360),
      s: clamp(nextHsv.s, 0, 1),
      v: clamp(nextHsv.v, 0, 1),
    };
    const nextHex = rgbToHex(hsvToRgb(safeHsv));

    setHsv(safeHsv);
    setHexInput(nextHex);
    emitColor(nextHex);
  };

  const selectFromSquare = (clientX: number, clientY: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);

    setColorFromHsv({ ...hsv, s, v });
  };

  const applyHexInput = () => {
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;

    if (!/^#[0-9a-f]{6}$/iu.test(normalized)) {
      setHexInput(hex);
      return;
    }

    setHsv(rgbToHsv(hexToRgb(normalized)));
    emitColor(normalized.toLowerCase());
  };

  const palette = [...new Set([...newspaperPalette, ...brandPalette])];

  return (
    <div className="professional-color-picker">
      <div className="color-picker-main">
        <div
          className="hsv-square"
          style={{ backgroundColor: hueColor }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            selectFromSquare(event.clientX, event.clientY, event.currentTarget);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) {
              selectFromSquare(event.clientX, event.clientY, event.currentTarget);
            }
          }}
        >
          <span
            className="hsv-cursor"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
            }}
          />
        </div>
        <div className="color-picker-sliders">
          <input
            aria-label="Hue"
            type="range"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(event) => setColorFromHsv({ ...hsv, h: Number(event.target.value) })}
          />
          <input
            aria-label="Alpha"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(event) => onOpacityChange?.(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="color-picker-fields">
        <label>
          <span>HEX</span>
          <input
            value={hexInput}
            onChange={(event) => setHexInput(event.target.value)}
            onBlur={applyHexInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyHexInput();
              }
            }}
          />
        </label>
        <label>
          <span>RGB</span>
          <input readOnly value={`${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)}`} />
        </label>
        <label>
          <span>HSL</span>
          <input readOnly value={rgbToHslString(rgb)} />
        </label>
      </div>
      <div className="color-swatch-grid" aria-label="Newspaper palette">
        {palette.map((color) => (
          <button
            type="button"
            key={color}
            title={color}
            aria-label={color}
            style={{ backgroundColor: color }}
            onClick={() => {
              setHsv(rgbToHsv(hexToRgb(color)));
              setHexInput(color);
              emitColor(color);
            }}
          />
        ))}
      </div>
      {recentColors.length > 0 ? (
        <div className="color-swatch-grid recent" aria-label="Recent colors">
          {recentColors.map((color) => (
            <button
              type="button"
              key={color}
              title={`Recent ${color}`}
              aria-label={`Recent ${color}`}
              style={{ backgroundColor: color }}
              onClick={() => {
                setHsv(rgbToHsv(hexToRgb(color)));
                setHexInput(color);
                emitColor(color);
              }}
            />
          ))}
        </div>
      ) : null}
      <button type="button" className="eyedropper-placeholder" disabled>
        Eyedropper ready
      </button>
    </div>
  );
});
