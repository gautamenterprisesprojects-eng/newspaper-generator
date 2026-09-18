/**
 * cliffdemo3 only — fetch the authenticated newspaper-portal publication
 * profile fields that PortalLaunchBootstrap applies on manual wizard launch
 * (city / volume / established year / price). Used by the NMS headless
 * export path so masthead metadata matches the portal session.
 *
 * Other PageMint IDs never call this module.
 */
import { createHmac } from "node:crypto";
import { CLIFFDEMO3_PAGEMINT_ID, isCliffDemo3PublisherIdentity } from "./cliffDemo3Publisher";

export type CliffDemo3PortalPublicationProfile = {
  city?: string;
  cover_price?: string | number;
  publication_start_year?: number | string | null;
  last_volume_number?: number | string | null;
  front_page_header_url?: string;
  remaining_page_header_url?: string;
  newspaper_name?: string;
};

export type CliffDemo3PublicationProfilePatch = {
  city?: string;
  price?: string;
  establishedText?: string;
  volumeLabel?: string;
};

const DEFAULT_PORTAL_API_BASE = "http://newspaper_api_server:8080/api/v1";

const b64url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

/**
 * Mint a short-lived portal JWT the same way newspaper-portal SaaSAuthLogin
 * does (HS256, sub=publisher UUID). Only used for cliffdemo3 server-side
 * profile fetch — never exposed to other publishers.
 */
const mintCliffDemo3PortalToken = (): string | null => {
  const secret = process.env.PAGEMINT_PORTAL_JWT_SECRET?.trim() || process.env.PORTAL_JWT_SECRET?.trim();
  if (!secret) return null;
  const publisherId =
    process.env.PAGEMINT_CLIFFDEMO3_PORTAL_PUBLISHER_ID?.trim() ||
    "91e4a212-5920-4cf5-b5a3-4aa39bdfca5b";
  const deviceId =
    process.env.PAGEMINT_CLIFFDEMO3_PORTAL_DEVICE_ID?.trim() ||
    "e0c54c5a-c2ae-4cd0-9194-8ad451b46c12";
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: publisherId,
      username: CLIFFDEMO3_PAGEMINT_ID,
      role: "PUBLISHER",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      did: deviceId,
    }),
  );
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
};

export const buildPublicationProfilePatchFromPortal = (
  profile: CliffDemo3PortalPublicationProfile | null | undefined,
): CliffDemo3PublicationProfilePatch => {
  if (!profile || typeof profile !== "object") return {};
  const patch: CliffDemo3PublicationProfilePatch = {};
  if (profile.city) patch.city = String(profile.city).trim();
  if (profile.cover_price != null && String(profile.cover_price).trim()) {
    patch.price = String(profile.cover_price).trim();
  }
  const startYear = Number(profile.publication_start_year);
  if (Number.isFinite(startYear) && startYear > 0) {
    patch.establishedText = `Year-${new Date().getFullYear() - startYear + 1}`;
  }
  const volumeNumber = Number(profile.last_volume_number);
  if (Number.isFinite(volumeNumber) && volumeNumber > 0) {
    patch.volumeLabel = String(volumeNumber);
  }
  return patch;
};

export const fetchCliffDemo3PortalPublicationProfile = async (
  pagemintTargetId: string,
): Promise<CliffDemo3PortalPublicationProfile | null> => {
  if (!isCliffDemo3PublisherIdentity(pagemintTargetId)) return null;

  const apiBase = (
    process.env.PAGEMINT_PORTAL_API_BASE?.trim() ||
    process.env.PORTAL_API_BASE?.trim() ||
    DEFAULT_PORTAL_API_BASE
  ).replace(/\/+$/, "");
  const publisherId =
    process.env.PAGEMINT_CLIFFDEMO3_PORTAL_PUBLISHER_ID?.trim() ||
    "91e4a212-5920-4cf5-b5a3-4aa39bdfca5b";
  const token =
    process.env.PAGEMINT_CLIFFDEMO3_PORTAL_AUTH_TOKEN?.trim() || mintCliffDemo3PortalToken();
  if (!token) {
    console.warn("[cliffdemo3 portal profile] no PAGEMINT_PORTAL_JWT_SECRET / auth token; skipping masthead profile fetch");
    return null;
  }

  const response = await fetch(`${apiBase}/publisher/profile/${publisherId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    console.warn("[cliffdemo3 portal profile] fetch failed", response.status);
    return null;
  }
  const profile = (await response.json()) as CliffDemo3PortalPublicationProfile;
  return profile;
};
