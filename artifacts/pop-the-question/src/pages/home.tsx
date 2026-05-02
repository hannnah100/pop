import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Archive as ArchiveIcon,
  HelpCircle,
  Bot,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RainbowText, BubbleLogo } from "@/components/fx";
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
    } catch {
      /* ignore */
    }
  }, [todayDate]);

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">

      {/* ===== HERO ===== */}
      <header className="relative bg-[#FFF8E7] border-b-[4px] border-black px-4 pt-10 pb-8 text-center overflow-hidden">
        <StarDoodle className="absolute top-3 left-4 w-10 h-10 text-[#FF1493] opacity-90" />
        <StarDoodle className="absolute top-6 right-6 w-7 h-7 text-[#00E5FF] opacity-90" />
        <ConfettiDoodle className="absolute bottom-2 left-8 w-14 h-14 opacity-80" />
        <FlowerDoodle className="absolute bottom-4 right-4 w-12 h-12 text-[#FF1493] opacity-80" />

        <div className="relative z-10">
          <h1
            className="font-display font-black leading-none tracking-tight comic-headline"
            style={{ fontSize: "clamp(2.8rem, 10vw, 6rem)" }}
          >
            <RainbowText
              text="POP:"
              palette={["#FF0054", "#FF6B35", "#00E5FF", "#00F5A0", "#FF006E", "#FF1493"]}
            />
            <br />
            <BubbleLogo />
          </h1>
          <div className="mt-5 flex flex-col items-center gap-3">
            {/* Primary tagline */}
            <div className="inline-block bg-white border-[4px] border-black shadow-[5px_5px_0_#000] px-5 py-3">
              <p
                className="font-display font-black tracking-tight comic-headline flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
                style={{ fontSize: "clamp(1.1rem, 3vw, 2rem)", lineHeight: 1.1 }}
              >
                <StarDoodle aria-hidden="true" className="w-6 h-6 md:w-8 md:h-8 text-[#FFD700] shrink-0" />
                <span style={{ color: "#00C853" }}>Your</span>
                <span style={{ color: "#00E5FF" }}>group</span>
                <span style={{ color: "#00E5FF" }}>chat's</span>
                <span style={{ color: "#00C853" }}>new</span>
                <span style={{ color: "#00C853" }}>favorite</span>
                <span style={{ color: "#00C853" }}>game</span>
                <StarDoodle aria-hidden="true" className="w-6 h-6 md:w-8 md:h-8 text-[#FF1493] shrink-0" />
              </p>
            </div>

            {/* Secondary tagline */}
            <div className="inline-block bg-white border-[4px] border-black shadow-[5px_5px_0_#000] px-5 py-2">
              <p
                className="font-display font-black tracking-tight comic-headline flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
                style={{ fontSize: "clamp(0.8rem, 2.2vw, 1.35rem)", lineHeight: 1.2 }}
              >
                <span style={{ color: "#FF1493" }}>If</span>
                <span style={{ color: "#FF6B35" }}>Bar</span>
                <span style={{ color: "#FFD700" }}>Trivia</span>
                <span style={{ color: "#00E5FF" }}>was</span>
                <span style={{ color: "#00C853" }}>hosted</span>
                <span style={{ color: "#FF1493" }}>by</span>
                <span style={{ color: "#FF6B35" }}>your</span>
                <span style={{ color: "#00E5FF" }}>For</span>
                <span style={{ color: "#FFD700" }}>You</span>
                <span style={{ color: "#FF1493" }}>page</span>
              </p>
            </div>
          </div>
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
            {/* Three Strikes */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <LightningDoodle className="absolute top-2 right-3 w-6 h-8 text-[#FF6B35] opacity-40" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Three Strikes</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">3 misses and you're out</p>
                </div>
                {tsCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">Done ✓</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">Available</Badge>
                )}
              </div>
              <Link href="/daily/three-strikes">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={tsCompleted ? "outline" : "default"}
                  data-testid="link-three-strikes"
                >
                  {tsCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* Mini Crossword */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <StarDoodle className="absolute top-2 right-3 w-7 h-7 text-[#00E5FF] opacity-40" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Mini Crossword</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Pop culture quickie — fill in the grid</p>
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
                  <p className="text-sm text-black/60 font-sans mt-1">Match a celeb to each row × column</p>
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
          </div>
        </div>
      </section>

      {/* ===== PARTY GAMES SECTION ===== */}
      <section className="relative bg-[#FF1493] border-b-[4px] border-black px-4 py-8 overflow-hidden">
        <GameControllerDoodle className="absolute top-4 left-4 w-16 h-10 text-white opacity-30" />
        <StarDoodle className="absolute top-6 right-8 w-10 h-10 text-[#FFD700] opacity-50" />
        <SmileyDoodle className="absolute bottom-4 left-6 w-10 h-10 text-[#00E5FF] opacity-40" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-7 h-7 text-white" />
            <h2 className="font-display text-3xl md:text-4xl font-black text-white uppercase">Party Games</h2>
            <Badge variant="outline" className="bg-white text-[#FF1493] border-black ml-2">LIVE</Badge>
          </div>
          <p className="text-white/90 font-medium mb-6 font-sans">
            Put this screen on a TV. Everyone joins on their phones. Maximum chaos guaranteed.
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Host */}
            <div className="bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
              <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight mb-2">Host a Game</h3>
              <p className="text-sm text-black/70 font-sans mb-4">Choose Pop the Question, Roast Roulette, or Pub Quiz — then start the show.</p>
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
      <footer className="bg-[#FFF8E7] px-4 py-8 border-t-[4px] border-black">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-center items-center gap-5 md:gap-8">
          {/* Personal Stats — hot-pink pill */}
          <Link href="/stats" data-testid="link-stats">
            <span
              className="group relative flex items-center gap-2 px-5 py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
              style={{
                background: "#FF1493",
                borderRadius: "999px",
              }}
            >
              <StarDoodle className="w-4 h-4 text-white shrink-0" />
              <span
                className="font-display font-black text-sm uppercase tracking-wide"
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
            <span className="block hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] transition-transform cursor-pointer select-none">
              <span
                className="relative flex items-center gap-2 px-5 py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] active:shadow-none transition-shadow"
                style={{
                  background: "#00E5FF",
                  borderRadius: "8px",
                  transform: "skewX(-3deg)",
                  display: "flex",
                }}
              >
                <ArchiveIcon className="w-4 h-4 text-black shrink-0" style={{ transform: "skewX(3deg)" }} />
                <span
                  className="font-display font-black text-sm uppercase tracking-wide"
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
          <button
            data-testid="link-how-to-play"
            className="relative flex items-center gap-2 px-5 py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
            style={{ background: "#00C853", borderRadius: "6px" }}
          >
            <HelpCircle className="w-4 h-4 text-white shrink-0" />
            <span
              className="font-display font-black text-sm uppercase tracking-wide"
              style={{
                color: "#fff",
                WebkitTextFillColor: "#fff",
                WebkitTextStroke: "1px #000",
                paintOrder: "stroke fill",
              }}
            >
              How to Play
            </span>
            <StarDoodle className="w-3 h-3 text-[#FFD700] ml-0.5 shrink-0" />
          </button>
        </div>
      </footer>
    </div>
  );
}
