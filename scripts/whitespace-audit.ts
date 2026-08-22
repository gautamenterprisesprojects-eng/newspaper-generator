/**
 * Whitespace audit — composes every registered layout with real newswire
 * articles and reports leftover vertical space at the bottom of each body
 * column. Run with the dev server up:  npx tsx scripts/whitespace-audit.ts
 *
 * Text measurement is approximated with the same OffscreenCanvas stub the
 * store tests use, so absolute widths differ slightly from the browser — but
 * the leftover-space behaviour being measured here is unaffected.
 */

class AuditOffscreenCanvas {
  private readonly context = {
    font: "",
    measureText(text: string) {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
      let width = 0;

      for (const character of Array.from(text)) {
        if (/\s/u.test(character)) {
          width += fontSize * 0.28;
        } else if (/[ऀ-ॿ]/u.test(character)) {
          width += fontSize * 0.62;
        } else if (/[A-Z]/u.test(character)) {
          width += fontSize * 0.58;
        } else {
          width += fontSize * 0.5;
        }
      }

      return { width };
    },
  };

  getContext() {
    return this.context;
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: AuditOffscreenCanvas,
});

const { TEMPLATE_REGISTRY } =
  require("@/engines/TemplateLayout/TemplateRegistry") as typeof import("@/engines/TemplateLayout/TemplateRegistry");
const { composeArticleBox } =
  require("@/engines/ArticleComposer/composeArticleBox") as typeof import("@/engines/ArticleComposer/composeArticleBox");
const { useEditorStore } = require("@/store/editorStore") as typeof import("@/store/editorStore");

type NewswireStory = import("@/lib/newswire").NewswireStory;
type TemplateId = import("@/engines/TemplateLayout/TemplateTypes").TemplateId;

const API = "http://localhost:3000/api/newswire";

const fetchStories = async (category: string, limit: number): Promise<NewswireStory[]> => {
  const res = await fetch(`${API}?category=${encodeURIComponent(category)}&language=hindi&limit=${limit}`);
  const payload = (await res.json()) as { data?: NewswireStory[]; meta?: { baseUrl?: string } };
  if (payload.meta?.baseUrl === "fallback") {
    throw new Error("Live newswire unavailable — audit needs real articles.");
  }
  return payload.data ?? [];
};

const importOptions = (templateId: TemplateId) => ({
  templateId,
  languageMode: "hindi" as const,
  bylineName: "",
  colouredHeadings: false,
  tintedStoryBackground: false,
  subheadingStyle: {
    backgroundColor: "#111111",
    textColor: "#ffffff",
    borderColor: "#111111",
    backgroundOpacity: 1,
  },
  bodyAlignment: "justify" as const,
});

const main = async () => {
  // Pass layout ids (or a count) as argv to audit a subset — a full 27-layout
  // sweep runs ~570 compositions and takes many minutes.
  const argv = process.argv.slice(2);
  const all = Object.keys(TEMPLATE_REGISTRY) as TemplateId[];
  const templateIds =
    argv.length === 0
      ? all
      : Number.isFinite(Number(argv[0]))
        ? all.slice(0, Number(argv[0]))
        : (argv as TemplateId[]);
  const maxStories = Math.max(...templateIds.map((id) => TEMPLATE_REGISTRY[id].storyCount));
  const pool = await fetchStories("National/State", Math.min(20, maxStories + 4));

  if (pool.length === 0) {
    throw new Error("No articles returned from the newswire API.");
  }

  console.log(`Pool: ${pool.length} live articles\n`);
  console.log("layout                          cols   worst-gap   leaky   verdict");
  console.log("─".repeat(72));

  let worstOverall = 0;
  let worstLayout = "";
  let layoutsWithGaps = 0;

  for (const templateId of templateIds) {
    const need = TEMPLATE_REGISTRY[templateId].storyCount;
    const articles = Array.from({ length: need }, (_, i) => pool[i % pool.length]);

    try {
      useEditorStore.getState().importNewswireStories("National/State", articles, importOptions(templateId));
    } catch (error) {
      console.log(`${templateId.padEnd(30)} IMPORT FAILED: ${(error as Error).message}`);
      continue;
    }

    const stories = useEditorStore.getState().stories;
    let worstGap = 0;
    let leaky = 0;
    let columnCount = 0;

    for (const story of stories) {
      const layout = composeArticleBox(story, story.articleData, story.compositionSettings);

      for (const column of layout.body.columns) {
        if (column.lines.length === 0) continue;
        columnCount += 1;
        const lastLine = column.lines[column.lines.length - 1];
        const gap = column.y + column.height - (lastLine.y + lastLine.height);
        const lineHeight = lastLine.height || 12;

        if (gap > worstGap) worstGap = gap;
        if (gap > lineHeight) leaky += 1;
      }
    }

    if (worstGap > worstOverall) {
      worstOverall = worstGap;
      worstLayout = templateId;
    }
    if (leaky > 0) layoutsWithGaps += 1;

    const verdict = leaky === 0 ? "clean" : `${leaky} col > 1 line`;
    console.log(
      `${templateId.padEnd(30)}${String(columnCount).padStart(5)}  ${worstGap.toFixed(1).padStart(9)}pt  ${String(leaky).padStart(5)}   ${verdict}`,
    );
  }

  console.log("─".repeat(72));
  console.log(`worst gap across all layouts: ${worstOverall.toFixed(1)}pt (${worstLayout})`);
  console.log(`layouts with a >1-line gap:   ${layoutsWithGaps} / ${templateIds.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
