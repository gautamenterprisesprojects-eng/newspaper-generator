import type { StoryProfile } from "@/engines/EditorialStory";
import type { StoryFrame } from "@/types/editor";
import { scorePlacement } from "./PlacementScorer";
import type { AutoPageStorySlot, PlacedStory, RejectedStory } from "./PageCompositionResult";

const compareProfiles = (first: StoryProfile, second: StoryProfile) => {
  const priorityOrder = { lead: 0, major: 1, secondary: 2, brief: 3, filler: 4 };

  return priorityOrder[first.priority] - priorityOrder[second.priority] ||
    second.preferredColumns - first.preferredColumns ||
    first.storyId.localeCompare(second.storyId);
};

export type StorySlotMatchResult = {
  placed: PlacedStory[];
  rejected: RejectedStory[];
  unusedSlots: AutoPageStorySlot[];
};

/** Deterministically assigns stories to the best available non-advertisement slots. */
export const matchStoriesToSlots = ({
  stories,
  profiles,
  slots,
}: {
  stories: StoryFrame[];
  profiles: Record<string, StoryProfile>;
  slots: AutoPageStorySlot[];
}): StorySlotMatchResult => {
  const availableSlots = slots.filter((slot) => !slot.reservedForAdvertisement);
  const unused = new Map(availableSlots.map((slot) => [slot.id, slot]));
  const placed: PlacedStory[] = [];
  const rejected: RejectedStory[] = [];

  for (const profile of stories.map((story) => profiles[story.id]).filter(Boolean).sort(compareProfiles)) {
    const ranked = [...unused.values()]
      .map((slot) => scorePlacement({ profile, slot }))
      .sort((first, second) =>
        second.score - first.score ||
        first.slotId.localeCompare(second.slotId),
      );
    const best = ranked[0];

    if (!best || best.score <= 0) {
      rejected.push({ storyId: profile.storyId, reason: "No suitable page slot was available." });
      continue;
    }

    placed.push(best);
    unused.delete(best.slotId);
  }

  const placedIds = new Set(placed.map((item) => item.storyId));

  for (const story of stories) {
    if (!placedIds.has(story.id) && !rejected.some((item) => item.storyId === story.id)) {
      rejected.push({ storyId: story.id, reason: "Page capacity was exhausted." });
    }
  }

  return {
    placed,
    rejected: rejected.sort((first, second) => first.storyId.localeCompare(second.storyId)),
    unusedSlots: [...unused.values()].sort((first, second) => first.id.localeCompare(second.id)),
  };
};

