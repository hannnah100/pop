import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetTodayThreeStrikes,
  useGetThreeStrikesById,
  getGetTodayThreeStrikesQueryKey,
  getGetThreeStrikesByIdQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Share2, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { findMatchingAnswer } from "@/utils/answerMatching";
import {
  CountUp,
  fireConfetti,
  fireBigCelebration,
  Shake,
  Pop,
  ShimmerGrid,
  BannerStack,
  TimerRing,
} from "@/components/fx";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticStrike, hapticVictory, hapticWrong } from "@/lib/haptics";
import { useStreaks, type Banner } from "@/lib/streaks";
import { useReducedMotion, easing } from "@/lib/motion";

function useQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function ThreeStrikes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playStrike, playVictory } = useSfx();
  const { recordGame } = useStreaks();
  const reduced = useReducedMotion();

  const archiveId = useQueryParam("id");
  const isArchive = !!archiveId;

  const todayQuery = useGetTodayThreeStrikes({
    query: {
      queryKey: getGetTodayThreeStrikesQueryKey(),
      enabled: !isArchive,
    },
  });
  const archiveQuery = useGetThreeStrikesById(archiveId ?? "", {
    query: {
      queryKey: getGetThreeStrikesByIdQueryKey(archiveId ?? ""),
      enabled: isArchive,
    },
  });

  const { data: challenge, isLoading } = isArchive ? archiveQuery : todayQuery;

  const [guesses, setGuesses] = useState<string[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [strikePopKey, setStrikePopKey] = useState(0);
  const [lastCorrectIdx, setLastCorrectIdx] = useState<number | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const recordedRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Array<HTMLDivElement | null>>([]);

  const todayDate = new Date().toISOString().split("T")[0];
  const storageKey = isArchive
    ? `ptq-archive-ts-${archiveId}`
    : `ptq-three-strikes-${todayDate}`;

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
          recordedRef.current = true;
        }
      }
    } catch {/* ignore */}
  }, [challenge, storageKey]);

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
    } catch {/* ignore */}

    if (!recordedRef.current) {
      recordedRef.current = true;
      const newBanners = recordGame("three-strikes", guesses.length);
      if (hasWon) {
        playVictory();
        hapticVictory();
        fireBigCelebration();
      }
      if (newBanners.length > 0) setBanners((b) => [...b, ...newBanners]);
    }
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
      toast({ title: "Too short", description: "Type at least 2 characters." });
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
      setLastCorrectIdx(matchIndex);
      playCorrect();
      hapticCorrect();

      const cell = cellRefs.current[matchIndex];
      if (cell) {
        const rect = cell.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        fireConfetti("green", { particleCount: 60, spread: 90, origin: { x, y }, startVelocity: 30 });
      }

      toast({ title: `✓ ${matched.display}`, description: matched.hint });

      if (newGuesses.length === challenge.totalCount) {
        setGameOver(true);
        setHasWon(true);
      }
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      setCurrentGuess("");
      setShakeKey((k) => k + 1);
      setStrikePopKey((k) => k + 1);
      playStrike();
      hapticStrike();
      playWrong();
      hapticWrong();
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
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="space-y-3">
          <div className="shimmer-bg h-10 w-2/3 rounded-md" />
          <div className="shimmer-bg h-5 w-1/2 rounded-md" />
        </div>
        <ShimmerGrid count={8} cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" itemClassName="h-24" />
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
      <BannerStack banners={banners} onDone={(id) => setBanners((b) => b.filter((x) => x.id !== id))} />

      {isArchive && (
        <div className="mb-4">
          <Badge variant="outline" className="text-accent border-accent/30">📦 Archive Replay</Badge>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight text-foreground mb-2">
            {challenge.title}
          </h1>
          <div className="heading-divider heading-divider--orange w-16 h-1 mb-3" />
          <p className="text-lg text-muted-foreground">{challenge.prompt}</p>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            <CountUp value={guesses.length} duration={0.5} />/{challenge.totalCount} found
          </p>
        </div>

        <div className="flex gap-3 items-center bg-card/80 backdrop-blur p-3 rounded-xl border border-border surface-elevated">
          <Pop trigger={strikePopKey} asTag="span">
            <TimerRing
              value={Math.max(0, 3 - strikes)}
              total={3}
              size={56}
              thickness={6}
              label={`${Math.max(0, 3 - strikes)}`}
              showLabel
            />
          </Pop>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider leading-tight">Strikes left</span>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => {
                const active = i < strikes;
                return (
                  <Pop key={i} trigger={active ? strikePopKey : 0} asTag="span">
                    <Shake trigger={active ? strikePopKey : 0} asTag="span">
                      <AlertCircle
                        className={`w-6 h-6 transition-colors ${active ? "text-destructive fill-destructive/20 drop-shadow-[0_0_8px_hsl(var(--destructive))]" : "text-muted-foreground/40"}`}
                      />
                    </Shake>
                  </Pop>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8" style={{ perspective: 1200 }}>
        {challenge.answers.map((answer, idx) => {
          const isGuessed = guesses.includes(answer.display);
          const isRevealed = gameOver && !isGuessed;
          const showFront = !isGuessed && !isRevealed;
          const isLastCorrect = idx === lastCorrectIdx && isGuessed;

          return (
            <motion.div
              key={idx}
              ref={(el) => { cellRefs.current[idx] = el; }}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduced ? 0 : Math.min(idx * 0.025, 0.6), duration: 0.4, ease: easing.out }}
              className="relative min-h-[110px]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: showFront ? 0 : 180 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 22 }}
              >
                <Card
                  className="absolute inset-0 h-full flex flex-col items-center justify-center p-4 text-center border-2 min-h-[100px] bg-card/70 border-border/50"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="text-3xl font-bold text-muted mb-2">?</div>
                  <div className="text-sm font-medium text-muted-foreground">{answer.hint}</div>
                </Card>
                <Card
                  className={`absolute inset-0 h-full flex flex-col items-center justify-center p-4 text-center border-2 min-h-[100px] transition-shadow duration-500
                    ${isGuessed
                      ? "bg-success/10 border-success/60 shadow-[0_0_28px_-6px_hsl(var(--success)/0.7)]"
                      : "bg-destructive/10 border-destructive/60 shadow-[0_0_28px_-6px_hsl(var(--destructive)/0.6)]"
                    }
                    ${isLastCorrect ? "animate-pulse-glow" : ""}
                  `}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <div className={`font-bold text-base md:text-lg mb-1 ${isGuessed ? "text-success" : "text-destructive"}`}>
                    {answer.display}
                  </div>
                  <div className="text-xs text-muted-foreground">{answer.hint}</div>
                </Card>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {!gameOver ? (
        <Shake trigger={shakeKey}>
          <form
            onSubmit={handleGuess}
            className="flex gap-2 max-w-xl mx-auto w-full sticky bottom-4 z-10 bg-background/85 backdrop-blur-md p-4 rounded-2xl border border-border shadow-2xl"
          >
            <Input
              ref={inputRef}
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value)}
              placeholder="Type your guess…"
              className="text-lg py-6 bg-card border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:shadow-[0_0_24px_-4px_hsl(var(--primary))] transition-shadow"
              autoFocus
              data-testid="input-guess"
            />
            <Button type="submit" size="lg" className="py-6 px-8 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="btn-submit-guess">
              <ArrowRight className="w-6 h-6" />
            </Button>
          </form>
        </Shake>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="max-w-xl mx-auto w-full bg-card/90 backdrop-blur p-6 md:p-8 rounded-3xl border border-border text-center shadow-2xl surface-elevated"
        >
          <h2 className="text-4xl font-bold mb-2 font-display">
            {hasWon ? <span className="text-success text-glow-primary">Perfect!</span> : <span className="text-destructive">Game Over!</span>}
          </h2>
          <p className="text-xl text-muted-foreground mb-6">
            You got <CountUp className="font-bold text-foreground" value={guesses.length} /> of{" "}
            <span className="font-bold text-foreground">{challenge.totalCount}</span> with{" "}
            <CountUp className="font-bold text-foreground" value={strikes} /> strike{strikes !== 1 ? "s" : ""}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleShare} className="bg-accent hover:bg-accent/90 text-accent-foreground shimmer-sweep" data-testid="btn-share">
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
