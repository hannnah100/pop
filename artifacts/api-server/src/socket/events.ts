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
import {
  JEOPARDY_PACKS,
  getJeopardyPack,
  getRandomJeopardyPack,
} from "../data/jeopardy";
import {
  type JeopardyState,
  type JeopardyPackSummaryWire,
  JEOPARDY_TIMING,
  JEOPARDY_BOT_DELAYS,
  activeClueWire,
  botDailyDoubleWager,
  botFinalGuessesCorrect,
  botFinalWager,
  botGuessesCorrect,
  clampWager,
  clearJeopardyTimer,
  getClue,
  isBoardCleared,
  isDailyDouble,
  isJeopardyAnswerCorrect,
  jeopardyLeaderboard,
  jeopardyPackSummary,
  makeJeopardyState,
  maxDailyDoubleWager,
  maxFinalWager,
  publicBoard,
  rand as jrand,
  setJeopardyTimer,
} from "./jeopardy";
import {
  WOF_PACKS,
  getWofPack,
  getRandomWofPack,
} from "../data/wof";
import {
  type WofState,
  type WofBoardWire,
  type WofPackSummaryWire,
  VOWELS,
  VOWEL_COST,
  advanceController,
  botGuessesCorrect as wofBotGuessesCorrect,
  botPickConsonant,
  currentPuzzle,
  getLetterPositions,
  isPuzzleSolved,
  makeWofState,
  publicBoard as wofPublicBoard,
  rand as wofRand,
  spinWheel,
  wofPackSummaryWire,
} from "./wof";
import {
  type ScattergoriesState,
  type ScattergoriesDifficulty,
  type CategoryResult,
  makeScattergoriesState,
  pickScatLetter,
  scoreScattergoriesRound,
  clearScatTimers,
  TIMER_DURATIONS_MS,
} from "./scattergories";
import { pickCategories, BOT_ANSWER_POOL, CATEGORIES_PER_ROUND } from "../data/scattergories/categories";

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

