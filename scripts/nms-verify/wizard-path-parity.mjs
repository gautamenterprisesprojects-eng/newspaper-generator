/**
 * WIZARD-PATH PARITY PROBE (read-only, nothing deployed).
 * Runs inside a PageMint container against its own http://127.0.0.1:3000 (fonts load, no nginx).
 * Loads the app exactly like a cliffdemo3 dashboard launch (signed session + launch token), waits for the
 * publisher profile + header artwork, then calls the SAME importNewswireStories() the GenerationWizardModal
 * calls, with the wizard's DEFAULT options (classic @100%, tinted, inline subheads, professional justification,
 * byline = newspaper name) and a FIXED story set, then burns the PDF with the manual export function.
 * Usage: node wizard-path-parity.mjs <label> <bundle.json> <templateId>
 */
import { chromium } from "/app/node_modules/playwright/index.mjs";
import { createHmac } from "crypto";
import fs from "fs";
const [LABEL = "run", BUNDLE = "/tmp/wiz-bundle.json", TEMPLATE = "CliffFrontEditorRail8A"] = process.argv.slice(2);
const OUT = "/tmp/wiz-parity"; fs.mkdirSync(OUT, { recursive: true });
const PUB_ID = process.env.PAGEMINT_CLIFFDEMO3_PORTAL_PUBLISHER_ID || "91e4a212-5920-4cf5-b5a3-4aa39bdfca5b";
const DEVICE_ID = process.env.PAGEMINT_CLIFFDEMO3_PORTAL_DEVICE_ID || "e0c54c5a-c2ae-4cd0-9194-8ad451b46c12";
const SECRET = process.env.PAGEMINT_PORTAL_JWT_SECRET; if (!SECRET) throw new Error("no secret in env");
const PORTAL_API = "https://pagemint1.gautamenterprises.org/api/v1";
const ORIGIN = "http://127.0.0.1:3000";
const b64u = (s) => Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const now = Math.floor(Date.now() / 1000);
const hd = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const bd = b64u(JSON.stringify({ sub: PUB_ID, username: "cliffdemo3", role: "PUBLISHER", exp: now + 3600, did: DEVICE_ID }));
const jwt = `${hd}.${bd}.${createHmac("sha256", SECRET).update(`${hd}.${bd}`).digest("base64url")}`;
const lt = `${PUB_ID}.${now + 3600}.${createHmac("sha256", SECRET).update(`${PUB_ID}.${now + 3600}`).digest("hex")}`;
const profile = await (await fetch(`${PORTAL_API}/publisher/profile/${PUB_ID}`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
const pageSections = typeof profile.page_section_config === "string" ? JSON.parse(profile.page_section_config) : (profile.page_section_config || []);
const bundle = JSON.parse(fs.readFileSync(BUNDLE, "utf8"));
const articles = (bundle.articles || []).slice(0, 8);
const url = `${ORIGIN}/?` + new URLSearchParams({
  publisherId: PUB_ID, newspaperName: profile.newspaper_name, pageCount: "8", mode: "single",
  issueNumber: "Ank 2026-09-17", publicationDate: "2026-09-17",
  returnUrl: "https://pagemint1.gautamenterprises.org/dashboard?generated=1",
  apiBase: PORTAL_API, authToken: jwt, pageSections: JSON.stringify(pageSections), editionIndex: "0",
  selectedPageNumber: "1", selectedPageName: pageSections[0]?.section || "Page 1", pageKind: "front", lt,
}).toString();
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium-browser", args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium", "--disable-dev-shm-usage"] });
const page = await browser.newPage(); await page.setViewportSize({ width: 1400, height: 1800 }); page.setDefaultTimeout(240000);
const fontStatus = {};
page.on("response", (r) => { if (/\/fonts\//.test(r.url())) { const k = r.url().split("/fonts/")[1]; fontStatus[k] = fontStatus[k] || r.status(); } });
const okJson = (body) => ({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body });
// read-only: portal writes intercepted; profile served locally (CORS from 127.0.0.1 origin)
await page.route(/\/publisher\/(issue-used-articles|generator\/execute)/, (route) => route.fulfill(okJson(route.request().method() === "GET" ? JSON.stringify({ article_ids: [] }) : "{}")));
await page.route("**/publisher/profile/**", (route) => route.fulfill(okJson(JSON.stringify(profile))));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__PAGEMINT_CLIFFDEMO3_STORE__ && window.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF && window.__PAGEMINT_CLIFFDEMO3_DETERMINISTIC_PALETTE__), null, { timeout: 180000 });
await page.waitForTimeout(8000); // profile + header artwork applied by PortalLaunchBootstrap
const res = await page.evaluate(async ({ articles, TEMPLATE }) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const storeApi = window.__PAGEMINT_CLIFFDEMO3_STORE__; const det = window.__PAGEMINT_CLIFFDEMO3_DETERMINISTIC_PALETTE__;
  const tv = (v) => (typeof v === "string" ? v.trim() : "");
  const words = (t) => t.trim().split(/\s+/u).filter(Boolean);
  const lim = (t, n) => { const p = words(t); return p.length > n ? p.slice(0, n).join(" ") : t; };
  const img = (a) => { const c = a.coverImage; const im = Array.isArray(a.images) ? a.images : []; const s = im.find((i) => i && i.isCover) || im.find((i) => tv(i && i.url)); return tv(c && typeof c === "object" ? c.url : "") || tv(s && s.url) || tv(a.imageUrl) || tv(a.image_url) || ""; };
  const stories = articles.map((a, i) => {
    const headline = tv(a.headline) || `Story ${i + 1}`; const body = tv(a.body) || tv(a.originalBody) || "";
    const s = Array.isArray(a.subheadings) ? a.subheadings.map(tv).filter(Boolean).slice(0, 3) : [];
    const cap = tv(a.imageCaption) || tv(a.caption) || "";
    return { id: String(a.newsId || `s-${i + 1}`), language: "hindi", category: tv(a.category) || "National", headline, subheadline: tv(a.subheadline) || s[0] || "", body, shortBody: lim(body, 220), mediumBody: lim(body, 420), longBody: body, summary: s, caption: cap, imageUrl: img(a), imageCaption: cap, place: tv(a.reporter && a.reporter.printPlaceName) || tv(a.place), sourceTitle: "Probe", sourceUrl: "", publishedAt: null, photoCredit: "" };
  });
  const classic = { id: "classic", label: "Classic Daily", description: "", backgroundColor: "#111111", textColor: "#ffffff", borderColor: "#111111", palette: { primary: "#111111", alert: "#b42318", secondary: "#1f5f86", highlight: "#0f766e", neutral: "#d7d2c8" } };
  const st = storeApi.getState();
  // == the wizard's default options (createInitialWizardState) ==
  const opts = { templateId: TEMPLATE, pageKind: "front", languageMode: "hindi", bylineName: st.document.metadata.newspaperName || "", colouredHeadings: false, tintedStoryBackground: true, tintColor: det.getPaletteTintColor(classic), inlineColumnSubheadings: true, inlineSubheadingColor: det.getPaletteInlineAccent(classic), palettePreset: classic, subheadingStyle: det.getPaletteSubheadingStyle(classic, 1), bodyAlignment: "justify", professionalJustification: true };
  st.setActivePage(st.document.pages[0].id); st.importNewswireStories("Probe", stories, opts);
  await wait(6000); await document.fonts.ready; await wait(2000);
  const s2 = storeApi.getState();
  const engines = s2.stories.map((x) => x.articleData && x.articleData.typography && x.articleData.typography.bodyJustifyEngineMode);
  const faces = {}; document.fonts.forEach((f) => { faces[f.status] = (faces[f.status] || 0) + 1; });
  const bytes = await window.__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF();
  const md = s2.document.metadata || {};
  return { engines, faces, byline: opts.bylineName, stories: s2.stories.length, header: { city: md.city, volume: md.volumeNumber, name: md.newspaperName }, pdf: Array.from(new Uint8Array(bytes)) };
}, { articles, TEMPLATE });
fs.writeFileSync(`${OUT}/wiz-${LABEL}.pdf`, Buffer.from(res.pdf));
const fontSummary = Object.values(fontStatus).reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
console.log(JSON.stringify({ label: LABEL, template: TEMPLATE, pdfBytes: res.pdf.length, fonts: fontSummary, faces: res.faces, bodyEngines: [...new Set(res.engines)], stories: res.stories, byline: res.byline, header: res.header }));
await browser.close();
