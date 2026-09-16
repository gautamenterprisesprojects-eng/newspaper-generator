import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const FILE_NAME = "vikash-tiwari.png";

const candidates = () => [
  path.join(process.cwd(), "public", "editor-rail", FILE_NAME),
  path.join(process.cwd(), "editor-rail", FILE_NAME),
];

export async function GET() {
  for (const filePath of candidates()) {
    try {
      const bytes = await fs.readFile(filePath);
      return new NextResponse(bytes, {
        headers: {
          "Cache-Control": "public, max-age=86400, immutable",
          "Content-Type": "image/png",
        },
      });
    } catch {
      // try the next standalone layout
    }
  }

  return NextResponse.json({ error: "Editor rail portrait is missing." }, { status: 404 });
}