export type GameType = "pop-the-question" | "roast-roulette" | "pub-quiz" | "jeopardy" | "wheel-of-fortune" | "scattergories";

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
  /** Jeopardy state (only set when gameType === "jeopardy" and game has started). */
  jeopardy?: JeopardyState;
  /** For jeopardy host UI: the chosen pack id. */
  jeopardyPackId?: string;
  /** Wheel of Fortune state (only set when gameType === "wheel-of-fortune" and game has started). */
  wof?: WofState;
  /** For wof host UI: the chosen pack id. */
  wofPackId?: string;
  /** For wof host UI: the chosen round count (3-5, default 5). */
  wofRoundCount?: number;
  /** Scattergories state (only set when gameType === "scattergories" and game has started). */
  scattergories?: ScattergoriesState;
  /** For scattergories host UI: round count config (3-5, default 3). */
  scattergoriesRoundCount?: number;
  /** For scattergories host UI: difficulty config. */
  scattergoriesDifficulty?: ScattergoriesDifficulty;
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
    quizPackId: gameType === "pub-quiz" ? packId : undefined,
    jeopardyPackId: gameType === "jeopardy" ? packId : undefined,
    wofPackId: gameType === "wheel-of-fortune" ? packId : undefined,
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
        jeopardyPackId: room.jeopardyPackId,
        jeopardyPackSummary: room.jeopardy ? jeopardyPackSummary(room.jeopardy.pack) : null,
        jeopardyBoard: room.jeopardy ? publicBoard(room.jeopardy) : null,
        jeopardyPhase: room.jeopardy?.phase ?? null,
        jeopardyControllerId: room.jeopardy?.controllerId ?? null,
        jeopardyActive: room.jeopardy?.active ? activeClueWire(room.jeopardy.active) : null,
        jeopardyBuzzedInId: room.jeopardy?.buzzedInId ?? null,
        jeopardyTimerEndAt: room.jeopardy?.timerEndAt ?? 0,
        wofPackId: room.wofPackId,
        wofRoundCount: room.wofRoundCount ?? 5,
        wofPackSummary: room.wof ? wofPackSummaryWire(room.wof.pack) : null,
        wofBoard: room.wof ? wofPublicBoard(room.wof) : null,
        wofPhase: room.wof?.phase ?? null,
        wofControllerId: room.wof?.controllerId ?? null,
        wofRevealedLetters: room.wof ? Array.from(room.wof.revealedLetters) : [],
        wofGuessedLetters: room.wof ? Array.from(room.wof.guessedLetters) : [],
        wofCategory: room.wof ? currentPuzzle(room.wof).category : null,
        wofHint: room.wof ? currentPuzzle(room.wof).hint ?? null : null,
        wofPendingSolve: room.wof?.pendingSolve ?? null,
        wofPuzzleIndex: room.wof?.puzzleIndex ?? 0,
        wofTotalPuzzles: room.wof?.roundCount ?? 0,
        wofScores: room.wof ? wofScoresWire(room, room.wof) : [],
        scattergoriesRoundCount: room.scattergoriesRoundCount ?? 3,
        scattergoriesDifficulty: room.scattergoriesDifficulty ?? "medium",
        scattergoriesPhase: room.scattergories?.phase ?? null,
        scattergoriesRound: room.scattergories?.currentRound ?? 0,
        scattergoriesLetter: room.scattergories?.currentLetter ?? null,
        scattergoriesCategories: room.scattergories?.currentCategories ?? [],
        scattergoriesTimerEndAt: room.scattergories?.timerEndAt ?? 0,
        scattergoriesDifficultyActive: room.scattergories?.difficulty ?? null,
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

    // ===========================================
    // Pub Quiz: host selects a specific pack (lobby only, host-only)
    // ===========================================
    socket.on("set-pack", ({ roomCode, packId }: { roomCode: string; packId: string | null }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== "lobby") return;
      if (room.hostId !== socket.id) return;
      if (room.gameType !== "pub-quiz") return;

      // Validate packId is either null (random) or a known pack.
      if (packId !== null && !getQuizPack(packId)) return;

      room.quizPackId = packId ?? undefined;
      const chosenPack = packId ? getQuizPack(packId) : null;
      const summary: PackSummary | null = chosenPack ? packSummary(chosenPack) : null;
      // Broadcast so host UI stays in sync on reconnect / multi-tab.
      io.to(roomCode).emit("quiz-pack-changed", { packId, summary });
    });

    // ===========================================
    // Jeopardy: list available packs (for host UI)
    // ===========================================
    socket.on("jeopardy-list-packs", () => {
      socket.emit("jeopardy-packs", {
        packs: JEOPARDY_PACKS.map(jeopardyPackSummary) satisfies JeopardyPackSummaryWire[],
      });
    });

    // ===========================================
    // Wheel of Fortune: list available packs (for host UI)
    // ===========================================
    socket.on("wof-list-packs", () => {
      socket.emit("wof-packs", {
        packs: WOF_PACKS.map(wofPackSummaryWire) satisfies WofPackSummaryWire[],
      });
    });

    // ===========================================
    // Wheel of Fortune: host selects a pack (lobby only, host-only)
    // ===========================================
    socket.on("wof-set-pack", ({ roomCode, packId }: { roomCode: string; packId: string | null }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== "lobby") return;
      if (room.hostId !== socket.id) return;
      if (room.gameType !== "wheel-of-fortune") return;
      if (packId !== null && !getWofPack(packId)) return;
      room.wofPackId = packId ?? undefined;
      const chosenPack = packId ? getWofPack(packId) : null;
      const summary = chosenPack ? wofPackSummaryWire(chosenPack) : null;
      io.to(roomCode).emit("wof-pack-changed", { packId, summary });
    });

    socket.on("wof-set-round-count", ({ roomCode, roundCount }: { roomCode: string; roundCount: number }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== "lobby") return;
      if (room.hostId !== socket.id) return;
      if (room.gameType !== "wheel-of-fortune") return;
      const clamped = Math.min(Math.max(Math.floor(roundCount), 3), 5);
      room.wofRoundCount = clamped;
      io.to(roomCode).emit("wof-round-count-changed", { roundCount: clamped });
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
      } else if (room.gameType === "jeopardy") {
        const pack =
          (room.jeopardyPackId && getJeopardyPack(room.jeopardyPackId)) ||
          getRandomJeopardyPack();
        room.jeopardyPackId = pack.id;
        room.jeopardy = makeJeopardyState(pack);

        // Jeopardy uses raw scores that can go negative — reset everyone.
        room.players.forEach((p) => { p.score = 0; });

        const nonHosts = room.players.filter((p) => !p.isHost);
        // First controller: a real player if available, else the first bot.
        const firstHuman = nonHosts.find((p) => !p.isBot);
        room.jeopardy.controllerId = (firstHuman ?? nonHosts[0])?.id ?? null;

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          isDemo: room.isDemo,
          pack: jeopardyPackSummary(pack),
          board: publicBoard(room.jeopardy),
          controllerId: room.jeopardy.controllerId,
          scores: nonHosts.map((p) => ({
            id: p.id,
            name: p.name,
            score: 0,
            isBot: p.isBot,
          })),
        });

        // If a bot is the first picker, schedule its pick.
        const controller = room.players.find((p) => p.id === room.jeopardy!.controllerId);
        if (controller?.isBot) scheduleBotJeopardyPick(io, room);

      } else if (room.gameType === "wheel-of-fortune") {
        const pack =
          (room.wofPackId && getWofPack(room.wofPackId)) || getRandomWofPack();
        room.wofPackId = pack.id;
        room.wof = makeWofState(pack, room.wofRoundCount ?? 5);

        room.players.forEach((p) => { p.score = 0; });

        const nonHosts = room.players.filter((p) => !p.isHost);
        const firstHuman = nonHosts.find((p) => !p.isBot);
        room.wof.controllerId = (firstHuman ?? nonHosts[0])?.id ?? null;

        const puzzle = currentPuzzle(room.wof);

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          isDemo: room.isDemo,
          pack: wofPackSummaryWire(pack),
          board: wofPublicBoard(room.wof),
          category: puzzle.category,
          hint: puzzle.hint ?? null,
          controllerId: room.wof.controllerId,
          revealedLetters: [],
          guessedLetters: [],
          puzzleIndex: 0,
          totalPuzzles: room.wof.roundCount,
          scores: wofScoresWire(room, room.wof),
        });

        const firstController = room.players.find((p) => p.id === room.wof!.controllerId);
        if (firstController?.isBot) scheduleBotWofTurn(io, room);

      } else if (room.gameType === "scattergories") {
        const roundCount = room.scattergoriesRoundCount ?? 3;
        const difficulty = room.scattergoriesDifficulty ?? "medium";
        room.scattergories = makeScattergoriesState(roundCount, difficulty);
        room.players.forEach((p) => { p.score = 0; });

        io.to(roomCode).emit("game-started", {
          gameType: room.gameType,
          status: room.status,
          isDemo: room.isDemo,
          roundCount,
          difficulty,
        });

        // Kick off round 1 immediately
        startScattergoriesRound(io, room);
      }
    });

    // ===========================================
    // Jeopardy: socket handlers
    // ===========================================
    socket.on("jeopardy-pick-square", ({ roomCode, cat, clue }: { roomCode: string; cat: number; clue: number }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy) return;
      const j = room.jeopardy;
      if (j.phase !== "picking") return;
      // Only the controller may pick (or the host as a fallback to keep things flowing).
      if (socket.id !== j.controllerId && socket.id !== room.hostId) return;
      jeopardyRevealSquare(io, room, cat, clue);
    });

    socket.on("jeopardy-buzz-in", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy) return;
      const j = room.jeopardy;
      if (j.phase !== "buzzer-open") return;
      if (j.buzzedInId) return; // someone already won the race
      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.isHost) return;
      if (j.lockedOut.has(socket.id)) return;
      acceptJeopardyBuzz(io, room, socket.id);
    });

    // Host marks the buzzed-in player correct.
    socket.on("jeopardy-mark-correct", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      resolveJeopardyAnswer(io, room, true);
    });

    // Host marks the buzzed-in player incorrect.
    socket.on("jeopardy-mark-incorrect", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      resolveJeopardyAnswer(io, room, false);
    });

    // Host skips the active clue (no penalty) — reveals the answer and moves on.
    socket.on("jeopardy-skip-clue", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      finishJeopardyClue(io, room, /*revealAnswer=*/ true);
    });

    // Player submits Daily Double wager (only the controller, who triggered the DD).
    socket.on(
      "jeopardy-submit-dd-wager",
      ({ roomCode, wager }: { roomCode: string; wager: number }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.jeopardy) return;
        const j = room.jeopardy;
        if (j.phase !== "dd-wager") return;
        if (socket.id !== j.controllerId) return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return;
        const max = maxDailyDoubleWager(player.score, j.active?.value ?? 0);
        j.ddWager = clampWager(wager, max);
        startDailyDoubleClue(io, room);
      },
    );

    // Player (the DD controller) submits a typed Daily Double answer (text mode).
    socket.on(
      "jeopardy-submit-dd-answer",
      ({ roomCode, answer }: { roomCode: string; answer: string }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.jeopardy) return;
        const j = room.jeopardy;
        if (j.phase !== "dd-clue") return;
        if (socket.id !== j.controllerId) return;
        const correct =
          j.active != null &&
          isJeopardyAnswerCorrect(
            answer,
            j.active.answer,
            getClue(j, j.active.cat, j.active.clue)?.acceptedAnswers,
          );
        // Surface to host for confirmation, but auto-resolve to keep the flow snappy.
        resolveDailyDouble(io, room, correct);
      },
    );

    // Host starts the Final Jeopardy round (only valid once the board is cleared).
    socket.on("jeopardy-start-final", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      startJeopardyFinal(io, room);
    });

    socket.on(
      "jeopardy-submit-final-wager",
      ({ roomCode, wager }: { roomCode: string; wager: number }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.jeopardy) return;
        const j = room.jeopardy;
        if (j.phase !== "final-wager") return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player || player.isHost) return;
        const max = maxFinalWager(player.score);
        j.finalWagers[socket.id] = clampWager(wager, max);
        broadcastFinalProgress(io, room);
      },
    );

    socket.on(
      "jeopardy-submit-final-answer",
      ({ roomCode, answer }: { roomCode: string; answer: string }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.jeopardy) return;
        const j = room.jeopardy;
        if (j.phase !== "final-clue") return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player || player.isHost) return;
        const correct = isJeopardyAnswerCorrect(
          answer,
          j.pack.final.answer,
          j.pack.final.acceptedAnswers,
        );
        j.finalAnswers[socket.id] = { raw: answer, correct };
        broadcastFinalProgress(io, room);
      },
    );

    // Host clicks: reveal the Final Jeopardy answers and apply scores.
    socket.on("jeopardy-reveal-final", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      revealJeopardyFinal(io, room);
    });

    // Host overrides server's auto-judging on a player's final answer.
    socket.on(
      "jeopardy-override-final",
      ({ roomCode, playerId, correct }: { roomCode: string; playerId: string; correct: boolean }) => {
        const room = rooms.get(roomCode);
        if (!room || !room.jeopardy || room.hostId !== socket.id) return;
        const j = room.jeopardy;
        if (j.phase !== "final-reveal" || j.finalResolved) return;
        const ans = j.finalAnswers[playerId];
        if (!ans) return;
        ans.correct = correct;
        // Note: scores are applied once on reveal, so we recompute on override.
        applyFinalScores(io, room);
      },
    );

    // Host ends the Jeopardy game (after Final reveal or anytime to bail out).
    socket.on("jeopardy-end-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.jeopardy || room.hostId !== socket.id) return;
      endJeopardyGame(io, room);
    });

    // ===========================================
    // Wheel of Fortune: socket handlers
    // ===========================================

    socket.on("wof-spin", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      const w = room.wof;
      if (w.phase !== "spinning") return;
      if (w.pendingSolve) return; // block while awaiting host judgment
      // Only controller or host can spin.
      if (socket.id !== w.controllerId && socket.id !== room.hostId) return;
      room.lastActivity = Date.now();

      const { value, spinIndex } = spinWheel();
      w.currentSpin = value;
      w.currentSpinIndex = spinIndex;

      const controller = room.players.find((p) => p.id === w.controllerId);
      const controllerName = controller?.name ?? "Player";

      if (value === "BANKRUPT") {
        if (w.controllerId) {
          w.roundEarnings[w.controllerId] = 0;
        }
        const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
        w.controllerId = advanceController(w.controllerId, nonHostIds);
        w.isFreePlay = false;
        io.to(room.code).emit("wof-spun", {
          value, spinIndex,
          type: "bankrupt",
          controllerId: w.controllerId,
          controllerName,
          scores: wofScoresWire(room, w),
        });
        const nextController = room.players.find((p) => p.id === w.controllerId);
        if (nextController?.isBot) scheduleBotWofTurn(io, room);
        return;
      }

      if (value === "LOSE_A_TURN") {
        const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
        w.controllerId = advanceController(w.controllerId, nonHostIds);
        w.isFreePlay = false;
        io.to(room.code).emit("wof-spun", {
          value, spinIndex,
          type: "lose-a-turn",
          controllerId: w.controllerId,
          controllerName,
          scores: wofScoresWire(room, w),
        });
        const nextController = room.players.find((p) => p.id === w.controllerId);
        if (nextController?.isBot) scheduleBotWofTurn(io, room);
        return;
      }

      if (value === "FREE_PLAY") {
        w.isFreePlay = true;
        w.phase = "guessing";
        io.to(room.code).emit("wof-spun", {
          value, spinIndex,
          type: "free-play",
          controllerId: w.controllerId,
          isFreePlay: true,
          controllerName,
          scores: wofScoresWire(room, w),
        });
        const ctrl = room.players.find((p) => p.id === w.controllerId);
        if (ctrl?.isBot) scheduleBotWofGuess(io, room);
        return;
      }

      // Dollar value
      w.phase = "guessing";
      w.isFreePlay = false;
      io.to(room.code).emit("wof-spun", {
        value, spinIndex,
        type: "dollar",
        controllerId: w.controllerId,
        isFreePlay: false,
        controllerName,
        scores: wofScoresWire(room, w),
      });
      const ctrl = room.players.find((p) => p.id === w.controllerId);
      if (ctrl?.isBot) scheduleBotWofGuess(io, room);
    });

    socket.on("wof-guess-letter", ({ roomCode, letter }: { roomCode: string; letter: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      const w = room.wof;
      if (w.phase !== "guessing") return;
      if (w.pendingSolve) return; // block while awaiting host judgment
      if (socket.id !== w.controllerId && socket.id !== room.hostId) return;
      room.lastActivity = Date.now();

      const l = letter.toUpperCase().trim();
      if (!l || l.length !== 1 || !/[A-Z]/.test(l)) return;
      if (w.guessedLetters.has(l)) return;

      const puzzle = currentPuzzle(w);
      const isVowel = VOWELS.has(l);

      // Vowel during free play: allow. Consonant during free play: allow too.
      // Vowel during paid spin: not allowed (must use buy-vowel flow).
      if (isVowel && !w.isFreePlay) return;
      if (!isVowel && w.isFreePlay) {
        // FREE_PLAY consonant: per WoF rules the player earns at a fixed $500
        // value (no spin required). This is intentional — FREE PLAY is not
        // truly zero-earnings; it gives a free turn at the $500 rate.
        w.currentSpin = 500;
      }

      w.guessedLetters.add(l);
      const positions = getLetterPositions(puzzle.answer, l);
      const count = positions.length;

      if (count > 0) {
        w.revealedLetters.add(l);
        const spinValue = typeof w.currentSpin === "number" ? w.currentSpin : 0;
        const earned = isVowel ? 0 : spinValue * count;
        if (!isVowel && earned > 0) {
          w.roundEarnings[w.controllerId ?? ""] = (w.roundEarnings[w.controllerId ?? ""] ?? 0) + earned;
        }
        const board = wofPublicBoard(w);
        w.isFreePlay = false;

        if (isPuzzleSolved(w)) {
          // Award controller's accumulated round earnings to their total
          const ctrl2 = room.players.find((p) => p.id === w.controllerId);
          if (ctrl2) ctrl2.score += w.roundEarnings[w.controllerId ?? ""] ?? 0;
          w.phase = "puzzle-over";
          io.to(room.code).emit("wof-letter-result", {
            letter: l,
            count,
            correct: true,
            scoreEarned: earned,
            board,
            revealedLetters: Array.from(w.revealedLetters),
            guessedLetters: Array.from(w.guessedLetters),
            controllerId: w.controllerId,
            scores: wofScoresWire(room, w),
          });
          setTimeout(() => {
            const live = rooms.get(room.code);
            if (!live?.wof || live.wof.phase !== "puzzle-over") return;
            finishWofPuzzle(io, live);
          }, 1500);
          return;
        }

        // Stay on controller's turn — they can spin again or solve
        w.phase = "spinning";
        io.to(room.code).emit("wof-letter-result", {
          letter: l,
          count,
          correct: true,
          scoreEarned: earned,
          board,
          revealedLetters: Array.from(w.revealedLetters),
          guessedLetters: Array.from(w.guessedLetters),
          controllerId: w.controllerId,
          scores: wofScoresWire(room, w),
        });
        const ctrl = room.players.find((p) => p.id === w.controllerId);
        if (ctrl?.isBot) scheduleBotWofTurn(io, room);
      } else {
        // No letters found — pass turn
        w.isFreePlay = false;
        const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
        w.controllerId = advanceController(w.controllerId, nonHostIds);
        w.phase = "spinning";
        io.to(room.code).emit("wof-letter-result", {
          letter: l,
          count: 0,
          correct: false,
          scoreEarned: 0,
          board: wofPublicBoard(w),
          revealedLetters: Array.from(w.revealedLetters),
          guessedLetters: Array.from(w.guessedLetters),
          controllerId: w.controllerId,
          scores: wofScoresWire(room, w),
        });
        const nextController = room.players.find((p) => p.id === w.controllerId);
        if (nextController?.isBot) scheduleBotWofTurn(io, room);
      }
    });

    socket.on("wof-buy-vowel", ({ roomCode, letter }: { roomCode: string; letter: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      const w = room.wof;
      if (w.phase !== "spinning") return;
      if (w.pendingSolve) return; // block while awaiting host judgment
      if (socket.id !== w.controllerId && socket.id !== room.hostId) return;
      room.lastActivity = Date.now();

      const l = letter.toUpperCase().trim();
      if (!VOWELS.has(l)) return;
      if (w.guessedLetters.has(l)) return;

      const controller = room.players.find((p) => p.id === w.controllerId);
      if (!controller) return;
      const controllerRoundEarnings = w.roundEarnings[w.controllerId ?? ""] ?? 0;
      if (controllerRoundEarnings < VOWEL_COST) return;

      w.roundEarnings[w.controllerId ?? ""] = controllerRoundEarnings - VOWEL_COST;
      w.guessedLetters.add(l);
      w.currentSpin = null;

      const puzzle = currentPuzzle(w);
      const count = getLetterPositions(puzzle.answer, l).length;
      if (count > 0) w.revealedLetters.add(l);

      const board = wofPublicBoard(w);

      if (isPuzzleSolved(w)) {
        // Award controller's accumulated round earnings before finishing
        const ctrl2 = room.players.find((p) => p.id === w.controllerId);
        if (ctrl2) ctrl2.score += w.roundEarnings[w.controllerId ?? ""] ?? 0;
        w.phase = "puzzle-over";
        io.to(room.code).emit("wof-vowel-result", {
          letter: l,
          count,
          found: count > 0,
          board,
          revealedLetters: Array.from(w.revealedLetters),
          guessedLetters: Array.from(w.guessedLetters),
          controllerId: w.controllerId,
          scores: wofScoresWire(room, w),
        });
        setTimeout(() => {
          const live = rooms.get(room.code);
          if (!live?.wof || live.wof.phase !== "puzzle-over") return;
          finishWofPuzzle(io, live);
        }, 1500);
        return;
      }

      w.phase = "spinning";
      if (count === 0) {
        const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
        w.controllerId = advanceController(w.controllerId, nonHostIds);
      }
      io.to(room.code).emit("wof-vowel-result", {
        letter: l,
        count,
        found: count > 0,
        board,
        revealedLetters: Array.from(w.revealedLetters),
        guessedLetters: Array.from(w.guessedLetters),
        controllerId: w.controllerId,
        scores: wofScoresWire(room, w),
      });
      if (count === 0) {
        const nextController = room.players.find((p) => p.id === w.controllerId);
        if (nextController?.isBot) scheduleBotWofTurn(io, room);
      } else {
        const ctrl = room.players.find((p) => p.id === w.controllerId);
        if (ctrl?.isBot) scheduleBotWofTurn(io, room);
      }
    });

    // Player submits a solve attempt → host must approve/reject via wof-judge
    socket.on("wof-solve-attempt", ({ roomCode, answer }: { roomCode: string; answer: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      const w = room.wof;
      if (w.phase !== "spinning" && w.phase !== "guessing") return;
      if (socket.id !== w.controllerId) return; // only controller can attempt solve
      if (w.pendingSolve) return; // already a pending solve
      room.lastActivity = Date.now();

      const solverId = w.controllerId;
      const solver = room.players.find((p) => p.id === solverId);
      w.pendingSolve = { solverId: solverId ?? "", solverName: solver?.name ?? "Player", answer };

      // Notify host of pending solve
      io.to(room.hostId).emit("wof-solve-pending", {
        solverId,
        solverName: solver?.name ?? "Player",
        answer,
      });
      // Notify everyone that a solve is pending
      io.to(room.code).emit("wof-solve-submitted", {
        solverName: solver?.name ?? "Player",
      });
    });

    // Host judges a pending solve
    socket.on("wof-judge", ({ roomCode, correct }: { roomCode: string; correct: boolean }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      if (room.hostId !== socket.id) return;
      const w = room.wof;
      if (!w.pendingSolve) return;
      room.lastActivity = Date.now();

      const { solverId, solverName, answer } = w.pendingSolve;
      w.pendingSolve = null;

      const puzzle = currentPuzzle(w);
      const solver = room.players.find((p) => p.id === solverId);

      applyWofSolveResult(io, room, w, puzzle, solver ?? null, solverId, solverName, answer, correct);
    });

    // Player says the answer out loud — host hears it directly and judges
    socket.on("wof-solve-verbal", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof) return;
      const w = room.wof;
      if (w.phase !== "spinning" && w.phase !== "guessing") return;
      if (socket.id !== w.controllerId) return;
      if (w.pendingSolve) return;
      room.lastActivity = Date.now();

      const solverId = w.controllerId;
      const solver = room.players.find((p) => p.id === solverId);
      w.pendingSolve = { solverId: solverId ?? "", solverName: solver?.name ?? "Player", answer: "(Say It Out Loud)", isVerbal: true };

      io.to(room.hostId).emit("wof-solve-pending", {
        solverId,
        solverName: solver?.name ?? "Player",
        answer: "(Say It Out Loud)",
        isVerbal: true,
      });
      io.to(room.code).emit("wof-solve-submitted", {
        solverName: solver?.name ?? "Player",
        isVerbal: true,
      });
    });

    socket.on("wof-next-puzzle", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      advanceWofPuzzle(io, room);
    });

    socket.on("wof-end-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.wof || room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      endWofGame(io, room);
    });

    // ===========================================
    // Scattergories: set config (lobby, host only)
    // ===========================================
    socket.on("scattergories-set-config", ({ roomCode, roundCount, difficulty }: { roomCode: string; roundCount?: number; difficulty?: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== "lobby") return;
      if (room.hostId !== socket.id) return;
      if (room.gameType !== "scattergories") return;
      if (typeof roundCount === "number") {
        room.scattergoriesRoundCount = Math.min(Math.max(Math.floor(roundCount), 3), 5);
      }
      if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
        room.scattergoriesDifficulty = difficulty as ScattergoriesDifficulty;
      }
      io.to(roomCode).emit("scattergories-config-changed", {
        roundCount: room.scattergoriesRoundCount ?? 3,
        difficulty: room.scattergoriesDifficulty ?? "medium",
      });
    });

    // ===========================================
    // Scattergories: player submits answers
    // ===========================================
    socket.on("scattergories-submit", ({ roomCode, answers }: { roomCode: string; answers: Record<string, string> }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.scattergories) return;
      const sc = room.scattergories;
      if (sc.phase !== "round") return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.isHost) return;
      room.lastActivity = Date.now();
      player.lastActivity = Date.now();

      sc.submissions.set(socket.id, answers);
      sc.submittedPlayerIds.add(socket.id);

      const nonHostPlayers = room.players.filter((p) => !p.isHost);
      io.to(roomCode).emit("scattergories-submission-progress", {
        submitted: sc.submittedPlayerIds.size,
        total: nonHostPlayers.length,
      });

      if (sc.submittedPlayerIds.size >= nonHostPlayers.length) {
        resolveScattergoriesRound(io, room);
      }
    });

    // ===========================================
    // Scattergories: host skips to results
    // ===========================================
    socket.on("scattergories-skip-to-results", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.scattergories) return;
      if (room.hostId !== socket.id) return;
      if (room.scattergories.phase !== "round") return;
      room.lastActivity = Date.now();
      resolveScattergoriesRound(io, room);
    });

    // ===========================================
    // Scattergories: host starts next round
    // ===========================================
    socket.on("scattergories-next-round", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.scattergories) return;
      if (room.hostId !== socket.id) return;
      if (room.scattergories.phase !== "results") return;
      room.lastActivity = Date.now();
      startScattergoriesRound(io, room);
    });

    // ===========================================
    // Scattergories: host ends the game
    // ===========================================
    socket.on("scattergories-end-game", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.scattergories) return;
      if (room.hostId !== socket.id) return;
      room.lastActivity = Date.now();
      const sc = room.scattergories;
      clearScatTimers(sc);
      sc.phase = "ended";
      room.status = "finished";

      const nonHostPlayers = room.players.filter((p) => !p.isHost);
      const finalScores = [...nonHostPlayers]
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ id: p.id, name: p.name, score: p.score, isBot: p.isBot, rank: i + 1 }));

      io.to(roomCode).emit("game-ended", {
        players: room.players,
        finalScores,
        gameType: "scattergories",
      });
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

