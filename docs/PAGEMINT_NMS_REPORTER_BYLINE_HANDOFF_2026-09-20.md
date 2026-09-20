# PageMint NMS reporter-byline handoff (2026-09-20)

This document records the PageMint change that is running in production and explains how to bring
another PageMint checkout to the same code safely.

## Exact Git state

- PageMint repository: `https://github.com/gautamenterprisesprojects-eng/newspaper-generator.git`
- Feature commit: `c8c0dd6` (`Add NMS reporter line above PageMint byline`)
- Branch: `main`
- Matching NMS recipe commit: `3a56baa` in
  `https://github.com/gautamenterprisesprojects-eng/news_management_system.git`
- Production PageMint image after deployment:
  `sha256:59cf3241c02d261e1892204c00878258e10258d59c839fbe29cd2df1ee241175`

The code is already committed and pushed. Do not reconstruct the change manually unless Git access is
unavailable; pulling or cherry-picking `c8c0dd6` is safer and exact.

## Sync the other computer

First preserve any local work on that computer by committing or stashing it. Then, for a normal clean
checkout of `main`:

```bash
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git merge-base --is-ancestor c8c0dd6 HEAD
```

The final command exits successfully when the feature is present. To inspect exactly what arrived:

```bash
git show --stat --oneline c8c0dd6
git show --name-status --oneline c8c0dd6
```

If the other computer intentionally works on a separate branch and should receive only this feature:

```bash
git fetch origin
git cherry-pick c8c0dd6
```

Do not cherry-pick it when `git merge-base --is-ancestor c8c0dd6 HEAD` already succeeds.

## What changed

For automated NMS PDF generation, an article's original reporter name is now printed as one compact line
immediately above the existing publication byline:

```text
विनय राजपूत
द क्लिफ न्यूज़ • Bhind
```

The behavior activates only when all of these conditions are true:

1. The bundle publisher identity is `cliffdemo3`.
2. PageMint is running an automated NMS export (`?nmsExport=1`).
3. The recipe keeps `bylineSource: "newspaper_name"`.
4. The recipe explicitly sends `reporterNameAboveByline: true`.
5. The article contains `reporter.nameHi` or `reporter.name`.

An internet-fill article has no NMS reporter metadata, so it keeps the original single-line publication
byline. The manual PageMint wizard and every other publisher remain unchanged.

## Files in feature commit `c8c0dd6`

| File | Change |
|---|---|
| `src/components/editor/NmsHeadlessExportBridge.tsx` | Extracts the original NMS reporter, gates the feature to automated `cliffdemo3`, preserves the page-level publication byline, and carries the reporter separately. |
| `src/lib/newswire.ts` | Adds optional `nmsReporterNameAboveByline` to the imported story shape. |
| `src/types/editor.ts` | Adds the optional reporter-line field to `ArticleData`. |
| `src/store/editorStore.ts` | Sanitizes and propagates the optional reporter line during NMS import. |
| `src/engines/ArticleComposer/composeArticleBox.ts` | Measures and reserves exactly one extra byline line, keeps the red dot on the original second line, and scales only an unusually long reporter name. |
| `src/lib/nms/cliffDemo3ManualRecipe.ts` | Adds the optional recipe flag type; the PageMint default does not enable it. |
| `src/engines/ArticleComposer/NmsReporterBylineTests.ts` | Covers NMS gating, other publishers, manual composition, two-line spacing, red-dot placement, internet/no-reporter behavior, and long names. |
| `package.json` | Adds `npm run test:nmsreporterbyline`. |

The NMS commit `3a56baa` changes only
`server/services/cliffDemo3PageMintRecipe.js`: recipe schema v3 becomes v4 and
`importOptions.reporterNameAboveByline` becomes `true`.

## Required verification on the other computer

```bash
npm ci
npm run lint
npm run test:nmsreporterbyline
npm run test:byline
npm run test:cliffdemo3
npm run test:printpdf
npm run build
```

Expected focused result: `NMS reporter byline tests passed: 9`.

Two older harness problems observed before this feature are unrelated: `test:nmsedition` still expects an
8-story front although the current template has 9 boxes, and `test:captionlayout` lacks a Node canvas
measurement shim. They do not affect the production browser/PDF path.

## Production verification completed

- Local browser export: passed and visually inspected.
- Isolated Linux PageMint sandbox: passed and visually inspected.
- Production callback-disabled export: 3,757,029-byte PDF, one page, recipe v4 active.
- Font state: `loaded`, `ready: true`, no fallbacks.
- Reporter articles: compact reporter line above the unchanged publication/red-dot/place line.
- Internet-fill articles: unchanged single-line byline.
- PageMint health: HTTP 200.
- NMS health: HTTP 200 and container health `healthy`.
- Test artifacts were removed and PageMint's previous real latest bundle was restored.

## Server locations and rollback

- Running PageMint source: `/opt/newspaper-generator`
- This handoff document on the server:
  `/opt/newspaper-generator/docs/PAGEMINT_NMS_REPORTER_BYLINE_HANDOFF_2026-09-20.md`
- PageMint source backup:
  `/opt/newspaper-generator/backups/nms-reporter-byline-c8c0dd6-20260920-065016`
- PageMint image rollback tag:
  `newspaper-generator-generator:rollback-reporter-20260920-065016`
- NMS current release: `/srv/news-management-system/releases/3a56baa`
- Previous NMS release: `/srv/news-management-system/releases/7d585b3`
- NMS recipe backup:
  `/srv/news-management-system/backups/nms-reporter-byline-3a56baa-20260920-065418`

No Cliff News Portal source, container, nginx configuration, or database was accessed or changed for this
feature.

## Follow-up fixes: spacing and sub-editor-owned news

Two production follow-ups were added after the original reporter-line feature:

1. The two byline rows use compact `1.25` leading, and the layout reserves at least 5pt between the dotted
   divider and body copy (including wide eight-column layouts). This prevents reporter/publication overlap
   and divider/body collisions without changing ordinary PageMint composition.
2. The explicitly activated NMS recipe remains authoritative if the headless browser normalizes its query
   string. Reporter resolution now falls back through the top-level reporter, rewritten nested reporter,
   and structured byline name. A sub-editor's own upload therefore prints that sub-editor's name, while an
   assigned reporter's article continues to print the reporter who uploaded it.

The focused test now exercises direct composition, front-page newswire import, long reporter names,
reporter-missing internet fill, wide-template divider clearance, and the sub-editor-owned article case.

## Follow-up fix: editor rail consumed the first NMS article

The `CliffFrontEditorRail8A` layout has nine template slots, but story 1 is fixed portrait/name artwork,
not a printable article box. After the template gained its ninth slot, the NMS sequential planner used
the raw `storyCount` and therefore planned nine articles for only eight visible news boxes. Rank-based
placement could assign the first NMS article to story 1, where the rail artwork covered it; this also
hid its reporter or sub-editor byline.

The NMS planner now reports eight printable boxes for this template. During the headless PageMint import,
story 1 receives an internal furniture placeholder and the eight planned articles are pinned in order to
visible story numbers `2, 9, 3, 4, 5, 6, 7, 8`. This is confined to the NMS editor-rail export path. The
regression suite checks that a sub-editor-owned article occupies visible story 2 and prints the uploader
above the publication/place byline.
Expected result: `NMS reporter byline tests passed: 17`.
