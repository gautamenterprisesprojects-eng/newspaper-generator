/**
 * Experimental geometry for the 15 Sep 2026 Cliff News page-1 prototype.
 *
 * This file is intentionally outside TemplateRegistry / FRONT_PAGE_TEMPLATE_IDS.
 * Existing front-page layouts, the masthead, and the header SVG are not modified.
 *
 * Coordinates use the project's page master (13in × 21in, origin top-left, points).
 * Measured fractions come from the reference PDF (952 × 1502 pt).
 */

import { createColumnGrid } from "@/engines/PageMaster/ColumnGridEngine";
import {
  determineInternalTextColumnCount,
  selectOptimisticNewswireWordTier,
  estimateStoryBoxWordCapacity,
} from "@/engines/CustomLayoutGenerator";
import { FRONT_HEADER_HEIGHT_PT, FRONT_HEADER_BANNER_SOURCE } from "@/engines/HeaderSystem/HeaderGeometry";
import { getPressColourBar } from "@/engines/MasterPage/PressColourBarGeometry";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import { POINTS_PER_INCH } from "@/utils/page";

export const PROTOTYPE_LAYOUT_ID = "reference-layout-prototype";

export type RectPt = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PrototypeKicker = RectPt & {
  text: string;
  fill: string;
  color: string;
};

export type PrototypeTextBlock = RectPt & {
  text: string;
  columns: number;
  fontSize: number;
};

export type PrototypeArticleBox = {
  id: string;
  label: string;
  role: "rail" | "lead" | "major" | "nested" | "brief" | "cartoon";
  /** OUTER article box — the package chrome. */
  outer: RectPt;
  kicker?: PrototypeKicker;
  headline?: PrototypeTextBlock;
  /** INNER content box sitting inside the outer chrome. */
  inner: RectPt;
  image?: RectPt & { label: string };
  caption?: PrototypeTextBlock;
  body: PrototypeTextBlock;
  /** Extra body wells used when an image splits the inner box. */
  extraBodies?: PrototypeTextBlock[];
  nested?: PrototypeArticleBox[];
  stackedInners?: PrototypeArticleBox[];
  wordTier: 250 | 500 | 1000;
};

export type PrototypeLayout = {
  id: typeof PROTOTYPE_LAYOUT_ID;
  page: { width: number; height: number };
  header: RectPt & { source: string; label: string };
  content: RectPt;
  gutter: number;
  rowGap: number;
  columns: Array<{ index: number; x: number; width: number }>;
  articles: PrototypeArticleBox[];
  pressBar: ReturnType<typeof getPressColourBar>;
};

export const PROTOTYPE_COLOURS = {
  ink: "#1a1714",
  paper: "#fffdf8",
  innerFill: "#fffefb",
  imageFill: "#d9d4cb",
  imageStroke: "#8a8378",
  kickerOrange: "#c44b12",
  kickerBlue: "#1c4e86",
  kickerRed: "#c8102e",
  kickerOnColor: "#ffffff",
  nestedFill: "#f7f4ee",
  cartoonFill: "#f3eee4",
  captionFill: "#efeae1",
} as const;

export const PROTOTYPE_BORDERS = {
  outer: 1.15,
  inner: 0.9,
  nested: 1.2,
  image: 0.7,
} as const;

const INSET = 5.5;
const KICKER_H = 16.5;
const ROW_GAP = 3.5;
const STACK_GAP = 3.2;
const COLUMN_RULE_GAP = 8;

const toPt = (inches: number) => inches * POINTS_PER_INCH;

const rect = (x: number, y: number, width: number, height: number): RectPt => ({
  x,
  y,
  width,
  height,
});

const insetRect = (box: RectPt, pad: number): RectPt =>
  rect(box.x + pad, box.y + pad, Math.max(1, box.width - pad * 2), Math.max(1, box.height - pad * 2));

const slotSpan = (
  columns: ReturnType<typeof createColumnGrid>,
  columnStart: number,
  columnSpan: number,
) => {
  const first = columns[columnStart - 1];
  const last = columns[columnStart + columnSpan - 2];
  if (!first || !last) {
    throw new Error(`Invalid column range ${columnStart}/${columnSpan}`);
  }
  return { x: first.x, width: last.x + last.width - first.x };
};