// =====================================================================
// Jeopardy helpers — share `rooms`/`io`. Mirror the Pub Quiz pattern.
// =====================================================================
function scoresWire(room: Room) {
  return room.players
    .filter((p) => !p.isHost)
    .map((p) => ({ id: p.id, name: p.name, score: p.score, isBot: p.isBot }));
}

function emitBoardUpdate(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  io.to(room.code).emit("jeopardy-board-update", {
    board: publicBoard(room.jeopardy),
    phase: room.jeopardy.phase,
    controllerId: room.jeopardy.controllerId,
    scores: scoresWire(room),
  });
}

function jeopardyRevealSquare(io: SocketIOServer, room: Room, cat: number, clue: number) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  const square = getClue(j, cat, clue);
  if (!square) return;
  if (j.revealed[cat]?.[clue]) return;

  j.revealed[cat]![clue] = true;
  const isDD = isDailyDouble(j, cat, clue);
  j.active = {
    cat,
    clue,
    category: j.pack.categories[cat]!.name,
    value: square.value,
    question: square.question,
    answer: square.answer,
    isDailyDouble: isDD,
  };
  j.lockedOut = new Set();
  j.buzzedInId = null;
  j.ddWager = 0;

  if (isDD) {
    j.phase = "dd-wager";
    const controller = room.players.find((p) => p.id === j.controllerId);
    const max = controller
      ? maxDailyDoubleWager(controller.score, square.value)
      : square.value;
    io.to(room.code).emit("jeopardy-daily-double", {
      cat,
      clue,
      category: j.pack.categories[cat]!.name,
      value: square.value,
      controllerId: j.controllerId,
      controllerName: controller?.name ?? "Player",
      maxWager: max,
      timerEndAt: 0,
    });
    setJeopardyTimer(j, JEOPARDY_TIMING.dailyDoubleWagerMs, () => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "dd-wager") return;
      // Default a non-responding player to a minimum wager (the value of the square).
      live.jeopardy.ddWager = Math.min(square.value, controller ? maxDailyDoubleWager(controller.score, square.value) : square.value);
      startDailyDoubleClue(io, live);
    });
    j.timerEndAt = Date.now() + JEOPARDY_TIMING.dailyDoubleWagerMs;

    // Bot DD wager?
    if (controller?.isBot) {
      setTimeout(() => {
        const live = rooms.get(room.code);
        if (!live?.jeopardy || live.jeopardy.phase !== "dd-wager") return;
        const bot = live.players.find((p) => p.id === controller.id);
        if (!bot) return;
        live.jeopardy.ddWager = botDailyDoubleWager(bot.score, square.value);
        startDailyDoubleClue(io, live);
      }, jrand(JEOPARDY_BOT_DELAYS.ddWagerMinMs, JEOPARDY_BOT_DELAYS.ddWagerMaxMs));
    }
    return;
  }

  // Regular clue — show it, then arm the buzzer after a short suspense delay.
  j.phase = "clue-reveal";
  io.to(room.code).emit("jeopardy-clue-revealed", {
    active: activeClueWire(j.active),
    buzzerArmDelayMs: JEOPARDY_TIMING.buzzerArmDelayMs,
  });

  setJeopardyTimer(j, JEOPARDY_TIMING.buzzerArmDelayMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "clue-reveal") return;
    openJeopardyBuzzer(io, live);
  });
}

