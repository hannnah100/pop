import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../lib/logger";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  burns: number;
  roasts: number;
  guesses: number;
}

interface RoastCard {
  [color: string]: {
    author: string;
    answer: string;
    answerId: string;
  };
}

interface Room {
  code: string;
  gameType: "pop-the-question" | "roast-roulette";
  status: "lobby" | "playing" | "finished";
  hostId: string;
  players: Player[];
  questions: Array<{ text?: string; color?: string; question?: string }>;
  currentQuestionIndex: number;
  currentVotes: Record<string, string>;
  cards: Record<string, RoastCard>;
  currentRound: number;
  roundSubmissions: Set<string>;
  revealOrder: string[];
  currentRevealIndex: number;
  createdAt: number;
  lastActivity: number;
}

export const rooms = new Map<string, Room>();

const ROOM_WORDS = [
  "BUZZ", "ROFL", "YEET", "VIBE", "EPIC", "FLEX", "SLAY", "MOOD",
  "HYPE", "ZEST", "WILD", "BOLD", "GLOW", "PEAK", "FIRE", "GAME",
  "DASH", "COOL", "NOVA", "BLAZE", "ZOOM", "SNAP", "POP", "ZING",
];

function generateRoomCode(): string {
  const available = ROOM_WORDS.filter((w) => !rooms.has(w));
  if (available.length === 0) {
    // fallback: random 4-letter
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    do {
      code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } while (rooms.has(code));
    return code;
  }
  return available[Math.floor(Math.random() * available.length)];
}

const ROAST_COLORS = ["yellow", "blue", "red", "green", "purple", "orange", "gray"];

export function createRoom(gameType: "pop-the-question" | "roast-roulette"): string {
  const code = generateRoomCode();
  rooms.set(code, {
    code,
    gameType,
    status: "lobby",
    hostId: "",
    players: [],
    questions: [],
    currentQuestionIndex: 0,
    currentVotes: {},
    cards: {},
    currentRound: 0,
    roundSubmissions: new Set(),
    revealOrder: [],
    currentRevealIndex: 0,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  });
  return code;
}

// Cleanup stale rooms every 30 minutes
setInterval(() => {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > TWO_HOURS) {
      rooms.delete(code);
      logger.info({ code }, "Deleted stale room");
    }
  }
}, 30 * 60 * 1000);

const POP_QUESTIONS = [
  "Most likely to become a reality TV star",
  "Most likely to cry during a Pixar movie",
  "Worst Spotify Wrapped of the group",
  "Most likely to quote TikTok sounds in real life",
  "Would survive longest in a horror movie",
  "Most likely to text their ex",
  "Belongs on Love Island",
  "Has the most unhinged Netflix watch history",
  "Most likely to go viral for the wrong reasons",
  "Main character energy (derogatory)",
  "Most likely to sleep through their alarm",
  "Would get voted off a reality show first",
  "Most chronically online",
  "Takes the longest to get ready",
  "Most likely to fall in love with someone they just met",
];

