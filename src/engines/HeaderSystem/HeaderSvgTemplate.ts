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
 * Field identification is positional (document order of `<text>` elements)
 * ONLY for the two pinned Cliff News template files (front-header-live.svg,
 * six elements; inside-header-live.svg, three) and for Akhand Doot's own
 * hand-confirmed order — position is not a universal, self-describing
 * contract, so any OTHER publisher's own upload goes through
 * applyGenericFrontHeaderDynamicValues/applyGenericInsideHeaderDynamicValues
 * near the bottom of this file instead, which identify fields by what their
 * existing content looks like (a date, a weekday, a lone number) rather than
 * by position.
 */

import { FRONT_HEADER_BANNER_SOURCE, INSIDE_HEADER_BANNER_SOURCE } from "./HeaderGeometry";

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
  /** Only read by the generic (non-pinned-template) matcher, to avoid overwriting a masthead-name text layer that happens to contain no digits or date -- see applyGenericInsideHeaderDynamicValues. */
  publicationName?: string;
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
const INSIDE_FIELD_ORDER: Array<Exclude<keyof InsideHeaderDynamicValues, "publicationName">> = [
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

// The Adage Times' inside header, hosted at /adage/... (see
// PageHeader.tsx/HeaderPrintModel.ts's `isLiveHeaderSvgUrl` handling) --
// per explicit publisher decision, only the page-number badge on this file
// updates live for now; category and the date/day line stay exactly as
// printed in the artwork (see applyPageNumberOnlyInsideHeaderDynamicValues).
export const isAdageInsideHeaderUrl = (url: string): boolean => /\/adage\//i.test(url);

// Hindi Ke Fool's own front/inside headers, hosted at /hindi ke fool/... --
// a monthly magazine (मासिक), so unlike every daily/weekly publisher so far
// there's no weekday or day-of-month field anywhere in either file, only a
// month+year dateline. The front header's lone digit ("08") is genuinely
// its अंक/issue number (the generic matcher already gets this right), but
// the inside header's city text ("भोपाल") sits right next to the month+year
// with no distinguishing shape of its own -- the generic matcher's "anything
// that isn't a digit/date/masthead-name is the category" rule sweeps it up
// alongside the real "CATAGORY" placeholder, overwriting the city too.
export const isHindiKeFoolHeaderUrl = (url: string): boolean =>
  /hindi(?:%20|\+|\s|-)*ke(?:%20|\+|\s|-)*fool/i.test(url);

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
 * Named-layer lookup -- the long-term replacement for guessing a field from
 * its content shape. A publisher's own SVG export preserves each text
 * layer's *name* as the id of the `<g>` wrapping it (Illustrator/Figma both
 * do this for a plain-ASCII, no-space layer name), so a designer who names
 * their layers from the fixed vocabulary below (see the publisher-facing
 * naming guide) gets deterministic matching -- no ambiguity between two
 * numbers, no risk of a differently-positioned field (date on the right in
 * one publisher's design, the left or centre in another's) being
 * misread, since position and content shape never enter into it.
 *
 * Only ever the FIRST check for a brand-new file: every existing publisher
 * template (the two pinned Cliff News files, Akhand Doot, Sach Express,
 * Hindi Ke Fool, The Adage Times) was inspected and none of their actual
 * layer ids collide with this vocabulary, so this can't change anything
 * already working -- and resolveFrontHeaderSvgSource/
 * resolveInsideHeaderSvgSource only take this path at all when the file has
 * at least one recognised name, falling through to today's per-file/generic
 * logic otherwise.
 */
const FRONT_NAMED_FIELDS = ["place", "day", "date", "ank"] as const;
const INSIDE_NAMED_FIELDS = ["place", "day", "date", "pagenumber", "category"] as const;

type NamedTextElement = {
  fullMatch: string;
  openTag: string;
  body: string;
  closeTag: string;
  layerName: string | null;
};

/** Strips a duplicate-name suffix a design tool adds when two layers share a name (Illustrator: "place_2_", "place2", ...) so both still match the same known field. */
const normalizeLayerName = (rawId: string): string => rawId.trim().toLowerCase().replace(/[_\d]+$/, "");

