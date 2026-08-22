import type { YouthUpdateTeaserSlot } from "@/store/youthUpdateTeaserStore";

type ApiArticle = {
  id: string;
  category: string;
  headline: string;
  imageUrl: string;
};

type NewswirePayload = {
  data?: Array<{
    id?: string | number;
    category?: string;
    headline?: string;
    imageUrl?: string;
    image_url?: string;
  }>;
};

const SLOT_PAGE_HINTS = [7, 4, 7, 8] as const;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Image could not be converted."));
    reader.readAsDataURL(blob);
  });

export const createYouthUpdateMastheadImageDataUrl = async (imageUrl: string) => {
  if (imageUrl.startsWith("data:")) return imageUrl;

  const response = await fetch(`/api/print-image?url=${encodeURIComponent(imageUrl)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Image could not be fetched.");
  return blobToDataUrl(await response.blob());
};

const fetchArticlesByCategory = async (category: "Entertainment" | "Sports") => {
  const response = await fetch(`/api/newswire?category=${category}&language=english&limit=8`, { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as NewswirePayload | null;

  return (payload?.data ?? [])
    .map((item, index): ApiArticle => ({
      id: String(item.id ?? `${category}-${index}`),
      category: String(item.category || category),
      headline: String(item.headline || "").trim(),
      imageUrl: String(item.imageUrl || item.image_url || "").trim(),
    }))
    .filter((item) => item.headline && item.imageUrl);
};

const labelForArticle = (article: ApiArticle, slotIndex: number) => {
  const prefix = article.category.toLowerCase().includes("sport") ? "SPORTS POST" : "ENTERTAINMENT";
  return `${prefix}-P${SLOT_PAGE_HINTS[slotIndex]}`;
};

export const fetchYouthUpdateMastheadApiTeasers = async (): Promise<
  [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot] | null
> => {
  const [entertainment, sports] = await Promise.all([
    fetchArticlesByCategory("Entertainment"),
    fetchArticlesByCategory("Sports"),
  ]);
  const picked = [entertainment[0], entertainment[1], sports[0], sports[1]].filter(Boolean) as ApiArticle[];
  if (picked.length < 4) return null;

  const slots = await Promise.all(
    picked.map(async (article, slotIndex): Promise<YouthUpdateTeaserSlot> => ({
      imageUrl: await createYouthUpdateMastheadImageDataUrl(article.imageUrl),
      headline: article.headline,
      label: labelForArticle(article, slotIndex),
    })),
  );

  return slots as [YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot, YouthUpdateTeaserSlot];
};
