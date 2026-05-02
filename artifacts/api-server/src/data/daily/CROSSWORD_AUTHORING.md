# Mini Crossword Authoring Guide

## Grid format

Puzzles are stored in `crossword.json` as an array of puzzle objects. Each
puzzle is a 5 × 5 grid. Every field that holds an array is stored as a
**JSON-encoded string** (not an inline array) so it matches the database TEXT
column type.

### Black-square layout

Black squares must be represented in **two** places:

1. **`grid`** — the cell value is an empty string `""`.
2. **`blackSquares`** — a `[row, col]` pair in the list.

Keep both in sync or the renderer will misbehave.

### Recommended corner layout (what the current puzzle uses)

```
■ · · · ■
· · · · ·
· · · · ·
· · · · ·
■ · · · ■
```

Blacks at `[0,0]`, `[0,4]`, `[4,0]`, `[4,4]`. This gives:

- Three 5-letter across answers (rows 1–3)
- One 3-letter across answer capped by each black corner (rows 0 and 4)
- Three 5-letter down answers (cols 1–3)
- One 3-letter down answer capped by each black corner (cols 0 and 4)

## Cell numbering rules

The renderer numbers cells left-to-right, top-to-bottom, incrementing a single
counter. A cell receives a number when **either** condition is true:

- It starts an **across** run: `col === 0` **or** the cell to its left is black.
- It starts a **down** run: `row === 0` **or** the cell above it is black.

Black cells are skipped entirely.

### Example numbers for the corner layout

| Position | Number | Starts         |
| -------- | ------ | -------------- |
| [0,1]    | 1      | across + down  |
| [0,2]    | 2      | down only      |
| [0,3]    | 3      | down only      |
| [1,0]    | 4      | across + down  |
| [1,4]    | 5      | down only      |
| [2,0]    | 6      | across only    |
| [3,0]    | 7      | across only    |
| [4,1]    | 8      | across only    |

## Clue keys

Clue keys **must** be the stringified cell number: `"1"`, `"4"`, etc.
The length hint `(N)` at the end of each clue text is required.

```json
"cluesAcross": "{\"1\":\"...(3)\",\"4\":\"...(5)\"}",
"cluesDown":   "{\"1\":\"...(5)\",\"2\":\"...(5)\"}"
```

## Intersection validation — worked example

The puzzle shipped on 2026-05-02 uses the following grid:

```
  col: 0  1  2  3  4
row 0:  ■  T  I  E  ■
row 1:  H  O  R  S  Y
row 2:  I  R  A  T  E
row 3:  T  U  N  E  S
row 4:  ■  S  I  R  ■
```

**Across answers:** TIE (1), HORSY (4), IRATE (6), TUNES (7), SIR (8)  
**Down answers:** TORUS (1), IRANI (2), ESTER (3), HIT (4), YES (5)

Every white cell belongs to exactly one across run and one down run. The letter
must match in both directions:

| Cell   | Across (answer, pos) | Down (answer, pos) | Letter |
| ------ | -------------------- | ------------------ | ------ |
| [0, 1] | TIE pos 0            | TORUS pos 0        | T ✓    |
| [0, 2] | TIE pos 1            | IRANI pos 0        | I ✓    |
| [0, 3] | TIE pos 2            | ESTER pos 0        | E ✓    |
| [1, 0] | HORSY pos 0          | HIT pos 0          | H ✓    |
| [1, 1] | HORSY pos 1          | TORUS pos 1        | O ✓    |
| [1, 2] | HORSY pos 2          | IRANI pos 1        | R ✓    |
| [1, 3] | HORSY pos 3          | ESTER pos 1        | S ✓    |
| [1, 4] | HORSY pos 4          | YES pos 0          | Y ✓    |
| [2, 0] | IRATE pos 0          | HIT pos 1          | I ✓    |
| [2, 1] | IRATE pos 1          | TORUS pos 2        | R ✓    |
| [2, 2] | IRATE pos 2          | IRANI pos 2        | A ✓    |
| [2, 3] | IRATE pos 3          | ESTER pos 2        | T ✓    |
| [2, 4] | IRATE pos 4          | YES pos 1          | E ✓    |
| [3, 0] | TUNES pos 0          | HIT pos 2          | T ✓    |
| [3, 1] | TUNES pos 1          | TORUS pos 3        | U ✓    |
| [3, 2] | TUNES pos 2          | IRANI pos 3        | N ✓    |
| [3, 3] | TUNES pos 3          | ESTER pos 3        | E ✓    |
| [3, 4] | TUNES pos 4          | YES pos 2          | S ✓    |
| [4, 1] | SIR pos 0            | TORUS pos 4        | S ✓    |
| [4, 2] | SIR pos 1            | IRANI pos 4        | I ✓    |
| [4, 3] | SIR pos 2            | ESTER pos 4        | R ✓    |

All 21 intersections verified. Build a table like this for every new puzzle
before committing it.

## Adding a new puzzle

1. Fill the grid on paper or a spreadsheet first.
2. Build the full intersection table (see above) and verify every cell matches.
3. Add a new object to `crossword.json` with a unique `id` and `date`
   (`"YYYY-MM-DD"` format, id suffix must match date).
4. The seeder inserts only rows whose `id` is not already in the database, so
   re-running on start is safe.
5. Verify locally at `/daily/crossword` before publishing.

## Removing / retracting a broken puzzle

### Permanent removal (recommended)

1. Remove the entry from `crossword.json`.
2. Add the bad puzzle's `id` to the `STALE_CROSSWORD_IDS` array in
   `artifacts/api-server/src/lib/seedDaily.ts`. The seeder deletes those rows
   on every server start so they are purged from production on the next deploy.

### Temporary kill-switch (hide without deleting)

If you need to hide the crossword tile on the home/archive pages immediately
without touching the database, set the env variable:

```
DISABLE_CROSSWORD=true
```

The home page and archive check this flag and omit the crossword card when it
is set. Remove the flag once a replacement puzzle is ready and deployed.

> Note: the `DISABLE_CROSSWORD` env-var kill-switch is a planned escape hatch;
> wire it up in `home.tsx` and the archive route if you need it.
