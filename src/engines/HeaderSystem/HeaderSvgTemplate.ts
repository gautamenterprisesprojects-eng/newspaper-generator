/**
 * HeaderSvgTemplate
 *
 * A "live" header banner: an SVG export (Illustrator/Figma/etc.) of the
 * publisher's own masthead, exactly as designed — same background art, same
 * fonts, same positions — except its day/date/month/year/volume/city (front)
 * or category/city+date/page-number (inside) text layers are real, live
 * `<text>` elements instead of flattened pixels. No mask-and-redraw is
 * needed for these: swapping the values IS the update, so the substituted
 * SVG is used as the banner image directly (see PageHeader.tsx /
 * HeaderPrintModel.ts skipping the overlay/mask draw whenever
 * `headerImageUrl` ends in `.svg`).
 *
 * Field identification is positional (document order of `<text>` elements),
 * not by id — these Illustrator exports carry no ids, but do preserve the
 * source PSD's own layer order exactly. Confirmed by direct inspection of
 * front-header-live.svg (six `<text>` elements) and inside-header-live.svg
 * (three). A publisher whose export uses a different tool/order would need
 * this order re-confirmed — this is not a universal, self-describing
 * contract, it's Cliff News's own two files.
 */

export type FrontHeaderDynamicValues = {
  place: string;
  day: string;
  dateNumber: string;
  monthYear: string;
  year: string;
  volume: string;
  issue?: string;
  teaserHeadline?: string;
  teaserImageUrl?: string;
};
type FrontHeaderTemplateField = Exclude<keyof FrontHeaderDynamicValues, "issue" | "teaserHeadline" | "teaserImageUrl">;

export type InsideHeaderDynamicValues = {
  category: string;
  /** "Bhopal,Monday 10 August 2026" — city (set once by the publisher, never changes here) + the day's live day/date/month/year, built by the caller as one string because the source file carries them as a single text layer. */
  placeAndDate: string;
  pageNumber: string;
};

/** Document order of the six `<text>` elements in front-header-live.svg. */
const FRONT_FIELD_ORDER: FrontHeaderTemplateField[] = [
  "year",
  "volume",
  "dateNumber",
  "place",
  "day",
  "monthYear",
];

/** Document order of the three `<text>` elements in inside-header-live.svg. */
const INSIDE_FIELD_ORDER: Array<keyof InsideHeaderDynamicValues> = [
  "category",
  "placeAndDate",
  "pageNumber",
];

/**
 * The day-of-month number and the day name sit inside narrow decorative
 * boxes in the reference art (a highlighted date chip, a name band) — the
 * source file's own text x-position is a left edge sized for its original
 * example values ("10", "MONDAY"), which reads off-centre once substituted
 * with a different-width value ("14", "FRIDAY"). Centred here instead, using
 * each box's real width from front header.psd's own layer bounds (converted
 * px->pt at the file's 300dpi: box_px * 72 / 300), independent of whatever
 * length the live value happens to be.
 */
const FRONT_FIELD_CENTER_X: Partial<Record<FrontHeaderTemplateField, number>> = {
  dateNumber: 62.04, // PSD "date" layer: left 222px, right 295px @300dpi -> 53.28-70.8pt, centre 62.04pt
  day: 71.64, // PSD "day" layer: left 142px, right 455px @300dpi -> 34.08-109.2pt, centre 71.64pt
};

const HINDI_DAYS: Record<string, string> = {
  sunday: "रविवार",
  monday: "सोमवार",
  tuesday: "मंगलवार",
  wednesday: "बुधवार",
  thursday: "गुरुवार",
  friday: "शुक्रवार",
  saturday: "शनिवार",
};
const HINDI_MONTHS: Record<string, string> = {
  january: "जनवरी",
  february: "फरवरी",
  march: "मार्च",
  april: "अप्रैल",
  may: "मई",
  june: "जून",
  july: "जुलाई",
  august: "अगस्त",
  september: "सितंबर",
  october: "अक्टूबर",
  november: "नवंबर",
  december: "दिसंबर",
};

