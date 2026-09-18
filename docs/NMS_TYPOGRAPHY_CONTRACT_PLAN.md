# NMS Typography Contract — plan to continue (written 2026-09-18, not started)

_Audience: the owner and the AI agent who picks this up next. Nothing in this plan has been
implemented or deployed. Production is at the verified state described in
`docs/NMS_PAGEMINT_PDF_RUNBOOK.md` §6 and the checkpoint below._

## 0. Where things stand right now
- PageMint production image `dad59234d84d` (v5), NMS recipe `nms-pagemint-manual-recipe-v3`. All verifier checks green.
- **Checkpoint to revert to:** `/opt/newspaper-generator-backups/checkpoint-v5-verified-20260918-030328/`
  (source tarball, saved image `pagemint-image-dad59234d84d.tar.gz`, image tag
  `newspaper-generator-generator:checkpoint-v5-20260918-030328`, NMS recipe, nginx vhost copy, `README.txt` with restore commands).
- Open decisions not part of this plan: header for artwork-less publishers (nginx 2a / re-upload 2b); portal admin checkbox "manual + NMS API".

## 1. Goal
Make it impossible for an NMS API PDF to ship with a font/typography mismatch — for any layout, any
future recipe edit, any partial/missing recipe — by **failing closed** with a precise error instead of
silently falling back. Wizard behaviour must not change (0.0000 % pixel diff on the wizard-path probe).

## 2. Chosen approach: Option A — no shared-file changes
Everything lives on the NMS-only path. The wizard executes no new code.

Files to create/modify (PageMint, `/opt/newspaper-generator` on the server; mirror into the git repo afterwards):

| File | Change |
|---|---|
| `src/lib/nms/nmsTypographyContract.ts` (**new**) | `validateRecipeFaces(recipe)`, `proveRecipeFacesEngaged(recipe)`, `auditExpectedTypography(recipe, stories)`, `buildContractReport()` |
| `src/components/editor/NmsHeadlessExportBridge.tsx` | call validate → (after `awaitNewspaperFontsBeforeComposing`) prove → compose → audit → put report in `__NMS_EXPORT_DEBUG.typographyContract`; throw on any failure (job fails, no PDF) |
| `src/lib/nms/cliffDemo3ManualRecipe.ts` | `CLIFFDEMO3_MANUAL_RECIPE` default values = golden set (Noto Sans 700 all roles, body Noto Sans, stretch true, `classic_fixed` @ 1, `bylineSource: newspaper_name`, `primaryOnlyNoStackFallback: false`) so a missing/partial recipe can never bring back Rozha/Amita |
| `scripts/verify-nms-typography.sh` | assert `exportDebug.typographyContract.ok === true` and per-story faces; add `--all-templates` that sweeps every front template id from `TemplateRegistry.ts` |
| `docs/NMS_PAGEMINT_PDF_RUNBOOK.md` | new section "Typography contract" (what errors mean, how to fix) |

### 2.1 Contract logic (spec)
1. **validateRecipeFaces** — every `fonts.headlineByPriority[*].family/weight`, `fonts.body.hindi`, `fonts.subhead/byline/caption`
   must match a registered face in `NEWSPAPER_FONT_DEFINITIONS` (family + weight). Unknown → throw
   `NMS typography contract: "<family> <weight>" is not a registered PageMint face. Valid: <list>`.
2. **proveRecipeFacesEngaged** — for each distinct recipe face: `document.fonts.check("<w> 48px \"<family>\"", "जम्मू मानसून")`
   must be true and `measureText` width must differ (> 0.75 px) from a bogus family at the same size (proves it is not the
   system fallback). Throw on failure. (Same technique as `assertCliffDemo3DisplayFontsEngaged`, but recipe-driven.)
3. **auditExpectedTypography** — after `importNewswireStories`, for every story in `useEditorStore.getState().stories`:
   - `expected = recipe.fonts.headlineByPriority[story.priority]`; `actual = selectNewspaperHeadlineFont({priority, text: headline, columnSpan, contentLanguage, slotKey})`
     (the exact function the composer calls); must be equal (family + weight). English stories → Tinos/serif rule allowed.
   - body engine: `story.articleData.typography.bodyJustifyEngineMode` must be `"browser"` for Hindi.
   - stretch flag: `recipe.typographyFit.stretchDisplayHeadlines` recorded in the report.
   - Report: `{ ok, recipeVersion, faces: [...], stories: [{id, priority, expected, actual, bodyEngine}], violations: [...] }`.
   Any violation → throw with the story id and the two faces named.
