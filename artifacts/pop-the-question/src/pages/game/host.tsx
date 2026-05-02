import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Users, Play, Crown, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Host view runs on projector/big screen
export default function GameHost() {
  const [, params] = useRoute("/game/:roomCode/host");
  const roomCode = params?.roomCode || "";
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'finished'>('lobby');
  const [gameType, setGameType] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Game specific state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [votesIn, setVotesIn] = useState(0);
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [finalScores, setFinalScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!roomCode) return;

    const newSocket = io({ path: '/socket.io' });
    setSocket(newSocket);

    newSocket.emit('join-room', { roomCode, playerName: 'HOST', isHost: true });

    newSocket.on('player-joined', ({ players }) => {
      setPlayers(players.filter((p: Player) => !p.isHost));
    });

    newSocket.on('game-started', ({ gameType, questions, questionIndex }) => {
      setGameState('playing');
      setGameType(gameType);
      if (questions && questions[questionIndex]) {
        setCurrentQuestion(questions[questionIndex]);
        setQuestionIndex(questionIndex);
      }
    });

    newSocket.on('question-update', ({ question, questionIndex }) => {
      setCurrentQuestion(question);
      setQuestionIndex(questionIndex);
      setVotesIn(0);
      setVoteCounts({});
      setResultsRevealed(false);
    });

    newSocket.on('player-voted', () => {
      setVotesIn(prev => prev + 1);
    });

    newSocket.on('all-votes-in', () => {
      // Could show a notification or auto-reveal
    });

    newSocket.on('results-revealed', ({ voteCounts, players }) => {
      setVoteCounts(voteCounts);
      setResultsRevealed(true);
      setPlayers(players.filter((p: Player) => !p.isHost));
    });

    newSocket.on('game-ended', ({ finalScores, players }) => {
      setGameState('finished');
      setFinalScores(finalScores);
      setPlayers(players.filter((p: Player) => !p.isHost));
    });

    newSocket.on('error', ({ message }) => {
      toast({ title: "Game Error", description: message, variant: "destructive" });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode, toast]);

  const handleStartGame = () => {
    socket?.emit('start-game', { roomCode });
  };

  const handleRevealResults = () => {
    socket?.emit('reveal-results', { roomCode });
  };

  const handleNextQuestion = () => {
    socket?.emit('next-question', { roomCode });
  };

  const handleEndGame = () => {
    socket?.emit('end-game', { roomCode });
  };

  // Lobby UI
  if (gameState === 'lobby') {
    const minPlayers = 3;
    const canStart = players.length >= minPlayers;

    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Go to popthequestion.com and enter code</p>
          <h1 className="text-[12rem] font-black font-display tracking-[0.2em] leading-none mb-12 bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-cyan-400 drop-shadow-2xl">
            {roomCode}
          </h1>
          
          <div className="w-full max-w-5xl bg-card rounded-3xl p-8 border-2 border-border/50 shadow-2xl mb-12">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
              <Users className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-bold">Players ({players.length})</h2>
            </div>
            
            <div className="flex flex-wrap gap-4 min-h-[120px]">
              {players.length === 0 ? (
                <div className="w-full flex items-center justify-center text-2xl text-muted-foreground animate-pulse">
                  Waiting for players to join...
                </div>
              ) : (
                players.map((p, i) => (
                  <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-background text-2xl font-bold px-6 py-4 rounded-xl border border-primary/30"
                  >
                    {p.name}
                  </motion.div>
                ))
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
            {canStart ? "Start Game" : `Need ${minPlayers - players.length} more players`}
          </Button>
        </div>
      </div>
    );
  }

  // Playing UI - Pop the Question
  if (gameState === 'playing') {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex justify-between items-center mb-16 relative z-10">
          <div className="text-2xl font-bold text-muted-foreground tracking-widest bg-card px-6 py-3 rounded-full border border-border">
            ROOM: {roomCode}
          </div>
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
              {currentQuestion?.prompt || "Loading question..."}
            </motion.h2>
          </AnimatePresence>

          {!resultsRevealed ? (
            <div className="flex flex-col items-center w-full">
              <div className="text-4xl font-bold mb-8">
                <span className="text-primary">{votesIn}</span> / {players.length} Votes In
              </div>
              <div className="w-full max-w-3xl bg-card rounded-full h-8 overflow-hidden border border-border mb-12">
                <div 
                  className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-500 ease-out"
                  style={{ width: `${(votesIn / Math.max(1, players.length)) * 100}%` }}
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl"
            >
              <div className="space-y-6 mb-12">
                {Object.entries(voteCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([playerId, count], i) => {
                    const player = players.find(p => p.id === playerId);
                    if (!player) return null;
                    const percentage = (count / players.length) * 100;
                    
                    return (
                      <div key={playerId} className="relative">
                        <div className="flex justify-between text-3xl font-bold mb-2 relative z-10 px-4">
                          <span className="flex items-center">
                            {i === 0 && <Crown className="w-8 h-8 text-yellow-400 mr-3" />}
                            {player.name}
                          </span>
                          <span>{count} {count === 1 ? 'vote' : 'votes'}</span>
                        </div>
                        <div className="h-16 bg-card rounded-2xl overflow-hidden border border-border">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: i * 0.2, ease: "easeOut" }}
                            className={`h-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`}
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

  // Finished UI
  if (gameState === 'finished') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground p-8 items-center justify-center">
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
                i === 0 ? 'bg-primary/20 border-primary' : 
                i === 1 ? 'bg-card border-border' : 
                'bg-card border-transparent'
              }`}
            >
              <div className="flex items-center gap-6">
                <span className="text-5xl font-black text-muted-foreground w-12 text-center">#{i+1}</span>
                <span className="text-4xl font-bold">{p.name}</span>
              </div>
              <span className="text-4xl font-bold text-accent">{p.score} pts</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
