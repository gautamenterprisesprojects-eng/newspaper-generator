# cliffdemo3 NMS adapter fix

Date: 2026-09-14

## Scope

This change affects only automatic NMS bundle generation when the existing PageMint target resolver returns `cliffdemo3`.

Guard:

```ts
const isCliffDemo3NmsFlow = getNmsPageMintTargetId(payload) === "cliffdemo3";
```

The resolver checks `pagemint_target_id`, then `pagemint_user_id`, then `targetUser.pagemintId`, then `targetUser.externalId`.

Manual editor generation, normal PageMint usage, other tenants, Gautam newswire, shared layout engines, and the PDF engine are unchanged.

## Files changed

- `src/components/editor/NmsHeadlessExportBridge.tsx`
- `src/lib/nms/nmsBundleTypes.ts`
- `docs/cliffdemo3-nms-adapter-fix.md`

## Functions added

- `firstText`
- `textArray`
- `objectValue`
- `cliffDemo3SizeWeight`
- `chunkCliffDemo3ArticlesForPages`
- `toCliffDemo3NewswireStory`

The existing `toNewswireStory` and `chunkArticlesForPages` functions remain the fallback for every non-`cliffdemo3` payload.

## Adapter behavior

For `cliffdemo3`, the adapter uses structured NMS data:

- body: `mainBody`, then `rawBody`, `longBody`, `body`, `originalBody`
- headline: `headline`, then `title`, then `originalHeadline`
- subheadings: `subheadings`, preserving order and removing empty duplicates
- subheadline: `subheadline`, then `secondary_headline`, then first subheading
- body variants: NMS `shortBody`/`short_100`, `mediumBody`/`medium_300`, `longBody`/`long_500`, with deterministic truncation fallback
- image: `coverImage.url`, then `images[].url`, then image URL aliases and media URLs
- image caption: `imageCaption`, `image_caption`, `media.image_caption`, `caption`
- place: structured place/location/city aliases
- reporter: language-specific name/designation, photo, and place fields
- byline: structured byline text, otherwise deterministic reporter name/designation/place
- source and timestamp: existing source URL and publication/processed/created timestamps

The clean article body is passed as `NewswireStory.body`; caption, headline, subheadings, and byline remain structured.

## Chunking behavior

Only `cliffdemo3` uses the new contiguous weighted chunker. It keeps incoming order, limits pages to seven articles, chooses `ceil(articleCount / 7)` pages, and balances deterministic story weights based on the existing XS/S/M/L/XL word thresholds plus headline length and image presence.

Examples for similarly weighted stories:

- 7 -> `[7]`
- 8 -> `[4,4]`
- 9 -> `[5,4]` or an equivalent balanced contiguous split
- 10 -> `[5,5]`
- 11 -> `[6,5]`
- 12 -> `[6,6]`
- 13 -> `[7,6]`
- 14 -> `[7,7]`

The first page remains `front`; later pages remain `inside`.

## Shared engine boundary

No changes were made to:

- `importNewswireStories`
- article classification
- template layout
- article composer
- editorial page composer
- EditorCanvas
- PrintPDFEngine

## Test plan/results

Validation results:

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:editoriallayoutquality`: passed.
- Focused fixture for 7, 8, 9, and 14 articles: passed; incoming order and article-specific fields were preserved.
- Non-`cliffdemo3` regression fixture: passed; the legacy adapter and `[7,1]` fixed-seven chunker remained unchanged.
- Production smoke submission for `cliffdemo3`: accepted and queued, with a generated PDF artifact `nms-37-real-JOB-1789329641216-A34F3A21.pdf`; export debug reported two pages with front/inside page types.

The existing PageMint capacity-fill behavior added supplemental stories during the smoke export; that behavior was not changed.

## Rollback

Restore only the timestamped backups of the modified PageMint files, rebuild the PageMint image, and restart only the PageMint generator container. Do not modify Nginx, other projects, or shared server configuration.

## Server-only changes

No database, Nginx, firewall, port, systemd, PM2, operating-system, or global environment changes.

## Template-aware priority planner

The later cliffdemo3 planner adds a request-scoped plan before the browser export. Its guard remains:

```ts
const isCliffDemo3NmsFlow = getNmsPageMintTargetId(payload) === "cliffdemo3";
```

For cliffdemo3 only:

- front templates are selected from the existing `FRONT_PAGE_TEMPLATE_IDS` registry catalogue;
- inside templates are selected from existing non-front, non-editorial registry definitions;
- physical capacity is read from `getTemplateDefinition(templateId).slots.length`;
- incoming NMS stories are consumed in original order;
- supplemental stories are requested only when the selected page has empty slots;
- each page plan stores `pageKind`, `templateId`, and ordered `articleIds`;
- the browser bridge passes the selected `templateId` into `importNewswireStories()`.

The legacy adapter, minimum-fill behavior, and fixed-seven chunker remain the fallback for every non-cliffdemo3 target.

## Supplemental source and duplicate protection

The planner reuses the existing Gautam fetch helper and requests only:

- `National`
- `International`
- `Madhya Pradesh`

The source remains `https://api.gautamenterprises.org/api/v1/delivery/news` with the existing PageMint API-key path and Hindi language request.

