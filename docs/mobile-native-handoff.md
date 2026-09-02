# Mobile And Native App Handoff

Audit window: files modified after **2026-08-31 20:30 IST**.

This document summarizes the mobile-friendly web changes and the Android/iOS wrapper work done across:

- Portal: `/Users/gargenterprises/Desktop/codes/page naker/newspaper front/frontend`
- Editor: `/Users/gargenterprises/Desktop/codes/page naker/newspaper_generater`
- Native shell: `/Users/gargenterprises/Desktop/codes/page naker/pagemint-app`

## Big Picture

The mobile app is a **Capacitor WebView shell**, not a separate native rewrite.

- The native app loads the deployed publisher portal from `server.url`.
- The portal can navigate to the deployed generator/editor.
- Most UI changes remain in the web apps.
- Native-only behavior is accessed through `window.Capacitor` at runtime.
- Web builds must not import `@capacitor/*` directly.

This keeps app updates simple: most fixes ship by deploying the web portal/editor, not by rebuilding Android/iOS.

## Native Shell

Main folder:

- `/Users/gargenterprises/Desktop/codes/page naker/pagemint-app`

Important files:

- `capacitor.config.js`
- `package.json`
- `www/index.html`
- `android/app/build.gradle`
- `android/app/src/main/java/org/gautamenterprises/pagemint/MainActivity.java`
- `android/app/src/main/res/values/strings.xml`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/Info.plist`
- `ios/App/CapApp-SPM/Package.swift`

Current Capacitor setup:

- `appId`: `org.gautamenterprises.pagemint`
- `appName`: `PageMint`
- `webDir`: `www`
- `server.url`: `https://portal.pagemint.gautamenterprises.org`
- `server.allowNavigation`:
  - `portal.pagemint.gautamenterprises.org`
  - `generator.pagemint.gautamenterprises.org`
  - `api.gautamenterprises.org`
- `server.androidScheme`: `https`
- `ios.contentInset`: `never`
- `android.allowMixedContent`: `false`

Dependencies added:

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `@capacitor/ios`
- `@capacitor/filesystem`
- `@capacitor/share`
- `@capacitor/browser`

Native shell rule:

- `www/index.html` is only an offline/unreachable placeholder.
- The actual app UI comes from the remote portal URL.

Before release:

- Confirm `server.url` points to the real production portal.
- Confirm portal, generator, and API are all HTTPS.
- Confirm `allowNavigation` includes every domain the WebView must open.

## Native File Saving

Both web apps have a native-safe save helper:

- Portal: `newspaper front/frontend/src/lib/saveFile.ts`
- Editor: `newspaper_generater/src/utils/saveFile.ts`

Why:

- Browser `Blob + <a download>` often does nothing inside Android WebView and iOS WKWebView.
- Blob URLs cannot be fetched by the native downloader.

How it works:

- In normal browser: use the old browser download path.
- In native shell: detect `window.Capacitor.isNativePlatform()`.
- Convert the Blob to base64.
- Write it to Capacitor Filesystem `CACHE`.
- Open Capacitor Share sheet so the user can save/share the PDF.
- If Filesystem/Share plugins are missing, fall back to browser download.
- Cancel/abort from share sheet is treated as OK because the file was already written.

Also available:

- `saveBytes(...)`
- `saveBase64(...)`
- `openExternal(...)`

Current portal usage:

- `src/app/(admin)/saas-admin/publishers/page.tsx` uses `saveFile` for credentials PDF.
- `src/app/(publisher)/history/page.tsx` uses `openExternal` for generated PDF links.

Current editor usage:

- `src/components/editor/EditorCanvas.tsx` imports `saveBytes` and uses it for PDF export.

Important rule:

- Do not add build-time Capacitor imports to the portal/editor. Keep native access through the runtime bridge.

## Portal Mobile Changes

