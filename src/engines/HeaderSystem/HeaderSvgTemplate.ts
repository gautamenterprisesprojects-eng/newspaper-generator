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

const isAkhandDootHeaderUrl = (url: string): boolean =>
  /akhand(?:%20|\+|\s|-)*doot/i.test(url);

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

const AKHAND_TEASER_TEXT_CENTER_X = 852.85;
const AKHAND_TEASER_TEXT_TOP_Y = 99.8;
const AKHAND_TEASER_TEXT_MAX_HEIGHT = 37.5;

const splitAkhandTeaserHeadline = (headline: string): string[] => {
  const words = headline.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 19 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const buildAkhandTeaserHeadlineText = (headline: string): string => {
  const lines = splitAkhandTeaserHeadline(headline);
  const lineHeight = Math.min(8.6, Math.max(5.8, AKHAND_TEASER_TEXT_MAX_HEIGHT / Math.max(lines.length, 1)));
  const fontSize = Math.min(8, Math.max(5.2, lineHeight - 1.1));
  const firstLineY = AKHAND_TEASER_TEXT_TOP_Y + fontSize;
  const renderedLines = lines
    .map((line, index) => {
      const y = Number((firstLineY + index * lineHeight).toFixed(2));
      return `<text x="${AKHAND_TEASER_TEXT_CENTER_X}" y="${y}" class="st1" font-size="${fontSize.toFixed(1)}" font-weight="400" fill="#111111" text-anchor="middle">${escapeXmlText(line)}</text>`;
    })
    .join("");

  return `<g>${renderedLines}</g>`;
};

const replaceAkhandTeaserHeadline = (svgText: string, headline: string | undefined): string => {
  const normalized = headline?.replace(/\s+/g, " ").trim();
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
    /(<image\b(?=[^>]*\bid="teaser_image_xA0_Image")[^>]*\bxlink:href=")[^"]*(")/,
    `$1${escapeXmlAttribute(resolved)}$2`,
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
  const patchedSvg = isAkhandDootHeaderUrl(templateUrl)
    ? applyAkhandFrontHeaderDynamicValues(rawSvg, values)
    : applyFrontHeaderDynamicValues(rawSvg, values);
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