Each request initializes a used-ID set with all incoming NMS IDs. Supplemental candidates are rejected when their canonical ID is already used, and selected supplemental IDs are added immediately.

## Planner examples

For 8 NMS stories, a selected capacity-8 front template places 8 NMS stories and requests no supplemental stories; a capacity-10 template places 8 NMS stories plus 2 supplemental stories. A capacity-6 template places the first 6 NMS stories on page 1 and continues with the remaining NMS stories on page 2.

For 18 NMS stories, a possible plan is front capacity 10 with NMS 1-10, inside capacity 7 with NMS 11-17, and inside capacity 8 with NMS 18 plus 7 eligible supplemental stories.

For 3 NMS stories, a capacity-8 or capacity-9 front template places the 3 NMS stories first and fills only the remaining slots with eligible supplemental stories.

## Additional files in this implementation

- `src/lib/nms/cliffDemo3Planner.ts`
- `src/lib/nms/nmsPdfJob.ts`
- `src/lib/nms/nmsNewsFill.ts`
- `src/lib/nms/nmsHeadlessPdfRenderer.ts`
- `src/lib/nms/nmsBundleTypes.ts`
- `src/components/editor/NmsHeadlessExportBridge.tsx`
- `docs/cliffdemo3-nms-adapter-fix.md`

## Local/Git reproduction

On a local PageMint checkout, inspect the files above and compare:

1. `getNmsPageMintTargetId()` and the exact `cliffdemo3` guard.
2. `planCliffDemo3Pages()` and its template/capacity selection.
3. `ensureNmsArticleCapacity()` as the unchanged non-cliffdemo3 fallback.
4. `NmsHeadlessExportBridge` page-plan consumption and `templateId` pass-through.
5. `importNewswireStories()` and `generateTemplateLayout()` as shared consumers.

Run:

```text
npm run lint
npm run build
npm run test:editoriallayoutquality
```

The planner tests must verify 3, 8, 18, and non-cliffdemo3 bundles, original NMS order, template slot capacity, allowed supplemental categories, and no duplicate IDs. Do not modify shared layout engines, manual wizard behavior, NMS APIs, database schema, or server-wide configuration.

## Updated rollback

Restore only the timestamped backups for the files changed in this planner phase, rebuild the `newspaper_generator` image, and restart only that PageMint container. Earlier adapter-phase backups remain valid rollback points for the earlier files. Never restore the whole PageMint project or touch other containers.

## Planner implementation results

The template-aware planner is now deployed behind the existing cliffdemo3 guard. New functions:

- `planCliffDemo3Pages`
- `chooseTemplate`
- `fetchSupplemental`
- `cliffDemo3SizeWeight`
- `canonicalArticleId`

The planner passes a `cliffDemo3PagePlan` through the export payload and the bridge passes each selected registry `templateId` into `importNewswireStories()`.

Validation:

- `npm run lint`: passed after planner integration.
- `npm run build`: passed after planner integration.
- `npm run test:editoriallayoutquality`: passed.
- Temporary planner fixture: passed for 3, 8, and 18 NMS article inputs; incoming numeric IDs remained ordered and unique; non-cliffdemo3 target resolution remained outside the planner guard.
- Production cliffdemo3 smoke: generated `/opt/newspaper-generator/data/nms-generated-pdfs/nms-37-real-JOB-1789332451772-D078B410.pdf`; the diagnostic export reported one front page with 9 ordered stories for the successful planner run.

The current production NMS fill fallback remains unchanged for non-cliffdemo3 targets. The planner requests supplemental stories only from National, International, and Madhya Pradesh and tracks request-scoped used IDs.

