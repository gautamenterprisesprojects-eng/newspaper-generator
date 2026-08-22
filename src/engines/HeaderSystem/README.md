# Header System

The Header System stores reusable newspaper masthead and folio metadata on the normalized document. It is a master-header layer, not a story frame, so headers are protected and are resolved dynamically for each page.

## Data Model

- `PublicationProfile` stores publication-level and issue-level data such as English/Hindi names, edition, date, city, price, language, tagline, website, registration number, volume/issue labels, colors, and optional logo assets.
- `HeaderSet` is schema-versioned and stores one paired front-page masthead template and one inside-page folio template.
- `HeaderSystemState` lives on `NewspaperDocument.headerSystem` and contains publication profiles, header sets, the active header set, and section-level header set overrides.

## Resolution

`resolvePageHeader(document, pageId)` derives the rendered header from current document state:

- Page 1 resolves to the front masthead.
- Pages 2+ resolve to the inside folio.
- Page numbers come from current page order, so insert, delete, and move operations do not stamp stale folio text into pages.
- Mirror-capable inside folios swap their outer-edge slots on even pages.
- Page-local overrides take precedence over section overrides.
- Hidden active Header Sets resolve to no page header.
- Tokens are resolved by `resolveHeaderTokens()` without expression evaluation.

Supported tokens include `{{publicationName}}`, `{{publicationNameHindi}}`, `{{shortName}}`, `{{editionName}}`, `{{edition}}`, `{{date}}`, `{{day}}`, `{{pageNumber}}`, `{{totalPages}}`, `{{section}}`, `{{city}}`, `{{price}}`, `{{tagline}}`, `{{taglineHindi}}`, `{{establishedText}}`, `{{volume}}`, `{{issue}}`, `{{website}}`, and `{{registrationNumber}}`.

## Layout Presets

Front-page layouts:

- `classic-centered`
- `two-ears`
- `skyline-masthead`
- `bold-hindi-regional`
- `modern-left-identity`
- `heritage-institutional`

Inside folio layouts:

- `classic-rule-folio`
- `centered-publication`
- `section-color-band`
- `mirrored-facing-pages`
- `compact-hindi-folio`
- `local-edition-folio`

## Rendering

`PageHeader` accepts a `ResolvedPageHeader` and renders it as non-listening protected page chrome.

`buildHeaderPrintModel()` converts the same resolved page header into deterministic text/rule operations in page points. The current PDF export path consumes that print model while rasterizing the page canvas at 300 DPI. This keeps preview/PDF header content tied to the same document model, but exported PDF header text is still rasterized rather than vector text.

`buildHeaderWorkflowValidationReport()` audits a document's master-header workflow in page order. It reports front/inside assignment, resolved dynamic page numbers, reserved header space, print operation coverage, and structural issues. The regression suite uses it to verify add-page, reorder, issue-date update, save/reload, and print-model behavior.

## Persistence

New documents receive a default Header System. Legacy loaded documents are normalized without auto-enabling a header unless they already contain an active header set.

## Header Manager

The Header Manager keeps local draft edits and applies them explicitly through the editor store. Field changes do not mutate the document until `Apply Header Set` is used.

Applied Header Manager commands are recorded as header document transactions. `Undo Header` and `Redo Header` restore the before/after document header state for explicit Header Set actions without adding draft keystrokes to history.

The manager displays simultaneous previews for:

- front-page masthead
- odd inside-page folio
- even inside-page folio

Header Set controls support:

- save as
- duplicate
- rename
- delete with confirmation
- activate existing Header Sets
- set active Header Set as default
- export active Header Set JSON
- import Header Set JSON
- lock/unlock the protected master header
- show/hide the protected master header
- reset front/inside layouts to a known pair
- apply and remove section-level inside folio overrides
- override the active page header
- return the active page to its master header
- undo/redo applied Header Set operations

Section overrides may change the section display name, inside folio layout, accent color, and a website/slug suffix. Page overrides are stored as lightweight override records on the active Header Set and take precedence over section overrides without copying the full Header Set into the page model.

## Validation

`validateHeaderSystemState()` checks structural Header Set issues such as missing active sets, missing Publication Profiles, invalid heights, and missing text masthead fallback.

`validateHeaderAssets()` checks Header Set logo references against the document asset registry. Missing logos warn and fall back to text mastheads. Unsupported logo asset types and unsafe SVG executable content are rejected.

Logo import in the Header Manager reuses the existing asset manager data model. PNG, JPEG, and sanitized SVG inputs are accepted, large files are rejected, and imported assets are referenced from the Publication Profile rather than embedded into page-local story frames.

## Integration Points

- Header Manager panel edits `PublicationProfile` fields and switches among the six front and six inside layouts.
- Story layout remains separate. Reserved header height is exposed on `ResolvedPageHeader.reservedHeight` and `contentInsetTop`.
- `resolveHeaderReservedContentBounds()` returns header-adjusted page content bounds. The editor grid/layout context and direct move/resize clamping consume this helper for the active page.