const AKHAND_INSIDE_CATEGORY_LABELS: Record<string, string> = {
  national: "राष्ट्रीय",
  "madhya pradesh": "मध्य प्रदेश",
  international: "देश-विदेश",
  sports: "खेल और खिलाड़ी",
  business: "व्यापार",
  health: "सेहत",
  entertainment: "मनोरंजन",
  classified: "आस-पास",
  classifieds: "आस-पास",
  "aas paas": "आस-पास",
  "ass pass": "आस-पास",
  "आस-पास": "आस-पास",
  editorial: "संपादकीय",
  "front page": "मुख्य पृष्ठ",
};

/**
 * Same left-edge-sized-for-the-original-example problem as the front
 * header's date/day boxes above, for the inside header's page-number badge
 * — "12" (two digits) sat centred-looking at its original left position,
 * but a single-digit live value ("3") reads shoved to the box's left edge.
 * Centred using inside header.psd's own "page number" layer bounds (left
 * 52px, right 141px @300dpi -> 12.48-33.84pt, centre 23.16pt).
 */
const INSIDE_FIELD_CENTER_X: Partial<Record<keyof InsideHeaderDynamicValues, number>> = {
  pageNumber: 23.16,
};

const escapeXmlText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeXmlAttribute = (text: string) =>
  escapeXmlText(text).replace(/"/g, "&quot;");

const textContentPattern = /(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g;

const stripXmlTags = (value: string) => value.replace(/<[^>]+>/g, "").trim();

const firstAsciiNumber = (value: string | undefined): string => {
  const match = value?.match(/\d+/);
  return match?.[0] ?? "";
};

const localizeHindiDateWords = (value: string): string => {
  const withDay = value.replace(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi, (day) => HINDI_DAYS[day.toLowerCase()] ?? day);
  return withDay.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, (month) => HINDI_MONTHS[month.toLowerCase()] ?? month);
};

const buildHindiDayDate = (values: FrontHeaderDynamicValues): string => {
  const combined = `${values.day} ${values.dateNumber} ${values.monthYear}`.replace(/\s+/g, " ").trim();
  return localizeHindiDateWords(combined);
};

export const isAkhandDootHeaderUrl = (url: string): boolean =>
  /akhand(?:%20|\+|\s|-)*doot/i.test(url);

// The teaser image box's bounds (x=796.8 y=9.36 width=112.08 height=83.28),
// as fractions of the raw SVG's own viewBox ("0 0 920.4 169.7") -- shared
// with the editor's click-to-replace overlay (PageHeader.tsx) so the
// clickable hit target and the box this file actually draws the photo into
// can never drift apart, whatever size the header is rendered at on screen.
export const AKHAND_TEASER_IMAGE_BOX_FRACTION = {
  x: 796.8 / 920.4,
  y: 9.36 / 169.7,
  width: 112.08 / 920.4,
  height: 83.28 / 169.7,
};

/** Rewrites `transform="matrix(1 0 0 1 X Y)"`'s X (5th value) to `newX`, keeping Y untouched. Leaves the tag as-is if it doesn't match that exact shape. */
const rewriteTransformX = (openTag: string, newX: number): string =>
  openTag.replace(/matrix\(([^)]+)\)/, (match, inner: string) => {
    const parts = inner.trim().split(/\s+/);
    if (parts.length !== 6) {
      return match;
    }
    parts[4] = String(newX);
    return `matrix(${parts.join(" ")})`;
  });

/** Adds (or overwrites) `text-anchor="middle"` on a `<text ...>` opening tag. */
const withCenterAnchor = (openTag: string): string =>
  /text-anchor="[^"]*"/.test(openTag)
    ? openTag.replace(/text-anchor="[^"]*"/, 'text-anchor="middle"')
    : openTag.replace(/^<text\b/, '<text text-anchor="middle"');

const withTextLength = (openTag: string, textLength: number): string => {
  const withoutExistingLength = openTag
    .replace(/\s+textLength="[^"]*"/g, "")
    .replace(/\s+lengthAdjust="[^"]*"/g, "");
  return withoutExistingLength.replace(
    /^<text\b/,
    `<text textLength="${textLength}" lengthAdjust="spacingAndGlyphs"`,
  );
};

