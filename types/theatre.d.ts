/**
 * Types for the scroll theatre's arithmetic module, which is plain .mjs so
 * `node --test` can run it with no build step.
 *
 * Same arrangement as types/corpus.d.ts, and the same reason: a mutation aimed
 * at a type is invisible to a runtime suite and the compiler catches it one gate
 * earlier. The caps in particular are worth a type — `shardDrift` returning
 * anything but these three numbers is a silent change in what the wordmark does.
 */

declare module "*/theatre.mjs" {
  export function rng(seed: number): () => number;
  export function beatAt(progress: number, beats: number): { index: number; within: number };
  export function stripeWidth(within: number, max?: number): number;
  export function shards(
    seed: number,
    count?: number,
    jag?: number,
    steps?: number,
  ): Array<Array<[number, number]>>;
  export function toPolygon(points: Array<[number, number]>): string;
  export function shardDrift(
    index: number,
    count: number,
    within: number,
    seedFn?: () => number,
  ): { x: number; y: number; rotate: number };
  export const MAX_DRIFT_PERCENT: number;
}

/**
 * The always-delivered path. Typed here for the same reason as theatre.mjs: it
 * is plain .mjs so `node --test` can render it with no transform, and the
 * compiler is what keeps its props honest against the .tsx that calls it.
 */
declare module "*/plain.mjs" {
  export function PlainTheatre(props: {
    beats: Array<{
      ground: string;
      ink: string;
      art?: unknown;
      copy?: unknown;
      wipe?: boolean;
      shatter?: string;
    }>;
    className?: string;
  }): JSX.Element;
  export default PlainTheatre;
}