const ROAST_QUESTIONS_BANK = [
  "What's their most embarrassing Spotify playlist?",
  "What would their drunk tattoo be?",
  "Which reality show would they get kicked off first?",
  "What's their worst dating app bio?",
  "What sitcom character are they?",
  "What's their secret toxic trait?",
  "What would they be famous for?",
  "What's the worst thing in their search history?",
  "Which Disney villain are they?",
  "What's their karaoke go-to song?",
  "What's their most unhinged take?",
  "Which rom-com trope are they?",
  "What's their celebrity doppelganger?",
  "What's their biggest irrational fear?",
  "What would their memoir be titled?",
];

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-room", ({ roomCode, playerName, isHost }: { roomCode: string; playerName: string; isHost: boolean }) => {
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit("error", { message: "Room not found. Check your code and try again." });
        return;
      }

      socket.join(roomCode);
      room.lastActivity = Date.now();

      // Remove any existing player with this socket id
      room.players = room.players.filter((p) => p.id !== socket.id);

      const player: Player = {
        id: socket.id,
        name: playerName,
        isHost: isHost || false,
        score: 0,
        burns: 0,
        roasts: 0,
        guesses: 0,
      };

      room.players.push(player);

      if (isHost) {
        room.hostId = socket.id;
      }

      io.to(roomCode).emit("player-joined", {
        player,
        players: room.players,
      });

      // Send current room state to newly joined player
      socket.emit("room-state", {
        status: room.status,
        gameType: room.gameType,
        players: room.players,
        currentQuestion: room.questions[room.currentQuestionIndex],
        questionIndex: room.currentQuestionIndex,
      });
    });

    socket.on("start-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      room.status = "playing";
      room.currentQuestionIndex = 0;
      room.currentVotes = {};

      if (room.gameType === "pop-the-question") {
        // Shuffle questions
        const shuffled = [...POP_QUESTIONS].sort(() => Math.random() - 0.5);
        room.questions = shuffled.map((q) => ({ text: q }));

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          question: room.questions[0]?.text,
          questionIndex: 0,
          totalQuestions: room.questions.length,
        });
      } else if (room.gameType === "roast-roulette") {
        const nonHostPlayers = room.players.filter((p) => !p.isHost);
        const numQuestions = nonHostPlayers.length - 1;
        const colors = ROAST_COLORS.slice(0, numQuestions);
        const shuffledQ = [...ROAST_QUESTIONS_BANK].sort(() => Math.random() - 0.5);
        room.questions = colors.map((color, i) => ({
          color,
          question: shuffledQ[i] ?? `Question ${i + 1}`,
        }));

        // Initialize cards for each non-host player
        nonHostPlayers.forEach((p) => {
          room.cards[p.id] = {};
        });

        room.currentRound = 1;
        room.roundSubmissions = new Set();

        // Assign first round targets (round-robin)
        const assignments = assignRoastTargets(nonHostPlayers, 1);

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          questions: room.questions,
          players: nonHostPlayers,
          currentRound: 1,
          totalRounds: numQuestions,
        });

        // Send individual assignments
        nonHostPlayers.forEach((player) => {
          const targetId = assignments[player.id];
          const target = nonHostPlayers.find((p) => p.id === targetId);
          io.to(player.id).emit("assign-card", {
            targetPlayerId: targetId,
            targetPlayerName: target?.name ?? "Unknown",
            round: 1,
          });
        });
      }
    });

    // Pop the Question: submit vote
    socket.on("submit-vote", ({ roomCode, votedForId }: { roomCode: string; votedForId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();

      room.currentVotes[socket.id] = votedForId;
      const nonHostCount = room.players.filter((p) => !p.isHost).length;
      const voteCount = Object.keys(room.currentVotes).length;

      io.to(roomCode).emit("vote-progress", {
        voted: voteCount,
        total: nonHostCount,
      });

      if (voteCount >= nonHostCount) {
        io.to(room.hostId).emit("all-votes-in");
      }
    });

    // Pop the Question: reveal results
    socket.on("reveal-results", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      const voteCounts: Record<string, number> = {};
      room.players.forEach((p) => { voteCounts[p.id] = 0; });
      Object.values(room.currentVotes).forEach((votedId) => {
        voteCounts[votedId] = (voteCounts[votedId] ?? 0) + 1;
      });

      room.players.forEach((player) => {
        player.burns += voteCounts[player.id] ?? 0;
      });

      io.to(roomCode).emit("results-revealed", {
        voteCounts,
        players: room.players,
        question: room.questions[room.currentQuestionIndex]?.text,
      });

      room.currentVotes = {};
    });

    // Pop the Question: next question
    socket.on("next-question", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      room.currentQuestionIndex++;
      room.currentVotes = {};

      if (room.currentQuestionIndex >= room.questions.length) {
        room.status = "finished";
        io.to(roomCode).emit("game-ended", {
          players: room.players,
          finalScores: room.players.map((p) => ({ id: p.id, name: p.name, burns: p.burns })),
        });
      } else {
        io.to(roomCode).emit("question-update", {
          question: room.questions[room.currentQuestionIndex]?.text,
          questionIndex: room.currentQuestionIndex,
          totalQuestions: room.questions.length,
        });
      }
    });

    // Pop the Question: end game
    socket.on("end-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      room.status = "finished";

      io.to(roomCode).emit("game-ended", {
        players: room.players,
        finalScores: room.players.map((p) => ({ id: p.id, name: p.name, burns: p.burns })),
      });
    });

    // Roast Roulette: submit roast
    socket.on("submit-roast", ({ roomCode, targetPlayerId, color, answer }: {
      roomCode: string;
      targetPlayerId: string;
      color: string;
      answer: string;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();

      if (!room.cards[targetPlayerId]) {
        room.cards[targetPlayerId] = {};
      }

      const answerId = `${socket.id}-${color}-${Date.now()}`;
      room.cards[targetPlayerId][color] = {
        author: socket.id,
        answer,
        answerId,
      };

      room.roundSubmissions.add(socket.id);

      const nonHostPlayers = room.players.filter((p) => !p.isHost);
      const submissionCount = room.roundSubmissions.size;

      io.to(roomCode).emit("submission-progress", {
        submitted: submissionCount,
        total: nonHostPlayers.length,
        round: room.currentRound,
      });

      if (submissionCount >= nonHostPlayers.length) {
        const totalRounds = room.questions.length;

        if (room.currentRound >= totalRounds) {
          // All rounds done — go to reveal phase
          room.status = "playing";
          const revealOrder = nonHostPlayers.map((p) => p.id);
          room.revealOrder = revealOrder;
          room.currentRevealIndex = 0;

          io.to(roomCode).emit("writing-complete", {
            message: "All roasts written! Time for reveals!",
          });

          setTimeout(() => {
            const firstRevealId = revealOrder[0];
            const firstPlayer = nonHostPlayers.find((p) => p.id === firstRevealId);
            io.to(roomCode).emit("start-reveals", {
              revealOrder,
              currentRevealId: firstRevealId,
              currentRevealName: firstPlayer?.name ?? "Unknown",
              card: room.cards[firstRevealId] ?? {},
              questions: room.questions,
            });
          }, 2000);
        } else {
          // Next round
          room.currentRound++;
          room.roundSubmissions = new Set();
          const assignments = assignRoastTargets(nonHostPlayers, room.currentRound);

          io.to(roomCode).emit("round-complete", {
            nextRound: room.currentRound,
            totalRounds,
          });

          nonHostPlayers.forEach((player) => {
            const targetId = assignments[player.id];
            const target = nonHostPlayers.find((p) => p.id === targetId);
            io.to(player.id).emit("assign-card", {
              targetPlayerId: targetId,
              targetPlayerName: target?.name ?? "Unknown",
              round: room.currentRound,
            });
          });
        }
      }
    });

    // Roast Roulette: pick favorite and guess author
    socket.on("pick-favorite", ({ roomCode, color, answerId, guessedPlayerId }: {
      roomCode: string;
      color: string;
      answerId: string;
      guessedPlayerId: string;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();

      // Find who is currently being revealed (the card owner is socket.id)
      const card = room.cards[socket.id];
      if (!card || !card[color]) return;

      const roastEntry = card[color];
      const actualAuthorId = roastEntry.author;
      const correct = actualAuthorId === guessedPlayerId;

      // Award points
      const author = room.players.find((p) => p.id === actualAuthorId);
      const guesser = room.players.find((p) => p.id === socket.id);

      if (author) author.roasts += 1;
      if (correct && guesser) guesser.guesses += 1;

      // Update scores
      room.players.forEach((p) => {
        p.score = p.burns + p.roasts + p.guesses;
      });

      const actualAuthor = room.players.find((p) => p.id === actualAuthorId);

      io.to(roomCode).emit("favorite-picked", {
        color,
        pickedByName: guesser?.name ?? "Unknown",
        actualAuthorName: actualAuthor?.name ?? "Unknown",
        guessedPlayerId,
        actualAuthorId,
        correct,
        players: room.players,
      });
    });

    // Roast Roulette: move to next reveal (host only)
    socket.on("next-reveal", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      room.currentRevealIndex++;
      const nonHostPlayers = room.players.filter((p) => !p.isHost);

      if (room.currentRevealIndex >= room.revealOrder.length) {
        room.status = "finished";
        io.to(roomCode).emit("game-ended", {
          players: room.players,
          finalScores: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            burns: p.burns,
            roasts: p.roasts,
            guesses: p.guesses,
            total: p.score,
          })),
        });
      } else {
        const nextRevealId = room.revealOrder[room.currentRevealIndex];
        const nextPlayer = nonHostPlayers.find((p) => p.id === nextRevealId);
        io.to(roomCode).emit("start-reveals", {
          revealOrder: room.revealOrder,
          currentRevealId: nextRevealId,
          currentRevealName: nextPlayer?.name ?? "Unknown",
          card: room.cards[nextRevealId] ?? {},
          questions: room.questions,
        });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");

      for (const [code, room] of rooms.entries()) {
        const idx = room.players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          io.to(code).emit("player-left", {
            playerId: socket.id,
            players: room.players,
          });

          if (room.players.length === 0) {
            rooms.delete(code);
          }
        }
      }
    });
  });

  return io;
}

// Round-robin card assignment: player at index i writes on player at index (i + round) % total
function assignRoastTargets(players: Player[], round: number): Record<string, string> {
  const assignments: Record<string, string> = {};
  players.forEach((player, i) => {
    const targetIndex = (i + round) % players.length;
    assignments[player.id] = players[targetIndex].id;
  });
  return assignments;
}
