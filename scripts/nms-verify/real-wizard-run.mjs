/**
 * Drives the REAL PageMint wizard as the cliffdemo3 publisher would from the dashboard.
 * Auth = the same signed session token + launch token the dashboard uses (minted with the
 * shared secret PageMint's own server already uses for cliffdemo3). No password needed.
 * Read-only w.r.t. the portal: the two write endpoints the editor can hit are intercepted.
 *   node real-wizard-run.mjs public    -> https://generator.pagemint1.gautamenterprises.org (publisher path; fonts 403)
 *   node real-wizard-run.mjs internal  -> http://127.0.0.1:3000 (same flow, PageMint fonts load)
 */
import { chromium } from "/app/node_modules/playwright/index.mjs";
import { createHmac } from "crypto";
import fs from "fs";

const MODE = process.argv[2] === "internal" ? "internal" : "public"; const LAYOUT_LABEL = process.argv[3] || "एडिटर रेल फ्रंट पेज"; const TAG = process.argv[4] || MODE;
const OUT = "/tmp/wizard-run"; fs.mkdirSync(OUT, { recursive: true });
const PUB_ID = process.env.PROBE_PUB_ID || process.env.PAGEMINT_CLIFFDEMO3_PORTAL_PUBLISHER_ID || "91e4a212-5920-4cf5-b5a3-4aa39bdfca5b"; const USERNAME = process.env.PROBE_USERNAME || "cliffdemo3";
const DEVICE_ID = process.env.PROBE_DEVICE_ID || process.env.PAGEMINT_CLIFFDEMO3_PORTAL_DEVICE_ID || "e0c54c5a-c2ae-4cd0-9194-8ad451b46c12";
const SECRET = process.env.PAGEMINT_PORTAL_JWT_SECRET; if (!SECRET) throw new Error("no secret");
const PORTAL_API = "https://pagemint1.gautamenterprises.org/api/v1";
const ORIGIN = MODE === "public" ? "https://generator.pagemint1.gautamenterprises.org" : "http://127.0.0.1:3000";

// --- session token (same claims as PageMint's mintCliffDemo3PortalToken / portal SaaSAuthLogin) ---
const b64u = (s) => Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const now = Math.floor(Date.now() / 1000);
const jwtHead = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const jwtBody = b64u(JSON.stringify({ sub: PUB_ID, username: USERNAME, role: "PUBLISHER", exp: now + 3600, did: DEVICE_ID }));
const jwt = `${jwtHead}.${jwtBody}.${createHmac("sha256", SECRET).update(`${jwtHead}.${jwtBody}`).digest("base64url")}`;
// --- launch token (portal signGeneratorToken) ---
const lt = `${PUB_ID}.${now + 3600}.${createHmac("sha256", SECRET).update(`${PUB_ID}.${now + 3600}`).digest("hex")}`;

// --- real publisher profile from the real portal API (what the dashboard has in state) ---
const profRes = await fetch(`${PORTAL_API}/publisher/profile/${PUB_ID}`, { headers: { Authorization: `Bearer ${jwt}` } });
if (!profRes.ok) throw new Error(`profile fetch ${profRes.status}`);
const profile = await profRes.json();
const pageSections = typeof profile.page_section_config === "string" ? JSON.parse(profile.page_section_config) : (profile.page_section_config || []);
const newspaperName = profile.newspaper_name || "द क्लिफ़ न्यूज़";
const pageCount = Number(profile.default_page_count) || 8;
console.log(`[${MODE}] profile ok: newspaper=${newspaperName} pages=${pageCount} sections=${pageSections.length} city=${profile.city} volume=${profile.last_volume_number}`);