## Planner-phase backups

- `src/lib/nms/nmsPdfJob.ts.before-planner-20260914-024116.bak`
- `src/lib/nms/nmsHeadlessPdfRenderer.ts.before-planner-20260914-024116.bak`
- `src/lib/nms/nmsBundleTypes.ts.before-planner-20260914-024116.bak`
- `src/lib/nms/nmsNewsFill.ts.before-planner-20260914-024116.bak`
- `src/components/editor/NmsHeadlessExportBridge.tsx.before-planner-20260914-024116.bak`
- `docs/cliffdemo3-nms-adapter-fix.md.before-planner-20260914-024116.bak`

## Deployment history

- Adapter phase: `2026-09-14`, PageMint generator container rebuilt with the cliffdemo3 adapter.
- Planner phase: `2026-09-14`, only the `newspaper_generator` container was rebuilt/restarted after lint, build, and regression validation.
- No Nginx, database, firewall, systemd, PM2, port, or unrelated project changes were made.


## Story-to-Slot Suitability Audit — 2026-09-14

### Scope, evidence and limitations

This was a source audit with one authorized documentation append. No production source, configuration, NMS application, database, service or shared/manual behavior was changed. Nothing was deployed, rebuilt or restarted, and no generation/callback request was submitted.

The requested Photo Anchor run is recoverable:
- Job: `JOB-1789334469051-1A8AC86E`.
- Saved request: `data/nms-bundles/export-JOB-1789334469051-1A8AC86E.json`.
- PDF and diagnostics: `data/nms-generated-pdfs/nms-37-real-JOB-1789334469051-1A8AC86E.pdf` and its `.pdf.json` sidecar.
- Sidecar timestamp: 2026-09-13 21:22:07.325 UTC, or 2026-09-14 02:52:07.325 IST.
- Selected plan: one front page, `CliffFrontPhotoAnchor8A`, ordered IDs 197–204, eight NMS articles, no supplemental articles.

“Latest” needs qualification: the newest saved artifact at audit time is the later test `TEST-NMS-FRONT-INSIDE9-1789355302260`, generated 2026-09-14 03:09:55.396 UTC. Its templates are `CliffFrontQuadrant7A` and `AdvancedMagazineCover6A`. The detailed analysis below intentionally concerns the explicitly requested Photo Anchor job, not that different test.

All production files under `src` excluding backup files were hashed and compared with the local source; they matched after allowing Windows CRLF normalization. The saved request was read over SSH into memory. The actual adapter, geometry and importer assignment code were evaluated locally in an isolated Node process, stopping before browser-dependent composition; temporary instrumentation existed in memory only, not in any application file. The resulting assignment was cross-checked visually against the saved PDF's headlines. The PDF is rasterized: it has no extractable text/font objects, so exact printed word-gap measurements and final per-line browser metrics cannot be recovered from its text layer.

The initial attempt to execute the complete importer stopped because canvas text measurement is unavailable in plain Node. No fabricated font measurements were substituted. Frame/typography values below are reconstructed inputs to the fitter, not an asserted capture of the historical browser's final fitted line state. The saved sidecar records page/story IDs, not body-region widths or final spacing diagnostics.

### Principal findings

1. General news import is **not purely positional**. An existing shared heuristic ranks stories by word count and fixed-template slots by gross area, then applies category/image/language/unused-ID fallbacks.
2. In this request those fallbacks undo the intended ranking, and the effective final assignment becomes IDs 197–204 in slots 1–8.
3. A 1,051-word XL article (200) lands in shallow brief slot 4. The largest slot 7, initially preferred for article 200, gets article 203 with 512 words.
4. All eight articles have an image URL and category `regional`; three template slots explicitly suppress images. There are no actual XS/S stories in the bundle.
5. The importer retains the preferred article's size class/capacity even when a fallback selects a different article. This is another reason its “capacity” must not be treated as a physical slot estimate.
6. Excessive spacing is visible, especially in the lower packages. The shared browser-mode justification branch can distribute all unused line width over the available gaps without the newspaper-mode expansion ceiling. Assignment mismatch is established; it is not sufficient evidence that assignment alone explains every stretched line.
7. A reusable Hungarian capacity matcher already exists but is not invoked by this manual/news import path. Reordering the planner's array alone will not reliably enforce a future mapping.

### Exact assignment path and rules

Source references are relative to `/opt/newspaper-generator`:

