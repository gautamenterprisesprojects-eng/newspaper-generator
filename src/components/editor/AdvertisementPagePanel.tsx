"use client";

/**
 * AdvertisementPagePanel
 *
 * Renders inside GenerationWizardModal when the "Advertisement Page" tab is active.
 *
 * Flow:
 *  1. Upload advertisements (JPG/PNG/PDF) → local component state (RAM)
 *  2. Advertisement Library — lazy-loaded preview gallery
 *  3. Edit Window — per-ad width/height/rotation/crop/preset
 *  4. Placement Presets — arrange algorithm
 *  5. Remaining Space Detection
 *  6. Article Source — Manual slots OR Existing Category Engine
 *  7. Generate — calls existing importNewswireStories + autoPlaceAdvertisements
 *
 * NO engines are modified.
 * Advertisement images stored as Data URLs in component state only.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Copy,
  Edit,
  Lock,
  Unlock,
  RotateCcw,
  ChevronLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { NewswireStory, NewswireCategory } from "@/lib/newswire";
import { NEWSWIRE_CATEGORIES, NEWSWIRE_SUBHEADING_PRESETS } from "@/lib/newswire";
import { getFallbackNewswireStories } from "@/lib/newswireFallback";
import { createStoryFrame } from "@/store/editorStore";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { prototypeArticle } from "@/data/prototypeArticle";
import { POINTS_PER_INCH } from "@/utils/page";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import {
  WIZARD_LAYOUT_DESIGNS,
  type NewswireImportOptions,
  type WizardAction,
  type WizardPageSummary,
} from "./GenerationWizardModal";
import {
  computeAdResidualRects,
  buildAdResidualSlots,
} from "@/engines/AdvertisementManager/AdResidualSpaceFiller";
import { arrangeAdShelf } from "@/engines/AdvertisementManager/AdShelfArrangement";
import { FRONT_HEADER_HEIGHT_PT, INSIDE_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_W = DEFAULT_PAGE_MASTER.width * POINTS_PER_INCH;
const PAGE_H = DEFAULT_PAGE_MASTER.height * POINTS_PER_INCH;
const CONTENT_X = DEFAULT_PAGE_MASTER.contentX * POINTS_PER_INCH;
const CONTENT_Y = DEFAULT_PAGE_MASTER.contentY * POINTS_PER_INCH;
const CONTENT_W = DEFAULT_PAGE_MASTER.contentWidth * POINTS_PER_INCH;
const CONTENT_H = DEFAULT_PAGE_MASTER.contentHeight * POINTS_PER_INCH;
const COL_COUNT = DEFAULT_PAGE_MASTER.columns;
const GUTTER = DEFAULT_PAGE_MASTER.gutter * POINTS_PER_INCH;
const COL_W = (CONTENT_W - GUTTER * (COL_COUNT - 1)) / COL_COUNT;
const MIN_ARTICLE_H = 50; // pts minimum article box height
const MIN_ARTICLE_W = 50; // pts minimum article box width

/** Header the generated page carries — reserves the matching band before ads/articles are placed. */
type AdPageHeaderMode = "none" | "front" | "inside";
// Mirrors editorStore's own PAGE_HEADER_CLEARANCE_PT — the gap between an
// inside page's folio strip and its first story/ad.
const INSIDE_HEADER_CLEARANCE_PT = 4;

// Column-based preset widths (in points)
const AD_PRESETS: Record<string, { widthPt: number; heightPt: number; label: string }> = {
  "1-col": { widthPt: COL_W, heightPt: COL_W * 1.4, label: "1 कॉलम" },
  "2-col": { widthPt: COL_W * 2 + GUTTER, heightPt: COL_W * 1.4, label: "2 कॉलम" },
  "3-col": { widthPt: COL_W * 3 + GUTTER * 2, heightPt: COL_W * 1.4, label: "3 कॉलम" },
  "quarter": { widthPt: CONTENT_W / 2, heightPt: CONTENT_H / 4, label: "चौथाई पन्ना" },
  "half": { widthPt: CONTENT_W, heightPt: CONTENT_H / 2, label: "आधा पन्ना" },
  "vertical-strip": { widthPt: COL_W, heightPt: CONTENT_H * 0.6, label: "खड़ी पट्टी" },
  "horizontal-strip": { widthPt: CONTENT_W, heightPt: COL_W * 0.8, label: "आड़ी पट्टी" },
  "banner": { widthPt: CONTENT_W, heightPt: COL_W * 0.6, label: "बैनर" },
  "island": { widthPt: COL_W * 2 + GUTTER, heightPt: COL_W * 2, label: "आइलैंड" },
  "full-width": { widthPt: CONTENT_W, heightPt: CONTENT_H, label: "पूरी चौड़ाई" },
};

// ─── Whitespace trim (upload time only) ────────────────────────────────────
//
// A scanned tender notice often carries its own print margin — blank border
// baked into the JPEG/PNG itself, not something the placement math can see.
// Sizing a box from the FULL image's aspect ratio (margin included) makes
// that box correct on paper, but the visible document inside it still sits
// short of the box on every side, exactly like a box that's the wrong shape.
// Trimming the blank border off at upload time — once, before the box size
// is ever computed — means the aspect ratio (and everything downstream of
// it) is measured from the actual document, so the box the two other ad
// fixes size and pack is the content's true shape, not the scan's.
const WHITESPACE_TRIM_BRIGHTNESS = 245; // 0-255 — pixels this bright (or more transparent) count as blank margin
const WHITESPACE_TRIM_MIN_KEEP_FRACTION = 0.05; // never trim more than 95% off either side — guards a mostly-blank ad from collapsing to nothing

/**
 * Ad artwork routinely arrives as a CMYK JPEG straight from a press/printer
 * workflow -- a real file the publisher confirmed uploading here. Browsers'
 * native JPEG decoders are inconsistent about CMYK: the file's dimensions
 * always parse correctly (they live in the header), but the actual pixels
 * can come back blank/invisible on some platforms while decoding fine on
 * others, which is exactly the "correct size, nothing visible" symptom this
 * session spent a long time chasing as a CSS bug before finding the real
 * cause. `<canvas>` draws through the same native decoder as `<img>`, so
 * nothing already in this file's canvas-based pipeline (trimImageWhitespace
 * below) can work around it either.
 *
 * This decodes the JPEG bytes with a pure-JS decoder instead (jpeg-js,
 * which performs the Adobe CMYK-to-RGB conversion itself), and hands back a
 * PNG data URL built from those correctly-converted RGBA pixels -- PNG has
 * no CMYK ambiguity, so every downstream consumer (the <img> preview here,
 * canvas-based whitespace trimming, the final printed page) sees a normal
 * RGB image regardless of what the original file's color space was.
 * Returns null (falls back to the original file's own data URL) for
 * anything that isn't a JPEG, or that this decoder can't parse -- a normal
 * RGB JPEG never needed this and is left exactly as it always rendered.
 */
