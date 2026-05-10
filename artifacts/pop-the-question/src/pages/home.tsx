import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
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
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { firebaseUser, authEnabled, openAuthModal } = useAuth();
  const todayDate = new Date().toISOString().split('T')[0];

  const [tsCompleted, setTsCompleted] = useState(false);
  const [cwCompleted, setCwCompleted] = useState(false);
  const [pbCompleted, setPbCompleted] = useState(false);
  const [podCompleted, setPodCompleted] = useState(false);
  const [podStreak, setPodStreak] = useState(0);
  const [gtyCompleted, setGtyCompleted] = useState(false);
  const [gtyScore, setGtyScore] = useState<number | null>(null);
  const [gtyGaveUp, setGtyGaveUp] = useState(false);
  const [rcCompleted, setRcCompleted] = useState(false);
  const [rcScore, setRcScore] = useState<number | null>(null);

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
      const rcState = localStorage.getItem(`ptq-reel-connections-${todayDate}`);
      if (rcState) {
        const parsed = JSON.parse(rcState);
        if (parsed.completed) {
          setRcCompleted(true);
          setRcScore(parsed.score ?? null);
        }
      }
    } catch {
      /* ignore */
    }
  }, [todayDate]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">

      {/* ===== TOP NAV ===== */}
      <nav className="bg-[#FFF8E7] px-3 py-3 md:py-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {/* PROFILE */}
          {authEnabled && (
            firebaseUser ? (
              <Link href="/account" data-testid="nav-profile">
                <span
                  className="block px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
                  style={{ background: "#FF1493", borderRadius: "10px" }}
                >
                  <span
                    className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
                    style={{
                      color: "#fff",
                      WebkitTextFillColor: "#fff",
                      WebkitTextStroke: "1px #000",
                      paintOrder: "stroke fill",
                    }}
                  >
                    Profile
                  </span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                data-testid="nav-profile"
                className="px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
                style={{ background: "#FF1493", borderRadius: "10px" }}
              >
                <span
                  className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
                  style={{
                    color: "#fff",
                    WebkitTextFillColor: "#fff",
                    WebkitTextStroke: "1px #000",
                    paintOrder: "stroke fill",
                  }}
                >
                  Profile
                </span>
              </button>
            )
          )}

          {/* DAILY TRIVIA */}
          <button
            type="button"
            onClick={() => scrollToSection("daily-games")}
            data-testid="nav-daily-trivia"
            className="px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
            style={{ background: "#FFD700", borderRadius: "10px" }}
          >
            <span
              className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
              style={{
                color: "#fff",
                WebkitTextFillColor: "#fff",
                WebkitTextStroke: "1px #000",
                paintOrder: "stroke fill",
              }}
            >
              Daily Trivia
            </span>
          </button>

          {/* PARTY GAMES */}
          <button
            type="button"
            onClick={() => scrollToSection("party-games")}
            data-testid="nav-party-games"
            className="px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
            style={{ background: "#00E5FF", borderRadius: "10px" }}
          >
            <span
              className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
              style={{
                color: "#fff",
                WebkitTextFillColor: "#fff",
                WebkitTextStroke: "1px #000",
                paintOrder: "stroke fill",
              }}
            >
              Party Games
            </span>
          </button>

          {/* HOW TO PLAY */}
          <Link href="/how-to-play" data-testid="nav-how-to-play">
            <span
              className="block px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
              style={{ background: "#00C853", borderRadius: "10px" }}
            >
              <span
                className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
                style={{
                  color: "#fff",
                  WebkitTextFillColor: "#fff",
                  WebkitTextStroke: "1px #000",
                  paintOrder: "stroke fill",
                }}
              >
                How to Play
              </span>
            </span>
          </Link>

          {/* ARCHIVE */}
          <Link href="/archive" data-testid="nav-archive">
            <span
              className="block px-3 py-2 md:px-4 md:py-2.5 border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer select-none"
              style={{ background: "#FF1493", borderRadius: "10px" }}
            >
              <span
                className="font-display font-black text-xs md:text-sm uppercase tracking-wide whitespace-nowrap"
                style={{
                  color: "#fff",
                  WebkitTextFillColor: "#fff",
                  WebkitTextStroke: "1px #000",
                  paintOrder: "stroke fill",
                }}
              >
                Archive
              </span>
            </span>
          </Link>
        </div>
      </nav>

      {/* Rainbow strip — Y2K palette (pink → orange → yellow → cyan → green) */}
      <div
        aria-hidden
        className="h-[5px]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #FF1493 0%, #FF1493 20%, #FF6B35 20%, #FF6B35 40%, #FFD700 40%, #FFD700 60%, #00E5FF 60%, #00E5FF 80%, #00C853 80%, #00C853 100%)",
        }}
      />

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
      <section id="daily-games" className="relative bg-[#FFD700] border-b-[4px] border-black px-4 py-8 overflow-hidden scroll-mt-4">
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
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
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
              <Link href="/daily/three-flops" className="block mt-auto">
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
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
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
              <Link href="/daily/crossword" className="block mt-auto">
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
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
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
              <Link href="/daily/pop-box" className="block mt-auto">
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
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
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
              <Link href="/daily/pop-or-drop" className="block mt-auto">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={podCompleted ? "outline" : "default"}
                  data-testid="link-pop-or-drop"
                >
                  {podCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* Clock It */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
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
              <Link href="/daily/clock-it" className="block mt-auto">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={gtyCompleted ? "outline" : "default"}
                  data-testid="link-clock-it"
                >
                  {gtyCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>

            {/* Reel Connections */}
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden flex flex-col">
              <StarDoodle className="absolute top-2 right-3 w-7 h-7 text-[#FF1493] opacity-50" />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display text-2xl font-black text-black uppercase tracking-tight">Reel Connections</h3>
                  <p className="text-sm text-black/60 font-sans mt-1">Connect the actors through their movies</p>
                </div>
                {rcCompleted ? (
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {rcScore !== null ? `${rcScore}/5` : "Done ✓"}
                  </Badge>
                ) : (
                  <Badge className="ml-2 flex-shrink-0 bg-[#FF1493] text-white border-[#FF1493]">NEW</Badge>
                )}
              </div>
              <Link href="/daily/reel-connections" className="block mt-auto">
                <Button
                  className="w-full font-display text-base uppercase tracking-wide"
                  variant={rcCompleted ? "outline" : "default"}
                  data-testid="link-reel-connections"
                >
                  {rcCompleted ? "View Results" : "Play Now"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PARTY GAMES SECTION ===== */}
      <section id="party-games" className="relative bg-[#FF1493] border-b-[4px] border-black px-4 py-8 overflow-hidden scroll-mt-4">
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
              <p className="text-sm text-black/70 font-sans mb-4">Choose Poll the Question, Roast Roulette, or Bar Trivia — then start the show.</p>
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

    </div>
  );
}