`src/lib/nms/cliffDemo3Planner.ts:67` (`planCliffDemo3Pages`)
→ choose a front/inside registry template, consume incoming articles with `remaining.splice(0, slots.length)`, append supplemental articles only for vacancies
→ `src/lib/nms/nmsPdfJob.ts:11` constructs `cliffDemo3PagePlan`
→ `src/lib/nms/nmsHeadlessPdfRenderer.ts:27` stores the export payload and starts the existing editor export
→ `src/components/editor/NmsHeadlessExportBridge.tsx:303` adapts articles, reconstructs each page via its `articleIds`, and calls `importNewswireStories` around line 350 with `templateId`
→ `src/store/editorStore.ts:3550`
→ classification, template geometry, preferred matching, fallback selection, frame creation and `chooseLayoutFittedNewswireArticleData`
→ existing `composeArticleBox` and existing canvas/PDF export.

Importer details:
- `classifyArticles` preserves array order; it does not itself sort.
- With an explicit template, `generateTemplateLayout` determines geometry independently of article classes. Without one, the modular-layout branch uses class-derived spans/heights.
- Around lines 3671–3714, fixed-template slots rank by `width * height`; articles rank by descending classified word count. Rank-for-rank pairing forms `slotToPreferredArticleIndex`. Only explicit custom layouts use `estimateStoryWordCapacity` for this ranking.
- Editorial pages use positional preferences; manually pinned articles can override by `manualTargetStoryNumber` (fallback: `manualTargetSlotIndex`).
- Around lines 3758–3915, ordinary fixed-template slots want images when `columnSpan >= 3`. A preferred article must be unused, have meaningful localized content, satisfy the image preference and, for any top-row front slot, belong to National/International.
- Top-row fallback searches National/International with the preferred image state, then either image state in those categories, then the ordinary matching-image pool, then all articles. Other slots search matching-image pool then all articles.
- `selectUnusedNewswireArticle` (`editorStore.ts:1981`) uses the **first** eligible unused article. It does not minimize word-count mismatch and does not reserve preferred articles for later slots.
- `hasMeaningfulLocalizedContent` (`src/lib/newswire.ts:439`) checks for a headline and a nonempty selected body; it does not require enough words to fill the requested tier.
- `slot.priority` affects geometry defaults, typography and image permission. It is not directly an editorial-rank term in the fixed-template article pairing. Word count and image presence influence selection; headline length, image aspect and summary demand do not.
- Planner order therefore preserves page membership/order entering the importer, but does not guarantee physical placement or that supplemental stories remain below NMS stories in editorial importance after import.

For this request the initial preferences in slot order are **199, 197, 204, 198, 201, 202, 200, 203**. All categories are `regional`, so the first top slot rejects preferred 199 and falls back to first available image story 197. Slot 2 wants a no-image story, but there are none, and takes 198. Brief slots 3–5 likewise fall back through an empty no-image pool and consume 199, 200 and 201. Slot 6 accepts 202. The preferred articles for slots 7 and 8 have already been consumed, so those slots receive 203 and 204.

### Classification and article demand

`src/engines/EditorialLayoutQuality/EditorialSpaceOptimizer.ts:53–134`:

| Class | Whitespace-delimited words | Class target words | Default priority / span |
|---|---:|---:|---|
| XS | 0–135 | 100 | brief / 1 |
| S | 136–245 | 185 | secondary / 2 |
| M | 246–430 | 305 | secondary / 2 |
| L | 431–530 | 445 | major / 3 |
| XL | 531+ | 620 | lead / 4 |

Text precedence is `body || longBody || mediumBody || shortBody || subheadline || headline || ""`, counted using trim/split on whitespace. Headline/subheadline only contribute as fallbacks when bodies are absent, not as additional demand. Classification does not separately consider headline length, images, image aspect, captions, subheadings/summary or language. It uses the same counting rule for Hindi and English.

The cliffdemo3 adapter first prefers `mainBody`, then `rawBody`, `longBody`, `body`, `originalBody`, and removes duplicated labels/headline lines. Those cleaned bodies were counted below. All eight have three subheadings, image URLs and category `regional`.

| NMS rank / ID | Body words | Actual class | Headline characters / words |
|---|---:|---|---|
| 1 / 197 | 473 | L | 83 / 14 |
| 2 / 198 | 384 | M | 79 / 16 |
| 3 / 199 | 535 | XL | 84 / 15 |
| 4 / 200 | 1,051 | XL | 87 / 14 |
| 5 / 201 | 316 | M | 81 / 15 |
| 6 / 202 | 453 | L | 85 / 16 |
| 7 / 203 | 512 | L | 83 / 16 |
| 8 / 204 | 432 | L | 73 / 15 |