const headlineHeightFor = (role: PrototypeArticleBox["role"]) => {
  if (role === "lead") return 58;
  if (role === "major") return 36;
  if (role === "nested") return 28;
  if (role === "cartoon") return 18;
  return 20;
};

const bodyFontFor = (role: PrototypeArticleBox["role"]) => (role === "lead" || role === "major" ? 8.4 : 7.8);

/**
 * Row rhythm measured off the 15 Sep 2026 sheet, as fractions of the body
 * below the existing masthead:
 *   row 1 top package  54%   (rail │ lead │ right, with nested boxes)
 *   row 2 full-width   28%
 *   row 3 cartoon+pkg  18%
 */
export const REFERENCE_PROTOTYPE_ROW_RHYTHM = [
  { row: 1, baseRatio: 0.54, receivesRemainingSpace: false, minimumHeight: 240 },
  { row: 2, baseRatio: 0.28, receivesRemainingSpace: false, minimumHeight: 180 },
  { row: 3, baseRatio: 0.18, receivesRemainingSpace: true, minimumHeight: 140 },
] as const;

/**
 * Template-shaped blueprint for a later production port. Not registered.
 *
 * Nested slots use the project's existing `insetInto` model: the parent keeps
 * its full headline measure; the nested article is a boxed story inside it.
 */
export const REFERENCE_PROTOTYPE_SLOT_BLUEPRINT = [
  { storyNumber: 1, row: 1, columnStart: 1, columnSpan: 1, priority: "brief" as const, role: "rail" },
  { storyNumber: 2, row: 1, columnStart: 2, columnSpan: 3, priority: "lead" as const, role: "lead" },
  {
    storyNumber: 3,
    row: 1,
    columnStart: 2,
    columnSpan: 3,
    priority: "brief" as const,
    role: "nested-in-lead",
    insetInto: { parentStoryNumber: 2, topFraction: 0.52 },
  },
  { storyNumber: 4, row: 1, columnStart: 5, columnSpan: 2, priority: "major" as const, role: "right" },
  {
    storyNumber: 5,
    row: 1,
    columnStart: 5,
    columnSpan: 2,
    priority: "brief" as const,
    role: "nested-in-right",
    insetInto: { parentStoryNumber: 4, topFraction: 0.74 },
  },
  { storyNumber: 6, row: 2, columnStart: 1, columnSpan: 6, priority: "major" as const, role: "mid-full" },
  {
    storyNumber: 7,
    row: 2,
    columnStart: 1,
    columnSpan: 1,
    priority: "brief" as const,
    role: "nested-fact-box",
    insetInto: { parentStoryNumber: 6, topFraction: 0.23 },
  },
  { storyNumber: 8, row: 3, columnStart: 1, columnSpan: 1, priority: "brief" as const, role: "cartoon" },
  { storyNumber: 9, row: 3, columnStart: 2, columnSpan: 5, priority: "major" as const, role: "bottom" },
] as const;

const PLACEHOLDER_BODY =
  "यह प्रोटोटाइप केवल ज्यामिति दिखाता है। लेख का वास्तविक पाठ यहाँ नहीं है। बाहरी बॉक्स के अंदर भीतरी कंटेंट बॉक्स है, और उसके अंदर शीर्षक, चित्र तथा कॉलम-प्रवाह पाठ अपने निर्धारित क्षेत्र में रहते हैं। वाक्य यहीं पूरा होता है। ";

export type PrototypeCopy = {
  kicker: string;
  headline: string;
  caption?: string;
  body: string;
};

