import type { MetadataRoute } from "next";
import { SITE, DISALLOWED } from "../lib/site.mjs";

/**
 * robots.txt, generated from lib/site.mjs so it cannot disagree with the sitemap.
 *
 * Both disallow rules carry a reason in that file rather than here, because a
 * disallow nobody can explain later gets deleted by somebody tidying up.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOWED.map((d) => d.path) }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