function openJeopardyBuzzer(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  j.phase = "buzzer-open";
  io.to(room.code).emit("jeopardy-buzzer-open", {
    timerEndAt: Date.now() + JEOPARDY_TIMING.buzzerWindowMs,
  });
  setJeopardyTimer(j, JEOPARDY_TIMING.buzzerWindowMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "buzzer-open") return;
    // Nobody buzzed → reveal the answer and move on (no penalties).
    finishJeopardyClue(io, live, /*revealAnswer=*/ true);
  });

  // Schedule each unlocked bot to attempt a buzz with a small jitter.
  const bots = room.players.filter((p) => p.isBot && !p.isHost && !j.lockedOut.has(p.id));
  bots.forEach((bot) => {
    const delay = jrand(JEOPARDY_BOT_DELAYS.buzzMinMs, JEOPARDY_BOT_DELAYS.buzzMaxMs);
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "buzzer-open") return;
      if (live.jeopardy.buzzedInId) return; // someone already won
      if (live.jeopardy.lockedOut.has(bot.id)) return;
      acceptJeopardyBuzz(io, live, bot.id);
    }, delay);
  });
}

function acceptJeopardyBuzz(io: SocketIOServer, room: Room, playerId: string) {
  if (!room.jeopardy || !room.jeopardy.active) return;
  const j = room.jeopardy;
  j.buzzedInId = playerId;
  j.phase = "answering";
  const player = room.players.find((p) => p.id === playerId);
  io.to(room.code).emit("jeopardy-buzzed", {
    playerId,
    playerName: player?.name ?? "Player",
    timerEndAt: Date.now() + JEOPARDY_TIMING.answerWindowMs,
  });
  setJeopardyTimer(j, JEOPARDY_TIMING.answerWindowMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "answering") return;
    // Treat timeout as incorrect.
    resolveJeopardyAnswer(io, live, false);
  });

  // If a bot buzzed, auto-judge after a short "thinking" delay.
  if (player?.isBot) {
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "answering") return;
      if (live.jeopardy.buzzedInId !== playerId) return;
      resolveJeopardyAnswer(io, live, botGuessesCorrect());
    }, jrand(800, 2200));
  }
}

