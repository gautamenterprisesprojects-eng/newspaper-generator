import { NEWSWIRE_CATEGORIES, type NewswireCategory, type NewswireStory } from "./newswire";

/**
 * Shared by both the manual wizard (GenerationWizardModal's front-page flow)
 * and the portal's unattended batch mode (EditorCanvas) — a page that pulls
 * from more than one category needs the exact same weighting/rounding logic
 * in both places, or the two flows would quietly drift apart the way the
 * portal's own category list already once did (see newswire.ts).
 */

export const shuffleNewswireStories = <T,>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Front-page category mix — deliberate editorial weighting, not an even
 * split across all 7 categories: the front page should read like a real
 * front page (national + state lead, a supporting international story,
 * a touch of sports/business), not an equal 1/7th share of Health and
 * Entertainment alongside National. Categories omitted here (Health,
 * Entertainment) are never fetched for the front page at all.
 */
export const FRONT_PAGE_CATEGORY_WEIGHTS: Partial<Record<NewswireCategory, number>> = {
  National: 0.4,
  "Madhya Pradesh": 0.2,
  International: 0.2,
  Sports: 0.1,
  Business: 0.1,
};

/**
 * Even split across every real news category — used for a page whose
 * section name doesn't match any specific category (Classifieds, or any
 * future publisher's section label this repo has never seen before). Unlike
 * the front page, there's no editorial reason to weight one category over
 * another here, so every category gets an equal share.
 */
const EVEN_CATEGORY_WEIGHTS: Partial<Record<NewswireCategory, number>> = Object.fromEntries(
  NEWSWIRE_CATEGORIES.map((category) => [category, 1 / NEWSWIRE_CATEGORIES.length]),
);

/**
 * Turns `needed` boxes into an exact per-category split of `weights` using
 * the largest-remainder method — flooring each share first, then handing
 * the leftover boxes one at a time to whichever category's fractional
 * remainder is biggest — so the totals always sum to exactly `needed`
 * (plain rounding of each share independently can overshoot or undershoot
 * it) while staying as close to the requested ratio as an integer split
 * allows.
 */
export const computeWeightedCategoryTargets = (
  needed: number,
  weights: Partial<Record<NewswireCategory, number>> = FRONT_PAGE_CATEGORY_WEIGHTS,
): Array<{ category: NewswireCategory; target: number }> => {
  const entries = Object.entries(weights) as Array<[NewswireCategory, number]>;
  const shares = entries.map(([category, weight]) => {
    const exact = needed * weight;
    const floor = Math.floor(exact);
    return { category, floor, remainder: exact - floor };
  });

  let leftover = needed - shares.reduce((sum, share) => sum + share.floor, 0);
  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; leftover > 0 && i < byRemainderDesc.length; i += 1, leftover -= 1) {
    const share = shares.find((candidate) => candidate.category === byRemainderDesc[i].category);
    if (share) share.floor += 1;
  }

  return shares.map(({ category, floor }) => ({ category, target: floor }));
};

export const computeEvenCategoryTargets = (needed: number): Array<{ category: NewswireCategory; target: number }> =>
  computeWeightedCategoryTargets(needed, EVEN_CATEGORY_WEIGHTS);

export const isArticleUsed = (article: NewswireStory, usedIds: Set<string>, usedHeadlines: Set<string>) =>
  usedIds.has(article.id) || usedHeadlines.has(article.headline.trim().toLowerCase());
