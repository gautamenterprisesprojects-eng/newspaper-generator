import type { ArticleBoxModel, StoryImageSettings } from "@/types/editor";

class TestCanvas {
  private readonly context = {
    font: "",
    fillText: () => undefined,
    measureText(text: string) {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 16);
      return {
        width: Array.from(text).reduce((width, character) => {
          if (/\s/u.test(character)) return width + fontSize * 0.28;
          if (/[\u0900-\u097F]/u.test(character)) return width + fontSize * 0.62;
          return width + fontSize * 0.5;
        }, 0),
      };
    },
  };

  getContext() {
    return this.context;
  }
}

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    createElement: () => new TestCanvas(),
    fonts: { addEventListener: () => undefined },
  },
});

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  const { prototypeArticle } = await import("@/data/prototypeArticle");
  const { getDefaultStoryTypographySettings } = await import(
    "@/engines/StoryHierarchy/StoryHierarchyEngine"
  );
  const { composeArticleBox } = await import("./composeArticleBox");
  const { useEditorStore } = await import("@/store/editorStore");
  const {
    CLIFFDEMO3_MANUAL_RECIPE,
    resolvePageMintRecipeFromPayload,
    setActivePageMintRecipe,
  } = await import("@/lib/nms/cliffDemo3ManualRecipe");

  const typography = getDefaultStoryTypographySettings("secondary");
  const image: StoryImageSettings = {
    imageEnabled: false,
    imageAlignment: "top-right",
    imageColumnSpan: 1,
    imageHeight: 96,
    imageHeightMode: "auto",
    imageHeightPreset: "small",
    imageHeightProtection: true,
    autoSizeImage: true,
    imageWrapMode: "none",
  };
  const box: ArticleBoxModel & StoryImageSettings & typeof typography & { priority: "secondary" } = {
    x: 0,
    y: 0,
    width: 390,
    height: 360,
    priority: "secondary",
    ...image,
    ...typography,
  };
  const settings = {
    showRegionDebug: false,
    headlineScale: 0.8,
    baselineGridSize: 6,
    enableDropCap: false,
    enableFactBox: false,
    enablePullQuote: false,
    opticalTypography: true,
  };
  const reporterName = "रिपोर्टर XYZ";
  const article = {
    ...prototypeArticle,
    headline: "एनएमएस रिपोर्टर बाइलाइन परीक्षण",
    body: "समाचार का मुख्य पाठ। ".repeat(100),
    nmsReporterNameAboveByline: reporterName,
  };

  const ordinary = composeArticleBox(box, article, settings);
  assert(
    ordinary.byline.wrappedLines.length === 1 && !ordinary.byline.text.includes(reporterName),
    "manual/non-NMS composition must ignore the reporter-name line",
  );

  const otherPublisherRecipe = resolvePageMintRecipeFromPayload({
    pagemint_target_id: "another-publisher",
    pageMintRecipe: {
      ...CLIFFDEMO3_MANUAL_RECIPE,
      importOptions: {
        ...CLIFFDEMO3_MANUAL_RECIPE.importOptions,
        reporterNameAboveByline: true,
      },
    },
  });
  assert(otherPublisherRecipe === null, "other publisher ids must never receive the NMS recipe");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { search: "?nmsExport=1" } },
  });
  setActivePageMintRecipe({
    ...CLIFFDEMO3_MANUAL_RECIPE,
    importOptions: {
      ...CLIFFDEMO3_MANUAL_RECIPE.importOptions,
      bylineSource: "newspaper_name",
      reporterNameAboveByline: true,
    },
  });
  const nms = composeArticleBox(box, article, settings);
  const nmsWithoutReporter = composeArticleBox(
    box,
    { ...article, nmsReporterNameAboveByline: "" },
    settings,
  );
  const wideNmsWithoutReporter = composeArticleBox(
    { ...box, width: 760, columnSpan: 8 } as typeof box,
    { ...article, columnCount: 8, nmsReporterNameAboveByline: "" },
    { ...settings, editorialTemplateId: "CliffInsideEightColumn" },
  );
  const longReporter = composeArticleBox(
    box,
    { ...article, nmsReporterNameAboveByline: "डॉ. सत्यप्रकाश विश्वकर्मा" },
    settings,
  );
  (globalThis.window as unknown as { location: { search: string } }).location.search = "";
  const explicitRecipeNms = composeArticleBox(box, article, settings);
  const importReporterName = "मुकेश भदौरिया";
  const importHeadline = "सब-एडिटर की अपनी अपलोड की हुई खबर";
  const importStories = Array.from({ length: 9 }, (_, index) => ({
    id: `nms-import-${index + 1}`,
    language: "hindi" as const,
    category: "National",
    headline: index === 0 ? importHeadline : `फिल समाचार ${index + 1}`,
    subheadline: "",
    body: "समाचार का मुख्य पाठ पूरे पृष्ठ परीक्षण के लिए पर्याप्त लंबा है। ".repeat(80),
    shortBody: "समाचार का मुख्य पाठ। ".repeat(20),
    mediumBody: "समाचार का मुख्य पाठ। ".repeat(80),
    longBody: "समाचार का मुख्य पाठ। ".repeat(160),
    summary: [],
    caption: "",
    imageCaption: "",
    imageUrl: "",
    place: "भोपाल",
    sourceTitle: "NMS",
    sourceUrl: "",
    publishedAt: null,
    bylineName: "",
    ...(index === 0 ? { nmsReporterNameAboveByline: importReporterName } : {}),
  }));
  useEditorStore.getState().importNewswireStories("NMS Bundle", importStories, {
    templateId: "CliffFrontEditorRail8A",
    pageKind: "front",
    languageMode: "hindi",
    bylineName: "द क्लिफ न्यूज़",
    colouredHeadings: false,
    tintedStoryBackground: true,
    inlineColumnSubheadings: true,
    subheadingStyle: {
      backgroundColor: "#111111",
      textColor: "#ffffff",
      borderColor: "#111111",
      backgroundOpacity: 1,
    },
    bodyAlignment: "justify",
  });
  const importedOwnStory = useEditorStore.getState().stories.find(
    (story) => JSON.stringify(story.articleData.headline).includes(importHeadline),
  );
  const importedOwnLayout = importedOwnStory
    ? composeArticleBox(importedOwnStory, importedOwnStory.articleData, importedOwnStory.compositionSettings)
    : null;
  setActivePageMintRecipe(null);
  Reflect.deleteProperty(globalThis, "window");

  assert(nms.byline.wrappedLines.length === 2, "NMS byline must reserve exactly two lines");
  assert(nms.byline.wrappedLines[0] === reporterName, "reporter must print on the first line");
  assert(
    nms.byline.wrappedLines[1] === "संवाददाता • भोपाल",
    "existing publication/location byline must remain unchanged on line two",
  );
  assert(
    nms.byline.height > ordinary.byline.height && nms.byline.height - ordinary.byline.height <= 12,
    "reporter must consume only one compact extra line",
  );
  const reporterLine = nms.byline.lineBoxes[0];
  const publicationLine = nms.byline.lineBoxes[1];
  assert(
    Boolean(reporterLine && publicationLine) &&
      publicationLine.y - reporterLine.y >= reporterLine.style.fontSize + 1.5,
    "reporter and publication rows must keep visible vertical separation",
  );
  assert(
    nms.byline.lineBoxes[1]?.segments?.some((segment) => segment.role === "byline-dot") === true,
    "red dot must remain on the original publication/location line",
  );
  assert(
    longReporter.byline.lineBoxes[1]?.style.fontSize === nms.byline.lineBoxes[1]?.style.fontSize,
    "a long reporter name must not resize the original publication/location line",
  );
  assert(
    (longReporter.byline.lineBoxes[0]?.renderedWidth ?? Infinity) <= longReporter.byline.width,
    "a long reporter name must fit within the byline width",
  );
  assert(
    explicitRecipeNms.byline.wrappedLines[0] === reporterName,
    "an explicitly activated NMS recipe must survive browser query normalization",
  );

  const assertDividerClearsBody = (layout: typeof nms, label: string) => {
    const divider = layout.decorativeDividers?.find((candidate) => candidate.style === "dotted");
    const firstBodyLineY = Math.min(
      ...layout.body.columns.flatMap((column) => column.lines
        .filter((line) => Boolean(divider) && line.x < divider!.x + divider!.width && line.x + line.width > divider!.x)
        .map((line) => line.y)),
    );
    assert(Boolean(divider), `${label} must retain its dotted byline divider`);
    assert(
      divider !== undefined && Number.isFinite(firstBodyLineY) && firstBodyLineY - divider.y >= 5,
      `${label} divider must keep at least 5pt before body text (actual: ${divider ? firstBodyLineY - divider.y : "missing"})`,
    );
  };

  assertDividerClearsBody(nms, "two-line NMS byline");
  assert(
    nmsWithoutReporter.byline.wrappedLines.length === 1,
    "an internet-filled story without a reporter must remain a one-line byline",
  );
  assertDividerClearsBody(nmsWithoutReporter, "single-line NMS byline");
  assertDividerClearsBody(wideNmsWithoutReporter, "wide eight-column NMS byline");
  assert(
    importedOwnStory?.articleData.nmsReporterNameAboveByline === importReporterName,
    "front-page import must preserve a sub-editor uploader as the article reporter",
  );
  assert(
    importedOwnLayout?.byline.wrappedLines[0] === importReporterName,
    "front-page composition must print the sub-editor uploader above the publication byline",
  );

  console.log("NMS reporter byline tests passed: 17");
};

run();
