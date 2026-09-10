/**
 * Types for the corpus and licence modules, which are plain .mjs so they can be
 * run directly by node and bundled into a CLI without a build step.
 *
 * These declarations are not decoration. The sibling product's LEARNINGS L-19
 * records that a mutation aimed at a TYPE is invisible to a runtime suite and is
 * caught one gate earlier by the compiler, so two lists that only the compiler
 * reconciles is a legitimate arrangement and is stronger than a test. Writing
 * `Severity` as a union here means a rule with a severity nobody defined fails
 * `npm run typecheck` at any call site that reads it, in addition to failing the
 * loader at runtime.
 */

declare module "*/corpus/seo-onpage.mjs" {
  export const CORPUS_ID: string;
  export const CORPUS_VERSION: string;
  export const collect: () => CorpusFacts;
  export const RULES: Rule[];
}

declare module "*/corpus/load.mjs" {
  export function loadCorpus(mod: unknown): LoadedCorpus;
  export class CorpusContractError extends Error {}
}

type Severity = "low" | "medium" | "high";

interface Evidence {
  selector: string;
  observed: string;
}

interface Rule {
  id: string;
  family: string;
  weight: number;
  severity: Severity;
  title: string;
  rationale: string;
  /** The published condition under which this rule is WRONG. Mandatory. */
  falsePositiveNote: string;
  prevention: string;
  since: string;
  detect: (facts: CorpusFacts) => Evidence[];
}

interface LoadedCorpus {
  id: string;
  version: string;
  rules: Rule[];
  collect: () => CorpusFacts;
}

interface CorpusFacts {
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  viewport: string | null;
  headings: Array<{ level: number; text: string; selector: string }>;
  images: Array<{ alt: string | null; src: string; selector: string }>;
  links: Array<{
    text: string;
    href: string;
    selector: string;
    hasImage: boolean;
    ariaLabel: string | null;
  }>;
  counts: {
    headings: number;
    images: number;
    links: number;
    bodyTextLength: number;
  };
}
