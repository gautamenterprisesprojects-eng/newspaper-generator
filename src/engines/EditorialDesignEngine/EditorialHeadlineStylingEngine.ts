import type { RichTextContent } from "@/types/RichText";
import type { StoryPriority } from "@/types/editor";

export type EditorialHeadlineColor = "#c62828" | "#1565c0" | "#0f766e";

const STOP_WORDS = new Set([
  "और", "का", "की", "के", "में", "पर", "से", "को", "है", "था", "थे", "एक", "यह", "वह", "तथा", "एवं", "द्वारा", "तक", "हो", "ने",
  "and", "or", "in", "on", "at", "to", "for", "of", "is", "was", "are", "were", "by", "with", "the", "a", "an"
]);

export const selectEditorialHeadlineColor = (seed: number): EditorialHeadlineColor => {
  const normalized = (Math.abs(seed) % 100) / 100;
  if (normalized < 0.50) return "#c62828"; // Deep Red 50%
  if (normalized < 0.85) return "#1565c0"; // Deep Blue 35%
  return "#0f766e"; // Deep Teal 15%
};

export const shouldApplyEditorialHeadlineStyle = (
  storyIndex: number,
  priority: StoryPriority,
  isPreviousStoryStyled: boolean,
): boolean => {
  if (isPreviousStoryStyled) {
    return false; // Avoid styling neighbouring stories
  }

  // Guarantee at least the lead story (story 0) gets coloured heading treatment
  if (storyIndex === 0) {
    return true;
  }

  // Target 25% to 50% (1/4th to 1/2) of total posts weighted towards Lead, Major, Secondary
  const priorityProbability: Record<StoryPriority, number> = {
    lead: 0.90,
    major: 0.65,
    secondary: 0.50,
    brief: 0.30,
    filler: 0.20,
  };

  const prob = priorityProbability[priority] ?? 0.40;
  const hash = Math.sin((storyIndex + 1) * 12.9898 + 78.233) * 43758.5453;
  const rand = hash - Math.floor(hash);

  return rand < prob;
};

export const createStyledHeadlineRichText = (
  headlineText: string,
  color: EditorialHeadlineColor,
  wrappedLines: string[] = [],
): RichTextContent | null => {
  const trimmed = headlineText.trim();
  if (!trimmed) return null;

  // Determine 2 lines (either passed from layout or split at word boundary)
  let line1 = "";
  let line2 = "";

  if (wrappedLines.length === 2 && wrappedLines[0] && wrappedLines[1]) {
    line1 = wrappedLines[0].trim();
    line2 = wrappedLines[1].trim();
  } else {
    const words = trimmed.split(/\s+/u).filter(Boolean);
    if (words.length >= 4) {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(" ");
      line2 = words.slice(mid).join(" ");
    }
  }

  if (line1 && line2) {
    // Two-line headline style:
    // Line 1: Coloured (Red #c62828, Blue #1565c0, Teal #0f766e)
    // Line 2: Black (#11100d)
    return {
      spans: [
        {
          text: line1,
          color, // Red, Blue, or Teal
        },
        {
          text: " " + line2,
          color: "#11100d", // Bold Black
        },
      ],
    };
  }

  // Single line fallback: first 1-3 words coloured, rest black
  const words = trimmed.split(/\s+/u).filter(Boolean);
  let importantCount = 0;
  let coloredWordCount = 0;

  for (let i = 0; i < Math.min(words.length, 5); i++) {
    if (!STOP_WORDS.has(words[i])) {
      importantCount++;
      coloredWordCount = i + 1;
      if (importantCount >= 2 && i >= 1) break;
    }
  }
  if (coloredWordCount === 0) coloredWordCount = 1;

  const coloredPart = words.slice(0, coloredWordCount).join(" ");
  const restPart = words.slice(coloredWordCount).join(" ");

  return {
    spans: [
      {
        text: coloredPart,
        color,
      },
      ...(restPart
        ? [
            {
              text: " " + restPart,
              color: "#11100d",
            },
          ]
        : []),
    ],
  };
};
