import type { StoryFrame } from "@/types/editor";

export type StoryPriorityRole = NonNullable<StoryFrame["role"]>;

export type StoryPriority = {
  storyIndex: number;
  role: StoryPriorityRole;
  hasImage: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getBriefCount = (storyCount: number) => {
  if (storyCount >= 11) {
    return storyCount - 7;
  }

  if (storyCount >= 9) {
    return storyCount - 8;
  }

  return 0;
};

const getRoleCounts = (storyCount: number) => {
  const lead = storyCount > 0 ? 1 : 0;
  const major = Math.min(2, Math.max(0, storyCount - lead));
  const brief = getBriefCount(storyCount);
  const medium = Math.max(0, storyCount - lead - major - brief);

  return {
    lead,
    major,
    medium,
    brief,
  };
};

const getImageCount = (storyCount: number) => {
  const minimum = Math.max(1, Math.ceil(storyCount * 0.2));
  const maximum = Math.max(minimum, Math.floor(storyCount * 0.4));

  return clamp(Math.round(storyCount * 0.3), minimum, maximum);
};

export const allocateStoryPriorities = (storyCount: number): StoryPriority[] => {
  const roleCounts = getRoleCounts(storyCount);
  const imageCount = getImageCount(storyCount);
  const priorities: StoryPriority[] = [];

  const pushStories = (role: StoryPriorityRole, count: number) => {
    for (let index = 0; index < count; index += 1) {
      priorities.push({
        storyIndex: priorities.length,
        role,
        hasImage: false,
      });
    }
  };

  pushStories("lead", roleCounts.lead);
  pushStories("major", roleCounts.major);
  pushStories("medium", roleCounts.medium);
  pushStories("brief", roleCounts.brief);

  let assignedImages = 0;

  for (const priority of priorities) {
    if (priority.role === "brief" || assignedImages >= imageCount) {
      continue;
    }

    priority.hasImage = true;
    assignedImages += 1;
  }

  return priorities;
};

export const StoryPriorityAllocator = {
  allocateStoryPriorities,
};
