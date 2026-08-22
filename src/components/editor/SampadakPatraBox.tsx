"use client";

import { Group, Line, Path, Rect, Text } from "react-konva";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  SAMPADAK_PATRA_COLORS,
  extractSampadakPatraEmail,
  extractSampadakPatraPhone,
  getSampadakPatraLayout,
} from "@/engines/MasterPage/SampadakPatraGeometry";
import { richTextToPlainText } from "@/engines/RichText/RichTextUtils";
import type { StoryFrame } from "@/types/editor";

type SampadakPatraBoxProps = {
  story: StoryFrame;
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getLetterData = (story: StoryFrame) => {
  const articleData = story.articleData as StoryFrame["articleData"] & {
    letterAuthor?: string;
    letterLocation?: string;
    letterEmail?: string;
    letterPhone?: string;
  };
  const body = richTextToPlainText(articleData.body);
  const headline = richTextToPlainText(articleData.headline);
  const subheadline = richTextToPlainText(articleData.subheadline);
  const summary = asString(articleData.editorSummary);
  const authorName =
    asString(articleData.letterAuthor) ||
    asString(articleData.editorName) ||
    asString(articleData.author);
  const authorLocation =
    asString(articleData.letterLocation) ||
    asString(articleData.location) ||
    asString(articleData.agency);
  const email =
    asString(articleData.letterEmail) ||
    extractSampadakPatraEmail(body, headline, subheadline, summary);
  const phone =
    asString(articleData.letterPhone) ||
    extractSampadakPatraPhone(body, headline, subheadline, summary);

  return {
    body: body || summary || subheadline || headline,
    authorName,
    authorLocation,
    email,
    phone,
  };
};

export function SampadakPatraBox({ story }: SampadakPatraBoxProps) {
  const serif = getNewspaperFontStack("serif");
  const sans = getNewspaperFontStack("sans");
  const data = getLetterData(story);
  const layout = getSampadakPatraLayout({
    x: story.x,
    y: story.y,
    width: story.width,
    height: story.height,
    body: data.body,
    authorName: data.authorName,
    authorLocation: data.authorLocation,
    contact: { email: data.email, phone: data.phone },
  });
  const pen = layout.header.logo;
  const author = layout.authorBox;
  const contact = layout.contactStrip;

  return (
    <Group listening={false}>
      <Rect {...layout.background} />
      <Rect
        x={pen.x}
        y={pen.y}
        width={pen.width}
        height={pen.height}
        fill={pen.fill}
      />
      <Rect
        x={pen.x + pen.width * 0.1}
        y={pen.y + pen.height * 0.14}
        width={pen.width * 0.8}
        height={pen.height * 0.72}
        fill="#FFFFFF"
        opacity={0.95}
      />
      <Path
        data={[
          `M ${pen.x + pen.width * 0.24} ${pen.y + pen.height * 0.58}`,
          `C ${pen.x + pen.width * 0.31} ${pen.y + pen.height * 0.46}, ${pen.x + pen.width * 0.4} ${pen.y + pen.height * 0.39}, ${pen.x + pen.width * 0.52} ${pen.y + pen.height * 0.35}`,
          `L ${pen.x + pen.width * 0.72} ${pen.y + pen.height * 0.3}`,
          `C ${pen.x + pen.width * 0.77} ${pen.y + pen.height * 0.29}, ${pen.x + pen.width * 0.8} ${pen.y + pen.height * 0.36}, ${pen.x + pen.width * 0.75} ${pen.y + pen.height * 0.4}`,
          `L ${pen.x + pen.width * 0.46} ${pen.y + pen.height * 0.64}`,
          `C ${pen.x + pen.width * 0.36} ${pen.y + pen.height * 0.72}, ${pen.x + pen.width * 0.25} ${pen.y + pen.height * 0.73}, ${pen.x + pen.width * 0.18} ${pen.y + pen.height * 0.67}`,
          `C ${pen.x + pen.width * 0.15} ${pen.y + pen.height * 0.64}, ${pen.x + pen.width * 0.18} ${pen.y + pen.height * 0.6}, ${pen.x + pen.width * 0.24} ${pen.y + pen.height * 0.58}`,
          "Z",
        ].join(" ")}
        fill="#FFFFFF"
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(1.1, pen.height * 0.04)}
      />
      <Line
        points={[
          pen.x + pen.width * 0.18,
          pen.y + pen.height * 0.77,
          pen.x + pen.width * 0.72,
          pen.y + pen.height * 0.22,
        ]}
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(2.6, pen.height * 0.105)}
        lineCap="round"
      />
      <Line
        points={[
          pen.x + pen.width * 0.14,
          pen.y + pen.height * 0.82,
          pen.x + pen.width * 0.24,
          pen.y + pen.height * 0.67,
          pen.x + pen.width * 0.36,
          pen.y + pen.height * 0.82,
        ]}
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(1, pen.height * 0.055)}
        lineJoin="round"
      />
      <Line
        points={[
          pen.x + pen.width * 0.36,
          pen.y + pen.height * 0.58,
          pen.x + pen.width * 0.71,
          pen.y + pen.height * 0.48,
        ]}
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(1.1, pen.height * 0.04)}
        lineCap="round"
      />
      <Line
        points={[
          pen.x + pen.width * 0.4,
          pen.y + pen.height * 0.52,
          pen.x + pen.width * 0.73,
          pen.y + pen.height * 0.43,
        ]}
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(1.1, pen.height * 0.04)}
        lineCap="round"
      />
      <Path
        data={[
          `M ${pen.x + pen.width * 0.16} ${pen.y + pen.height * 0.78}`,
          `L ${pen.x + pen.width * 0.23} ${pen.y + pen.height * 0.69}`,
          `L ${pen.x + pen.width * 0.29} ${pen.y + pen.height * 0.82}`,
          "Z",
        ].join(" ")}
        fill="#FFFFFF"
        stroke={SAMPADAK_PATRA_COLORS.INK}
        strokeWidth={Math.max(0.9, pen.height * 0.035)}
      />

      <Text
        x={layout.header.title.x}
        y={layout.header.title.y}
        width={layout.header.title.width}
        text={layout.header.title.text}
        fill={SAMPADAK_PATRA_COLORS.INK}
        fontFamily={serif}
        fontStyle="900"
        fontSize={layout.header.title.fontSize}
        align="center"
        wrap="none"
      />
      <Rect {...layout.header.rightBar} />

      {layout.bodyLines.map((line, index) => (
        <Text
          key={`letter-line-${index}`}
          x={line.x}
          y={line.y}
          width={line.width}
          text={line.text}
          fill={SAMPADAK_PATRA_COLORS.INK}
          fontFamily={serif}
          fontSize={line.fontSize}
          lineHeight={line.lineHeight / line.fontSize}
          wrap="none"
        />
      ))}

      {author ? (
        <Group>
          <Rect
            x={author.x}
            y={author.y}
            width={author.width}
            height={author.height}
            fill="#FFFFFF"
          />
          <Text
            x={author.x + 4}
            y={author.y + author.height * 0.16}
            width={author.width - 8}
            text={`${author.name}\n${author.location}`}
            fill={SAMPADAK_PATRA_COLORS.INK}
            fontFamily={serif}
            fontStyle="800"
            fontSize={author.fontSize}
            lineHeight={1.25}
            align="left"
          />
        </Group>
      ) : null}

      <Rect
        x={contact.x}
        y={contact.y}
        width={contact.width}
        height={contact.height}
        fill="#FFFFFF"
      />
      <Text
        x={contact.x + 8}
        y={contact.y + 3}
        width={contact.width - 16}
        text={contact.instruction}
        fill="#494949"
        fontFamily={serif}
        fontSize={contact.fontSize}
        align="center"
        wrap="word"
      />
      <Rect
        x={contact.x + 9}
        y={contact.y + contact.height - contact.fontSize * 2.65}
        width={contact.fontSize * 1.05}
        height={contact.fontSize * 0.72}
        stroke="#D06B3D"
        strokeWidth={1}
      />
      <Line
        points={[
          contact.x + 9,
          contact.y + contact.height - contact.fontSize * 2.65,
          contact.x + 9 + contact.fontSize * 0.53,
          contact.y + contact.height - contact.fontSize * 2.25,
          contact.x + 9 + contact.fontSize * 1.05,
          contact.y + contact.height - contact.fontSize * 2.65,
        ]}
        stroke="#D06B3D"
        strokeWidth={0.8}
      />
      <Text
        x={contact.x + 13 + contact.fontSize * 1.05}
        y={contact.y + contact.height - contact.fontSize * 2.78}
        width={contact.width - 24 - contact.fontSize * 1.05}
        text={contact.email}
        fill={SAMPADAK_PATRA_COLORS.INK}
        fontFamily={sans}
        fontSize={contact.fontSize * 1.22}
        wrap="none"
      />
      <Rect
        x={contact.x + 9}
        y={contact.y + contact.height - contact.fontSize * 1.43}
        width={contact.fontSize * 1.05}
        height={contact.fontSize * 1.05}
        fill="#1FA463"
      />
      <Text
        x={contact.x + 9}
        y={contact.y + contact.height - contact.fontSize * 1.43}
        width={contact.fontSize * 1.05}
        text="W"
        fill="#FFFFFF"
        fontFamily={sans}
        fontStyle="800"
        fontSize={contact.fontSize * 0.72}
        align="center"
      />
      <Text
        x={contact.x + 13 + contact.fontSize * 1.05}
        y={contact.y + contact.height - contact.fontSize * 1.52}
        width={contact.width - 24 - contact.fontSize * 1.05}
        text={contact.phone}
        fill={SAMPADAK_PATRA_COLORS.INK}
        fontFamily={sans}
        fontSize={contact.fontSize * 1.22}
        wrap="none"
      />
    </Group>
  );
}
