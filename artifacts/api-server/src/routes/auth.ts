import { Router, type IRouter } from "express";
import { db, usersTable, playerNamesTable, eq } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { isFirebaseAvailable } from "../lib/firebaseAdmin";

const router: IRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

function validateUsername(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const trimmed = u.trim();
  return USERNAME_RE.test(trimmed) ? trimmed : null;
}

/** GET /api/auth/me — returns the current user's profile, or 404 if not registered yet */
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  if (!isFirebaseAvailable()) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  res.json({ user });
});

/** POST /api/auth/register — create account with username (first-time sign-up) */
router.post("/auth/register", requireAuth, async (req, res): Promise<void> => {
  if (!isFirebaseAvailable()) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  const { username, authProvider } = req.body as { username?: unknown; authProvider?: unknown };
  const validUsername = validateUsername(username);

  if (!validUsername) {
    res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, _ or -" });
    return;
  }

  if (typeof authProvider !== "string" || !["google", "apple", "email"].includes(authProvider)) {
    res.status(400).json({ error: "Invalid authProvider" });
    return;
  }

  // Check username availability
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, validUsername))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing && existing.id !== req.userId) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  // Upsert user record
  const [user] = await db
    .insert(usersTable)
    .values({
      id: req.userId!,
      username: validUsername,
      email: req.userEmail ?? null,
      authProvider,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { username: validUsername, email: req.userEmail ?? null },
    })
    .returning();

  // Sync username → player_names so leaderboards show the username automatically
  await db
    .insert(playerNamesTable)
    .values({ playerToken: req.userId!, playerName: validUsername })
    .onConflictDoUpdate({
      target: playerNamesTable.playerToken,
      set: { playerName: validUsername, updatedAt: new Date() },
    });

  res.json({ user });
});

/** PUT /api/auth/username — update username */
router.put("/auth/username", requireAuth, async (req, res): Promise<void> => {
  if (!isFirebaseAvailable()) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  const { username } = req.body as { username?: unknown };
  const validUsername = validateUsername(username);

  if (!validUsername) {
    res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, _ or -" });
    return;
  }

  // Check username availability
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, validUsername))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing && existing.id !== req.userId) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ username: validUsername })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Keep player_names in sync
  await db
    .insert(playerNamesTable)
    .values({ playerToken: req.userId!, playerName: validUsername })
    .onConflictDoUpdate({
      target: playerNamesTable.playerToken,
      set: { playerName: validUsername, updatedAt: new Date() },
    });

  res.json({ user });
});

/** DELETE /api/auth/account — delete user account */
router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  if (!isFirebaseAvailable()) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, req.userId!));
  res.json({ ok: true });
});

export default router;
