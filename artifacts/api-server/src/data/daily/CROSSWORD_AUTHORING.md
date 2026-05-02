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

## Intersection validation checklist

For every cell that is part of both an across and a down answer, confirm the
letter matches. Work through each crossing systematically before committing.

## Adding a new puzzle

1. Validate every crossing manually (or with a spreadsheet).
2. Add a new object to `crossword.json` with a unique `id` and `date`
   (`"YYYY-MM-DD"` format, matching the id suffix).
3. The seeder inserts only rows whose `id` is not already in the database, so
   re-running is safe.
4. Verify locally at `/daily/crossword` before publishing.

## Removing a broken puzzle

To purge a bad puzzle from production, add its `id` to the `STALE_IDS` list in
`artifacts/api-server/src/lib/seedDaily.ts`. The seeder deletes those rows on
every server start before inserting fresh content.