Headline character counts use JavaScript string length, not grapheme counts or rendered width. The input distribution is 2 XL, 4 L, 2 M, 0 S, 0 XS; all 8 have images.

Existing signals suitable for a future adapter are these counts, actual localized text, class, summary/subheading count, image availability and known dimensions, caption presence and source editorial rank. For headline/summary demand, use existing font measurement/layout helpers when available rather than inventing weighted character constants. `measureWordBasedBodyParagraph` can measure line demand with a real measurement context. `calculateHeadlineImportanceScore` is a frame/priority/image-based display hierarchy score, not an existing content-to-slot matcher.

### Slot geometry and capacity

Definitions expose `storyNumber`, `row`, `columnStart`, `columnSpan`, `priority`; optional inset/vertical-trim metadata; template-level `columnCount`, row ratios/minimum heights, and `trimToInsets`. There is no universal per-slot image-required, aspect-ratio or word-capacity field in `TemplateStorySlotDefinition`.

`generateTemplateLayout` (`src/engines/TemplateLayout/TemplateLayoutEngine.ts:170`) computes x/y/width/height from actual page bounds, column grid/gutter, row rhythm, priority-aware row gaps and inset adjustments, then returns slots sorted by story number. This can run **before assignment**. Raw definitions alone do not contain final dimensions; calculations must use the same masthead reservation, page dimensions and template grid as the importer.

`estimateStoryWordCapacity(story)` (`EditorialSpaceOptimizer.ts:199`) already returns an approximate word count:
- Horizontal allowance: max(40, width − 36).
- Headline: two estimated lines for span >= 3, otherwise one; leading from headline settings, plus 8.
- Subheadline: one leading unit plus 10 when present.
- Image: configured image height (default 120), plus 30 for enabled caption or 10 otherwise.
- Body height: frame height minus these allowances and 16 vertical padding.
- Body font/leading: configured values or 12 / 1.38×font defaults.
- Columns: `max(1, story.columnSpan)`, **not a separately resolved rendered internal column count**.
- Column gap: fixed 14; estimated words per line = column width / (body font size × 2.7).
- Result: rounded total lines × words per line, minimum 20.

It does not measure actual headline wrapping, Hindi glyph widths, multiple summary bands, irregular image wrap, reserved inset regions, real image aspect, house-style overrides or final sentence fitting. Consequently it supports approximate 180/350/700-word comparisons, not guaranteed printed capacities. On this front page the composer uses 6.05 column gaps and house-style body sizing; the estimator's assumptions differ. Subtracting an image's full height across every column can underestimate a side-wrapped story's capacity.

All direct production callers:
- `editorStore.ts:1296`: `createArticleDataFromNewswireStory` fallback when no capacity was passed.
- `editorStore.ts:3683`: custom-layout slot ranking.
- `editorStore.ts:3780`: custom-layout requested capacity.
- `editorStore.ts:5261–5262`: `replaceStoryArticleFromNewswire`.
- `EditorialSpaceOptimizer.ts:343`: `matchArticlesToStoriesByCapacity`.
- Tests: `EditorialSpaceOptimizerTests.ts:120–122`; export-object references are not additional calls.

An additional geometry helper, `estimateStoryBoxWordCapacity` in `CustomLayoutGeneratorEngine.ts`, accepts explicit internal columns and typography but uses fixed headline/image allowances; it is also heuristic.

The safest existing baseline is template-generated geometry plus realistic provisional StoryFrames passed to the estimator. Reuse existing composer/line-measurement diagnostics in a future controlled validation to check finalist pairings; do not treat class target words or gross area as rendered capacity.

### CliffFrontPhotoAnchor8A — eight-slot reconstruction

Definition: `src/engines/TemplateLayout/TemplateRegistry.ts:1082`. Six-column grid; row ratios 0.38 / 0.16 / 0.46 and minima 240 / 110 / 260. The last row receives remaining space. Reconstructed page is 936 × 1512 pt; content x=18, width=900, first story y=172.8 and bottom=1460.52. The bridge's masthead correction is a no-op for this geometry.

