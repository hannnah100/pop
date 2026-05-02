// Bundled archive content for the Daily Three Strikes and Mini Crossword
// games. This is the source of truth for what shows up on the published
// site's Archive page — it gets seeded into the database on server startup
// (idempotently) so production has the same library of challenges as dev.
//
// To add a new daily challenge: edit the JSON files in this folder and
// republish. The seeder only inserts rows whose `id` is not already present,
// so it is safe to re-run.

import threeStrikesJson from "./three-strikes.json" with { type: "json" };
import crosswordJson from "./crossword.json" with { type: "json" };

export interface ThreeStrikesSeed {
  id: string;
  date: string;
  title: string;
  prompt: string;
  totalCount: number;
  /** JSON-encoded ThreeStrikesAnswer[] — stored as TEXT in the DB. */
  answers: string;
}

export interface CrosswordSeed {
  id: string;
  date: string;
  /** JSON-encoded string[][] */
  grid: string;
  /** JSON-encoded [number, number][] */
  blackSquares: string;
  /** JSON-encoded Record<string, string> */
  cluesAcross: string;
  /** JSON-encoded Record<string, string> */
  cluesDown: string;
}

export const THREE_STRIKES_SEED: ThreeStrikesSeed[] = threeStrikesJson as ThreeStrikesSeed[];
export const CROSSWORD_SEED: CrosswordSeed[] = crosswordJson as CrosswordSeed[];
