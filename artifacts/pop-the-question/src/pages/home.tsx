import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Bot,
  Zap,
  Calendar,
  BookOpen,
  Users,
  Archive as ArchiveIcon,
  User as UserIcon,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import heroLogo from "@assets/logo_transparent_1778057092563.png";
import navLogo from "@assets/67042e28-f0c8-47a2-b851-a1cbd0dbaa92-2_1778529103351.png";
import { NeoDoodles } from "@/components/fx/NeoDoodles";
import { useAuth } from "@/contexts/AuthContext";

const isExpoWebView =
  typeof navigator !== "undefined" && /Expo/i.test(navigator.userAgent);
const isMobileQueryOverride =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mobile") === "true";
const isNative =
  Capacitor.isNativePlatform() || isExpoWebView || isMobileQueryOverride;

if (typeof window !== "undefined") {
  console.log("[home.tsx] navigator.userAgent:", navigator.userAgent);
  console.log("[home.tsx] Capacitor.isNativePlatform():", Capacitor.isNativePlatform());
  console.log("[home.tsx] isExpoWebView:", isExpoWebView);
  console.log("[home.tsx] isMobileQueryOverride:", isMobileQueryOverride);
  console.log("[home.tsx] isNative:", isNative);
}

type MobileTile = {
  title: string;
  href: string;
  color: string;
  theme: "light" | "dark";
  testId: string;
  completed: boolean;
  completedLabel?: string;
  imageSrc?: string;
};

function MobileTile({
  title,
  href,
  color,
  theme,
  testId,
  completed,
  completedLabel,
  imageSrc,
}: MobileTile) {
  const badgeBg = theme === "light" ? "bg-black text-white" : "bg-white text-black";
  return (
    <Link href={href} data-testid={testId}>
      <div
        className="relative aspect-square overflow-hidden cursor-pointer active:translate-y-[2px] transition-transform"
        style={{
          border: "4px solid #000",
          boxShadow: "5px 5px 0 #000",
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span
            className={`absolute inset-0 flex items-center justify-center p-3 font-mono font-black uppercase text-center leading-tight ${theme === "light" ? "text-black" : "text-white"}`}
            style={{ background: color, fontSize: "clamp(13px, 4vw, 18px)", letterSpacing: "0.02em" }}
          >
            {title}
          </span>
        )}
        {completed && (
          <span
            className={`absolute top-1 right-1 px-1.5 py-0.5 font-mono font-black text-[10px] uppercase ${badgeBg}`}
            style={{ border: "2px solid #000", letterSpacing: "0.03em" }}
          >
            {completedLabel ?? "Done ✓"}
          </span>
        )}
      </div>
    </Link>
  );
}