function resolveJeopardyAnswer(io: SocketIOServer, room: Room, correct: boolean) {
  if (!room.jeopardy || !room.jeopardy.active || !room.jeopardy.buzzedInId) return;
  const j = room.jeopardy;
  const active = j.active!;
  const playerId: string = j.buzzedInId!;
  const value = active.value;
  const player = room.players.find((p) => p.id === playerId);

  if (player) {
    if (correct) player.score += value;
    else player.score -= value;
  }

  io.to(room.code).emit("jeopardy-answer-resolved", {
    playerId,
    playerName: player?.name ?? "Player",
    correct,
    delta: correct ? value : -value,
    correctAnswer: correct ? active.answer : undefined,
    scores: scoresWire(room),
  });

  if (correct) {
    // Picker keeps control; clear the clue and return to picking (or Final).
    j.controllerId = playerId;
    finishJeopardyClue(io, room, /*revealAnswer=*/ false);
    return;
  }

  // Wrong — lock this player out, reopen the buzzer if anyone is still eligible.
  j.lockedOut.add(playerId);
  j.buzzedInId = null;
  clearJeopardyTimer(j);

  const eligible = room.players.filter(
    (p) => !p.isHost && !j.lockedOut.has(p.id),
  );
  if (eligible.length === 0) {
    finishJeopardyClue(io, room, /*revealAnswer=*/ true);
    return;
  }
  openJeopardyBuzzer(io, room);
}

function finishJeopardyClue(io: SocketIOServer, room: Room, revealAnswer: boolean) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  clearJeopardyTimer(j);
  const finishedAnswer = j.active?.answer;

  io.to(room.code).emit("jeopardy-clue-ended", {
    correctAnswer: revealAnswer ? finishedAnswer : null,
    scores: scoresWire(room),
  });

  j.active = null;
  j.buzzedInId = null;
  j.lockedOut = new Set();

  if (isBoardCleared(j)) {
    j.phase = "final-intro";
    io.to(room.code).emit("jeopardy-final-intro", {
      category: j.pack.final.category,
      scores: scoresWire(room),
    });
    return;
  }

  // If nobody got the last clue right, the controller keeps control. If they
  // did, controllerId was already updated. If we never had a controller (game
  // start) fall back to the highest scoring player.
  if (!j.controllerId) {
    const lead = scoresWire(room).slice().sort((a, b) => b.score - a.score)[0];
    j.controllerId = lead?.id ?? null;
  }

  // Add a short "between clues" pause so the host TV can show the answer.
  j.phase = "between-clues";
  emitBoardUpdate(io, room);

  setTimeout(() => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "between-clues") return;
    live.jeopardy.phase = "picking";
    emitBoardUpdate(io, live);
    const ctrl = live.players.find((p) => p.id === live.jeopardy!.controllerId);
    if (ctrl?.isBot) scheduleBotJeopardyPick(io, live);
  }, 2000);
}

function scheduleBotJeopardyPick(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  setTimeout(() => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "picking") return;
    if (live.jeopardy.controllerId !== j.controllerId) return;
    // Pick a random unrevealed square.
    const choices: Array<{ cat: number; clue: number }> = [];
    live.jeopardy.revealed.forEach((row, ci) => {
      row.forEach((rev, qi) => { if (!rev) choices.push({ cat: ci, clue: qi }); });
    });
    if (choices.length === 0) return;
    const pick = choices[Math.floor(Math.random() * choices.length)]!;
    jeopardyRevealSquare(io, live, pick.cat, pick.clue);
  }, jrand(1200, 2800));
}

function startDailyDoubleClue(io: SocketIOServer, room: Room) {
  if (!room.jeopardy || !room.jeopardy.active) return;
  const j = room.jeopardy;
  const active = j.active!;
  clearJeopardyTimer(j);
  j.phase = "dd-clue";
  io.to(room.code).emit("jeopardy-dd-clue", {
    active: activeClueWire(active),
    wager: j.ddWager,
    controllerId: j.controllerId,
    timerEndAt: Date.now() + JEOPARDY_TIMING.dailyDoubleAnswerMs,
  });

  setJeopardyTimer(j, JEOPARDY_TIMING.dailyDoubleAnswerMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "dd-clue") return;
    resolveDailyDouble(io, live, false);
  });

  // Bot auto-answer
  const controller = room.players.find((p) => p.id === j.controllerId);
  if (controller?.isBot) {
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "dd-clue") return;
      resolveDailyDouble(io, live, botGuessesCorrect());
    }, jrand(1200, 3200));
  }
}

function resolveDailyDouble(io: SocketIOServer, room: Room, correct: boolean) {
  if (!room.jeopardy || !room.jeopardy.active) return;
  const j = room.jeopardy;
  const active = j.active!;
  const playerId = j.controllerId;
  const player = playerId ? room.players.find((p) => p.id === playerId) : undefined;
  const wager = j.ddWager;
  if (player) {
    if (correct) player.score += wager;
    else player.score -= wager;
  }
  io.to(room.code).emit("jeopardy-answer-resolved", {
    playerId,
    playerName: player?.name ?? "Player",
    correct,
    delta: correct ? wager : -wager,
    correctAnswer: active.answer,
    scores: scoresWire(room),
    isDailyDouble: true,
  });
  // Whether right or wrong, the controller keeps control on a Daily Double.
  finishJeopardyClue(io, room, /*revealAnswer=*/ true);
}

