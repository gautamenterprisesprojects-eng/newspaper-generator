# NMS → PageMint PDF: connection, typography and repair runbook

_Last verified: 2026-09-18 (PageMint image `dad59234d84d`, NMS recipe `nms-pagemint-manual-recipe-v3`)._
_Same file lives in both repos: NMS `docs/NMS_PAGEMINT_PDF_RUNBOOK.md` and PageMint `docs/NMS_PAGEMINT_PDF_RUNBOOK.md`. Keep them identical._

This document is written so that a future engineer or AI agent can (a) connect the
NMS bundle API to PageMint again from scratch, (b) understand why NMS PDFs used to
look different from manual-wizard PDFs, (c) change layout or fonts safely, and
(d) diagnose and fix a regression without touching the manual wizard or any other
project on the VPS.

---

## 0. Rules that must never be broken

1. **Only the `cliffdemo3` publisher may get NMS behaviour.** PageMint gates it with
   `ALLOWED_NMS_PAGEMINT_IDS = new Set(["cliffdemo3"])` in
   `src/lib/nms/nmsBundleTypes.ts`. Other publishers' bundles are stored but never rendered.
2. **The manual wizard must never change because of NMS work.** Every NMS-specific
   typography rule is reachable only through `getNmsExportRecipe()`
   (`src/lib/nms/cliffDemo3ManualRecipe.ts`), which returns `null` unless the page URL has
   `?nmsExport=1`. Never call `getActivePageMintRecipe()` from shared engine code.
3. **Never touch `/var/www/cliff-news`, the `cliff-news` nginx vhost, the portal
   containers, or Postgres data.** The VPS hosts several projects; PageMint deploys
   only ever rebuild/recreate the `newspaper_generator` container.
4. **nginx is shared.** Any vhost edit = `nginx -t` first, then graceful `reload`, and
   only the `generator.pagemint1.gautamenterprises.org` vhost.
5. Secrets (JWT secret, API keys, DB password) are only ever used inside server-side
   scripts — never printed, never pasted into chats or docs.

---

## 1. Architecture (what talks to what)

```
NMS backend (news-management-system-backend-1, /srv/news-management-system/current -> releases/<sha>)
   server/services/newspaperGenerator.js   builds the bundle (articles, layout, recipe, callback)
   server/services/cliffDemo3PageMintRecipe.js  the recipe (fonts, palette, byline, ...)
        |  POST ${NEWSPAPER_GENERATOR_URL}   (= https://generator.pagemint1.gautamenterprises.org/api/nms-bundle)
        |  Authorization: Bearer ${NEWSPAPER_GENERATOR_API_KEY}
        v
nginx vhost generator.pagemint1.gautamenterprises.org
   location /api/  -> 127.0.0.1:3002 (UNGATED; this is how the bundle gets in)
   location /     -> auth_request /_launch_check (portal launch token `lt=`; browsers only)
        v
PageMint (newspaper_generator container, /opt/newspaper-generator, Next.js, port 3002->3000)
   src/app/api/nms-bundle/route.ts    validates + stores bundle (data/nms-bundles/), queues PDF job
   src/lib/nms/nmsPdfJob.ts           job runner: renders, stores PDF, POSTs it to the callback
   src/lib/nms/nmsHeadlessPdfRenderer.ts  Playwright Chromium opens
                                      http://127.0.0.1:3000/?nmsExport=1&job=...&publisherId=cliffdemo3...
                                      (inside the container: no nginx, fonts load from /fonts/*.ttf)
   src/components/editor/NmsHeadlessExportBridge.tsx  headless composer: converts articles,
                                      applies recipe (palette/byline/bullets), fills empty boxes
                                      (nmsNewsFill.ts), composes with the SAME store function the
                                      wizard uses (importNewswireStories), burns PDF via
                                      __PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF (300 dpi PNG -> pdf-lib)
        |  POST callback.url (= ${NMS_BASE}/api/webhook/newspaper-pdf, multipart field `pdf`,
        |  header x-webhook-key when NEWSPAPER_GENERATOR_WEBHOOK_KEY is set)
        v
NMS stores the PDF: data/uploads/pdfs/newspaper-<userId>-<JOB>-<ts>.pdf
```

