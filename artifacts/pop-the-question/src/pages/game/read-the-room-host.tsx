import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import type { Player } from "@/types/game";

type Phase = "lobby" | "answering" | "solving" | "reveal" | "round-end" | "finished";

interface AnswerCard { id: string; text: string }
interface LeaderboardRow { id: string; name: string; score: number; rank: number; color: string }
interface DartReveal {
  playerId: string;
  playerName: string;
  guessedPlayerId: string;
  guessedPlayerName: string;
  hit: boolean;
}
interface AnswerRevealed {
  round: number;
  revealIndex: number;
  totalReveals: number;
  answer: { id: string; text: string; playerId: string; playerName: string };
  guessedPlayerId: string | null;
  solverCorrect: boolean;
  darts: DartReveal[];
}

const SHADOW = "8px 8px 0 #000";
const BORDER = "5px solid #000";

export default function ReadTheRoomHost() {
  const [, params] = useRoute("/read-the-room/:roomCode/host");
  const roomCode = params?.roomCode || "";
  const [, setLocation] = useLocation();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finished">("lobby");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [totalRounds, setTotalRounds] = useState(5);
  const [currentRound, setCurrentRound] = useState(0);
  const [playerColors, setPlayerColors] = useState<Record<string, string>>({});
  const [presetQuestions, setPresetQuestions] = useState<string[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [solverId, setSolverId] = useState<string | null>(null);
  const [timerEndAt, setTimerEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [submittedCount, setSubmittedCount] = useState(0);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [answerCards, setAnswerCards] = useState<AnswerCard[]>([]);
  const [lastReveal, setLastReveal] = useState<AnswerRevealed | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardRow[]>([]);
  const [roundDelta, setRoundDelta] = useState<Record<string, number>>({});
  const [dartsThrownInfo, setDartsThrownInfo] = useState<Array<{ playerName: string; round: number }>>([]);
  const [showPresetPicker, setShowPresetPicker] = useState(true);

  useEffect(() => {
    if (!roomCode) return;
    const s = io({ path: "/socket.io" });
    setSocket(s);
    s.emit("join-room", { roomCode, playerName: "HOST", isHost: true });

    s.on("player-joined", ({ players: ps }: { players: Player[] }) => {
      setPlayers(ps.filter((p) => !p.isHost));
    });
    s.on("player-left", ({ players: ps }: { players: Player[] }) => {
      setPlayers(ps.filter((p) => !p.isHost));
    });
    s.on("room-state", (data: {
      players: Player[];
      gameType?: string;
      rtrTotalRounds?: number;
      rtrPhase?: Phase | null;
      rtrRound?: number;
      rtrQuestion?: string;
      rtrSolverId?: string | null;
      rtrPlayerColors?: Record<string, string>;
      rtrTimerEndAt?: number;
      status?: string;
    }) => {
      setPlayers(data.players.filter((p) => !p.isHost));
      if (data.rtrTotalRounds) setTotalRounds(data.rtrTotalRounds);
      if (data.rtrPhase) setPhase(data.rtrPhase);
      if (data.rtrRound) setCurrentRound(data.rtrRound);
      if (data.rtrQuestion) setCurrentQuestion(data.rtrQuestion);
      if (data.rtrSolverId !== undefined) setSolverId(data.rtrSolverId);
      if (data.rtrPlayerColors) setPlayerColors(data.rtrPlayerColors);
      if (data.rtrTimerEndAt) setTimerEndAt(data.rtrTimerEndAt);
      if (data.status === "playing") setGameState("playing");
    });
    s.on("game-started", (payload: {
      totalRounds: number;
      playerColors: Record<string, string>;
      presetQuestions: string[];
    }) => {
      setGameState("playing");
      setPhase("lobby");
      setTotalRounds(payload.totalRounds);
      setPlayerColors(payload.playerColors);
      setPresetQuestions(payload.presetQuestions);
      setShowPresetPicker(true);
    });
    s.on("rtr-total-rounds-changed", ({ totalRounds: t }: { totalRounds: number }) => {
      setTotalRounds(t);
    });
    s.on("rtr-round-started", (payload: {
      round: number;
      totalRounds: number;
      question: string;
      solverId: string | null;
      timerEndAt: number;
    }) => {
      setPhase("answering");
      setCurrentRound(payload.round);
      setTotalRounds(payload.totalRounds);
      setCurrentQuestion(payload.question);
      setSolverId(payload.solverId);
      setTimerEndAt(payload.timerEndAt);
      setSubmittedCount(0);
      setSubmittedIds(new Set());
      setAnswerCards([]);
      setLastReveal(null);
      setRevealIndex(0);
      setRoundDelta({});
      setShowPresetPicker(false);
    });
    s.on("rtr-answer-progress", ({ submitted, submittedIds }: { submitted: number; submittedIds: string[] }) => {
      setSubmittedCount(submitted);
      setSubmittedIds(new Set(submittedIds));
    });
    s.on("rtr-solving-phase-start", (payload: {
      solverId: string | null;
      answers: AnswerCard[];
      round: number;
    }) => {
      setPhase("solving");
      setSolverId(payload.solverId);
      setAnswerCards(payload.answers);
      setRevealIndex(0);
      setLastReveal(null);
    });
    s.on("rtr-solving-complete", () => {
      setPhase("reveal");
      setRevealIndex(0);
      setLastReveal(null);
    });
    s.on("rtr-dart-thrown", ({ playerName, round }: { playerName: string; round: number }) => {
      setDartsThrownInfo((prev) => [...prev, { playerName, round }]);
    });
    s.on("rtr-answer-revealed", (payload: AnswerRevealed) => {
      setLastReveal(payload);
      setRevealIndex(payload.revealIndex + 1);
    });
    s.on("rtr-round-end", (payload: {
      round: number;
      delta: Record<string, number>;
      leaderboard: LeaderboardRow[];
      isLastRound: boolean;
    }) => {
      setPhase("round-end");
      setRoundDelta(payload.delta);
      setLeaderboard(payload.leaderboard);
    });
    s.on("rtr-awaiting-question", ({ nextSolverId }: { nextSolverId: string | null }) => {
      setPhase("lobby");
      setSolverId(nextSolverId);
      setSelectedPreset(null);
      setCustomQuestion("");
      setShowPresetPicker(true);
    });
    s.on("game-ended", (payload: { finalScores: LeaderboardRow[] }) => {
      setGameState("finished");
      setPhase("finished");
      setFinalLeaderboard(payload.finalScores);
    });

    return () => { s.disconnect(); };
  }, [roomCode]);

  useEffect(() => {
    if (timerEndAt === 0) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timerEndAt]);

  const secondsLeft = Math.max(0, Math.ceil((timerEndAt - now) / 1000));

  const handleStartGame = () => socket?.emit("start-game", { roomCode });
  const handleStartRound = () => {
    const q = selectedPreset ?? customQuestion.trim();
    if (!q) return;
    socket?.emit("rtr-start-round", { roomCode, question: q });
  };
  const handleSetTotalRounds = (t: number) => {
    socket?.emit("rtr-set-total-rounds", { roomCode, totalRounds: t });
  };
  const handleRevealNext = () => socket?.emit("rtr-reveal-next", { roomCode });
  const handleNextRound = () => socket?.emit("rtr-next-round", { roomCode });
  const handleEndGame = () => socket?.emit("rtr-end-game", { roomCode });

  const playersById = useMemo(() => {
    const map: Record<string, Player> = {};
    players.forEach((p) => { map[p.id] = p; });
    return map;
  }, [players]);

  const solverPlayer = solverId ? playersById[solverId] : null;

  // ============ Render branches ============

  if (gameState === "lobby") {
    return (
      <div className="min-h-screen w-full" style={{ background: "#F5F0E6" }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div
            className="bg-white p-8 mb-8"
            style={{ border: BORDER, boxShadow: SHADOW }}
          >
            <h1 className="font-mono font-black text-6xl md:text-8xl uppercase tracking-tight text-black">
              Read the Room
            </h1>
            <p className="font-mono font-bold text-xl text-black mt-3">
              Answer juicy questions anonymously. Match answers to who said them.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8" style={{ border: BORDER, boxShadow: SHADOW }}>
              <p className="font-mono font-bold text-xl uppercase mb-2">Players join at</p>
              <div
                className="bg-black text-yellow-300 px-6 py-4 mb-4 font-mono font-black text-2xl"
                style={{ border: BORDER, boxShadow: "8px 8px 0 #FF006E" }}
              >
                /join
              </div>
              <p className="font-mono font-bold text-xl uppercase mb-2">Room code</p>
              <div
                className="bg-yellow-300 px-6 py-6 font-mono font-black text-7xl text-center tracking-widest"
                style={{ border: BORDER, boxShadow: "8px 8px 0 #000" }}
              >
                {roomCode}
              </div>
            </div>

            <div className="bg-white p-8" style={{ border: BORDER, boxShadow: SHADOW }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-mono font-black text-3xl uppercase">
                  Players ({players.length})
                </h2>
              </div>
              <div className="space-y-3 min-h-[120px] mb-6">
                {players.length === 0 ? (
                  <p className="font-mono font-bold text-black/40 text-lg uppercase">
                    Waiting for players to join…
                  </p>
                ) : (
                  players.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white px-5 py-3 font-mono font-black text-xl text-black uppercase"
                      style={{ border: BORDER, boxShadow: "4px 4px 0 #000" }}
                    >
                      {p.name}
                    </div>
                  ))
                )}
              </div>

              <div className="mb-4">
                <p className="font-mono font-bold uppercase text-sm mb-2">Total rounds</p>
                <div className="flex gap-2">
                  {[3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleSetTotalRounds(n)}
                      className={`flex-1 py-3 font-mono font-black text-xl ${totalRounds === n ? "bg-[#FF006E] text-white" : "bg-white text-black"}`}
                      style={{ border: BORDER, boxShadow: totalRounds === n ? "6px 6px 0 #000" : "4px 4px 0 #000" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="w-full bg-lime-400 px-8 py-6 font-mono font-black text-3xl uppercase tracking-wide disabled:bg-gray-300 disabled:cursor-not-allowed"
                style={{ border: BORDER, boxShadow: "8px 8px 0 #000" }}
              >
                {players.length < 2 ? "Need 2+ players" : "Start Game →"}
              </button>
            </div>
          </div>

          <button
            onClick={() => setLocation("/host")}
            className="mt-8 bg-white px-6 py-3 font-mono font-black uppercase"
            style={{ border: BORDER, boxShadow: "4px 4px 0 #000" }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (gameState === "finished") {
    return (
      <div className="min-h-screen w-full" style={{ background: "#F5F0E6" }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div
            className="bg-yellow-300 p-8 mb-8 text-center"
            style={{ border: BORDER, boxShadow: SHADOW }}
          >
            <h1 className="font-mono font-black text-6xl uppercase">Final Scores</h1>
          </div>
          <div className="space-y-4">
            {finalLeaderboard.map((p) => (
              <div
                key={p.id}
                className="bg-white p-6 flex items-center justify-between"
                style={{ border: BORDER, boxShadow: SHADOW }}
              >
                <div className="flex items-center gap-6">
                  <span className="font-mono font-black text-5xl">#{p.rank}</span>
                  <div
                    className="font-mono font-black text-3xl px-6 py-3 text-black uppercase"
                    style={{ background: p.color, border: BORDER, boxShadow: "4px 4px 0 #000" }}
                  >
                    {p.name}
                  </div>
                </div>
                <span className="font-mono font-black text-5xl">{p.score}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocation("/host")}
            className="mt-8 w-full bg-white px-6 py-4 font-mono font-black text-xl uppercase"
            style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}
          >
            ← New Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ background: "#F5F0E6" }}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header bar: round / phase */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div
            className="bg-[#FF006E] text-white px-6 py-3 font-mono font-black text-2xl uppercase"
            style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}
          >
            Round {currentRound}/{totalRounds}
          </div>
          <div
            className="bg-cyan-300 px-6 py-3 font-mono font-black text-2xl uppercase"
            style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}
          >
            {phase === "answering" && "✍ Answering"}
            {phase === "solving" && "🧩 Solving"}
            {phase === "reveal" && "🎯 Reveals"}
            {phase === "round-end" && "🏁 Round End"}
            {phase === "lobby" && "📋 Pick Question"}
          </div>
          {phase === "answering" && timerEndAt > 0 && (
            <div
              className="bg-orange-500 text-white px-6 py-3 font-mono font-black text-3xl"
              style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}
            >
              ⏱ {secondsLeft}s
            </div>
          )}
          {solverPlayer && (
            <div
              className="px-6 py-3 font-mono font-black text-xl uppercase text-black"
              style={{ background: playerColors[solverPlayer.id] ?? "#fff", border: BORDER, boxShadow: "6px 6px 0 #000" }}
            >
              SOLVER: {solverPlayer.name}
            </div>
          )}
          <button
            onClick={handleEndGame}
            className="ml-auto bg-white px-4 py-2 font-mono font-black uppercase"
            style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
          >
            End Game
          </button>
        </div>

        {/* Phase: pick question */}
        {phase === "lobby" && showPresetPicker && (
          <div className="bg-white p-8 mb-6" style={{ border: BORDER, boxShadow: SHADOW }}>
            <h2 className="font-mono font-black text-3xl uppercase mb-4">Pick a question</h2>
            <div className="grid md:grid-cols-2 gap-3 mb-6 max-h-96 overflow-y-auto">
              {presetQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedPreset(q)}
                  className={`text-left px-4 py-3 font-mono font-bold text-base ${selectedPreset === q ? "bg-[#FF006E] text-white" : "bg-white"}`}
                  style={{
                    border: "3px solid #000",
                    boxShadow: selectedPreset === q ? "6px 6px 0 #000" : "3px 3px 0 #000",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            <h3 className="font-mono font-black text-xl uppercase mb-3">Or write your own</h3>
            <input
              value={customQuestion}
              onChange={(e) => { setCustomQuestion(e.target.value); setSelectedPreset(null); }}
              placeholder="Type a juicy question..."
              maxLength={280}
              className="w-full px-4 py-4 font-mono font-bold text-xl mb-4 bg-yellow-50"
              style={{ border: BORDER, boxShadow: "4px 4px 0 #000", borderRadius: 0 }}
            />
            <button
              onClick={handleStartRound}
              disabled={!selectedPreset && !customQuestion.trim()}
              className="w-full bg-lime-400 px-6 py-5 font-mono font-black text-2xl uppercase disabled:bg-gray-300"
              style={{ border: BORDER, boxShadow: "8px 8px 0 #000" }}
            >
              Start Answer Phase →
            </button>
          </div>
        )}

        {/* Phase: answering — show question, progress */}
        {phase === "answering" && (
          <div className="bg-white p-10 text-center" style={{ border: BORDER, boxShadow: SHADOW }}>
            <p className="font-mono font-black text-2xl uppercase mb-4 text-black/60">The Question</p>
            <h2 className="font-mono font-black text-5xl md:text-6xl uppercase mb-8 leading-tight">
              {currentQuestion}
            </h2>
            <div className="flex justify-center gap-4 flex-wrap">
              {players.map((p) => {
                const sub = submittedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`font-mono font-black text-xl px-5 py-3 uppercase text-black ${sub ? "" : "opacity-60"}`}
                    style={{
                      background: sub ? playerColors[p.id] ?? "#fff" : "#fff",
                      border: BORDER,
                      boxShadow: sub ? "4px 4px 0 #000" : "2px 2px 0 #000",
                    }}
                  >
                    {p.name} {sub && "✓"}
                  </div>
                );
              })}
            </div>
            <p className="font-mono font-bold text-xl mt-6">
              {submittedCount} / {players.length} submitted
            </p>
          </div>
        )}

        {/* Phase: solving — show both sides for big screen */}
        {phase === "solving" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6" style={{ border: BORDER, boxShadow: SHADOW }}>
              <h3 className="font-mono font-black text-2xl uppercase mb-4">Answers</h3>
              <div className="space-y-3">
                {answerCards.map((a, i) => (
                  <div
                    key={a.id}
                    className="bg-white px-4 py-4 font-mono font-bold text-lg"
                    style={{ border: BORDER, boxShadow: "4px 4px 0 #000" }}
                  >
                    <span className="font-black text-2xl mr-3">{i + 1}.</span>
                    {a.text}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="bg-white p-6 mb-4" style={{ border: BORDER, boxShadow: SHADOW }}>
                <h3 className="font-mono font-black text-2xl uppercase mb-4">Players</h3>
                <div className="space-y-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="font-mono font-black text-xl px-5 py-3 uppercase text-black"
                      style={{
                        background: playerColors[p.id] ?? "#fff",
                        border: BORDER,
                        boxShadow: "4px 4px 0 #000",
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
              {dartsThrownInfo.length > 0 && (
                <div className="bg-yellow-300 p-4" style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}>
                  <p className="font-mono font-black uppercase">🎯 Darts thrown:</p>
                  {dartsThrownInfo.map((d, i) => (
                    <p key={i} className="font-mono font-bold">{d.playerName} (R{d.round})</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase: reveal — show one answer at a time */}
        {phase === "reveal" && (
          <div className="bg-white p-8" style={{ border: BORDER, boxShadow: SHADOW }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-mono font-black text-3xl uppercase">
                Reveal {revealIndex} / {answerCards.length}
              </h3>
              {revealIndex < answerCards.length && (
                <button
                  onClick={handleRevealNext}
                  className="bg-[#FF006E] text-white px-6 py-4 font-mono font-black text-xl uppercase"
                  style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}
                >
                  Next →
                </button>
              )}
            </div>

            {!lastReveal ? (
              <button
                onClick={handleRevealNext}
                className="w-full bg-lime-400 px-6 py-8 font-mono font-black text-3xl uppercase"
                style={{ border: BORDER, boxShadow: SHADOW }}
              >
                Reveal First Answer
              </button>
            ) : (
              <div className="space-y-6">
                <div
                  className="bg-white px-6 py-8 font-mono font-bold text-3xl"
                  style={{ border: BORDER, boxShadow: SHADOW }}
                >
                  "{lastReveal.answer.text}"
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-6" style={{
                    background: lastReveal.solverCorrect ? "#8AFF00" : "#FF6B00",
                    border: BORDER,
                    boxShadow: "6px 6px 0 #000",
                  }}>
                    <p className="font-mono font-black uppercase text-sm">Solver's Guess</p>
                    <p className="font-mono font-black text-2xl uppercase">
                      {lastReveal.guessedPlayerId
                        ? (playersById[lastReveal.guessedPlayerId]?.name ?? "—")
                        : "—"}
                    </p>
                  </div>
                  <div className="p-6 text-black" style={{
                    background: playerColors[lastReveal.answer.playerId] ?? "#fff",
                    border: BORDER,
                    boxShadow: "6px 6px 0 #000",
                  }}>
                    <p className="font-mono font-black uppercase text-sm">Actual Author</p>
                    <p className="font-mono font-black text-2xl uppercase">{lastReveal.answer.playerName}</p>
                  </div>
                </div>
                {lastReveal.darts.length > 0 && (
                  <div className="bg-yellow-300 p-4" style={{ border: BORDER, boxShadow: "6px 6px 0 #000" }}>
                    <p className="font-mono font-black uppercase mb-2">🎯 Darts on this answer:</p>
                    {lastReveal.darts.map((d, i) => (
                      <p key={i} className="font-mono font-bold">
                        {d.playerName} guessed {d.guessedPlayerName} — {d.hit ? "✅ HIT (+200)" : "❌ MISS (-100)"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase: round end */}
        {phase === "round-end" && (
          <div className="bg-white p-8" style={{ border: BORDER, boxShadow: SHADOW }}>
            <h3 className="font-mono font-black text-4xl uppercase mb-6">Round Scores</h3>
            <div className="space-y-3 mb-6">
              {leaderboard.map((p) => (
                <div key={p.id} className="bg-white p-4 flex items-center justify-between"
                  style={{ border: BORDER, boxShadow: "4px 4px 0 #000" }}>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-black text-3xl">#{p.rank}</span>
                    <div className="font-mono font-black text-xl px-4 py-2 text-black uppercase"
                      style={{ background: p.color, border: "3px solid #000", boxShadow: "3px 3px 0 #000" }}>
                      {p.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {roundDelta[p.id] !== undefined && roundDelta[p.id] !== 0 && (
                      <span className={`font-mono font-black text-xl ${(roundDelta[p.id] ?? 0) > 0 ? "text-green-600" : "text-red-600"}`}>
                        {(roundDelta[p.id] ?? 0) > 0 ? "+" : ""}{roundDelta[p.id]}
                      </span>
                    )}
                    <span className="font-mono font-black text-3xl">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleNextRound}
              className="w-full bg-lime-400 px-6 py-6 font-mono font-black text-3xl uppercase"
              style={{ border: BORDER, boxShadow: SHADOW }}
            >
              {currentRound >= totalRounds ? "See Final Scores →" : "Next Round →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
