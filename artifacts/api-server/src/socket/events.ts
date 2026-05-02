import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../lib/logger";
import {
  QUIZ_PACKS,
  getQuizPack,
  getRandomQuizPack,
} from "../data/quiz";
import {
  type QuizState,
  type PackSummary,
  buildReveal,
  clearTimer,
  getCurrentQuestion,
  getCurrentRound,
  isLastQuestionOfRound,
  isLastRound,
  judgeAnswer,
  leaderboardSorted,
  makeQuizState,
  packSummary,
  publicQuestionFromState,
  QUIZ_SCORING,
  QUIZ_TIMER_MS,
  resetForNextQuestion,
  scheduleBotQuizAnswers,
} from "./quiz";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  score: number;
  burns: number;
  roasts: number;
  guesses: number;
  /** ms since epoch — last time this player did anything (vote, type, etc). */
  lastActivity: number;
  /** Self-reported microphone-mute toggle from the player phone. */
  muted?: boolean;
}

interface HostSettingsBroadcast {
  answerMethod: "voice" | "text" | "both";
}

export type GameType = "pop-the-question" | "roast-roulette" | "pub-quiz";

interface RoastCard {
  [color: string]: {
    author: string;
    answer: string;
    answerId: string;
  };
}

interface Room {
  code: string;
  gameType: GameType;
  status: "lobby" | "playing" | "finished";
  hostId: string;
  isDemo: boolean;
  players: Player[];
  questions: Array<{ text?: string; color?: string; question?: string }>;
  currentQuestionIndex: number;
  currentVotes: Record<string, string>;
  cards: Record<string, RoastCard>;
  currentRound: number;
  roundSubmissions: Set<string>;
  revealOrder: string[];
  currentRevealIndex: number;
  botAssignments: Record<string, { targetId: string; colors: string[] }>;
  /** Pub-quiz state (only set when gameType === "pub-quiz" and game has started). */
  quiz?: QuizState;
  /** For pub-quiz host UI: the chosen pack id (set on createRoom or first start-game). */
  quizPackId?: string;
  createdAt: number;
  lastActivity: number;
  hostSettings: HostSettingsBroadcast;
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

const BOT_NAMES = ["Sarah", "Mike", "Alex", "Jordan", "Taylor"];

const ROAST_BANK = [
  "Definitely has a finsta",
  "Types 'lol' but never actually laughs",
  "Main character syndrome but supporting cast energy",
  "Would cry at a Pixar lamp",
  "Spotify Wrapped is just sad indie music",
  "Their personality is a love language quiz result",
  "Has a 'no drama' rule but creates 90% of it",
  "TikTok algorithm knows their soul better than they do",
  "Would survive 5 minutes in a horror movie, max",
  "Still brings up something that happened in 2019",
  "Their hot take is just a lukewarm take in a trench coat",
  "Orders something 'simple' at a coffee shop but it's 12 words long",
  "Would pitch a podcast but never start it",
  "Has 3 ongoing situationships right now",
  "Their villain era lasted exactly one week",
  "Gives 'gifted child who peaked in middle school' vibes",
  "Relates to every Myers-Briggs type depending on the day",
  "Would watch a 3-hour documentary about someone they already hate",
  "Their 'healing journey' has 14 new hobbies and zero therapy",
  "Would post 'no context' and provide zero context",
  "Has sent a voice note longer than most podcasts",
  "Thinks they're the only one who's ever heard of that band",
  "Their Roman Empire is a reality show elimination",
  "Would unironically use the word 'vibe check'",
  "Has a podcast recommendation for every mood but no actual advice",
  "Cries at commercials but says they're 'not an emotional person'",
  "Their sense of humor is just saying 'it's giving'",
  "Would describe their personality as 'chaotic neutral'",
  "Has multiple 'I should really call them back' people",
  "Still hasn't returned that one thing they borrowed",
  "Would watch a 30-second ad to save $0.50",
  "Texts back immediately then acts unbothered",
  "Has an essay-length opinion on the right way to load a dishwasher",
  "Their Wikipedia rabbit hole at 2am is unhinged",
  "Would get personally offended by a horoscope being wrong",
  "Has 'we should hang out soon' energy for 6+ months",
  "Describes everything as 'iconic' including spreadsheets",
  "Their red flag is giving relationship advice they don't follow",
  "Would make eye contact with you and still not say hi",
  "Their morning routine takes 2 hours but they're still late",
  "Knows every lyric to a song they claim to hate",
  "Has started a book in the last year but not finished one",
  "Their camera roll is 40% food, 40% memes, 20% screenshots of texts",
  "Would absolutely ghost someone and then run into them at brunch",
  "Still thinks they're better at parking than they are",
  "Their idea of 'keeping it short' is a 4-minute voice note",
  "Has watched the same comfort show 7+ times",
  "Would make a Pinterest board for a plan they'll never execute",
  "Their texting style changes completely depending on who they're talking to",
  "Thinks manifesting counts as a plan",
  "Has 'main character energy' in someone else's story",
];

function randomRoast(): string {
  return ROAST_BANK[Math.floor(Math.random() * ROAST_BANK.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createRoom(gameType: GameType, isDemo = false, packId?: string): string {
  const code = generateRoomCode();
  const room: Room = {
    code,
    gameType,
    status: "lobby",
    hostId: "",
    isDemo,
    players: [],
    questions: [],
    currentQuestionIndex: 0,
    currentVotes: {},
    cards: {},
    currentRound: 0,
    roundSubmissions: new Set(),
    revealOrder: [],
    currentRevealIndex: 0,
    botAssignments: {},
    quizPackId: packId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    hostSettings: { answerMethod: "both" },
  };

  if (isDemo) {
    BOT_NAMES.forEach((name) => {
      room.players.push({
        id: `bot-${name.toLowerCase()}`,
        name,
        isHost: false,
        isBot: true,
        score: 0,
        burns: 0,
        roasts: 0,
        guesses: 0,
        lastActivity: Date.now(),
      });
    });
  }

  rooms.set(code, room);
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

// Bot auto-voting for Pop the Question
function scheduleBotVotes(io: SocketIOServer, room: Room) {
  if (!room.isDemo) return;
  const bots = room.players.filter((p) => p.isBot);
  const votablePlayers = room.players.filter((p) => !p.isHost);

  bots.forEach((bot) => {
    const delay = rand(2000, 4500);
    setTimeout(() => {
      const liveRoom = rooms.get(room.code);
      if (!liveRoom || liveRoom.status !== "playing") return;
      if (liveRoom.currentVotes[bot.id]) return; // already voted

      // Vote for a random player (not self)
      const candidates = votablePlayers.filter((p) => p.id !== bot.id);
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      if (!target) return;

      liveRoom.currentVotes[bot.id] = target.id;
      liveRoom.lastActivity = Date.now();

      const nonHostCount = liveRoom.players.filter((p) => !p.isHost).length;
      const voteCount = Object.keys(liveRoom.currentVotes).length;

      io.to(liveRoom.code).emit("vote-progress", {
        voted: voteCount,
        total: nonHostCount,
      });

      if (voteCount >= nonHostCount) {
        io.to(liveRoom.hostId).emit("all-votes-in");
      }
    }, delay);
  });
}

// Bot auto-submission for Roast Roulette
function scheduleBotRoasts(
  io: SocketIOServer,
  room: Room,
  assignments: Record<string, string>
) {
  if (!room.isDemo) return;
  const bots = room.players.filter((p) => p.isBot);

  bots.forEach((bot) => {
    const targetId = assignments[bot.id];
    if (!targetId) return;

    const delay = rand(5000, 10000);
    setTimeout(() => {
      const liveRoom = rooms.get(room.code);
      if (!liveRoom || liveRoom.status === "finished") return;
      if (liveRoom.roundSubmissions.has(bot.id)) return; // already submitted

      const colorIndex = (liveRoom.currentRound - 1) % ROAST_COLORS.length;
      const color = ROAST_COLORS[colorIndex];
      const answer = randomRoast();
      const answerId = `${bot.id}-${color}-${Date.now()}`;

      if (!liveRoom.cards[targetId]) liveRoom.cards[targetId] = {};
      liveRoom.cards[targetId][color] = { author: bot.id, answer, answerId };
      liveRoom.roundSubmissions.add(bot.id);
      liveRoom.lastActivity = Date.now();

      const nonHostPlayers = liveRoom.players.filter((p) => !p.isHost);
      const submitted = liveRoom.roundSubmissions.size;
      const total = nonHostPlayers.length;

      io.to(liveRoom.code).emit("submission-progress", {
        submitted,
        total,
        round: liveRoom.currentRound,
      });

      if (submitted >= total) {
        const totalRounds = liveRoom.questions.length;
        if (liveRoom.currentRound >= totalRounds) {
          liveRoom.status = "playing";
          const revealOrder = nonHostPlayers.map((p) => p.id);
          liveRoom.revealOrder = revealOrder;
          liveRoom.currentRevealIndex = 0;

          io.to(liveRoom.code).emit("writing-complete", {
            message: "All roasts written! Time for reveals!",
          });

          setTimeout(() => {
            const r2 = rooms.get(liveRoom.code);
            if (!r2) return;
            const firstId = revealOrder[0];
            const firstPlayer = nonHostPlayers.find((p) => p.id === firstId);
            io.to(liveRoom.code).emit("start-reveals", {
              revealOrder,
              currentRevealId: firstId,
              currentRevealName: firstPlayer?.name ?? "Unknown",
              card: r2.cards[firstId] ?? {},
              questions: r2.questions,
            });

            // If first reveal is a bot, auto-pick
            if (firstPlayer?.isBot) {
              scheduleBotRevealPicks(io, r2, firstId);
            }
          }, 2000);
        } else {
          liveRoom.currentRound++;
          liveRoom.roundSubmissions = new Set();
          const nextAssignments = assignRoastTargets(nonHostPlayers, liveRoom.currentRound);

          io.to(liveRoom.code).emit("round-complete", {
            nextRound: liveRoom.currentRound,
            totalRounds,
          });

          nonHostPlayers.forEach((player) => {
            const tId = nextAssignments[player.id];
            const tPlayer = nonHostPlayers.find((p) => p.id === tId);
            if (!player.isBot) {
              io.to(player.id).emit("assign-card", {
                targetPlayerId: tId,
                targetPlayerName: tPlayer?.name ?? "Unknown",
                round: liveRoom.currentRound,
              });
            }
          });

          scheduleBotRoasts(io, liveRoom, nextAssignments);
        }
      }
    }, delay);
  });
}

// Bot auto-pick during reveal phase
function scheduleBotRevealPicks(io: SocketIOServer, room: Room, botId: string) {
  const liveRoom = rooms.get(room.code);
  if (!liveRoom) return;

  const card = liveRoom.cards[botId];
  if (!card) return;

  const nonHostPlayers = liveRoom.players.filter((p) => !p.isHost);
  const bot = liveRoom.players.find((p) => p.id === botId);

  Object.entries(card).forEach(([color, entry], i) => {
    setTimeout(() => {
      const r2 = rooms.get(liveRoom.code);
      if (!r2) return;

      const roastEntry = r2.cards[botId]?.[color];
      if (!roastEntry) return;

      // Pick a random non-host player as the guessed author (bots guess randomly)
      const candidates = nonHostPlayers.filter((p) => p.id !== botId);
      const guessedPlayer = candidates[Math.floor(Math.random() * candidates.length)];
      if (!guessedPlayer) return;

      const actualAuthorId = roastEntry.author;
      const correct = actualAuthorId === guessedPlayer.id;

      const author = r2.players.find((p) => p.id === actualAuthorId);
      const guesserBot = r2.players.find((p) => p.id === botId);

      if (author) author.roasts += 1;
      if (correct && guesserBot) guesserBot.guesses += 1;

      r2.players.forEach((p) => { p.score = p.burns + p.roasts + p.guesses; });

      const actualAuthor = r2.players.find((p) => p.id === actualAuthorId);

      io.to(r2.code).emit("favorite-picked", {
        color,
        pickedByName: bot?.name ?? "Bot",
        actualAuthorName: actualAuthor?.name ?? "Unknown",
        guessedPlayerId: guessedPlayer.id,
        actualAuthorId,
        correct,
        players: r2.players,
      });
    }, rand(1500, 3000) + i * 1200);
  });
}

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

      // Remove any existing non-bot player with this socket id
      room.players = room.players.filter((p) => p.id !== socket.id);

      const player: Player = {
        id: socket.id,
        name: playerName,
        isHost: isHost || false,
        isBot: false,
        score: 0,
        burns: 0,
        roasts: 0,
        guesses: 0,
        lastActivity: Date.now(),
      };

      room.players.push(player);

      if (isHost) {
        room.hostId = socket.id;
      }

      io.to(roomCode).emit("player-joined", {
        player,
        players: room.players,
        isDemo: room.isDemo,
      });

      socket.emit("room-state", {
        status: room.status,
        gameType: room.gameType,
        players: room.players,
        isDemo: room.isDemo,
        currentQuestion: room.questions[room.currentQuestionIndex],
        questionIndex: room.currentQuestionIndex,
        hostSettings: room.hostSettings,
        quizPackId: room.quizPackId,
        quizPackSummary: room.quiz ? packSummary(room.quiz.pack) : null,
        quizQuestion: room.quiz ? publicQuestionFromState(room.quiz) : null,
        quizRevealed: room.quiz?.revealed ?? false,
        quizTimerEndAt: room.quiz?.timerEndAt ?? 0,
      });
    });

    // ===========================================
    // Pub Quiz: list available packs (for host UI)
    // ===========================================
    socket.on("quiz-list-packs", () => {
      socket.emit("quiz-packs", {
        packs: QUIZ_PACKS.map(packSummary) satisfies PackSummary[],
      });
    });

    // ====== Dual Host Mode plumbing (Task #5) ======

    // Player phone reports they are typing into an answer box. Host derives
    // the "Typing…" status badge from this transient signal.
    socket.on("player-typing", ({ roomCode, isTyping }: { roomCode: string; isTyping: boolean }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      player.lastActivity = Date.now();
      if (room.hostId) {
        io.to(room.hostId).emit("player-typing-changed", {
          playerId: socket.id,
          isTyping: Boolean(isTyping),
        });
      }
    });

    // Player phone toggles its self-mute. Host shows the "Muted" badge.
    socket.on("player-muted", ({ roomCode, muted }: { roomCode: string; muted: boolean }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      player.muted = Boolean(muted);
      player.lastActivity = Date.now();
      if (room.hostId) {
        io.to(room.hostId).emit("player-muted-changed", {
          playerId: socket.id,
          muted: player.muted,
        });
      }
    });

    // Host updates settings that affect player UI (currently: answerMethod).
    // Persisted on the room so late-joining players get the current value.
    socket.on(
      "host-settings-update",
      ({ roomCode, settings }: { roomCode: string; settings: Partial<HostSettingsBroadcast> }) => {
        const room = rooms.get(roomCode);
        if (!room || room.hostId !== socket.id) return;
        room.lastActivity = Date.now();
        if (settings.answerMethod) {
          room.hostSettings.answerMethod = settings.answerMethod;
        }
        io.to(roomCode).emit("host-settings-changed", { settings: room.hostSettings });
      },
    );

    // Host pause / resume — gates bot timers and shows a player-side
    // "Paused" overlay so nobody keeps frantically typing.
    socket.on("host-pause", ({ roomCode, paused }: { roomCode: string; paused: boolean }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      io.to(roomCode).emit("host-paused-changed", { paused: Boolean(paused) });
    });

    socket.on("start-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      room.status = "playing";
      room.currentQuestionIndex = 0;
      room.currentVotes = {};

      if (room.gameType === "pop-the-question") {
        const shuffled = [...POP_QUESTIONS].sort(() => Math.random() - 0.5);
        room.questions = shuffled.map((q) => ({ text: q }));

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          question: room.questions[0]?.text,
          questionIndex: 0,
          totalQuestions: room.questions.length,
          isDemo: room.isDemo,
        });

        scheduleBotVotes(io, room);

      } else if (room.gameType === "roast-roulette") {
        const nonHostPlayers = room.players.filter((p) => !p.isHost);
        const numQuestions = Math.max(1, nonHostPlayers.length - 1);
        const colors = ROAST_COLORS.slice(0, numQuestions);
        const shuffledQ = [...ROAST_QUESTIONS_BANK].sort(() => Math.random() - 0.5);
        room.questions = colors.map((color, i) => ({
          color,
          question: shuffledQ[i] ?? `Question ${i + 1}`,
        }));

        nonHostPlayers.forEach((p) => { room.cards[p.id] = {}; });
        room.currentRound = 1;
        room.roundSubmissions = new Set();

        const assignments = assignRoastTargets(nonHostPlayers, 1);

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          questions: room.questions,
          players: nonHostPlayers,
          currentRound: 1,
          totalRounds: numQuestions,
          isDemo: room.isDemo,
        });

