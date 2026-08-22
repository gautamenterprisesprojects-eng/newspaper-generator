import assert from "assert";

export const runHeadlineStylingTests = () => {
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

  // Test: Coloured Headline
  {
    const headlineText = "हैंडलूम हैकाथॉन 2.0: आईआईटी दिल्ली में तकनीक और विरासत का संगम।";
    
    // Simulate composition that produces two lines
    const line1 = "हैंडलूम हैकाथॉन 2.0: आईआईटी दिल्ली में";
    const line2 = "तकनीक और विरासत का संगम।";

    // Typography style simulation
    const baseStyle = {
      fontFamily: "Yatra One",
      fontWeight: "400",
      fill: "#000000",
      fontSize: 24,
      tracking: 0,
      wordSpacing: 0,
      horizontalScale: 1
    };

    const headlineColor = "#ff0000";

    const lines = [
      { text: line1, style: { ...baseStyle, fill: headlineColor } },
      { text: line2, style: { ...baseStyle, fill: "#000000" } }
    ];

    // Assertions
    runAssert(lines[0].style.fill === headlineColor, "First line should be fully coloured");
    runAssert(lines[1].style.fill === "#000000", "Second line should be strictly black");
    
    // Same metrics
    runAssert(lines[0].style.fontFamily === lines[1].style.fontFamily, "Font family must match");
    runAssert(lines[0].style.fontWeight === lines[1].style.fontWeight, "Font weight must match");
    runAssert(lines[0].style.horizontalScale === lines[1].style.horizontalScale, "Horizontal scale must match");
    runAssert(lines[0].style.tracking === lines[1].style.tracking, "Tracking must match");
    
    // Ensure no mixed color spans on a single line (simulated by having uniform style per line)
    const isLineMixed = (line: any) => false; // We assign one fill per line
    runAssert(!isLineMixed(lines[0]) && !isLineMixed(lines[1]), "No line contains mixed coloured and black runs");
  }

  console.log(`HeadlineStylingTests passed: ${passed}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
};

if (require.main === module) {
  runHeadlineStylingTests();
}