Key files modified after 20:30:

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/BottomSheet.tsx`
- `src/components/PageMintLogo.tsx`
- `src/app/(publisher)/layout.tsx`
- `src/app/(publisher)/dashboard/page.tsx`
- `src/app/(publisher)/settings/page.tsx`
- `src/app/(publisher)/profile/page.tsx`
- `src/app/(publisher)/wallet/page.tsx`
- `src/app/(publisher)/history/page.tsx`
- `src/app/login/page.tsx`
- Admin/dashboard placeholder pages also received responsive polish around `2026-08-31 23:49`.

Root layout:

- Loads `Inter` plus `Hind` for Hindi/Devanagari UI.
- Adds PWA/native metadata:
  - `appleWebApp.capable`
  - `appleWebApp.statusBarStyle`
  - `appleWebApp.title`
- Adds viewport:
  - `width: device-width`
  - `initialScale: 1`
  - `maximumScale: 1`
  - `userScalable: false`
  - `viewportFit: cover`
  - `themeColor: #047857`
- Body uses `app-shell`.

Global mobile behavior:

- Touch devices use `touch-action: manipulation`.
- Tap highlight removed.
- Pull/rubber-band overscroll contained.
- Accidental text selection disabled inside app shell.
- Inputs/textareas/selects stay selectable.
- Inputs use at least `16px` font to prevent iOS focus zoom.
- Touch scrollbars hidden.
- Safe-area helpers:
  - `.pt-safe`
  - `.pb-safe`
  - `.pb-safe-min`
  - `.pb-tabbar`
- Native-feeling press feedback via `.tap`.
- Route transition via `.animate-screen-in`.
- Horizontal rails use `.snap-rail`.
- Reduced-motion media query disables animations/transitions.

Publisher layout:

- Desktop keeps left sidebar.
- Mobile gets sticky top app bar and fixed bottom tab bar.
- Top bar uses safe-area padding.
- Main content reserves bottom space with `.pb-tabbar`.
- Bottom nav uses `.pb-safe-min`.
- Dashboard app bar has tutorial `?` plus compact toggle.

BottomSheet:

- Phone: bottom sheet with grabber and rounded top corners.
- Tablet/desktop: centered dialog.
- Locks body scroll by fixing body position and restoring scrollY on close.
- Footer uses safe-area bottom padding.
- Escape closes the sheet.

Portal page patterns:

- Tables that are too wide on phones become card lists:
  - wallet transactions
  - history/PDF list
- Inputs/buttons are taller on mobile, smaller on desktop via `sm:*`.
- Primary actions use full width on mobile.
- Page picker/manual news flows use `BottomSheet`.
- Long controls avoid desktop-only hover dependence.

Branding:

- Added pre-sized PNG logo assets:
  - `public/brand/pagemint-logo-96.png`
  - `public/brand/pagemint-logo-256.png`
- `PageMintLogo.tsx` uses plain `<img>`, not `next/image`, to avoid requiring `sharp` at build time.

## Editor Mobile Changes

Key files modified after 20:30:

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/utils/saveFile.ts`
- `src/store/editorStore.ts`
- `src/components/editor/EditorCanvas.tsx`
- `src/components/editor/FrameManagerPanel.tsx`
- `src/components/editor/GenerationWizardModal.tsx`
- `src/components/editor/EditorialSlotPanel.tsx`
- `src/components/editor/AdvertisementPagePanel.tsx`
- `src/components/editor/EditorGuidedTour.tsx`

Root layout:

- Adds native/PWA metadata via `appleWebApp`.
- Adds viewport:
  - `maximumScale: 1`
  - `userScalable: false`
  - `viewportFit: cover`
  - `themeColor: #047857`
- Body uses `app-shell`.

Global editor mobile behavior:

- Touch devices use `touch-action: manipulation`.
- Browser overscroll is disabled.
- Accidental selection is disabled except for inputs and editable text.
- Inputs use at least `16px`.
- `.canvas-touch-surface` and `.konvajs-content` use `touch-action: none` so Konva receives pinch/pan gestures.
- Editor panels use sheet animation on phone.
- Reduced-motion disables sheet/tap animation.

Generation wizard on phones:

- Desktop remains a centered dialog.
- Phones use a full-height sheet:
  - `width: 100vw`
  - `height: 100dvh`
  - no border radius
  - safe-area top padding
- Layout cards use 2 columns on phones.
- Very narrow phones use 1 column.
- Wizard tabs scroll horizontally.
- Action bar is sticky at the bottom with safe-area padding.
- Buttons use larger mobile tap targets.

