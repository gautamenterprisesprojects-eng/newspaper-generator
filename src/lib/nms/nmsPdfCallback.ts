import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NmsBundlePayload } from "./nmsBundleTypes";
import { getNmsCallback, getNumericTargetUserId, textValue } from "./nmsBundleTypes";

export const postNmsPdfCallback = async (payload: NmsBundlePayload, pdfPath: string) => {
  const callback = getNmsCallback(payload);
  const callbackUrl = textValue(callback?.url);
  if (!callbackUrl) throw new Error("NMS callback URL missing.");

  const targetUserId = getNumericTargetUserId(payload);
  if (!targetUserId) throw new Error("Numeric NMS target_user_id missing.");

  const pdfBytes = await readFile(pdfPath);
  const form = new FormData();
  form.set("target_user_id", String(targetUserId));
  if (payload.job_id) form.set("job_id", String(payload.job_id));
  if (payload.bundle_id) form.set("bundle_id", String(payload.bundle_id));
  if (payload.edition_id) form.set("edition_id", String(payload.edition_id));
  form.set("status", "generated");
  form.set("pdf", new Blob([pdfBytes], { type: "application/pdf" }), path.basename(pdfPath));

  const headers: Record<string, string> = {};
  const authHeader = textValue(callback?.authHeader);
  const webhookKey = process.env.NMS_WEBHOOK_KEY || process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY || "";
  if (authHeader && webhookKey) headers[authHeader] = webhookKey;

  const response = await fetch(callbackUrl, { method: "POST", headers, body: form });
  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`NMS PDF callback failed with ${response.status}: ${responseText.slice(0, 300)}`);
  }

  return responseText ? JSON.parse(responseText) as unknown : null;
};