Manual wizard and NMS share **one** composition pipeline:
`importNewswireStories → createArticleDataFromNewswireStory → composeArticleBox →
drawStoryLayoutToCanvas → buildDocumentPdfBytes`. Given identical inputs the two paths
produce pixel-identical PDFs (proven 0.0000 % diff). Differences come only from inputs
(fonts available, recipe, palette, byline, article converter) — never from a separate renderer.

### 1.1 Environment (names only)
| Where | Variable | Meaning |
|---|---|---|
| NMS `backend.env` | `NEWSPAPER_GENERATOR_URL` | PageMint bundle endpoint (`…/api/nms-bundle`) |
| NMS | `NEWSPAPER_GENERATOR_API_KEY` | Bearer token PageMint checks (`NMS_BUNDLE_API_KEY` / `NEWSPAPER_GENERATOR_API_KEY` on the PageMint side) |
| NMS | `NEWSPAPER_GENERATOR_PAGEMINT_USER_ID` | target publisher id, default `cliffdemo3` |
| NMS | `NEWSPAPER_GENERATOR_WEBHOOK_KEY` | if set, PageMint sends it back as `x-webhook-key` |
| PageMint compose | `NMS_BUNDLE_DIR`, `NMS_GENERATED_PDF_DIR` | `/app/data/nms-bundles`, `/app/data/nms-generated-pdfs` |
| PageMint compose | `NMS_USED_BUNDLE_RETENTION_HOURS` (1), `NMS_GENERATED_PDF_RETENTION_HOURS` (30) | cleanup |
| PageMint compose | `PAGEMINT_PORTAL_API_BASE`, `PAGEMINT_PORTAL_JWT_SECRET`, `PAGEMINT_CLIFFDEMO3_PORTAL_PUBLISHER_ID`, `PAGEMINT_CLIFFDEMO3_PORTAL_DEVICE_ID` | server-side fetch of the cliffdemo3 portal profile (masthead city/volume/header) |

The production container's full environment is the source of truth. To rebuild:
`docker inspect newspaper_generator --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=\|^HOSTNAME=' > /tmp/pm.env` (root-only, delete after), then
`docker compose --env-file /tmp/pm.env build generator && docker compose --env-file /tmp/pm.env up -d --no-build generator`.

### 1.2 Bundle shape (fields PageMint actually reads)
`job_id`, `bundle_id`, `pagemint_target_id` / `pagemint_user_id` (= `cliffdemo3`), `layout` /
`frontPageLayout` (template id, e.g. `CliffFrontEditorRail8A`), `targetUser` (reporter; used for
the rail portrait/name), `articles[]` (`newsId`, `headline`, `body`, `subheadings[]`, `subheadline`,
`imageCaption`, `coverImage.url` / `images[].url`, `reporter{nameHi, printDesignation, printPlaceName}`,
`category`), `callback` / `pdfCallback` (`url`, `fileField`, `targetField`, `authHeader`), and
`pageMintRecipe` (top level or `meta.pageMintRecipe`). If the bundle has fewer articles than the
template has boxes, `nmsNewsFill.ts` fills the rest from the newswire API (photo URL order:
`image_url → image_link → media.image_link → ui_hindi.image_url`; the last one 404s upstream).

---

## 2. The recipe — the single place that controls NMS typography

File (NMS): `server/services/cliffDemo3PageMintRecipe.js`. PageMint merges it over its default
`CLIFFDEMO3_MANUAL_RECIPE` (`resolvePageMintRecipeFromPayload`). Values that produce the
golden look (job `JOB-1789496500091-94728FA0`, 15 Sep 2026, "matches the manual wizard"):

| Key | Value | Where PageMint applies it (NMS export only) |
|---|---|---|
| `fonts.headlineByPriority.{lead,major,secondary,brief,filler}` | `Cliff Noto Sans Devanagari` / `700` | `FontManagerEngine.selectNewspaperHeadlineFont` |
| `fonts.body.hindi` | `Cliff Noto Sans Devanagari` (→ weight 400) | `composeArticleBox` body face hook |
| `fonts.primaryOnlyNoStackFallback` | `false` | `FontManagerEngine.getNewspaperFontStack` |
| `typographyFit.stretchDisplayHeadlines` | `true` (fill headline to column width) | `composeArticleBox.fillHeadlineLineEdges` |
| `importOptions.paletteMode` | `classic_fixed` (wizard default palette, every page) | bridge palette branch (`paletteSource: recipe-classic-fixed`) |
| `importOptions.subheadingBandOpacity` | `1` | bridge → `getPaletteSubheadingStyle` |
| `importOptions.bylineSource` | `newspaper_name` (byline = publication name) | bridge byline |
| `subheads.maxSubheadingsPerStory` | `3` | bridge story converter cap |
| `importOptions.professionalJustification` | `true` — **Hindi still uses the browser engine** (see §3) | `editorStore.applyNewswireImportTypography` (HEAD rule) |