export const PROTOTYPE_COPY: Record<string, PrototypeCopy> = {
  rail: {
    kicker: "सार-समाचार",
    headline: "संक्षिप्त समाचार रेल",
    body: PLACEHOLDER_BODY,
  },
  rail1: { kicker: "", headline: "पहला संक्षिप्त समाचार शीर्षक", body: PLACEHOLDER_BODY },
  rail2: { kicker: "", headline: "दूसरा संक्षिप्त समाचार शीर्षक", body: PLACEHOLDER_BODY },
  rail3: { kicker: "", headline: "तीसरा संक्षिप्त समाचार शीर्षक", body: PLACEHOLDER_BODY },
  rail4: { kicker: "", headline: "चौथा संक्षिप्त समाचार शीर्षक", body: PLACEHOLDER_BODY },
  lead: {
    kicker: "मुख्य समाचार · प्रोटोटाइप",
    headline: "मुख्य लेख का बाहरी बॉक्स — भीतरी कंटेंट बॉक्स में चित्र और तीन कॉलम",
    caption: "चित्र कैप्शन निर्धारित क्षेत्र में",
    body: PLACEHOLDER_BODY.repeat(4),
  },
  leadNested: {
    kicker: "",
    headline: "नेस्टेड लेख बॉक्स — मुख्य लेख के अंदर",
    caption: "नेस्टेड चित्र",
    body: PLACEHOLDER_BODY.repeat(2),
  },
  right: {
    kicker: "",
    headline: "दायाँ लेख बाहरी बॉक्स",
    caption: "पोर्ट्रेट चित्र",
    body: PLACEHOLDER_BODY.repeat(2),
  },
  rightNested: {
    kicker: "",
    headline: "नेस्टेड दायाँ लेख",
    caption: "नेस्टेड चित्र",
    body: PLACEHOLDER_BODY,
  },
  mid: {
    kicker: "पूर्ण-चौड़ाई पट्टी",
    headline: "बीच का पूरा चौड़ा लेख — बाएँ नेस्टेड तथ्य बॉक्स, दाएँ भीतरी पाठ कॉलम",
    caption: "मध्य पट्टी का चित्र",
    body: PLACEHOLDER_BODY.repeat(3),
  },
  midNested: {
    kicker: "तथ्य बॉक्स",
    headline: "नेस्टेड तथ्य सूची",
    body: "• पहला बिंदु भीतरी बॉक्स में रहता है। • दूसरा बिंदु सीमा के बाहर नहीं जाता। • तीसरा बिंदु कॉलम चौड़ाई का पालन करता है। • चौथा बिंदु प्रोटोटाइप ज्यामिति है।",
  },
  cartoon: {
    kicker: "आज का मुक्का",
    headline: "कार्टून स्थान",
    body: "कार्टून/विज्ञापन प्लेसहोल्डर। यह बाहरी बॉक्स के अंदर सीमित है।",
  },
  bottom: {
    kicker: "निचली पट्टी · प्रोटोटाइप",
    headline: "नीचे का चौड़ा लेख बाहरी बॉक्स — भीतरी कंटेंट में बहु-कॉलम पाठ",
    body: PLACEHOLDER_BODY.repeat(3),
  },
};

const makeKicker = (box: RectPt, text: string, fill: string): PrototypeKicker => ({
  ...rect(box.x, box.y, box.width, KICKER_H),
  text,
  fill,
  color: PROTOTYPE_COLOURS.kickerOnColor,
});

const chromeTop = (hasKicker: boolean, role: PrototypeArticleBox["role"]) =>
  (hasKicker ? KICKER_H : 0) + headlineHeightFor(role);

const makeBody = (box: RectPt, text: string, role: PrototypeArticleBox["role"]): PrototypeTextBlock => {
  const columns = determineInternalTextColumnCount(box.width, 1);
  return {
    ...box,
    text,
    columns,
    fontSize: bodyFontFor(role),
  };
};

const wordTierFor = (box: RectPt, imageEnabled: boolean, columns: number) =>
  selectOptimisticNewswireWordTier(estimateStoryBoxWordCapacity(box.width, box.height, imageEnabled, columns));

