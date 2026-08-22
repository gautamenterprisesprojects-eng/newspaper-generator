import type { NewswireStory } from "@/lib/newswire";

export type PortalIssueArticleSession = {
  apiBase: string;
  authToken: string;
  publisherId: string;
  issueNumber: string;
  publicationDate: string;
  pageNumber: number;
  pageLabel: string;
};

export type IssueArticleExclusions = {
  articleIds: Set<string>;
  normalizedHeadlines: Set<string>;
  sourceUrls: Set<string>;
};

const emptyExclusions = (): IssueArticleExclusions => ({
  articleIds: new Set(),
  normalizedHeadlines: new Set(),
  sourceUrls: new Set(),
});

export const normalizeIssueArticleHeadline = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export const normalizeIssueArticleSourceUrl = (value: string): string =>
  value.trim().toLowerCase().replace(/\/+$/g, "");

export const getPortalLaunchParamFromWindow = (name: string): string => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name)?.trim() ?? "";
};

export const readPortalIssueArticleSession = (): PortalIssueArticleSession | null => {
  const apiBase = getPortalLaunchParamFromWindow("apiBase") || "http://localhost:8080/api/v1";
  const authToken = getPortalLaunchParamFromWindow("authToken");
  const publisherId = getPortalLaunchParamFromWindow("publisherId");
  const issueNumber = getPortalLaunchParamFromWindow("issueNumber");
  const publicationDate = getPortalLaunchParamFromWindow("publicationDate");
  const pageNumber = Number(getPortalLaunchParamFromWindow("selectedPageNumber")) || 0;
  const pageLabel = getPortalLaunchParamFromWindow("selectedPageName") || `Page ${pageNumber}`;

  if (!apiBase || !authToken || !publisherId || !issueNumber || !publicationDate || pageNumber <= 0) {
    return null;
  }

  return {
    apiBase,
    authToken,
    publisherId,
    issueNumber,
    publicationDate,
    pageNumber,
    pageLabel,
  };
};

export const loadIssueArticleExclusions = async (
  session: PortalIssueArticleSession | null,
): Promise<IssueArticleExclusions> => {
  if (!session) return emptyExclusions();

  try {
    const params = new URLSearchParams({
      issue_number_ank: session.issueNumber,
      publication_date: session.publicationDate,
      exclude_page_number: String(session.pageNumber),
    });
    const response = await fetch(
      `${session.apiBase}/publisher/issue-used-articles/${session.publisherId}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${session.authToken}` }, cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      article_ids?: string[];
      normalized_headlines?: string[];
      source_urls?: string[];
    } | null;

    if (!response.ok || !payload) return emptyExclusions();

    return {
      articleIds: new Set((payload.article_ids ?? []).filter(Boolean)),
      normalizedHeadlines: new Set((payload.normalized_headlines ?? []).filter(Boolean)),
      sourceUrls: new Set((payload.source_urls ?? []).filter(Boolean)),
    };
  } catch {
    return emptyExclusions();
  }
};

export const isIssueArticleExcluded = (
  article: NewswireStory,
  exclusions: IssueArticleExclusions,
): boolean => {
  const headlineKey = normalizeIssueArticleHeadline(article.headline);
  const sourceKey = normalizeIssueArticleSourceUrl(article.sourceUrl);
  return (
    (article.id !== "" && exclusions.articleIds.has(article.id)) ||
    (headlineKey !== "" && exclusions.normalizedHeadlines.has(headlineKey)) ||
    (sourceKey !== "" && exclusions.sourceUrls.has(sourceKey))
  );
};

export const addIssueArticleToExclusions = (
  article: NewswireStory,
  exclusions: IssueArticleExclusions,
) => {
  if (article.id) exclusions.articleIds.add(article.id);
  const headlineKey = normalizeIssueArticleHeadline(article.headline);
  if (headlineKey) exclusions.normalizedHeadlines.add(headlineKey);
  const sourceKey = normalizeIssueArticleSourceUrl(article.sourceUrl);
  if (sourceKey) exclusions.sourceUrls.add(sourceKey);
};

export const filterUnusedIssueArticles = (
  articles: NewswireStory[],
  exclusions: IssueArticleExclusions,
): NewswireStory[] => {
  const fresh: NewswireStory[] = [];
  for (const article of articles) {
    if (isIssueArticleExcluded(article, exclusions)) continue;
    fresh.push(article);
    addIssueArticleToExclusions(article, exclusions);
  }
  return fresh;
};

export const saveIssueUsedArticles = async (
  session: PortalIssueArticleSession | null,
  articles: NewswireStory[],
): Promise<void> => {
  if (!session) return;

  const trackable = articles.filter(
    (article) =>
      !article.manualPinned &&
      !article.id.startsWith("manual-") &&
      (article.id || article.headline || article.sourceUrl),
  );

  try {
    await fetch(`${session.apiBase}/publisher/issue-used-articles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publisher_id: session.publisherId,
        issue_number_ank: session.issueNumber,
        publication_date: session.publicationDate,
        page_number: session.pageNumber,
        page_label: session.pageLabel,
        articles: trackable.map((article) => ({
          article_id: article.id,
          category: String(article.category ?? ""),
          headline: article.headline,
          source_url: article.sourceUrl,
        })),
      }),
    });
  } catch {
    // Usage tracking must never block page generation. If the portal is down,
    // the page still renders; the next fetch simply has no cross-session memory.
  }
};