const withFontWeight = (openTag: string, weight = "800"): string => {
  const withAttribute = /font-weight="[^"]*"/.test(openTag)
    ? openTag.replace(/font-weight="[^"]*"/, `font-weight="${weight}"`)
    : openTag.replace(/^<text\b/, `<text font-weight="${weight}"`);

  if (/style="[^"]*"/.test(withAttribute)) {
    return withAttribute.replace(/style="([^"]*)"/, (_match, style: string) => {
      const withoutWeight = style
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !part.toLowerCase().startsWith("font-weight:"))
        .join("; ");
      return `style="${withoutWeight ? `${withoutWeight}; ` : ""}font-weight:${weight}"`;
    });
  }

  return withAttribute.replace(/^<text\b/, `<text style="font-weight:${weight}"`);
};

const resolveSvgImageHref = (source: string): string => {
  if (source.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${source}`;
  }
  return source;
};

// The caption box, in the SVG's own absolute coordinate space -- matches
// the "_x0D_टीज़र_टेक्स्ट" group's own <rect x="796.8" y="92.6" width="112.1"
// height="45.1"/> bounding box exactly (see the raw SVG), not re-derived.
const AKHAND_TEASER_BOX_X = 796.8;
const AKHAND_TEASER_BOX_WIDTH = 112.1;
const AKHAND_TEASER_BOX_Y = 92.6;
const AKHAND_TEASER_BOX_HEIGHT = 45.1;
const AKHAND_TEASER_TEXT_CENTER_X = AKHAND_TEASER_BOX_X + AKHAND_TEASER_BOX_WIDTH / 2;
const AKHAND_TEASER_TEXT_PADDING_X = 4;
const AKHAND_TEASER_TEXT_PADDING_Y = 3;

// No real font-metrics/canvas measurement is available where this SVG text
// gets built (a plain string patch, not a rendered DOM) -- this is an
// empirical average glyph-advance width for the caption's Devanagari/Latin
// mix, as a multiple of font-size. Wrapping and the fit search below are
// therefore estimates, not exact, so a small safety margin keeps them
// erring toward wrapping/shrinking a touch early rather than overflowing.
const AKHAND_TEASER_AVG_CHAR_WIDTH_FACTOR = 0.58;

const estimateAkhandTeaserTextWidth = (text: string, fontSize: number) =>
  text.length * fontSize * AKHAND_TEASER_AVG_CHAR_WIDTH_FACTOR;

const wrapAkhandTeaserHeadline = (headline: string, fontSize: number, maxWidth: number): string[] => {
  const words = headline.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word];
    if (current.length > 0 && estimateAkhandTeaserTextWidth(candidate.join(" "), fontSize) > maxWidth) {
      lines.push(current.join(" "));
      current = [word];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    lines.push(current.join(" "));
  }

  return lines;
};

const AKHAND_TEASER_MAX_FONT_SIZE = 9;
const AKHAND_TEASER_MIN_FONT_SIZE = 4.2;

/**
 * Picks the largest font size (searched top-down, in 0.2pt steps) whose
 * word-wrapped headline still fits the box's available height -- a short
 * headline naturally lands on a bigger size (filling leftover white space),
 * a long one wraps into more lines and lands on a smaller size (shrinking
 * to fit) from the very same search, rather than two separate grow/shrink
 * branches that could disagree with each other.
 */
const fitAkhandTeaserHeadline = (headline: string): { lines: string[]; fontSize: number; lineHeight: number } => {
  const maxWidth = AKHAND_TEASER_BOX_WIDTH - AKHAND_TEASER_TEXT_PADDING_X * 2;
  const maxHeight = AKHAND_TEASER_BOX_HEIGHT - AKHAND_TEASER_TEXT_PADDING_Y * 2;

  for (let fontSize = AKHAND_TEASER_MAX_FONT_SIZE; fontSize >= AKHAND_TEASER_MIN_FONT_SIZE; fontSize -= 0.2) {
    const lines = wrapAkhandTeaserHeadline(headline, fontSize, maxWidth);
    const lineHeight = fontSize * 1.18;
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize: Number(fontSize.toFixed(1)), lineHeight };
    }
  }

  // Even the minimum size doesn't fit the height -- still render it (a
  // slightly overflowing caption beats one that silently disappears), same
  // "render what actually fits, don't pad or fail" philosophy the batch
  // import loop elsewhere in this codebase already follows.
  const lines = wrapAkhandTeaserHeadline(headline, AKHAND_TEASER_MIN_FONT_SIZE, maxWidth);
  return { lines, fontSize: AKHAND_TEASER_MIN_FONT_SIZE, lineHeight: AKHAND_TEASER_MIN_FONT_SIZE * 1.18 };
};

// A justified line (stretched word-gaps to reach both edges) reads too
// sparse at this box's width -- 2-3 short words per line, so the resulting
// gaps were huge. Centered instead, same as before, but now on top of the
// dynamic font-fit search below (fitAkhandTeaserHeadline) rather than the
// old fixed-range sizing.
const buildAkhandTeaserLine = (line: string, fontSize: number, y: number): string =>
  `<text x="${AKHAND_TEASER_TEXT_CENTER_X}" y="${y}" class="st1" font-size="${fontSize.toFixed(1)}" font-weight="400" fill="#111111" text-anchor="middle">${escapeXmlText(line)}</text>`;

const buildAkhandTeaserHeadlineText = (headline: string): string => {
  const { lines, fontSize, lineHeight } = fitAkhandTeaserHeadline(headline);
  const availableHeight = AKHAND_TEASER_BOX_HEIGHT - AKHAND_TEASER_TEXT_PADDING_Y * 2;
  const blockHeight = lines.length * lineHeight;
  // Center the text block vertically in the box -- leftover space (a short
  // headline rendered below the box's max font size) splits evenly top and
  // bottom instead of pooling at the bottom.
  const startY = AKHAND_TEASER_BOX_Y + AKHAND_TEASER_TEXT_PADDING_Y + Math.max(0, (availableHeight - blockHeight) / 2) + fontSize;

  const renderedLines = lines
    .map((line, index) => {
      const y = Number((startY + index * lineHeight).toFixed(2));
      return buildAkhandTeaserLine(line, fontSize, y);
    })
    .join("");

  return `<g>${renderedLines}</g>`;
};

const replaceAkhandTeaserHeadline = (svgText: string, headline: string | undefined): string => {
  // Newswire headlines carry a trailing full stop (either the Hindi danda
  // "।" or an ASCII ".") that reads fine at sentence length but looks like
  // stray punctuation on this short, centered, multi-line caption -- so it's
  // dropped here rather than at the source, where full sentences elsewhere
  // (story bodies, etc.) still want it.
  const normalized = headline?.replace(/\s+/g, " ").trim().replace(/[।.]+\s*$/, "").trim();
  if (!normalized) {
    return svgText;
  }

  return svgText.replace(
    /<text\b(?=[^>]*\btransform="matrix\(1 0 0 1 796\.7996 122\.6447\)")[\s\S]*?<\/text>/,
    buildAkhandTeaserHeadlineText(normalized),
  );
};

const replaceAkhandTeaserImage = (svgText: string, imageUrl: string | undefined): string => {
  const resolved = resolveSvgImageHref(imageUrl?.trim() ?? "");
  if (!resolved) {
    return svgText;
  }

  return svgText.replace(
    /<image\b[^>]*\bid="teaser_image_xA0_Image"[^>]*>/,
    (tag) => {
      const transformMatch = tag.match(/\btransform="[^"]*"/);
      const transform = transformMatch ? ` ${transformMatch[0]}` : "";
      // A live news photo's own aspect ratio almost never matches this
      // fixed 467x347 box exactly. The default SVG fit ("meet") shrinks the
      // photo to fit inside the box and letterboxes the leftover space --
      // which here isn't blank, it's the masthead's own background artwork
      // (a marigold/decorative texture) showing through the gap, reading as
      // something "hiding" part of the photo. "slice" + overflow:hidden
      // crops the photo to fully cover the box instead, same as CSS
      // object-fit: cover, with the crop itself clipped back to the box so
      // it can't spill into the surrounding header art either.
      return `<image style="overflow:hidden;" width="467" height="347" id="teaser_image_xA0_Image" preserveAspectRatio="xMidYMid slice" xlink:href="${escapeXmlAttribute(resolved)}"${transform}>`;
    },
  );
};

/**
 * Replaces each known `<text>...</text>` body with today's real value, in
 * document order — regex over the raw SVG text rather than a full DOM
 * parse, safe here because the match is scoped to exactly `<text>` element
 * bodies and each file's structure (how many, this order) is known and
 * pinned, not arbitrary third-party input. Any `<text>` beyond the expected
 * fields is left untouched. `centerX` optionally re-centres specific fields
 * (see FRONT_FIELD_CENTER_X) instead of leaving the source file's own
 * left-anchored position, which was sized for its original example text.
 */
const applyDynamicValues = <Field extends string>(
  svgText: string,
  fieldOrder: Field[],
  values: Record<Field, string>,
  centerX?: Partial<Record<Field, number>>,
): string => {
  let index = 0;

  return svgText.replace(textContentPattern, (match, open: string, _body: string, close: string) => {
    const field = fieldOrder[index];
    index += 1;

    if (!field) {
      return match;
    }

    const centerAt = centerX?.[field];
    const patchedOpen = centerAt === undefined ? open : withCenterAnchor(rewriteTransformX(open, centerAt));

    return `${patchedOpen}${escapeXmlText(values[field])}${close}`;
  });
};

export const applyFrontHeaderDynamicValues = (
  svgText: string,
  values: FrontHeaderDynamicValues,
): string => applyDynamicValues(svgText, FRONT_FIELD_ORDER, values, FRONT_FIELD_CENTER_X);

export const applyAkhandFrontHeaderDynamicValues = (
  svgText: string,
  values: FrontHeaderDynamicValues,
): string => {
  const patchedText = svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    const normalizedOriginal = original.replace(/\s+/g, " ").trim();
    const next = normalizedOriginal === "15"
      ? firstAsciiNumber(values.year) || original
      : normalizedOriginal === "152"
        ? firstAsciiNumber(values.issue) || original
        : normalizedOriginal.includes("2026")
          ? buildHindiDayDate(values) || original
          : null;

    return next === null ? match : `${withFontWeight(open)}${escapeXmlText(next)}${close}`;
  });

  const patchedTeaserText = replaceAkhandTeaserHeadline(patchedText, values.teaserHeadline);
  return replaceAkhandTeaserImage(patchedTeaserText, values.teaserImageUrl);
};

export const applyInsideHeaderDynamicValues = (
  svgText: string,
  values: InsideHeaderDynamicValues,
): string => applyDynamicValues(svgText, INSIDE_FIELD_ORDER, values, INSIDE_FIELD_CENTER_X);

const formatAkhandInsidePlaceAndDate = (value: string): string =>
  localizeHindiDateWords(value.replace(/\s+/g, " ").trim()).replace(/^Bhopal,/i, "भोपाल,");

const formatAkhandInsideCategory = (category: string): string => {
  const normalized = category.replace(/\s+/g, " ").trim().toLowerCase();
  return AKHAND_INSIDE_CATEGORY_LABELS[normalized] ?? category.trim();
};

export const applyAkhandInsideHeaderDynamicValues = (
  svgText: string,
  values: InsideHeaderDynamicValues,
): string => {
  let index = 0;

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    const next =
      index === 0
        ? values.pageNumber || original
        : index === 1
          ? formatAkhandInsidePlaceAndDate(values.placeAndDate) || original
          : index === 2
            ? formatAkhandInsideCategory(values.category) || original
            : null;
    index += 1;

    const patchedOpen = withFontWeight(
      index === 2 ? withTextLength(open, 180) : open,
    );

    return next === null ? match : `${patchedOpen}${escapeXmlText(next)}${close}`;
  });
};

const utf8ToBase64 = (text: string) => {
  if (typeof window === "undefined") {
    return Buffer.from(text, "utf-8").toString("base64");
  }

  return window.btoa(unescape(encodeURIComponent(text)));
};

/** One fetch per URL per session — these files are hundreds of KB, no reason to re-fetch for every page/render. */
const rawSvgTextCache = new Map<string, Promise<string>>();

const fetchSvgText = (url: string): Promise<string> => {
  const cached = rawSvgTextCache.get(url);
  if (cached) {
    return cached;
  }

  const request = fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch header SVG template: ${url} (${response.status})`);
    }
    return response.text();
  });
  rawSvgTextCache.set(url, request);
  return request;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof window === "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  // window.btoa chokes on very large args passed via spread -- chunk the
  // conversion so a normal-sized news photo (tens to low hundreds of KB)
  // doesn't risk a call-stack overflow.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
};

