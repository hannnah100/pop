import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GamePlayer() {
  const [, params] = useRoute("/game/:roomCode/player");
  const roomCode = params?.roomCode || "";
  const { toast } = useToast();
  
  // Get name from URL or show input
  const urlParams = new URLSearchParams(window.location.search);
  const playerNameParam = urlParams.get('name') || "";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'finished'>('lobby');
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  useEffect(() => {
    if (!roomCode || !playerNameParam) return;

    const newSocket = io({ path: '/socket.io' });
    setSocket(newSocket);

    newSocket.emit('join-room', { roomCode, playerName: playerNameParam, isHost: false });

    newSocket.on('player-joined', ({ player, players }) => {
      setPlayers(players.filter((p: Player) => !p.isHost));
      if (player.name === playerNameParam) {
        setMe(player);
      }
    });

    newSocket.on('game-started', ({ questions, questionIndex }) => {
      setGameState('playing');
      if (questions && questions[questionIndex]) {
        setCurrentQuestion(questions[questionIndex]);
      }
    });

    newSocket.on('question-update', ({ question }) => {
      setCurrentQuestion(question);
      setVotedFor(null);
      setResultsRevealed(false);
      window.scrollTo(0, 0);
    });

    newSocket.on('results-revealed', () => {
      setResultsRevealed(true);
    });

    newSocket.on('game-ended', ({ players }) => {
      setGameState('finished');
      setPlayers(players.filter((p: Player) => !p.isHost));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode, playerNameParam]);

  const handleVote = (playerId: string) => {
    if (votedFor || resultsRevealed) return;
    setVotedFor(playerId);
    socket?.emit('submit-vote', { roomCode, votedForId: playerId });
  };

  // Lobby
  if (gameState === 'lobby') {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background p-6">
        <header className="mb-8">
          <div className="inline-block px-4 py-1 rounded-full bg-card border border-border text-sm font-bold tracking-widest text-muted-foreground mb-4">
            ROOM {roomCode}
          </div>
          <h1 className="text-4xl font-bold font-display">You're in!</h1>
          <p className="text-xl text-muted-foreground mt-2">Look at the big screen.</p>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <h2 className="text-2xl font-bold">Waiting for host to start...</h2>
        </div>
      </div>
    );
  }

  // Playing
  if (gameState === 'playing') {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background p-4 sm:p-6">
        <header className="mb-6 sticky top-0 bg-background/90 backdrop-blur-md z-10 py-4 border-b border-border/50">
          <h2 className="text-xl font-bold font-display leading-tight">{currentQuestion?.prompt || "Loading..."}</h2>
        </header>

        <main className="flex-1 flex flex-col">
          {!votedFor && !resultsRevealed ? (
            <div className="space-y-4 pb-8">
              {players.filter(p => p.id !== me?.id).map((p) => (
                <Card 
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  className="p-6 cursor-pointer active:scale-95 transition-transform bg-card hover:bg-card/80 border-2 border-border hover:border-primary"
                  data-testid={`btn-vote-${p.id}`}
                >
                  <span className="text-2xl font-bold">{p.name}</span>
                </Card>
              ))}
            </div>
          ) : !resultsRevealed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center">
                <span className="text-4xl">👍</span>
              </motion.div>
              <h2 className="text-3xl font-bold">Vote received!</h2>
              <p className="text-xl text-muted-foreground">Look at the big screen to see what everyone else thought.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <h2 className="text-3xl font-bold text-primary">Results are up!</h2>
              <p className="text-xl text-muted-foreground">Look at the big screen.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Finished
  if (gameState === 'finished') {
    const myScore = players.find(p => p.id === me?.id)?.score || 0;
    
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background p-6 items-center justify-center text-center space-y-8">
        <h1 className="text-5xl font-black font-display">Game Over!</h1>
        <div className="bg-card p-8 rounded-3xl border-2 border-primary/30 w-full max-w-sm">
          <p className="text-lg text-muted-foreground mb-2">You scored</p>
          <div className="text-6xl font-black text-primary">{myScore}</div>
          <p className="text-lg text-muted-foreground mt-2">points</p>
        </div>
        <p className="text-xl text-muted-foreground">Look at the big screen for final standings.</p>
      </div>
    );
  }

  return null;
}
