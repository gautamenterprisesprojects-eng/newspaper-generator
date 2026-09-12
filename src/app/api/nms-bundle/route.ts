import { NextRequest, NextResponse } from "next/server";
import { isAllowedNmsPageMintTarget, validateNmsBundlePayload } from "@/lib/nms/nmsBundleTypes";
import { readLatestNmsBundleSummary, storeNmsBundle } from "@/lib/nms/nmsBundleStorage";
import { cleanupOldNmsArtifacts } from "@/lib/nms/nmsRetention";
import { startNmsPdfJob } from "@/lib/nms/nmsPdfJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalApiKey = () => process.env.NMS_BUNDLE_API_KEY || process.env.NEWSPAPER_GENERATOR_API_KEY || "";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

const assertAuthorized = (request: NextRequest) => {
  const apiKey = optionalApiKey();
  if (!apiKey) return null;

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const direct = request.headers.get("x-api-key") || "";
  if (bearer === apiKey || direct === apiKey) return null;

  return json({ success: false, error: "Unauthorized." }, 401);
};

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) return authError;

  let payload;
  try {
    payload = validateNmsBundlePayload(await request.json());
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Invalid NMS bundle." }, 400);
  }

  const stored = await storeNmsBundle(payload);
  cleanupOldNmsArtifacts().catch((error: unknown) => console.error("[NMS retention] cleanup failed", error));

  const queuedPdf = isAllowedNmsPageMintTarget(payload);
  if (queuedPdf) {
    startNmsPdfJob(payload, stored);
  }

  return json({
    success: true,
    received: true,
    queuedPdf,
    stored: {
      payloadFile: stored.payloadFile,
      summaryFile: stored.summaryFile,
      latestPayloadFile: stored.latestPayloadFile,
      latestSummaryFile: stored.latestSummaryFile,
    },
    summary: stored.summary,
  });
}

export async function GET(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) return authError;

  const { latest, files } = await readLatestNmsBundleSummary();
  return json({ success: true, latest, files });
}
