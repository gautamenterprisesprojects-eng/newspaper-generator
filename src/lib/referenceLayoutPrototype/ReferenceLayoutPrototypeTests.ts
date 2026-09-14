import assert from "node:assert/strict";
import { FRONT_HEADER_BANNER_SOURCE, FRONT_HEADER_HEIGHT_PT } from "@/engines/HeaderSystem/HeaderGeometry";
import { DEFAULT_PAGE_MASTER } from "@/types/page";
import {
  buildReferenceLayoutPrototype,
  containsRect,
  PROTOTYPE_LAYOUT_ID,
  rectsOverlap,
  validatePrototypeLayout,
} from "./geometry";

const layout = buildReferenceLayoutPrototype();
const issues = validatePrototypeLayout(layout);

assert.equal(layout.id, PROTOTYPE_LAYOUT_ID);
assert.equal(layout.header.source, FRONT_HEADER_BANNER_SOURCE);
assert.equal(layout.header.height, FRONT_HEADER_HEIGHT_PT);
assert.equal(layout.header.x, 0);
assert.equal(layout.header.y, 0);
assert.equal(layout.page.width, DEFAULT_PAGE_MASTER.width * 72);
assert.equal(layout.page.height, DEFAULT_PAGE_MASTER.height * 72);

assert.equal(
  issues.length,
  0,
  `prototype geometry must be clean, found:\n${issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n")}`,
);

const byId = Object.fromEntries(layout.articles.map((article) => [article.id, article]));
assert(byId.lead, "lead outer article must exist");
assert(byId.lead.nested?.[0], "lead must contain a nested article box");
assert(byId.right.nested?.[0], "right article must contain a nested article box");
assert(byId.mid.nested?.[0], "middle article must contain a nested fact box");
assert.equal(byId.rail.stackedInners?.length, 4, "rail must stack four inner briefs");

assert(containsRect(byId.lead.outer, byId.lead.inner), "lead inner box must sit inside the outer box");
assert(containsRect(byId.lead.outer, byId.lead.nested![0].outer), "lead nested article must sit inside the lead outer box");
assert(containsRect(byId.lead.nested![0].outer, byId.lead.nested![0].inner), "nested inner box must sit inside nested outer");
assert(containsRect(byId.lead.inner, byId.lead.image!), "lead image must stay inside the inner content box");
assert(!rectsOverlap(byId.lead.outer, byId.right.outer), "lead and right peers must not overlap");
assert(!rectsOverlap(byId.rail.outer, byId.lead.outer), "rail and lead peers must not overlap");
assert(!rectsOverlap(byId.mid.outer, byId.bottom.outer), "middle and bottom bands must not overlap");
assert(byId.lead.outer.y >= FRONT_HEADER_HEIGHT_PT - 0.01, "body must start below the existing masthead");
assert(byId.lead.body.columns >= 2, "lead lower text well must use multi-column flow");
assert((byId.lead.extraBodies?.length ?? 0) === 2, "lead inner box must split text around the image");
assert(byId.bottom.body.columns >= 2, "bottom package must use multi-column flow");

for (const article of layout.articles) {
  assert(article.outer.y >= layout.header.height - 0.01, `${article.id} must not enter the masthead`);
  assert(article.inner.width > 0 && article.inner.height > 0, `${article.id} inner box must have area`);
}

console.log("ReferenceLayoutPrototypeTests passed");
console.log(
  JSON.stringify(
    {
      page: layout.page,
      header: { x: layout.header.x, y: layout.header.y, width: layout.header.width, height: layout.header.height },
      content: layout.content,
      articles: layout.articles.map((article) => ({
        id: article.id,
        outer: article.outer,
        inner: article.inner,
        nested: (article.nested ?? []).map((nested) => nested.outer),
      })),
    },
    null,
    2,
  ),
);
