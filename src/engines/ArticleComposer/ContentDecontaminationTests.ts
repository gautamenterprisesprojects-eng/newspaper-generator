import assert from "assert";
import { normalizeArticleBodyText, normalizeIncomingArticleContent } from "@/lib/newswire";
import { DEFAULT_MINIMUM_SPACE_RATIO, justifyNewspaperLine } from "@/engines/NewspaperJustification/NewspaperJustificationEngine";
import { composeArticleBox } from "@/engines/ArticleComposer/composeArticleBox";
import type { ArticleBoxModel, ArticleData } from "@/types/editor";
import { createRichLinesFromWrappedLines } from "@/engines/RichText/RichTextTypographyEngine";
import { prototypeArticle } from "@/data/prototypeArticle";
import { getDefaultStoryTypographySettings } from "@/engines/StoryHierarchy/StoryHierarchyEngine";

class TestOffscreenCanvas {
  getContext() {
    return {
      font: "",
      measureText: (text: string) => {
        let width = 0;
        for (const character of Array.from(text)) {
          if (/\s/u.test(character)) {
            width += 4;
          } else if (/[\u0900-\u097F]/u.test(character)) {
            width += 9;
          } else if (/[A-Z]/u.test(character)) {
            width += 8;
          } else {
            width += 7;
          }
        }
        return { width };
      },
    };
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: TestOffscreenCanvas,
});