Dimensions below are points. “Estimate” is the unmodified helper evaluated on a no-image/default-priority provisional frame, deliberately labelled as a baseline rather than exact visible capacity. Source classes are from the preceding article table.

| Slot | Row / start / span | Priority | x / y | Width × height | Preferred → assigned ID | Assigned words / class | Baseline estimate |
|---|---|---|---|---|---|---|---:|
| 1 | 1 / 1 / 4 | lead | 18 / 172.80 | 597.984 × 485.914 | 199 → 197 | 473 / L | 481 |
| 2 | 1 / 5 / 2 | major | 622.032 / 172.80 | 295.968 × 485.914 | 197 → 198 | 384 / M | 304 |
| 3 | 2 / 1 / 1 | brief | 18 / 664.714 | 144.960 × 204.595 | 204 → 199 | 535 / XL | 50 |
| 4 | 2 / 2 / 1 | brief | 169.008 / 664.714 | 144.960 × 204.595 | 198 → 200 | 1,051 / XL | 50 |
| 5 | 2 / 3 / 1 | brief | 320.016 / 664.714 | 144.960 × 204.595 | 201 → 201 | 316 / M | 50 |
| 6 | 2 / 4 / 3 | secondary | 471.024 / 664.714 | 446.976 × 204.595 | 202 → 202 | 453 / L | 126 |
| 7 | 3 / 1 / 4 | major | 18 / 872.309 | 597.984 × 588.211 | 200 → 203 | 512 / L | 745 |
| 8 | 3 / 5 / 2 | secondary | 622.032 / 872.309 | 295.968 × 588.211 | 203 → 204 | 432 / L | 415 |

Actual importer-requested capacities are 1000, 1000, 445, 305, 305, 1000, 1000, 1000. The three brief slots use preferred classes L/M/M, even though the selected stories are XL/XL/M. Applying the subsequent optimistic tier mapping sends these through the longest tier too. These numbers are **requested content tiers**, not evidence that a brief slot holds 305–445 words.

Photo behavior comes from shared priority/span/front-page rules, not a special PhotoAnchor switch:
- Slots 3–5 suppress images because brief + one column, despite incoming image URLs.
- Provisional image spans for slots 1/2/6/7/8 are 3/1/2/2/1; all leave text room beside the image.
- Slot 6 is shallow: an image URL does not guarantee a usable displayed photo. The archived raster shows text there, so provisional imageEnabled must not be confused with final photo rendering.
- Slot 7 is the largest box, despite slot 1 carrying lead priority. A capacity-only ranking naturally prefers article 200 for slot 7, not slot 1.
- Internal column requests are 4/2/1/1/1/3/4/2. This template uses its grid spans, not the physical 1/2/3-column helper used for custom layouts/ProfessionalNews10A. The composer additionally enforces a 120-pt readable-column floor. The ordinary columns for these dimensions exceed that floor; an “incorrect column count” has not been established.

Mismatch conclusions: oversized source articles really do enter brief slots and lose their image opportunity; the largest slot loses its longest preferred article through earlier fallback consumption. There is **no 150-word source article** in this recovered bundle. Slot 7's 512 words versus a 745-word no-image estimate suggests possible under-supply, but with provisional image/subheadline allowances the same helper gives about 559 words. Neither approximation proves the historical final visible deficit.

### Justification diagnosis: what is confirmed and what remains uncertain

The archived PDF visibly has sparse, widely separated body words in lower slots 7/8. The actual shared configuration reconstructed before fitting is:
- body alignment `justify`;
- body mode `justify-except-last`;
- `bodyJustifyEngineMode: "browser"`;
- segmented body rendering, optical typography enabled;
- Hindi preset `newspaper-hindi-body`, stored H&J min/max 96/108, no hyphenation;
- common front-page style, captions suppressed, article-end breathing space disabled;
- front body nominal 9.3 pt, with the composer's Hindi adjustment producing 8.3 pt before fitting; lower-package leading uses the existing 11/9.3 ratio.

Do not confuse generic `justifyEngineMode: "newspaper"` with the separate **body** engine setting: the latter is browser mode. `applyNewswireImportTypography` changes professional justification for English only; there is no cliffdemo3-specific Hindi body engine.

Exact shared path:
`chooseLayoutFittedNewswireArticleData` → `composeArticleBox` → `createBodyColumns` → `composeStoryBody` → `composeHyphenationJustification` → `composeNewspaperBodyLines`.

