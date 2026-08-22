import { NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";

const allowedProtocols = new Set(["http:", "https:"]);
const GAUTAM_API_HOST = "103.192.198.73";
const GAUTAM_ENGLISH_API_KEY =
  "1f167aa0133f4836b63de2e751228b55a5b730bd95df43379c2901bbe1a7d4d3";

const getGautamApiKey = () =>
  process.env.GAUTAM_NEWS_API_KEY ||
  process.env.NEWSWIRE_ENGLISH_API_KEY ||
  GAUTAM_ENGLISH_API_KEY;

const fetchProtectedGautamImage = (sourceUrl: URL): Promise<{ contentType: string; bytes: Buffer }> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      sourceUrl,
      {
        method: "GET",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          "User-Agent": "NewspaperGeneratorPrintExport/1.0",
          "x-api-key": getGautamApiKey(),
        },
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Image fetch failed with ${response.statusCode ?? 0}.`));
            return;
          }

          resolve({
            contentType: response.headers["content-type"]?.toString() ?? "application/octet-stream",
            bytes: Buffer.concat(chunks),
          });
        });
      },
    );

    request.setTimeout(30000, () => {
      request.destroy(new Error("Image fetch timed out."));
    });
    request.on("error", reject);
    request.end();
  });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("url") ?? "";
  let sourceUrl: URL;

  try {
    sourceUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  if (!allowedProtocols.has(sourceUrl.protocol)) {
    return NextResponse.json({ error: "Unsupported image URL protocol." }, { status: 400 });
  }

  if (sourceUrl.hostname === GAUTAM_API_HOST && sourceUrl.pathname.startsWith("/api/v1/media/")) {
    try {
      const image = await fetchProtectedGautamImage(sourceUrl);

      const body = new Uint8Array(image.bytes);

      return new NextResponse(body, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": image.contentType,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Image fetch failed." },
        { status: 502 },
      );
    }
  }

  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      "User-Agent": "NewspaperGeneratorPrintExport/1.0",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Image fetch failed with ${response.status}.` }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = await response.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    },
  });
}
