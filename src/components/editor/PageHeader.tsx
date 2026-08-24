"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  getHeaderBandHeight,
  getHeaderBannerSource,
  resolveHeaderKind,
} from "@/engines/HeaderSystem/HeaderGeometry";
import {
  getFrontHeaderOverlayGeometry,
  getInsideHeaderOverlayGeometry,
} from "@/engines/HeaderSystem/HeaderSlotGeometry";
import {
  AKHAND_TEASER_IMAGE_BOX_FRACTION,
  isAkhandDootHeaderUrl,
  isLiveHeaderSvgUrl,
  resolveFrontHeaderSvgSource,
  resolveInsideHeaderSvgSource,
  type FrontHeaderDynamicValues,
  type InsideHeaderDynamicValues,
} from "@/engines/HeaderSystem/HeaderSvgTemplate";
import type { ResolvedHeaderSlot, ResolvedPageHeader } from "@/types/header";
import type { PageMaster, PageType } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

type PageHeaderProps = {
  pageMaster: PageMaster;
  pageType?: PageType;
  newspaperName?: string;
  dateLabel?: string;
  edition?: string;
  pageNumber?: number;
  sectionName?: string;
  resolvedHeader?: ResolvedPageHeader | null;
  masterHeaderEnabled?: boolean;
  logoSource?: string;
  frontHeaderTeaser?: {
    headline: string;
    imageUrl: string;
  } | null;
  /** Akhand Doot's live front SVG template only -- opens the same replace-image popup other images use, scoped to its masthead promo teaser photo (see setFrontTeaserImageOverride). */
  onRequestFrontTeaserReplace?: (clientX: number, clientY: number) => void;
};

const toPoints = (inches: number) => inches * POINTS_PER_INCH;
const fontFamilyForSlot = (slot: ResolvedHeaderSlot) =>
  slot.fontFamily === "serif"
    ? getNewspaperFontStack("serif")
    : slot.fontFamily === "condensed"
      ? "Arial Narrow, Arial, sans-serif"
      : "Arial, sans-serif";

function HeaderSlotText({
  slot,
  x,
  y,
  width,
  height,
}: {
  slot: ResolvedHeaderSlot;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  if (!slot.text) {
    return null;
  }

  return (
    <Text
      x={x}
      y={y}
      width={width}
      height={height}
      text={slot.text}
      fill={slot.color}
      fontFamily={fontFamilyForSlot(slot)}
      fontSize={slot.fontSize}
      fontStyle={slot.fontWeight === "bold" ? "bold" : "normal"}
      align={slot.align}
      wrap="none"
      // No `ellipsis`: these boxes are sized from the reference PSD's own
      // glyphs in its own (unknown/unextractable) typeface. A substitute web
      // font at the same box width can measure a few px wider for the same
      // short string, and silently clipping "BHOPAL" down to "BHOP…" is a
      // worse failure than letting it overflow the box by a few px into the
      // surrounding white space.
      listening={false}
    />
  );
}

function HeaderLogo({
  source,
  x,
  y,
  width,
  height,
}: {
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }

    let active = true;
    const nextImage = new window.Image();

    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => {
      if (active) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (active) {
        setImage(null);
      }
    };
    nextImage.src = source;

    return () => {
      active = false;
    };
  }, [source]);

  if (!image) {
    return null;
  }

  const imageRatio = image.width / Math.max(1, image.height);
  const frameRatio = width / Math.max(1, height);
  const drawWidth = imageRatio > frameRatio ? width : height * imageRatio;
  const drawHeight = imageRatio > frameRatio ? width / imageRatio : height;

  return (
    <KonvaImage
      image={image}
      x={x + (width - drawWidth) / 2}
      y={y + (height - drawHeight) / 2}
      width={drawWidth}
      height={drawHeight}
      listening={false}
    />
  );
}

function HeaderBannerImage({
  source,
  x,
  y,
  width,
  height,
  opacity = 0.9,
}: {
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }

    let active = true;
    const nextImage = new window.Image();

    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => {
      if (active) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (active) {
        setImage(null);
      }
    };
    nextImage.src = source;

    return () => {
      active = false;
    };
  }, [source]);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={opacity}
      listening={false}
    />
  );
}

/**
 * When the banner is a live SVG template (see HeaderSvgTemplate.ts),
 * resolves the actual image source to a version with today's real values
 * substituted in. For a plain raster banner (or when `values` is null,
 * i.e. the other header kind), just passes the URL through unchanged — safe
 * to call unconditionally every render regardless of which kind is active.
 */
