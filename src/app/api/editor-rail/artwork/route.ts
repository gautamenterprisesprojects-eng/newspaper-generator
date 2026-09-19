import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Live-substitutable SVG (real <text> nodes for name/place/designation, a
// swappable portrait <image>) -- replaces the old flattened
// cliff-sandesh-rail.png, which needed canvas-overlay text drawn on top of
// it in a font/position that could drift from the artwork's own design.
const FILE_NAME = "sub editor rail.svg";

const candidates = () => [
  path.join(process.cwd(), "public", FILE_NAME),
  path.join(process.cwd(), FILE_NAME),
];

export async function GET() {
  for (const filePath of candidates()) {
    try {
      const bytes = await fs.readFile(filePath);
      return new NextResponse(bytes, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "image/svg+xml",
        },
      });
    } catch {
      // try the next standalone layout
    }
  }

  return NextResponse.json({ error: "Editor rail artwork is missing." }, { status: 404 });
}
