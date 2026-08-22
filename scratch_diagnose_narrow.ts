class TestOffscreenCanvas {
  getContext() {
    return {
      font: "",
      measureText: (text: string) => ({
        width: Array.from(text).reduce((sum: number, character: string) => {
          if (/\s/u.test(character)) return sum + 4;
          if (/[ऀ-ॿ]/u.test(character)) return sum + 9;
          return sum + 7;
        }, 0),
      }),
    };
  }
}

async function main() {
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: TestOffscreenCanvas,
  });

  const { prototypeArticle } = await import("./src/data/prototypeArticle");
  const { getDefaultStoryTypographySettings } = await import(
    "./src/engines/StoryHierarchy/StoryHierarchyEngine"
  );
  const { composeArticleBox } = await import("./src/engines/ArticleComposer/composeArticleBox");

  const sentence = "यह एक लंबा और विस्तृत समाचार वाक्य है जो पाठकों को पूरी जानकारी देने के लिए लिखा गया है।";
  const words = sentence.split(/\s+/u).length;
  const repeatCount = Math.ceil(1200 / words);
  const longBodyText = Array.from({ length: repeatCount }, (_, i) => sentence.replace("है।", `है, संख्या ${i}।`)).join(" ");

  const typographySettings = getDefaultStoryTypographySettings("secondary");
  const layout = composeArticleBox(
    {
      x: 0,
      y: 0,
      width: 145,
      height: 479,
      priority: "secondary",
      imageEnabled: false,
      imageAlignment: "top-left",
      imageColumnSpan: 1,
      imageHeight: 0,
      imageHeightMode: "auto",
      imageHeightPreset: "tiny",
      imageHeightProtection: true,
      autoSizeImage: true,
      imageWrapMode: "none",
      ...typographySettings,
      forceFullWidthHeadlines: true,
    } as any,
    {
      ...prototypeArticle,
      headline: { spans: [{ text: "जापान एथलीट अधिकार सुरक्षित खेल माहौल टेस्ट" }] } as any,
      kicker: { ...prototypeArticle.kicker, enabled: true, text: { spans: [{ text: "जापान, एथलीट अधिकार : सुरक्षित खेल माहौल" }] } as any },
      subheadline: { spans: [{ text: "" }] } as any,
      body: { spans: [{ text: longBodyText }] } as any,
      columnCount: 1,
    } as any,
  );

  console.log("decorativeDividers:", JSON.stringify(layout.decorativeDividers, null, 2));
  console.log("body region count:", layout.body.columns.length);
  layout.body.columns.forEach((col: any, idx: number) => {
    console.log(`--- column ${idx} y=${col.y.toFixed(1)} height=${col.height.toFixed(1)} lines=${col.lines.length}`);
  });
  console.log("bodyBox y/height:", layout.body.y, layout.body.height);
  console.log("remainingLineCount:", layout.body.remainingLineCount, "overflow:", layout.body.overflow);
  const lastLineBottom = layout.body.columns.reduce((max: number, col: any) => {
    const colBottom = col.lines.reduce((m: number, l: any) => Math.max(m, l.y + l.height), 0);
    return Math.max(max, colBottom);
  }, 0);
  console.log("last rendered line bottom:", lastLineBottom, " vs body box bottom:", layout.body.y + layout.body.height, " blank space:", (layout.body.y + layout.body.height) - lastLineBottom);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
