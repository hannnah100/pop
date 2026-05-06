import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  customJeopardyPacksTable,
  customWofPacksTable,
  customQuizPacksTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const OWNER_ID_HEADER = "x-owner-id";

function getOwnerId(req: Request): string | null {
  const id = req.headers[OWNER_ID_HEADER];
  if (!id || typeof id !== "string") return null;
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return id;
}

// ============================================================
// Jeopardy Clue / Category schemas (mirrors JeopardyPack type)
// ============================================================

const JeopardyClueSchema = z.object({
  value: z.number(),
  question: z.string().min(1),
  answer: z.string().min(1),
  acceptedAnswers: z.array(z.string()).optional(),
  isDailyDouble: z.boolean().optional(),
});

const JeopardyCategorySchema = z.object({
  name: z.string().min(1),
  clues: z.array(JeopardyClueSchema).length(5),
});

const JeopardyFinalClueSchema = z.object({
  category: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  acceptedAnswers: z.array(z.string()).optional(),
});

const JeopardyPackPayloadSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  categories: z.array(JeopardyCategorySchema).length(6),
  final: JeopardyFinalClueSchema,
}).refine(
  (data) => {
    const ddCount = data.categories.reduce(
      (total, cat) => total + cat.clues.filter((c) => c.isDailyDouble === true).length,
      0,
    );
    return ddCount === 2;
  },
  { message: "A custom Jeopardy pack must have exactly 2 Daily Double clues" },
);

// ============================================================
// WoF Puzzle schema (mirrors WofPack type)
// ============================================================

const WofPuzzleSchema = z.object({
  answer: z.string().min(1),
  category: z.string().min(1),
  hint: z.string().optional(),
});

const WofPackPayloadSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  puzzles: z.array(WofPuzzleSchema).min(3).max(50),
});

// ============================================================
// Pub Quiz schemas (mirrors QuizPack type)
// ============================================================

const McQuestionSchema = z.object({
  type: z.literal("multiple-choice"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  doublePoints: z.boolean().optional(),
});

const OeQuestionSchema = z.object({
  type: z.literal("open-ended"),
  prompt: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  doublePoints: z.boolean().optional(),
});

const TfQuestionSchema = z.object({
  type: z.literal("true-false"),
  prompt: z.string().min(1),
  answer: z.boolean(),
  doublePoints: z.boolean().optional(),
});

const QuizQuestionSchema = z.discriminatedUnion("type", [
  McQuestionSchema,
  OeQuestionSchema,
  TfQuestionSchema,
]);

const QuizRoundSchema = z.object({
  name: z.string().min(1),
  roundType: z.enum(["multiple-choice", "open-ended", "true-false"]),
  questions: z.array(QuizQuestionSchema).min(5).max(20),
});

const QuizPackPayloadSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  rounds: z.array(QuizRoundSchema).min(3).max(7),
});

// ============================================================
// Helper: 404 response
// ============================================================
function notFound(res: Response) {
  res.status(404).json({ error: "Not found" });
}
function forbidden(res: Response) {
  res.status(403).json({ error: "Forbidden" });
}
function badOwner(res: Response) {
  res.status(401).json({ error: "Missing or invalid x-owner-id header" });
}

// ============================================================
// Jeopardy CRUD
// ============================================================

router.get("/custom-games/jeopardy/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const [row] = await db.select().from(customJeopardyPacksTable).where(and(eq(customJeopardyPacksTable.id, id), eq(customJeopardyPacksTable.ownerId, ownerId)));
  if (!row) { notFound(res); return; }
  res.json({ id: row.id, title: row.title, payload: row.payload, createdAt: row.createdAt, updatedAt: row.updatedAt });
});

router.get("/custom-games/jeopardy", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const rows = await db.select().from(customJeopardyPacksTable).where(eq(customJeopardyPacksTable.ownerId, ownerId));
  res.json(rows.map((r) => ({ id: r.id, title: r.title, payload: r.payload, createdAt: r.createdAt, updatedAt: r.updatedAt })));
});

router.post("/custom-games/jeopardy", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const parsed = JeopardyPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customJeopardyPacksTable).values({ ownerId, title: parsed.data.title, payload: parsed.data }).returning();
  res.status(201).json(row);
});

