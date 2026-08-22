export type PageType = "front" | "state" | "city" | "national" | "sports" | "editorial";

/**
 * Which header band and layout catalogue a generated page belongs to.
 * "front" = masthead band + front-page-only templates.
 * "inside" = folio strip + the inside-page template catalogue.
 */
/**
 * Which kind of page is being generated.
 *
 * "editorial" behaves like an inside page for geometry — it takes the same
 * content bounds — but carries its own house style: the comment pages set
 * their copy without bylines or in-paragraph subheadings, and identify their
 * writers with a portrait and name block instead.
 */
export type PageKind = "front" | "inside" | "editorial";

export interface PageMaster {
  id: string;
  width: number;
  height: number;
  headerHeight: number;
  footerHeight: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  columns: number;
  gutter: number;
}

export const DEFAULT_PAGE_MASTER: PageMaster = {
  id: "broadsheet",
  width: 13,
  height: 21,
  headerHeight: 0.75,
  // Footer band reserved for the press colour control strip, which is the only
  // thing that prints at the foot of the sheet. 0.715in (51.5pt ≈ 1.82cm) is the
  // band measured on page 4 of the 08 Aug 2026 edition: the rule closing the
  // story boxes sits 51.5pt above the trim, the strip occupies 30.4–44.3pt, and
  // the remaining 30pt is white. Was 0.35in, too shallow to hold the strip clear
  // of the last line of a story.
  footerHeight: 0.715,
  contentX: 0.25,
  contentY: 0.38,
  contentWidth: 12.5,
  // height - contentY - footerHeight. Keep these three in step: the footer band
  // only exists because the content box stops short of it.
  contentHeight: 19.905,
  columns: 6,
  // Horizontal gap between side-by-side article columns. Cut ~30% from 0.12in
  // (8.64pt) to 0.084in (~6.05pt) per an explicit request to tighten spacing
  // between article boxes; also frees a little extra width per column.
  gutter: 0.084,
};
