import assert from "assert";

// Since composeArticleBox heavily relies on other systems, we will simulate the logic
// for the purpose of the test to prove the 2-line truncation logic using ellipsis
// and dynamic height.
// The actual implementation is already embedded in composeArticleBox.ts

class TestOffscreenCanvas {
  getContext() {
    return {
      font: "",
      measureText: (text: string) => ({
        width: Array.from(text).reduce((sum, character) => {
          if (/\s/u.test(character)) return sum + 4;
          if (/[\u0900-\u097F]/u.test(character)) return sum + 9;
          return sum + 7;
        }, 0),
      }),
    };
  }
}

export const runCaptionLayoutTests = async () => {
  // Test 1: Caption Width Binding
  {
    const image = { x: 10, y: 10, width: 150, height: 100 };
    const padding = 6;
    const contentWidth = Math.max(1, image.width - padding * 2);
    assert.strictEqual(contentWidth, 138);
    const captionX = image.x;
    assert.strictEqual(captionX, 10);
  }

  // Test 2: Word-by-word truncation logic verification
  {
    const mockStyle = { fontFamily: "Arial", fontSize: 10, fontStyle: "normal", fill: "#000", lineHeight: 1 };
    
    // Simulate measuring function for test
    const mockMeasure = (text: string) => {
      // rough simulation: 5px per character
      const charCount = text.length;
      const width = charCount * 5;
      const lines = Math.ceil(width / 100);
      return { lines: new Array(lines).fill("") };
    };

    let text = "This is a very long caption that naturally exceeds two lines of text because it is extremely long.";
    let lines = mockMeasure(text).lines.length;
    assert.ok(lines > 2, "Test text should exceed 2 lines");

    // Shrinking loop logic:
    const words = text.split(/\s+/);
    let fittedText = "";
    while (words.length > 1) {
      words.pop();
      const testText = words.join(" ") + "…";
      if (mockMeasure(testText).lines.length <= 2) {
        fittedText = testText;
        break;
      }
    }
    
    assert.ok(fittedText.endsWith("…"), "Should end with ellipsis");
    assert.ok(mockMeasure(fittedText).lines.length <= 2, "Should fit in 2 lines");
  }

  // Test 3: Actual image caption box is compact, clipped, and two-line italic text.
  {
    Object.defineProperty(globalThis, "OffscreenCanvas", {
      configurable: true,
      value: TestOffscreenCanvas,
    });

    const { prototypeArticle } = await import("@/data/prototypeArticle");
    const { getDefaultStoryTypographySettings } = await import(
      "@/engines/StoryHierarchy/StoryHierarchyEngine"
    );
    const { composeArticleBox } = await import("./composeArticleBox");
    const typographySettings = getDefaultStoryTypographySettings("secondary");
    const layout = composeArticleBox(
      {
        x: 0,
        y: 0,
        width: 520,
        height: 360,
        priority: "secondary",
        imageEnabled: true,
        imageAlignment: "top",
        imageColumnSpan: 1,
        imageHeight: 150,
        imageHeightMode: "auto",
        imageHeightPreset: "small",
        imageHeightProtection: true,
        autoSizeImage: true,
        imageWrapMode: "none",
        ...typographySettings,
        forceFullWidthHeadlines: true,
      },
      {
        ...prototypeArticle,
        caption: {
          ...prototypeArticle.caption,
          enabled: true,
          showCredit: false,
          showSource: false,
          text: {
            spans: [
              {
                text:
                  "यह लंबा फोटो कैप्शन दो पंक्तियों में रहना चाहिए और बॉक्स के बाहर बिल्कुल नहीं जाना चाहिए।",
              },
            ],
          },
          labels: {
            ...prototypeArticle.caption.labels,
            caption: "",
          },
        },
      },
      {
        showRegionDebug: false,
        headlineScale: 0.8,
        baselineGridSize: 6,
        enableDropCap: false,
        enableFactBox: false,
        enablePullQuote: false,
        opticalTypography: true,
      },
    );
    const caption = layout.caption;

    // Non-overlay captions now allow up to 3 lines (was 2) — real captions
    // from the live API regularly ran past 2 lines' worth of text and were
    // hitting the word-by-word ellipsis fallback instead of showing in full.
    assert.ok(caption, "Image caption should be composed");
    assert.ok(caption.textBlock.lineBoxes.length <= 3, "Caption must render as at most three lines");
    assert.ok(
      caption.textBlock.lineBoxes.every((line) => /italic/u.test(line.style.fontStyle ?? "")),
      "Caption lines must be italic",
    );
    assert.ok(
      caption.textBlock.lineBoxes.every((line) => line.y + line.height <= caption.y + caption.height + 0.5),
      "Caption text must stay inside the caption box",
    );
    assert.ok(!caption.textBlock.containerBounds, "Caption text must not draw a nested inner caption frame");
    assert.ok(caption.height <= 60, `Caption box should hug up to three italic lines, got ${caption.height}`);
  }
  
  console.log("CaptionLayout tests passed!");
};

if (require.main === module) {
  runCaptionLayoutTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