function startJeopardyFinal(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  j.phase = "final-wager";
  j.finalWagers = {};
  j.finalAnswers = {};
  j.finalResolved = false;
  const eligible = room.players.filter((p) => !p.isHost && p.score > 0);
  // Anyone non-positive wagers 0 by default.
  room.players.filter((p) => !p.isHost && p.score <= 0).forEach((p) => {
    j.finalWagers[p.id] = 0;
  });

  io.to(room.code).emit("jeopardy-final-wager-open", {
    category: j.pack.final.category,
    timerEndAt: Date.now() + JEOPARDY_TIMING.finalWagerMs,
    eligiblePlayerIds: eligible.map((p) => p.id),
  });

  setJeopardyTimer(j, JEOPARDY_TIMING.finalWagerMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "final-wager") return;
    // Default any missing wagers to 0 and proceed.
    live.players.filter((p) => !p.isHost).forEach((p) => {
      if (live.jeopardy!.finalWagers[p.id] == null) live.jeopardy!.finalWagers[p.id] = 0;
    });
    revealFinalQuestion(io, live);
  });

  // Bot wagers
  const leader = Math.max(0, ...eligible.map((p) => p.score));
  room.players.filter((p) => p.isBot && !p.isHost && p.score > 0).forEach((bot) => {
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "final-wager") return;
      live.jeopardy.finalWagers[bot.id] = botFinalWager(bot.score, leader);
      broadcastFinalProgress(io, live);
    }, jrand(JEOPARDY_BOT_DELAYS.finalWagerMinMs, JEOPARDY_BOT_DELAYS.finalWagerMaxMs));
  });
}

function broadcastFinalProgress(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  const nonHosts = room.players.filter((p) => !p.isHost);
  if (j.phase === "final-wager") {
    const wagered = nonHosts.filter((p) => j.finalWagers[p.id] != null).length;
    io.to(room.code).emit("jeopardy-final-progress", {
      stage: "wager",
      submitted: wagered,
      total: nonHosts.length,
    });
    if (wagered >= nonHosts.length) revealFinalQuestion(io, room);
  } else if (j.phase === "final-clue") {
    const answered = nonHosts.filter((p) => j.finalAnswers[p.id] != null).length;
    io.to(room.code).emit("jeopardy-final-progress", {
      stage: "answer",
      submitted: answered,
      total: nonHosts.length,
    });
    if (answered >= nonHosts.length) revealJeopardyFinal(io, room);
  }
}

function revealFinalQuestion(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  clearJeopardyTimer(j);
  j.phase = "final-clue";
  io.to(room.code).emit("jeopardy-final-clue", {
    category: j.pack.final.category,
    question: j.pack.final.question,
    timerEndAt: Date.now() + JEOPARDY_TIMING.finalAnswerMs,
  });

  setJeopardyTimer(j, JEOPARDY_TIMING.finalAnswerMs, () => {
    const live = rooms.get(room.code);
    if (!live?.jeopardy || live.jeopardy.phase !== "final-clue") return;
    revealJeopardyFinal(io, live);
  });

  // Bot final answers.
  room.players.filter((p) => p.isBot && !p.isHost).forEach((bot) => {
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.jeopardy || live.jeopardy.phase !== "final-clue") return;
      const correct = botFinalGuessesCorrect();
      live.jeopardy.finalAnswers[bot.id] = {
        raw: correct ? "(bot guess: correct)" : "(bot guess: incorrect)",
        correct,
      };
      broadcastFinalProgress(io, live);
    }, jrand(JEOPARDY_BOT_DELAYS.finalAnswerMinMs, JEOPARDY_BOT_DELAYS.finalAnswerMaxMs));
  });
}

function applyFinalScores(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  // Scores are applied off the original scores from before final.
  // To make this idempotent, recompute from the deltas implied by current state.
  // We track a pre-final snapshot the first time we apply.
  if (!j.finalResolved) {
    (j as JeopardyState & { _preFinalScores?: Record<string, number> })._preFinalScores =
      Object.fromEntries(room.players.map((p) => [p.id, p.score]));
  }
  const snap = (j as JeopardyState & { _preFinalScores?: Record<string, number> })._preFinalScores!;
  room.players.forEach((p) => {
    if (p.isHost) return;
    const before = snap[p.id] ?? 0;
    const wager = j.finalWagers[p.id] ?? 0;
    const ans = j.finalAnswers[p.id];
    const delta = ans?.correct ? wager : -wager;
    p.score = before + delta;
  });
  j.finalResolved = true;
  io.to(room.code).emit("jeopardy-final-scored", {
    scores: scoresWire(room),
    perPlayer: room.players
      .filter((p) => !p.isHost)
      .map((p) => ({
        id: p.id,
        name: p.name,
        wager: j.finalWagers[p.id] ?? 0,
        answer: j.finalAnswers[p.id]?.raw ?? "",
        correct: j.finalAnswers[p.id]?.correct ?? false,
        score: p.score,
      })),
  });
}

function revealJeopardyFinal(io: SocketIOServer, room: Room) {
  if (!room.jeopardy) return;
  const j = room.jeopardy;
  clearJeopardyTimer(j);
  j.phase = "final-reveal";
  io.to(room.code).emit("jeopardy-final-reveal", {
    correctAnswer: j.pack.final.answer,
    perPlayer: room.players
      .filter((p) => !p.isHost)
      .map((p) => ({
        id: p.id,
        name: p.name,
        wager: j.finalWagers[p.id] ?? 0,
        answer: j.finalAnswers[p.id]?.raw ?? "(no answer)",
        correct: j.finalAnswers[p.id]?.correct ?? false,
      })),
  });
  applyFinalScores(io, room);
}

function endJeopardyGame(io: SocketIOServer, room: Room) {
  if (room.jeopardy) clearJeopardyTimer(room.jeopardy);
  room.status = "finished";
  const sorted = jeopardyLeaderboard(room.players);
  io.to(room.code).emit("game-ended", {
    gameType: "jeopardy",
    pack: room.jeopardy ? jeopardyPackSummary(room.jeopardy.pack) : null,
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

// ============================================================
// Wheel of Fortune helpers
// ============================================================

function wofScoresWire(room: Room, w: WofState) {
  return room.players
    .filter((p) => !p.isHost)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      roundEarnings: w.roundEarnings[p.id] ?? 0,
      isBot: p.isBot,
    }));
}

function applyWofSolveResult(
  io: SocketIOServer,
  room: Room,
  w: WofState,
  puzzle: ReturnType<typeof currentPuzzle>,
  solver: { id: string; score: number; name: string } | null,
  solverId: string,
  solverName: string,
  _answer: string,
  correct: boolean,
) {
  if (correct) {
    if (solver) {
      solver.score += w.roundEarnings[solverId] ?? 0;
    }
    puzzle.answer.toUpperCase().replace(/\s/g, "").split("").forEach((l) => w.revealedLetters.add(l));
    w.phase = "puzzle-over";
    io.to(room.code).emit("wof-solve-result", {
      correct: true,
      answer: puzzle.answer,
      solverId,
      solverName,
      board: wofPublicBoard(w),
      revealedLetters: Array.from(w.revealedLetters),
      scores: wofScoresWire(room, w),
    });
    setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.wof || live.wof.phase !== "puzzle-over") return;
      finishWofPuzzle(io, live);
    }, 2000);
  } else {
    const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
    w.controllerId = advanceController(w.controllerId, nonHostIds);
    io.to(room.code).emit("wof-solve-result", {
      correct: false,
      answer: null,
      solverId,
      solverName,
      board: wofPublicBoard(w),
      revealedLetters: Array.from(w.revealedLetters),
      scores: wofScoresWire(room, w),
    });
    const nextController = room.players.find((p) => p.id === w.controllerId);
    if (nextController?.isBot) scheduleBotWofTurn(io, room);
  }
}

function finishWofPuzzle(io: SocketIOServer, room: Room) {
  if (!room.wof) return;
  const w = room.wof;
  const puzzle = currentPuzzle(w);
  const isLastPuzzle = w.puzzleIndex >= w.roundCount - 1;

  io.to(room.code).emit("wof-puzzle-over", {
    answer: puzzle.answer,
    category: puzzle.category,
    board: wofPublicBoard(w),
    scores: wofScoresWire(room, w),
    puzzleIndex: w.puzzleIndex,
    totalPuzzles: w.roundCount,
    isLastPuzzle,
  });
}

function advanceWofPuzzle(io: SocketIOServer, room: Room) {
  if (!room.wof) return;
  const w = room.wof;

  if (w.puzzleIndex >= w.roundCount - 1) {
    endWofGame(io, room);
    return;
  }

  w.puzzleIndex++;
  w.revealedLetters = new Set();
  w.guessedLetters = new Set();
  w.roundEarnings = {};
  w.currentSpin = null;
  w.currentSpinIndex = null;
  w.isFreePlay = false;
  w.phase = "spinning";
  w.pendingSolve = null;

  // Rotate controller to next player
  const nonHostIds = room.players.filter((p) => !p.isHost).map((p) => p.id);
  w.controllerId = advanceController(w.controllerId, nonHostIds);

  const puzzle = currentPuzzle(w);
  io.to(room.code).emit("wof-next-puzzle", {
    board: wofPublicBoard(w),
    category: puzzle.category,
    hint: puzzle.hint ?? null,
    controllerId: w.controllerId,
    puzzleIndex: w.puzzleIndex,
    totalPuzzles: w.roundCount,
    revealedLetters: [],
    guessedLetters: [],
    scores: wofScoresWire(room, w),
  });

  const ctrl = room.players.find((p) => p.id === w.controllerId);
  if (ctrl?.isBot) scheduleBotWofTurn(io, room);
}