// --- exactly buildGeneratorParams(mode="single", pageNumber=1) from the dashboard, WITHOUT chargeOnExport ---
const params = new URLSearchParams({
  publisherId: PUB_ID, newspaperName, pageCount: String(pageCount), mode: "single",
  issueNumber: "Ank 2026-09-17", publicationDate: "2026-09-17",
  returnUrl: "https://pagemint1.gautamenterprises.org/dashboard?generated=1",
  apiBase: PORTAL_API, authToken: jwt, pageSections: JSON.stringify(pageSections), editionIndex: "0",
  selectedPageNumber: "1", selectedPageName: pageSections[0]?.section || "Page 1", pageKind: "front", autoOpenLayoutWizard: "true", lt,
});
const url = `${ORIGIN}/?${params.toString()}`;

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium-browser", args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium", "--disable-dev-shm-usage", "--js-flags=--max-old-space-size=4096"] });
const page = await browser.newPage(); await page.setViewportSize({ width: 1400, height: 1800 }); page.setDefaultTimeout(240000);
const fontStatus = {}; const blocked = [];
page.on("response", (r) => { if (/\/fonts\//.test(r.url())) { const k = r.url().split("/fonts/")[1]; fontStatus[k] = fontStatus[k] || r.status(); } });
page.on("pageerror", (e) => { if (!/ResizeObserver/.test(e.message)) console.log(`[${MODE} pageerror]`, e.message.slice(0, 200)); });
// Portal WRITE endpoints -> intercepted (read-only run). GET profile / exclusions go to the real portal.
await page.route(/\/publisher\/(issue-used-articles|generator\/execute)/, async (route) => {
  if (route.request().method() === "GET") return route.continue();
  blocked.push(`${route.request().method()} ${route.request().url().split("/api/v1")[1]}`);
  await route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: "{}" });
});
if (MODE === "internal") {
  // From origin 127.0.0.1:3000 the portal API's CORS would refuse; serve the same REAL profile JSON locally.
  await page.route("**/publisher/profile/**", (route) => route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify(profile) }));
  await page.route("**/publisher/issue-used-articles/**", (route) => route.request().method() === "GET" ? route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ article_ids: [], headlines: [] }) }) : route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: "{}" }));
}

const t0 = Date.now();
if (process.env.PROBE_BLOCK_FONTS === "1") {
  // Browser simulation: every /fonts/* request answers 403 like the public nginx vhost does.
  await page.route((u) => u.pathname.startsWith("/fonts/"), (route) => route.fulfill({ status: 403, body: "blocked" }));
  console.log(`[${MODE}] fonts forced to 403 (browser simulation)`);
}
const nav = await page.goto(url, { waitUntil: "domcontentloaded" });
console.log(`[${MODE}] document ${nav?.status()}`);
await page.waitForSelector(".generation-wizard-panel", { timeout: 180000 });
console.log(`[${MODE}] wizard opened (auto) at +${Date.now() - t0}ms`);

// STEP 1 — layout: pick "एडिटर रेल फ्रंट पेज (8 बॉक्स)" (CliffFrontEditorRail8A) via its own "चुनें →" button
const card = page.locator(".generation-wizard-panel .layout-preview-meta strong", { hasText: LAYOUT_LABEL }).first();
await card.waitFor({ timeout: 60000 });
const selectBtn = card.locator("xpath=ancestor::*[contains(@class,'layout-preview-button')][1]//button[contains(@class,'layout-preview-select-btn')]").first();
await selectBtn.click();
console.log(`[${MODE}] layout chosen`);
// STEP 2 — style: keep defaults, continue
await page.locator('[data-tour="editor-style-next"]').click({ timeout: 60000 });
console.log(`[${MODE}] style step passed (defaults)`);
// STEP 3 — category: the primary "पन्ना बनाएं" (live) button
const liveBtn = page.locator(".generation-wizard-panel .generation-wizard-actions button.primary, .generation-wizard-panel button.primary").filter({ hasNotText: "लेआउट बदलें" }).last();
await liveBtn.waitFor({ timeout: 60000 });
const liveLabel = (await liveBtn.textContent())?.trim();
await liveBtn.click();
console.log(`[${MODE}] clicked "${liveLabel}"`);
await page.waitForFunction(() => !document.querySelector(".generation-wizard-panel") && Boolean(window.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF), null, { timeout: 200000 }); await page.waitForTimeout(12000);
console.log(`[${MODE}] page generated: stories imported, wizard closed at +${Date.now() - t0}ms`);
await page.waitForTimeout(4000);

