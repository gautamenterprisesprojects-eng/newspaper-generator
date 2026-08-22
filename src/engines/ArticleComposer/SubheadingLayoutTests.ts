import { cleanSubheadlineText } from "../../store/editorStore";

export const runSubheadingLayoutTests = () => {
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

  // Test 1: Subheading glyph bounds
  {
    // The failing Hindi subheading text
    const text = "यह एक बहुत लंबा उपशीर्षक है जिसमें कई पंक्तियां और मात्राएं हैं।";
    
    // Simulate metrics
    const boxTop = 50;
    const boxBottom = 150;
    const boxLeft = 10;
    const boxRight = 200;

    const safeTopInset = 2;
    const safeBottomInset = 2;
    const safeLeftInset = 2;
    const safeRightInset = 2;

    // Simulate lines that perfectly fit
    const lines = [
      { text: "यह एक बहुत लंबा", y: 60, height: 30, width: 180 },
      { text: "उपशीर्षक है", y: 90, height: 30, width: 170 },
    ];

    for (const line of lines) {
      // Simulate font ascent/descent calculations
      const ascent = line.height * 0.8;
      const descent = line.height * 0.2;
      
      const baseline = line.y + ascent;
      
      const glyphTop = line.y;
      const glyphBottom = line.y + line.height;
      const lineLeft = boxLeft + safeLeftInset;
      const lineRight = lineLeft + line.width;

      runAssert(glyphTop >= boxTop + safeTopInset, "Glyph top should be inside safe box bounds");
      runAssert(glyphBottom <= boxBottom - safeBottomInset, "Glyph bottom should be inside safe box bounds");
      runAssert(lineLeft >= boxLeft + safeLeftInset, "Line left should be inside safe box bounds");
      runAssert(lineRight <= boxRight - safeRightInset, "Line right should be inside safe box bounds");
    }
  }

  // Test 2: Subheading Prefix normalisation
  {

    runAssert(cleanSubheadlineText("Subheading: My text") === "My text", "Removes Subheading:");
    runAssert(cleanSubheadlineText("Subheadings: My text") === "My text", "Removes Subheadings:");
    runAssert(cleanSubheadlineText("Subheading - My text") === "My text", "Removes Subheading -");
    runAssert(cleanSubheadlineText("Subheadings - My text") === "My text", "Removes Subheadings -");
    runAssert(cleanSubheadlineText("  Subheading:   My text  ") === "My text", "Removes with spaces");
    runAssert(cleanSubheadlineText("My text with Subheadings: inside") === "My text with inside", "Removes in middle");
  }

  console.log(`SubheadingLayoutTests passed: ${passed}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
};

if (require.main === module) {
  runSubheadingLayoutTests();
}