function MobileBottomNav() {
  const { firebaseUser, authEnabled, openAuthModal } = useAuth();
  const items: Array<{
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    testId: string;
  }> = [
    { label: "How to Play", icon: <BookOpen className="w-5 h-5" />, href: "/how-to-play", testId: "mobile-nav-how-to-play" },
    { label: "Join Game", icon: <Users className="w-5 h-5" />, href: "/join", testId: "mobile-nav-join" },
    { label: "Archive", icon: <ArchiveIcon className="w-5 h-5" />, href: "/archive", testId: "mobile-nav-archive" },
    {
      label: "Profile",
      icon: <UserIcon className="w-5 h-5" />,
      href: authEnabled && firebaseUser ? "/account" : undefined,
      onClick: authEnabled && !firebaseUser ? openAuthModal : undefined,
      testId: "mobile-nav-profile",
    },
  ];

  return (
    <nav
      className="sticky bottom-0 z-30 w-full bg-white pb-safe"
      style={{ borderTop: "4px solid #000" }}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const content = (
            <div className="flex flex-col items-center justify-center gap-1 py-2 active:bg-[#FFD60A] transition-colors">
              <span className="text-black">{item.icon}</span>
              <span
                className="font-mono font-black text-[10px] uppercase text-black text-center leading-tight"
                style={{ letterSpacing: "0.02em" }}
              >
                {item.label}
              </span>
            </div>
          );
          if (item.href) {
            return (
              <Link key={item.label} href={item.href} data-testid={item.testId}>
                {content}
              </Link>
            );
          }
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              data-testid={item.testId}
              className="w-full"
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

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
  color,
  theme,
}: {
  title: string;
  blurb: string;
  href: string;
  testId: string;
  completed: boolean;
  completedLabel?: string;
  defaultBadge: DailyBadge;
  icon?: React.ReactNode;
  color: string;
  theme: "light" | "dark";
}) {
  // theme="light" → light-colored card, BLACK text; badges flip to bg-black/text-white
  // theme="dark"  → bold-colored card, WHITE text; badges flip to bg-white/text-black
  const textColor = theme === "light" ? "text-black" : "text-white";
  const badgeBg = theme === "light" ? "bg-black text-white" : "bg-white text-black";
  const badgeStyle = { border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" };

  const badgeLabel = completed
    ? completedLabel
    : typeof defaultBadge === "string"
      ? defaultBadge
      : defaultBadge.label;
  const badge = (
    <span
      className={`ml-2 flex-shrink-0 px-2 py-1 font-mono font-black text-xs uppercase ${badgeBg}`}
      style={badgeStyle}
    >
      {badgeLabel}
    </span>
  );

  return (
    <div
      className="p-5 flex flex-col h-full min-h-[240px]"
      style={{ background: color, border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
    >
      <div className="flex justify-between items-start gap-2 mb-4">
        <h3
          className={`font-mono text-2xl font-black uppercase leading-tight flex items-center gap-2 flex-1 min-w-0 ${textColor}`}
          style={{ letterSpacing: "0.03em" }}
        >
          {icon}
          {title}
        </h3>
        {badge}
      </div>

      <p
        className={`font-mono font-bold text-sm mb-6 flex-1 ${textColor}`}
        style={{ letterSpacing: "0.03em" }}
      >
        {blurb}
      </p>

      <Link href={href} className="block mt-auto">
        <button
          className="w-full bg-white text-black hover:bg-[#FFD60A] font-mono font-black text-base uppercase px-5 py-3 transition-colors duration-150"
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

  if (isNative) {
    return (
      <div
        className="flex-1 flex flex-col w-full overflow-x-hidden"
        style={{
          background: "#FFF5E7",
          marginTop: "calc(-1 * env(safe-area-inset-top))",
        }}
      >
        <main
          className="flex-1"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
          }}
        >
          {/* Daily Games speech-bubble banner (ported from desktop) */}
          <div className="px-4 pb-10">
            <div className="relative w-fit max-w-full mx-auto">
              <div
                className="bg-white px-5 py-4"
                style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 bg-white"
                    style={{ border: "4px solid #000", boxShadow: "3px 3px 0 #000" }}
                    aria-hidden
                  >
                    <Zap className="w-5 h-5 text-[#FFD700] fill-[#FFD700]" />
                  </span>
                  <h2
                    className="font-mono text-2xl font-black text-black uppercase"
                    style={{ letterSpacing: "0.03em" }}
                  >
                    Daily Games
                  </h2>
                  <span
                    className="px-2 py-0.5 font-mono font-black text-[10px] uppercase bg-white text-black"
                    style={{ border: "3px solid #000", boxShadow: "3px 3px 0 #000", letterSpacing: "0.03em" }}
                  >
                    Today
                  </span>
                </div>
                <p
                  className="font-mono font-bold text-black text-sm"
                  style={{ letterSpacing: "0.03em" }}
                >
                  Fresh pop culture puzzles every day. Come back tomorrow for more!
                </p>
              </div>
              {/* Speech bubble tail */}
              <div
                aria-hidden
                className="absolute left-10"
                style={{
                  bottom: "-22px",
                  width: 0,
                  height: 0,
                  borderLeft: "22px solid transparent",
                  borderRight: "22px solid transparent",
                  borderTop: "22px solid #000",
                }}
              />
              <div
                aria-hidden
                className="absolute left-[46px]"
                style={{
                  bottom: "-12px",
                  width: 0,
                  height: 0,
                  borderLeft: "14px solid transparent",
                  borderRight: "14px solid transparent",
                  borderTop: "14px solid #fff",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 px-14 pb-8">
            <MobileTile
              title="Three Flops"
              href="/daily/three-flops"
              testId="mobile-tile-three-flops"
              color="#FFD60A"
              theme="light"
              completed={tsCompleted}
              imageSrc="/assets/icon_3_flops.png"
            />
            <MobileTile
              title="Pop Box"
              href="/daily/pop-box"
              testId="mobile-tile-pop-box"
              color="#38BDF8"
              theme="light"
              completed={pbCompleted}
              imageSrc="/assets/icon_popbox.png"
            />
            <MobileTile
              title="Pop or Drop"
              href="/daily/pop-or-drop"
              testId="mobile-tile-pop-or-drop"
              color="#50C878"
              theme="light"
              completed={podCompleted}
              completedLabel={podStreak > 0 ? `🔥 ${podStreak}` : "Done ✓"}
              imageSrc="/assets/icon_popordrop.png"
            />
            <MobileTile
              title="The Skinny"
              href="/daily/crossword"
              testId="mobile-tile-crossword"
              color="#FF006E"
              theme="dark"
              completed={cwCompleted}
              imageSrc="/assets/icontheskinny.png"
            />
            <MobileTile
              title="Clock It"
              href="/daily/clock-it"
              testId="mobile-tile-clock-it"
              color="#9370DB"
              theme="dark"
              completed={gtyCompleted}
              completedLabel={
                gtyGaveUp
                  ? "💀 Gave Up"
                  : gtyScore === 3
                    ? "🏆 Perfect"
                    : gtyScore === 2
                      ? "⭐ Nice"
                      : "Done ✓"
              }
              imageSrc="/assets/icon_clockit.png"
            />
            <MobileTile
              title="Reel Connections"
              href="/daily/reel-connections"
              testId="mobile-tile-reel-connections"
              color="#FF6B35"
              theme="dark"
              completed={rcCompleted}
              completedLabel={rcScore !== null ? `${rcScore}/5` : "Done ✓"}
              imageSrc="/assets/icon_reel.png"
            />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden" style={{ background: "#FFF5E7" }}>

      {/* ===== STICKY NAV ===== */}
      <nav
        className="sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between"
        style={{
          background: "#FFD60A",
          borderBottom: "5px solid #000",
          height: "107px",
        }}
      >
        {/* Logo — top-left, keeps Y2K comic style */}
        <Link href="/" data-testid="nav-logo">
          <img
            src={navLogo}
            alt="Pop The Question"
            className="h-[106px] md:h-[121px] w-auto select-none cursor-pointer"
          />
        </Link>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/how-to-play" data-testid="nav-how-to-play">
            <span
              className="block bg-white px-3 py-2 md:px-4 md:py-2.5 font-mono font-black text-xs md:text-sm text-black uppercase whitespace-nowrap cursor-pointer hover:bg-[#38BDF8] transition-colors duration-150"
              style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000", letterSpacing: "0.03em" }}
            >
              How to Play
            </span>
          </Link>

          <Link href="/archive" data-testid="nav-archive">
            <span
              className="block bg-white px-3 py-2 md:px-4 md:py-2.5 font-mono font-black text-xs md:text-sm text-black uppercase whitespace-nowrap cursor-pointer hover:bg-[#38BDF8] transition-colors duration-150"
              style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000", letterSpacing: "0.03em" }}
            >
              Archive
            </span>
          </Link>

          {authEnabled && (
            firebaseUser ? (
              <Link href="/account" data-testid="nav-profile">
                <span
                  className="block bg-black text-white px-3 py-2 md:px-4 md:py-2.5 font-mono font-black text-xs md:text-sm uppercase whitespace-nowrap cursor-pointer hover:bg-[#38BDF8] hover:text-black transition-colors duration-150"
                  style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000", letterSpacing: "0.03em" }}
                >
                  Profile
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                data-testid="nav-profile"
                className="bg-black text-white px-3 py-2 md:px-4 md:py-2.5 font-mono font-black text-xs md:text-sm uppercase whitespace-nowrap hover:bg-[#38BDF8] hover:text-black transition-colors duration-150"
                style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000", letterSpacing: "0.03em" }}
              >
                Profile
              </button>
            )
          )}
        </div>
      </nav>

      {/* ===== DAILY GAMES SECTION ===== */}
      <section
        id="daily-games"
        className="relative px-4 py-16 md:py-20 scroll-mt-20 overflow-hidden"
        style={{ background: "#FFF5E7", borderBottom: "5px solid #000" }}
      >
        <NeoDoodles />
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Speech bubble — heading + description */}
          <div className="relative w-fit max-w-full mx-auto mb-16">
            <div
              className="bg-white px-6 py-5 md:px-8 md:py-6"
              style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 bg-white"
                  style={{ border: "4px solid #000", boxShadow: "3px 3px 0 #000" }}
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
                className="font-mono font-bold text-black"
                style={{ letterSpacing: "0.03em" }}
              >
                Fresh pop culture puzzles every day. Come back tomorrow for more!
              </p>
            </div>

            {/* Speech bubble tail — black outline + white fill */}
            <div
              aria-hidden
              className="absolute left-12 md:left-16"
              style={{
                bottom: "-22px",
                width: 0,
                height: 0,
                borderLeft: "22px solid transparent",
                borderRight: "22px solid transparent",
                borderTop: "22px solid #000",
              }}
            />
            <div
              aria-hidden
              className="absolute left-[58px] md:left-[74px]"
              style={{
                bottom: "-12px",
                width: 0,
                height: 0,
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderTop: "14px solid #fff",
              }}
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {/* ===== TOP ROW — light backgrounds, BLACK text ===== */}

            {/* 1. Three Flops — yellow */}
            <DailyCard
              title="Three Flops"
              blurb="Name all the answers before 3 wrong guesses"
              href="/daily/three-flops"
              testId="link-three-flops"
              completed={tsCompleted}
              defaultBadge="Available"
              color="#FFD60A"
              theme="light"
            />

            {/* 2. Pop Box — sky blue */}
            <DailyCard
              title="Pop Box"
              blurb="Find an answer for each intersection of the grid"
              href="/daily/pop-box"
              testId="link-pop-box"
              completed={pbCompleted}
              defaultBadge={{ label: "New", variant: "accent" }}
              color="#38BDF8"
              theme="light"
            />

            {/* 3. Pop or Drop — green */}
            <DailyCard
              title="Pop or Drop"
              blurb="Higher or Lower — pop culture edition"
              href="/daily/pop-or-drop"
              testId="link-pop-or-drop"
              completed={podCompleted}
              completedLabel={podStreak > 0 ? `🔥 ${podStreak}` : "Done ✓"}
              defaultBadge={{ label: "Hot 🔥", variant: "accent" }}
              color="#50C878"
              theme="light"
            />

            {/* ===== BOTTOM ROW — bold backgrounds, WHITE text ===== */}

            {/* 4. The Skinny — hot pink */}
            <DailyCard
              title="The Skinny"
              blurb="Pop culture crossword"
              href="/daily/crossword"
              testId="link-crossword"
              completed={cwCompleted}
              defaultBadge="Available"
              color="#FF006E"
              theme="dark"
            />

            {/* 5. Clock It — purple */}
            <DailyCard
              title="Clock It"
              icon={<Calendar className="w-5 h-5" />}
              blurb="3 pop culture hints — which year is it?"
              href="/daily/clock-it"
              testId="link-clock-it"
              completed={gtyCompleted}
              completedLabel={gtyGaveUp ? "💀 Gave Up" : gtyScore === 3 ? "🏆 Perfect" : gtyScore === 2 ? "⭐ Nice" : "Done ✓"}
              defaultBadge="Available"
              color="#9370DB"
              theme="dark"
            />

            {/* 6. Reel Connections — orange */}
            <DailyCard
              title="Reel Connections"
              blurb="Connect the actors through their movies"
              href="/daily/reel-connections"
              testId="link-reel-connections"
              completed={rcCompleted}
              completedLabel={rcScore !== null ? `${rcScore}/5` : "Done ✓"}
              defaultBadge={{ label: "New", variant: "accent" }}
              color="#FF6B35"
              theme="dark"
            />
          </div>
        </div>
      </section>

      {/* ===== PARTY GAMES SECTION ===== */}
      <section
        id="party-games"
        className="relative px-4 py-16 md:py-20 scroll-mt-20 overflow-hidden"
        style={{ background: "#FFF5E7", borderBottom: "5px solid #000" }}
      >
        <NeoDoodles />
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Speech bubble — heading + description */}
          <div className="relative w-fit max-w-full mx-auto mb-16">
            <div
              className="bg-white px-6 py-5 md:px-8 md:py-6"
              style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
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
                className="font-mono font-bold text-black/80"
                style={{ letterSpacing: "0.03em" }}
              >
                Project this screen on a TV or screen share remotely. Everyone joins on their phone.
                One host. Up to 10 players.
              </p>
            </div>

            {/* Speech bubble tail — black outline + white fill */}
            <div
              aria-hidden
              className="absolute left-12 md:left-16"
              style={{
                bottom: "-22px",
                width: 0,
                height: 0,
                borderLeft: "22px solid transparent",
                borderRight: "22px solid transparent",
                borderTop: "22px solid #000",
              }}
            />
            <div
              aria-hidden
              className="absolute left-[58px] md:left-[74px]"
              style={{
                bottom: "-12px",
                width: 0,
                height: 0,
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderTop: "14px solid #fff",
              }}
            />
          </div>

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
                  className="w-full bg-white hover:bg-[#FF006E] text-black font-mono font-black text-lg uppercase px-5 py-4 transition-colors duration-150"
                  style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000", letterSpacing: "0.03em" }}
                  data-testid="link-host-game"
                >
                  Host a Game →
                </button>
              </Link>
              <Link href="/host?demo=true">
                <button
                  className="w-full mt-3 bg-black hover:bg-[#FF006E] text-white hover:text-black font-mono font-black text-sm uppercase px-4 py-2 flex items-center justify-center gap-1 transition-colors duration-150"
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
              style={{ background: "#38BDF8", border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
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
                  className="w-full bg-white hover:bg-[#FF006E] text-black font-mono font-black text-lg uppercase px-5 py-4 transition-colors duration-150"
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
