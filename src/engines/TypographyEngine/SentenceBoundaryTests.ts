import {
  ensureTextEndsWithFullStop,
  extractTextToSentenceEnd,
  findNextSentenceBoundary,
  isSentenceBoundaryAt,
} from "./SentenceBoundaryEngine";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runTests = () => {
  // Test 1: Abbreviation & Decimal protection
  assert(!isSentenceBoundaryAt("Dr. Smith visited the hospital.", 2), "Dr. should not be sentence boundary");
  assert(!isSentenceBoundaryAt("The price is 3.14 dollars.", 13), "3.14 decimal should not be sentence boundary");
  assert(!isSentenceBoundaryAt("डॉ. शर्मा ने भाषण दिया।", 3), "डॉ. should not be sentence boundary");

  // Test 2: Valid sentence boundaries
  assert(isSentenceBoundaryAt("This is sentence one. This is sentence two.", 20), "English period should be boundary");
  assert(isSentenceBoundaryAt("यह पहला वाक्य है। यह दूसरा वाक्य है।", 16), "Hindi purna viram should be boundary");

  // Test 3: Continuation to sentence end
  const englishText =
    "First sentence is here. Second sentence continues beyond word limit and ends cleanly right here. Third sentence follows.";
  const englishExtracted = extractTextToSentenceEnd({ text: englishText, targetWordCount: 8 });
  assert(
    englishExtracted.endsWith("right here."),
    `Expected text to end at complete sentence, got: '${englishExtracted}'`,
  );

  const hindiText =
    "यह पहला मुख्य वाक्य है। नगर निगम ने बारिश के दौरान निचले इलाकों में पंप और राहत दल तैनात करने का निर्देश जारी किया है। अगला वाक्य यहाँ है।";
  const hindiExtracted = extractTextToSentenceEnd({ text: hindiText, targetWordCount: 10 });
  assert(
    hindiExtracted.endsWith("निर्देश जारी किया है।"),
    `Expected Hindi text to end at complete sentence, got: '${hindiExtracted}'`,
  );

  // Test 4: Runaway sentence protection (> 80 words)
  const longSentence = Array.from({ length: 120 }).map((_, i) => `word${i}`).join(" ") + ". Next sentence.";
  const runawayExtracted = extractTextToSentenceEnd({ text: longSentence, targetWordCount: 10, maxOverflowWords: 80 });
  assert(runawayExtracted.split(/\s+/u).length <= 90, "Runaway sentence should be capped");

  // Test 5: ensureTextEndsWithFullStop
  assert(ensureTextEndsWithFullStop("यह वाक्य पूरा नहीं है") === "यह वाक्य पूरा नहीं है ।", "Hindi missing full stop");
  assert(ensureTextEndsWithFullStop("Sentence incomplete") === "Sentence incomplete.", "English missing full stop");

  console.log("SentenceBoundaryTests passed!");
};

runTests();
