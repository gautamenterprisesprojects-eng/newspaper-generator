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
  const longReporter = composeArticleBox(
    box,
    { ...article, nmsReporterNameAboveByline: "डॉ. सत्यप्रकाश विश्वकर्मा" },
    settings,
  );
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

  console.log("NMS reporter byline tests passed: 9");
};

run();
