import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  BarChart2,
  Archive as ArchiveIcon,
  HelpCircle,
  Bot,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RainbowText } from "@/components/fx";
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

  useEffect(() => {
    try {
      const tsState = localStorage.getItem(`ptq-three-strikes-${todayDate}`);
      if (tsState) setTsCompleted(JSON.parse(tsState).completed);
      const cwState = localStorage.getItem(`ptq-crossword-${todayDate}`);
      if (cwState) setCwCompleted(JSON.parse(cwState).completed);
    } catch {
      /* ignore */
    }
  }, [todayDate]);

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">

      {/* ===== HERO ===== */}
      <header className="relative bg-[#FFD700] border-b-[4px] border-black px-4 pt-10 pb-8 text-center overflow-hidden">
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
            <span>THE QUESTION</span>
          </h1>
          <p className="mt-3 text-lg md:text-xl font-bold text-black/70 font-sans">
            Who knows the most about your group chat?
          </p>
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

          <div className="grid md:grid-cols-2 gap-5">
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
      <footer className="bg-[#FFF8E7] px-4 py-6 border-t-[4px] border-black">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 text-sm font-bold">
          <Link href="/stats" className="flex items-center gap-2 text-black hover:text-[#FF1493] transition-none" data-testid="link-stats">
            <BarChart2 className="w-4 h-4" />
            Personal Stats
          </Link>
          <Link href="/archive" className="flex items-center gap-2 text-black hover:text-[#FF6B35] transition-none" data-testid="link-archive">
            <ArchiveIcon className="w-4 h-4" />
            Past Puzzles
          </Link>
          <button className="flex items-center gap-2 text-black hover:text-[#00C853] transition-none" data-testid="link-how-to-play">
            <HelpCircle className="w-4 h-4" />
            How to Play
          </button>
        </div>
      </footer>
    </div>
  );
}
