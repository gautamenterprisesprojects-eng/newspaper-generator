import type { StoryProfile } from "@/engines/EditorialStory";
import type { AutoPageStorySlot } from "./PageCompositionResult";

const priorityWeight = {
  lead: 100,
  major: 80,
  secondary: 55,
  brief: 32,
  filler: 10,
};

const storyTypeSlotBias: Record<StoryProfile["storyType"], Partial<Record<StoryProfile["priority"], number>>> = {
  lead: { lead: 40, major: 12 },
  brief: { brief: 35, filler: 10 },
  advertisement: {},
  photo: { lead: 20, major: 34, secondary: 10 },
  editorial: { major: 20, secondary: 18 },
  sports: { major: 18, secondary: 18, brief: 8 },
  standard: { secondary: 15, major: 10, brief: 8 },
};

export type PlacementScore = {
  storyId: string;
  slotId: string;
  score: number;
  reasons: string[];
};

/** Scores a StoryProfile against a candidate page slot without mutating layout. */
export const scorePlacement = ({
  profile,
  slot,
}: {
  profile: StoryProfile;
  slot: AutoPageStorySlot;
}): PlacementScore => {
  const columnDelta = Math.abs(profile.preferredColumns - slot.columnSpan);
  const columnScore = Math.max(0, 30 - columnDelta * 8);
  const priorityScore = Math.max(0, 40 - Math.abs((priorityWeight[profile.priority] ?? 0) - (priorityWeight[slot.priority] ?? 0)) / 3);
  const typeScore = storyTypeSlotBias[profile.storyType][slot.priority] ?? 0;
  const imageScore = profile.imageRules.required && slot.columnSpan >= profile.imageRules.minimumHeight / 80 ? 12 : 0;
  const leadTopScore = profile.storyType === "lead" && slot.y <= 80 ? 18 : 0;
  const reservedPenalty = slot.reservedForAdvertisement ? 1000 : 0;
  const score = columnScore + priorityScore + typeScore + imageScore + leadTopScore - reservedPenalty;
  const reasons = [
    `priority match ${Math.round(priorityScore)}`,
    `column match ${Math.round(columnScore)}`,
    `type bias ${typeScore}`,
  ];

  if (imageScore > 0) reasons.push("image preference matched");
  if (leadTopScore > 0) reasons.push("lead story top slot preference matched");
  if (reservedPenalty > 0) reasons.push("slot reserved for advertisement");

  return {
    storyId: profile.storyId,
    slotId: slot.id,
    score,
    reasons,
  };
};

