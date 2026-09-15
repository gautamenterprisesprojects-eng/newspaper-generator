import type {
  ArticleLayoutBodyColumn,
  ArticleParagraphFormatting,
  ArticleParagraphLayoutBounds,
  ArticleParagraphTypography,
  EditorialTextAlignment,
} from "@/types/editor";
import type { RichTextContent } from "@/types/RichText";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";

const paragraphSplitPattern = /\n\s*\n|\n/;

export const createDefaultParagraphFormatting = (
  update: Partial<ArticleParagraphFormatting> = {},
): ArticleParagraphFormatting => ({
  fontFamily: "Cliff Noto Devanagari",
  fontSize: 12,
  fontWeight: "400",
  color: "#111111",
  alignment: "justify",
  leadingMode: "auto",
  leadingValue: 12,
  tracking: 0,
  horizontalScale: 100,
  verticalScale: 100,
  characterSpacing: 0,
  firstLineIndent: 0,
  leftIndent: 0,
  rightIndent: 0,
  spaceBefore: 0,
  spaceAfter: 0,
  paragraphGap: 0,
  language: "mixed",
  hyphenation: true,
  widowControl: true,
  orphanControl: true,
  keepTogether: false,
  paragraphBackground: "transparent",
  paragraphBorder: "transparent",
  dropCap: false,
  rulesAbove: false,
  rulesBelow: false,
  ...update,
});

export const splitBodyParagraphs = (content: RichTextContent) => {
  const text = richTextToPlainText(content);
  const paragraphs: { text: string; start: number; end: number }[] = [];
  let cursor = 0;

  for (const rawParagraph of text.split(paragraphSplitPattern)) {
    const start = cursor;
    const end = start + rawParagraph.length;
    const trimmed = rawParagraph.trim();

    if (trimmed.length > 0) {
      const leadingWhitespace = rawParagraph.indexOf(trimmed);
      paragraphs.push({
        text: trimmed,
        start: start + Math.max(0, leadingWhitespace),
        end: start + Math.max(0, leadingWhitespace) + trimmed.length,
      });
    }

    cursor = end + 1;
  }

  if (paragraphs.length === 0 && text.trim().length > 0) {
    paragraphs.push({
      text: text.trim(),
      start: text.indexOf(text.trim()),
      end: text.indexOf(text.trim()) + text.trim().length,
    });
  }

  return paragraphs;
};

export const normalizeParagraphTypography = ({
  content,
  existing,
  defaults,
}: {
  content: RichTextContent;
  existing?: ArticleParagraphTypography[];
  defaults?: Partial<ArticleParagraphFormatting>;
}): ArticleParagraphTypography[] => {
  const paragraphs = splitBodyParagraphs(content);

  return paragraphs.map((paragraph, index) => {
    const previous = existing?.[index];

    return {
      id: previous?.id ?? `paragraph-${index + 1}`,
      index,
      textStart: paragraph.start,
      textEnd: paragraph.end,
      preview: paragraph.text.slice(0, 80),
      formatting: createDefaultParagraphFormatting({
        ...defaults,
        ...(previous?.formatting ?? {}),
      }),
    };
  });
};

export const updateParagraphFormatting = (
  paragraphs: ArticleParagraphTypography[],
  index: number,
  update: Partial<ArticleParagraphFormatting>,
) =>
  paragraphs.map((paragraph) =>
    paragraph.index === index
      ? {
          ...paragraph,
          formatting: createDefaultParagraphFormatting({
            ...paragraph.formatting,
            ...update,
          }),
        }
      : paragraph,
  );

export const getParagraphAlignmentUpdate = (
  formatting: ArticleParagraphFormatting,
): { bodyAlignment: EditorialTextAlignment; paragraphIndent: number; firstLineIndent: number; paragraphGap: number } => ({
  bodyAlignment: formatting.alignment,
  paragraphIndent: formatting.leftIndent,
  firstLineIndent: formatting.firstLineIndent,
  paragraphGap: formatting.paragraphGap,
});

const getLineParagraphIndex = (line: { paragraphIndex?: number }, fallbackIndex: number) =>
  typeof line.paragraphIndex === "number" ? line.paragraphIndex : fallbackIndex;

export const createParagraphLayoutBounds = (
  columns: ArticleLayoutBodyColumn[],
): ArticleParagraphLayoutBounds[] => {
  const boundsByParagraph = new Map<number, ArticleParagraphLayoutBounds>();

  for (const column of columns) {
    for (const line of column.lines) {
      const index = getLineParagraphIndex(line, 0);
      const existing = boundsByParagraph.get(index);
      const x = line.x;
      const y = line.y;
      const right = line.x + line.width;
      const bottom = line.y + line.height;

      if (!existing) {
        boundsByParagraph.set(index, {
          index,
          label: `P${index + 1}`,
          x,
          y,
          width: line.width,
          height: line.height,
          lineCount: 1,
        });
        continue;
      }

      const nextX = Math.min(existing.x, x);
      const nextY = Math.min(existing.y, y);
      const nextRight = Math.max(existing.x + existing.width, right);
      const nextBottom = Math.max(existing.y + existing.height, bottom);

      boundsByParagraph.set(index, {
        ...existing,
        x: nextX,
        y: nextY,
        width: nextRight - nextX,
        height: nextBottom - nextY,
        lineCount: existing.lineCount + 1,
      });
    }
  }

  return [...boundsByParagraph.values()].sort((a, b) => a.index - b.index);
};

export const ParagraphTypographyEngine = {
  createDefaultParagraphFormatting,
  createParagraphLayoutBounds,
  getParagraphAlignmentUpdate,
  normalizeParagraphTypography,
  splitBodyParagraphs,
  updateParagraphFormatting,
};