/**
 * Walks the SVG linearly, tracking which `<g id="...">` each `<text>`
 * element sits inside (its innermost NAMED ancestor group), without a full
 * XML parser -- safe here because the only structural facts this needs are
 * "which g's are currently open" and "what was the nearest one's id",
 * both of which a simple open/close stack over a tag-boundary scan gives
 * for free, same trust level the rest of this file already places in
 * regex-over-raw-SVG-text (see the module's own doc comment above).
 */
const scanNamedTextElements = (svgText: string): NamedTextElement[] => {
  const tagPattern = /<g\b[^>]*>|<\/g>|<text\b[^>]*>[\s\S]*?<\/text>/g;
  const gIdPattern = /\bid="([^"]*)"/;
  const textSplitPattern = /^(<text\b[^>]*>)([\s\S]*?)(<\/text>)$/;
  const stack: Array<string | null> = [];
  const results: NamedTextElement[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(svgText))) {
    const token = match[0];
    if (token === "</g>") {
      stack.pop();
      continue;
    }
    if (token.startsWith("<g")) {
      const idMatch = token.match(gIdPattern);
      stack.push(idMatch ? normalizeLayerName(idMatch[1]) : null);
      continue;
    }
    const parts = token.match(textSplitPattern);
    if (!parts) {
      continue;
    }
    let layerName: string | null = null;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i]) {
        layerName = stack[i];
        break;
      }
    }
    results.push({ fullMatch: token, openTag: parts[1], body: parts[2], closeTag: parts[3], layerName });
  }

  return results;
};

const applyNamedTextSubstitution = (
  svgText: string,
  elements: NamedTextElement[],
  resolve: (fieldName: string, element: NamedTextElement) => string | null,
): string => {
  let result = svgText;
  for (const element of elements) {
    if (!element.layerName) {
      continue;
    }
    const replacementBody = resolve(element.layerName, element);
    if (replacementBody === null) {
      continue;
    }
    const replacement = `${element.openTag}${replacementBody}${element.closeTag}`;
    result = result.replace(element.fullMatch, replacement);
  }
  return result;
};

/** Zero-pads a live digit string to match the original field's own digit width (a "08"-style field shouldn't suddenly read as a bare "8"). */
const padToOriginalWidth = (original: string, digits: string): string => {
  const originalDigits = original.replace(/\D/g, "");
  return originalDigits.length > digits.length ? digits.padStart(originalDigits.length, "0") : digits;
};

export const applyNamedFrontHeaderDynamicValues = (svgText: string, values: FrontHeaderDynamicValues): string | null => {
  const elements = scanNamedTextElements(svgText);
  const hasAnyKnownName = elements.some((el) => el.layerName && (FRONT_NAMED_FIELDS as readonly string[]).includes(el.layerName));
  if (!hasAnyKnownName) {
    return null;
  }

  const dateParts = frontLiveDateParts(values);
  const ankDigits = firstAsciiNumber(values.volume);

  return applyNamedTextSubstitution(svgText, elements, (fieldName, element) => {
    const original = stripXmlTags(element.body);
    switch (fieldName) {
      case "place":
        return values.place ? wrapReplacementPreservingTspanStyle(element.body, values.place) : null;
      case "day":
      case "date":
        return original ? wrapReplacementPreservingTspanStyle(element.body, substituteDateWords(original, dateParts)) : null;
      case "ank":
        return ankDigits ? wrapReplacementPreservingTspanStyle(element.body, padToOriginalWidth(original, ankDigits)) : null;
      default:
        return null;
    }
  });
};

