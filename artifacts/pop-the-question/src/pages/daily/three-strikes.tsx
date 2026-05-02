import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetTodayThreeStrikes } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, Share2, Home as HomeIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ThreeStrikes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: challenge, isLoading } = useGetTodayThreeStrikes();
  
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Load state from local storage
    if (challenge) {
      try {
        const savedState = localStorage.getItem(`ptq-three-strikes-${todayDate}`);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.completed) {
            setGameOver(true);
            setHasWon(parsed.score === challenge.totalCount);
            setStrikes(parsed.strikes);
            // We don't have the exact guesses, but we can fake it by marking all correct if won
          }
        }
      } catch (e) {}
    }
  }, [challenge, todayDate]);

  useEffect(() => {
    if (gameOver && challenge) {
      const score = guesses.length;
      const won = score === challenge.totalCount;
      
      // Save completion state
      localStorage.setItem(`ptq-three-strikes-${todayDate}`, JSON.stringify({
        completed: true,
        score,
        strikes
      }));

      // Update streak
      try {
        const currentStreak = parseInt(localStorage.getItem('ptq-streak-three-strikes') || '0');
        if (won) {
          localStorage.setItem('ptq-streak-three-strikes', (currentStreak + 1).toString());
        } else {
          localStorage.setItem('ptq-streak-three-strikes', '0');
        }
        
        // Update stats
        const statsStr = localStorage.getItem('ptq-stats');
        const stats = statsStr ? JSON.parse(statsStr) : { threeStrikesTotalPlays: 0, threeStrikesBestScore: 0, crosswordTotalPlays: 0, crosswordBestTime: 0 };
        stats.threeStrikesTotalPlays += 1;
        if (score > stats.threeStrikesBestScore) stats.threeStrikesBestScore = score;
        localStorage.setItem('ptq-stats', JSON.stringify(stats));
      } catch (e) {}
    }
  }, [gameOver, guesses.length, strikes, challenge, todayDate]);

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameOver || !currentGuess.trim() || !challenge) return;

    const guessNormalized = currentGuess.trim().toLowerCase();
    
    // Check if already guessed
    const alreadyGuessed = challenge.answers.some(ans => 
      ans.correct.some(c => c.toLowerCase() === guessNormalized) &&
      guesses.includes(ans.display)
    );

    if (alreadyGuessed) {
      toast({
        title: "Already guessed!",
        description: "You've already found this answer.",
        variant: "default",
      });
      setCurrentGuess("");
      return;
    }

    // Check for match
    const matchedAnswer = challenge.answers.find(ans => 
      ans.correct.some(c => c.toLowerCase() === guessNormalized)
    );

    if (matchedAnswer) {
      const newGuesses = [...guesses, matchedAnswer.display];
      setGuesses(newGuesses);
      setCurrentGuess("");
      
      if (newGuesses.length === challenge.totalCount) {
        setGameOver(true);
        setHasWon(true);
      }
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      setCurrentGuess("");
      
      if (newStrikes >= 3) {
        setGameOver(true);
        setHasWon(false);
      }
    }
    
    inputRef.current?.focus();
  };

  const handleShare = () => {
    if (!challenge) return;
    const score = guesses.length;
    const total = challenge.totalCount;
    const dateStr = new Date().toLocaleDateString();
    
    const strikeMojis = Array(3).fill('⚪').map((_, i) => i < strikes ? '🔴' : '⚪').join('');
    
    const shareText = `Pop: The Question - Three Strikes\n${dateStr}\n${challenge.title}: ${score}/${total} ${strikeMojis}\n\npopthequestion.com`;
    
    navigator.clipboard.writeText(shareText).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: "Share your score with friends.",
      });
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  if (!challenge) {
    return <div className="flex-1 flex items-center justify-center">No challenge available today.</div>;
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">{challenge.title}</h1>
          <p className="text-lg text-muted-foreground">{challenge.prompt}</p>
        </div>
        
        <div className="flex gap-2 items-center bg-card p-3 rounded-xl border border-border">
          <span className="font-bold mr-2 text-sm text-muted-foreground uppercase tracking-wider">Strikes:</span>
          {[0, 1, 2].map((i) => (
            <motion.div 
              key={i}
              initial={false}
              animate={{ 
                scale: i < strikes ? [1, 1.2, 1] : 1,
                color: i < strikes ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"
              }}
              transition={{ duration: 0.3 }}
            >
              <AlertCircle 
                className={`w-8 h-8 ${i < strikes ? "text-destructive fill-destructive/20" : "text-muted-foreground"}`} 
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
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`h-full flex flex-col items-center justify-center p-4 text-center border-2 transition-all duration-500
                  ${isGuessed ? 'bg-success/10 border-success/50' : 
                    isRevealed ? 'bg-destructive/10 border-destructive/50' : 'bg-card border-border/50'}`}
                >
                  {isGuessed || isRevealed ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full"
                    >
                      <div className={`font-bold text-lg md:text-xl mb-1 ${isGuessed ? 'text-success' : 'text-destructive'}`}>
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
        <form onSubmit={handleGuess} className="flex gap-2 max-w-xl mx-auto w-full sticky bottom-4 z-10 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border shadow-xl">
          <Input
            ref={inputRef}
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value)}
            placeholder="Type your guess..."
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
            {hasWon ? (
              <span className="text-success">Perfect!</span>
            ) : (
              <span className="text-destructive">Game Over!</span>
            )}
          </h2>
          <p className="text-xl text-muted-foreground mb-6">
            You got <span className="font-bold text-foreground">{guesses.length}</span> out of <span className="font-bold text-foreground">{challenge.totalCount}</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleShare} className="bg-accent hover:bg-accent/90" data-testid="btn-share">
              <Share2 className="w-5 h-5 mr-2" /> Share Result
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/")} data-testid="btn-home">
              <HomeIcon className="w-5 h-5 mr-2" /> Go Home
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
