import { getNewspaperFontStack } from "@/engines/FontManager/FontManagerEngine";
import { RASHIFAL_GLYPH_FONT, getRashifalGrid, type RashifalReading } from "./RashifalGridGeometry";

/**
 * Paints the आज का राशिफल grid onto a 2D canvas.
 *
 * The PDF export builds its own canvas rather than rasterising the Konva layer
 * tree, so this is the export-side twin of the `RashifalGrid` component. Both
 * read `getRashifalGrid`, so the only thing that can differ between screen and
 * sheet is the drawing calls — not the layout.
 */
export const drawRashifalGridToCanvas = (
  context: CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    height,
    readings,
    title,
    columns,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    readings: RashifalReading[];
    title?: string;
    /** Cells per row. Omitted by every existing caller, which keeps the default of 2. */
    columns?: number;
  },
) => {
  const grid = getRashifalGrid({ x, y, width, height, readings, title, columns });
  const serif = getNewspaperFontStack("serif");
  const sans = getNewspaperFontStack("sans");

  context.save();
  context.textBaseline = "top";

  // Devotional frame: double rule with corner diamonds.
  context.strokeStyle = grid.frame.stroke;
  context.lineWidth = grid.frame.outer.strokeWidth;
  context.strokeRect(
    grid.frame.outer.x,
    grid.frame.outer.y,
    grid.frame.outer.width,
    grid.frame.outer.height,
  );
  context.lineWidth = grid.frame.inner.strokeWidth;
  context.strokeRect(
    grid.frame.inner.x,
    grid.frame.inner.y,
    grid.frame.inner.width,
    grid.frame.inner.height,
  );
  // Devotional motifs: scalloped arcs, corner lotuses and the kalash. Drawn
  // from the primitives the geometry emits, so this stays the Konva
  // component's exact twin.
  for (const shape of grid.frame.shapes) {
    if (shape.kind === "ellipse") {
      context.save();
      context.translate(shape.cx, shape.cy);
      context.rotate(shape.rotation);
      context.beginPath();
      context.ellipse(0, 0, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      context.fillStyle = shape.fill;
      context.fill();
      context.restore();
      continue;
    }

    if (shape.kind === "circle") {
      context.beginPath();
      context.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
      context.fillStyle = shape.fill;
      context.fill();
      continue;
    }

    context.beginPath();
    context.arc(shape.cx, shape.cy, shape.radius, shape.from, shape.to);
    context.strokeStyle = shape.stroke;
    context.lineWidth = shape.strokeWidth;
    context.stroke();
  }

  // Block title, with a clean bordered devotional heading.
  context.fillStyle = "#FFF7E8";
  context.fillRect(grid.title.x + 4, grid.title.y + 2.5, grid.title.width - 8, grid.title.height - 7);
  context.strokeStyle = "#9C1C1C";
  context.lineWidth = 1.2;
  context.strokeRect(grid.title.x + 4, grid.title.y + 2.5, grid.title.width - 8, grid.title.height - 7);
  context.fillStyle = "#9C1C1C";
  context.font = `900 17px ${serif}`;
  context.textAlign = "center";
  context.fillText(grid.title.text, grid.title.x + grid.title.width / 2, grid.title.y + 5.4);
  context.textAlign = "left";

  for (const cell of grid.cells) {
    // Body wash plus header, so the cell reads as one object.
    context.fillStyle = cell.bodyFill;
    context.fillRect(cell.x, cell.y, cell.width, cell.height);
    context.strokeStyle = cell.headerFill;
    context.lineWidth = 0.4;
    context.strokeRect(cell.x, cell.y, cell.width, cell.height);

    context.fillStyle = cell.headerFill;
    context.fillRect(cell.x, cell.y, cell.width, cell.headerHeight);

    // Glyph in a light disc.
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.beginPath();
    context.arc(cell.glyphCenterX, cell.glyphCenterY, cell.glyphRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = cell.headerFill;
    context.font = `${cell.glyphRadius * 1.6}px ${RASHIFAL_GLYPH_FONT}`;
    context.textAlign = "center";
    context.fillText(cell.glyph, cell.glyphCenterX, cell.glyphCenterY - cell.glyphRadius + 0.6);
    context.textAlign = "left";

    const nameX = cell.glyphCenterX + cell.glyphRadius + 3;
    context.fillStyle = "#FFFFFF";
    context.font = `700 9px ${serif}`;
    context.fillText(cell.sign, nameX, cell.y + 4, Math.max(1, cell.x + cell.width - nameX - 3));

    // The reading, wrapped by hand and clipped to the cell — canvas has no
    // wrapping of its own, and a cell must never spill into its neighbour.
    context.fillStyle = "#2A2621";
    const fontSize = 7.4;
    context.font = `${fontSize}px ${serif}`;
    const lineHeight = fontSize * 1.18;
    const maxLines = Math.max(1, Math.floor(cell.textHeight / lineHeight));
    let line = "";
    let lineIndex = 0;

    for (const word of cell.text.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;

      if (context.measureText(candidate).width <= cell.textWidth || !line) {
        line = candidate;
        continue;
      }

      context.fillText(line, cell.textX, cell.textY + lineIndex * lineHeight);
      lineIndex += 1;
      line = word;

      if (lineIndex >= maxLines) {
        line = "";
        break;
      }
    }

    if (line && lineIndex < maxLines) {
      context.fillText(line, cell.textX, cell.textY + lineIndex * lineHeight);
    }

    if (cell.metaText) {
      context.fillStyle = "rgba(255,255,255,0.68)";
      context.fillRect(cell.metaX - 1, cell.metaY - 1, cell.metaWidth + 2, cell.metaHeight + 1);
      context.fillStyle = "#7B2E12";
      context.font = `700 5.3px ${sans}`;
      const partWidth = cell.metaWidth / 3;

      context.textAlign = "left";
      context.fillText(cell.metaLeftText, cell.metaX, cell.metaY, partWidth);

      context.textAlign = "center";
      context.fillText(cell.metaCenterText, cell.metaX + partWidth * 1.5, cell.metaY, partWidth);

      context.textAlign = "right";
      context.fillText(cell.metaRightText, cell.metaX + partWidth * 3, cell.metaY, partWidth);
      context.textAlign = "left";
    }
  }

  context.restore();
};