export const applyNamedInsideHeaderDynamicValues = (svgText: string, values: InsideHeaderDynamicValues): string | null => {
  const elements = scanNamedTextElements(svgText);
  const hasAnyKnownName = elements.some((el) => el.layerName && (INSIDE_NAMED_FIELDS as readonly string[]).includes(el.layerName));
  if (!hasAnyKnownName) {
    return null;
  }

  const dateParts = insideLiveDateParts(values.placeAndDate);
  const city = values.placeAndDate.split(",")[0]?.trim() ?? "";
  const pageNumberDigits = firstAsciiNumber(values.pageNumber);

  return applyNamedTextSubstitution(svgText, elements, (fieldName, element) => {
    const original = stripXmlTags(element.body);
    switch (fieldName) {
      case "place":
        return city ? wrapReplacementPreservingTspanStyle(element.body, city) : null;
      case "day":
      case "date":
        return original ? wrapReplacementPreservingTspanStyle(element.body, substituteDateWords(original, dateParts)) : null;
      case "pagenumber":
        return pageNumberDigits ? wrapReplacementPreservingTspanStyle(element.body, padToOriginalWidth(original, pageNumberDigits)) : null;
      case "category":
        return values.category ? wrapReplacementPreservingTspanStyle(element.body, values.category) : null;
      default:
        return null;
    }
  });
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

  // A file whose own layer names match the publisher-facing naming guide
  // (place/day/date/ank) wins over every other path, named or positional --
  // deterministic beats guessed, always. Every existing template was
  // checked and none collide with this vocabulary, so this can only ever
  // activate for a new file actually built to the convention.
  const namedResult = applyNamedFrontHeaderDynamicValues(rawSvg, resolvedValues);

  // Only the two pinned Cliff News template files have a known, hand-measured
  // <text> document order (see the module doc comment above) -- any other
  // publisher's own upload (including a `.svg`-suffixed file hosted the way
  // Akhand Doot's is, not just a data: URL) goes through the generic,
  // content-based matcher instead of guessing at a position that was never
  // confirmed for that file.
  const patchedSvg = namedResult
    ?? (isAkhand
      ? applyAkhandFrontHeaderDynamicValues(rawSvg, resolvedValues)
      : templateUrl === FRONT_HEADER_BANNER_SOURCE
        ? applyFrontHeaderDynamicValues(rawSvg, resolvedValues)
        : isHindiKeFoolHeaderUrl(templateUrl)
          ? applyHindiKeFoolFrontHeaderDynamicValues(rawSvg, resolvedValues)
          : applyGenericFrontHeaderDynamicValues(rawSvg, resolvedValues));
  return `data:image/svg+xml;base64,${utf8ToBase64(patchedSvg)}`;
};

export const resolveInsideHeaderSvgSource = async (
  templateUrl: string,
  values: InsideHeaderDynamicValues,
): Promise<string> => {
  const rawSvg = await fetchSvgText(templateUrl);
  // Same named-layer priority as the front header -- see
  // applyNamedFrontHeaderDynamicValues's own comment.
  const namedResult = applyNamedInsideHeaderDynamicValues(rawSvg, values);
  const patchedSvg = namedResult
    ?? (isAkhandDootHeaderUrl(templateUrl)
      ? applyAkhandInsideHeaderDynamicValues(rawSvg, values)
      : isAdageInsideHeaderUrl(templateUrl)
        ? applyPageNumberOnlyInsideHeaderDynamicValues(rawSvg, values)
        : isHindiKeFoolHeaderUrl(templateUrl)
          ? applyHindiKeFoolInsideHeaderDynamicValues(rawSvg, values)
          : templateUrl === INSIDE_HEADER_BANNER_SOURCE
            ? applyInsideHeaderDynamicValues(rawSvg, values)
            : applyGenericInsideHeaderDynamicValues(rawSvg, values));
  return `data:image/svg+xml;base64,${utf8ToBase64(patchedSvg)}`;
};