function useLiveHeaderBannerSource<Values>(
  templateUrl: string | undefined,
  values: Values | null,
  resolve: (templateUrl: string, values: Values) => Promise<string>,
): string | undefined {
  const isLive = isLiveHeaderSvgUrl(templateUrl) && Boolean(values);
  const [resolvedSource, setResolvedSource] = useState<string | undefined>(
    isLive ? undefined : templateUrl,
  );
  // Small flat objects of strings — stringifying is a simple, correct way to
  // depend on "did any field change" without hardcoding each field name for
  // both the front and inside value shapes this hook serves.
  const valuesKey = values ? JSON.stringify(values) : null;

  useEffect(() => {
    if (!templateUrl || !isLiveHeaderSvgUrl(templateUrl) || !values) {
      setResolvedSource(templateUrl);
      return;
    }

    let active = true;
    resolve(templateUrl, values)
      .then((dataUrl) => {
        if (active) setResolvedSource(dataUrl);
      })
      .catch(() => {
        // Falls back to the raw (un-substituted) template rather than a
        // blank banner — the artwork still shows, just with whatever
        // example values the designer last saved in it.
        if (active) setResolvedSource(templateUrl);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateUrl, valuesKey]);

  return resolvedSource;
}

export function PageHeader({
  pageMaster,
  pageType,
  newspaperName = "THE CLIFF NEWS",
  dateLabel = "13 June 2026",
  edition = "National Edition",
  pageNumber = 1,
  sectionName = "City",
  resolvedHeader = null,
  masterHeaderEnabled = false,
  logoSource,
  frontHeaderTeaser = null,
  onRequestFrontTeaserReplace,
}: PageHeaderProps) {
  // The masthead/folio banner used to bleed edge-to-edge (x=0, full page
  // width) while every body column below it sits inset by the page's own
  // content margins -- confirmed live, that left/right mismatch reads as a
  // visible gap between the header's own edge text and the columns below.
  // Aligning the header to the same content box the body already uses
  // fixes it for every publisher at once, not just whichever one's own
  // artwork made the gap obvious.
  const headerX = toPoints(pageMaster.contentX);
  const headerWidth = toPoints(pageMaster.contentWidth);

  // A managed header set wins when one is active; otherwise the band comes from
  // the page kind — the ~6.1cm masthead on a front page, the ~1.9cm folio strip
  // everywhere else.
  const headerKind = resolvedHeader?.header.kind ?? resolveHeaderKind(pageType);
  const resolvedHeight = resolvedHeader?.header.height ?? getHeaderBandHeight(headerKind);
  const headerBannerSource =
    resolvedHeader?.header.headerImageUrl ?? getHeaderBannerSource(headerKind);

  // Resolved text for the fields each live SVG template's own <text>
  // elements get substituted with — null (and thus a no-op) unless this page
  // is that kind with a managed header.
  const frontDynamicValues: FrontHeaderDynamicValues | null =
    resolvedHeader?.header.kind === "front"
      ? {
          place: resolvedHeader.header.eyebrowLeft.text,
          day: resolvedHeader.header.eyebrowRight.text,
          dateNumber: resolvedHeader.header.skyline.text,
          monthYear: resolvedHeader.header.footerLine.text,
          year: resolvedHeader.header.leftEar.text,
          volume: resolvedHeader.header.rightEar.text,
          issue: resolvedHeader.issueLabel,
          teaserHeadline: frontHeaderTeaser?.headline,
          teaserImageUrl: frontHeaderTeaser?.imageUrl,
        }
      : null;
  // `right.text` is already the combined "{{city}},{{day}} {{dayOfMonth}}
  // {{monthYear}}" string (see HeaderDefaults.ts) — city comes from the
  // publisher's own profile and only changes if they edit it; day/date/
  // month/year are recomputed fresh every time regardless.
  const insideDynamicValues: InsideHeaderDynamicValues | null =
    resolvedHeader?.header.kind === "inside"
      ? {
          category: resolvedHeader.header.left.text,
          placeAndDate: resolvedHeader.header.right.text,
          pageNumber: String(resolvedHeader.pageNumber),
          publicationName: resolvedHeader.header.center.text,
        }
      : null;
  // Both hooks must run every render regardless of the early return below
  // (rules of hooks) — each is a no-op pass-through unless its own kind is
  // the active, live-SVG one, so only one ever actually resolves anything.
  const liveFrontBannerSource = useLiveHeaderBannerSource(headerBannerSource, frontDynamicValues, resolveFrontHeaderSvgSource);
  const liveInsideBannerSource = useLiveHeaderBannerSource(headerBannerSource, insideDynamicValues, resolveInsideHeaderSvgSource);
  const liveHeaderBannerSource = frontDynamicValues
    ? liveFrontBannerSource
    : insideDynamicValues
      ? liveInsideBannerSource
      : headerBannerSource;

  if (masterHeaderEnabled && !resolvedHeader) {
    return null;
  }

  // Akhand Doot's own live SVG template bakes a promo teaser photo into the
  // masthead art at a fixed spot -- everything else in this header is
  // flattened into one banner image (see HeaderBannerImage below), so
  // there's no individual Konva node for just that photo to attach a click
  // handler to. This draws an invisible hit-target Rect over that exact box
  // instead (geometry shared with the SVG patcher itself, see
  // AKHAND_TEASER_IMAGE_BOX_FRACTION), giving it the same click-to-replace
  // popup every other image already has.
  const showFrontTeaserClickTarget =
    Boolean(onRequestFrontTeaserReplace) &&
    resolvedHeader?.header.kind === "front" &&
    isAkhandDootHeaderUrl(headerBannerSource);

  return (
    <>
    <Group listening={false} name="protected-master-header" x={headerX}>
      <HeaderBannerImage
        source={liveHeaderBannerSource}
        x={0}
        y={0}
        width={headerWidth}
        height={resolvedHeight}
        opacity={0.95}
      />
      {resolvedHeader?.header.kind === "front" && !isLiveHeaderSvgUrl(resolvedHeader.header.headerImageUrl)
        ? (() => {
            const front = resolvedHeader.header;
            const geometry = getFrontHeaderOverlayGeometry(headerWidth, resolvedHeight, front.maskColors);

            return (
              <>
                {geometry.maskBands.map((band, index) => (
                  <Rect
                    key={`header-mask-${index}`}
                    x={band.x}
                    y={band.y}
                    width={band.width}
                    height={band.height}
                    fill={band.fill}
                    listening={false}
                  />
                ))}
                <HeaderSlotText slot={front.eyebrowLeft} {...geometry.eyebrowLeft} />
                <HeaderSlotText slot={front.eyebrowRight} {...geometry.eyebrowRight} />
                <HeaderSlotText slot={front.skyline} {...geometry.dateNumber} />
                <HeaderSlotText slot={front.footerLine} {...geometry.monthYear} />
                <HeaderSlotText slot={front.leftEar} {...geometry.yearBlock} />
                <HeaderSlotText slot={front.rightEar} {...geometry.volumeBlock} />
              </>
            );
          })()
        : null}
      {resolvedHeader?.header.kind === "inside" && !isLiveHeaderSvgUrl(resolvedHeader.header.headerImageUrl)
        ? (() => {
            const inside = resolvedHeader.header;
            const geometry = getInsideHeaderOverlayGeometry(headerWidth, resolvedHeight, inside.maskColors);

            return (
              <>
                {geometry.maskBands.map((band, index) => (
                  <Rect
                    key={`header-mask-${index}`}
                    x={band.x}
                    y={band.y}
                    width={band.width}
                    height={band.height}
                    fill={band.fill}
                    listening={false}
                  />
                ))}
                <HeaderSlotText slot={inside.right} {...geometry.dateline} />
              </>
            );
          })()
        : null}
    </Group>
    {showFrontTeaserClickTarget ? (
      <Rect
        x={headerX + headerWidth * AKHAND_TEASER_IMAGE_BOX_FRACTION.x}
        y={resolvedHeight * AKHAND_TEASER_IMAGE_BOX_FRACTION.y}
        width={headerWidth * AKHAND_TEASER_IMAGE_BOX_FRACTION.width}
        height={resolvedHeight * AKHAND_TEASER_IMAGE_BOX_FRACTION.height}
        fill="transparent"
        onClick={(evt) => onRequestFrontTeaserReplace?.(evt.evt.clientX, evt.evt.clientY)}
        onContextMenu={(evt) => onRequestFrontTeaserReplace?.(evt.evt.clientX, evt.evt.clientY)}
      />
    ) : null}
    </>
  );
}
