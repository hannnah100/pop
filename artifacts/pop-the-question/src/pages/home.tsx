import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Bot,
  Zap,
  Calendar,
} from "lucide-react";
import heroLogo from "@assets/logo_transparent_1778057092563.png";
import {
  StarDoodle,
  LightningDoodle,
  ConfettiDoodle,
} from "@/components/fx/Doodles";
import { NeoDoodles } from "@/components/fx/NeoDoodles";
import { useAuth } from "@/contexts/AuthContext";

type DailyBadge = string | { label: string; variant: "accent" };

function DailyCard({
  title,
  blurb,
  href,
  testId,
  completed,
  completedLabel = "Done ✓",
  defaultBadge,
  icon,
}: {
  title: string;
  blurb: string;
  href: string;
  testId: string;
  completed: boolean;
  completedLabel?: string;
  defaultBadge: DailyBadge;
  icon?: React.ReactNode;
}) {
  const badgeStyle = { border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" };
  const badge = completed
    ? <span className="ml-2 flex-shrink-0 px-2 py-1 font-mono font-black text-xs uppercase bg-white text-black" style={badgeStyle}>{completedLabel}</span>
    : typeof defaultBadge === "string"
      ? <span className="ml-2 flex-shrink-0 px-2 py-1 font-mono font-black text-xs uppercase bg-white text-black" style={badgeStyle}>{defaultBadge}</span>
      : <span className="ml-2 flex-shrink-0 px-2 py-1 font-mono font-black text-xs uppercase bg-[#FF1493] text-white" style={badgeStyle}>{defaultBadge.label}</span>;

  return (
    <div
      className="bg-white p-5 flex flex-col"
      style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="font-mono text-2xl font-black text-black uppercase flex items-center gap-2"
            style={{ letterSpacing: "0.03em" }}
          >
            {icon}
            {title}
          </h3>
          <p
            className="font-mono font-bold text-sm text-black/70 mt-1"
            style={{ letterSpacing: "0.03em" }}
          >
            {blurb}
          </p>
        </div>
        {badge}
      </div>
      <Link href={href} className="block mt-auto">
        <button
          className="w-full bg-[#FF1493] hover:bg-[#38BDF8] text-white hover:text-black font-mono font-black text-base uppercase px-5 py-3 transition-colors duration-150"
          style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000", letterSpacing: "0.03em" }}
          data-testid={testId}
        >
          {completed ? "View Results →" : "Play Now →"}
        </button>
      </Link>
    </div>
  );
}

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
      <section
        id="daily-games"
        className="relative px-4 py-10 scroll-mt-4"
        style={{ background: "#FFD700", borderBottom: "5px solid #000" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="inline-flex items-center justify-center w-10 h-10 bg-white"
              style={{ border: "5px solid #000", boxShadow: "4px 4px 0 #000" }}
              aria-hidden
            >
              <Zap className="w-5 h-5 text-[#FFD700] fill-[#FFD700]" />
            </span>
            <h2
              className="font-mono text-3xl md:text-5xl font-black text-black uppercase"
              style={{ letterSpacing: "0.03em" }}
            >
              Daily Games
            </h2>
            <span
              className="px-3 py-1 font-mono font-black text-xs uppercase bg-white text-black"
              style={{ border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" }}
            >
              Today
            </span>
          </div>
          <p
            className="font-mono font-bold text-black mb-8 max-w-2xl"
            style={{ letterSpacing: "0.03em" }}
          >
            Fresh pop culture puzzles every day. Come back tomorrow for more!
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Three Flops */}
            <DailyCard
              title="Three Flops"
              blurb="Name all the answers before 3 wrong guesses"
              href="/daily/three-flops"
              testId="link-three-flops"
              completed={tsCompleted}
              defaultBadge="Available"
            />

            {/* The Skinny */}
            <DailyCard
              title="The Skinny"
              blurb="Pop culture crossword"
              href="/daily/crossword"
              testId="link-crossword"
              completed={cwCompleted}
              defaultBadge="Available"
            />

            {/* Pop Box */}
            <DailyCard
              title="Pop Box"
              blurb="Find an answer for each intersection of the grid"
              href="/daily/pop-box"
              testId="link-pop-box"
              completed={pbCompleted}
              defaultBadge={{ label: "New", variant: "accent" }}
            />

            {/* Pop or Drop */}
            <DailyCard
              title="Pop or Drop"
              blurb="Higher or Lower — pop culture edition"
              href="/daily/pop-or-drop"
              testId="link-pop-or-drop"
              completed={podCompleted}
              completedLabel={podStreak > 0 ? `🔥 ${podStreak}` : "Done ✓"}
              defaultBadge={{ label: "Hot 🔥", variant: "accent" }}
            />

            {/* Clock It */}
            <DailyCard
              title="Clock It"
              icon={<Calendar className="w-5 h-5" />}
              blurb="3 pop culture hints — which year is it?"
              href="/daily/clock-it"
              testId="link-clock-it"
              completed={gtyCompleted}
              completedLabel={gtyGaveUp ? "💀 Gave Up" : gtyScore === 3 ? "🏆 Perfect" : gtyScore === 2 ? "⭐ Nice" : "Done ✓"}
              defaultBadge="Available"
            />

            {/* Reel Connections */}
            <DailyCard
              title="Reel Connections"
              blurb="Connect the actors through their movies"
              href="/daily/reel-connections"
              testId="link-reel-connections"
              completed={rcCompleted}
              completedLabel={rcScore !== null ? `${rcScore}/5` : "Done ✓"}
              defaultBadge={{ label: "New", variant: "accent" }}
            />
          </div>
        </div>
      </section>

      {/* ===== PARTY GAMES SECTION ===== */}
      <section
        id="party-games"
        className="relative px-4 py-10 scroll-mt-4 overflow-hidden"
        style={{ background: "#F5F0E6", borderTop: "5px solid #000", borderBottom: "5px solid #000" }}
      >
        <NeoDoodles />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span
              className="px-3 py-1 font-mono font-black text-xs text-black uppercase"
              style={{ background: "#38BDF8", border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" }}
            >
              LIVE
            </span>
            <h2
              className="font-mono text-3xl md:text-5xl font-black text-black uppercase"
              style={{ letterSpacing: "0.03em" }}
            >
              Party Games
            </h2>
            <span
              className="px-3 py-1 font-mono font-black text-xs text-black uppercase"
              style={{ background: "#38BDF8", border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" }}
            >
              LIVE
            </span>
          </div>
          <p
            className="font-mono font-bold text-black/80 mb-8 max-w-2xl"
            style={{ letterSpacing: "0.03em" }}
          >
            Project this screen on a TV or screen share remotely. Everyone joins on their phone.
            One host. Up to 10 players.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Host */}
            <div
              className="p-6 relative"
              style={{ background: "#FFD60A", border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
            >
              <h3
                className="font-mono text-3xl font-black text-black uppercase mb-2"
                style={{ letterSpacing: "0.03em" }}
              >
                Host a Game
              </h3>
              <p
                className="font-mono font-bold text-sm text-black mb-5"
                style={{ letterSpacing: "0.03em" }}
              >
                Choose Poll the Question, Roast Roulette, or Bar Trivia — then start the show.
              </p>
              <Link href="/host">
                <button
                  className="w-full bg-white hover:bg-[#38BDF8] text-black font-mono font-black text-lg uppercase px-5 py-4 transition-colors duration-150"
                  style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000", letterSpacing: "0.03em" }}
                  data-testid="link-host-game"
                >
                  Host a Game →
                </button>
              </Link>
              <Link href="/host?demo=true">
                <button
                  className="w-full mt-3 bg-black hover:bg-[#38BDF8] text-white hover:text-black font-mono font-black text-sm uppercase px-4 py-2 flex items-center justify-center gap-1 transition-colors duration-150"
                  style={{ border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" }}
                  data-testid="link-demo-mode"
                >
                  <Bot className="w-4 h-4" /> Try Demo Mode →
                </button>
              </Link>
            </div>

            {/* Join */}
            <div
              className="p-6 relative"
              style={{ background: "#FF006E", border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
            >
              <h3
                className="font-mono text-3xl font-black text-black uppercase mb-2"
                style={{ letterSpacing: "0.03em" }}
              >
                Join a Game
              </h3>
              <p
                className="font-mono font-bold text-sm text-black mb-5"
                style={{ letterSpacing: "0.03em" }}
              >
                Got a room code from the host screen? Jump in and play on your phone.
              </p>
              <Link href="/join">
                <button
                  className="w-full bg-white hover:bg-[#38BDF8] text-black font-mono font-black text-lg uppercase px-5 py-4 transition-colors duration-150"
                  style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000", letterSpacing: "0.03em" }}
                  data-testid="link-join-game"
                >
                  Join a Game →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
