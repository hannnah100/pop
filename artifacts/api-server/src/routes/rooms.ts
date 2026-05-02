import { Router, type IRouter } from "express";
import { createRoom, rooms } from "../socket/events";
import { CreateRoomBody, CreateRoomResponse, GetRoomResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/rooms/create", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const roomCode = createRoom(parsed.data.gameType);

  const data = CreateRoomResponse.parse({
    roomCode,
    gameType: parsed.data.gameType,
  });

  res.json(data);
});

router.get("/rooms/:code", async (req, res): Promise<void> => {
  const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const code = rawCode?.toUpperCase();

  if (!code) {
    res.status(400).json({ error: "Invalid room code" });
    return;
  }

  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const data = GetRoomResponse.parse({
    code: room.code,
    gameType: room.gameType,
    status: room.status,
    playerCount: room.players.length,
  });

  res.json(data);
});

export default router;
