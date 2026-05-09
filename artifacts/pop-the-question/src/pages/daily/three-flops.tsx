import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetTodayThreeFlops,
  useGetThreeFlopsById,
  useGetThreeFlopsLeaderboard,
  useSubmitThreeFlopsScore,
  useUpdatePlayerName,
  getGetTodayThreeFlopsQueryKey,
  getGetThreeFlopsByIdQueryKey,
  getGetThreeFlopsLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Share2, Home as HomeIcon, Trophy, BarChart2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
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
} from "@/components/fx";
import { LightningDoodle, StarDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticStrike, hapticVictory, hapticWrong } from "@/lib/haptics";
import { useStreaks, type Banner } from "@/lib/streaks";
import { useReducedMotion, easing } from "@/lib/motion";

function useQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

function getPlayerToken(): string {
  let token = localStorage.getItem("ptq-player-token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("ptq-player-token", token);
  }
  return token;
}

function getStoredPlayerName(): string {
  return localStorage.getItem("ptq-player-name") ?? "";
}

function savePlayerName(name: string): void {
  localStorage.setItem("ptq-player-name", name.trim());
}

export default function ThreeFlops() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playFlop, playVictory } = useSfx();
  const { recordGame } = useStreaks();
  const reduced = useReducedMotion();

  const archiveId = useQueryParam("id");
  const isArchive = !!archiveId;

  const todayQuery = useGetTodayThreeFlops({
    query: { queryKey: getGetTodayThreeFlopsQueryKey(), enabled: !isArchive },
  });
  const archiveQuery = useGetThreeFlopsById(archiveId ?? "", {
    query: { queryKey: getGetThreeFlopsByIdQueryKey(archiveId ?? ""), enabled: isArchive },
  });

  const { data: challenge, isLoading } = isArchive ? archiveQuery : todayQuery;

  const [guesses, setGuesses] = useState<string[]>([]);
  const [flops, setFlops] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [flopPopKey, setFlopPopKey] = useState(0);
  const [lastCorrectIdx, setLastCorrectIdx] = useState<number | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const recordedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Array<HTMLDivElement | null>>([]);

  const todayDate = new Date().toISOString().split("T")[0];

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";
  const [playerName, setPlayerName] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredPlayerName() : ""
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const leaderboardQuery = useGetThreeFlopsLeaderboard(
    { date: challenge?.date ?? todayDate, playerToken },
    {
      query: {
        queryKey: getGetThreeFlopsLeaderboardQueryKey({ date: challenge?.date ?? todayDate, playerToken }),
        enabled: leaderboardEnabled,
      },
    },
  );
  const scoresMutation = useSubmitThreeFlopsScore();
  const updateNameMutation = useUpdatePlayerName();

  function commitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePlayerName(trimmed);
    setPlayerName(trimmed);
    updateNameMutation.mutate({ data: { playerToken, playerName: trimmed } });
  }
  // Storage keys (`ptq-three-strikes-…`, `ptq-archive-ts-…`,
  // `ptq-streak-three-strikes`, `ptq-stats.threeStrikes*`) are intentionally
  // kept under their legacy names so player progress saved before the rename
  // to "Three Flops" still loads. These are internal identifiers only — no UI
  // surface ever shows them.
  // Use the puzzle's own date so that if the server falls back to the most
  // recent challenge (when today's hasn't been seeded yet), the storage key
  // still matches any existing save for that puzzle.
  const storageKey = isArchive ? `ptq-archive-ts-${archiveId}` : `ptq-three-strikes-${challenge?.date ?? todayDate}`;

  useEffect(() => {
    if (!challenge) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.completed) {
          setGameOver(true);
          setHasWon(parsed.hasWon ?? false);
          // Legacy saves used `strikes`; new saves use `flops`. Read both.
          setFlops(parsed.flops ?? parsed.strikes ?? 0);
          setGuesses(parsed.guesses ?? []);
          recordedRef.current = true;
          setLeaderboardEnabled(true);
        }
      }
    } catch {/* ignore */}
  }, [challenge, storageKey]);

  useEffect(() => {
    if (!gameOver || !challenge) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        completed: true, hasWon, score: guesses.length,
        total: challenge.totalCount,
        // Persist under both keys for forward + backward compat with archive readers.
        flops, strikes: flops,
        guesses,
      }));
      if (!isArchive) {
        // Read either canonical or legacy streak key, then write to BOTH so
        // older parts of the UI that still read the legacy key keep working.
        const streakRaw = localStorage.getItem("ptq-streak-three-flops")
          ?? localStorage.getItem("ptq-streak-three-strikes")
          ?? "0";
        const currentStreak = parseInt(streakRaw);
        const nextStreak = hasWon ? (currentStreak + 1).toString() : "0";
        localStorage.setItem("ptq-streak-three-flops", nextStreak);
        localStorage.setItem("ptq-streak-three-strikes", nextStreak);
        const statsStr = localStorage.getItem("ptq-stats");
        const stats = statsStr ? JSON.parse(statsStr) : {};
        // Read legacy `threeStrikes*` as fallback so prior progress carries
        // over; write canonical `threeFlops*` going forward.
        const prevPlays = stats.threeFlopsTotalPlays ?? stats.threeStrikesTotalPlays ?? 0;
        const prevBest = stats.threeFlopsBestScore ?? stats.threeStrikesBestScore ?? 0;
        stats.threeFlopsTotalPlays = prevPlays + 1;
        stats.threeFlopsBestScore = Math.max(prevBest, guesses.length);
        localStorage.setItem("ptq-stats", JSON.stringify(stats));
      }
    } catch {/* ignore */}
    if (!recordedRef.current) {
      recordedRef.current = true;
      // Recorded under the legacy key to keep per-game counters continuous
      // across the rename.
      // Canonical key is now "three-flops"; the streaks lib migrates any
      // legacy "three-strikes" entries forward on read (see streaks.ts).
      const newBanners = recordGame("three-flops", guesses.length);
      if (hasWon) { playVictory(); hapticVictory(); fireBigCelebration(); }
      if (newBanners.length > 0) setBanners((b) => [...b, ...newBanners]);
      if (!isArchive && challenge) {
        scoresMutation.mutate(
          { data: { playerToken, score: guesses.length, date: challenge.date } },
          {
            onSettled: () => setLeaderboardEnabled(true),
          },
        );
      }
    }
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const guess = currentGuess.trim();
    if (gameOver || !guess || !challenge) return;
    if (/^[^a-zA-Z0-9]+$/.test(guess)) { setCurrentGuess(""); return; }
    if (guess.length < 2) { toast({ title: "Too short", description: "Type at least 2 characters." }); return; }

    const matchIndex = findMatchingAnswer(guess, challenge.answers);

    if (matchIndex !== -1 && guesses.includes(challenge.answers[matchIndex].display)) {
      toast({ title: "Already found!", description: `You already got "${challenge.answers[matchIndex].display}".` });
      setCurrentGuess(""); inputRef.current?.focus(); return;
    }

    if (matchIndex !== -1) {
      const matched = challenge.answers[matchIndex];
      const newGuesses = [...guesses, matched.display];
      setGuesses(newGuesses); setCurrentGuess(""); setLastCorrectIdx(matchIndex);
      playCorrect(); hapticCorrect();
      const cell = cellRefs.current[matchIndex];
      if (cell) {
        const rect = cell.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        fireConfetti("green", { particleCount: 60, spread: 90, origin: { x, y }, startVelocity: 30 });
      }
      toast({ title: `✓ ${matched.display}`, description: matched.hint });
      if (newGuesses.length === challenge.totalCount) { setGameOver(true); setHasWon(true); }
    } else {
      const newFlops = flops + 1;
      setFlops(newFlops); setCurrentGuess(""); setShakeKey((k) => k + 1); setFlopPopKey((k) => k + 1);
      playFlop(); hapticStrike(); playWrong(); hapticWrong();
      toast({ title: `✗ Flop ${newFlops}/3`, description: `"${guess}" doesn't match any answer.`, variant: "destructive" });
      if (newFlops >= 3) { setGameOver(true); setHasWon(false); }
    }
    inputRef.current?.focus();
  };

  const handleShare = () => {
    if (!challenge) return;
    // Deterministic en-US date so the share text is identical for every
    // player regardless of locale (e.g. "May 3, 2026").
    const humanDate = new Date(challenge.date + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
    const resultEmoji = hasWon
      ? (flops === 0 ? "🏆" : "✓")
      : "💀";
    const shareText = [
      `Pop The Question - Three Flops`,
      humanDate,
      ``,
      `Completed: ${guesses.length}/${challenge.totalCount} ${resultEmoji}`,
      `Used ${flops}/3 flops`,
      ``,
      `popthequestion.replit.app`,
    ].join("\n");
    navigator.clipboard.writeText(shareText).then(() => toast({ title: "Copied!", description: "Share your score with friends." }));
  };

  const leaderboard = leaderboardQuery.data;
  const serverRank = leaderboard?.playerRank ?? null;
  const myRankInTop10 = leaderboard
    ? leaderboard.top10.findIndex((e) => e.playerToken === playerToken) + 1
    : 0;
  const myRank = serverRank ?? (myRankInTop10 > 0 ? myRankInTop10 : null);
  const rankPercentile =
    myRank !== null && leaderboard && leaderboard.totalPlayers > 0
      ? Math.round((1 - (myRank - 1) / leaderboard.totalPlayers) * 100)
      : null;

  if (isLoading) {
    return (
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="shimmer-bg h-10 w-2/3" />
        <div className="shimmer-bg h-5 w-1/2" />
        <ShimmerGrid count={8} cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" itemClassName="h-24" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <p className="text-black/60">Challenge not found.</p>
        <Button variant="outline" onClick={() => setLocation("/archive")}>Back to Archive</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
      <BannerStack banners={banners} onDone={(id) => setBanners((b) => b.filter((x) => x.id !== id))} />

      <div className="flex items-center gap-3 mb-4">
        <BackArrow href={isArchive ? "/archive" : "/"} label={isArchive ? "Back to archive" : "Back to home"} />
        {isArchive && <Badge variant="outline">📦 Archive Replay</Badge>}
      </div>

      {/* Game header */}
      <div className="relative bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] px-5 py-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 overflow-hidden">
        <LightningDoodle className="absolute top-2 right-4 w-6 h-9 text-[#FF6B35] opacity-40" />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-black text-black uppercase tracking-tight">
            Three Flops
          </h1>
          <p className="text-base text-black/80 font-sans font-bold mt-1">{challenge.title}</p>
          <p className="text-sm text-black/60 font-sans mt-0.5">{challenge.prompt}</p>
          <p className="text-sm font-bold text-black/50 font-sans mt-0.5">
            <CountUp value={guesses.length} duration={0.5} />/{challenge.totalCount} found
          </p>
        </div>

        {/* Flops display */}
        <div className="flex items-center gap-3 bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-3 flex-shrink-0">
          <span className="font-display font-black text-sm text-black uppercase tracking-wide">Flops</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => {
              const active = i < flops;
              return (
                <Pop key={i} trigger={active ? flopPopKey : 0} asTag="span">
                  <Shake trigger={active ? flopPopKey : 0} asTag="span">
                    <AlertCircle
                      className={`w-7 h-7 transition-none ${active ? "text-[#FF0000] fill-[#FF0000]/20" : "text-black/20"}`}
                    />
                  </Shake>
                </Pop>
              );
            })}
          </div>
        </div>
      </div>

      {/* Answer grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {challenge.answers.map((answer, idx) => {
          const isGuessed = guesses.includes(answer.display);
          const isRevealed = gameOver && !isGuessed;
          const showFront = !isGuessed && !isRevealed;
          const isLastCorrect = idx === lastCorrectIdx && isGuessed;

          return (
            <motion.div
              key={idx}
              ref={(el) => { cellRefs.current[idx] = el; }}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduced ? 0 : Math.min(idx * 0.025, 0.4), duration: 0.2, ease: easing.out }}
              className="relative min-h-[100px]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: showFront ? 0 : 180 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 22 }}
              >
                {/* Front — unrevealed */}
                <div
                  className="absolute inset-0 h-full flex flex-col items-center justify-center p-3 text-center border-[3px] border-black bg-[#FFF8E7] shadow-[3px_3px_0_#000] min-h-[100px]"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="text-3xl font-black text-black/20 mb-1">?</div>
                  <div className="text-xs font-medium text-black/50 font-sans">{answer.hint}</div>
                </div>

                {/* Back — revealed */}
                <div
                  className={`absolute inset-0 h-full flex flex-col items-center justify-center p-3 text-center border-[3px] border-black min-h-[100px] ${
                    isLastCorrect ? "animate-pulse" : ""
                  } ${
                    isGuessed
                      ? "bg-[#00C853] shadow-[3px_3px_0_#000]"
                      : "bg-[#FF6B6B] shadow-[3px_3px_0_#000]"
                  }`}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {isGuessed && <StarDoodle className="absolute top-1 right-1 w-4 h-4 text-white opacity-60" />}
                  <div className="font-black text-sm md:text-base text-black mb-1 font-display">
                    {answer.display}
                  </div>
                  <div className="text-xs text-black/60 font-sans">{answer.hint}</div>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Input / game over */}
      {!gameOver ? (
        <Shake trigger={shakeKey}>
          <form
            onSubmit={handleGuess}
            className="flex gap-2 max-w-xl mx-auto w-full sticky bottom-4 z-10 bg-[#FFF8E7] border-[3px] border-black shadow-[4px_4px_0_#000] p-3"
          >
            <Input
              ref={inputRef}
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value)}
              placeholder="Type your guess…"
              className="text-base h-12 border-[3px] border-black bg-white focus-visible:ring-[#FF1493]"
              autoFocus
              data-testid="input-guess"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 px-6 font-display uppercase"
              data-testid="btn-submit-guess"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </form>
        </Shake>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className={`max-w-xl mx-auto w-full border-[3px] border-black shadow-[6px_6px_0_#000] p-6 md:p-8 text-center ${
              hasWon ? "bg-[#00C853]" : "bg-[#FF6B6B]"
            }`}
          >
            {hasWon
              ? <StarDoodle className="w-14 h-14 text-[#FFD700] mx-auto mb-3" />
              : <LightningDoodle className="w-10 h-14 text-black mx-auto mb-3 opacity-60" />
            }
            <h2 className="font-display text-4xl font-black text-black uppercase mb-2">
              {hasWon ? "Perfect!" : "Game Over!"}
            </h2>
            <p className="text-lg text-black/70 font-sans mb-2">
              Got <CountUp className="font-black text-black" value={guesses.length} /> of{" "}
              <span className="font-black text-black">{challenge.totalCount}</span> with{" "}
              <CountUp className="font-black text-black" value={flops} /> flop{flops !== 1 ? "s" : ""}
            </p>
            {rankPercentile !== null && (
              <div className="mb-4 inline-block bg-black text-white px-3 py-1 font-bold text-sm border-[2px] border-black">
                Top {100 - rankPercentile + 1}% of players today
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={handleShare}
                className="bg-black text-[#FFD700] hover:bg-[#FF1493] hover:text-black border-[3px] border-black shadow-[3px_3px_0_rgba(0,0,0,0.3)]"
                data-testid="btn-share"
              >
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

          {!isArchive && leaderboardEnabled && (
            <div className="max-w-xl mx-auto w-full mt-4 border-[3px] border-black bg-white shadow-[3px_3px_0_#000] overflow-hidden">
              <div className="bg-black px-4 py-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FFD700]" />
                <span className="text-white font-display font-black text-sm uppercase">
                  Today's Leaderboard
                </span>
                {leaderboard && (
                  <Badge className="ml-auto bg-[#FFD700] text-black border-[#FFD700]">
                    {leaderboard.totalPlayers} played
                  </Badge>
                )}
              </div>
              {leaderboard && leaderboard.top10.length > 0 ? (
                <>
                  <div className="divide-y divide-black/10">
                    {leaderboard.top10.map((entry) => {
                      const isMe = entry.playerToken === playerToken;
                      return (
                        <div
                          key={entry.playerToken}
                          className={`flex items-center gap-3 px-4 py-2 ${isMe ? "bg-[#FFD700] border-l-4 border-[#00C853]" : ""}`}
                        >
                          <span className="font-display font-black text-sm w-6 text-center">
                            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                          </span>
                          {isMe ? (
                            <span className="flex-1 flex items-center gap-1 min-w-0">
                              {isEditingName ? (
                                <>
                                  <input
                                    autoFocus
                                    value={editNameValue}
                                    onChange={(e) => setEditNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                      else if (e.key === "Escape") { setIsEditingName(false); }
                                    }}
                                    maxLength={20}
                                    placeholder="Your name"
                                    className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1"
                                  />
                                  <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="p-0.5 text-black hover:text-[#00C853]" aria-label="Save name"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setIsEditingName(false)} className="p-0.5 text-black/50 hover:text-black" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <span className="font-bold text-sm truncate">{playerName || "You"}</span>
                                  <button onClick={() => { setEditNameValue(playerName); setIsEditingName(true); }} className="p-0.5 text-black/40 hover:text-black shrink-0" aria-label="Edit name"><Pencil className="w-3 h-3" /></button>
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="flex-1 font-bold text-sm">
                              {entry.playerName ?? `Player ${entry.playerToken.slice(0, 4)}`}
                            </span>
                          )}
                          <span className="font-display font-black text-sm">
                            {entry.score}/{challenge.totalCount}
                          </span>
                        </div>
                      );
                    })}
                    {myRank !== null && myRankInTop10 === 0 && (
                      <div className="flex items-center gap-3 px-4 py-2 bg-[#FFD700] border-l-4 border-[#00C853]">
                        <span className="font-display font-black text-sm w-6 text-center">#{myRank}</span>
                        <span className="flex-1 flex items-center gap-1 min-w-0">
                          {isEditingName ? (
                            <>
                              <input
                                autoFocus
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                  else if (e.key === "Escape") { setIsEditingName(false); }
                                }}
                                maxLength={20}
                                placeholder="Your name"
                                className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1"
                              />
                              <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="p-0.5 text-black hover:text-[#00C853]" aria-label="Save name"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setIsEditingName(false)} className="p-0.5 text-black/50 hover:text-black" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-sm truncate">{playerName || "You"}</span>
                              <button onClick={() => { setEditNameValue(playerName); setIsEditingName(true); }} className="p-0.5 text-black/40 hover:text-black shrink-0" aria-label="Edit name"><Pencil className="w-3 h-3" /></button>
                            </>
                          )}
                        </span>
                        <span className="font-display font-black text-sm">
                          {guesses.length}/{challenge.totalCount}
                        </span>
                      </div>
                    )}
                  </div>
                  {leaderboard.avgScore > 0 && (
                    <div className="bg-black/5 px-4 py-2 flex gap-4 text-xs font-bold text-black/60">
                      <span className="flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" />
                        Avg: {leaderboard.avgScore}/{challenge.totalCount}
                      </span>
                      <span>Median: {leaderboard.medianScore}/{challenge.totalCount}</span>
                    </div>
                  )}
                </>
              ) : gameOver ? (
                <div className="divide-y divide-black/10">
                  <div className="flex items-center gap-3 px-4 py-2 bg-[#FFD700] border-l-4 border-[#00C853]">
                    <span className="font-display font-black text-sm w-6 text-center">🥇</span>
                    <span className="flex-1 flex items-center gap-1 min-w-0">
                      {isEditingName ? (
                        <>
                          <input
                            autoFocus
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                              else if (e.key === "Escape") { setIsEditingName(false); }
                            }}
                            maxLength={20}
                            placeholder="Your name"
                            className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1"
                          />
                          <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="p-0.5 text-black hover:text-[#00C853]" aria-label="Save name"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setIsEditingName(false)} className="p-0.5 text-black/50 hover:text-black" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-sm truncate">{playerName || "You"}</span>
                          <button onClick={() => { setEditNameValue(playerName); setIsEditingName(true); }} className="p-0.5 text-black/40 hover:text-black shrink-0" aria-label="Edit name"><Pencil className="w-3 h-3" /></button>
                        </>
                      )}
                    </span>
                    <span className="font-display font-black text-sm">
                      {guesses.length}/{challenge.totalCount}
                    </span>
                  </div>
                </div>
              ) : leaderboardQuery.isPending ? (
                <div className="px-4 py-3 text-center text-sm text-black/50">Loading…</div>
              ) : (
                <div className="px-4 py-3 text-center text-sm text-black/50">Be the first to complete today's puzzle!</div>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-10 flex justify-center">
        <button
          onClick={() => setLocation("/archive")}
          className="py-3 px-6 bg-[#FF4040] border-[4px] border-black shadow-[4px_4px_0_#000] font-display font-black text-base text-black uppercase rounded-[12px] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-75 cursor-pointer"
        >
          Not your jam? Check out the archives
        </button>
      </div>
    </div>
  );
}