// A publisher who uploads through the standard profile picker (not the
// multi-edition file-hosting path Akhand Doot uses) gets their image stored
// as a base64 `data:` URL, never a `.svg`-suffixed file path -- the suffix
// check alone silently excluded every such publisher from ever getting the
// live-template treatment, even when their own export (Illustrator, Figma,
// ...) is exactly this kind of file with real substitutable <text> layers.
// A `data:image/svg+xml` URL is unambiguously an SVG regardless of how it's
// hosted, so it counts too.
export const isLiveHeaderSvgUrl = (url: string | undefined | null): boolean =>
  Boolean(url && (url.toLowerCase().endsWith(".svg") || url.startsWith("data:image/svg+xml")));

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
// Most publishers on this platform are Hindi-language dailies -- a dateline
// baked into their own SVG export is just as likely to read "सोमवार 24
// अगस्त 2026" as "Monday 24 August 2026", so both scripts need to be
// recognised, not just English (HINDI_DAYS/HINDI_MONTHS are defined above
// for the Akhand-specific functions but are plain word maps, reusable here).
const HINDI_DAY_WORDS = Object.values(HINDI_DAYS);
const HINDI_MONTH_WORDS = Object.values(HINDI_MONTHS);
const weekdayPattern = new RegExp(`\\b(${WEEKDAY_NAMES.join("|")})\\b|(${HINDI_DAY_WORDS.join("|")})`, "i");
const monthWordPattern = new RegExp(`\\b(${MONTH_NAMES.join("|")})\\b|(${HINDI_MONTH_WORDS.join("|")})`, "i");
// A 4-digit run isn't automatically "the year" everywhere it appears (a bare
// "2026" text node is one), but a genuinely year-shaped one (1900-2099) can
// be told apart from an unrelated small counter (an issue/volume number)
// with no other context needed.
const yearShapedPattern = /\b(19|20)\d{2}\b/;
const dayOfMonthPattern = /\b\d{1,2}\b/;
const namedOrNumericDateContextPattern = new RegExp(
  `(${WEEKDAY_NAMES.join("|")})|(${HINDI_DAY_WORDS.join("|")})|(${MONTH_NAMES.join("|")})|(${HINDI_MONTH_WORDS.join("|")})|(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4})`,
  "i",
);
const numericDatePattern = /\b(\d{1,2})([/\-.])(\d{1,2})\2(\d{2,4})\b/;
const pureDigitsPattern = /^\d{1,4}$/;

type LiveDateParts = { weekday: string; dayOfMonth: string; monthName: string; year: string };

const firstTspanOpenTagPattern = /<tspan\b[^>]*>/;

/**
 * A `<text>` element's own styling sometimes lives on its `<tspan>` children
 * instead of the `<text>` tag itself (confirmed live: Sach Express's own
 * category text is two `<tspan class="...">` runs under a bare, class-less
 * `<text>`) -- replacing the whole body with a plain escaped string in that
 * case silently drops the styling (bold, colour, ...) the publisher's own
 * design gave that field. Reuses the first tspan's own opening tag (its
 * class/style/fill attributes) for the single replacement run instead,
 * dropping only its x/y positioning (sized for the original multi-run
 * layout, not a single new string).
 */
const wrapReplacementPreservingTspanStyle = (body: string, replacement: string): string => {
  const tspanMatch = body.match(firstTspanOpenTagPattern);
  if (!tspanMatch) {
    return escapeXmlText(replacement);
  }
  const openTag = tspanMatch[0].replace(/\s+(x|y)="[^"]*"/g, "");
  return `${openTag}${escapeXmlText(replacement)}</tspan>`;
};

const liveWeekdayForMatch = (matchedWord: string, live: LiveDateParts): string =>
  HINDI_DAY_WORDS.includes(matchedWord)
    ? HINDI_DAYS[live.weekday.toLowerCase()] ?? live.weekday
    : live.weekday;

const liveMonthForMatch = (matchedWord: string, live: LiveDateParts): string =>
  HINDI_MONTH_WORDS.includes(matchedWord)
    ? HINDI_MONTHS[live.monthName.toLowerCase()] ?? live.monthName
    : live.monthName;

/**
 * Rewrites just the date/weekday/day-of-month/year TOKENS found inside an
 * existing text run, leaving every other character (separators, city name,
 * a static "अंक-"/"Volume-" style label the publisher's own artwork already
 * carries, ...) exactly as designed. Each token is matched and replaced
 * independently rather than as one combined pattern, because real exports
 * vary too much in spacing/gluing ("सोमवार24 अगस्त" with no space, "24
 * अगस्त2026" with no space before the year, "24/08/2026", ...) for a single
 * fixed shape to cover -- and critically, the year is always replaced FIRST
 * and via its own distinct 4-digit pattern, so it's never mistaken for (or
 * mistakenly overwritten by) the separate 1-2 digit day-of-month token.
 */