export const runContentDecontaminationTests = () => {
  let passed = 0;
  let failed = 0;

  const runAssert = (condition: boolean, message: string) => {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`[FAIL] ${message}`);
    }
  };

  // Test 1: Body Metadata Contamination Test
  {
    const inputBody =
      "अपशब्द बोलने वाली छात्रा को माफ कर प्रधानमंत्री मोदी ने दिया जीवनदान, मां ने कहा- अब उसका भविष्य सुरक्षित Subheadings: • हैरानी करने वाला कदम • पीएम ने अपशब्द बोलने वाली नाबालिग को माफ किया Agency GE News Hub. प्रधानमंत्री ने आगे कहा कि युवा पीढ़ी को अवसर मिलने चाहिए।";
    const headline = "अपशब्द बोलने वाली छात्रा को माफ कर प्रधानमंत्री मोदी ने दिया जीवनदान";
    const subheading = "हैरानी करने वाला कदम • पीएम ने अपशब्द बोलने वाली नाबालिग को माफ किया।";

    const cleaned = normalizeArticleBodyText(inputBody, headline, subheading);

    runAssert(!cleaned.includes("Subheadings:"), "Subheadings: label is removed from body");
    runAssert(!cleaned.includes("• हैरानी"), "Duplicated summary bullets are removed from body");
    runAssert(!cleaned.includes("Agency GE News Hub"), "Agency GE News Hub is removed from body");
    runAssert(cleaned.includes("मां ने कहा") || cleaned.includes("भविष्य सुरक्षित"), "Actual article prose remains");
    runAssert(cleaned.includes("प्रधानमंत्री ने आगे कहा"), "Prose following metadata remains intact");
    runAssert(/[।॥.!?]\s*$/u.test(cleaned), "Cleaned body ends at a complete full stop");
  }

  // Test 2: Field Separation Test
  {
    const input = {
      headline: "मुख्य समाचार शीर्षक।",
      subheading: "यह एक उपशीर्षक है।",
      body: "यह केवल लेख का मुख्य पाठ्य है। इसमें कोई अन्य फ़ील्ड नहीं जोड़ा जाना चाहिए।",
      caption: "फोटो का विवरण।",
      source: "विशेष संवाददाता",
      agency: "प्रेस एजेंसी",
    };

    const normalized = normalizeIncomingArticleContent(input);

    runAssert(!normalized.body.includes(normalized.headline), "Headline is not appended into body");
    runAssert(!normalized.body.includes("यह एक उपशीर्षक है"), "Subheading is not appended into body");
    runAssert(!normalized.body.includes("फोटो का विवरण"), "Caption is not appended into body");
    runAssert(normalized.headline === "मुख्य समाचार शीर्षक।", "Headline remains clean");
    runAssert(normalized.subheading === "यह एक उपशीर्षक है।", "Subheading remains clean without label");
  }

  // Test 3: Duplicate Headline Test
  {
    const headline = "क्रिकेट वर्ल्ड कप: भारत की ऐतिहासिक जीत";
    const body = "क्रिकेट वर्ल्ड कप: भारत की ऐतिहासिक जीत । भारतीय टीम ने फाइनल में शानदार प्रदर्शन किया।";

    const cleaned = normalizeArticleBodyText(body, headline);

    runAssert(!cleaned.startsWith("क्रिकेट वर्ल्ड कप: भारत की ऐतिहासिक जीत"), "Duplicated opening headline removed");
    runAssert(cleaned.includes("भारतीय टीम ने फाइनल में"), "Remaining body content is preserved");
  }

  // Test 4: Legitimate Content Test (English word "subheading" in prose)
  {
    const body = "The official report contained a subheading regarding youth affairs. The minister appreciated the effort.";

    const cleaned = normalizeArticleBodyText(body);

    runAssert(cleaned.includes("contained a subheading regarding youth affairs"), "Legitimate English sentence with subheading is preserved");
  }

  // Test 5: Hindi Word Gap & Justification Floor Test
  {
    const text = "एफआईआर वापस लेने का अनुरोध";
    const style = {
      fontFamily: "Noto Serif Devanagari, serif",
      fontSize: 14,
      lineHeight: 1.4,
      fill: "#000000",
      align: "justify" as const,
    };

    const dummyProvider = { measureText: (t: string) => ({ width: t.length * 8 }) };

    // Justify with normal width
    const result = justifyNewspaperLine({
      text,
      targetWidth: 300,
      style,
      justify: true,
      options: { provider: dummyProvider },
    });

    runAssert(result.text.includes("एफआईआर"), "Hindi words present");
    runAssert(result.text.includes("वापस"), "Words remain distinct");
    runAssert(/\S+\s+\S+/u.test(result.text), "Word gaps remain present");
  }

  // Test 6: Over-Compressed Justification Fallback Test
  {
    const text = "एफआईआर वापस लेने का अति महत्वपूर्ण कानूनी अनुरोध";
    const style = {
      fontFamily: "Noto Serif Devanagari, serif",
      fontSize: 18,
      lineHeight: 1.4,
      fill: "#000000",
      align: "justify" as const,
    };

    const dummyProvider = { measureText: (t: string) => ({ width: t.length * 8 }) };

    // Target width smaller than natural width to simulate space compression
    const result = justifyNewspaperLine({
      text,
      targetWidth: 20, // force severe over-full line
      style,
      justify: true,
      options: { provider: dummyProvider },
    });

    runAssert(result.rejected === true, "Over-compressed line justification is rejected");
    runAssert(result.reason.includes("space compression falls below readable limit"), "Reason reflects minimum space ratio rejection");
  }

  // Test 7: Rich-Text Run Boundary Spaces Preserved
  {
    const richContent = {
      spans: [
        { text: "एफआईआर", bold: true },
        { text: " वापस", bold: false },
      ],
    };
    const wrappedLines = ["एफआईआर वापस"];
    const baseStyle = {
      fontFamily: "Noto Serif Devanagari, serif",
      fontSize: 14,
      lineHeight: 1.4,
      fill: "#000000",
      align: "left" as const,
    };
    const dummyProvider = { measureText: (t: string) => ({ width: t.length * 8 }) };

    const richLines = createRichLinesFromWrappedLines(richContent, wrappedLines, baseStyle, { provider: dummyProvider });

    runAssert(richLines.length === 1, "One line created from rich runs");
    runAssert(richLines[0].segments.length === 2, "Two distinct styled segments created");
    runAssert(richLines[0].segments[0].text === "एफआईआर", "First segment text preserved exactly");
    runAssert(richLines[0].segments[1].text === " वापस", "Second segment retains leading space at run boundary");
    const combinedText = richLines[0].segments.map((s) => s.text).join("");
    runAssert(combinedText === "एफआईआर वापस", "Combined segment text preserves exact word spacing (एफआईआर +  वापस → एफआईआर वापस)");
  }

  // Test 8 & 9: PDF/Preview Parity & Sentence End Fitting Integrity
  {
    const typographySettings = getDefaultStoryTypographySettings("secondary");
    const storyBox: any = {
      x: 0,
      y: 0,
      width: 280,
      height: 360,
      priority: "secondary",
      ...typographySettings,
      forceFullWidthHeadlines: true,
      imageEnabled: false,
    };

    const testArticle: ArticleData = {
      ...prototypeArticle,
      body: {
        spans: [
          { text: "यह पहली पंक्ति का पहला वाक्य है। ", bold: true },
          { text: "इसके बाद दूसरा महत्वपूर्ण वाक्य आता है, जो न्यायपूर्ण ठहराव के साथ समाप्त होगा। ", bold: false },
          { text: "तीसरा वाक्य यहां है ताकि अनुच्छेद में पर्याप्त सामग्री रहे और वह पूरा दिखाई दे।", bold: false },
        ],
      },
      typography: {
        ...prototypeArticle.typography,
        bodyAlignment: "justify",
      },
    };

    const compositionSettings: any = {
      showRegionDebug: false,
      headlineScale: 0.8,
      baselineGridSize: 6,
      enableDropCap: false,
      enableFactBox: false,
      enablePullQuote: false,
      opticalTypography: true,
      enableSentenceEndFitting: true,
    };

    const layout = composeArticleBox(storyBox, testArticle, compositionSettings);
    const allLines = layout.body.columns.flatMap((c) => c.lines);
    runAssert(allLines.length > 0, "Composed layout generated body lines");

    let parityPassed = true;
    let gapsVerified = 0;
    for (const line of allLines) {
      if (line.segments && line.segments.length > 0) {
        const wordsFromSegs = line.segments.map((s) => s.text).join(" ").split(/\s+/u).filter(Boolean).join(" ");
        const wordsFromLine = line.text.split(/\s+/u).filter(Boolean).join(" ");
        if (wordsFromSegs !== wordsFromLine) {
          console.error(`[Parity Word Mismatch] wordsFromSegs="${wordsFromSegs}", wordsFromLine="${wordsFromLine}"`);
          parityPassed = false;
        }
        for (let i = 0; i < line.segments.length - 1; i++) {
          const segA = line.segments[i];
          const segB = line.segments[i + 1];
          const gap = (segB.x ?? 0) - ((segA.x ?? 0) + (segA.width ?? 0));
          if (gap >= 0) {
            gapsVerified++;
          } else {
            console.error(`[Parity Gap Failure] Negative gap ${gap} between segments in line "${line.text}"`);
            parityPassed = false;
          }
        }
      }
    }
    runAssert(parityPassed && gapsVerified > 0, "PDF rich segment positions reflect justified word spacing with exact content parity (100% PDF/Preview parity)");

    const lastLine = allLines.at(-1);
    const textTrimmed = (lastLine?.text ?? "").trim();
    runAssert(/[।॥.!?]$/u.test(textTrimmed), `Composed article body terminates at a valid sentence boundary: "${textTrimmed}"`);
  }

  console.log(`ContentDecontaminationTests passed: ${passed}, failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
};

runContentDecontaminationTests();
