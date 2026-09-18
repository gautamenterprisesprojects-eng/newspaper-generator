import type { PublisherEditorialAuthorDefaults } from "@/store/publisherEditorialAuthorStore";
import type { NmsBundlePayload } from "./nmsBundleTypes";
import { textValue } from "./nmsBundleTypes";

type EditorialAuthorRow = {
  name?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  location?: unknown;
  place?: unknown;
  city?: unknown;
  designation?: unknown;
  title?: unknown;
};

const pickRowAuthor = (row: EditorialAuthorRow): PublisherEditorialAuthorDefaults | null => {
  const name = textValue(row.name);
  const imageUrl = textValue(row.imageUrl) || textValue(row.image_url);
  const designation = textValue(row.designation) || textValue(row.title);
  const location = textValue(row.location) || textValue(row.place) || textValue(row.city);
  if (!name && !imageUrl) return null;
  return {
    name,
    imageUrl,
    ...(designation ? { designation } : {}),
    ...(location ? { location } : {}),
  };
};

export const editorialAuthorsFromNmsPayload = (payload: NmsBundlePayload): PublisherEditorialAuthorDefaults[] => {
  const extended = payload as NmsBundlePayload & {
    editorial_authors?: EditorialAuthorRow[];
    editorial_author_name?: unknown;
    editorial_author_image_url?: unknown;
    editorial_author_designation?: unknown;
    city?: unknown;
    layout?: unknown;
    frontPageLayout?: unknown;
  };

  const fromArray = Array.isArray(extended.editorial_authors)
    ? extended.editorial_authors
        .map(pickRowAuthor)
        .filter((author): author is PublisherEditorialAuthorDefaults => Boolean(author))
    : [];

  if (fromArray.length > 0) return fromArray;

  const target = payload.targetUser as (typeof payload.targetUser & {
    name?: unknown;
    image_url?: unknown;
    imageUrl?: unknown;
    printDesignation?: unknown;
    printPlaceName?: unknown;
  }) | undefined;

  const fromTarget = pickRowAuthor({
    name: textValue(target?.name) || textValue(target?.nameHi) || textValue(target?.fullName) || textValue(target?.nameEn),
    image_url: textValue(target?.imageUrl) || textValue(target?.image_url) || textValue(target?.avatarUrl),
    designation: textValue(target?.printDesignation) || textValue(target?.post),
    location: textValue(target?.printPlaceName) || textValue(target?.place) || textValue(target?.district) || textValue(extended.city),
  });

  if (fromTarget) return [fromTarget];

  const fallback = pickRowAuthor({
    name: extended.editorial_author_name,
    image_url: extended.editorial_author_image_url,
    designation: extended.editorial_author_designation,
    city: extended.city,
  });

  return fallback ? [fallback] : [];
};