        nonHostPlayers.forEach((player) => {
          const targetId = assignments[player.id];
          const target = nonHostPlayers.find((p) => p.id === targetId);
          if (!player.isBot) {
            io.to(player.id).emit("assign-card", {
              targetPlayerId: targetId,
              targetPlayerName: target?.name ?? "Unknown",
              round: 1,
            });
          }
        });

        scheduleBotRoasts(io, room, assignments);

      } else if (room.gameType === "pub-quiz") {
        // Pick the pack: explicit room.quizPackId, fallback to random
        const pack = (room.quizPackId && getQuizPack(room.quizPackId)) || getRandomQuizPack();
        room.quizPackId = pack.id;
        room.quiz = makeQuizState(pack);

        // Reset all player scores
        room.players.forEach((p) => { p.score = 0; });

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          isDemo: room.isDemo,
          pack: packSummary(pack),
          totalRounds: pack.rounds.length,
        });

        // Immediately start question 1 of round 1
        startQuizQuestion(io, room);
      }
    });

    // ===========================================
    // Pub Quiz: submit answer (real player)
    // ===========================================
    socket.on("quiz-submit-answer", ({ roomCode, answer }: { roomCode: string; answer: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.quiz.revealed) return;
      room.lastActivity = Date.now();

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.isHost) return;

      const q = getCurrentQuestion(room.quiz);
      if (!q) return;

      // Don't allow re-submission for the same question
      if (room.quiz.answers[socket.id]) return;

      const judged = judgeAnswer(q, answer);
      const submittedAt = Date.now();
      room.quiz.answers[socket.id] = {
        raw: answer,
        submittedAt,
        correct: judged.correct,
      };
      if (judged.correct && !room.quiz.firstCorrectId) {
        room.quiz.firstCorrectId = socket.id;
      }

      const nonHostCount = room.players.filter((p) => !p.isHost).length;
      const submitted = Object.keys(room.quiz.answers).length;

      io.to(roomCode).emit("quiz-answer-progress", {
        submitted,
        total: nonHostCount,
      });

      // Acknowledge to the answering player so the UI can lock-in
      socket.emit("quiz-answer-accepted", {
        roundIndex: room.quiz.roundIndex,
        questionIndex: room.quiz.questionIndex,
      });

      if (submitted >= nonHostCount) {
        io.to(room.hostId).emit("quiz-all-answered");
      }
    });

    // ===========================================
    // Pub Quiz: reveal current answer (host only)
    // ===========================================
    socket.on("quiz-reveal-answer", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      revealQuizAnswer(io, room);
    });

    // ===========================================
    // Pub Quiz: skip without revealing (host only)
    // ===========================================
    socket.on("quiz-skip-question", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      clearTimer(room.quiz);
      room.quiz.revealed = true; // mark as resolved so we can advance
      io.to(roomCode).emit("quiz-question-skipped", {
        roundIndex: room.quiz.roundIndex,
        questionIndex: room.quiz.questionIndex,
      });
    });

    // ===========================================
    // Pub Quiz: advance to next question (or end of round) (host only)
    // ===========================================
    socket.on("quiz-next-question", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      // Must reveal first
      if (!room.quiz.revealed) return;

      if (isLastQuestionOfRound(room.quiz)) {
        // Send round summary
        const round = getCurrentRound(room.quiz);
        io.to(roomCode).emit("quiz-round-summary", {
          roundIndex: room.quiz.roundIndex,
          roundName: round?.name ?? "",
          totalRounds: room.quiz.pack.rounds.length,
          isLastRound: isLastRound(room.quiz),
          leaderboard: leaderboardSorted(room.players).map((p) => ({
            id: p.id,
            name: p.name,
            score: p.score,
            isBot: p.isBot,
          })),
        });
      } else {
        room.quiz.questionIndex++;
        startQuizQuestion(io, room);
      }
    });

    // ===========================================
    // Pub Quiz: advance to the next round after a round summary (host only)
    // ===========================================
    socket.on("quiz-next-round", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();

      if (isLastRound(room.quiz)) {
        // End the game
        endQuizGame(io, room);
        return;
      }
      room.quiz.roundIndex++;
      room.quiz.questionIndex = 0;
      startQuizQuestion(io, room);
    });

    // ===========================================
    // Pub Quiz: end the game early (host only)
    // ===========================================
    socket.on("quiz-end-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.quiz || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      room.quiz.endedEarly = true;
      endQuizGame(io, room);
    });

    // Pop the Question: submit vote (real player)
    socket.on("submit-vote", ({ roomCode, votedForId }: { roomCode: string; votedForId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();
      const submitter = room.players.find((p) => p.id === socket.id);
      if (submitter) submitter.lastActivity = Date.now();

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
        });

        scheduleBotVotes(io, room);
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

    // Roast Roulette: submit roast (real player)
    socket.on("submit-roast", ({ roomCode, targetPlayerId, color, answer }: {
      roomCode: string;
      targetPlayerId: string;
      color: string;
      answer: string;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();
      const submitter = room.players.find((p) => p.id === socket.id);
      if (submitter) submitter.lastActivity = Date.now();

      if (!room.cards[targetPlayerId]) room.cards[targetPlayerId] = {};

      const answerId = `${socket.id}-${color}-${Date.now()}`;
      room.cards[targetPlayerId][color] = { author: socket.id, answer, answerId };
      room.roundSubmissions.add(socket.id);

      const nonHostPlayers = room.players.filter((p) => !p.isHost);
      const submitted = room.roundSubmissions.size;
      const total = nonHostPlayers.length;

      io.to(roomCode).emit("submission-progress", {
        submitted,
        total,
        round: room.currentRound,
      });

      if (submitted >= total) {
        const totalRounds = room.questions.length;

        if (room.currentRound >= totalRounds) {
          room.status = "playing";
          const revealOrder = nonHostPlayers.map((p) => p.id);
          room.revealOrder = revealOrder;
          room.currentRevealIndex = 0;

          io.to(roomCode).emit("writing-complete", { message: "All roasts written! Time for reveals!" });

          setTimeout(() => {
            const r2 = rooms.get(roomCode);
            if (!r2) return;
            const firstId = revealOrder[0];
            const firstPlayer = nonHostPlayers.find((p) => p.id === firstId);
            io.to(roomCode).emit("start-reveals", {
              revealOrder,
              currentRevealId: firstId,
              currentRevealName: firstPlayer?.name ?? "Unknown",
              card: r2.cards[firstId] ?? {},
              questions: r2.questions,
            });
            if (firstPlayer?.isBot) scheduleBotRevealPicks(io, r2, firstId);
          }, 2000);
        } else {
          room.currentRound++;
          room.roundSubmissions = new Set();
          const assignments = assignRoastTargets(nonHostPlayers, room.currentRound);

          io.to(roomCode).emit("round-complete", {
            nextRound: room.currentRound,
            totalRounds,
          });

          nonHostPlayers.forEach((player) => {
            const tId = assignments[player.id];
            const tPlayer = nonHostPlayers.find((p) => p.id === tId);
            if (!player.isBot) {
              io.to(player.id).emit("assign-card", {
                targetPlayerId: tId,
                targetPlayerName: tPlayer?.name ?? "Unknown",
                round: room.currentRound,
              });
            }
          });

          scheduleBotRoasts(io, room, assignments);
        }
      }
    });

    // Roast Roulette: pick favorite (real player)
    socket.on("pick-favorite", ({ roomCode, color, answerId, guessedPlayerId }: {
      roomCode: string;
      color: string;
      answerId: string;
      guessedPlayerId: string;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.lastActivity = Date.now();
      const picker = room.players.find((p) => p.id === socket.id);
      if (picker) picker.lastActivity = Date.now();

      const card = room.cards[socket.id];
      if (!card || !card[color]) return;

      const roastEntry = card[color];
      const actualAuthorId = roastEntry.author;
      const correct = actualAuthorId === guessedPlayerId;

      const author = room.players.find((p) => p.id === actualAuthorId);
      const guesser = room.players.find((p) => p.id === socket.id);

      if (author) author.roasts += 1;
      if (correct && guesser) guesser.guesses += 1;
      room.players.forEach((p) => { p.score = p.burns + p.roasts + p.guesses; });

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

    // Roast Roulette: next reveal (host only)
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
            id: p.id, name: p.name, burns: p.burns,
            roasts: p.roasts, guesses: p.guesses, total: p.score,
          })),
        });
      } else {
        const nextId = room.revealOrder[room.currentRevealIndex];
        const nextPlayer = nonHostPlayers.find((p) => p.id === nextId);
        io.to(roomCode).emit("start-reveals", {
          revealOrder: room.revealOrder,
          currentRevealId: nextId,
          currentRevealName: nextPlayer?.name ?? "Unknown",
          card: room.cards[nextId] ?? {},
          questions: room.questions,
        });
        if (nextPlayer?.isBot) scheduleBotRevealPicks(io, room, nextId);
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
          if (room.players.filter((p) => !p.isBot).length === 0) {
            rooms.delete(code);
          }
        }
      }
    });
  });

  return io;
}

