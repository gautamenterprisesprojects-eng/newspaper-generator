export type SampadakPatraContact = {
  email?: string;
  phone?: string;
};

export type SampadakPatraInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  body: string;
  authorName?: string;
  authorLocation?: string;
  contact?: SampadakPatraContact;
  measureText?: (text: string, fontSize: number, fontWeight?: string) => number;
};

export type SampadakPatraLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  fontWeight?: string;
};

export type SampadakPatraLayout = {
  background: { x: number; y: number; width: number; height: number; fill: string };
  header: {
    x: number;
    y: number;
    width: number;
    height: number;
    logo: { x: number; y: number; width: number; height: number; fill: string };
    title: { text: string; x: number; y: number; width: number; fontSize: number };
    rightBar: { x: number; y: number; width: number; height: number; fill: string };
  };
  bodyLines: SampadakPatraLine[];
  authorBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    location: string;
    fontSize: number;
  } | null;
  contactStrip: {
    x: number;
    y: number;
    width: number;
    height: number;
    instruction: string;
    email: string;
    phone: string;
    fontSize: number;
  };
};

const BG = "#EAF1F7";
const BLUE = "#1684C4";
const INK = "#151515";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalize = (value?: string) =>
  (value ?? "").replace(/\s+/g, " ").trim();

const estimateTextWidth = (text: string, fontSize: number, fontWeight?: string) => {
  const weightBoost = fontWeight && /700|800|900|bold/i.test(fontWeight) ? 0.08 : 0;
  return Array.from(text).reduce((sum, char) => {
    if (char === " ") return sum + fontSize * 0.28;
    if (/[\u0900-\u097F]/u.test(char)) return sum + fontSize * (0.58 + weightBoost);
    return sum + fontSize * (0.5 + weightBoost);
  }, 0);
};

const splitWords = (text: string) =>
  normalize(text)
    .split(/\s+/)
    .filter(Boolean);

const fitLine = ({
  words,
  start,
  width,
  fontSize,
  measure,
}: {
  words: string[];
  start: number;
  width: number;
  fontSize: number;
  measure: (text: string, fontSize: number, fontWeight?: string) => number;
}) => {
  let line = "";
  let index = start;

  while (index < words.length) {
    const candidate = line ? `${line} ${words[index]}` : words[index];

    if (line && measure(candidate, fontSize) > width) {
      break;
    }

    line = candidate;
    index += 1;

    if (measure(line, fontSize) > width && !line.includes(" ")) {
      break;
    }
  }

  return { line, next: Math.max(index, start + 1) };
};

const layoutBodyLines = ({
  text,
  x,
  y,
  width,
  height,
  fontSize,
  authorBox,
  measure,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  authorBox: { x: number; y: number; width: number; height: number } | null;
  measure: (text: string, fontSize: number, fontWeight?: string) => number;
}) => {
  const words = splitWords(text);
  const lineHeight = fontSize * 1.32;
  const lines: SampadakPatraLine[] = [];
  let wordIndex = 0;
  let lineY = y;

  while (wordIndex < words.length && lineY + lineHeight <= y + height) {
    const overlapsAuthor =
      authorBox &&
      lineY + lineHeight > authorBox.y &&
      lineY < authorBox.y + authorBox.height;
    const lineX = overlapsAuthor ? authorBox.x + authorBox.width + fontSize * 0.85 : x;
    const lineWidth = overlapsAuthor ? x + width - lineX : width;

    if (lineWidth < fontSize * 3) {
      lineY += lineHeight;
      continue;
    }

    const { line, next } = fitLine({
      words,
      start: wordIndex,
      width: lineWidth,
      fontSize,
      measure,
    });

    if (!line) {
      break;
    }

    lines.push({ text: line, x: lineX, y: lineY, width: lineWidth, fontSize, lineHeight });
    wordIndex = next;
    lineY += lineHeight;
  }

  return lines;
};

