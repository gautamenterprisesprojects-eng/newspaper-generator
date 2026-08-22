import type { StoryPriority } from "@/types/editor";

/**
 * Every story on a page gets one of three visual personalities:
 *
 *   - "plain"  — no border, no tint (~60% of stories, the default)
 *   - "tinted" — light coloured background wash (~25%)
 *   - "boxed"  — thin dark border + inner padding (~15%)
 *
 * The three are mutually exclusive per story. This selector guarantees that
 * no two adjacent stories share the same non-plain treatment, so the page
 * doesn't look like "every second story is tinted" — real newspapers use
 * chrome sparingly for hierarchy contrast, not uniformly for decoration.
 *
 * "boxed" is a brand-new treatment we add here — the underlying model fields
 * (`frameBorderWidth`/`frameBorderColor`) have always been render-supported
 * via `ContainerBackgroundEngine`, but no engine ever assigned them until
 * now. This is why the current output looks flat: no story ever gets a box.
 */
export type StoryVisualStyle = "plain" | "tinted" | "boxed";

export type StoryVisualStyleContext = {
  slotIndex: number;
  priority: StoryPriority;
  previousStyle: StoryVisualStyle | null;
  isLeadStory: boolean;
};

/**
 * Per-priority probability that a story receives a non-plain treatment.
 * Lead is guaranteed a strong visual (tint 60%, box 40%); minor stories
 * mostly stay plain so the page reads as varied but not busy.
 */
const NON_PLAIN_PROBABILITY: Record<StoryPriority, number> = {
  lead: 1.0,
  major: 0.45,
  secondary: 0.30,
  brief: 0.10,
  filler: 0.05,
};

/**
 * When we decide a story goes non-plain, this split governs tinted vs boxed.
 * Lead stories favour tint (matches DB front-page hero); majors favour box
 * (matches TOI feature-column boxed pattern).
 */
const BOXED_SHARE: Record<StoryPriority, number> = {
  lead: 0.30,
  major: 0.55,
  secondary: 0.40,
  brief: 0.50,
  filler: 0.50,
};

/**
 * Deterministic hash keyed off slot index so the same page composes the same
 * way across re-renders (avoids flickering during edit).
 */
const hashProbability = (slotIndex: number, salt: number) => {
  const hash = Math.sin((slotIndex + 1) * 23.456 + salt) * 43758.5453;
  return hash - Math.floor(hash);
};

export const selectStoryVisualStyle = (context: StoryVisualStyleContext): StoryVisualStyle => {
  const { slotIndex, priority, previousStyle, isLeadStory } = context;

  // Lead story always gets a non-plain treatment for hierarchy contrast.
  if (isLeadStory) {
    // Even leads sometimes get a box instead of tint (variety across pages).
    return hashProbability(slotIndex, 811.222) < BOXED_SHARE.lead ? "boxed" : "tinted";
  }

  // Never repeat a non-plain treatment adjacent to another of the same kind;
  // "plain" is a fine neighbour of anything.
  const probability = NON_PLAIN_PROBABILITY[priority] ?? 0.15;
  const rand = hashProbability(slotIndex, 123.456);

  if (rand >= probability) {
    return "plain";
  }

  const wantsBoxed = hashProbability(slotIndex, 555.777) < (BOXED_SHARE[priority] ?? 0.4);
  const proposed: StoryVisualStyle = wantsBoxed ? "boxed" : "tinted";

  // If proposed matches the previous non-plain style, downgrade to plain to
  // preserve variety; if previous was plain, keep the proposal.
  if (previousStyle && previousStyle === proposed) {
    return "plain";
  }
  return proposed;
};

/**
 * Style-specific container overrides. Consumed by the newswire-import block
 * in `editorStore` to build `finalContainerStyles` for each story.
 *
 * All colours are neutral editorial (matches the newspaper palette already
 * used across `defaultContainerStyles` and `newspaperPalette`).
 */
export type StoryVisualStyleSpec = {
  frameBorderWidth: number;
  frameBorderColor: string;
  framePadding: number;
  frameRadius: number;
};

export const BOXED_STYLE_SPEC: StoryVisualStyleSpec = {
  frameBorderWidth: 0.6,
  frameBorderColor: "#3a352f",
  framePadding: 8,
  frameRadius: 0,
};