const substituteDateWords = (text: string, live: LiveDateParts): string => {
  let result = text;
  result = result.replace(numericDatePattern, (_match, d: string, sep: string, m: string, y: string) => {
    if (!live.dayOfMonth || !live.monthName || !live.year) {
      return _match;
    }
    const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === live.monthName.toLowerCase());
    const monthNum = monthIndex >= 0 ? String(monthIndex + 1) : m;
    const day = d.length >= 2 ? live.dayOfMonth.padStart(2, "0") : live.dayOfMonth;
    const month = m.length >= 2 ? monthNum.padStart(2, "0") : monthNum;
    const year = y.length <= 2 ? live.year.slice(-2) : live.year;
    return `${day}${sep}${month}${sep}${year}`;
  });
  if (live.year) {
    result = result.replace(yearShapedPattern, live.year);
  }
  if (live.weekday) {
    result = result.replace(weekdayPattern, (matched) => liveWeekdayForMatch(matched, live));
  }
  if (live.monthName) {
    result = result.replace(monthWordPattern, (matched) => liveMonthForMatch(matched, live));
  }
  if (live.dayOfMonth) {
    result = result.replace(dayOfMonthPattern, live.dayOfMonth);
  }
  return result;
};

/** Front's own dynamic values already carry day/dateNumber/monthYear as separate fields (see FrontHeaderDynamicValues) -- no parsing needed. */
const frontLiveDateParts = (values: FrontHeaderDynamicValues): LiveDateParts => {
  const lastSpace = values.monthYear.lastIndexOf(" ");
  return {
    weekday: values.day,
    dayOfMonth: values.dateNumber,
    monthName: lastSpace >= 0 ? values.monthYear.slice(0, lastSpace).trim() : values.monthYear,
    year: lastSpace >= 0 ? values.monthYear.slice(lastSpace + 1).trim() : "",
  };
};

// Parses ONLY this app's own server-built combined string (always English --
// `{{day}}`/`{{monthYear}}` are formatted in English regardless of the
// publisher's language, see HeaderTokenResolver.ts), so this stays a plain
// English-only extraction rather than reusing the bilingual scan patterns
// above (which are for recognising date TEXT ALREADY SITTING in a
// publisher's own, possibly Hindi, artwork).
const englishWeekdayPattern = new RegExp(`\\b(${WEEKDAY_NAMES.join("|")})\\b`, "i");
const englishNamedDatePattern = new RegExp(`\\b(\\d{1,2})[\\s\\-]+(${MONTH_NAMES.join("|")})[\\s\\-]*(\\d{4})\\b`, "i");

/** Inside's `placeAndDate` is already one combined "{{city}},{{day}} {{dayOfMonth}} {{monthYear}}"-shaped string (see HeaderDefaults.ts). */
const insideLiveDateParts = (placeAndDate: string): LiveDateParts => {
  const weekdayMatch = placeAndDate.match(englishWeekdayPattern);
  const namedMatch = placeAndDate.match(englishNamedDatePattern);
  if (namedMatch) {
    return { weekday: weekdayMatch?.[1] ?? "", dayOfMonth: namedMatch[1], monthName: namedMatch[2], year: namedMatch[3] };
  }
  const numericMatch = placeAndDate.match(numericDatePattern);
  if (numericMatch) {
    const monthIndex = Number(numericMatch[3]) - 1;
    return { weekday: weekdayMatch?.[1] ?? "", dayOfMonth: numericMatch[1], monthName: MONTH_NAMES[monthIndex] ?? "", year: numericMatch[4] };
  }
  return { weekday: weekdayMatch?.[1] ?? "", dayOfMonth: "", monthName: "", year: "" };
};

/**
 * The non-Akhand, non-default-template fallback for any OTHER publisher's
 * own live SVG export -- used precisely because such a file's own <text>
 * document order and count is unknown ahead of time (unlike the two pinned,
 * hand-measured templates the position-based functions above assume), so
 * fields are identified by what their EXISTING content looks like instead:
 * a lone 1-4 digit run is a volume/page-number badge, any text containing a
 * weekday name and/or a recognisable date is the dateline, and (inside only)
 * anything else that isn't the masthead name itself is the section/category
 * strip. Confirmed against a real publisher upload (a 2-text-element front:
 * a combined "Bhopal,24/08/2026,Monday" dateline + a lone "45" volume badge;
 * a 4-text-element inside: masthead name + "NATIONAL" category + a combined
 * "Bhopal,Monday 10 August 2026" dateline + a lone "12" page number).
 */