Editor workspace on phones:

- Desktop docks are fixed left/right/bottom panels.
- Phones convert docks into bottom sheets.
- Collapsed docks become launcher chips above the home indicator.
- Toolbars scroll horizontally instead of wrapping over the canvas.
- Toolbar controls keep minimum touch target height.

Publisher-focused editor shell:

- Desktop keeps a `25vw / 60vw / 15vw` style layout.
- Phones keep the page canvas full-bleed and float panels over it.
- Live page layout becomes a bottom sheet above the action bar.
- Action buttons become a five-column bottom action bar:
  - Home
  - Preview
  - PDF Download
  - Regenerate Page
  - Next Page
- Buttons use equal grid tracks so long Hindi labels do not push controls offscreen.

Live layout sheet:

- Mobile has collapsed and expanded states.
- Handle text: `लाइव पेज लेआउट`, `टच करें खबर बदलने के लिए`.
- Collapsed height is `17dvh`.
- Expanded height is `66dvh`.
- Map height is capped with `min(42dvh, 340px)`.
- Box numbers are enlarged for readability.
- Keep `MOBILE_SHEET_COLLAPSED_RATIO` in `EditorCanvas.tsx` synced with `.publisher-focused-left.sheet-collapsed`.

## Tutorial Changes Are Separate

Detailed tutorial docs are in:

- `newspaper_generater/docs/tutorial-system.md`

Important overlap:

- The mobile live-layout sheet has `data-tour="editor-live-layout-toggle"`.
- Numbered live-layout boxes have `data-tour="editor-live-layout-click-box"`.
- Tutorial skip now turns the toggle off.
- Auto-play is first-time only unless `?` is clicked or toggle is turned on.

## Generated/Build Files From The Window

These were modified but should not be treated as product source:

- `tsconfig.tsbuildinfo`
- `next-env.d.ts`
- `frontend_local.log`
- `.next-stale-tour-fix-*`
- `.next-stale-dev-build-race-*`
- `android/.gradle/**`

Do not document product behavior from these files. They are build cache, local logs, or stale Next build folders.

## Known Build Notes

Portal build:

```bash
cd "/Users/gargenterprises/Desktop/codes/page naker/newspaper front/frontend"
npm run build
```

Known warning:

- Next may warn that `@next/swc-darwin-arm64` is not installed and use wasm fallback.
- If the build says `Compiled successfully`, this warning is not a blocker.

Editor build:

```bash
cd "/Users/gargenterprises/Desktop/codes/page naker/newspaper_generater"
npm run build
```

Native shell install/sync/build basics:

```bash
cd "/Users/gargenterprises/Desktop/codes/page naker/pagemint-app"
npm install
npx cap sync
npx cap open android
npx cap open ios
```

## Risks And Gotchas

- The native shell only works correctly with HTTPS URLs.
- If the deployed portal URL changes, update `capacitor.config.js`.
- If generator/API domains change, update `allowNavigation`.
- Do not use `target="_blank"` directly for important PDF links inside the app; use `openExternal`.
- Do not rely on browser downloads for PDFs inside the app; use `saveFile`, `saveBytes`, or `saveBase64`.
- Do not disable `touch-action: none` on Konva surfaces; it will break canvas pan/pinch on mobile.
- Do not make the mobile publisher action bar horizontally scrollable; the design intent is all five actions visible.
- Do not shrink input text below 16px on touch devices; iOS will zoom the viewport.
- Do not replace `PageMintLogo` with `next/image` unless `sharp` is guaranteed in all build environments.
- Do not edit generated Capacitor platform files blindly; prefer changing `capacitor.config.js` and running `npx cap sync`.

## Quick Audit Commands

Files changed after the original audit window:

```bash
find . -path './node_modules' -prune -o -path './.next' -prune -o -type f -newermt '2026-08-31 20:30:00' -print
```

High-signal search terms:

```bash
rg -n "safe-area|viewportFit|app-shell|touch-action|BottomSheet|saveFile|Capacitor|publisher-focused|layout-sheet"
```

Use this document plus `docs/tutorial-system.md` before future mobile or tutorial edits.
