import { Router, type IRouter } from "express";
import { db, popQuestionPromptsTable, roastQuestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/questions/pop-the-question", async (_req, res): Promise<void> => {
  const prompts = await db
    .select()
    .from(popQuestionPromptsTable)
    .where(eq(popQuestionPromptsTable.isActive, true));

  res.json(prompts);
});

router.get("/questions/roast-roulette", async (_req, res): Promise<void> => {
  const questions = await db
    .select()
    .from(roastQuestionsTable)
    .where(eq(roastQuestionsTable.isActive, true));

  res.json(questions);
});

export default router;