Typography is keyed by **story role**, not by template slot. Any front/inside template,
any slot order → same faces, weights, palette, byline. Changing the NMS layout
(`CLIFF_FRONT_RAIL_LAYOUT` / `frontPageLayout`) does not change typography.

Available faces inside PageMint (`public/fonts`, registered in `FontManagerEngine.NEWSPAPER_FONT_DEFINITIONS`):
`Cliff Noto Sans Devanagari` (400/700), `Cliff Noto Serif Devanagari` (400/700),
`Cliff Noto Serif Devanagari ExtraCondensed` (400/550/600), `Rozha One` (400), `Amita` (700),
`Kalam` (700), `Ranga` (700), `Tiro Devanagari Hindi` (400), `Tinos` (400/700, English body).
Only these names are valid in the recipe.

### 2.1 Changing fonts or layout for NMS PDFs — the procedure
1. Edit `server/services/cliffDemo3PageMintRecipe.js` in the NMS repo (and/or `CLIFF_FRONT_RAIL_LAYOUT`).
2. Copy the same file to the VPS release dir (`/srv/news-management-system/releases/<current>/server/services/`),
   `docker restart news-management-system-backend-1`.
3. Run the verifier (§5) against production. Check `exportDebug.fonts.fallbacks == []`.
4. Generate one real job from NMS and open the PDF.
Nothing in PageMint needs to change for a font/layout change.

---

## 3. Why NMS PDFs looked wrong (root causes found 2026-09-17/18) and the fix

| Symptom | Root cause | Fix (deployed 2026-09-18) |
|---|---|---|
| NMS PDF fonts ≠ wizard fonts | nginx `auth_request` (since 2026-09-03) returns **403 for `/fonts/*.ttf` in every browser**, so the wizard always composes with each device's *fallback* font (Adobe Devanagari/Nirmala on Windows, Kohinoor on iOS, Noto on Android). Headless NMS runs inside the container, bypasses nginx, and gets the real fonts. The 15 Sep golden job looked "right" because fonts had not engaged and Noto Sans was painted. | Recipe now asks for `Cliff Noto Sans Devanagari 700` everywhere (deterministic, layout-independent), body Noto Sans 400, width-fill on. |
| Justification / headline weight changed in the **wizard** | NMS sessions (15–17 Sep) edited shared engines: priority font map with lead **Rozha 400**, width-fill disabled for display faces, weight snapping, measure-with-primary-family-only (measure ≠ paint on real devices), Hindi newspaper-justify for cliffdemo3, 20 s mount-time font loop, `font-display: block`. | All shared functions restored to git HEAD (`02c3679`, the 15 Sep wizard). NMS keeps its behaviour behind `getNmsExportRecipe()`. |
| Wrong palette / byline / bullets vs wizard | Bridge rotated palettes at 60 % and used the reporter name. | `classic_fixed` @ 1.0, `bylineSource: newspaper_name`, subhead cap from recipe. |
| Grey fill photos | `nmsNewsFill.ts` preferred `ui_hindi.image_url` (upstream `/media/news-image/<id>` → 404). | Same URL order as the wizard route. |
| No masthead for some publishers (cliffdemo2 …) | Their profile has no header artwork; PageMint's built-in `/front-header-live.svg` + `/inside-header-live.svg` are **403 behind the nginx gate since 2026-09-04**. cliffdemo3 is unaffected (its profile carries a `data:` SVG). | Not a code issue. Either re-upload header artwork in the portal profile, or add two ungated exact-match nginx locations for those SVGs (generator vhost only). |

Photos referenced by bundles are hosted at `https://nms-api.thecliffnews.in/uploads/…`. Some were
observed to disappear within hours (URL then returns an HTML page); PageMint draws a grey box in that
case. Check the NMS upload lifecycle if photos vanish.

