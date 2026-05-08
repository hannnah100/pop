import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Archive as ArchiveIcon,
  HelpCircle,
  Bot,
  Zap,
  Users,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import heroLogo from "@assets/logo_transparent_1778057092563.png";
import {
  StarDoodle,
  LightningDoodle,
  SmileyDoodle,
  GameControllerDoodle,
  ConfettiDoodle,
  FlowerDoodle,
} from "@/components/fx/Doodles";

export default function Home() {
  const todayDate = new Date().toISOString().split('T')[0];

  const [tsCompleted, setTsCompleted] = useState(false);
  const [cwCompleted, setCwCompleted] = useState(false);
  const [pbCompleted, setPbCompleted] = useState(false);
  const [podCompleted, setPodCompleted] = useState(false);
  const [podStreak, setPodStreak] = useState(0);
  const [gtyCompleted, setGtyCompleted] = useState(false);
  const [gtyScore, setGtyScore] = useState<number | null>(null);
  const [gtyGaveUp, setGtyGaveUp] = useState(false);

  useEffect(() => {
    try {
      const tsState = localStorage.getItem(`ptq-three-strikes-${todayDate}`);
      if (tsState) setTsCompleted(JSON.parse(tsState).completed);
      const cwState = localStorage.getItem(`ptq-crossword-${todayDate}`);
      if (cwState) setCwCompleted(JSON.parse(cwState).completed);
      const pbState = localStorage.getItem(`ptq-pop-box-${todayDate}`);
      if (pbState) setPbCompleted(JSON.parse(pbState).completed);
      const podState = localStorage.getItem(`ptq-pop-or-drop-${todayDate}`);
      if (podState) {
        const parsed = JSON.parse(podState);
        if (parsed.done) {
          setPodCompleted(true);
          setPodStreak(parsed.streak ?? 0);
        }
      }
      const gtyState = localStorage.getItem(`ptq-guess-the-year-${todayDate}`);
      if (gtyState) {
        const parsed = JSON.parse(gtyState);
        if (parsed.completed) {
          setGtyCompleted(true);
          setGtyScore(parsed.score ?? null);
          setGtyGaveUp(parsed.gaveUp ?? false);
        }
      }
    } catch {
      /* ignore */
    }
  }, [todayDate]);

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">

      {/* ===== HERO ===== */}
      <header className="relative bg-[#FFF8E7] border-b-[4px] border-black px-4 pt-6 pb-4 text-center overflow-hidden">
        <StarDoodle className="absolute top-10 left-6 w-6 h-6 text-[#FF1493] opacity-85" />
        <LightningDoodle className="absolute top-16 left-12 w-5 h-8 text-[#FFD700] opacity-75" />
        <ConfettiDoodle className="absolute top-12 left-20 w-7 h-7 opacity-60" />
        <StarDoodle className="absolute top-10 right-6 w-6 h-6 text-[#00E5FF] opacity-85" />
        <LightningDoodle className="absolute top-16 right-12 w-5 h-8 text-[#FF6B35] opacity-75" />
        <ConfettiDoodle className="absolute top-12 right-20 w-7 h-7 opacity-60" />
        <StarDoodle className="absolute bottom-8 left-6 w-5 h-5 text-[#FFD700] opacity-80" />
        <LightningDoodle className="absolute bottom-10 left-14 w-4 h-7 text-[#FF1493] opacity-70" />
        <ConfettiDoodle className="absolute bottom-8 left-24 w-6 h-6 opacity-55" />
        <StarDoodle className="absolute bottom-8 right-6 w-5 h-5 text-[#FF1493] opacity-80" />
        <LightningDoodle className="absolute bottom-10 right-14 w-4 h-7 text-[#00E5FF] opacity-70" />
        <ConfettiDoodle className="absolute bottom-8 right-24 w-6 h-6 opacity-55" />
        <div className="relative z-10">
          <img
            src={heroLogo}
            alt="Pop The Question"
            className="mx-auto w-full max-w-[88vw] md:max-w-xl h-auto select-none"
          />
        </div>
      </header>

      {/* ===== DAILY GAMES SECTION ===== */}
      <section className="relative bg-[#FFD700] border-b-[4px] border-black px-4 py-8 overflow-hidden">
        <LightningDoodle className="absolute top-4 right-6 w-8 h-12 text-[#FF6B35] opacity-70" />
        <SmileyDoodle className="absolute bottom-4 right-10 w-10 h-10 text-[#FF1493] opacity-60" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-7 h-7 text-black" />
            <h2 className="font-display text-3xl md:text-4xl font-black text-black uppercase">Daily Games</h2>
            <Badge variant="default" className="bg-black text-[#FFD700] border-black ml-2">TODAY</Badge>
          </div>
          <p className="text-black font-medium mb-6 font-sans">Fresh pop culture puzzles every day. Come back tomorrow for more!</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Three Flops */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <LightningDoodle className="absolute top-2 right-3 w-6 h-8 text-[#FF6B35] opacity-40" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Three Flops</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Name all the answers before 3 wrong guesses</p>
                </div>
                {tsCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">Done ✓</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">Available</Badge>
                )}
              </div>
              <Link href="/daily/three-flops">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={tsCompleted ? "outline" : "default"}
                  data-testid="link-three-flops"
                >
                  {tsCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* The Skinny */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <StarDoodle className="absolute top-2 right-3 w-7 h-7 text-[#00E5FF] opacity-40" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">THE SKINNY</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Pop culture crossword</p>
                </div>
                {cwCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">Done ✓</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">Available</Badge>
                )}
              </div>
              <Link href="/daily/crossword">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={cwCompleted ? "outline" : "default"}
                  data-testid="link-crossword"
                >
                  {cwCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* Pop Box */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <StarDoodle className="absolute top-2 right-3 w-7 h-7 text-[#FF1493] opacity-50" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Pop Box</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Find an answer for each intersection of the grid</p>
                </div>
                {pbCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">Done ✓</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">New</Badge>
                )}
              </div>
              <Link href="/daily/pop-box">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={pbCompleted ? "outline" : "default"}
                  data-testid="link-pop-box"
                >
                  {pbCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* Pop or Drop */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <LightningDoodle className="absolute top-2 right-3 w-5 h-7 text-[#FF6B35] opacity-50" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Pop or Drop</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Higher or Lower — pop culture edition</p>
                </div>
                {podCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {podStreak > 0 ? `🔥 ${podStreak}` : "Done ✓"}
                  </Badge>
                ) : (
                  <Badge className="ml-2 flex-shrink-0 bg-[#FF1493] text-white border-[#FF1493]">HOT 🔥</Badge>
                )}
              </div>
              <Link href="/daily/pop-or-drop">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={podCompleted ? "outline" : "default"}
                  data-testid="link-pop-or-drop"
                >
                  {podCompleted ? "View Results" : "Play Today's Challenge"}
                </Button>
              </Link>
            </div>

            {/* Clock It */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <StarDoodle className="absolute top-2 right-3 w-7 h-7 text-[#FFD700] opacity-50" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Clock It
                  </h3>
                  <p className="text-sm text-black/60 font-sans mt-1">3 pop culture hints — which year is it?</p>
                </div>
                {gtyCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {gtyGaveUp ? "💀 Gave Up" : gtyScore === 3 ? "🏆 Perfect" : gtyScore === 2 ? "⭐ Nice" : "Done ✓"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">Available</Badge>
                )}
              </div>
              <Link href="/daily/clock-it">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={gtyCompleted ? "outline" : "default"}
                  data-testid="link-clock-it"
                >
                  {gtyCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PARTY GAMES SECTION ===== */}
      <section className="relative bg-[#FF1493] border-b-[4px] border-black px-4 py-8 overflow-hidden">
        <GameControllerDoodle className="absolute top-4 left-4 w-16 h-10 text-white opacity-30" />
        <StarDoodle className="absolute top-6 right-8 w-10 h-10 text-[#FFD700] opacity-50" />
        <SmileyDoodle className="absolute bottom-4 left-6 w-10 h-10 text-[#00E5FF] opacity-40" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Users className="w-7 h-7 text-white shrink-0" />
            <h2 className="font-display text-3xl md:text-4xl font-black text-white uppercase">Party Games</h2>
            <Badge variant="outline" className="bg-white text-[#FF1493] border-black">LIVE</Badge>
            {/* Secondary tagline inline */}
            <div className="bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-3 py-1">
              <p
                className="font-display font-black tracking-tight flex flex-wrap items-center gap-x-1.5"
                style={{ fontSize: "clamp(0.7rem, 1.5vw, 1rem)", lineHeight: 1.2, color: "#000" }}
              >
                If Bar Trivia was hosted by your{" "}
                <span style={{
                  color: "#FF1493",
                  WebkitTextStroke: "1.5px #000",
                  paintOrder: "stroke fill",
                }}>For You</span>{" "}
                page
              </p>
            </div>
          </div>
          <p className="text-white/90 font-medium mb-6 font-sans">
            Project this screen on a TV or screen share remotely. Everyone joins on their phone. One host. Up to 10 players.
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Host */}
            <div className="bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight mb-2">Host a Game</h3>
              <p className="text-sm text-black/70 font-sans mb-4">Choose Pop the Question, Roast Roulette, or Bar Trivia — then start the show.</p>
              <Link href="/host">
                <Button
                  size="lg"
                  className="w-full font-display text-base uppercase tracking-wide bg-black text-[#FFD700] hover:bg-[#FF1493] hover:text-black border-[3px] border-black shadow-[3px_3px_0_#fff]"
                  data-testid="link-host-game"
                >
                  Host a Game
                </Button>
              </Link>
              <Link href="/host?demo=true">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-black/70 hover:text-black hover:bg-black/10 gap-1"
                  data-testid="link-demo-mode"
                >
                  <Bot className="w-4 h-4" /> Try Demo Mode →
                </Button>
              </Link>
            </div>

            {/* Join */}
            <div className="bg-[#00E5FF] border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight mb-2">Join a Game</h3>
              <p className="text-sm text-black/70 font-sans mb-4">Got a room code from the host screen? Jump in and play on your phone.</p>
              <Link href="/join">
                <Button
                  size="lg"
                  className="w-full font-display text-base uppercase tracking-wide bg-black text-[#00E5FF] hover:bg-[#FF1493] hover:text-black border-[3px] border-black shadow-[3px_3px_0_rgba(0,0,0,0.3)]"
                  data-testid="link-join-game"
                >
                  Join a Game
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#FFF8E7] px-4 py-16 border-t-[4px] border-black">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-center items-center gap-8 md:gap-12">
          {/* Personal Stats — hot-pink pill */}
          <Link href="/stats" data-testid="link-stats">
            <span
              className="group relative flex items-center gap-3 px-8 py-4 border-[3px] border-black shadow-[6px_6px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all cursor-pointer select-none"
              style={{
                background: "#FF1493",
                borderRadius: "999px",
              }}
            >
              <StarDoodle className="w-6 h-6 text-white shrink-0" />
              <span
                className="font-display font-black text-lg uppercase tracking-wide"
                style={{
                  color: "#fff",
                  WebkitTextFillColor: "#fff",
                  WebkitTextStroke: "1px #000",
                  paintOrder: "stroke fill",
                }}
              >
                Personal Stats
              </span>
            </span>
          </Link>

          {/* Past Puzzles — electric cyan rounded rectangle, slightly skewed */}
          <Link href="/archive" data-testid="link-archive">
            {/* Outer wrapper handles translate press animation; inner wrapper handles the skew */}
            <span className="block hover:translate-x-[3px] hover:translate-y-[3px] active:translate-x-[6px] active:translate-y-[6px] transition-transform cursor-pointer select-none">
              <span
                className="relative flex items-center gap-3 px-8 py-4 border-[3px] border-black shadow-[6px_6px_0_#000] hover:shadow-[3px_3px_0_#000] active:shadow-none transition-shadow"
                style={{
                  background: "#00E5FF",
                  borderRadius: "10px",
                  transform: "skewX(-3deg)",
                  display: "flex",
                }}
              >
                <ArchiveIcon className="w-6 h-6 text-black shrink-0" style={{ transform: "skewX(3deg)" }} />
                <span
                  className="font-display font-black text-lg uppercase tracking-wide"
                  style={{
                    color: "#fff",
                    WebkitTextFillColor: "#fff",
                    WebkitTextStroke: "1px #000",
                    paintOrder: "stroke fill",
                    transform: "skewX(3deg)",
                    display: "inline-block",
                  }}
                >
                  Past Puzzles
                </span>
              </span>
            </span>
          </Link>

          {/* How to Play — lime green square badge */}
          <Link href="/how-to-play" data-testid="link-how-to-play">
            <span
              className="relative flex items-center gap-3 px-8 py-4 border-[3px] border-black shadow-[6px_6px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all cursor-pointer select-none"
              style={{ background: "#00C853", borderRadius: "8px" }}
            >
              <HelpCircle className="w-6 h-6 text-white shrink-0" />
              <span
                className="font-display font-black text-lg uppercase tracking-wide"
                style={{
                  color: "#fff",
                  WebkitTextFillColor: "#fff",
                  WebkitTextStroke: "1px #000",
                  paintOrder: "stroke fill",
                }}
              >
                How to Play
              </span>
              <StarDoodle className="w-4 h-4 text-[#FFD700] ml-0.5 shrink-0" />
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