router.put("/custom-games/jeopardy/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customJeopardyPacksTable).where(and(eq(customJeopardyPacksTable.id, id), eq(customJeopardyPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  const parsed = JeopardyPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(customJeopardyPacksTable).set({ title: parsed.data.title, payload: parsed.data, updatedAt: new Date() }).where(eq(customJeopardyPacksTable.id, id)).returning();
  res.json(row);
});

router.delete("/custom-games/jeopardy/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customJeopardyPacksTable).where(and(eq(customJeopardyPacksTable.id, id), eq(customJeopardyPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  await db.delete(customJeopardyPacksTable).where(eq(customJeopardyPacksTable.id, id));
  res.status(204).send();
});

// ============================================================
// Wheel of Fortune CRUD
// ============================================================

router.get("/custom-games/wof/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const [row] = await db.select().from(customWofPacksTable).where(and(eq(customWofPacksTable.id, id), eq(customWofPacksTable.ownerId, ownerId)));
  if (!row) { notFound(res); return; }
  res.json({ id: row.id, title: row.title, payload: row.payload, createdAt: row.createdAt, updatedAt: row.updatedAt });
});

router.get("/custom-games/wof", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const rows = await db.select().from(customWofPacksTable).where(eq(customWofPacksTable.ownerId, ownerId));
  res.json(rows.map((r) => ({ id: r.id, title: r.title, payload: r.payload, createdAt: r.createdAt, updatedAt: r.updatedAt })));
});

router.post("/custom-games/wof", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const parsed = WofPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customWofPacksTable).values({ ownerId, title: parsed.data.title, payload: parsed.data }).returning();
  res.status(201).json(row);
});

router.put("/custom-games/wof/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customWofPacksTable).where(and(eq(customWofPacksTable.id, id), eq(customWofPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  const parsed = WofPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(customWofPacksTable).set({ title: parsed.data.title, payload: parsed.data, updatedAt: new Date() }).where(eq(customWofPacksTable.id, id)).returning();
  res.json(row);
});

router.delete("/custom-games/wof/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customWofPacksTable).where(and(eq(customWofPacksTable.id, id), eq(customWofPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  await db.delete(customWofPacksTable).where(eq(customWofPacksTable.id, id));
  res.status(204).send();
});

// ============================================================
// Pub Quiz CRUD
// ============================================================

router.get("/custom-games/quiz/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const [row] = await db.select().from(customQuizPacksTable).where(and(eq(customQuizPacksTable.id, id), eq(customQuizPacksTable.ownerId, ownerId)));
  if (!row) { notFound(res); return; }
  res.json({ id: row.id, title: row.title, payload: row.payload, createdAt: row.createdAt, updatedAt: row.updatedAt });
});

router.get("/custom-games/quiz", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const rows = await db.select().from(customQuizPacksTable).where(eq(customQuizPacksTable.ownerId, ownerId));
  res.json(rows.map((r) => ({ id: r.id, title: r.title, payload: r.payload, createdAt: r.createdAt, updatedAt: r.updatedAt })));
});

router.post("/custom-games/quiz", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const parsed = QuizPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customQuizPacksTable).values({ ownerId, title: parsed.data.title, payload: parsed.data }).returning();
  res.status(201).json(row);
});

router.put("/custom-games/quiz/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customQuizPacksTable).where(and(eq(customQuizPacksTable.id, id), eq(customQuizPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  const parsed = QuizPackPayloadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(customQuizPacksTable).set({ title: parsed.data.title, payload: parsed.data, updatedAt: new Date() }).where(eq(customQuizPacksTable.id, id)).returning();
  res.json(row);
});

router.delete("/custom-games/quiz/:id", async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  if (!ownerId) { badOwner(res); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { notFound(res); return; }
  const existing = await db.select().from(customQuizPacksTable).where(and(eq(customQuizPacksTable.id, id), eq(customQuizPacksTable.ownerId, ownerId)));
  if (!existing[0]) { notFound(res); return; }
  await db.delete(customQuizPacksTable).where(eq(customQuizPacksTable.id, id));
  res.status(204).send();
});

export default router;
