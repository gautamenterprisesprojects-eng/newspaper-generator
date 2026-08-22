/** Diagnoses why a box keeps bottom whitespace. npx tsx scripts/gap-diagnose.ts [layout] */
class AuditOffscreenCanvas {
  private readonly context = {
    font: "",
    measureText(text: string) {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
      let width = 0;
      for (const character of Array.from(text)) {
        if (/\s/u.test(character)) width += fontSize * 0.28;
        else if (/[ऀ-ॿ]/u.test(character)) width += fontSize * 0.62;
        else if (/[A-Z]/u.test(character)) width += fontSize * 0.58;
        else width += fontSize * 0.5;
      }
      return { width };
    },
  };
  getContext() {
    return this.context;
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: AuditOffscreenCanvas });

const { TEMPLATE_REGISTRY } =
  require("@/engines/TemplateLayout/TemplateRegistry") as typeof import("@/engines/TemplateLayout/TemplateRegistry");
const { composeArticleBox } =
  require("@/engines/ArticleComposer/composeArticleBox") as typeof import("@/engines/ArticleComposer/composeArticleBox");
const { useEditorStore } = require("@/store/editorStore") as typeof import("@/store/editorStore");

type NewswireStory = import("@/lib/newswire").NewswireStory;
type TemplateId = import("@/engines/TemplateLayout/TemplateTypes").TemplateId;

const main = async () => {
  const templateId = (process.argv[2] ?? "IndianFront7A") as TemplateId;
  const res = await fetch("http://localhost:3000/api/newswire?category=National%2FState&language=hindi&limit=12");
  const payload = (await res.json()) as { data?: NewswireStory[]; meta?: { baseUrl?: string } };
  if (payload.meta?.baseUrl === "fallback") throw new Error("Live newswire unavailable.");
  const pool = payload.data ?? [];

  const need = TEMPLATE_REGISTRY[templateId].storyCount;
  useEditorStore.getState().importNewswireStories(
    "National/State",
    Array.from({ length: need }, (_, i) => pool[i % pool.length]),
    {
      templateId,
      languageMode: "hindi" as const,
      bylineName: "",
      colouredHeadings: false,
      tintedStoryBackground: false,
      subheadingStyle: { backgroundColor: "#111", textColor: "#fff", borderColor: "#111", backgroundOpacity: 1 },
      bodyAlignment: "justify" as const,
    },
  );

  for (const [index, story] of useEditorStore.getState().stories.entries()) {
    const layout = composeArticleBox(story, story.articleData, story.compositionSettings);
    const body = layout.body;
    const cols = body.columns.filter((c) => c.lines.length > 0);
    const gaps = cols.map((c) => {
      const last = c.lines[c.lines.length - 1];
      return Math.round((c.y + c.height - (last.y + last.height)) * 10) / 10;
    });
    const worst = gaps.length ? Math.max(...gaps) : 0;
    if (worst <= 12) continue;

    const capacity = body.columns.reduce((sum, c) => sum + c.capacity, 0);
    console.log(`\nstory ${index} — worst gap ${worst}pt`);
    console.log(`  body.overflow=${body.overflow} lineCount=${body.lineCount} remainingLineCount=${body.remainingLineCount}`);
    console.log(`  summed column capacity=${capacity}  columnsWithText=${cols.length}/${body.columns.length}`);
    console.log(
      `  per-column [capacity, assigned, gap]: ${body.columns
        .map((c) => `[${c.capacity},${c.assignedLineCount},${gaps[cols.indexOf(c)] ?? "-"}]`)
        .join(" ")}`,
    );
    console.log(`  bodyWhitespacePercent=${layout.metrics.bodyWhitespacePercent} fillPercentage=${layout.metrics.fillPercentage}`);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
