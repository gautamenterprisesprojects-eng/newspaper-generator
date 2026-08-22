import assert from "assert";
import { resolveTypographyAdjustments, validateReadableWordGap } from "./TypographyLimits";

const runTests = () => {
  // resolveTypographyAdjustments
  {
    const result = resolveTypographyAdjustments({
      trackingEm: -0.05,
      fontSize: 10,
      renderer: "composition"
    });
    // -0.01 * 10 = -0.1px
    assert(Math.abs(result.letterSpacingPx - -0.1) < 0.001, `Expected -0.1, got ${result.letterSpacingPx}`);
  }

  {
    const result = resolveTypographyAdjustments({
      trackingEm: -0.05,
      fontSize: 10,
      renderer: "pdf"
    });
    // PDF safe bounds tracking (-0.01) * 10 = -0.1px
    assert(Math.abs(result.letterSpacingPx - -0.1) < 0.001, `Expected -0.1, got ${result.letterSpacingPx}`);
  }

  {
    const result = resolveTypographyAdjustments({
      wordSpacingEm: -0.1,
      fontSize: 10,
      renderer: "composition"
    });
    // Negative word spacing is strictly disallowed; clamped to 0px
    assert(Math.abs(result.wordSpacingPx - 0) < 0.001, `Expected 0, got ${result.wordSpacingPx}`);
  }

  // validateReadableWordGap
  {
    assert(validateReadableWordGap(6, 10, 5) === true);
    assert(validateReadableWordGap(4.9, 10, 5) === false); // Must fail if < 1.0x (5px)
    assert(validateReadableWordGap(5.2, 10, 5, 1, -0.01) === false); // With tracking -0.01, ratio becomes >= 1.10x (5.5px)
    assert(validateReadableWordGap(5.5, 10, 5, 1, -0.01) === true);
  }

  console.log("TypographyLimits tests passed!");
};

runTests();