const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const s = window.__PAGEMINT_CLIFFDEMO3_STORE__ ? window.__PAGEMINT_CLIFFDEMO3_STORE__.getState() : { document: { metadata: {}, settings: {} }, stories: [] };
  const faces = {}; document.fonts.forEach((f) => { faces[f.status] = (faces[f.status] || 0) + 1; });
  const c = document.createElement("canvas").getContext("2d"); const probe = "जबलपुर में अवैध शराब"; const w = (f) => { c.font = f; return Math.round(c.measureText(probe).width * 10) / 10; };
  return {
    newspaperName: s.document.metadata.newspaperName, bylineSetting: s.document.settings?.bylineName,
    stories: s.stories.map((x) => ({ id: x.id, priority: x.priority ?? x.articleData?.priority, headline: JSON.stringify(x.articleData?.headline ?? "").slice(1, 40), author: x.articleData?.author, bullets: (x.articleData?.summaryBullets || []).length, inlineColor: x.articleData?.inlineSubheadingColor, hl: x.articleData?.headlineColor ?? null })),
    faces, check: { rozha: document.fonts.check('400 16px "Rozha One"'), amita: document.fonts.check('700 16px "Amita"'), xc550: document.fonts.check('550 16px "Cliff Noto Serif Devanagari ExtraCondensed"') },
    widths: { rozha: w('400 40px "Rozha One"'), bogus: w('400 40px "Definitely Not A Font"'), xc550: w('550 40px "Cliff Noto Serif Devanagari ExtraCondensed"'), sysNotoSans: w('400 40px "Noto Sans Devanagari"') },
  };
});
await page.screenshot({ path: `${OUT}/canvas-${TAG}.png`, fullPage: false });
const hdr = await page.evaluate(() => { const s = window.__PAGEMINT_CLIFFDEMO3_STORE__?.getState(); const pg = s?.document?.pages?.[0]; return { pageKind: pg?.pageType, headerHeight: pg?.header?.height ?? pg?.masthead?.height ?? null, headerKeys: pg ? Object.keys(pg).filter((k) => /head|mast/i.test(k)) : [], docKeys: s ? Object.keys(s.document).filter((k) => /head|mast/i.test(k)) : [], settingsHeader: s?.document?.settings ? Object.keys(s.document.settings).filter((k) => /head|mast/i.test(k)).map((k) => [k, JSON.stringify(s.document.settings[k]).slice(0, 120)]) : [] }; });
console.log(`[${MODE}] header state:`, JSON.stringify(hdr));
const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF())));
fs.writeFileSync(`${OUT}/real-wizard-${TAG}.pdf`, Buffer.from(bytes));
fs.writeFileSync(`${OUT}/real-wizard-${TAG}.json`, JSON.stringify({ mode: MODE, url: url.replace(/authToken=[^&]+/, "authToken=<jwt>").replace(/lt=[^&]+/, "lt=<lt>"), fontStatus, blockedPortalWrites: blocked, ...info }, null, 2));
console.log(`[${MODE}] PDF ${bytes.length} bytes | fonts: ${JSON.stringify(Object.values(fontStatus).reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {}))} | faces ${JSON.stringify(info.faces)} | check ${JSON.stringify(info.check)} | widths ${JSON.stringify(info.widths)}`);
console.log(`[${MODE}] blocked portal writes: ${JSON.stringify(blocked)}`);
console.log(`[${MODE}] byline setting: ${info.bylineSetting} | stories:`, info.stories.map((x) => `${x.priority}:${x.author}:bullets=${x.bullets}`).join(" | "));
await browser.close();