function assignRoastTargets(players: Player[], round: number): Record<string, string> {
  const assignments: Record<string, string> = {};
  players.forEach((player, i) => {
    const targetIndex = (i + round) % players.length;
    assignments[player.id] = players[targetIndex].id;
  });
  return assignments;
}

// =====================================================================
// Pub Quiz helpers (live within the socket module to share `rooms`/`io`)
// =====================================================================
function startQuizQuestion(io: SocketIOServer, room: Room) {
  if (!room.quiz) return;
  resetForNextQuestion(room.quiz);

  const q = getCurrentQuestion(room.quiz);
  if (!q) {
    endQuizGame(io, room);
    return;
  }
  const durationMs = QUIZ_TIMER_MS[q.type] ?? 30_000;
  const startedAt = Date.now();
  room.quiz.questionStartedAt = startedAt;
  room.quiz.timerEndAt = startedAt + durationMs;

  const publicQ = publicQuestionFromState(room.quiz);
  io.to(room.code).emit("quiz-question", {
    question: publicQ,
    startedAt,
    timerEndAt: room.quiz.timerEndAt,
  });

  // Schedule bots to answer
  const nonHostPlayers = room.players.filter((p) => !p.isHost);
  const bots = nonHostPlayers.filter((p) => p.isBot);
  scheduleBotQuizAnswers(io, room.code, room.quiz, bots, nonHostPlayers.length, () => {
    if (room.quiz && !room.quiz.revealed) {
      io.to(room.hostId).emit("quiz-all-answered");
    }
  });

  // Auto-reveal when the timer expires
  room.quiz.timerHandle = setTimeout(() => {
    const r = rooms.get(room.code);
    if (!r || !r.quiz) return;
    // If question already advanced or revealed, no-op
    if (r.quiz.questionStartedAt !== startedAt) return;
    if (r.quiz.revealed) return;
    revealQuizAnswer(io, r);
  }, durationMs + 100);
}

