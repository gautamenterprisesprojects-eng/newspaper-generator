# Guided Tutorial System

Use this note before changing the Hindi guided tutorial. It covers both apps:

- Portal app: `/Users/gargenterprises/Desktop/codes/page naker/newspaper front/frontend`
- Editor app: `/Users/gargenterprises/Desktop/codes/page naker/newspaper_generater`

## Current Behavior

- Tutorial auto-plays only once by default.
- If the user completes the tutorial, it stores the `*-tour-seen-v1` flag and does not auto-play again.
- If the user clicks `छोड़ें`, it also turns the tutorial toggle off and persists that setting.
- The `?` help button replays the tutorial manually any time.
- Turning the toggle on removes the seen flag and starts the tutorial again.
- Turning the toggle off persists and blocks future auto-play.

## Portal Dashboard Tutorial

Main files:

- `newspaper front/frontend/src/components/tour/tourSteps.ts`
- `newspaper front/frontend/src/components/tour/GuidedTour.tsx`
- `newspaper front/frontend/src/app/(publisher)/layout.tsx`
- `newspaper front/frontend/src/app/(publisher)/dashboard/page.tsx`
- `newspaper front/frontend/src/app/(publisher)/settings/page.tsx`
- `newspaper front/frontend/src/app/globals.css`

Important keys/events:

- `TOUR_EVENT = "pagemint:start-tour"`
- `TOUR_SEEN_KEY = "pagemint-tour-seen-v1"`
- `TOUR_ENABLED_KEY = "pagemint-tour-enabled"`
- `TOUR_SETTING_EVENT = "pagemint:tour-setting-changed"`

Targets currently used on dashboard:

- `issue-fields`
- `single-page`
- `full-issue`
- `wallet-chip`

Controls:

- App bar on `/dashboard` has a `?` replay button plus compact toggle.
- Settings page has the tutorial toggle and `अभी देखें` replay button.
- Both controls use `isTourEnabled`, `setTourEnabled`, and `startTour`.

Gotcha:

- Do not remove `TOUR_SETTING_EVENT`. It keeps the app-bar switch in sync when `छोड़ें` turns the tutorial off from inside the overlay.

## Editor Tutorial

Main files:

- `newspaper_generater/src/components/editor/EditorGuidedTour.tsx`
- `newspaper_generater/src/components/editor/EditorCanvas.tsx`
- `newspaper_generater/src/components/editor/GenerationWizardModal.tsx`
- `newspaper_generater/src/components/editor/FrameManagerPanel.tsx`
- `newspaper_generater/src/components/editor/EditorialSlotPanel.tsx`
- `newspaper_generater/src/components/editor/AdvertisementPagePanel.tsx`
- `newspaper_generater/src/app/globals.css`

Important keys/events:

- `EDITOR_TOUR_EVENT = "newspaper-editor:start-tour"`
- `EDITOR_TOUR_SEEN_KEY = "newspaper-editor-tour-seen-v1"`
- `EDITOR_TOUR_ENABLED_KEY = "newspaper-editor-tour-enabled"`
- `EDITOR_TOUR_SETTING_EVENT = "newspaper-editor:tour-setting-changed"`

Controls:

- `EditorTourControls` renders floating `?` plus toggle.
- `GenerationWizardModal` has a header `?` button.
- `EditorGuidedTour` is mounted in `EditorCanvas`.

## Editor Flow Logic

The editor tutorial is contextual. Do not make it one fixed global sequence.

`EditorGuidedTour.getContextualSteps()` decides the active flow:

- If replacement popup is open: show replacement popup steps.
- Else if wizard is closed: show editor canvas/live layout/PDF steps.
- Else if wizard tab is editorial: show editorial tab steps.
- Else if wizard tab is advertisement: show advertisement tab steps.
- Else if wizard is on style step: show style switches and theme palette.
- Else if wizard is on category step: show manual boxes, language, category, load news.
- Else: show layout selection for the current tab.

This prevents the tour from pointing at controls that are not on the current screen.

## Editor Targets

Canvas and final page:

- `editor-generate-layout`
- `editor-page-preview`
- `editor-download-pdf`
- `editor-regenerate-page`
- `editor-next-page`

Live layout replacement:

- `editor-live-layout-toggle`
- `editor-live-layout-panel`
- `editor-live-layout-boxes`
- `editor-live-layout-click-box`
- `editor-live-layout-selected`
- `editor-live-layout-load`

Manual replacement popup:

- `editor-live-replace-popup`
- `editor-live-replace-headline`
- `editor-live-replace-body`
- `editor-live-replace-image`
- `editor-live-replace-done`

Wizard:

- `editor-wizard-panel`
- `editor-section-tabs`
- `editor-tab-front`
- `editor-tab-inside`
- `editor-tab-editorial`
- `editor-tab-advertisement`
- `editor-layout-choice`
- `editor-style-options`
- `editor-theme-palette`
- `editor-style-next`
- `editor-manual-boxes`
- `editor-news-language`
- `editor-news-category`
- `editor-load-news`
- `editor-editorial-layout-choice`
- `editor-editorial-slots`
- `editor-editorial-generate`
- `editor-ad-upload`
- `editor-ad-arrange`

## Adding A New Tutorial Step

1. Add a new item to `EDITOR_TOUR_STEPS` or `DASHBOARD_TOUR`.
2. Add matching `data-tour="..."` to the actual clickable/control element.
3. If the step belongs to the editor, add its target to the correct contextual branch in `getContextualSteps()`.
4. Prefer targeting the exact button/input, not a large parent panel.
5. For mobile-only UI, add a separate step for the collapsed/expanded control if needed.
6. Run the build for the app you touched.

## Validation Commands

Portal:

```bash
cd "/Users/gargenterprises/Desktop/codes/page naker/newspaper front/frontend"
npm run build
```

Editor:

```bash
cd "/Users/gargenterprises/Desktop/codes/page naker/newspaper_generater"
npm run build
```

Known portal warning:

- The portal may warn that `@next/swc-darwin-arm64` is not installed and then use the wasm fallback. If the build still says `Compiled successfully`, this warning is not the tutorial bug.

## Past Bugs To Avoid

- Do not rely only on a fixed step sequence. It caused the tutorial to jump into the wrong editor screen.
- Do not highlight only the live layout map. Users need a clear step on the actual numbered box buttons.
- Do not leave auto-play permanently tied only to the toggle. It should auto-play first time, then stay quiet until `?` or toggle-on.
- Do not let `छोड़ें` only close the overlay. It must also turn the tutorial off.
- Do not pass `finish` directly as an `onClick` handler after adding boolean parameters. Wrap it as `() => finish()`.
