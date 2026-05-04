import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import app from "../app";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe("GET /api/daily/clock-it", () => {
  it("returns a puzzle with an id, date, year, and three hints", async () => {
    const res = await fetch(`${baseUrl}/daily/clock-it`);
    expect(res.status).toBe(200);

    const body = await res.json() as { id: string; date: string; year: number; hints: unknown };
    expect(typeof body.id).toBe("string");
    expect(typeof body.date).toBe("string");
    expect(typeof body.year).toBe("number");
    expect(Array.isArray(body.hints)).toBe(true);
    expect((body.hints as string[]).length).toBe(3);
  });

  it("returns a year in valid calendar range (1950–2099)", async () => {
    const res = await fetch(`${baseUrl}/daily/clock-it`);
    const body = await res.json() as { year: number };
    expect(body.year).toBeGreaterThanOrEqual(1950);
    expect(body.year).toBeLessThanOrEqual(2099);
  });
});

describe("POST /api/daily/clock-it/check — give-up flow", () => {
  it("returns the puzzle year from GET when giveUp is true for today's puzzle", async () => {
    const getRes = await fetch(`${baseUrl}/daily/clock-it`);
    const puzzle = await getRes.json() as { id: string; year: number };

    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puzzle.id, giveUp: true }),
    });
    expect(checkRes.status).toBe(200);

    const body = await checkRes.json() as { correct: boolean; year: number };
    expect(body.correct).toBe(false);
    // The year in the give-up response must exactly match what the GET endpoint
    // returns — this is the contract that makes the failure card show the right year.
    expect(body.year).toBe(puzzle.year);
  });

  it("returns the exact known year for a deterministic historical date (2026-01-15 → 2007)", async () => {
    // The puzzle selection counts days since 2024-01-01 and cycles through the
    // puzzle list. 2026-01-15 is day 745 since epoch; 745 % 104 = 17, which is
    // the gty-2007 puzzle (year 2007). This assertion pins the contract so any
    // future change to selectPuzzle that breaks determinism is caught immediately.
    const testDate = "2026-01-15";
    const expectedYear = 2007;

    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: testDate, giveUp: true }),
    });
    expect(checkRes.status).toBe(200);

    const body = await checkRes.json() as { correct: boolean; year: number };
    expect(body.correct).toBe(false);
    expect(body.year).toBe(expectedYear);
  });
});

describe("POST /api/daily/clock-it/check — success guess flow", () => {
  it("returns correct:true and the same year as GET when guess matches", async () => {
    const getRes = await fetch(`${baseUrl}/daily/clock-it`);
    const puzzle = await getRes.json() as { id: string; year: number };

    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puzzle.id, guess: puzzle.year }),
    });
    expect(checkRes.status).toBe(200);

    const body = await checkRes.json() as { correct: boolean; year?: number };
    expect(body.correct).toBe(true);
    // year must be present and match the puzzle year so the success card shows it.
    expect(body.year).toBe(puzzle.year);
  });

  it("returns correct:true and exact known year for historical date (2026-01-15 → 2007)", async () => {
    const testDate = "2026-01-15";
    const expectedYear = 2007;

    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: testDate, guess: expectedYear }),
    });
    expect(checkRes.status).toBe(200);

    const body = await checkRes.json() as { correct: boolean; year?: number };
    expect(body.correct).toBe(true);
    expect(body.year).toBe(expectedYear);
  });

  it("returns correct:false and no year when the guess is wrong", async () => {
    const getRes = await fetch(`${baseUrl}/daily/clock-it`);
    const puzzle = await getRes.json() as { id: string; year: number };

    const wrongYear = puzzle.year === 2000 ? 1999 : 2000;
    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puzzle.id, guess: wrongYear }),
    });
    expect(checkRes.status).toBe(200);

    const body = await checkRes.json() as { correct: boolean; year?: number };
    expect(body.correct).toBe(false);
    // year must NOT be exposed on a wrong guess — prevents cheating.
    expect(body.year).toBeUndefined();
  });

  it("returns 400 for an invalid id", async () => {
    const checkRes = await fetch(`${baseUrl}/daily/clock-it/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "not-a-date", guess: 2000 }),
    });
    expect(checkRes.status).toBe(400);
  });
});
