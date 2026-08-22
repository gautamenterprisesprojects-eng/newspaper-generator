import {
  fitYouthUpdateInsideTeaserHeadline,
  getYouthUpdateInsideTeaserStripGeometry,
  type YouthUpdateInsideAuthor,
} from "./YouthUpdateInsideTeaserGeometry";
import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS } from "./YouthUpdateConfig";

const getPrintableImageSource = (source: string) =>
  source.startsWith("http")
    ? `/api/print-image?url=${encodeURIComponent(source)}`
    : source;

/**
 * Paints Youth UPDATE's inside-page teaser strip onto a 2D canvas -- the
 * export-side twin of YouthUpdateInsideTeaserStrip.tsx. See
 * drawYouthUpdateMastheadToCanvas (EditorCanvas.tsx) for the established
 * pattern this mirrors.
 */
export const drawYouthUpdateInsideTeaserStripToCanvas = async (
  context: CanvasRenderingContext2D,
  input: {
    pageWidth: number;
    headlines: [string, string, string, string];
    labels: [string, string, string, string];
    imageUrls: [string, string, string, string];
    author?: YouthUpdateInsideAuthor;
  },
) => {
  const geometry = getYouthUpdateInsideTeaserStripGeometry({
    ...input,
    author: input.author ?? YOUTH_UPDATE_INSIDE_AUTHOR_DEFAULTS,
  });
  const sansSerif = getNewspaperFontStack("sans");
  const displaySerif = getNewspaperFontStack("serif");
  const authorFont = `"Anton", "Arial Narrow", Impact, sans-serif`;

  const drawCoverImage = async (imageUrl: string, x: number, y: number, width: number, height: number) => {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = getPrintableImageSource(imageUrl);
    });
    if (!image) return;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    const cropWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
    const cropHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
    const cropX = (image.naturalWidth - cropWidth) / 2;
    const cropY = Math.max(0, (image.naturalHeight - cropHeight) * 0.25);
    context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height);
  };

  context.save();
  context.textBaseline = "top";

  context.fillStyle = "#ffffff";
  context.fillRect(geometry.author.x, geometry.author.y, geometry.author.width, geometry.author.height);
  await drawCoverImage(
    geometry.author.imageUrl,
    geometry.author.photo.x,
    geometry.author.photo.y,
    geometry.author.photo.width,
    geometry.author.photo.height,
  );
  context.fillStyle = "#1797d8";
  context.fillRect(
    geometry.author.nameplate.x,
    geometry.author.nameplate.y,
    geometry.author.nameplate.width,
    geometry.author.nameplate.height,
  );
  context.fillStyle = "#f05223";
  context.fillRect(geometry.author.accent.x, geometry.author.accent.y, geometry.author.accent.width, geometry.author.accent.height);
  context.font = `${Math.max(5, geometry.author.name.height * 0.72)}px ${authorFont}`;
  context.fillStyle = "#ffffff";
  context.fillText(geometry.author.name.text, geometry.author.name.x, geometry.author.name.y);
  context.font = `${Math.max(3, geometry.author.designation.height * 0.64)}px ${authorFont}`;
  context.fillStyle = "#e6f7ff";
  context.fillText(geometry.author.designation.text, geometry.author.designation.x, geometry.author.designation.y);

  for (const box of geometry.boxes) {
    context.fillStyle = "#fffef9";
    context.fillRect(
      box.headline.x,
      geometry.y,
      box.photo.x + box.photo.width - box.headline.x,
      geometry.height,
    );

    context.textAlign = "left";
    const baseHeadlineFontSize = Math.max(12, box.headline.height * 0.34);
    // Same fit the Konva preview runs, off the same shared helper, so the
    // printed headline breaks in exactly the same places as the one on screen.
    const headlineFit = fitYouthUpdateInsideTeaserHeadline({
      text: box.headline.text,
      width: box.headline.width,
      height: box.headline.height,
      baseFontSize: baseHeadlineFontSize,
      measure: (value, fontSize) => {
        context.font = `bold ${fontSize}px ${displaySerif}`;
        return context.measureText(value).width;
      },
    });
    const headlineFontSize = headlineFit.fontSize;
    context.font = `bold ${headlineFontSize}px ${displaySerif}`;
    context.fillStyle = "#1a1a1a";
    const words = box.headline.text.split(" ");
    let line = "";
    let lineY = box.headline.y;
    const lineHeight = headlineFontSize * 1.05;
    // Condensing is a horizontal squeeze about the headline's own left edge,
    // so the wrap runs at the pre-squeeze measure and the drawn line lands on
    // the real one.
    context.save();
    if (headlineFit.scaleX !== 1) {
      context.translate(box.headline.x, 0);
      context.scale(headlineFit.scaleX, 1);
      context.translate(-box.headline.x, 0);
    }
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > headlineFit.width && line) {
        context.fillText(line, box.headline.x, lineY);
        line = word;
        lineY += lineHeight;
        if (lineY > box.headline.y + box.headline.height) break;
      } else {
        line = testLine;
      }
    }
    if (line && lineY <= box.headline.y + box.headline.height) {
      context.fillText(line, box.headline.x, lineY);
    }
    context.restore();

    const bodyFontSize = Math.max(9.2, baseHeadlineFontSize * 0.58);
    const regularFont = `${bodyFontSize}px ${displaySerif || sansSerif}`;
    const boldFont = `bold ${bodyFontSize}px ${displaySerif || sansSerif}`;
    context.fillStyle = "#111111";
    let bodyLineY = box.body.y;
    const bodyLineHeight = bodyFontSize * 1.1;
    
    let isDatelineBold = box.body.text.split(" ").slice(0, 5).some(w => w.endsWith("|"));

    const isSentenceBoundary = (w: string) => {
      if (!/[.!?]['"]?$/.test(w)) return false;
      const clean = w.replace(/[^a-zA-Z]/g, "");
      if (clean.length <= 2 && clean === clean.toUpperCase()) return false;
      if (/^(mr|mrs|dr|prof|st|rs|shri|smt)$/i.test(clean)) return false;
      return true;
    };

    for (const paragraph of box.body.text.split(/\n+/)) {
      const bodyWords = paragraph.trim().split(" ").filter(Boolean);
      let currentLineWords: { word: string; isBold: boolean }[] = [];
      let currentLineWidth = 0;
      let allFittedWords: { word: string; isBold: boolean; x: number; y: number }[] = [];
      let overflowed = false;

      for (const word of bodyWords) {
        const wordBold = isDatelineBold;
        if (isDatelineBold && word.endsWith("|")) {
          isDatelineBold = false;
        }

        context.font = wordBold ? boldFont : regularFont;
        const wordWidth = context.measureText(word).width;
        const spaceWidth = context.measureText(" ").width;
        const additionalWidth = currentLineWords.length > 0 ? spaceWidth + wordWidth : wordWidth;

        if (currentLineWidth + additionalWidth > box.body.width && currentLineWords.length > 0) {
          if (bodyLineY + bodyLineHeight > box.body.y + box.body.height) {
            overflowed = true;
            break;
          }

          let drawX = box.body.x;
          for (let i = 0; i < currentLineWords.length; i++) {
            const cw = currentLineWords[i];
            context.font = cw.isBold ? boldFont : regularFont;
            allFittedWords.push({ word: cw.word, isBold: cw.isBold, x: drawX, y: bodyLineY });
            drawX += context.measureText(cw.word).width + (i < currentLineWords.length - 1 ? context.measureText(" ").width : 0);
          }
          bodyLineY += bodyLineHeight;
          currentLineWords = [{ word, isBold: wordBold }];
          currentLineWidth = wordWidth;
        } else {
          currentLineWords.push({ word, isBold: wordBold });
          currentLineWidth += additionalWidth;
        }
      }

      if (!overflowed && currentLineWords.length > 0) {
        if (bodyLineY + bodyLineHeight <= box.body.y + box.body.height) {
          let drawX = box.body.x;
          for (let i = 0; i < currentLineWords.length; i++) {
            const cw = currentLineWords[i];
            context.font = cw.isBold ? boldFont : regularFont;
            allFittedWords.push({ word: cw.word, isBold: cw.isBold, x: drawX, y: bodyLineY });
            drawX += context.measureText(cw.word).width + (i < currentLineWords.length - 1 ? context.measureText(" ").width : 0);
          }
          bodyLineY += bodyLineHeight;
        } else {
          overflowed = true;
        }
      }

      if (overflowed) {
        let lastValidIdx = -1;
        for (let i = allFittedWords.length - 1; i >= 0; i--) {
          if (isSentenceBoundary(allFittedWords[i].word)) {
            lastValidIdx = i;
            break;
          }
        }
        if (lastValidIdx !== -1) {
          allFittedWords = allFittedWords.slice(0, lastValidIdx + 1);
        }
      }

      for (const cw of allFittedWords) {
        context.font = cw.isBold ? boldFont : regularFont;
        context.fillText(cw.word, cw.x, cw.y);
      }

      if (overflowed) break;
    }

    if (box.imageUrl) await drawCoverImage(box.imageUrl, box.photo.x, box.photo.y, box.photo.width, box.photo.height);
  }

  context.strokeStyle = "#128bd3";
  context.lineWidth = 1.2;
  for (const x of geometry.dividerXs) {
    context.beginPath();
    context.moveTo(x, geometry.y);
    context.lineTo(x, geometry.y + geometry.height);
    context.stroke();
  }

  context.strokeStyle = "#2fb8ee";
  context.lineWidth = 1.2;
  context.setLineDash([1, 2]);
  context.beginPath();
  context.moveTo(geometry.bottomRule.x1, geometry.bottomRule.y);
  context.lineTo(geometry.bottomRule.x2, geometry.bottomRule.y);
  context.stroke();
  context.setLineDash([]);

  context.restore();
};
