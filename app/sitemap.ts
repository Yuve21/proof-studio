import type { MetadataRoute } from "next";
import { SITE, INDEXABLE } from "../lib/site.mjs";

/**
 * The sitemap, generated from the same list robots.txt reads.
 *
 * `/welcome` is absent on purpose: its URL carries a checkout session id, so
 * listing it would invite a crawler to fetch somebody's receipt. A test asserts
 * it stays absent, because "we left it out" is exactly the kind of intention that
 * evaporates when the next route is added.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return INDEXABLE.map((page) => ({
    url: `${SITE}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: page.priority,
  }));
}