export const getSampadakPatraLayout = ({
  x,
  y,
  width,
  height,
  body,
  authorName,
  authorLocation,
  contact,
  measureText,
}: SampadakPatraInput): SampadakPatraLayout => {
  const measure = measureText ?? estimateTextWidth;
  const pad = clamp(Math.min(width, height) * 0.045, 4, 12);
  const headerHeight = clamp(height * 0.18, 27, 54);
  const contactHeight = clamp(height * 0.2, 40, 72);
  const logoWidth = clamp(headerHeight * 1.52, 44, 82);
  const logoHeight = clamp(headerHeight * 0.78, 26, 44);
  const rightBarWidth = clamp(width * 0.018, 4.5, 9);
  const bodyTop = y + headerHeight + pad * 0.15;
  const bodyBottom = y + height - contactHeight - pad * 0.55;
  const bodyX = x + pad;
  const bodyWidth = width - pad * 2;
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const bodyFontSize = clamp(Math.min(width / 22.5, height / 31), 8.2, 16);
  const authorBoxWidth = clamp(width * 0.22, 52, 104);
  const authorBoxHeight = clamp(bodyFontSize * 3.25, 30, 58);
  const titleFontSize = clamp(headerHeight * 0.54, 15, 30);
  const hasAuthor = Boolean(normalize(authorName) || normalize(authorLocation));
  const authorBox = hasAuthor
    ? {
        x: bodyX + pad * 0.25,
        y: bodyTop + bodyHeight * 0.38,
        width: authorBoxWidth,
        height: authorBoxHeight,
        name: normalize(authorName) || "रेश नामदेव",
        location: normalize(authorLocation) || "जिन्सी, भोपाल",
        fontSize: clamp(bodyFontSize * 0.78, 7.5, 13),
      }
    : null;

  return {
    background: { x, y, width, height, fill: BG },
    header: {
      x,
      y,
      width,
      height: headerHeight,
      logo: {
        x: x + pad,
        y: y + (headerHeight - logoHeight) / 2,
        width: logoWidth,
        height: logoHeight,
        fill: BLUE,
      },
      title: {
        text: "संपादक के नाम पत्र",
        x: x + pad + logoWidth + pad * 1.2,
        y: y + (headerHeight - titleFontSize * 1.03) / 2,
        width: width - logoWidth - pad * 3.5 - rightBarWidth,
        fontSize: titleFontSize,
      },
      rightBar: {
        x: x + width - pad * 0.65 - rightBarWidth,
        y: y + (headerHeight - logoHeight) / 2,
        width: rightBarWidth,
        height: logoHeight,
        fill: BLUE,
      },
    },
    bodyLines: layoutBodyLines({
      text: normalize(body),
      x: bodyX,
      y: bodyTop,
      width: bodyWidth,
      height: bodyHeight,
      fontSize: bodyFontSize,
      authorBox,
      measure,
    }),
    authorBox,
    contactStrip: {
      x: x + pad,
      y: y + height - contactHeight + pad * 0.35,
      width: width - pad * 2,
      height: Math.max(1, contactHeight - pad * 0.75),
      instruction:
        "संपादक के नाम पत्र भेजने के लिए हमें ई-मेल या वाट्सएप कर सकते हैं। श्रेष्ठ साप्ताहिक संपादक के नाम पत्र को रु. 500 का इनाम दिया जाएगा। विजेता की घोषणा प्रत्येक रविवार को की जाएगी।",
      email: normalize(contact?.email) || "kumaridivyathecliffnews@gmail.com",
      phone: normalize(contact?.phone) || "9303108665",
      fontSize: clamp(bodyFontSize * 0.68, 6.4, 10.5),
    },
  };
};

export const extractSampadakPatraEmail = (...values: Array<string | undefined>) =>
  values.map(normalize).join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";

export const extractSampadakPatraPhone = (...values: Array<string | undefined>) =>
  values.map(normalize).join(" ").match(/(?:\+?91[-\s]?)?[6-9]\d{9}/)?.[0] ?? "";

export const isSampadakPatraStory = (story: {
  templateStoryNumber?: number;
  compositionSettings?: { editorialPageStyle?: unknown };
}) => Boolean(story.compositionSettings?.editorialPageStyle && story.templateStoryNumber === 4);

export const SAMPADAK_PATRA_COLORS = { BG, BLUE, INK };