function buildStackedBrief(id: string, outer: RectPt, copy: PrototypeCopy): PrototypeArticleBox {
  const inner = insetRect(outer, 3.2);
  const headline = {
    ...rect(inner.x + 2, inner.y + 2, inner.width - 4, 16),
    text: copy.headline,
    columns: 1,
    fontSize: 8.2,
  };
  const bodyBox = rect(inner.x + 2, headline.y + headline.height + 2, inner.width - 4, Math.max(8, inner.y + inner.height - (headline.y + headline.height) - 4));
  const body = makeBody(bodyBox, copy.body, "brief");
  return {
    id,
    label: copy.headline,
    role: "brief",
    outer,
    inner,
    headline,
    body,
    wordTier: wordTierFor(outer, false, body.columns),
  };
}

function buildArticle(input: {
  id: string;
  label: string;
  role: PrototypeArticleBox["role"];
  outer: RectPt;
  copy: PrototypeCopy;
  kickerFill?: string;
  image?: { placement: "stack" | "center-split" | "right" | "left"; widthRatio?: number; heightRatio?: number };
  contentBottom?: number;
}): PrototypeArticleBox {
  const { id, label, role, outer, copy } = input;
  const hasKicker = Boolean(copy.kicker);
  const kicker = hasKicker ? makeKicker(outer, copy.kicker, input.kickerFill ?? PROTOTYPE_COLOURS.kickerBlue) : undefined;
  const headH = headlineHeightFor(role);
  const headlineY = outer.y + (hasKicker ? KICKER_H : 0);
  const headline = {
    ...rect(outer.x + INSET, headlineY + 2, outer.width - INSET * 2, headH),
    text: copy.headline,
    columns: 1,
    fontSize: role === "lead" ? 16 : role === "major" ? 12.5 : 9.5,
  };

  const innerTop = outer.y + chromeTop(hasKicker, role) + 3;
  const innerBottom = input.contentBottom ?? outer.y + outer.height - INSET;
  const inner = rect(
    outer.x + INSET,
    innerTop,
    Math.max(1, outer.width - INSET * 2),
    Math.max(12, innerBottom - innerTop),
  );

  let image: PrototypeArticleBox["image"];
  let caption: PrototypeTextBlock | undefined;
  let body: PrototypeTextBlock;
  let extraBodies: PrototypeTextBlock[] | undefined;

  if (input.image?.placement === "center-split") {
    const imgW = inner.width * (input.image.widthRatio ?? 0.32);
    const imgH = inner.height * (input.image.heightRatio ?? 0.42);
    const imgX = inner.x + (inner.width - imgW) / 2;
    const imgY = inner.y + 6;
    image = { ...rect(imgX, imgY, imgW, imgH), label: "चित्र" };
    caption = {
      ...rect(imgX, imgY + imgH + 2, imgW, 12),
      text: copy.caption ?? "चित्र कैप्शन",
      columns: 1,
      fontSize: 6.5,
    };
    const wellW = (inner.width - imgW - COLUMN_RULE_GAP * 2) / 2;
    const sideH = caption.y + caption.height - inner.y - 2;
    extraBodies = [
      makeBody(rect(inner.x + 3, inner.y + 4, wellW, sideH), copy.body, role),
      makeBody(rect(imgX + imgW + COLUMN_RULE_GAP, inner.y + 4, wellW, sideH), copy.body, role),
    ];
    const belowY = caption.y + caption.height + 4;
    body = makeBody(
      rect(inner.x + 3, belowY, inner.width - 6, Math.max(10, inner.y + inner.height - belowY - 3)),
      copy.body,
      role,
    );
  } else if (input.image?.placement === "right") {
    const imgW = inner.width * (input.image.widthRatio ?? 0.42);
    const imgH = inner.height * (input.image.heightRatio ?? 0.4);
    image = { ...rect(inner.x + inner.width - imgW - 3, inner.y + 4, imgW, imgH), label: "चित्र" };
    caption = {
      ...rect(image.x, image.y + image.height + 2, imgW, 11),
      text: copy.caption ?? "चित्र कैप्शन",
      columns: 1,
      fontSize: 6.5,
    };
    const leftW = image.x - inner.x - 6;
    extraBodies = [
      makeBody(rect(inner.x + 3, inner.y + 4, leftW, imgH + 14), copy.body, role),
    ];
    const belowY = caption.y + caption.height + 3;
    body = makeBody(
      rect(inner.x + 3, belowY, inner.width - 6, Math.max(8, inner.y + inner.height - belowY - 3)),
      copy.body,
      role,
    );
  } else if (input.image?.placement === "left") {
    const imgW = inner.width * (input.image.widthRatio ?? 0.28);
    const imgH = Math.min(inner.height * (input.image.heightRatio ?? 0.42), inner.height - 20);
    image = { ...rect(inner.x + 3, inner.y + 4, imgW, imgH), label: "चित्र" };
    caption = {
      ...rect(image.x, image.y + image.height + 2, imgW, 11),
      text: copy.caption ?? "चित्र कैप्शन",
      columns: 1,
      fontSize: 6.5,
    };
    const rightX = image.x + image.width + 6;
    extraBodies = [
      makeBody(
        rect(rightX, inner.y + 4, inner.x + inner.width - rightX - 3, imgH + 14),
        copy.body,
        role,
      ),
    ];
    const belowY = Math.max(caption.y + caption.height, inner.y + imgH + 18) + 3;
    body = makeBody(
      rect(inner.x + 3, belowY, inner.width - 6, Math.max(8, inner.y + inner.height - belowY - 3)),
      copy.body,
      role,
    );
  } else if (input.image?.placement === "stack") {
    const imgH = inner.height * (input.image.heightRatio ?? 0.32);
    image = { ...rect(inner.x + 4, inner.y + 4, inner.width - 8, imgH), label: "चित्र" };
    caption = {
      ...rect(image.x, image.y + image.height + 2, image.width, 11),
      text: copy.caption ?? "चित्र कैप्शन",
      columns: 1,
      fontSize: 6.5,
    };
    const bodyY = caption.y + caption.height + 3;
    body = makeBody(
      rect(inner.x + 3, bodyY, inner.width - 6, Math.max(8, inner.y + inner.height - bodyY - 3)),
      copy.body,
      role,
    );
  } else {
    body = makeBody(insetRect(inner, 3), copy.body, role);
  }

  return {
    id,
    label,
    role,
    outer,
    kicker,
    headline,
    inner,
    image,
    caption,
    body,
    extraBodies,
    wordTier: wordTierFor(outer, Boolean(image), body.columns),
  };
}

