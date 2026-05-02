import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Crown, Trophy, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlayerWithBot extends Player {
  isBot?: boolean;
}

export default function GameHost() {
  const [, params] = useRoute("/game/:roomCode/host");
  const roomCode = params?.roomCode || "";
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finished">("lobby");
  const [gameType, setGameType] = useState<string>("");
  const [players, setPlayers] = useState<PlayerWithBot[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  // Game specific state
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [votesIn, setVotesIn] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  // Roast Roulette state
  const [rrPhase, setRrPhase] = useState<"writing" | "revealing" | "done">("writing");
  const [rrSubmitted, setRrSubmitted] = useState(0);
  const [rrTotal, setRrTotal] = useState(0);
  const [rrRound, setRrRound] = useState(1);
  const [rrTotalRounds, setRrTotalRounds] = useState(1);
  const [rrCurrentRevealName, setRrCurrentRevealName] = useState("");
  const [rrCard, setRrCard] = useState<Record<string, { answer: string; author: string; answerId: string }>>({});
  const [rrQuestions, setRrQuestions] = useState<Array<{ color?: string; question?: string }>>([]);
  const [rrRevealIndex, setRrRevealIndex] = useState(0);
  const [rrTotalReveals, setRrTotalReveals] = useState(0);

  useEffect(() => {
    if (!roomCode) return;

    const newSocket = io({ path: "/socket.io" });
    setSocket(newSocket);

    newSocket.emit("join-room", { roomCode, playerName: "HOST", isHost: true });

    newSocket.on("player-joined", ({ players: ps, isDemo: demo }: { players: PlayerWithBot[]; isDemo: boolean }) => {
      setPlayers(ps.filter((p) => !p.isHost));
      if (demo) setIsDemo(true);
    });

    newSocket.on("room-state", ({ players: ps, isDemo: demo, gameType: gt }: { players: PlayerWithBot[]; isDemo: boolean; gameType: string }) => {
      setPlayers(ps.filter((p: PlayerWithBot) => !p.isHost));
      if (demo) setIsDemo(true);
      if (gt) setGameType(gt);
    });

    newSocket.on("game-started", ({ gameType: gt, question, questions, players: ps, currentRound, totalRounds, isDemo: demo }: any) => {
      setGameState("playing");
      setGameType(gt);
      if (demo) setIsDemo(true);

      if (gt === "pop-the-question") {
        setCurrentQuestion(question ?? "");
        setQuestionIndex(0);
        setVotesIn(0);
        setResultsRevealed(false);
        if (ps) setTotalVoters(ps.filter((p: PlayerWithBot) => !p.isHost).length);
      } else if (gt === "roast-roulette") {
        setRrPhase("writing");
        setRrRound(currentRound ?? 1);
        setRrTotalRounds(totalRounds ?? 1);
        setRrSubmitted(0);
        if (ps) {
          const nonHost = ps.filter((p: PlayerWithBot) => !p.isHost);
          setRrTotal(nonHost.length);
          setRrTotalReveals(nonHost.length);
          setPlayers(nonHost);
        }
        if (questions) setRrQuestions(questions);
      }
    });

    // Pop the Question events
    newSocket.on("question-update", ({ question, questionIndex: qi }: { question: string; questionIndex: number }) => {
      setCurrentQuestion(question ?? "");
      setQuestionIndex(qi);
      setVotesIn(0);
      setVoteCounts({});
      setResultsRevealed(false);
    });

    newSocket.on("vote-progress", ({ voted, total }: { voted: number; total: number }) => {
      setVotesIn(voted);
      setTotalVoters(total);
    });

    newSocket.on("results-revealed", ({ voteCounts: vc, players: ps }: any) => {
      setVoteCounts(vc ?? {});
      setResultsRevealed(true);
      if (ps) setPlayers(ps.filter((p: PlayerWithBot) => !p.isHost));
    });

    // Roast Roulette events
    newSocket.on("submission-progress", ({ submitted, total, round }: any) => {
      setRrSubmitted(submitted);
      setRrTotal(total);
      setRrRound(round);
    });

    newSocket.on("round-complete", ({ nextRound, totalRounds }: any) => {
      setRrRound(nextRound);
      setRrTotalRounds(totalRounds);
      setRrSubmitted(0);
    });

    newSocket.on("writing-complete", () => {
      setRrPhase("revealing");
    });

    newSocket.on("start-reveals", ({ currentRevealName, card, questions: qs, revealOrder, currentRevealId }: any) => {
      setRrPhase("revealing");
      setRrCurrentRevealName(currentRevealName ?? "");
      setRrCard(card ?? {});
      if (qs) setRrQuestions(qs);
      if (revealOrder) {
        setRrRevealIndex((prev) => {
          const idx = revealOrder.indexOf(currentRevealId);
          return idx >= 0 ? idx : prev;
        });
        setRrTotalReveals(revealOrder.length);
      }
    });

    newSocket.on("favorite-picked", ({ players: ps }: any) => {
      if (ps) setPlayers(ps.filter((p: PlayerWithBot) => !p.isHost));
    });

    newSocket.on("game-ended", ({ players: ps }: any) => {
      setGameState("finished");
      if (ps) setPlayers(ps.filter((p: PlayerWithBot) => !p.isHost));
    });

    newSocket.on("error", ({ message }: { message: string }) => {
      toast({ title: "Game Error", description: message, variant: "destructive" });
    });

    return () => { newSocket.disconnect(); };
  }, [roomCode, toast]);

  const handleStartGame = () => socket?.emit("start-game", { roomCode });
  const handleRevealResults = () => socket?.emit("reveal-results", { roomCode });
  const handleNextQuestion = () => socket?.emit("next-question", { roomCode });
  const handleEndGame = () => socket?.emit("end-game", { roomCode });
  const handleNextReveal = () => socket?.emit("next-reveal", { roomCode });

  const DemoBadge = () =>
    isDemo ? (
      <div className="flex items-center gap-2 bg-primary/20 border border-primary/40 text-primary px-4 py-2 rounded-full font-bold text-lg">
        <Bot className="w-5 h-5" />
        DEMO MODE
      </div>
    ) : null;

  const PlayerChip = ({ p }: { p: PlayerWithBot }) => (
    <motion.div
      key={p.id}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-2xl font-bold px-6 py-4 rounded-xl border flex items-center gap-2
        ${p.isBot ? "bg-primary/10 border-primary/30 text-muted-foreground" : "bg-background border-primary/30"}`}
    >
      {p.isBot && <Bot className="w-5 h-5 text-primary/60" />}
      {p.name}
    </motion.div>
  );

  // LOBBY
  if (gameState === "lobby") {
    const canStart = isDemo ? players.length >= 1 : players.filter((p) => !p.isBot).length >= 3;

    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-4 mb-6">
            <DemoBadge />
          </div>
          <p className="text-3xl font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
            Go to popthequestion.com and enter code
          </p>
          <h1 className="text-[12rem] font-black font-display tracking-[0.2em] leading-none mb-12 bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-cyan-400 drop-shadow-2xl">
            {roomCode}
          </h1>

          <div className="w-full max-w-5xl bg-card rounded-3xl p-8 border-2 border-border/50 shadow-2xl mb-12">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
              <Users className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-bold">
                Players ({players.length})
                {isDemo && <span className="ml-3 text-lg font-normal text-muted-foreground">· {players.filter(p => p.isBot).length} AI</span>}
              </h2>
            </div>

            <div className="flex flex-wrap gap-4 min-h-[120px]">
              {players.length === 0 ? (
                <div className="w-full flex items-center justify-center text-2xl text-muted-foreground animate-pulse">
                  Waiting for players to join...
                </div>
              ) : (
                players.map((p) => <PlayerChip key={p.id} p={p} />)
              )}
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={!canStart}
            className="text-3xl px-16 py-12 bg-primary hover:bg-primary/90 rounded-2xl font-bold font-display"
            data-testid="btn-start-game"
          >
            <Play className="w-10 h-10 mr-4 fill-current" />
            {canStart ? "Start Game" : `Need ${3 - players.filter(p => !p.isBot).length} more real players`}
          </Button>
        </div>
      </div>
    );
  }

  // FINISHED
  if (gameState === "finished") {
    const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8 items-center justify-center">
        {isDemo && (
          <div className="absolute top-6 right-6"><DemoBadge /></div>
        )}
        <Trophy className="w-32 h-32 text-yellow-400 mb-8" />
        <h1 className="text-7xl font-black font-display text-center mb-16">Final Standings</h1>
        <div className="w-full max-w-4xl space-y-6">
          {sortedPlayers.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.2 }}
              className={`flex items-center justify-between p-6 rounded-2xl border-2 ${
                i === 0 ? "bg-primary/20 border-primary" :
                i === 1 ? "bg-card border-border" : "bg-card border-transparent"
              }`}
            >
              <div className="flex items-center gap-6">
                <span className="text-5xl font-black text-muted-foreground w-12 text-center">#{i + 1}</span>
                <span className="text-4xl font-bold flex items-center gap-2">
                  {p.isBot && <Bot className="w-7 h-7 text-primary/60" />}
                  {p.name}
                </span>
              </div>
              <span className="text-4xl font-bold text-accent">{p.score ?? 0} pts</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // PLAYING — Pop the Question
  if (gameState === "playing" && gameType === "pop-the-question") {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex justify-between items-center mb-16 relative z-10">
          <div className="text-2xl font-bold text-muted-foreground tracking-widest bg-card px-6 py-3 rounded-full border border-border">
            ROOM: {roomCode}
          </div>
          {isDemo && <DemoBadge />}
          <div className="text-2xl font-bold text-muted-foreground bg-card px-6 py-3 rounded-full border border-border">
            Question {questionIndex + 1}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`q-${questionIndex}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="text-6xl md:text-[5rem] leading-tight font-black font-display text-center mb-16"
            >
              {currentQuestion || "Loading question..."}
            </motion.h2>
          </AnimatePresence>

          {!resultsRevealed ? (
            <div className="flex flex-col items-center w-full">
              <div className="text-4xl font-bold mb-8">
                <span className="text-primary">{votesIn}</span> / {totalVoters || players.length} Votes In
              </div>
              <div className="w-full max-w-3xl bg-card rounded-full h-8 overflow-hidden border border-border mb-12">
                <div
                  className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-500 ease-out"
                  style={{ width: `${(votesIn / Math.max(1, totalVoters || players.length)) * 100}%` }}
                />
              </div>
              <Button
                size="lg"
                onClick={handleRevealResults}
                disabled={votesIn === 0}
                className="text-3xl px-12 py-8 bg-accent hover:bg-accent/90"
                data-testid="btn-reveal"
              >
                Reveal Results
              </Button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl">
              <div className="space-y-6 mb-12">
                {Object.entries(voteCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([playerId, count], i) => {
                    const player = players.find((p) => p.id === playerId);
                    if (!player) return null;
                    const total = totalVoters || players.length;
                    const percentage = (count / Math.max(1, total)) * 100;
                    return (
                      <div key={playerId} className="relative">
                        <div className="flex justify-between text-3xl font-bold mb-2 relative z-10 px-4">
                          <span className="flex items-center gap-2">
                            {i === 0 && <Crown className="w-8 h-8 text-yellow-400" />}
                            {player.isBot && <Bot className="w-6 h-6 text-primary/60" />}
                            {player.name}
                          </span>
                          <span>{count} {count === 1 ? "vote" : "votes"}</span>
                        </div>
                        <div className="h-16 bg-card rounded-2xl overflow-hidden border border-border">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: i * 0.2, ease: "easeOut" }}
                            className={`h-full ${i === 0 ? "bg-primary" : "bg-muted"}`}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="flex gap-6 justify-center">
                <Button size="lg" onClick={handleNextQuestion} className="text-2xl px-8 py-8" data-testid="btn-next">
                  Next Question
                </Button>
                <Button size="lg" variant="outline" onClick={handleEndGame} className="text-2xl px-8 py-8" data-testid="btn-end">
                  End Game
                </Button>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    );
  }

  // PLAYING — Roast Roulette
  if (gameState === "playing" && gameType === "roast-roulette") {
    // Writing phase
    if (rrPhase === "writing") {
      return (
        <div className="flex flex-col min-h-screen bg-background text-foreground p-8 items-center justify-center relative">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <div className="text-2xl font-bold text-muted-foreground mb-8 uppercase tracking-widest">
            Round {rrRound} of {rrTotalRounds}
          </div>
          <h1 className="text-6xl font-black font-display mb-12">Writing Roasts...</h1>
          <div className="w-full max-w-2xl bg-card rounded-3xl p-8 border-2 border-border mb-8">
            <div className="flex justify-between text-3xl font-bold mb-6">
              <span>Submitted</span>
              <span className="text-primary">{rrSubmitted}/{rrTotal}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
              <motion.div
                animate={{ width: `${(rrSubmitted / Math.max(1, rrTotal)) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
            {players.map((p) => (
              <div
                key={p.id}
                className={`px-5 py-3 rounded-full font-bold text-xl flex items-center gap-2 border
                  ${p.isBot ? "bg-primary/10 border-primary/30 text-muted-foreground" : "bg-card border-border"}`}
              >
                {p.isBot && <Bot className="w-4 h-4" />}
                {p.name}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Revealing phase
    if (rrPhase === "revealing") {
      return (
        <div className="flex flex-col min-h-screen bg-background text-foreground p-8 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <header className="flex justify-between items-center mb-8 relative z-10">
            <div className="text-2xl font-bold text-muted-foreground bg-card px-6 py-3 rounded-full border border-border">
              ROOM: {roomCode}
            </div>
            <div className="text-2xl font-bold text-muted-foreground bg-card px-6 py-3 rounded-full border border-border">
              Reveal {rrRevealIndex + 1} of {rrTotalReveals}
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center relative z-10">
            <p className="text-3xl text-muted-foreground mb-4 font-bold uppercase tracking-widest">Roasting</p>
            <h1 className="text-[6rem] font-black font-display mb-12 text-center">{rrCurrentRevealName}</h1>

            <div className="w-full max-w-5xl grid gap-6 mb-12">
              {Object.entries(rrCard).map(([color, entry]) => {
                const question = rrQuestions.find((q) => q.color === color);
                return (
                  <motion.div
                    key={color}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl p-6 border-2 border-border"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-4 h-full min-h-[48px] rounded-full flex-shrink-0"
                        style={{ backgroundColor: color === "gray" ? "#6b7280" : color }}
                      />
                      <div>
                        {question && (
                          <p className="text-xl text-muted-foreground mb-2">{question.question}</p>
                        )}
                        <p className="text-3xl font-bold">{entry.answer}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <Button
              size="lg"
              onClick={handleNextReveal}
              className="text-3xl px-12 py-8 bg-primary hover:bg-primary/90"
              data-testid="btn-next-reveal"
            >
              {rrRevealIndex + 1 >= rrTotalReveals ? "Finish Game" : "Next Player →"}
            </Button>
          </main>
        </div>
      );
    }
  }

  return null;
}