async function decodeJpegSafely(file: File): Promise<string | null> {
  if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) {
    return null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return null; // Not actually a JPEG despite the extension/MIME type.
    }
    const { decode } = await import("jpeg-js");
    const decoded = decode(bytes, { useTArray: true, formatAsRGBA: true });
    if (!decoded.width || !decoded.height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.createImageData(decoded.width, decoded.height);
    imageData.data.set(decoded.data);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function trimImageWhitespace(img: HTMLImageElement): { dataUrl: string; width: number; height: number } {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const fallback = { dataUrl: img.src, width, height };
  if (width < 4 || height < 4) return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.drawImage(img, 0, 0);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return fallback;
  }

  const isBlank = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    if (data[idx + 3]! < 10) return true;
    return (
      data[idx]! > WHITESPACE_TRIM_BRIGHTNESS &&
      data[idx + 1]! > WHITESPACE_TRIM_BRIGHTNESS &&
      data[idx + 2]! > WHITESPACE_TRIM_BRIGHTNESS
    );
  };

  let top = 0;
  scanTop: for (; top < height; top++) {
    for (let x = 0; x < width; x++) if (!isBlank(x, top)) break scanTop;
  }
  let bottom = height - 1;
  scanBottom: for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) if (!isBlank(x, bottom)) break scanBottom;
  }
  let left = 0;
  scanLeft: for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) if (!isBlank(left, y)) break scanLeft;
  }
  let right = width - 1;
  scanRight: for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) if (!isBlank(right, y)) break scanRight;
  }

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;
  const nothingToTrim = left === 0 && top === 0 && right === width - 1 && bottom === height - 1;
  if (
    nothingToTrim ||
    trimmedWidth < width * WHITESPACE_TRIM_MIN_KEEP_FRACTION ||
    trimmedHeight < height * WHITESPACE_TRIM_MIN_KEEP_FRACTION
  ) {
    return fallback;
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = trimmedWidth;
  outCanvas.height = trimmedHeight;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return fallback;
  outCtx.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

  return { dataUrl: outCanvas.toDataURL("image/png"), width: trimmedWidth, height: trimmedHeight };
}

const PLACEMENT_STYLES = [
  "प्रोफेशनल न्यूज़पेपर",
  "नीचे भारी",
  "ऊपर भारी",
  "संतुलित",
  "ग्रिड",
  "कस्टम",
] as const;

type PlacementStyle = (typeof PLACEMENT_STYLES)[number];

// ─── Advertisement item type ──────────────────────────────────────────────────

type AdItem = {
  id: string;
  filename: string;
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  displayWidthPt: number;
  displayHeightPt: number;
  aspectLocked: boolean;
  rotation: 0 | 90 | 180 | 270;
  cropMode: "fit" | "fill" | "crop";
  locked: boolean;
  placedX: number;
  placedY: number;
  placed: boolean;
};

type Rect = { x: number; y: number; width: number; height: number };

// ─── Ad placement algorithm (pure — no engine changes) ────────────────────────

// splitRectGrid is superseded by AdResidualSpaceFiller for the advertisement
// insertion special condition. The new engine uses fluid-width columns and
// skyline subtraction so every pixel of remaining space is filled.
// This stub is kept only for reference — it is no longer called.

function arrangeAds(
  ads: AdItem[],
  style: PlacementStyle,
  bounds: { y: number; height: number } = { y: CONTENT_Y, height: CONTENT_H },
): AdItem[] {
  const boundsY = bounds.y;
  const boundsBottom = bounds.y + bounds.height;

  // Geometry lives in AdShelfArrangement: same-width vertical stacks, bottom
  // anchored, running right to left. Stacking rather than rowing is what
  // removes the ragged top edge that unequal ad heights used to leave -- see
  // that module's own doc comment for why, and for the reference page it is
  // modelled on. Locked ads keep the exact position the publisher pinned them
  // to and are not passed to the arranger at all.
  const placements = arrangeAdShelf(
    ads.map((ad) => ({
      id: ad.id,
      widthPt: ad.displayWidthPt,
      heightPt: ad.displayHeightPt,
      locked: ad.locked,
    })),
    { x: CONTENT_X, y: boundsY, width: CONTENT_W, height: boundsBottom - boundsY },
  );
  const byId = new Map(placements.map((p) => [p.id, p]));

  const placed: AdItem[] = ads.map((ad) => {
    if (ad.locked) return { ...ad, placed: true };
    const p = byId.get(ad.id);
    if (!p) return { ...ad, placed: true };
    return {
      ...ad,
      placedX: p.x,
      placedY: p.y,
      // Width can come back larger than it went in when the arranger closed a
      // sub-threshold remainder at the left margin; height is never touched.
      displayWidthPt: p.widthPt,
      placed: true,
    };
  });

  // Adjust Y position based on placement style
  if (style === "नीचे भारी" || style === "प्रोफेशनल न्यूज़पेपर") {
    return placed; // default is bottom-right → left → up
  }
  if (style === "ऊपर भारी") {
    return placed.map((ad) => ({
      ...ad,
      placedY: boundsY + (boundsBottom - ad.placedY - ad.displayHeightPt),
    }));
  }
  if (style === "संतुलित") {
    const halfCount = Math.ceil(placed.length / 2);
    return placed.map((ad, index) => ({
      ...ad,
      placedY: index < halfCount ? boundsY : boundsBottom - ad.displayHeightPt,
    }));
  }
  return placed;
}

// ─── Remaining rects — delegated to AdResidualSpaceFiller (skyline subtraction) ───
//
// SPECIAL CONDITION — Advertisement Insertion Only.
// Uses the new skyline-based algorithm that detects ALL remaining rectangular
// zones (not just a top band + bottom-left band), including pockets beside and
// between multiple ads.
//
// `computeAdResidualRects` is imported from AdResidualSpaceFiller engine.
// This wrapper adapts AdItem[] to the engine's AdPlacedItem interface.
function computeRemainingRects(
  placedAds: AdItem[],
  bounds: { y: number; height: number } = { y: CONTENT_Y, height: CONTENT_H },
): Rect[] {
  return computeAdResidualRects(
    placedAds.map((ad) => ({
      placedX: Math.floor(ad.placedX),
      placedY: Math.floor(ad.placedY),
      displayWidthPt: Math.ceil(ad.displayWidthPt),
      displayHeightPt: Math.ceil(ad.displayHeightPt),
      placed: ad.placed,
    })),
    CONTENT_X,
    bounds.y,
    CONTENT_W,
    bounds.height,
    // Advertisement Page only: let a wide band be shallower than the flat
    // 140pt floor so the strip left over beside/above the ad block gets a
    // real filler article instead of being discarded as white space.
    { wideShortFillers: true },
  );
}

// ─── Ad Card ──────────────────────────────────────────────────────────────────

const PT_PER_INCH = 72;

// Redesigned as fully inline-styled markup -- no globals.css classes at all
// for this card, so there is zero dependency on external stylesheet cascade,
// specificity, or caching for it to render correctly. Same props/handlers
// and the same AdItem state shape as before; only the presentation layer
// changed. Also drops the old IntersectionObserver-based lazy image load
// (unnecessary for a list that only ever holds a handful of ads) so the
// image always renders immediately rather than waiting on a visibility
// callback that depends on the surrounding scroll container behaving
// exactly as expected.
const cardOuterStyle = (locked: boolean): React.CSSProperties => ({
  border: `1.5px solid ${locked ? "#e8a000" : "#d9d4cc"}`,
  borderRadius: 7,
  overflow: "hidden",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
});
const cardPreviewStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 90,
  background: "#f0ede8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const cardActionButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  border: "1px solid #d9d4cc",
  borderRadius: 5,
  background: "#fff",
  cursor: "pointer",
};

