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
import starCrossedJson from "./star-crossed.json" with { type: "json" };
import reelConnectionsJson from "./reel-connections.json" with { type: "json" };

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

/**
 * A song or title may be a plain string (canonical name) or `[canonical, ...aliases]`
 * to accept regional/alternate names — e.g.
 * `["Harry Potter and the Philosopher's Stone", "Harry Potter and the Sorcerer's Stone"]`.
 * The canonical (first) entry is the display name; all entries are accepted as guesses.
 */
export type SongEntry = string | string[];
export type TitleEntry = string | string[];

export interface ArtistSongs {
  id: string;
  name: string;
  songs: SongEntry[];
}

export interface ActorFilmography {
  id: string;
  name: string;
  titles: TitleEntry[];
}

export function entryCanonical(e: SongEntry | TitleEntry): string {
  return Array.isArray(e) ? (e[0] ?? "") : e;
}

export function entryVariants(e: SongEntry | TitleEntry): string[] {
  return Array.isArray(e) ? e.filter((v): v is string => typeof v === "string") : [e];
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

/** A pair of actors and the projects they appeared in together (for Star-Crossed mode). */
export interface StarCrossedActor {
  id: string;
  name: string;
}

/**
 * A 3×3 Star-Crossed grid. `rowActors` and `colActors` are length 3; `cells` is
 * indexed `[row][col]` and holds the canonical titles where both actors appeared
 * together. Each title may be a `TitleEntry` (string or `[canonical, ...aliases]`).
 */
export interface StarCrossedGrid {
  id: string;
  label: string;
  rowActors: StarCrossedActor[];
  colActors: StarCrossedActor[];
  cells: TitleEntry[][][];
}

export const STAR_CROSSED_GRIDS: StarCrossedGrid[] = starCrossedJson as StarCrossedGrid[];

export interface ReelConnectionsSeed {
  id: string;
  date: string;
  /** JSON-encoded string[] (length 6) */
  actors: string;
  /** JSON-encoded string[][] (length 5) — each inner array is the accepted titles for that connection */
  validAnswers: string;
}

export const REEL_CONNECTIONS_SEED: ReelConnectionsSeed[] = reelConnectionsJson as ReelConnectionsSeed[];