At `src/engines/NewspaperComposition/NewspaperCompositionEngine.ts:1090–1115`, the browser branch calculates:
`gap = normalGap + unusedWidth / (wordCount - 1)`
for justified multiword lines. It marks the result non-rejected and does not apply the newspaper branch's maximum-expansion constraint. The stored 108% H&J setting therefore is not a hard gap cap on this branch. Badness/readability scoring is not equivalent to prohibiting the resulting spacing.

Two upstream mechanisms can supply overly short lines:
- Underfill/copyfit: `composeArticleBox.ts:1957–2054` explicitly tries horizontal expansion when blank rows remain. For larger shortfalls, tracking boosts reach 0.3×font size and word-space boosts 0.6×font size; leading boosts are smaller. This can amplify sparse type.
- Region-width mismatch: `composeArticleBox.ts:1600–1643` measures at the narrowest usable region; per-region wrapping is enabled only by `editorialPageStyle` at lines 5433–5451. The region engine can create narrower side-image fragments. If those occur on a news page, short lines can later be justified into wider regions. The historical Photo Anchor job does not preserve its region-width diagnostics, so this remains a plausible mechanism, not a proven event for slot 7.

Classification of the user's hypotheses:
- A (too little text for the area): plausible contributor, particularly after ranking is defeated; not conclusively quantified for final fitted slot 7.
- B (long text into unsuitable geometry): confirmed for placement in slots 3/4, but overflow/truncation is not itself proof of the lower-slot spacing cause.
- C (wrong column count): not established; current count follows the same template rules as manual import and passes the normal width floor.
- D (unexpected headless-only composition mode): not found for Hindi. The shared browser-mode gap calculation is a direct mechanism allowing the symptom.
- E: the defensible diagnosis is a confirmed assignment/fallback mismatch plus a shared composition path that permits excessive expansion. Exact per-line attribution needs browser diagnostics that this historical raster PDF does not retain.

No typography or justification changes are proposed as part of this audit. An assignment-only improvement is feasible, but promising that it cures every spacing case would overstate the evidence.

### Manual comparison and reusable matching

`GenerationWizardModal.tsx:2214–2238` passes the selected template, page kind, language and styling to its import callback. `EditorCanvas.tsx:1814–1823` delegates to the same store importer. Manual wire articles therefore undergo the same classification, area/word ranking, image/category fallback and composition rules. There is no separate hidden wizard algorithm that fully solves this mismatch. With the same Hindi stories/template/options, its selection rules are the same.

Manually entered wizard boxes differ: they carry `manualPinned` and `manualTargetStoryNumber` after box-specific validation. The importer explicitly honors those targets and bypasses normal image/category preference for a valid pinned preferred article. This is an existing way to express an explicit physical mapping; all mappings must be one-to-one and language-valid so fallback cannot steal a story.

The wizard defaults `professionalJustification` to true, but the importer uses that switch for English. The NMS bridge omits it; that does not explain this Hindi job. Other wizard styling choices can affect available text area, so “same engine” does not imply every visual option is identical.

Reusable algorithm: `matchArticlesToStoriesByCapacity` (`EditorialSpaceOptimizer.ts:331`) builds a global cost matrix from estimated frame words and source body words, using absolute mismatch plus the existing 25% extra shortfall penalty. It calls exported `solveMinCostMatching` (Hungarian), with padding when there are fewer articles than frames. It does not understand source priority, per-candidate image/header occupancy or category rules. Its `getArticleWordCount` helper uses body/subheadline/headline, so normalized adapter bodies are important.

The wrapper `optimizeMultiPassLayout` also changes content/reflows boxes. It and the matcher are only reached by their own optimization/test path, not by `importNewswireStories`; do not insert that entire wrapper into cliffdemo3 when only mapping is desired. Reuse the pure matcher/solver and existing measurements instead.

### Recommended future design — cliffdemo3 only, not implemented

