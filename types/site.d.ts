declare module "*/lib/site.mjs" {
  export const SITE: string;
  export const INDEXABLE: Array<{ path: string; changeFrequency: string; priority: number }>;
  export const DISALLOWED: Array<{ path: string; why: string }>;
}