function revealQuizAnswer(io: SocketIOServer, room: Room) {
  if (!room.quiz || room.quiz.revealed) return;
  clearTimer(room.quiz);
  room.quiz.revealed = true;

  // Award points: base + first-correct bonus
  const q = getCurrentQuestion(room.quiz);
  if (q && room.quiz.firstCorrectId) {
    // Bonus to first correct
    const firstCorrectPlayer = room.players.find((p) => p.id === room.quiz!.firstCorrectId);
    if (firstCorrectPlayer) {
      firstCorrectPlayer.score += QUIZ_SCORING.firstCorrectBonus;
    }
  }
  if (q) {
    Object.entries(room.quiz.answers).forEach(([pid, ans]) => {
      if (!ans.correct) return;
      const player = room.players.find((p) => p.id === pid);
      if (!player) return;
      const judged = judgeAnswer(q, ans.raw);
      player.score += judged.pointsForCorrect;
    });
  }

  const reveal = buildReveal(room.quiz);

  io.to(room.code).emit("quiz-reveal", {
    reveal,
    leaderboard: leaderboardSorted(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isBot: p.isBot,
    })),
    isLastQuestionOfRound: isLastQuestionOfRound(room.quiz),
    isLastRound: isLastRound(room.quiz),
  });
}

function endQuizGame(io: SocketIOServer, room: Room) {
  if (room.quiz) clearTimer(room.quiz);
  room.status = "finished";

  const sorted = leaderboardSorted(room.players);
  io.to(room.code).emit("game-ended", {
    gameType: "pub-quiz",
    pack: room.quiz ? packSummary(room.quiz.pack) : null,
    players: room.players,
    finalScores: sorted.map((p, idx) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isBot: p.isBot,
      rank: idx + 1,
    })),
  });
}
