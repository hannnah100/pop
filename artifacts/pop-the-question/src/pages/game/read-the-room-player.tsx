import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import type { Player } from "@/types/game";

type Phase = "lobby" | "picking-question" | "answering" | "solving" | "reveal" | "round-end" | "finished";

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

const SHADOW_LG = "8px 8px 0 #000";
const SHADOW = "5px 5px 0 #000";
const SHADOW_SM = "3px 3px 0 #000";
const BORDER = "5px solid #000";
const BORDER_SM = "3px solid #000";

export default function ReadTheRoomPlayer() {
  const [, params] = useRoute("/read-the-room/:roomCode/player");
  const roomCode = params?.roomCode || "";
  const [, setLocation] = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const playerNameParam = urlParams.get("name") || "";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finished">("lobby");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [totalRounds, setTotalRounds] = useState(5);
  const [currentRound, setCurrentRound] = useState(0);
  const [playerColors, setPlayerColors] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [solverId, setSolverId] = useState<string | null>(null);
  const [timerEndAt, setTimerEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Question picking phase
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [nextRound, setNextRound] = useState(0);

  // Answer phase
  const [answerInput, setAnswerInput] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // Solving phase
  const [answerCards, setAnswerCards] = useState<AnswerCard[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({}); // answerId -> playerId
  const [solverSubmitted, setSolverSubmitted] = useState(false);
  // Dart state (one per ENTIRE game)
  const [dartUsed, setDartUsed] = useState(false);
  const [dartMode, setDartMode] = useState(false); // showing dart picker
  const [dartStep, setDartStep] = useState<"answer" | "player" | "confirm">("answer");
  const [dartAnswerId, setDartAnswerId] = useState<string | null>(null);
  const [dartPlayerId, setDartPlayerId] = useState<string | null>(null);
  // Active answer being assigned (solver only)
  const [activeAnswer, setActiveAnswer] = useState<string | null>(null);

  // Reveal phase
  const [lastReveal, setLastReveal] = useState<AnswerRevealed | null>(null);

  // Round end
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [roundDelta, setRoundDelta] = useState<Record<string, number>>({});

  // Finished
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (!roomCode || !playerNameParam) return;
    const s = io({ path: "/socket.io" });
    setSocket(s);
    s.emit("join-room", { roomCode, playerName: playerNameParam, isHost: false });

    s.on("player-joined", ({ player, players: ps }: { player: Player; players: Player[] }) => {
      setPlayers(ps.filter((p) => !p.isHost));
      if (player.name === playerNameParam) setMe(player);
    });
    s.on("player-left", ({ players: ps }: { players: Player[] }) => {
      setPlayers(ps.filter((p) => !p.isHost));
    });
    s.on("room-state", (data: {
      players: Player[];
      rtrPhase?: Phase | null;
      rtrRound?: number;
      rtrQuestion?: string;
      rtrSolverId?: string | null;
      rtrQuestionOptions?: string[];
      rtrPlayerColors?: Record<string, string>;
      rtrTimerEndAt?: number;
      rtrTotalRounds?: number;
      status?: string;
    }) => {
      setPlayers(data.players.filter((p) => !p.isHost));
      if (data.rtrTotalRounds) setTotalRounds(data.rtrTotalRounds);
      if (data.rtrPhase) setPhase(data.rtrPhase);
      if (data.rtrRound) setCurrentRound(data.rtrRound);
      if (data.rtrQuestion) setCurrentQuestion(data.rtrQuestion);
      if (data.rtrSolverId !== undefined) setSolverId(data.rtrSolverId);
      if (data.rtrQuestionOptions) setQuestionOptions(data.rtrQuestionOptions);
      if (data.rtrPlayerColors) setPlayerColors(data.rtrPlayerColors);
      if (data.rtrTimerEndAt) setTimerEndAt(data.rtrTimerEndAt);
      if (data.status === "playing") setGameState("playing");
    });
    s.on("game-started", (payload: { totalRounds: number; playerColors: Record<string, string> }) => {
      setGameState("playing");
      setPhase("lobby");
      setTotalRounds(payload.totalRounds);
      setPlayerColors(payload.playerColors);
      setDartUsed(false);
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
      setAnswerInput("");
      setAnswerSubmitted(false);
      setMatches({});
      setSolverSubmitted(false);
      setLastReveal(null);
      setDartMode(false);
      setDartStep("answer");
      setDartAnswerId(null);
      setDartPlayerId(null);
      setActiveAnswer(null);
      setQuestionOptions([]);
    });
    s.on("rtr-solving-phase-start", (payload: {
      solverId: string | null;
      answers: AnswerCard[];
    }) => {
      setPhase("solving");
      setSolverId(payload.solverId);
      setAnswerCards(payload.answers);
      setMatches({});
      setSolverSubmitted(false);
    });
    s.on("rtr-solving-complete", () => {
      setPhase("reveal");
      setLastReveal(null);
    });
    s.on("rtr-dart-registered", () => {
      setDartUsed(true);
      setDartMode(false);
      setDartStep("answer");
    });
    s.on("rtr-answer-revealed", (payload: AnswerRevealed) => {
      setLastReveal(payload);
    });
    s.on("rtr-round-end", (payload: {
      round: number;
      delta: Record<string, number>;
      leaderboard: LeaderboardRow[];
    }) => {
      setPhase("round-end");
      setLeaderboard(payload.leaderboard);
      setRoundDelta(payload.delta);
    });
    s.on("rtr-awaiting-question", ({ nextRound: nr, nextSolverId }: { nextRound: number; nextSolverId: string | null }) => {
      setPhase("picking-question");
      setSolverId(nextSolverId);
      setNextRound(nr);
      setQuestionOptions([]);
    });
    s.on("rtr-question-options", ({ options }: { nextRound: number; options: string[] }) => {
      setQuestionOptions(options);
    });
    s.on("game-ended", (payload: { finalScores: LeaderboardRow[] }) => {
      setGameState("finished");
      setPhase("finished");
      setFinalLeaderboard(payload.finalScores);
    });
    s.on("error", () => {
      // Soft-fail; no UI for transient errors here.
    });

    return () => { s.disconnect(); };
  }, [roomCode, playerNameParam]);

  useEffect(() => {
    if (timerEndAt === 0) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timerEndAt]);

  const secondsLeft = Math.max(0, Math.ceil((timerEndAt - now) / 1000));

  const myColor = me ? playerColors[me.id] ?? "#fff" : "#fff";
  const iAmSolver = me?.id === solverId;

  const playersById = useMemo(() => {
    const map: Record<string, Player> = {};
    players.forEach((p) => { map[p.id] = p; });
    return map;
  }, [players]);

  const handleSubmitAnswer = () => {
    if (!answerInput.trim() || answerSubmitted) return;
    socket?.emit("rtr-submit-answer", { roomCode, answer: answerInput.trim() });
    setAnswerSubmitted(true);
  };

  const handleAssignMatch = (answerId: string, playerId: string) => {
    setMatches((prev) => {
      const next = { ...prev };
      // Remove any existing assignment of this player to a different answer (1-to-1).
      for (const [aid, pid] of Object.entries(next)) {
        if (pid === playerId && aid !== answerId) delete next[aid];
      }
      next[answerId] = playerId;
      return next;
    });
    setActiveAnswer(null);
  };

  const handleSubmitMatches = () => {
    if (Object.keys(matches).length < answerCards.length) return;
    socket?.emit("rtr-submit-matches", { roomCode, matches });
    setSolverSubmitted(true);
  };

  const handleThrowDart = () => {
    if (!dartAnswerId || !dartPlayerId) return;
    socket?.emit("rtr-throw-dart", {
      roomCode,
      answerId: dartAnswerId,
      targetPlayerId: dartPlayerId,
    });
  };

  const handlePickQuestion = (question: string) => {
    socket?.emit("rtr-pick-question", { roomCode, question });
  };

  // ============ Render branches ============

  if (gameState === "lobby") {
    return (
      <div className="min-h-screen w-full px-4 py-8" style={{ background: "#FFF5E7" }}>
        <div className="max-w-md mx-auto">
          <div className="bg-white p-6 mb-6" style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <h1 className="font-mono font-black text-4xl uppercase mb-2">Read the Room</h1>
            <p className="font-mono font-bold text-lg">You're in! Waiting for the host…</p>
          </div>
          {me && (
            <div
              className="px-6 py-4 font-mono font-black text-2xl uppercase text-black"
              style={{ background: myColor, border: BORDER, boxShadow: SHADOW }}
            >
              {me.name}
            </div>
          )}
          <p className="font-mono font-bold text-center mt-6">
            {players.length} player{players.length === 1 ? "" : "s"} in room
          </p>
        </div>
      </div>
    );
  }

  if (gameState === "finished") {
    const myRow = finalLeaderboard.find((p) => p.id === me?.id);
    const winner = finalLeaderboard[0];
    return (
      <div className="min-h-screen w-full px-4 py-8" style={{ background: "#FFF5E7" }}>
        <div className="max-w-md mx-auto">
          <div className="bg-yellow-300 p-6 mb-6 text-center" style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <h1 className="font-mono font-black text-4xl uppercase mb-2">Game Over</h1>
            {winner && (
              <p className="font-mono font-black text-2xl uppercase">👑 {winner.name} wins!</p>
            )}
          </div>
          {myRow && (
            <div className="bg-white p-6 mb-6 text-center" style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <p className="font-mono font-bold uppercase text-sm">Your final score</p>
              <p className="font-mono font-black text-6xl">{myRow.score}</p>
              <p className="font-mono font-bold uppercase">Rank #{myRow.rank}</p>
            </div>
          )}
          <div className="space-y-2">
            {finalLeaderboard.map((p) => (
              <div
                key={p.id}
                className="bg-white p-3 flex items-center justify-between"
                style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}
              >
                <span className="font-mono font-black">#{p.rank} {p.name}</span>
                <span className="font-mono font-black text-xl">{p.score}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocation("/")}
            className="w-full bg-white mt-8 px-6 py-4 font-mono font-black uppercase"
            style={{ border: BORDER, boxShadow: SHADOW }}
          >
            ← Home
          </button>
        </div>
      </div>
    );
  }

  // ============ PICKING QUESTION PHASE ============
  if (phase === "picking-question") {
    const displayRound = nextRound || currentRound + 1 || 1;
    if (iAmSolver) {
      return (
        <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="px-3 py-2 bg-[#FF006E] text-white font-mono font-black uppercase text-sm"
                style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}>
                R{displayRound}/{totalRounds}
              </div>
            </div>

            <div className="bg-[#FF006E] text-white p-4 mb-4"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <h2 className="font-mono font-black text-2xl uppercase">🧩 You're the Solver</h2>
              <p className="font-mono font-bold mt-1">Pick the question for this round.</p>
            </div>

            {questionOptions.length === 0 ? (
              <div className="bg-white p-6 text-center"
                style={{ border: BORDER, boxShadow: SHADOW_LG }}>
                <p className="font-mono font-bold">Loading questions…</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questionOptions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handlePickQuestion(q)}
                    className="w-full text-left bg-white px-5 py-5 font-mono font-bold text-lg hover:bg-yellow-50"
                    style={{ border: BORDER, boxShadow: SHADOW_LG }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full px-4 py-6 flex items-center justify-center"
        style={{ background: "#FFF5E7" }}>
        <div className="bg-white p-8 text-center max-w-md"
          style={{ border: BORDER, boxShadow: SHADOW_LG }}>
          <p className="font-mono font-black uppercase text-sm mb-2 text-black/60">
            Round {displayRound}
          </p>
          <h2 className="font-mono font-black text-2xl uppercase mb-2">Hang Tight</h2>
          <p className="font-mono font-bold">
            {solverPlayerName(playersById, solverId) ?? "The solver"} is picking a question…
          </p>
        </div>
      </div>
    );
  }

  // ============ ANSWERING PHASE ============
  if (phase === "answering") {
    return (
      <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="px-3 py-2 bg-[#FF006E] text-white font-mono font-black uppercase text-sm"
              style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}>
              R{currentRound}/{totalRounds}
            </div>
            {timerEndAt > 0 && (
              <div
                className={`px-4 py-2 font-mono font-black text-2xl text-white ${secondsLeft <= 10 ? "bg-red-600" : "bg-orange-500"}`}
                style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}
              >
                ⏱ {secondsLeft}s
              </div>
            )}
          </div>

          <div className="bg-white p-6 mb-6" style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <p className="font-mono font-black uppercase text-sm mb-3 text-black/60">Anonymously answer:</p>
            <h2 className="font-mono font-black text-2xl leading-tight">{currentQuestion}</h2>
          </div>

          {!answerSubmitted ? (
            <>
              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Type your spicy answer..."
                maxLength={200}
                rows={4}
                className="w-full px-4 py-4 font-mono font-bold text-xl mb-4 bg-yellow-50"
                style={{ border: BORDER, boxShadow: SHADOW, borderRadius: 0, resize: "none" }}
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={!answerInput.trim()}
                className="w-full bg-lime-400 px-6 py-5 font-mono font-black text-2xl uppercase disabled:bg-gray-300"
                style={{ border: BORDER, boxShadow: SHADOW_LG }}
              >
                Submit →
              </button>
            </>
          ) : (
            <div className="bg-lime-400 p-8 text-center"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <p className="font-mono font-black text-3xl uppercase">✓ Answer In!</p>
              <p className="font-mono font-bold mt-2">Waiting for everyone else…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ SOLVING PHASE ============
  if (phase === "solving") {
    if (iAmSolver) {
      const allMatched = Object.keys(matches).length === answerCards.length;
      return (
        <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#FF006E] text-white p-4 mb-4"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <h2 className="font-mono font-black text-2xl uppercase">🧩 You're the Solver</h2>
              <p className="font-mono font-bold mt-1">Match each answer to who said it.</p>
            </div>

            {solverSubmitted ? (
              <div className="bg-lime-400 p-8 text-center"
                style={{ border: BORDER, boxShadow: SHADOW_LG }}>
                <p className="font-mono font-black text-3xl uppercase">✓ Submitted!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {answerCards.map((a, i) => {
                    const matchedPlayerId = matches[a.id];
                    const matchedPlayer = matchedPlayerId ? playersById[matchedPlayerId] : null;
                    return (
                      <div key={a.id} className="bg-white p-4"
                        style={{ border: BORDER, boxShadow: SHADOW }}>
                        <p className="font-mono font-bold mb-3">
                          <span className="font-black mr-2">{i + 1}.</span>
                          "{a.text}"
                        </p>
                        <button
                          onClick={() => setActiveAnswer(activeAnswer === a.id ? null : a.id)}
                          className="w-full px-4 py-3 font-mono font-black uppercase text-black"
                          style={{
                            background: matchedPlayer ? (playerColors[matchedPlayer.id] ?? "#fff") : "#FFD60A",
                            border: BORDER_SM,
                            boxShadow: SHADOW_SM,
                          }}
                        >
                          {matchedPlayer ? `→ ${matchedPlayer.name}` : "Tap to pick player"}
                        </button>
                        {activeAnswer === a.id && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {players.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleAssignMatch(a.id, p.id)}
                                className="px-3 py-3 font-mono font-black text-black uppercase"
                                style={{
                                  background: playerColors[p.id] ?? "#fff",
                                  border: BORDER_SM,
                                  boxShadow: SHADOW_SM,
                                }}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSubmitMatches}
                  disabled={!allMatched}
                  className="w-full bg-lime-400 px-6 py-5 font-mono font-black text-2xl uppercase disabled:bg-gray-300"
                  style={{ border: BORDER, boxShadow: SHADOW_LG }}
                >
                  {allMatched ? "Submit Matches →" : `${Object.keys(matches).length} / ${answerCards.length} matched`}
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    // Spectator solving view (dart-throwing)
    return (
      <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-cyan-300 p-4 mb-4"
            style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <h2 className="font-mono font-black text-2xl uppercase">Spectator Mode</h2>
            {solverPlayerName(playersById, solverId) && (
              <p className="font-mono font-bold mt-1">
                {solverPlayerName(playersById, solverId)} is solving…
              </p>
            )}
          </div>

          {!dartMode ? (
            <>
              <button
                onClick={() => !dartUsed && setDartMode(true)}
                disabled={dartUsed}
                className={`w-full mb-6 px-6 py-6 font-mono font-black text-2xl uppercase ${dartUsed ? "bg-gray-400 text-gray-700" : "bg-yellow-300 text-black"}`}
                style={{ border: BORDER, boxShadow: dartUsed ? SHADOW : "10px 10px 0 #000" }}
              >
                🎯 {dartUsed ? "Dart Used" : "Throw Dart (1 per game)"}
              </button>

              <div className="bg-white p-4 mb-4"
                style={{ border: BORDER_SM, boxShadow: SHADOW }}>
                <p className="font-mono font-black uppercase text-sm mb-3">All Answers</p>
                {answerCards.map((a, i) => (
                  <p key={a.id} className="font-mono font-bold mb-2">
                    <span className="font-black mr-2">{i + 1}.</span>"{a.text}"
                  </p>
                ))}
              </div>

              <div className="bg-white p-4"
                style={{ border: BORDER_SM, boxShadow: SHADOW }}>
                <p className="font-mono font-black uppercase text-sm mb-3">Players</p>
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <div key={p.id}
                      className="px-3 py-2 font-mono font-black uppercase text-black"
                      style={{
                        background: playerColors[p.id] ?? "#fff",
                        border: BORDER_SM,
                        boxShadow: SHADOW_SM,
                      }}>
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-yellow-300 p-4"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono font-black text-xl uppercase">🎯 Throw Dart</h3>
                <button
                  onClick={() => { setDartMode(false); setDartStep("answer"); setDartAnswerId(null); setDartPlayerId(null); }}
                  className="bg-white px-3 py-1 font-mono font-black text-sm uppercase"
                  style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}
                >
                  Cancel
                </button>
              </div>

              {dartStep === "answer" && (
                <>
                  <p className="font-mono font-bold mb-3 uppercase text-sm">Step 1: Pick an answer</p>
                  <div className="space-y-2">
                    {answerCards.map((a, i) => (
                      <button
                        key={a.id}
                        onClick={() => { setDartAnswerId(a.id); setDartStep("player"); }}
                        className="w-full text-left bg-white px-4 py-3 font-mono font-bold"
                        style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}
                      >
                        <span className="font-black mr-2">{i + 1}.</span>{a.text}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {dartStep === "player" && (
                <>
                  <p className="font-mono font-bold mb-3 uppercase text-sm">Step 2: Who said it?</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setDartPlayerId(p.id); setDartStep("confirm"); }}
                        className="px-3 py-3 font-mono font-black text-black uppercase"
                        style={{
                          background: playerColors[p.id] ?? "#fff",
                          border: BORDER_SM,
                          boxShadow: SHADOW_SM,
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {dartStep === "confirm" && dartAnswerId && dartPlayerId && (
                <>
                  <p className="font-mono font-bold mb-3 uppercase text-sm">Confirm dart:</p>
                  <div className="bg-white p-3 mb-2"
                    style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}>
                    <p className="font-mono font-bold">"{answerCards.find((a) => a.id === dartAnswerId)?.text}"</p>
                  </div>
                  <p className="font-mono font-bold text-center my-2 uppercase">said by</p>
                  <div
                    className="px-4 py-3 font-mono font-black text-black uppercase text-center"
                    style={{
                      background: playerColors[dartPlayerId] ?? "#fff",
                      border: BORDER_SM,
                      boxShadow: SHADOW_SM,
                    }}>
                    {playersById[dartPlayerId]?.name}
                  </div>
                  <p className="font-mono font-bold text-xs text-center mt-3 mb-3">
                    Hit: +200 / Miss: -100
                  </p>
                  <button
                    onClick={handleThrowDart}
                    className="w-full bg-[#FF006E] text-white px-6 py-4 font-mono font-black text-xl uppercase"
                    style={{ border: BORDER, boxShadow: SHADOW_LG }}
                  >
                    🎯 Throw!
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ REVEAL PHASE ============
  if (phase === "reveal") {
    return (
      <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
        <div className="max-w-md mx-auto">
          <div className="bg-cyan-300 p-4 mb-4"
            style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <h2 className="font-mono font-black text-xl uppercase">🎯 Reveals</h2>
            <p className="font-mono font-bold mt-1">Look at the host screen!</p>
          </div>
          {lastReveal && (
            <div className="bg-white p-6"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <p className="font-mono font-bold mb-3">"{lastReveal.answer.text}"</p>
              <div className="text-black uppercase font-mono font-black text-xl text-center py-3"
                style={{
                  background: playerColors[lastReveal.answer.playerId] ?? "#fff",
                  border: BORDER_SM,
                  boxShadow: SHADOW_SM,
                }}>
                = {lastReveal.answer.playerName}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ ROUND END ============
  if (phase === "round-end") {
    const myDelta = me ? roundDelta[me.id] ?? 0 : 0;
    const myRow = me ? leaderboard.find((p) => p.id === me.id) : null;
    return (
      <div className="min-h-screen w-full px-4 py-6" style={{ background: "#FFF5E7" }}>
        <div className="max-w-md mx-auto">
          <div className="bg-yellow-300 p-6 text-center mb-4"
            style={{ border: BORDER, boxShadow: SHADOW_LG }}>
            <p className="font-mono font-black uppercase text-sm">Round {currentRound}</p>
            <p className="font-mono font-black text-4xl uppercase mt-1">
              {myDelta > 0 ? `+${myDelta}` : myDelta}
            </p>
            <p className="font-mono font-bold text-sm uppercase mt-1">this round</p>
          </div>
          {myRow && (
            <div className="bg-white p-4 text-center mb-6"
              style={{ border: BORDER, boxShadow: SHADOW_LG }}>
              <p className="font-mono font-bold uppercase text-sm">Your total</p>
              <p className="font-mono font-black text-5xl">{myRow.score}</p>
              <p className="font-mono font-bold uppercase">Rank #{myRow.rank}</p>
            </div>
          )}
          <div className="space-y-2">
            {leaderboard.map((p) => (
              <div key={p.id} className="bg-white p-3 flex items-center justify-between"
                style={{ border: BORDER_SM, boxShadow: SHADOW_SM }}>
                <span className="font-mono font-black text-sm">#{p.rank} {p.name}</span>
                <span className="font-mono font-black text-lg">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ Default (between rounds, pick-question phase on host) ============
  return (
    <div className="min-h-screen w-full px-4 py-6 flex items-center justify-center"
      style={{ background: "#FFF5E7" }}>
      <div className="bg-white p-8 text-center max-w-md"
        style={{ border: BORDER, boxShadow: SHADOW_LG }}>
        <h2 className="font-mono font-black text-2xl uppercase mb-2">Get Ready</h2>
        <p className="font-mono font-bold">Host is picking the next question…</p>
      </div>
    </div>
  );
}

function solverPlayerName(playersById: Record<string, Player>, solverId: string | null): string | null {
  if (!solverId) return null;
  return playersById[solverId]?.name ?? null;
}
