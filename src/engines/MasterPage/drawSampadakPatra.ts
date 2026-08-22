import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import {
  SAMPADAK_PATRA_COLORS,
  getSampadakPatraLayout,
  type SampadakPatraInput,
} from "./SampadakPatraGeometry";

const drawWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  lineHeight: number,
  maxHeight: number,
) => {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lineIndex = 0;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && context.measureText(candidate).width > width) {
      context.fillText(line, x, y + lineIndex * lineHeight, width);
      lineIndex += 1;
      line = word;

      if (lineIndex >= maxLines) {
        return;
      }
      continue;
    }

    line = candidate;
  }

  if (line && lineIndex < maxLines) {
    context.fillText(line, x, y + lineIndex * lineHeight, width);
  }
};

export const drawSampadakPatraToCanvas = (
  context: CanvasRenderingContext2D,
  input: Omit<SampadakPatraInput, "measureText">,
) => {
  const serif = getNewspaperFontStack("serif");
  const sans = getNewspaperFontStack("sans");
  const measureText = (text: string, fontSize: number, fontWeight?: string) => {
    context.save();
    context.font = `${fontWeight ?? "400"} ${fontSize}px ${serif}`;
    const width = context.measureText(text).width;
    context.restore();
    return width;
  };
  const layout = getSampadakPatraLayout({ ...input, measureText });
  const pen = layout.header.logo;
  const author = layout.authorBox;
  const contact = layout.contactStrip;

  context.save();
  context.textBaseline = "top";

  context.fillStyle = layout.background.fill;
  context.fillRect(layout.background.x, layout.background.y, layout.background.width, layout.background.height);

  context.fillStyle = pen.fill;
  context.fillRect(pen.x, pen.y, pen.width, pen.height);
  context.fillStyle = "rgba(255,255,255,0.95)";
  context.fillRect(pen.x + pen.width * 0.1, pen.y + pen.height * 0.14, pen.width * 0.8, pen.height * 0.72);

  context.strokeStyle = SAMPADAK_PATRA_COLORS.INK;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.24, pen.y + pen.height * 0.58);
  context.bezierCurveTo(
    pen.x + pen.width * 0.31,
    pen.y + pen.height * 0.46,
    pen.x + pen.width * 0.4,
    pen.y + pen.height * 0.39,
    pen.x + pen.width * 0.52,
    pen.y + pen.height * 0.35,
  );
  context.lineTo(pen.x + pen.width * 0.72, pen.y + pen.height * 0.3);
  context.bezierCurveTo(
    pen.x + pen.width * 0.77,
    pen.y + pen.height * 0.29,
    pen.x + pen.width * 0.8,
    pen.y + pen.height * 0.36,
    pen.x + pen.width * 0.75,
    pen.y + pen.height * 0.4,
  );
  context.lineTo(pen.x + pen.width * 0.46, pen.y + pen.height * 0.64);
  context.bezierCurveTo(
    pen.x + pen.width * 0.36,
    pen.y + pen.height * 0.72,
    pen.x + pen.width * 0.25,
    pen.y + pen.height * 0.73,
    pen.x + pen.width * 0.18,
    pen.y + pen.height * 0.67,
  );
  context.bezierCurveTo(
    pen.x + pen.width * 0.15,
    pen.y + pen.height * 0.64,
    pen.x + pen.width * 0.18,
    pen.y + pen.height * 0.6,
    pen.x + pen.width * 0.24,
    pen.y + pen.height * 0.58,
  );
  context.closePath();
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.lineWidth = Math.max(1.1, pen.height * 0.04);
  context.stroke();

  context.lineWidth = Math.max(2.6, pen.height * 0.105);
  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.18, pen.y + pen.height * 0.77);
  context.lineTo(pen.x + pen.width * 0.72, pen.y + pen.height * 0.22);
  context.stroke();

  context.lineWidth = Math.max(1, pen.height * 0.055);
  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.14, pen.y + pen.height * 0.82);
  context.lineTo(pen.x + pen.width * 0.24, pen.y + pen.height * 0.67);
  context.lineTo(pen.x + pen.width * 0.36, pen.y + pen.height * 0.82);
  context.stroke();

  context.lineWidth = Math.max(1.1, pen.height * 0.04);
  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.36, pen.y + pen.height * 0.58);
  context.lineTo(pen.x + pen.width * 0.71, pen.y + pen.height * 0.48);
  context.stroke();
  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.4, pen.y + pen.height * 0.52);
  context.lineTo(pen.x + pen.width * 0.73, pen.y + pen.height * 0.43);
  context.stroke();

  context.beginPath();
  context.moveTo(pen.x + pen.width * 0.16, pen.y + pen.height * 0.78);
  context.lineTo(pen.x + pen.width * 0.23, pen.y + pen.height * 0.69);
  context.lineTo(pen.x + pen.width * 0.29, pen.y + pen.height * 0.82);
  context.closePath();
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.lineWidth = Math.max(0.9, pen.height * 0.035);
  context.strokeStyle = SAMPADAK_PATRA_COLORS.INK;
  context.stroke();

  context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
  context.font = `900 ${layout.header.title.fontSize}px ${serif}`;
  context.textAlign = "center";
  context.fillText(
    layout.header.title.text,
    layout.header.title.x + layout.header.title.width / 2,
    layout.header.title.y,
    layout.header.title.width,
  );
  context.textAlign = "left";

  context.fillStyle = layout.header.rightBar.fill;
  context.fillRect(
    layout.header.rightBar.x,
    layout.header.rightBar.y,
    layout.header.rightBar.width,
    layout.header.rightBar.height,
  );

  context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
  for (const line of layout.bodyLines) {
    context.font = `${line.fontWeight ?? "400"} ${line.fontSize}px ${serif}`;
    context.fillText(line.text, line.x, line.y, line.width);
  }

  if (author) {
    context.fillStyle = "#FFFFFF";
    context.fillRect(author.x, author.y, author.width, author.height);
    context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
    context.font = `800 ${author.fontSize}px ${serif}`;
    context.fillText(author.name, author.x + 4, author.y + author.height * 0.16, author.width - 8);
    context.fillText(author.location, author.x + 4, author.y + author.height * 0.16 + author.fontSize * 1.25, author.width - 8);
  }

  context.fillStyle = "#FFFFFF";
  context.fillRect(contact.x, contact.y, contact.width, contact.height);
  context.fillStyle = "#494949";
  context.font = `400 ${contact.fontSize}px ${serif}`;
  context.textAlign = "center";
  drawWrappedText(
    context,
    contact.instruction,
    contact.x + contact.width / 2,
    contact.y + 4,
    contact.width - 14,
    contact.fontSize,
    contact.fontSize * 1.28,
    contact.height * 0.46,
  );
  context.textAlign = "left";

  context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
  context.font = `400 ${contact.fontSize * 1.22}px ${sans}`;
  const iconX = contact.x + 9;
  const iconSize = contact.fontSize * 1.05;
  const emailY = contact.y + contact.height - contact.fontSize * 2.65;
  const phoneY = contact.y + contact.height - contact.fontSize * 1.43;
  context.strokeStyle = "#D06B3D";
  context.lineWidth = 1;
  context.strokeRect(iconX, emailY, iconSize, contact.fontSize * 0.72);
  context.beginPath();
  context.moveTo(iconX, emailY);
  context.lineTo(iconX + iconSize * 0.5, emailY + contact.fontSize * 0.4);
  context.lineTo(iconX + iconSize, emailY);
  context.stroke();
  context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
  context.fillText(contact.email, iconX + iconSize + 4, emailY - contact.fontSize * 0.13, contact.width - iconSize - 24);

  context.fillStyle = "#1FA463";
  context.fillRect(iconX, phoneY, iconSize, iconSize);
  context.fillStyle = "#FFFFFF";
  context.font = `800 ${contact.fontSize * 0.72}px ${sans}`;
  context.textAlign = "center";
  context.fillText("W", iconX + iconSize / 2, phoneY + iconSize * 0.16, iconSize);
  context.textAlign = "left";
  context.fillStyle = SAMPADAK_PATRA_COLORS.INK;
  context.font = `400 ${contact.fontSize * 1.22}px ${sans}`;
  context.fillText(contact.phone, iconX + iconSize + 4, phoneY - contact.fontSize * 0.09, contact.width - iconSize - 24);

  context.restore();
};