### 3.1 Files that carry the NMS gating (PageMint) — read these first when something regresses
| File | NMS-only hook |
|---|---|
| `src/lib/nms/cliffDemo3ManualRecipe.ts` | `isNmsExportSession()`, `getNmsExportRecipe()`, default recipe, payload merge |
| `src/engines/FontManager/FontManagerEngine.ts` | recipe branch at top of `selectNewspaperHeadlineFont`; `getNewspaperFontStack` primary-only; `assertCliffDemo3DisplayFontsEngaged` (fail-closed font proof, cliffdemo3 sessions only) |
| `src/engines/ArticleComposer/composeArticleBox.ts` | body face/weight hook; `fillHeadlineLineEdges` recipe off-switch; weight snapping only when a recipe is active |
| `src/components/editor/NmsHeadlessExportBridge.tsx` | article converter, recipe palette/byline/bullets, portal profile masthead patch, `__NMS_EXPORT_DEBUG` |
| `src/components/editor/EditorCanvas.tsx` | `__PAGEMINT_CLIFFDEMO3_STORE__` (cliffdemo3 sessions), font gate before burn (`nmsExport=1` + cliffdemo3), `__PAGEMINT_EXPORT_CURRENT_DOCUMENT_PDF` |
| `src/store/editorStore.ts` | **no NMS hook** — `bodyJustifyEngineMode` is the HEAD rule (`english && professionalJustification ? newspaper : default(browser)`) |
| `src/lib/nms/nmsNewsFill.ts`, `nmsSequentialEdition.ts`, `nmsPdfJob.ts`, `nmsHeadlessPdfRenderer.ts`, `nmsBundleStorage.ts`, `nmsBundleTypes.ts` | fill, edition planning, job runner, Playwright, storage, allowlist |

---

## 4. Diagnosing a bad NMS PDF (step by step)

1. **Find the job.** `ls -t /opt/newspaper-generator/data/nms-generated-pdfs/*.pdf.json | head` on the VPS.
   The `.pdf.json` beside each PDF contains `exportDebug`:
   `fonts` (`status`, `fallbacks` must be `[]`), `cliffdemo3Palettes[0]` (`paletteId`, `backgroundOpacity`),
   `cliffdemo3PaletteSource` (`recipe-classic-fixed` expected), `editionPlan[0].templateId`, `pageMintRecipe` (as received).
2. **Fonts wrong?** `fallbacks != []` → fonts did not load in headless: check `docker logs newspaper_generator`
   for `cliffdemo3 export blocked` / `font not engaged`, check `/app/public/fonts/*.ttf` exist in the image,
   check the recipe family names against §2. A recipe family that is not registered silently falls back.
3. **Palette/byline wrong?** compare `exportDebug.pageMintRecipe.importOptions` with §2. If the recipe you
   edited is not what arrived, the NMS backend was not restarted or `current` points at another release.
4. **Layout wrong?** `editionPlan[0].templateId` must equal the bundle's `layout`. Unknown ids fall back to
   `NMS_FRONT_TEMPLATE_ID` in `nmsSequentialEdition.ts`.
5. **Wizard changed too?** Run the wizard-untouched check (§5.3). Any diff outside intended hunks = a
   shared-path edit; move it behind `getNmsExportRecipe()`.
6. **Compare with the golden bundle.** `data/nms-bundles/export-JOB-1789496500091-94728FA0.json` (8 Sep-15
   articles) is kept on the VPS; re-post it to a sandbox to reproduce the golden look.

---

## 5. Verifier — `scripts/verify-nms-typography.sh` (PageMint repo, runs on the VPS)

```
bash scripts/verify-nms-typography.sh <base-url> <bundle.json> [templateId ...]
# examples
bash scripts/verify-nms-typography.sh http://127.0.0.1:3003 data/nms-bundles/export-JOB-1789496500091-94728FA0.json   # sandbox
bash scripts/verify-nms-typography.sh http://127.0.0.1:3002 /tmp/golden.json CliffFront8A CliffFrontEditorRail8A       # production
```
What it does: (1) static guards — allowlist is exactly `cliffdemo3`, no `getActivePageMintRecipe()` on
shared paths, wizard typography functions byte-identical to git HEAD (`selectNewspaperHeadlineFont`,
`headlineDisplayFonts`, `fillHeadlineLineEdges`, `createCanvasFontString`, the `bodyJustifyEngineMode`
rule) apart from the documented `getNmsExportRecipe()` gate lines; (2) posts the bundle once per template
with the current recipe values injected, waits for the PDF, asserts `fonts.fallbacks == []`, palette
`classic` @ `1`, `paletteSource == recipe-classic-fixed`, template id, page count ≥ 1, PDF is a flat
image (0 embedded fonts); (3) writes a contact sheet `verify-out/<ts>/sheet.png` and, when a golden PNG
for that template exists in `scripts/nms-verify/golden/`, prints the pixel-diff percentage (≤ 0.5 % passes).
Exit code 0 = all green.

