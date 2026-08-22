import type { StoryPriority } from "@/types/editor";

export const convertColorToLightTintRgba = (colorHex: string, targetOpacity: number = 0.25): string => {
  if (!colorHex || colorHex === "transparent") {
    return "transparent";
  }

  const hex = colorHex.replace("#", "").trim();
  // Clamp to 20–30% opacity range (was 8–15%)
  const safeOpacity = Math.min(0.30, Math.max(0.20, targetOpacity));

  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // If black or very dark gray (#111111), use a clean warm neutral editorial tint
    if (r < 40 && g < 40 && b < 40) {
      return `rgba(140, 146, 154, ${safeOpacity})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${safeOpacity})`;
  }

  return `rgba(240, 240, 240, ${safeOpacity})`;
};

/**
 * Border colour for a tinted story box — the same hue as the tint, darkened so
 * the outline reads clearly against the light wash it encloses. `darkenBy` is
 * clamped to 0.5–0.7 (50–70% darker); the returned colour is fully opaque,
 * since the tint itself is only a ~25% wash and a translucent border would
 * disappear against it.
 */
export const convertColorToTintBorder = (colorHex: string, darkenBy: number = 0.6): string => {
  if (!colorHex || colorHex === "transparent") {
    return "transparent";
  }

  const keep = 1 - Math.min(0.7, Math.max(0.5, darkenBy));
  const darken = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * keep)));
  const hex = colorHex.replace("#", "").trim();

  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Mirror the neutral fallback the tint uses for black/very dark input, so
    // the border stays in the same family as the fill it borders.
    if (r < 40 && g < 40 && b < 40) {
      return `rgb(${darken(140)}, ${darken(146)}, ${darken(154)})`;
    }

    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }

  return `rgb(${darken(240)}, ${darken(240)}, ${darken(240)})`;
};

export const shouldApplyTintedBackground = (
  storyIndex: number,
  priority: StoryPriority,
  isPreviousStoryTinted: boolean,
  isLeadStory: boolean,
): boolean => {
  // Avoid placing two tinted stories directly adjacent unless one is the lead story
  if (isPreviousStoryTinted && !isLeadStory) {
    return false;
  }

  // Target exactly 1/3 of stories on the page, preferred on Lead, Major, Secondary
  // Lead story always gets tinted
  if (isLeadStory) {
    return true;
  }

  const priorityProbability: Record<StoryPriority, number> = {
    lead: 1.00,    // Always
    major: 0.60,   // Most major stories
    secondary: 0.45,
    brief: 0.15,
    filler: 0.05,
  };

  const prob = priorityProbability[priority] ?? 0.33;
  const hash = Math.sin((storyIndex + 1) * 23.456 + 123.456) * 43758.5453;
  const rand = hash - Math.floor(hash);

  return rand < prob;
};
