/**
 * Publishes the *visible* viewport to CSS as custom properties.
 *
 * Why this exists: CSS viewport units resolve against the LAYOUT viewport,
 * which on iOS Safari is taller than what you can actually see whenever the
 * URL bar and the bottom toolbar are showing. A full-screen overlay sized
 * with vh -- or dvh, or even svh -- can therefore still have its top and its
 * bottom sitting underneath that browser chrome. That is exactly how the
 * manual-article popup came out clipped top and bottom on a large iPhone
 * after two previous attempts with dvh and then svh.
 *
 * window.visualViewport reports the area genuinely on screen, and its offset
 * from the layout viewport, so an overlay pinned to it cannot be covered.
 * Everything else (desktop, Android, any browser without the API) falls back
 * to the CSS units, where they are already correct.
 */

const HEIGHT_VAR = "--app-visual-vh";
const OFFSET_VAR = "--app-visual-top";

export function startVisualViewportVars(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    // No API: leave the properties unset so the CSS fallbacks apply.
    return () => {};
  }

  const root = document.documentElement;

  const apply = () => {
    root.style.setProperty(HEIGHT_VAR, `${Math.round(viewport.height)}px`);
    // offsetTop is how far the visible area has been pushed down the layout
    // viewport -- non-zero while iOS is showing its URL bar.
    root.style.setProperty(OFFSET_VAR, `${Math.round(viewport.offsetTop)}px`);
  };

  apply();
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);

  return () => {
    viewport.removeEventListener("resize", apply);
    viewport.removeEventListener("scroll", apply);
    root.style.removeProperty(HEIGHT_VAR);
    root.style.removeProperty(OFFSET_VAR);
  };
}