function endWofGame(io: SocketIOServer, room: Room) {
  room.status = "finished";
  const sorted = [...room.players]
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);
  io.to(room.code).emit("game-ended", {
    gameType: "wheel-of-fortune",
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

function scheduleBotWofTurn(io: SocketIOServer, room: Room) {
  if (!room.isDemo || !room.wof) return;
  const w = room.wof;
  const controllerId = w.controllerId;

  setTimeout(() => {
    const live = rooms.get(room.code);
    if (!live?.wof || live.wof.controllerId !== controllerId) return;
    if (live.wof.phase !== "spinning") return;
    const ctrl = live.players.find((p) => p.id === controllerId);
    if (!ctrl?.isBot) return;

    // Bots sometimes try to solve if enough letters are revealed
    const puzzle = currentPuzzle(live.wof);
    const totalLetters = new Set(puzzle.answer.toUpperCase().replace(/\s/g, "").split("")).size;
    const revealedCount = live.wof.revealedLetters.size;
    if (revealedCount >= Math.floor(totalLetters * 0.6) && Math.random() < 0.4) {
      live.wof.phase = "spinning"; // ensure phase is right before fake solve
      // Emit a bot solve attempt
      const correct = Math.random() < 0.55;
      const answer = correct ? puzzle.answer : "WRONG ANSWER";
      const solverId = controllerId;
      const solver = live.players.find((p) => p.id === solverId);
      if (correct) {
        if (solver) {
          solver.score += live.wof.roundEarnings[solverId ?? ""] ?? 0;
        }
        puzzle.answer.toUpperCase().replace(/\s/g, "").split("").forEach((l) => live.wof!.revealedLetters.add(l));
        live.wof.phase = "puzzle-over";
        io.to(live.code).emit("wof-solve-result", {
          correct: true,
          answer: puzzle.answer,
          solverId,
          solverName: solver?.name ?? "Bot",
          board: wofPublicBoard(live.wof),
          revealedLetters: Array.from(live.wof.revealedLetters),
          scores: wofScoresWire(live, live.wof),
        });
        setTimeout(() => {
          const l2 = rooms.get(room.code);
          if (!l2?.wof || l2.wof.phase !== "puzzle-over") return;
          finishWofPuzzle(io, l2);
        }, 2000);
        return;
      } else {
        const nonHostIds = live.players.filter((p) => !p.isHost).map((p) => p.id);
        live.wof.controllerId = advanceController(live.wof.controllerId, nonHostIds);
        io.to(live.code).emit("wof-solve-result", {
          correct: false,
          answer: null,
          solverId,
          solverName: solver?.name ?? "Bot",
          board: wofPublicBoard(live.wof),
          revealedLetters: Array.from(live.wof.revealedLetters),
          scores: wofScoresWire(live, live.wof),
        });
        const next = live.players.find((p) => p.id === live.wof!.controllerId);
        if (next?.isBot) scheduleBotWofTurn(io, live);
        return;
      }
    }

    // Occasionally buy a vowel if affordable and unguessed vowels remain (25% chance)
    const botRoundEarnings = live.wof.roundEarnings[controllerId ?? ""] ?? 0;
    const unguessedVowels = ["A", "E", "I", "O", "U"].filter(v => !live.wof!.guessedLetters.has(v));
    if (botRoundEarnings >= VOWEL_COST && unguessedVowels.length > 0 && Math.random() < 0.25) {
      const vowel = unguessedVowels[Math.floor(Math.random() * unguessedVowels.length)]!;
      live.wof.roundEarnings[controllerId ?? ""] = botRoundEarnings - VOWEL_COST;
      live.wof.guessedLetters.add(vowel);
      const puzzle = currentPuzzle(live.wof);
      const count = getLetterPositions(puzzle.answer, vowel).length;
      if (count > 0) live.wof.revealedLetters.add(vowel);
      const board = wofPublicBoard(live.wof);
      if (isPuzzleSolved(live.wof)) {
        const ctrl2 = live.players.find((p) => p.id === controllerId);
        if (ctrl2) ctrl2.score += live.wof.roundEarnings[controllerId ?? ""] ?? 0;
        live.wof.phase = "puzzle-over";
        io.to(live.code).emit("wof-vowel-result", { letter: vowel, count, found: count > 0, board, revealedLetters: Array.from(live.wof.revealedLetters), guessedLetters: Array.from(live.wof.guessedLetters), controllerId, scores: wofScoresWire(live, live.wof) });
        setTimeout(() => { const l2 = rooms.get(room.code); if (l2?.wof?.phase === "puzzle-over") finishWofPuzzle(io, l2); }, 1500);
        return;
      }
      live.wof.phase = "spinning";
      if (count === 0) {
        const nonHostIds = live.players.filter((p) => !p.isHost).map((p) => p.id);
        live.wof.controllerId = advanceController(live.wof.controllerId, nonHostIds);
      }
      io.to(live.code).emit("wof-vowel-result", { letter: vowel, count, found: count > 0, board, revealedLetters: Array.from(live.wof.revealedLetters), guessedLetters: Array.from(live.wof.guessedLetters), controllerId: live.wof.controllerId, scores: wofScoresWire(live, live.wof) });
      if (count === 0) {
        const next = live.players.find((p) => p.id === live.wof!.controllerId);
        if (next?.isBot) scheduleBotWofTurn(io, live);
      } else {
        scheduleBotWofTurn(io, live);
      }
      return;
    }

    // Spin the wheel
    const { value, spinIndex } = spinWheel();
    live.wof.currentSpin = value;
    live.wof.currentSpinIndex = spinIndex;
    const controllerName = ctrl.name;

    if (value === "BANKRUPT") {
      live.wof.roundEarnings[controllerId ?? ""] = 0;
      const nonHostIds = live.players.filter((p) => !p.isHost).map((p) => p.id);
      live.wof.controllerId = advanceController(live.wof.controllerId, nonHostIds);
      live.wof.isFreePlay = false;
      io.to(live.code).emit("wof-spun", { value, spinIndex, type: "bankrupt", controllerId: live.wof.controllerId, controllerName, scores: wofScoresWire(live, live.wof) });
      const next = live.players.find((p) => p.id === live.wof!.controllerId);
      if (next?.isBot) scheduleBotWofTurn(io, live);
      return;
    }
    if (value === "LOSE_A_TURN") {
      const nonHostIds = live.players.filter((p) => !p.isHost).map((p) => p.id);
      live.wof.controllerId = advanceController(live.wof.controllerId, nonHostIds);
      live.wof.isFreePlay = false;
      io.to(live.code).emit("wof-spun", { value, spinIndex, type: "lose-a-turn", controllerId: live.wof.controllerId, controllerName, scores: wofScoresWire(live, live.wof) });
      const next = live.players.find((p) => p.id === live.wof!.controllerId);
      if (next?.isBot) scheduleBotWofTurn(io, live);
      return;
    }
    if (value === "FREE_PLAY") {
      live.wof.isFreePlay = true;
      live.wof.phase = "guessing";
      io.to(live.code).emit("wof-spun", { value, spinIndex, type: "free-play", isFreePlay: true, controllerId: live.wof.controllerId, controllerName, scores: wofScoresWire(live, live.wof) });
      scheduleBotWofGuess(io, live);
      return;
    }
    live.wof.phase = "guessing";
    live.wof.isFreePlay = false;
    io.to(live.code).emit("wof-spun", { value, spinIndex, type: "dollar", isFreePlay: false, controllerId: live.wof.controllerId, controllerName, scores: wofScoresWire(live, live.wof) });
    scheduleBotWofGuess(io, live);
  }, wofRand(1200, 2800));
}

// ==============================================
// Scattergories helper functions
// ==============================================

function startScattergoriesRound(io: SocketIOServer, room: Room) {
  const sc = room.scattergories!;
  sc.phase = "round";
  sc.currentRound += 1;
  sc.submissions = new Map();
  sc.submittedPlayerIds = new Set();

  const letter = pickScatLetter(sc.usedLetters);
  sc.currentLetter = letter;
  sc.usedLetters.push(letter);

  const categories = pickCategories(CATEGORIES_PER_ROUND, sc.usedCategoryIds);
  sc.currentCategories = categories;
  sc.usedCategoryIds.push(...categories.map((c) => c.id));

  const durationMs = TIMER_DURATIONS_MS[sc.difficulty];
  const startedAt = Date.now();
  sc.timerEndAt = startedAt + durationMs;

  io.to(room.code).emit("scattergories-round-started", {
    round: sc.currentRound,
    totalRounds: sc.roundCount,
    letter,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    timerEndAt: sc.timerEndAt,
    difficulty: sc.difficulty,
  });

  if (room.isDemo) {
    scheduleBotScattergoriesAnswers(io, room, letter, categories, startedAt, durationMs);
  }

  const alertDelay = durationMs - 10_000;
  if (alertDelay > 0) {
    sc.alertHandle = setTimeout(() => {
      const live = rooms.get(room.code);
      if (!live?.scattergories || live.scattergories.phase !== "round") return;
      if (live.scattergories.currentLetter !== letter) return;
      io.to(room.code).emit("scattergories-10-second-alert");
    }, alertDelay) as unknown as ReturnType<typeof setTimeout>;
  }

  sc.timerHandle = setTimeout(() => {
    const live = rooms.get(room.code);
    if (!live?.scattergories || live.scattergories.phase !== "round") return;
    if (live.scattergories.currentLetter !== letter) return;
    resolveScattergoriesRound(io, live);
  }, durationMs) as unknown as ReturnType<typeof setTimeout>;
}

function resolveScattergoriesRound(io: SocketIOServer, room: Room) {
  const sc = room.scattergories!;
  clearScatTimers(sc);
  sc.phase = "results";

  const nonHostPlayers = room.players.filter((p) => !p.isHost);
  const results = scoreScattergoriesRound(sc.currentCategories, sc.submissions, nonHostPlayers, sc.currentLetter);

  const roundScoreMap: Record<string, number> = {};
  results.forEach((cat: CategoryResult) => {
    cat.answers.forEach((a) => {
      roundScoreMap[a.playerId] = (roundScoreMap[a.playerId] ?? 0) + a.pointsEarned;
    });
  });

  nonHostPlayers.forEach((p) => {
    p.score += roundScoreMap[p.id] ?? 0;
  });

  const roundScores = nonHostPlayers.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    roundScore: roundScoreMap[p.id] ?? 0,
    isBot: p.isBot,
  }));

  const leaderboard = [...nonHostPlayers]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ id: p.id, name: p.name, score: p.score, isBot: p.isBot, rank: i + 1 }));

  io.to(room.code).emit("scattergories-results", {
    round: sc.currentRound,
    totalRounds: sc.roundCount,
    letter: sc.currentLetter,
    results,
    roundScores,
    leaderboard,
    isLastRound: sc.currentRound >= sc.roundCount,
  });
}