export const buildReferenceLayoutPrototype = (): PrototypeLayout => {
  const pageWidth = toPt(DEFAULT_PAGE_MASTER.width);
  const pageHeight = toPt(DEFAULT_PAGE_MASTER.height);
  const contentX = toPt(DEFAULT_PAGE_MASTER.contentX);
  const contentWidth = toPt(DEFAULT_PAGE_MASTER.contentWidth);
  const contentY = Math.max(toPt(DEFAULT_PAGE_MASTER.contentY), FRONT_HEADER_HEIGHT_PT);
  const contentBottom = toPt(DEFAULT_PAGE_MASTER.contentY + DEFAULT_PAGE_MASTER.contentHeight);
  const contentHeight = contentBottom - contentY;
  const gutter = toPt(DEFAULT_PAGE_MASTER.gutter);

  const columns = createColumnGrid({
    pageWidth,
    columnCount: DEFAULT_PAGE_MASTER.columns,
    gutter,
    contentX,
    contentWidth,
  });

  const usableHeight = contentHeight - ROW_GAP * 2;
  const row1H = usableHeight * 0.54;
  const row2H = usableHeight * 0.28;
  const row3H = contentHeight - row1H - row2H - ROW_GAP * 2;
  const row1Y = contentY;
  const row2Y = row1Y + row1H + ROW_GAP;
  const row3Y = row2Y + row2H + ROW_GAP;

  const col = (start: number, span: number, y: number, height: number) => {
    const spanGeom = slotSpan(columns, start, span);
    return rect(spanGeom.x, y, spanGeom.width, height);
  };

  const railOuter = col(1, 1, row1Y, row1H);
  const leadOuter = col(2, 3, row1Y, row1H);
  const rightOuter = col(5, 2, row1Y, row1H);
  const midOuter = col(1, 6, row2Y, row2H);
  const cartoonOuter = col(1, 1, row3Y, row3H);
  const bottomOuter = col(2, 5, row3Y, row3H);

  const leadNestedTop = leadOuter.y + leadOuter.height * 0.52;
  const rightNestedTop = rightOuter.y + rightOuter.height * 0.74;
  const midNestedTop = midOuter.y + midOuter.height * 0.23;

  const leadNestedOuter = rect(leadOuter.x + 4, leadNestedTop, leadOuter.width - 8, leadOuter.y + leadOuter.height - leadNestedTop - 4);
  const rightNestedOuter = rect(rightOuter.x + 4, rightNestedTop, rightOuter.width - 8, rightOuter.y + rightOuter.height - rightNestedTop - 4);
  const midFactOuter = rect(
    midOuter.x + 4,
    midNestedTop,
    slotSpan(columns, 1, 1).width - 4,
    midOuter.y + midOuter.height - midNestedTop - 4,
  );

  const lead = buildArticle({
    id: "lead",
    label: "Lead outer article",
    role: "lead",
    outer: leadOuter,
    copy: PROTOTYPE_COPY.lead,
    kickerFill: PROTOTYPE_COLOURS.kickerBlue,
    image: { placement: "center-split", widthRatio: 0.3, heightRatio: 0.48 },
    contentBottom: leadNestedOuter.y - 4,
  });

  const leadNested = buildArticle({
    id: "lead-nested",
    label: "Nested article inside lead",
    role: "nested",
    outer: leadNestedOuter,
    copy: PROTOTYPE_COPY.leadNested,
    image: { placement: "left", widthRatio: 0.26, heightRatio: 0.46 },
  });
  lead.nested = [leadNested];

  const right = buildArticle({
    id: "right",
    label: "Right outer article",
    role: "major",
    outer: rightOuter,
    copy: PROTOTYPE_COPY.right,
    image: { placement: "right", widthRatio: 0.4, heightRatio: 0.36 },
    contentBottom: rightNestedOuter.y - 4,
  });
  const rightNested = buildArticle({
    id: "right-nested",
    label: "Nested article inside right",
    role: "nested",
    outer: rightNestedOuter,
    copy: PROTOTYPE_COPY.rightNested,
    image: { placement: "left", widthRatio: 0.34, heightRatio: 0.5 },
  });
  right.nested = [rightNested];

  const kickerStripH = 15;
  const mid = buildArticle({
    id: "mid",
    label: "Full-width middle article",
    role: "major",
    outer: midOuter,
    copy: PROTOTYPE_COPY.mid,
    kickerFill: PROTOTYPE_COLOURS.kickerRed,
    image: { placement: "stack", heightRatio: 0.22 },
    contentBottom: midOuter.y + midOuter.height - INSET,
  });
  // Rebuild mid inner as the area to the right of the nested fact box, below kickers.
  const midInnerX = midFactOuter.x + midFactOuter.width + 4;
  mid.inner = rect(
    midInnerX,
    midNestedTop,
    midOuter.x + midOuter.width - INSET - midInnerX,
    midOuter.y + midOuter.height - INSET - midNestedTop,
  );
  if (mid.image) {
    const imgH = mid.inner.height * 0.28;
    mid.image = { ...rect(mid.inner.x + 4, mid.inner.y + 4, mid.inner.width - 8, imgH), label: "चित्र" };
    mid.caption = {
      ...rect(mid.image.x, mid.image.y + mid.image.height + 2, mid.image.width, 11),
      text: PROTOTYPE_COPY.mid.caption ?? "",
      columns: 1,
      fontSize: 6.5,
    };
    const bodyY = mid.caption.y + mid.caption.height + 3;
    mid.body = makeBody(
      rect(mid.inner.x + 3, bodyY, mid.inner.width - 6, Math.max(8, mid.inner.y + mid.inner.height - bodyY - 3)),
      PROTOTYPE_COPY.mid.body,
      "major",
    );
    mid.extraBodies = undefined;
  }
  // Second kicker band under the headline, matching the reference dual-strip.
  mid.kicker = mid.kicker
    ? { ...mid.kicker, height: KICKER_H }
    : makeKicker(midOuter, PROTOTYPE_COPY.mid.kicker, PROTOTYPE_COLOURS.kickerRed);
  void kickerStripH;

  const midNested = buildArticle({
    id: "mid-nested",
    label: "Nested fact box",
    role: "nested",
    outer: midFactOuter,
    copy: PROTOTYPE_COPY.midNested,
    kickerFill: PROTOTYPE_COLOURS.kickerOrange,
  });
  mid.nested = [midNested];

  const railKicker = makeKicker(railOuter, PROTOTYPE_COPY.rail.kicker, PROTOTYPE_COLOURS.kickerOrange);
  const stackTop = railOuter.y + KICKER_H + 3;
  const stackHeight = railOuter.y + railOuter.height - stackTop - 3;
  const briefH = (stackHeight - STACK_GAP * 3) / 4;
  const stackedInners = [1, 2, 3, 4].map((index) => {
    const y = stackTop + (index - 1) * (briefH + STACK_GAP);
    return buildStackedBrief(
      `rail-brief-${index}`,
      rect(railOuter.x + 3, y, railOuter.width - 6, briefH),
      PROTOTYPE_COPY[`rail${index}` as "rail1"],
    );
  });
  const railInner = rect(railOuter.x + 3, stackTop, railOuter.width - 6, stackHeight);
  const rail: PrototypeArticleBox = {
    id: "rail",
    label: "Saar-samachar rail",
    role: "rail",
    outer: railOuter,
    kicker: railKicker,
    inner: railInner,
    body: makeBody(railInner, "", "brief"),
    stackedInners,
    wordTier: 250,
  };

  const cartoon = buildArticle({
    id: "cartoon",
    label: "Cartoon rail",
    role: "cartoon",
    outer: cartoonOuter,
    copy: PROTOTYPE_COPY.cartoon,
    kickerFill: PROTOTYPE_COLOURS.kickerRed,
  });

  const bottom = buildArticle({
    id: "bottom",
    label: "Bottom package",
    role: "major",
    outer: bottomOuter,
    copy: PROTOTYPE_COPY.bottom,
    kickerFill: PROTOTYPE_COLOURS.kickerBlue,
  });

  const pressBar = getPressColourBar({
    pageWidth,
    pageHeight,
    contentBottom,
  });

  return {
    id: PROTOTYPE_LAYOUT_ID,
    page: { width: pageWidth, height: pageHeight },
    header: {
      x: 0,
      y: 0,
      width: pageWidth,
      height: FRONT_HEADER_HEIGHT_PT,
      source: FRONT_HEADER_BANNER_SOURCE,
      label: "EXISTING HEADER / MASTHEAD — DO NOT CHANGE",
    },
    content: rect(contentX, contentY, contentWidth, contentHeight),
    gutter,
    rowGap: ROW_GAP,
    columns,
    articles: [rail, lead, right, mid, cartoon, bottom],
    pressBar,
  };
};