/**
 * A lone digit run isn't automatically "the volume badge" -- a real export
 * can carry TWO independent bare numbers (an issue/edition counter AND the
 * year, e.g. "अंक-101" ... "2026"), and conflating them means the year gets
 * overwritten with the volume and vice-versa. A year-shaped run (1900-2099)
 * is always the year; any other lone run is the volume/page-number badge --
 * substituted with just its digits (`values.volume` here already carries a
 * baked-in "Volume-" label from this app's own default template, see
 * HeaderDefaults.ts's rightEar -- stripping down to the digits respects
 * whatever label the publisher's OWN artwork already has, like "अंक-",
 * instead of pasting a second, English "Volume-" label over it).
 */
const substitutePureDigitField = (original: string, year: string, badgeDigits: string): string | null => {
  if (year && yearShapedPattern.test(original)) {
    return year;
  }
  return badgeDigits || null;
};

/**
 * Hindi Ke Fool's front header (मासिक -- monthly, so month+year is the only
 * date field, no day-of-month or weekday exists at all): the same
 * date-context handling as the generic matcher, but the lone digit ("08")
 * is zero-padded to match the original field's own digit width (2 digits)
 * instead of the generic matcher's bare "9" -- this file's own "08" prints
 * right next to a baked-in "पृष्ठ:08" using the same 2-digit convention.
 */
export const applyHindiKeFoolFrontHeaderDynamicValues = (
  svgText: string,
  values: FrontHeaderDynamicValues,
): string => {
  const dateParts = frontLiveDateParts(values);
  const volumeDigits = firstAsciiNumber(values.volume);

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    if (!original) {
      return match;
    }
    if (pureDigitsPattern.test(original)) {
      if (!volumeDigits) {
        return match;
      }
      const padded = volumeDigits.padStart(original.length, "0");
      return `${open}${wrapReplacementPreservingTspanStyle(body, padded)}${close}`;
    }
    if (namedOrNumericDateContextPattern.test(original)) {
      return `${open}${wrapReplacementPreservingTspanStyle(body, substituteDateWords(original, dateParts))}${close}`;
    }
    return match;
  });
};

const HINDI_KE_FOOL_CATEGORY_PLACEHOLDER = "catagory";

// The page-number badge's own pennant/ribbon shape, measured directly off
// this file's rendered pixels (viewBox "0 0 936 56.6"): its fill spans
// roughly x=867-900, centre x=883. The source file's own "2" sits at a
// fixed x sized for that one glyph -- a live value with a different digit
// count (a single "2" vs a two-digit "12") reads off-centre unless
// re-anchored to the badge's own true centre every time, the same
// technique already used for The Adage Times' page-number badge.
const HINDI_KE_FOOL_PAGE_NUMBER_CENTER_X = 883;

/**
 * Hindi Ke Fool's inside header: page number and category update live like
 * the generic matcher, but its city text ("भोपाल") sits right next to the
 * month+year dateline with no shape of its own to distinguish it from the
 * category placeholder -- the generic matcher's "anything else is the
 * category" catch-all sweeps up both, overwriting the city too. Here the
 * category placeholder is matched explicitly first, so the real catch-all
 * (the city) can safely go to the live place name instead.
 */
export const applyHindiKeFoolInsideHeaderDynamicValues = (
  svgText: string,
  values: InsideHeaderDynamicValues,
): string => {
  const dateParts = insideLiveDateParts(values.placeAndDate);
  const pageNumberDigits = firstAsciiNumber(values.pageNumber);
  const city = values.placeAndDate.split(",")[0]?.trim() ?? "";

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    if (!original) {
      return match;
    }
    if (pureDigitsPattern.test(original)) {
      if (!pageNumberDigits) {
        return match;
      }
      const centeredOpen = withCenterAnchor(rewriteTransformX(open, HINDI_KE_FOOL_PAGE_NUMBER_CENTER_X));
      return `${centeredOpen}${wrapReplacementPreservingTspanStyle(body, pageNumberDigits)}${close}`;
    }
    if (namedOrNumericDateContextPattern.test(original)) {
      return `${open}${wrapReplacementPreservingTspanStyle(body, substituteDateWords(original, dateParts))}${close}`;
    }
    if (original.trim().toLowerCase() === HINDI_KE_FOOL_CATEGORY_PLACEHOLDER) {
      return values.category ? `${open}${wrapReplacementPreservingTspanStyle(body, values.category)}${close}` : match;
    }
    return city ? `${open}${wrapReplacementPreservingTspanStyle(body, city)}${close}` : match;
  });
};

