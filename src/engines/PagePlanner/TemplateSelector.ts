import type { AdvertisementReservation, PlannerSection, PlannerTemplate } from "./EditionRules";

export type TemplateSelection = {
  templateId: string;
  templateName: string;
  score: number;
  reasons: string[];
};

const sectionMatches = (template: PlannerTemplate, section: PlannerSection) =>
  !template.sections || template.sections.includes(section);

/** Selects the best available template for a planned page without calculating geometry. */
export const selectTemplate = ({
  section,
  storyCount,
  advertisements,
  templates,
}: {
  section: PlannerSection;
  storyCount: number;
  advertisements: AdvertisementReservation[];
  templates: PlannerTemplate[];
}): TemplateSelection => {
  const ranked = templates
    .filter((template) => sectionMatches(template, section))
    .map((template) => {
      const capacityPenalty = storyCount < template.minimumStories
        ? template.minimumStories - storyCount
        : Math.max(0, storyCount - template.maximumStories) * 2;
      const adPenalty = advertisements.length > 0 && !template.supportsAdvertisements ? 100 : 0;
      const score = capacityPenalty + adPenalty + (template.priorityWeight ?? 0);
      const reasons = [
        `story capacity penalty ${capacityPenalty}`,
        advertisements.length > 0
          ? template.supportsAdvertisements ? "supports advertisement reservations" : "does not support advertisements"
          : "no advertisement reservation required",
      ];

      return { template, score, reasons };
    })
    .sort((first, second) =>
      first.score - second.score ||
      first.template.id.localeCompare(second.template.id),
    );

  const selected = ranked[0];

  if (!selected) {
    const fallback = templates[0];

    return {
      templateId: fallback?.id ?? "unassigned-template",
      templateName: fallback?.name ?? "Unassigned Template",
      score: 0,
      reasons: ["fallback template selected"],
    };
  }

  return {
    templateId: selected.template.id,
    templateName: selected.template.name,
    score: selected.score,
    reasons: selected.reasons,
  };
};
