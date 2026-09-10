/**
 * The site's own URL, in ONE place.
 *
 * It was in `app/layout.tsx` as a local constant, and the moment robots.txt and
 * a sitemap arrived it would have been in three places with nothing comparing
 * them. This project's own rule about a list written twice applies to a string
 * written twice: the question is never whether the copies agree today, it is what
 * compares them.
 *
 * It also has history worth keeping. This was
 * `https://proof-studio.vercel.app`, a domain owned by an UNRELATED Vercel
 * account serving an app titled "Portfolio". Measured 2026-09-10: curl returns
 * 200 and 400 bytes of somebody else's site. It was the canonical link, the
 * og:image host and the JSON-LD url, so all three were telling search engines
 * that this page's content belongs to a stranger's domain. A canonical pointing
 * somewhere you do not control is the one meta tag that can actively hand your
 * pages away.
 *
 * A custom domain is the real fix and it is a purchase rather than a code change.
 * When it arrives, change it HERE and robots, the sitemap, the canonical, the
 * og:image and the JSON-LD all follow.
 */
export const SITE = process.env.PROOF_SITE_URL || "https://proof-studio-yuvrajrobotics-4330s-projects.vercel.app";

/**
 * Every page that should be indexed, with how often it really changes.
 *
 * `/welcome` is deliberately ABSENT and is noindex in its own metadata: its URL
 * carries a checkout session id, so listing it in a sitemap would invite a
 * crawler to fetch somebody's receipt.
 */
export const INDEXABLE = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/rulebook", changeFrequency: "monthly", priority: 0.8 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
];

/** Paths that must never be indexed, with the reason each one is on the list. */
export const DISALLOWED = [
  { path: "/welcome", why: "the URL carries a checkout session id" },
  { path: "/api/", why: "endpoints, not pages, and one of them takes a signed webhook" },
];

/**
 * The npx target for the MCP server, or null when it is not published yet.
 *
 * THIS IS A NULL FOR A REASON. `/welcome` was handing paying customers
 * `npx -y github:Yuve21/proof-team-mcp`, and that repository does not exist, so
 * the command fails. Telling somebody who has just paid to run a command that
 * cannot work is the same defect as the apply form posting to example.com: it
 * looks finished and it is not.
 *
 * So the install block is CONDITIONAL. Until this is set, the welcome page says
 * the licence is ready and the install line is coming, which is true, instead of
 * printing a command that fails. Set PROOF_MCP_PACKAGE the moment the package is
 * published and the block appears everywhere at once.
 */
export const MCP_PACKAGE = process.env.PROOF_MCP_PACKAGE || null;

/** The full install command, or null when there is nothing honest to print. */
export const mcpInstallLine = (token) =>
  MCP_PACKAGE ? `claude mcp add proof --env PROOF_LICENCE=${token} -- npx -y ${MCP_PACKAGE}` : null;