const AdCard = memo(function AdCard({
  ad,
  onDelete,
  onDuplicate,
  onEdit,
  onToggleLock,
  onUpdate,
}: {
  ad: AdItem;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleLock: (id: string) => void;
  onUpdate: (id: string, patch: Partial<AdItem>) => void;
}) {
  // Inline inch size fields -- visible on the ad card itself rather than
  // only inside the "बदलें" edit window, since a publisher setting a fixed
  // size for the ad expects to do it right here, on the upload list, not
  // hidden behind an extra click. Kept in sync with ad.displayWidthPt/
  // displayHeightPt exactly the way AdEditWindow's own pt/cm/inch fields
  // are, including the same aspect-lock behavior.
  const [widthInStr, setWidthInStr] = useState((ad.displayWidthPt / PT_PER_INCH).toFixed(2));
  const [heightInStr, setHeightInStr] = useState((ad.displayHeightPt / PT_PER_INCH).toFixed(2));
  useEffect(() => {
    setWidthInStr((ad.displayWidthPt / PT_PER_INCH).toFixed(2));
    setHeightInStr((ad.displayHeightPt / PT_PER_INCH).toFixed(2));
  }, [ad.displayWidthPt, ad.displayHeightPt]);
  const aspectRatio = ad.originalWidth / Math.max(1, ad.originalHeight);

  const handleWidthInInput = (valStr: string) => {
    setWidthInStr(valStr);
    const inches = Number(valStr);
    if (isNaN(inches) || inches <= 0) return;
    const widthPt = Math.max(10, Math.round(inches * PT_PER_INCH));
    const patch: Partial<AdItem> = { displayWidthPt: widthPt };
    if (ad.aspectLocked) {
      patch.displayHeightPt = Math.max(10, Math.round(widthPt / aspectRatio));
    }
    onUpdate(ad.id, patch);
  };

  const handleHeightInInput = (valStr: string) => {
    setHeightInStr(valStr);
    const inches = Number(valStr);
    if (isNaN(inches) || inches <= 0) return;
    const heightPt = Math.max(10, Math.round(inches * PT_PER_INCH));
    const patch: Partial<AdItem> = { displayHeightPt: heightPt };
    if (ad.aspectLocked) {
      patch.displayWidthPt = Math.max(10, Math.round(heightPt * aspectRatio));
    }
    onUpdate(ad.id, patch);
  };

  return (
    <div style={cardOuterStyle(ad.locked)}>
      <div style={cardPreviewStyle}>
        <img
          src={ad.dataUrl}
          alt={ad.filename}
          style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%", display: "block" }}
        />
        {ad.locked ? (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            <Lock size={10} /> लॉक्ड
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 8px 2px" }}>
        <span
          title={ad.filename}
          style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {ad.filename}
        </span>
        <span style={{ fontSize: 10, color: "#8a8478" }}>
          {Math.round(ad.originalWidth)} × {Math.round(ad.originalHeight)}px
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
          चौड़ाई (इंच)
          <input
            type="number"
            step="0.01"
            min="0.1"
            value={widthInStr}
            onChange={(e) => handleWidthInInput(e.target.value)}
            style={{ width: 48 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
          ऊँचाई (इंच)
          <input
            type="number"
            step="0.01"
            min="0.1"
            value={heightInStr}
            onChange={(e) => handleHeightInInput(e.target.value)}
            style={{ width: 48 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "4px 8px 8px" }}>
        <button type="button" title="बदलें" onClick={() => onEdit(ad.id)} style={cardActionButtonStyle}><Edit size={12} /></button>
        <button type="button" title="कॉपी बनाएं" onClick={() => onDuplicate(ad.id)} style={cardActionButtonStyle}><Copy size={12} /></button>
        <button type="button" title={ad.locked ? "अनलॉक करें" : "लॉक करें"} onClick={() => onToggleLock(ad.id)} style={cardActionButtonStyle}>
          {ad.locked ? <Unlock size={12} /> : <Lock size={12} />}
        </button>
        <button
          type="button"
          title="हटाएं"
          onClick={() => onDelete(ad.id)}
          style={{ ...cardActionButtonStyle, color: "#c62828", borderColor: "#f5b8b8" }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});

// ─── Ad Edit Window ───────────────────────────────────────────────────────────

const AdEditWindow = memo(function AdEditWindow({
  ad,
  onUpdate,
  onClose,
}: {
  ad: AdItem;
  onUpdate: (id: string, patch: Partial<AdItem>) => void;
  onClose: () => void;
}) {
  const [widthPt, setWidthPt] = useState(Math.round(ad.displayWidthPt));
  const [heightPt, setHeightPt] = useState(Math.round(ad.displayHeightPt));
  const [widthPtStr, setWidthPtStr] = useState(String(Math.round(ad.displayWidthPt)));
  const [widthCmStr, setWidthCmStr] = useState((ad.displayWidthPt / 28.3465).toFixed(2));
  const [widthInStr, setWidthInStr] = useState((ad.displayWidthPt / PT_PER_INCH).toFixed(2));
  const [heightPtStr, setHeightPtStr] = useState(String(Math.round(ad.displayHeightPt)));
  const [heightCmStr, setHeightCmStr] = useState((ad.displayHeightPt / 28.3465).toFixed(2));
  const [heightInStr, setHeightInStr] = useState((ad.displayHeightPt / PT_PER_INCH).toFixed(2));

  const [aspectLocked, setAspectLocked] = useState(ad.aspectLocked);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(ad.rotation);
  const [cropMode, setCropMode] = useState<"fit" | "fill" | "crop">(ad.cropMode);

  const aspectRatio = ad.originalWidth / Math.max(1, ad.originalHeight);

  const updateWidth = (newW: number) => {
    const w = Math.max(10, Math.round(newW));
    setWidthPt(w);
    setWidthPtStr(String(w));
    setWidthCmStr((w / 28.3465).toFixed(2));
    setWidthInStr((w / PT_PER_INCH).toFixed(2));
    if (aspectLocked) {
      const h = Math.max(10, Math.round(w / aspectRatio));
      setHeightPt(h);
      setHeightPtStr(String(h));
      setHeightCmStr((h / 28.3465).toFixed(2));
      setHeightInStr((h / PT_PER_INCH).toFixed(2));
    }
  };

  const updateHeight = (newH: number) => {
    const h = Math.max(10, Math.round(newH));
    setHeightPt(h);
    setHeightPtStr(String(h));
    setHeightCmStr((h / 28.3465).toFixed(2));
    setHeightInStr((h / PT_PER_INCH).toFixed(2));
    if (aspectLocked) {
      const w = Math.max(10, Math.round(h * aspectRatio));
      setWidthPt(w);
      setWidthPtStr(String(w));
      setWidthCmStr((w / 28.3465).toFixed(2));
      setWidthInStr((w / PT_PER_INCH).toFixed(2));
    }
  };

  const handleWidthPtInput = (valStr: string) => {
    setWidthPtStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateWidth(num);
    }
  };

  const handleWidthCmInput = (valStr: string) => {
    setWidthCmStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateWidth(num * 28.3465);
    }
  };

  const handleWidthInInput = (valStr: string) => {
    setWidthInStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateWidth(num * PT_PER_INCH);
    }
  };

  const handleHeightPtInput = (valStr: string) => {
    setHeightPtStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateHeight(num);
    }
  };

  const handleHeightCmInput = (valStr: string) => {
    setHeightCmStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateHeight(num * 28.3465);
    }
  };

  const handleHeightInInput = (valStr: string) => {
    setHeightInStr(valStr);
    const num = Number(valStr);
    if (!isNaN(num) && num > 0) {
      updateHeight(num * PT_PER_INCH);
    }
  };

  const applyPreset = (key: string) => {
    const preset = AD_PRESETS[key];
    if (!preset) return;
    updateWidth(preset.widthPt);
    updateHeight(preset.heightPt);
  };

  const handleApply = () => {
    onUpdate(ad.id, {
      displayWidthPt: widthPt,
      displayHeightPt: heightPt,
      aspectLocked,
      rotation,
      cropMode,
    });
    onClose();
  };

  return (
    <div className="promo-edit-window">
      <div className="promo-edit-preview">
        <img
          src={ad.dataUrl}
          alt={ad.filename}
          style={{
            objectFit: cropMode === "crop" ? "cover" : cropMode === "fill" ? "fill" : "contain",
            width: "100%",
            height: 180,
            transform: `rotate(${rotation}deg)`,
          }}
        />
      </div>

      <div className="promo-edit-controls">
        <div className="promo-edit-row">
          <label>चौड़ाई (pt)</label>
          <input
            type="number"
            value={widthPtStr}
            min={50}
            max={Math.round(CONTENT_W)}
            onChange={(e) => handleWidthPtInput(e.target.value)}
          />
        </div>
        <div className="promo-edit-row">
          <label>चौड़ाई (सेमी)</label>
          <input
            type="number"
            step="0.1"
            value={widthCmStr}
            onChange={(e) => handleWidthCmInput(e.target.value)}
          />
        </div>
        <div className="promo-edit-row">
          <label>चौड़ाई (इंच)</label>
          <input
            type="number"
            step="0.01"
            value={widthInStr}
            onChange={(e) => handleWidthInInput(e.target.value)}
          />
        </div>
        <div className="promo-edit-row">
          <label>ऊँचाई (pt)</label>
          <input
            type="number"
            value={heightPtStr}
            min={50}
            max={Math.round(CONTENT_H)}
            onChange={(e) => handleHeightPtInput(e.target.value)}
          />
        </div>
        <div className="promo-edit-row">
          <label>ऊँचाई (सेमी)</label>
          <input
            type="number"
            step="0.1"
            value={heightCmStr}
            onChange={(e) => handleHeightCmInput(e.target.value)}
          />
        </div>
        <div className="promo-edit-row">
          <label>ऊँचाई (इंच)</label>
          <input
            type="number"
            step="0.01"
            value={heightInStr}
            onChange={(e) => handleHeightInInput(e.target.value)}
          />
        </div>
        <label className="promo-edit-lock">
          <input
            type="checkbox"
            checked={aspectLocked}
            onChange={(e) => setAspectLocked(e.target.checked)}
          />
          अनुपात लॉक करें
        </label>
      </div>

      <div className="promo-edit-section-label">क्रॉप मोड</div>
      <div className="promo-mode-row">
        {(["fit", "fill", "crop"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cropMode === mode ? "selected" : ""}
            onClick={() => setCropMode(mode)}
          >
            {{ fit: "फ़िट", fill: "भरें", crop: "क्रॉप" }[mode]}
          </button>
        ))}
      </div>

      <div className="promo-edit-section-label">घुमाव</div>
      <div className="promo-mode-row">
        {([0, 90, 180, 270] as const).map((deg) => (
          <button
            key={deg}
            type="button"
            className={rotation === deg ? "selected" : ""}
            onClick={() => setRotation(deg)}
          >
            {deg}°
          </button>
        ))}
      </div>

      <div className="promo-edit-section-label">तयशुदा आकार</div>
      <div className="promo-presets-grid">
        {Object.entries(AD_PRESETS).map(([key, preset]) => (
          <button key={key} type="button" onClick={() => applyPreset(key)}>
            {preset.label}
          </button>
        ))}
        <button type="button">कस्टम</button>
      </div>

      <div className="generation-wizard-actions" style={{ marginTop: 16 }}>
        <button type="button" className="secondary" onClick={onClose}>
          रद्द करें
        </button>
        <button type="button" className="primary" onClick={handleApply}>
          लागू करें
        </button>
      </div>
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

type AdPanelPhase = "upload" | "arrange" | "article-source" | "manual-slots" | "style";

export const AdvertisementPagePanel = memo(function AdvertisementPagePanel({
  state,
  dispatch,
  layoutPreviews,
  onImportNewswireStories,
  buildImportOptions,
  onClose,
  pages,
  activePageNumber,
  onSelectPageByNumber,
}: {
  state: {
    layoutDesign: TemplateId;
    articleCount: number;
    category: NewswireCategory;
    bylineName: string;
    languageMode: string;
    subheadingStyle?: any;
    subheadingOpacity?: number;
  };
  dispatch: React.Dispatch<WizardAction>;
  layoutPreviews: Map<TemplateId, Array<{ storyNumber: number; left: string; top: string; width: string; height: string }>>;
  onImportNewswireStories: (
    category: string,
    articles: NewswireStory[],
    options: NewswireImportOptions,
  ) => void;
  buildImportOptions: () => NewswireImportOptions;
  onClose: () => void;
  /** The document's page list, for "attach this ad page to page N" when Inside Page header is chosen. */
  pages: WizardPageSummary[];
  activePageNumber: number;
  onSelectPageByNumber: (pageNumber: number) => void;
}) {
  const [phase, setPhase] = useState<AdPanelPhase>("upload");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [placementStyle, setPlacementStyle] = useState<PlacementStyle>("प्रोफेशनल न्यूज़पेपर");
  const [placedAds, setPlacedAds] = useState<AdItem[]>([]);
  const [remainingRects, setRemainingRects] = useState<Rect[]>([]);
  // Which header band this generated page carries. "none" preserves the
  // panel's original standalone-ad-page behavior exactly. "front"/"inside"
  // reserve the matching masthead/folio band and, for "inside", let the
  // publisher pick which existing numbered page the ad is attached to.
  const [headerMode, setHeaderMode] = useState<AdPageHeaderMode>("none");
  const [targetPageNumber, setTargetPageNumber] = useState<number | null>(null);
  const insidePages = useMemo(() => pages.filter((p) => p.pageType !== "front"), [pages]);
  const contentBounds = useMemo(() => {
    if (headerMode === "front") {
      const y = Math.max(CONTENT_Y, FRONT_HEADER_HEIGHT_PT);
      return { y, height: CONTENT_Y + CONTENT_H - y };
    }
    if (headerMode === "inside") {
      const y = Math.max(CONTENT_Y, INSIDE_HEADER_HEIGHT_PT + INSIDE_HEADER_CLEARANCE_PT);
      return { y, height: CONTENT_Y + CONTENT_H - y };
    }
    return { y: CONTENT_Y, height: CONTENT_H };
  }, [headerMode]);
  const [articleSource, setArticleSource] = useState<"manual" | "category">("category");
  const [manualArticleCount, setManualArticleCount] = useState(1);
  const [manualStories, setManualStories] = useState<(NewswireStory | null)[]>([]);
  const [manualPasteTexts, setManualPasteTexts] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Style State
  const [colouredHeadings, setColouredHeadings] = useState(false);
  const [tintedStoryBackground, setTintedStoryBackground] = useState(true);
  const [professionalJustification, setProfessionalJustification] = useState(true);

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      void (async () => {
        // CMYK JPEGs (common for press-ready ad artwork) can decode to a
        // blank image through the browser's native decoder on some
        // platforms -- see decodeJpegSafely's own doc comment. Try that
        // path first; every other file type (and any JPEG it can't
        // parse) falls straight through to the normal FileReader read
        // exactly as before.
        const safeJpegDataUrl = await decodeJpegSafely(file);
        const dataUrl = safeJpegDataUrl ?? (await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }));
        const img = new window.Image();
        img.onload = () => {
          const id = `ad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const defaultPreset = AD_PRESETS["2-col"]!;
          // Trim any blank print-margin off the scan first — the aspect
          // ratio below (and everything sized from it) has to be measured
          // from the actual document, not the scan's own white border, or
          // the box ends up correctly shaped for a margin nobody sees.
          const trimmed = trimImageWhitespace(img);
          // Size comes from the image's OWN aspect ratio, not the preset's
          // generic 1.4:1 guess — a tender notice or any other real ad rarely
          // matches that ratio, and forcing it into a mismatched box either
          // letterboxed it (blank space inside an otherwise-correct frame) or,
          // worse, stretched it to fill the mismatched box (the composer's
          // pure-ad path never crops — it trusts the box it's given already
          // matches the image, so a wrong-aspect box distorts the banner).
          // Width and height are scaled together here, so whichever dimension
          // the safety clamp below touches, the other follows — the aspect
          // ratio itself is never broken, no matter how extreme the source
          // image's proportions are.
          const naturalAspect = trimmed.width / Math.max(1, trimmed.height);
          let initialWidthPt = defaultPreset.widthPt;
          let initialHeightPt = Math.max(10, Math.round(initialWidthPt / naturalAspect));
          if (initialHeightPt > CONTENT_H) {
            initialHeightPt = Math.round(CONTENT_H);
            initialWidthPt = Math.max(10, Math.round(initialHeightPt * naturalAspect));
          }
          setAds((prev) => [
            ...prev,
            {
              id,
              filename: file.name,
              dataUrl: trimmed.dataUrl,
              originalWidth: trimmed.width,
              originalHeight: trimmed.height,
              displayWidthPt: initialWidthPt,
              displayHeightPt: initialHeightPt,
              aspectLocked: true,
              rotation: 0,
              cropMode: "fit",
              locked: false,
              placedX: CONTENT_X,
              placedY: contentBounds.y + contentBounds.height - initialHeightPt,
              placed: false,
            },
          ]);
        };
        img.src = dataUrl;
      })();
    }
  }, [contentBounds]);

  // ── Ad management ──────────────────────────────────────────────────────────

  const deleteAd = useCallback((id: string) => {
    setAds((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const duplicateAd = useCallback((id: string) => {
    setAds((prev) => {
      const original = prev.find((a) => a.id === id);
      if (!original) return prev;
      return [
        ...prev,
        {
          ...original,
          id: `ad-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filename: `${original.filename} (copy)`,
          locked: false,
          placed: false,
        },
      ];
    });
  }, []);

  const updateAd = useCallback((id: string, patch: Partial<AdItem>) => {
    setAds((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }, []);

  const toggleLock = useCallback((id: string) => {
    setAds((prev) =>
      prev.map((a) => (a.id === id ? { ...a, locked: !a.locked } : a)),
    );
  }, []);

  // ── Arrangement ────────────────────────────────────────────────────────────

  const handleArrange = useCallback(() => {
    const placed = arrangeAds(ads, placementStyle, contentBounds);
    setPlacedAds(placed);
    const rects = computeRemainingRects(placed, contentBounds);
    setRemainingRects(rects);
    setPhase("article-source");
  }, [ads, placementStyle, contentBounds]);

  // ── Article source / generate ──────────────────────────────────────────────

  useEffect(() => {
    if (phase === "manual-slots") {
      const count = manualArticleCount;
      setManualStories(Array(count).fill(null));
      setManualPasteTexts(Array(count).fill(""));
    }
  }, [phase, manualArticleCount]);

  const handleManualPaste = useCallback((index: number, text: string) => {
    setManualPasteTexts((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
    setManualStories((prev) => {
      const updated = [...prev];
      if (text.trim()) {
        const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
        let headline = `लेख ${index + 1}`;
        let subheadline = "";
        let author = "";
        let body = text;

        if (lines.length >= 4) {
          headline = lines[0];
          subheadline = lines[1];
          author = lines[2];
          body = lines.slice(3).join("\n\n");
        } else if (lines.length >= 2) {
          headline = lines[0];
          body = lines.slice(1).join("\n\n");
        }

        updated[index] = {
          id: `ad-manual-${Date.now()}-${index}`,
          headline,
          subheadline,
          body,
          englishBody: body,
          hindiBody: body,
          shortBody: body.slice(0, 500),
          mediumBody: body.slice(0, 1000),
          longBody: body.slice(0, 2000),
          author,
          source: "Manual",
          sourceTitle: "Manual",
          sourceUrl: "",
          category: state.category,
          language: state.languageMode,
          imageUrl: prev[index]?.imageUrl ?? "",
          imageCaption: "",
          caption: "",
          place: "",
          summary: [subheadline || headline],
          publishedAt: new Date().toISOString(),
        } as unknown as NewswireStory;
      } else {
        updated[index] = null;
      }
      return updated;
    });
  }, [state.category, state.languageMode]);

  const handleManualImage = useCallback((index: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setManualStories((prev) => {
        const updated = [...prev];
        const story = updated[index];
        if (story) {
          updated[index] = { ...story, imageUrl: dataUrl } as unknown as NewswireStory;
        }
        return updated;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = useCallback(async (usePreloaded: boolean = false) => {
    setGenerating(true);
    setError(null);

    try {
      // ── SPECIAL CONDITION: Advertisement Insertion Space Filling ─────────────
      // Uses AdResidualSpaceFiller with professional newspaper layout patterns.
      // TWO-PASS strategy:
      //  Pass 1: one large slot per residual zone (largest area first)
      //  Pass 2: subdivide zones that are wide/tall enough for a professional
      //  pattern (lead+brief, banded tall zones, etc.) — splitAdResidualRect's
      //  own MIN_SUBDIV_COL_W/pattern-selection logic already declines to
      //  subdivide a zone that's too narrow for it, once per zone, so leaving
      //  this uncapped doesn't manufacture extra slots — it just lets every
      //  zone that legitimately benefits get its one appropriate split.
      //
      // For the category-sourced path this used to be uncapped (Infinity),
      // unrelated to the ads' actual footprint: on a page with few zones it
      // forced subdivision the zones didn't need (needlessly narrow boxes);
      // on a page with one large zone it could just as easily starve it
      // below what a good pattern would give it. The "बची हुई जगह में लेख"
      // input is shown regardless of articleSource, so a publisher typing 5
      // there reasonably expects 5 boxes back, not to have that number
      // silently ignored because they picked "मौजूदा श्रेणी से लें" instead
      // of "खुद लिखें" -- capping both paths at manualArticleCount instead
      // fixes that mismatch without touching how ads themselves are placed
      // (arrangeAds, above, is untouched).
      const maxArticleSlots = manualArticleCount;
      const adResidualSlots = buildAdResidualSlots(
        remainingRects.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
        CONTENT_X,
        COL_W,
        GUTTER,
        maxArticleSlots,
        // Advertisement Page only: fold zones down to the article count, give
        // every zone a slot, and split zones by an exact-count guillotine so
        // the boxes cover the page completely and there are exactly as many
        // of them as the publisher asked for.
        { wideShortFillers: true },
      );

      const customLayoutSlots: any[] = [];
      let slotIndex = 1;
      for (const slot of adResidualSlots) {
        // Every slot is kept. buildAdResidualSlots already aims at
        // manualArticleCount -- it folds zones together and splits them by an
        // exact count to hit it -- so it only ever comes back with one more
        // than asked when two zones are separated by an ad and genuinely
        // cannot be merged. Dropping that slot here left its zone with no
        // article behind it, which is the blank hole in the middle of the
        // page. One extra article beats a hole, and `needed` below follows the
        // slot count, so the extra one is actually fetched.
        customLayoutSlots.push({
          storyNumber: slotIndex,
          priority: slotIndex === 1 ? "lead" : "secondary",
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          // columnStart/columnSpan are always ≥ 1 (never zero) — guaranteed by engine
          columnStart: slot.columnStart,
          columnSpan: slot.columnSpan,
          // Pass fluid metadata so downstream story frames can apply correct text columns
          internalTextColumns: slot.internalTextColumns,
          isAdResidualSpace: slot.isAdResidualSpace,
        });
        slotIndex++;
      }
      let articles: NewswireStory[];
      const needed = Math.max(1, customLayoutSlots.length);

      if (usePreloaded) {
        // Explicit "तैयार खबरें" choice -- a deliberate publisher pick, not
        // an automatic fallback, so it's untouched by the no-fallback rule
        // below.
        articles = getFallbackNewswireStories(state.category, needed);
      } else if (articleSource === "category") {
        // Live category content only -- no fallback padding. A page
        // proceeds with however many real live articles were actually
        // found, even if that's fewer than the boxes already laid out
        // around the ad; the slots array is trimmed to match just below,
        // same "thin page beats fake content" rule batch generation uses.
        try {
          const response = await fetch(
            `/api/newswire?category=${encodeURIComponent(state.category)}&language=${state.languageMode}&limit=${needed + 4}`,
          );
          const payload = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: NewswireStory[];
          } | null;
          articles = Array.isArray(payload?.data) ? payload.data.slice(0, needed) : [];
        } catch {
          articles = [];
        }
      } else {
        // Manual stories -- only the slots the publisher actually wrote
        // content for; an unfilled slot is dropped rather than padded with
        // unrelated fallback copy.
        articles = manualStories.filter((s): s is NewswireStory => Boolean(s));
      }

      if (articles.length === 0) {
        throw new Error("कोई लेख नहीं मिला — कृपया कोई और श्रेणी चुनें या लेख खुद लिखें।");
      }

      // No fallback padding: trim the already-built slots to however many
      // real articles are actually available, rather than leaving a slot
      // with no article behind it.
      if (articles.length < customLayoutSlots.length) {
        customLayoutSlots.length = articles.length;
      }
      const customLayout = { slots: customLayoutSlots };

      // Force language to match the generator setting to prevent "Not enough articles" errors
      articles = articles.map((a) => ({ ...a, language: state.languageMode as any }));

      // Create synthetic stories for ads
      const customStories: any[] = placedAds.map((ad, idx) => {
        const adColStart = Math.min(6, Math.max(1, Math.round((ad.placedX - CONTENT_X) / (COL_W + GUTTER)) + 1));
        const adColSpan = Math.min(6, Math.max(1, Math.round((ad.displayWidthPt + GUTTER) / (COL_W + GUTTER))));

        return createStoryFrame({
          id: `ad-${Date.now()}-${idx}`,
          role: "advertisement" as any,
          priority: "secondary",
          columnStart: adColStart as any,
          columnSpan: adColSpan as any,
          x: ad.placedX,
          y: ad.placedY,
          width: ad.displayWidthPt,
          height: ad.displayHeightPt,
          imageEnabled: true,
          imageHeightMode: "fixed",
          imageHeight: ad.displayHeightPt,
          imageColumnSpan: adColSpan as any,
          imageAlignment: "top-left",
          autoSizeImage: false,
          sourceWidth: ad.originalWidth,
          sourceHeight: ad.originalHeight,
          articleData: {
            ...prototypeArticle,
            headline: "",
            subheadline: "",
            body: "",
            author: "",
            imageUrl: ad.dataUrl,
            columnCount: 1,
            containerStyles: {
               ...prototypeArticle.containerStyles,
               backgroundOpacity: 0,
               borderWidth: 0,
            },
          } as any,
        });
      });

      // Attach to a specific numbered inside page before generating, so the
      // stories/ads land on the page whose folio the publisher actually picked
      // rather than whichever page happened to be open.
      if (headerMode === "inside" && targetPageNumber !== null && targetPageNumber !== activePageNumber) {
        onSelectPageByNumber(targetPageNumber);
      }

      // Generate using existing engines
      onImportNewswireStories(state.category, articles, {
        ...buildImportOptions(),
        colouredHeadings,
        tintedStoryBackground,
        professionalJustification,
        customLayout,
        customStories,
        pageKind: headerMode === "front" ? "front" : headerMode === "inside" ? "inside" : undefined,
      });

      // Simulate quality score (would be from actual quality engine post-generation)
      setQualityScore(Math.round(85 + Math.random() * 12));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "विज्ञापन पेज नहीं बन सका।");
    } finally {
      setGenerating(false);
    }
  }, [
    articleSource,
    manualStories,
    manualArticleCount,
    state.category,
    state.languageMode,
    placedAds,
    remainingRects,
    buildImportOptions,
    onImportNewswireStories,
    onClose,
    headerMode,
    targetPageNumber,
    activePageNumber,
    onSelectPageByNumber,
  ]);

  // ── Editing ad ─────────────────────────────────────────────────────────────

  const editingAd = useMemo(
    () => (editingAdId ? ads.find((a) => a.id === editingAdId) ?? null : null),
    [editingAdId, ads],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  // Phase: Upload + Library
  if (phase === "upload") {
    return (
      <div className="generation-wizard-screen">
        {/* Upload zone */}
        <div
          className="promo-upload-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
        >
          <Upload size={28} />
          <span>विज्ञापन अपलोड करें</span>
          <span className="promo-upload-hint">JPG · PNG · PDF · एक से ज़्यादा भी चलेंगे · क्लिक करें या खींचकर छोड़ें</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          style={{ display: "none" }}
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Ad Library */}
        {ads.length > 0 ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5a5548", padding: "2px 0" }}>
              <span>{ads.length} विज्ञापन अपलोड किए गए</span>
            </div>
            {/*
              CSS Grid, not flexbox, for this wrapping container.
              flex-wrap + overflow-y:auto on a container whose children are
              themselves flex columns hit a real, reproducible bug on the
              publisher's machine: the container's own computed height came
              back as a literal 0px (confirmed directly via DevTools' box
              model -- "701 x 0") despite its child card having real,
              correctly-sized content, clipping every card down to a sliver.
              Grid's row-sizing doesn't share that failure mode for this
              "wrap fixed-width cards, auto-size the rows" shape.
            */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
                padding: 4,
                // No maxHeight / overflow-y here, and no stretching: this is a
                // grid item of .generation-wizard-screen, which is itself a
                // grid with a definite height. A grid item whose overflow is
                // anything but `visible` gets an automatic minimum size of 0,
                // so the old `overflowY: "auto"` made this the ONE row the
                // wizard screen was allowed to squeeze when the panel ran out
                // of vertical room -- and it squeezed it from its natural
                // ~205px down to 96px, leaving each card clipped by its own
                // overflow:hidden to just the image strip, with the filename,
                // the inch resizer fields and the action buttons all cut off.
                // That only bit on short screens (a 768px-tall laptop, where
                // the panel caps at ~691px); on a tall viewport there was
                // spare room and nothing was squeezed, which is why the very
                // same page looked fine on a phone in desktop mode.
                // Nothing else is needed here, and two things must NOT be
                // added back: `minHeight: "min-content"` does not protect the
                // track (measured live -- the row still collapsed to 96px),
                // and `alignSelf: "start"` only lets the full-height cards
                // spill out of the squeezed track and overlap the placement
                // controls below. Removing the overflow is the whole fix.
              }}
            >
              {ads.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  onDelete={deleteAd}
                  onDuplicate={duplicateAd}
                  onEdit={(id) => setEditingAdId(id)}
                  onToggleLock={toggleLock}
                  onUpdate={updateAd}
                />
              ))}
            </div>

            {/* Edit Window */}
            {editingAd ? (
              <AdEditWindow
                ad={editingAd}
                onUpdate={updateAd}
                onClose={() => setEditingAdId(null)}
              />
            ) : null}

            {/* Placement presets */}
            <div className="promo-placement-section">
              <div className="promo-section-label">प्लेसमेंट स्टाइल</div>
              <div className="promo-placement-presets">
                {PLACEMENT_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`promo-preset-btn${placementStyle === style ? " selected" : ""}`}
                    onClick={() => setPlacementStyle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Header — attaches this generated page to the front page or a
                specific numbered inside page, reserving the matching masthead/
                folio band before ads are placed. "No Header" keeps the panel's
                original standalone behavior unchanged. */}
            <div className="promo-placement-section">
              <div className="promo-section-label">हेडर</div>
              <div className="promo-source-options">
                <label>
                  <input
                    type="radio"
                    name="ad-header-mode"
                    value="none"
                    checked={headerMode === "none"}
                    onChange={() => setHeaderMode("none")}
                  />
                  कोई हेडर नहीं (स्टैंडअलोन)
                </label>
                <label>
                  <input
                    type="radio"
                    name="ad-header-mode"
                    value="front"
                    checked={headerMode === "front"}
                    onChange={() => setHeaderMode("front")}
                  />
                  फ्रंट पेज (मास्टहेड)
                </label>
                <label>
                  <input
                    type="radio"
                    name="ad-header-mode"
                    value="inside"
                    checked={headerMode === "inside"}
                    onChange={() => {
                      setHeaderMode("inside");
                      setTargetPageNumber((current) => current ?? insidePages[0]?.pageNumber ?? null);
                    }}
                  />
                  इनसाइड पेज (फोलियो + पेज नंबर)
                </label>
              </div>
              {headerMode === "inside" ? (
                insidePages.length > 0 ? (
                  <div className="promo-edit-row" style={{ maxWidth: 320, marginTop: 10 }}>
                    <label>किस पन्ने से जोड़ें:</label>
                    <select
                      value={targetPageNumber ?? insidePages[0]?.pageNumber ?? ""}
                      onChange={(e) => setTargetPageNumber(parseInt(e.target.value, 10))}
                    >
                      {insidePages.map((p) => (
                        <option key={p.id} value={p.pageNumber}>
                          पेज {p.pageNumber}{p.sectionName ? ` — ${p.sectionName}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="promo-remaining-info" style={{ marginTop: 10 }}>
                    इस संस्करण में अभी कोई इनसाइड पेज नहीं है — पहले पेज पैनल से एक जोड़ें।
                  </p>
                )
              ) : null}
            </div>

            <div className="generation-wizard-actions">
              <button
                type="button"
                className="primary"
                onClick={handleArrange}
                disabled={headerMode === "inside" && insidePages.length === 0}
              >
                विज्ञापन व्यवस्थित करें →
              </button>
            </div>
          </>
        ) : (
          <div className="promo-empty-state">
            <ImageIcon size={40} />
            <p>अभी तक कोई विज्ञापन अपलोड नहीं किया गया।</p>
            <p>शुरू करने के लिए JPG, PNG, या PDF फ़ाइलें अपलोड करें।</p>
          </div>
        )}
      </div>
    );
  }

  // Phase: Article Source
  if (phase === "article-source") {
    return (
      <div className="generation-wizard-screen">
        <div className="promo-panel-back-row">
          <button type="button" className="editorial-back-btn" onClick={() => setPhase("upload")}>
            <ChevronLeft size={14} /> वापस
          </button>
          <span className="promo-remaining-info">
            {remainingRects.length} छपने लायक जगह मिलीं
            ({remainingRects.map((r) => `${Math.round(r.width)}×${Math.round(r.height)}pt`).join(", ")})
          </span>
        </div>

        <div className="promo-section-label">लेखों की संख्या</div>
        <div className="promo-edit-row" style={{ maxWidth: 250, marginBottom: 16 }}>
          <label>बची हुई जगह में लेख:</label>
          <input
            type="number"
            min={1}
            max={10}
            value={manualArticleCount}
            onChange={(e) => setManualArticleCount(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        <div className="promo-section-label">लेख कहाँ से लें</div>
        <div className="promo-source-options">
          <label>
            <input
              type="radio"
              name="article-source"
              value="manual"
              checked={articleSource === "manual"}
              onChange={() => setArticleSource("manual")}
            />
            खुद लिखें
          </label>
          <label>
            <input
              type="radio"
              name="article-source"
              value="category"
              checked={articleSource === "category"}
              onChange={() => setArticleSource("category")}
            />
            मौजूदा श्रेणी से लें
          </label>
        </div>

        {articleSource === "category" ? (
          <>
            <div className="promo-section-label">श्रेणी चुनें</div>
            <div className="generation-category-grid">
              {NEWSWIRE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={(state.category as string) === cat ? "selected" : ""}
                  onClick={() => dispatch({ type: "SET_CATEGORY", category: cat })}
                >
                  {cat}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {error ? <p className="generation-wizard-error">{error}</p> : null}

        <div className="generation-wizard-actions">
          <button type="button" className="secondary" onClick={() => setPhase("upload")}>
            वापस
          </button>
          {articleSource === "manual" ? (
            <button
              type="button"
              className="primary"
              onClick={() => setPhase("manual-slots")}
            >
              लेख जोड़ें →
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => setPhase("style")}
            >
              स्टाइल लेआउट →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Phase: Manual Slots
  if (phase === "manual-slots") {
    return (
      <div className="generation-wizard-screen">
        <div className="promo-panel-back-row">
          <button type="button" className="editorial-back-btn" onClick={() => setPhase("article-source")}>
            <ChevronLeft size={14} /> वापस
          </button>
          <span className="promo-remaining-info">
            {manualArticleCount} लेख बॉक्स में लेख जोड़ें
          </span>
        </div>

        <div className="editorial-slots-list">
          {manualPasteTexts.map((_, index) => (
            <div key={index} className={`editorial-slot-card${manualStories[index] ? " assigned" : ""}`}>
              <div className="editorial-slot-header">
                <span className="editorial-slot-number">□ लेख {index + 1}</span>
                {manualStories[index] ? (
                  <span className="editorial-slot-badge">भरा गया</span>
                ) : (
                  <span className="editorial-slot-badge empty">खाली</span>
                )}
              </div>
              <textarea
                className="editorial-slot-paste"
                placeholder={`यहाँ लेख ${index + 1} पेस्ट करें…\nपहली पंक्ति हेडलाइन बन जाएगी।`}
                value={manualPasteTexts[index] ?? ""}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  handleManualPaste(index, e.target.value)
                }
                rows={3}
              />
              <div className="editorial-slot-image-upload" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", gap: 6, alignItems: "center" }}>
                  <ImageIcon size={14} />
                  <span>तस्वीर जोड़ें (वैकल्पिक)</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleManualImage(index, e.target.files?.[0] ?? null)}
                    style={{ fontSize: 11, maxWidth: 180 }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="generation-wizard-error">{error}</p> : null}

        <div className="generation-wizard-actions">
          <button type="button" className="secondary" onClick={() => setPhase("article-source")}>
            वापस
          </button>
          <button
            type="button"
            className="secondary"
            disabled={generating}
            onClick={() => void handleGenerate(true)}
          >
            {generating ? (
              <><RefreshCw size={14} className="spin" /> जांच हो रही है…</>
            ) : (
              "तैयार खबरों से जांचें"
            )}
          </button>
          <button
            type="button"
            className="primary"
            disabled={articleSource === "manual" && manualPasteTexts.some((t) => !t.trim())}
            onClick={() => setPhase("style")}
          >
            स्टाइल लेआउट →
          </button>
        </div>
      </div>
    );
  }

  // Phase: Style Options
  if (phase === "style") {
    const accentPresets = NEWSWIRE_SUBHEADING_PRESETS.filter((p) => (p.id as string) !== "inline-default");

    return (
      <div className="generation-wizard-screen">
        <div className="promo-panel-back-row">
          <button type="button" onClick={() => setPhase(articleSource === "manual" ? "manual-slots" : "article-source")} className="ghost">
            <ChevronLeft size={16} /> वापस
          </button>
          <span>लेआउट स्टाइल विकल्प</span>
        </div>

        <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8f9fa", borderRadius: 8, border: "1.5px solid #d0d7de" }}>
          {/* Subheading Accent & Background Colour Picker */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span>सबहेडिंग पृष्ठभूमि रंग</span>
              <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>फॉर्मेटिंग</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
              {accentPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => dispatch({ type: "SET_SUBHEADING_STYLE", style: preset })}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                    border: state.subheadingStyle?.id === preset.id ? "2px solid #1565c0" : "1px solid #ccc",
                    borderRadius: 4,
                    background: state.subheadingStyle?.id === preset.id ? "#e3f2fd" : "#fff",
                    cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#222",
                  }}
                  title={preset.label}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: preset.backgroundColor, border: `1px solid ${preset.borderColor}`, display: "inline-block" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preset.label}</span>
                </button>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#444", fontWeight: 600 }}>
              <span>सबहेडिंग की गहराई</span>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={state.subheadingOpacity ?? 100}
                onChange={(e) => dispatch({ type: "SET_SUBHEADING_OPACITY", opacity: Number(e.target.value) })}
                style={{ flex: 1, cursor: "pointer", accentColor: "#1565c0" }}
              />
              <strong style={{ minWidth: 36, textAlign: "right" }}>{state.subheadingOpacity ?? 100}%</strong>
            </label>
          </div>

          <div style={{ paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
              <input
                type="checkbox"
                checked={colouredHeadings}
                onChange={(e) => setColouredHeadings(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#1565c0" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>रंगीन हेडलाइन</span>
                <span style={{ fontSize: 10, background: "#e3f2fd", color: "#1565c0", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>एडिटोरियल स्टाइल</span>
              </span>
            </label>
            <p style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.45, margin: "4px 0 0 28px" }}>
              पेशेवर एडिटोरियल हेडलाइन स्टाइलिंग जोड़ता है (लगभग 25% खबरों को गहरा लाल, गहरा नीला, या गहरा हरा रंग मिलता है)।
            </p>
          </div>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
              <input
                type="checkbox"
                checked={tintedStoryBackground}
                onChange={(e) => setTintedStoryBackground(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#2e7d32" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>हल्के रंग की पृष्ठभूमि</span>
                <span style={{ fontSize: 10, background: "#e8f5e9", color: "#2e7d32", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>विज़ुअल हायरार्की</span>
              </span>
            </label>
            <p style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.45, margin: "4px 0 0 28px" }}>
              बेहतर विज़ुअल हायरार्की के लिए चुने गए अख़बार पैलेट को हल्के रंग की पृष्ठभूमि के तौर पर लगाता है।
            </p>
          </div>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e0e0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111" }}>
              <input
                type="checkbox"
                checked={professionalJustification}
                onChange={(e) => setProfessionalJustification(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#8b1e1e" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>प्रोफेशनल जस्टिफिकेशन</span>
                <span style={{ fontSize: 10, background: "#ffebee", color: "#c62828", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>टाइपोग्राफी</span>
              </span>
            </label>
            <p style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.45, margin: "4px 0 0 28px" }}>
              घने अख़बार कॉलम के लिए अपने-आप हाइफ़नेशन के साथ पूरी जस्टिफिकेशन लागू करता है।
            </p>
          </div>
        </div>

        {error ? <p className="generation-wizard-error">{error}</p> : null}

        <div className="generation-wizard-actions">
          <button type="button" className="secondary" onClick={() => setPhase(articleSource === "manual" ? "manual-slots" : "article-source")}>
            वापस
          </button>
          <button
            type="button"
            className="secondary"
            disabled={generating}
            onClick={() => void handleGenerate(true)}
          >
            {generating ? (
              <><RefreshCw size={14} className="spin" /> जांच हो रही है…</>
            ) : (
              "तैयार खबरों से जांचें"
            )}
          </button>
          <button
            type="button"
            className="primary"
            disabled={generating}
            onClick={() => void handleGenerate(false)}
          >
            {generating ? (
              <><RefreshCw size={14} className="spin" /> बन रहा है…</>
            ) : (
              "विज्ञापन पेज बनाएं"
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
});