1. Retain the exact target guard `getNmsPageMintTargetId(payload) === "cliffdemo3"`. Preserve the non-cliffdemo3 branch byte-for-byte in behavior.
2. Normalize the actual article content and keep NMS rank as explicit editorial priority, separate from physical slot number. Preserve incoming page membership/priority and never drop an NMS story merely to improve a score.
3. Generate candidate template geometry using the real page/header bounds and template column count. Score compatibility before selecting randomly. Current `chooseTemplate` is random across the whole eligible front/inside list: it does **not even prefilter by equal story count**. A content-aware candidate set would be a substantive improvement.
4. Use existing word counts/classes and capacity helpers, plus measured headline/summary and known image occupancy where available. Treat image URL presence and successful/known image availability separately; do not invent aspect ratios. Keep any unknown dimension explicitly unknown.
5. Reuse the Hungarian solver/matcher with eligibility constraints or staged matching. NMS rank constrains editorial preference; capacity chooses a suitable physical box within that preference. Do not simply sort by body length and demote the lead. Prefer established physical/cost units and lexicographic priorities over arbitrary new weights.
6. Allocate NMS stories first; then match eligible supplemental candidates only to vacancies. Current supplemental fetching shuffles candidates and chooses the first unused IDs; it neither scores demand nor guarantees a freshness order.
7. Gautam normalization already receives body material such as `ui_hindi.long_500/medium_300/short_250`, top-level variants, article descriptions and image fields. It currently collapses that to one body and an image URL. That is enough to count current candidate words and choose a better-sized candidate without AI. Variant-aware/freshness-aware selection would need preserved variants/timestamps in a cliffdemo3-only fetch/normalization path; do not alter the shared legacy helper globally. A larger source with a legitimate shorter variant can still be suitable for a small box; avoid discarding useful copy solely for having a long full body.
8. Enforce the chosen map in the bridge through the existing pinned-story mechanism, using stable `storyNumber`, not just array order. Compute the final mapping there from adapted stories if keeping the payload shape unchanged. Validate all pinned IDs/targets and content before import, including supplemental mappings. Reordering arrays alone is ineffective because the importer reranks and may fall back.
9. Keep the existing importer, sentence-aware fitting, image reflow, manual wizard, canvas and PDF pipeline. Validate rendered demand/spacing afterward without changing typography. If excessive gaps persist with suitable pairings, report the shared composition limitation separately instead of claiming the planner fixes it.

Template selection should compare size/image distributions and resulting matching cost across geometrically different candidates, then randomize among suitably scored candidates. Eight image-bearing M/L/XL stories are a poor fit for a template with three image-suppressed brief boxes, even though both counts equal eight.

Existing metadata and the pin override make a two-file implementation feasible:
- `src/lib/nms/cliffDemo3Planner.ts`: candidate template/supplemental suitability and reusable scoring helpers.
- `src/components/editor/NmsHeadlessExportBridge.tsx`: within the existing cliffdemo3 branch, normalized demand, final mapping and pinned import handoff.

The bridge must change if a guaranteed final map is required; a planner-only reordering cannot guarantee it. The current payload shape can remain unchanged if the bridge computes mapping from the chosen page plan. If a persisted per-slot mapping is later required, a narrowly scoped type addition to `nmsBundleTypes.ts` would be optional, not necessary for the minimum two-file design.

Do NOT modify `classifyArticles`, `editorStore.ts`, `ArticleComposer`, `composeArticleBox`, `EditorialPageComposer`, shared `TemplateLayoutEngine`, `EditorCanvas`, `PrintPDFEngine`, typography/justification engines, manual wizard, NMS APIs, configuration, database or server services for this proposed planner/assignment phase.

### Local/Git reproduction and future regression checks

This audit updated only the server document; the local documentation was not synchronized during this audit because the authorized write scope names only this server path. A later synchronization should copy this document while preserving its earlier history.

Reproduce from the saved Photo Anchor export payload and the production-matching source. Call the existing adapter and template generator, inspect `slotToPreferredArticleIndex` and the actual `slotAssignments` before composition, and compare with the two tables above. Do not submit the payload to production merely to reproduce an assignment; that would generate artifacts/callbacks.

Future implementation checks should cover 3/8/18 stories, the recovered 197–204 bundle, all-image/no-image/mixed bundles, category fallback, duplicate/missing IDs, language validity, long headlines and summaries, valid/failed images, insufficient supplemental inventory, exact storyNumber pinning, and alternate template geometry. Verify every NMS story remains represented, NMS importance precedes supplemental stories, callback numeric IDs remain intact, and no non-cliffdemo3 request enters the new path. Use actual browser fonts/diagnostics for final visible words, body regions, gaps and whitespace; estimator-only tests cannot prove PDF typography.

**Audit outcome:** placement mismatch and fallback behavior established; direct gap-expansion mechanism identified; historical per-line typography causation remains partly unobserved. The future cliffdemo3-only assignment design is documented, not implemented. All earlier implementation history above is preserved.