### 5.1 Wizard-untouched check
`scripts/nms-verify/wizard-path-parity.mjs` runs **inside** a PageMint container:
`docker exec <container> node /tmp/wizard-path-parity.mjs <label> <bundle.json> <templateId>` (copy the
script and a bundle into the container first). It launches the app like a cliffdemo3 dashboard launch,
calls the wizard's own `importNewswireStories` with wizard-default options and a fixed story set, exports the
PDF. Run it on production and on the candidate and pixel-diff the two PNGs: 0.0000 % expected unless the
wizard was intentionally changed.

### 5.2 Real-publisher wizard check
`scripts/nms-verify/real-wizard-run.mjs` drives the real wizard UI as a publisher (`public` mode = through
nginx with fonts 403 exactly like browsers; `internal` mode = inside the container). Env: `PROBE_PUB_ID`,
`PROBE_DEVICE_ID`, `PROBE_USERNAME` (defaults cliffdemo3), `PROBE_BLOCK_FONTS=1` to simulate the 403 on the
internal path. Portal write endpoints are intercepted — read-only.

### 5.3 Sandbox procedure (always test here first)
```
rsync -a --delete --exclude=/node_modules --exclude=/.next --exclude=/data --exclude=/backups --exclude=/.git /opt/newspaper-generator/ /tmp/pagemint-sandbox/
# patch /tmp/pagemint-sandbox, then:
docker build -t pagemint-sandbox:vN /tmp/pagemint-sandbox
docker run -d --name pagemint_sandbox --env-file /tmp/pm.env -p 127.0.0.1:3003:3000 \
  -v /tmp/pagemint-sandbox-data/nms-bundles:/app/data/nms-bundles -v /tmp/pagemint-sandbox-data/nms-generated-pdfs:/app/data/nms-generated-pdfs \
  --network newspaper-generator_default pagemint-sandbox:vN
docker network connect newspaper-portal_portal-tier pagemint_sandbox
```
Post bundles to `http://127.0.0.1:3003/api/nms-bundle` with `callback.url` / `pdfCallback.url` blanked so
NMS never receives test PDFs. Compare renders with `pdftoppm -r 100` + PIL.

---

## 6. Deploy and rollback (PageMint)

Deploy = copy verified files into `/opt/newspaper-generator/src`, back up the previous versions to
`backups/<name>-<ts>/`, tag the running image (`docker tag <id> newspaper-generator-generator:rollback-<ts>`),
build + recreate **only** `generator` (§1.1 commands). Verify: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/`,
one verification bundle (callbacks blanked), wizard probes (§5.1/5.2). Other containers must be unchanged
(`docker ps --format '{{.Names}}'` before/after).

Rollback: `docker tag newspaper-generator-generator:rollback-<ts> newspaper-generator-generator:latest &&
docker compose --env-file /tmp/pm.env up -d --no-build generator`, then restore the source files from the
backup directory so the tree matches the running image.

History of tags/backups for the 2026-09-18 deploy: image `0da7e487005a` → `rollback-pre-v5-20260918-022626`;
files in `backups/cliffdemo3-v5-wizard-head-restore-20260918-022626/`; NMS recipe backup
`/srv/news-management-system/backups/recipe-v3-20260918-022626/`.

---

## 7. Known facts worth remembering

- Portal never stores generated PDF files, only a synthetic `pdf_url`; manual PDFs exist only on the device that made them.
- `document.fonts.check()`/`FontFace` failures in browsers are expected (403); the wizard is *designed* to run on fallback fonts since 2026-09-03. Do not "fix" fonts for browsers without the owner's explicit decision — it changes the look on 200+ devices.
- The bridge waits for fonts itself (`awaitNewspaperFontsBeforeComposing`, font gate in `EditorCanvas`); the wizard's mount-time wait is the HEAD `waitForNewspaperFonts()` and must stay that way.
- `FontDiagnosticsPanel` is shown when fonts are not `loaded` — HEAD behaviour, restored.
- PageMint PDFs are single flat 300 dpi images (0 fonts, 0 text) — `pdffonts` always lists nothing.
