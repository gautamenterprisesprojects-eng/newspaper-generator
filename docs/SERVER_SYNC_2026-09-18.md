# PageMint — server ↔ laptop source sync (state as of 2026-09-18)

_Audience: the engineer/AI agent working on the laptop that holds the PageMint git repo, so the
local checkout can be made identical to what is running on the VPS, then committed and pushed._

## Where the truth is
- **Server tree (source of truth):** `root@89.116.33.19:/opt/newspaper-generator` (git repo, branch `main`).
  `git rev-parse HEAD` there = `02c3679` — *"Keep NMS front stories below masthead"* (2026-09-14 00:36 IST).
  Everything done since then (2026-09-14 → 2026-09-18) exists **only as uncommitted changes on the server**.
- **Running production image:** see `server-state.txt` in this folder (`running_image=…dad59234d84d…`), built
  from exactly this tree on 2026-09-18 02:26 UTC. Rollback tag `newspaper-generator-generator:rollback-pre-v5-20260918-022626`.
- **This folder** (`docs/sync/2026-09-18/`) is a self-contained snapshot:

| File | What |
|---|---|
| `server-vs-HEAD.patch` | `git diff HEAD --binary` of every tracked file (41 files, +3482/−480). Apply with `git apply --3way --index server-vs-HEAD.patch` on a checkout of `02c3679`. |
| `tracked-changes.stat` | the `--stat` of that patch |
| `untracked-files.txt` / `untracked-source-files.tar.gz` | 23 new **source** files not in git yet (docs, verifier, nms libs, reference-layout prototype). Extract at repo root: `tar -xzf untracked-source-files.tar.gz`. |
| `deleted-tracked-files.txt` | tracked files that no longer exist on the server (`src/lib/nms/nmsHeadlessFonts.ts`) → `git rm` them |
| `sha256-tracked-modified.txt`, `sha256-untracked.txt` | checksums to prove the laptop tree equals the server tree after sync |
| `git-status.txt` | `git status --short` on the server at snapshot time |

Runtime data (`data/nms-bundles`, `data/nms-generated-pdfs`), `backups/`, `verify-out/` and `*.bak` files are
**deliberately excluded** — they must not go to GitHub. Recommended: add `data/`, `backups/`, `verify-out/`
to `.gitignore` when committing (`verify-out/` was already appended on the server).

## Fastest way to sync the laptop (pick one)

**A. Pull the working tree directly (recommended, exact):**
```
# on the laptop, inside the PageMint repo, on a clean checkout of 02c3679:
git fetch && git checkout 02c3679   # or: git checkout main && git reset --hard 02c3679
rsync -av --delete \
  --exclude=/.git --exclude=/node_modules --exclude=/.next --exclude=/data --exclude=/backups \
  --exclude=/verify-out --exclude='*.bak' --exclude='docs/sync/*/untracked-source-files.tar.gz' \
  -e "ssh -i ~/.ssh/<key> -o IdentitiesOnly=yes" root@89.116.33.19:/opt/newspaper-generator/ ./
git status --short          # should match git-status.txt (minus data/ noise)
```
**B. Offline, from this folder only:** `git checkout 02c3679 && git apply --3way --index docs/sync/2026-09-18/server-vs-HEAD.patch && tar -xzf docs/sync/2026-09-18/untracked-source-files.tar.gz && git rm -q src/lib/nms/nmsHeadlessFonts.ts`.

**Verify** (either method): `sha256sum -c docs/sync/2026-09-18/sha256-tracked-modified.txt docs/sync/2026-09-18/sha256-untracked.txt` → every line `OK`.

## What the uncommitted changes are (so the commit message can be honest)
1. **Owner's layout work (2026-09-14 → 16, via Cursor):** `CliffFrontEditorRail8A` editor-rail front template
   (`EditorRailFront.tsx`, `drawEditorRailFront.ts`, `EditorRailFrontGeometry.ts`, portrait route + `public/editor-rail/`),
   `CliffFrontSep15` template, `TemplateRegistry/Engine/Types`, `GenerationWizardModal` (NMS-bundle feed for cliffdemo3),
   `PortalLaunchBootstrap` (editorial author designation), `editorStore` slot rules, `imageColumnStart`, tests.
2. **NMS → PageMint headless PDF pipeline (2026-09-12 → 17):** `src/lib/nms/*`, `NmsHeadlessExportBridge.tsx`,
   `src/app/api/nms-bundle/route.ts`, `EditorCanvas` store hook + NMS font gate, `FontManagerEngine` loader/assertion,
   compose env for the portal profile fetch (`docker-compose.yml` PAGEMINT_PORTAL_* vars + `portal-tier` network).
3. **2026-09-18 fix (this deploy):** wizard typography restored to HEAD for every publisher; NMS behaviour kept
   behind `getNmsExportRecipe()`; recipe-driven palette/byline/bullets; fill-photo URL order; verifier + runbook.
   Details and rationale: `docs/NMS_PAGEMINT_PDF_RUNBOOK.md` §3.

Suggested commit split: (1) layout work, (2) NMS pipeline, (3) 2026-09-18 typography restore + docs/verifier —
or one commit "Sync server state 2026-09-18 (NMS PDF pipeline, editor-rail layout, wizard typography restore)".

## After pushing
- Future deploys should go **repo → server** (`git pull` on the server, then `docker compose --env-file … build generator && up -d --no-build generator`), never server-only edits again. Keep `docs/NMS_PAGEMINT_PDF_RUNBOOK.md` identical in the NMS repo.
- Run `bash scripts/verify-nms-typography.sh http://127.0.0.1:3002 scripts/nms-verify/golden-bundle-JOB-1789496500091-94728FA0.json` on the server after every deploy.