export const containsRect = (parent: RectPt, child: RectPt, epsilon = 0.6) =>
  child.x >= parent.x - epsilon &&
  child.y >= parent.y - epsilon &&
  child.x + child.width <= parent.x + parent.width + epsilon &&
  child.y + child.height <= parent.y + parent.height + epsilon;

export const rectsOverlap = (a: RectPt, b: RectPt, epsilon = 0.4) =>
  a.x + a.width > b.x + epsilon &&
  b.x + b.width > a.x + epsilon &&
  a.y + a.height > b.y + epsilon &&
  b.y + b.height > a.y + epsilon;

const collectLeafRects = (article: PrototypeArticleBox): RectPt[] => {
  const rects: RectPt[] = [article.inner];
  if (article.image) rects.push(article.image);
  if (article.caption) rects.push(article.caption);
  rects.push(article.body);
  for (const extra of article.extraBodies ?? []) rects.push(extra);
  for (const stacked of article.stackedInners ?? []) rects.push(...collectLeafRects(stacked));
  for (const nested of article.nested ?? []) rects.push(...collectLeafRects(nested));
  return rects;
};

export type PrototypeValidationIssue = {
  code: string;
  message: string;
};

export const validatePrototypeLayout = (layout: PrototypeLayout): PrototypeValidationIssue[] => {
  const issues: PrototypeValidationIssue[] = [];
  const push = (code: string, message: string) => issues.push({ code, message });

  if (layout.header.y !== 0 || layout.header.x !== 0) {
    push("header-origin", "Existing header must start at (0, 0).");
  }
  if (Math.abs(layout.header.height - FRONT_HEADER_HEIGHT_PT) > 0.01) {
    push("header-height", `Header height must stay ${FRONT_HEADER_HEIGHT_PT}pt.`);
  }
  if (layout.header.source !== FRONT_HEADER_BANNER_SOURCE) {
    push("header-source", "Header must keep the existing live masthead SVG.");
  }

  const peers = layout.articles.map((article) => article.outer);
  for (let i = 0; i < peers.length; i += 1) {
    for (let j = i + 1; j < peers.length; j += 1) {
      if (rectsOverlap(peers[i], peers[j])) {
        push("peer-overlap", `Peer boxes overlap: ${layout.articles[i].id} vs ${layout.articles[j].id}.`);
      }
    }
  }

  const walk = (article: PrototypeArticleBox, parentOuter?: RectPt) => {
    if (!containsRect(layout.content, article.outer) && article.role !== "nested") {
      // Nested boxes are still inside content via their parent, but check anyway.
    }
    if (article.outer.y + 0.01 < layout.header.height && article.role !== "nested") {
      push("header-collision", `${article.id} collides with the existing header band.`);
    }
    if (!containsRect(article.outer, article.inner)) {
      push("inner-overflow", `${article.id}: inner content box overflowed its outer box.`);
    }
    if (article.headline && !containsRect(article.outer, article.headline)) {
      push("headline-overflow", `${article.id}: headline overflowed its outer box.`);
    }
    if (article.image && !containsRect(article.inner, article.image)) {
      push("image-overflow", `${article.id}: image overflowed its inner box.`);
    }
    if (article.caption && !containsRect(article.inner, article.caption)) {
      push("caption-overflow", `${article.id}: caption overflowed its inner box.`);
    }
    if (!containsRect(article.inner, article.body) && article.role !== "rail") {
      push("text-overflow", `${article.id}: body well overflowed its inner box.`);
    }
    for (const extra of article.extraBodies ?? []) {
      if (!containsRect(article.inner, extra)) {
        push("text-overflow", `${article.id}: extra body well overflowed its inner box.`);
      }
      if (article.image && rectsOverlap(extra, article.image, 0.8)) {
        push("text-image-overlap", `${article.id}: body well overlaps its image.`);
      }
    }
    if (article.image && article.role !== "rail" && rectsOverlap(article.body, article.image, 0.8)) {
      push("text-image-overlap", `${article.id}: body well overlaps its image.`);
    }
    if (parentOuter && !containsRect(parentOuter, article.outer)) {
      push("nested-overflow", `${article.id}: nested outer box escaped its parent.`);
    }
    for (const nested of article.nested ?? []) {
      if (rectsOverlap(article.inner, nested.outer, 1.2) && article.id !== "mid") {
        push("inner-nested-overlap", `${article.id}: inner content overlaps nested article ${nested.id}.`);
      }
      walk(nested, article.outer);
    }
    for (const stacked of article.stackedInners ?? []) {
      if (!containsRect(article.outer, stacked.outer)) {
        push("stack-overflow", `${stacked.id}: stacked brief escaped the rail.`);
      }
      walk(stacked, article.outer);
    }
    for (const leaf of collectLeafRects(article)) {
      if (leaf.width <= 0 || leaf.height <= 0) {
        push("empty-rect", `${article.id} produced a zero-size region.`);
      }
    }
  };

  for (const article of layout.articles) walk(article);
  return issues;
};