/**
 * A browser that loads an SVG purely as an image (`new Image()`, a Konva
 * `Image` node, a canvas `drawImage` source, ...) will NOT let that SVG
 * fetch its own external sub-resources -- any `<image xlink:href="https://...">`
 * inside it silently fails to load, leaving whatever pixels were already
 * embedded in the template (the designer's own placeholder art) showing
 * instead. The only way a live-fetched photo actually paints is to inline
 * its bytes as a `data:` URI before the substitution, exactly like the
 * template's own baked-in placeholder already is. Routed through the same
 * `/api/print-image` proxy the PDF-export path uses, since a direct
 * cross-origin fetch() of the news photo would otherwise be blocked by the
 * source server's own missing CORS headers (a plain `<img>` tag tolerates
 * that; `fetch()` does not).
 */
const inlineRemoteImage = async (url: string): Promise<string | undefined> => {
  try {
    const proxied = url.startsWith("http")
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/print-image?url=${encodeURIComponent(url)}`
      : url;
    const response = await fetch(proxied);
    if (!response.ok) {
      return undefined;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await response.arrayBuffer());
    return `data:${contentType};base64,${bytesToBase64(bytes)}`;
  } catch {
    return undefined;
  }
};

/**
 * Given a live SVG template URL and today's real values, returns a
 * `data:image/svg+xml;base64,...` URL with the fields substituted — usable
 * anywhere a plain image URL is (Konva `Image`, canvas `drawImage`, `<img>`),
 * since the browser rasterises the whole SVG (embedded background + text)
 * into that box like any other image, at whatever size it's drawn.
 */
export const resolveFrontHeaderSvgSource = async (
  templateUrl: string,
  values: FrontHeaderDynamicValues,
): Promise<string> => {
  const rawSvg = await fetchSvgText(templateUrl);
  const isAkhand = isAkhandDootHeaderUrl(templateUrl);

  let resolvedValues = values;
  if (isAkhand && values.teaserImageUrl?.startsWith("http")) {
    const inlined = await inlineRemoteImage(values.teaserImageUrl);
    // Falling back to the original (un-loadable-from-inside-SVG) URL rather
    // than dropping it isn't useful here -- replaceAkhandTeaserImage would
    // just wire in a dead reference and the template's own placeholder art
    // would still be what actually shows. Skipping the swap entirely (by
    // leaving values as-is only when inlining failed) keeps that placeholder
    // visible, same as today, instead of a broken one.
    if (inlined) {
      resolvedValues = { ...values, teaserImageUrl: inlined };
    }
  }

  const patchedSvg = isAkhand
    ? applyAkhandFrontHeaderDynamicValues(rawSvg, resolvedValues)
    : applyFrontHeaderDynamicValues(rawSvg, resolvedValues);
  return `data:image/svg+xml;base64,${utf8ToBase64(patchedSvg)}`;
};

export const resolveInsideHeaderSvgSource = async (
  templateUrl: string,
  values: InsideHeaderDynamicValues,
): Promise<string> => {
  const rawSvg = await fetchSvgText(templateUrl);
  const patchedSvg = isAkhandDootHeaderUrl(templateUrl)
    ? applyAkhandInsideHeaderDynamicValues(rawSvg, values)
    : applyInsideHeaderDynamicValues(rawSvg, values);
  return `data:image/svg+xml;base64,${utf8ToBase64(patchedSvg)}`;
};

export const isLiveHeaderSvgUrl = (url: string | undefined | null): boolean =>
  Boolean(url && url.toLowerCase().endsWith(".svg"));