function scheduleBotScattergoriesAnswers(
  io: SocketIOServer,
  room: Room,
  letter: string,
  categories: Array<{ id: string; name: string }>,
  startedAt: number,
  durationMs: number,
) {
  const bots = room.players.filter((p) => p.isBot && !p.isHost);
  bots.forEach((bot) => {
    const delay = Math.floor(durationMs * (0.25 + Math.random() * 0.5));
    setTimeout(() => {
      const live = rooms.get(room.code);
      const sc = live?.scattergories;
      if (!sc || sc.phase !== "round" || sc.currentLetter !== letter) return;
      if (Date.now() - startedAt > durationMs - 2000) return;

      const answers: Record<string, string> = {};
      const letterPool = BOT_ANSWER_POOL[letter] ?? [];
      categories.forEach((cat) => {
        if (Math.random() < 0.18) { answers[cat.id] = ""; return; }
        if (letterPool.length === 0) { answers[cat.id] = ""; return; }
        answers[cat.id] = letterPool[Math.floor(Math.random() * letterPool.length)]!;
      });

      sc.submissions.set(bot.id, answers);
      sc.submittedPlayerIds.add(bot.id);

      const nonHostPlayers = live!.players.filter((p) => !p.isHost);
      io.to(live!.code).emit("scattergories-submission-progress", {
        submitted: sc.submittedPlayerIds.size,
        total: nonHostPlayers.length,
      });

      if (sc.submittedPlayerIds.size >= nonHostPlayers.length) {
        resolveScattergoriesRound(io, live!);
      }
    }, delay);
  });
}

function scheduleBotWofGuess(io: SocketIOServer, room: Room) {
  if (!room.isDemo || !room.wof) return;
  const w = room.wof;
  const controllerId = w.controllerId;

  setTimeout(() => {
    const live = rooms.get(room.code);
    if (!live?.wof || live.wof.controllerId !== controllerId) return;
    if (live.wof.phase !== "guessing") return;
    const ctrl = live.players.find((p) => p.id === controllerId);
    if (!ctrl?.isBot) return;

    // During FREE PLAY, bots may also pick vowels (30% chance if unguessed vowels remain)
    let letter: string | null = null;
    if (live.wof.isFreePlay && Math.random() < 0.3) {
      const unguessedVowels = ["A", "E", "I", "O", "U"].filter(v => !live.wof!.guessedLetters.has(v));
      if (unguessedVowels.length > 0) {
        letter = unguessedVowels[Math.floor(Math.random() * unguessedVowels.length)]!;
      }
    }
    if (!letter) letter = botPickConsonant(live.wof.guessedLetters);
    if (!letter) return;

    live.wof.guessedLetters.add(letter);
    const puzzle = currentPuzzle(live.wof);
    const positions = getLetterPositions(puzzle.answer, letter);
    const count = positions.length;

    const isVowelGuess = VOWELS.has(letter);
    if (count > 0) {
      live.wof.revealedLetters.add(letter);
      const spinValue = typeof live.wof.currentSpin === "number" ? live.wof.currentSpin : 500;
      // Vowels (guessed via FREE PLAY) never earn round earnings — they are free turns only
      const earned = isVowelGuess ? 0 : spinValue * count;
      if (earned > 0) {
        live.wof.roundEarnings[controllerId ?? ""] = (live.wof.roundEarnings[controllerId ?? ""] ?? 0) + earned;
      }
      live.wof.isFreePlay = false;
      if (isPuzzleSolved(live.wof)) {
        // Award controller's accumulated round earnings to their total
        const ctrl2 = live.players.find((p) => p.id === controllerId);
        if (ctrl2) ctrl2.score += live.wof.roundEarnings[controllerId ?? ""] ?? 0;
        live.wof.phase = "puzzle-over";
        io.to(live.code).emit("wof-letter-result", { letter, count, correct: true, scoreEarned: earned, board: wofPublicBoard(live.wof), revealedLetters: Array.from(live.wof.revealedLetters), guessedLetters: Array.from(live.wof.guessedLetters), controllerId, scores: wofScoresWire(live, live.wof) });
        setTimeout(() => {
          const l2 = rooms.get(room.code);
          if (!l2?.wof || l2.wof.phase !== "puzzle-over") return;
          finishWofPuzzle(io, l2);
        }, 1500);
        return;
      }
      live.wof.phase = "spinning";
      io.to(live.code).emit("wof-letter-result", { letter, count, correct: true, scoreEarned: earned, board: wofPublicBoard(live.wof), revealedLetters: Array.from(live.wof.revealedLetters), guessedLetters: Array.from(live.wof.guessedLetters), controllerId, scores: wofScoresWire(live, live.wof) });
      scheduleBotWofTurn(io, live);
    } else {
      live.wof.isFreePlay = false;
      const nonHostIds = live.players.filter((p) => !p.isHost).map((p) => p.id);
      live.wof.controllerId = advanceController(live.wof.controllerId, nonHostIds);
      live.wof.phase = "spinning";
      io.to(live.code).emit("wof-letter-result", { letter, count: 0, correct: false, scoreEarned: 0, board: wofPublicBoard(live.wof), revealedLetters: Array.from(live.wof.revealedLetters), guessedLetters: Array.from(live.wof.guessedLetters), controllerId: live.wof.controllerId, scores: wofScoresWire(live, live.wof) });
      const next = live.players.find((p) => p.id === live.wof!.controllerId);
      if (next?.isBot) scheduleBotWofTurn(io, live);
    }
  }, wofRand(800, 2200));
}
