import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetTodayThreeStrikes, useGetThreeStrikesById } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, Share2, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { findMatchingAnswer } from "@/utils/answerMatching";

function useQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function ThreeStrikes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const archiveId = useQueryParam("id");
  const isArchive = !!archiveId;

  const todayQuery = useGetTodayThreeStrikes({ query: { enabled: !isArchive } });
  const archiveQuery = useGetThreeStrikesById(archiveId ?? "", { query: { enabled: isArchive } });

  const { data: challenge, isLoading } = isArchive ? archiveQuery : todayQuery;

  const [guesses, setGuesses] = useState<string[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const todayDate = new Date().toISOString().split("T")[0];
  const storageKey = isArchive
    ? `ptq-archive-ts-${archiveId}`
    : `ptq-three-strikes-${todayDate}`;

  // Restore saved state
  useEffect(() => {
    if (!challenge) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.completed) {
          setGameOver(true);
          setHasWon(parsed.hasWon ?? false);
          setStrikes(parsed.strikes ?? 0);
          setGuesses(parsed.guesses ?? []);
        }
      }
    } catch {}
  }, [challenge, storageKey]);

  // Save state on game over
  useEffect(() => {
    if (!gameOver || !challenge) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        completed: true,
        hasWon,
        score: guesses.length,
        total: challenge.totalCount,
        strikes,
        guesses,
      }));

      if (!isArchive) {
        const currentStreak = parseInt(localStorage.getItem("ptq-streak-three-strikes") ?? "0");
        localStorage.setItem("ptq-streak-three-strikes", hasWon ? (currentStreak + 1).toString() : "0");

        const statsStr = localStorage.getItem("ptq-stats");
        const stats = statsStr
          ? JSON.parse(statsStr)
          : { threeStrikesTotalPlays: 0, threeStrikesBestScore: 0, crosswordTotalPlays: 0, crosswordBestTime: 0 };
        stats.threeStrikesTotalPlays += 1;
        if (guesses.length > stats.threeStrikesBestScore) stats.threeStrikesBestScore = guesses.length;
        localStorage.setItem("ptq-stats", JSON.stringify(stats));
      }
    } catch {}
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const guess = currentGuess.trim();
    if (gameOver || !guess || !challenge) return;

    if (/^\d+$/.test(guess) || /^[^a-zA-Z0-9]+$/.test(guess)) {
      setCurrentGuess("");
      return;
    }

    if (guess.length < 2) {
      toast({ title: "Too short", description: "Type at least 2 characters.", variant: "default" });
      return;
    }

    const matchIndex = findMatchingAnswer(guess, challenge.answers);

    if (matchIndex !== -1 && guesses.includes(challenge.answers[matchIndex].display)) {
      toast({ title: "Already found!", description: `You already got "${challenge.answers[matchIndex].display}".` });
      setCurrentGuess("");
      inputRef.current?.focus();
      return;
    }

    if (matchIndex !== -1) {
      const matched = challenge.answers[matchIndex];
      const newGuesses = [...guesses, matched.display];
      setGuesses(newGuesses);
      setCurrentGuess("");
      toast({ title: `✓ ${matched.display}`, description: matched.hint });

      if (newGuesses.length === challenge.totalCount) {
        setGameOver(true);
        setHasWon(true);
      }
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      setCurrentGuess("");
      toast({
        title: `✗ Strike ${newStrikes}/3`,
        description: `"${guess}" doesn't match any answer.`,
        variant: "destructive",
      });

      if (newStrikes >= 3) {
        setGameOver(true);
        setHasWon(false);
      }
    }

    inputRef.current?.focus();
  };

  const handleShare = () => {
    if (!challenge) return;
    const strikeMojis = Array(3).fill("⚪").map((_, i) => i < strikes ? "🔴" : "⚪").join("");
    const shareText = `Pop: The Question – Three Strikes\n${challenge.title}: ${guesses.length}/${challenge.totalCount} ${strikeMojis}\n\npopthequestion.com`;
    navigator.clipboard.writeText(shareText).then(() => {
      toast({ title: "Copied!", description: "Share your score with friends." });
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading challenge…</div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Challenge not found.</p>
        <Button variant="outline" onClick={() => setLocation("/archive")}>Back to Archive</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
      {isArchive && (
        <div className="mb-4">
          <Badge variant="outline" className="text-accent border-accent/30">📦 Archive Replay</Badge>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">{challenge.title}</h1>
          <p className="text-lg text-muted-foreground">{challenge.prompt}</p>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{guesses.length}/{challenge.totalCount} found</p>
        </div>

        <div className="flex gap-2 items-center bg-card p-3 rounded-xl border border-border">
          <span className="font-bold mr-2 text-sm text-muted-foreground uppercase tracking-wider">Strikes:</span>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ scale: i < strikes ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <AlertCircle
                className={`w-8 h-8 transition-colors ${i < strikes ? "text-destructive fill-destructive/20" : "text-muted-foreground"}`}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <AnimatePresence>
          {challenge.answers.map((answer, idx) => {
            const isGuessed = guesses.includes(answer.display);
            const isRevealed = gameOver && !isGuessed;

            return (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card
                  className={`h-full flex flex-col items-center justify-center p-4 text-center border-2 transition-all duration-500 min-h-[90px]
                    ${isGuessed ? "bg-success/10 border-success/50" :
                      isRevealed ? "bg-destructive/10 border-destructive/50" :
                      "bg-card border-border/50"}`}
                >
                  {isGuessed || isRevealed ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full"
                    >
                      <div className={`font-bold text-base md:text-lg mb-1 ${isGuessed ? "text-success" : "text-destructive"}`}>
                        {answer.display}
                      </div>
                      <div className="text-xs text-muted-foreground">{answer.hint}</div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-muted mb-2">?</div>
                      <div className="text-sm font-medium text-muted-foreground">{answer.hint}</div>
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!gameOver ? (
        <form
          onSubmit={handleGuess}
          className="flex gap-2 max-w-xl mx-auto w-full sticky bottom-4 z-10 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border shadow-xl"
        >
          <Input
            ref={inputRef}
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value)}
            placeholder="Type your guess…"
            className="text-lg py-6 bg-card border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-primary/30"
            autoFocus
            data-testid="input-guess"
          />
          <Button type="submit" size="lg" className="py-6 px-8 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="btn-submit-guess">
            <ArrowRight className="w-6 h-6" />
          </Button>
        </form>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto w-full bg-card p-6 md:p-8 rounded-3xl border border-border text-center shadow-2xl"
        >
          <h2 className="text-4xl font-bold mb-2 font-display">
            {hasWon ? <span className="text-success">Perfect!</span> : <span className="text-destructive">Game Over!</span>}
          </h2>
          <p className="text-xl text-muted-foreground mb-6">
            You got <span className="font-bold text-foreground">{guesses.length}</span> of{" "}
            <span className="font-bold text-foreground">{challenge.totalCount}</span> with{" "}
            <span className="font-bold text-foreground">{strikes}</span> strike{strikes !== 1 ? "s" : ""}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleShare} className="bg-accent hover:bg-accent/90" data-testid="btn-share">
              <Share2 className="w-5 h-5 mr-2" /> Share Result
            </Button>
            {isArchive ? (
              <Button size="lg" variant="outline" onClick={() => setLocation("/archive")} data-testid="btn-archive">
                <HomeIcon className="w-5 h-5 mr-2" /> Back to Archive
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => setLocation("/")} data-testid="btn-home">
                <HomeIcon className="w-5 h-5 mr-2" /> Go Home
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
