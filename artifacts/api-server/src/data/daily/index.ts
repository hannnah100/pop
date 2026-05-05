// Bundled archive content for the Daily Three Flops, Mini Crossword, and
// Pop Box games. This is the source of truth for what shows up on the
// published site's Archive page — it gets seeded into the database on server
// startup (idempotently) so production has the same library of challenges as
// dev.
//
// To add a new daily challenge: edit the JSON files in this folder and
// republish. The seeder only inserts rows whose `id` is not already present,
// so it is safe to re-run.

import threeFlopsJson from "./three-flops.json" with { type: "json" };
import crosswordJson from "./crossword.json" with { type: "json" };
import popBoxJson from "./pop-box.json" with { type: "json" };
import popBoxCategoriesJson from "./pop-box-categories.json" with { type: "json" };
import popBoxCelebritiesJson from "./pop-box-celebrities.json" with { type: "json" };
import artistSongsJson from "./artist-songs.json" with { type: "json" };
import actorFilmographyJson from "./actor-filmography.json" with { type: "json" };

export interface ThreeFlopsSeed {
  id: string;
  date: string;
  title: string;
  prompt: string;
  totalCount: number;
  /** JSON-encoded ThreeFlopsAnswer[] — stored as TEXT in the DB. */
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

export interface PopBoxSeed {
  id: string;
  date: string;
  difficulty: string;
  /** "celebrity-categories" (default) | "artist-alphabet" | "actor-alphabet" */
  mode?: string;
  /** JSON-encoded string[] — letter groups for alphabet modes, category IDs otherwise */
  rowCategoryIds: string;
  /** JSON-encoded string[] — artist/actor IDs for alphabet modes, category IDs otherwise */
  columnCategoryIds: string;
}

export interface ArtistSongs {
  id: string;
  name: string;
  songs: string[];
}

export interface ActorFilmography {
  id: string;
  name: string;
  titles: string[];
}

export interface PopBoxCategory {
  id: string;
  label: string;
  group: string;
}

export interface PopBoxCelebrity {
  id: string;
  name: string;
  alternateNames: string[];
  categories: string[];
}

export const THREE_FLOPS_SEED: ThreeFlopsSeed[] = threeFlopsJson as ThreeFlopsSeed[];
export const CROSSWORD_SEED: CrosswordSeed[] = crosswordJson as CrosswordSeed[];
export const POP_BOX_SEED: PopBoxSeed[] = popBoxJson as PopBoxSeed[];
export const POP_BOX_CATEGORIES: PopBoxCategory[] = popBoxCategoriesJson as PopBoxCategory[];
export const POP_BOX_CELEBRITIES: PopBoxCelebrity[] = popBoxCelebritiesJson as PopBoxCelebrity[];
export const ARTIST_SONGS: ArtistSongs[] = artistSongsJson as ArtistSongs[];
export const ACTOR_FILMOGRAPHY: ActorFilmography[] = actorFilmographyJson as ActorFilmography[];