4. **Debug/verifier** — report attached to `__NMS_EXPORT_DEBUG.typographyContract`; also written into the `.pdf.json` beside the PDF.

Residual gap (accepted for Option A): a future template-specific font override written *inside* `composeArticleBox`
that bypasses `selectNewspaperHeadlineFont` would not be seen by the audit. The verifier's static grep guards
(`getActivePageMintRecipe()` on shared paths; HEAD-identical function bodies) are the safety net for that.

Option B (stronger, touches 2 shared files with `if (getNmsExportRecipe())` ledger hooks) is documented in the
2026-09-18 chat; only consider it if A proves insufficient.

## 3. Procedure (copy of what worked today)
1. `rsync -a --delete --exclude=/node_modules --exclude=/.next --exclude=/data --exclude=/backups --exclude=/.git --exclude=/verify-out /opt/newspaper-generator/ /tmp/pagemint-sandbox/`
2. Implement the changes in `/tmp/pagemint-sandbox` (write a `apply_v6.py` like `/tmp/apply_v4.py` / `/tmp/apply_v5.py` so the exact patch is reproducible on the production tree).
3. Build: `docker build -t pagemint-sandbox:v6 /tmp/pagemint-sandbox` (~7 min).
4. Env file for the sandbox: reproduce the production container env (root-only, delete after):
   `docker inspect newspaper_generator --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=\|^HOSTNAME=' > /tmp/pm.env; chmod 600 /tmp/pm.env`
5. Run: `docker run -d --name pagemint_sandbox --env-file /tmp/pm.env -p 127.0.0.1:3003:3000 -v /tmp/pagemint-sandbox-data/nms-bundles:/app/data/nms-bundles -v /tmp/pagemint-sandbox-data/nms-generated-pdfs:/app/data/nms-generated-pdfs --network newspaper-generator_default pagemint-sandbox:v6 && docker network connect newspaper-portal_portal-tier pagemint_sandbox`
   (create the two data dirs first, `chown 1001:65533`).
6. Tests (all must pass before deploy):
   - `bash scripts/verify-nms-typography.sh http://127.0.0.1:3003 scripts/nms-verify/golden-bundle-JOB-1789496500091-94728FA0.json CliffFrontEditorRail8A CliffFront8A` → green, diff vs golden ≤ 0.5 %.
   - Same with `--all-templates` (or list every front template id from `TemplateRegistry.ts`).
   - Negative test: post the golden bundle with `fonts.headlineByPriority.lead.family = "Not A Font"` → job must **fail** with the contract error, no PDF written.
   - Negative test: bundle **without** `pageMintRecipe` → must render the golden look (default recipe now golden).
   - Wizard-untouched: `docker cp scripts/nms-verify/wizard-path-parity.mjs <container>:/tmp/` for both `newspaper_generator` and `pagemint_sandbox`, run `node /tmp/wizard-path-parity.mjs <label> /tmp/wiz-bundle.json CliffFrontEditorRail8A` in each, `pdftoppm -r 150` + PIL diff → **0.0000 %**.
7. Show results to the owner; wait for explicit go.
8. Deploy exactly like 2026-09-18: tag running image as rollback, back up the changed files to `backups/<name>-<ts>/`,
   copy files sha-checked, `docker compose --env-file /tmp/pm.env build generator`, `up -d --no-build generator`,
   check `docker ps` set unchanged, run the verifier against `http://127.0.0.1:3002`, one wizard probe, `shred -u /tmp/pm.env`.
9. Update `docs/sync/<date>/` snapshot (patch + tarball + shas) and copy the runbook to the NMS repo; owner syncs the PageMint laptop and pushes.

## 4. Time estimate
Implementation 15–20 min · sandbox build 7 min · sandbox tests 30–35 min (all templates) · production build + restart 7 min · production verification 5 min. ≈ 1 h 10 min of agent work.

## 5. Rules (unchanged)
Only `cliffdemo3` gets NMS behaviour; never call `getActivePageMintRecipe()` from shared engine code; never touch nginx,
portal containers, Postgres, `/var/www/cliff-news`; secrets only inside server-side scripts, never printed; sandbox first,
owner approves before production.