export const applyGenericFrontHeaderDynamicValues = (
  svgText: string,
  values: FrontHeaderDynamicValues,
): string => {
  const dateParts = frontLiveDateParts(values);
  const volumeDigits = firstAsciiNumber(values.volume);

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    if (!original) {
      return match;
    }
    if (pureDigitsPattern.test(original)) {
      const next = substitutePureDigitField(original, dateParts.year, volumeDigits);
      return next ? `${open}${wrapReplacementPreservingTspanStyle(body, next)}${close}` : match;
    }
    if (namedOrNumericDateContextPattern.test(original)) {
      return `${open}${wrapReplacementPreservingTspanStyle(body, substituteDateWords(original, dateParts))}${close}`;
    }
    return match;
  });
};

// The page-number badge's own dark-green box, measured directly off this
// file's rendered pixels (viewBox "0 0 936 56.6"): solid fill spans roughly
// x=0-50, so its centre sits at x=25. The source file's own text sits
// left-anchored at x=10.56, sized for its original 2-digit example ("12") --
// re-centred here (same rewriteTransformX/withCenterAnchor technique the
// pinned Cliff News templates already use for their own date-number/
// page-number boxes) so a live value doesn't read off-centre regardless of
// digit count.
const ADAGE_PAGE_NUMBER_CENTER_X = 25;
// This file's own placeholder text for the category strip -- matched
// explicitly (not "anything that isn't the masthead name", like the fuller
// generic matcher does) so the date/day line and masthead name are never at
// risk of being mistaken for it.
const ADAGE_CATEGORY_PLACEHOLDER = "national";

/**
 * The Adage Times' inside header: page number and category update live,
 * the date/day line stays exactly as printed in the artwork (per explicit
 * publisher decision -- date support can be added later the same way if
 * ever wanted). Page number is zero-padded to 2 digits ("02".."08", ...)
 * and re-centred in its box rather than left-anchored.
 */
export const applyPageNumberOnlyInsideHeaderDynamicValues = (
  svgText: string,
  values: InsideHeaderDynamicValues,
): string => {
  const pageNumberDigits = firstAsciiNumber(values.pageNumber);
  const paddedPageNumber = pageNumberDigits ? pageNumberDigits.padStart(2, "0") : "";

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    if (pureDigitsPattern.test(original)) {
      if (!paddedPageNumber) {
        return match;
      }
      const centeredOpen = withCenterAnchor(rewriteTransformX(open, ADAGE_PAGE_NUMBER_CENTER_X));
      return `${centeredOpen}${wrapReplacementPreservingTspanStyle(body, paddedPageNumber)}${close}`;
    }
    if (original.trim().toLowerCase() === ADAGE_CATEGORY_PLACEHOLDER) {
      // The placeholder itself is all-caps ("NATIONAL") -- matching that
      // styling for whatever live category comes in, same convention.
      return values.category ? `${open}${wrapReplacementPreservingTspanStyle(body, values.category.toUpperCase())}${close}` : match;
    }
    return match;
  });
};

export const applyGenericInsideHeaderDynamicValues = (
  svgText: string,
  values: InsideHeaderDynamicValues,
): string => {
  const dateParts = insideLiveDateParts(values.placeAndDate);
  const publicationName = values.publicationName?.trim().toLowerCase();
  const pageNumberDigits = firstAsciiNumber(values.pageNumber);

  return svgText.replace(textContentPattern, (match, open: string, body: string, close: string) => {
    const original = stripXmlTags(body);
    if (!original) {
      return match;
    }
    if (pureDigitsPattern.test(original)) {
      const next = substitutePureDigitField(original, dateParts.year, pageNumberDigits);
      return next ? `${open}${wrapReplacementPreservingTspanStyle(body, next)}${close}` : match;
    }
    if (namedOrNumericDateContextPattern.test(original)) {
      return `${open}${wrapReplacementPreservingTspanStyle(body, substituteDateWords(original, dateParts))}${close}`;
    }
    if (publicationName && original.trim().toLowerCase() === publicationName) {
      return match;
    }
    return values.category ? `${open}${wrapReplacementPreservingTspanStyle(body, values.category)}${close}` : match;
  });
};
