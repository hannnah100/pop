import { Router, type IRouter } from "express";
import { db, playerNamesTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/player/name", async (req, res): Promise<void> => {
  const { playerToken, playerName } = req.body as {
    playerToken?: unknown;
    playerName?: unknown;
  };

  if (
    typeof playerToken !== "string" ||
    playerToken.length < 1 ||
    playerToken.length > 64 ||
    typeof playerName !== "string" ||
    playerName.trim().length < 1 ||
    playerName.trim().length > 20
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const name = playerName.trim();
  await db
    .insert(playerNamesTable)
    .values({ playerToken, playerName: name })
    .onConflictDoUpdate({
      target: playerNamesTable.playerToken,
      set: { playerName: name, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

export default router;
