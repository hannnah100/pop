import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BackArrow } from "@/components/ui/BackArrow";
import { NeoDoodles } from "@/components/fx/NeoDoodles";

interface GameRules {
  title: string;
  tagline: string;
  emoji: string;
  bg: string;
  theme: "light" | "dark";
  steps: string[];
  scoring: string;
  share: string;
}

interface GameRulesCardProps extends GameRules {
  open: boolean;
  onToggle: () => void;
}

function GameRulesCard({
  title,
  tagline,
  emoji,
  bg,
  theme,
  steps,
  scoring,
  share,
  open,
  onToggle,
}: GameRulesCardProps) {
  const textColor = theme === "light" ? "text-black" : "text-white";
  const panelId = `game-rules-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <article
      style={{
        border: "5px solid #000",
        boxShadow: "8px 8px 0 #000",
        background: bg,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`btn-toggle-${panelId}`}
        className="w-full flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4 md:py-5 text-left cursor-pointer"
      >
        <span
          className="inline-flex items-center justify-center w-11 h-11 md:w-12 md:h-12 bg-white text-2xl shrink-0"
          style={{ border: "3px solid #000", boxShadow: "3px 3px 0 #000" }}
          aria-hidden
        >
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <h2
            className={`font-mono font-black uppercase leading-tight ${textColor}`}
            style={{
              fontSize: "clamp(1.1rem, 4vw, 1.75rem)",
              letterSpacing: "0.03em",
            }}
          >
            {title}
          </h2>
          <p
            className={`font-mono font-bold uppercase text-[11px] md:text-xs mt-1 ${textColor}`}
            style={{ letterSpacing: "0.03em", opacity: 0.85 }}
          >
            {tagline}
          </p>
        </div>
        <span
          className="inline-flex items-center justify-center w-10 h-10 md:w-11 md:h-11 bg-white shrink-0"
          style={{ border: "3px solid #000", boxShadow: "3px 3px 0 #000" }}
          aria-hidden
        >
          <ChevronDown
            className="w-5 h-5 md:w-6 md:h-6 text-black"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            strokeWidth={3}
          />
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="bg-white p-4 md:p-6"
          style={{ borderTop: "5px solid #000" }}
        >
          <div
            className="bg-white p-4 md:p-5 mb-4"
            style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000" }}
          >
            <h3
              className="font-mono font-black text-black uppercase text-sm md:text-base mb-3"
              style={{ letterSpacing: "0.03em" }}
            >
              How to Play
            </h3>
            <ol className="space-y-2.5 text-black">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex items-center justify-center shrink-0 w-7 h-7 bg-black text-white font-mono font-black text-sm"
                    style={{ letterSpacing: "0.03em" }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span
                    className="font-mono font-bold text-sm md:text-base leading-snug pt-0.5"
                    style={{ letterSpacing: "0.01em" }}
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div
            className="bg-black text-white p-4 mb-4"
            style={{ border: "4px solid #000", boxShadow: "5px 5px 0 #000" }}
          >
            <h3
              className="font-mono font-black uppercase text-sm md:text-base mb-2 text-[#FFD60A]"
              style={{ letterSpacing: "0.03em" }}
            >
              Scoring &amp; Tips
            </h3>
            <p
              className="font-mono font-bold text-sm md:text-base leading-snug"
              style={{ letterSpacing: "0.01em" }}
            >
              {scoring}
            </p>
          </div>

          <div
            className="p-3 flex items-start gap-3"
            style={{
              background: "#FFD60A",
              border: "4px solid #000",
              boxShadow: "5px 5px 0 #000",
            }}
          >
            <span
              className="font-mono font-black text-black text-xs uppercase px-2 py-1 bg-white shrink-0"
              style={{ border: "3px solid #000", letterSpacing: "0.03em" }}
            >
              Share
            </span>
            <p
              className="font-mono font-bold text-black text-sm md:text-base leading-snug pt-0.5"
              style={{ letterSpacing: "0.01em" }}
            >
              {share}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

const GAMES: GameRules[] = [
  {
    title: "Three Flops",
    tagline: "3 misses and you're out",
    emoji: "⚡",
    bg: "#FFD60A",
    theme: "light",
    steps: [
      "You'll see a pop-culture category with a hidden list of correct answers.",
      "Type a guess and submit. Matches don't have to be exact — close spellings count.",
      "Anything that isn't on the list earns a flop. Repeating an answer you already found just shows \"Already found!\" — no flop.",
      "Find every answer to win, or hit 3 flops and the round ends.",
    ],
    scoring:
      "Your score is how many correct answers you found. Stuck? Try a different angle — the list usually goes deeper than the obvious picks.",
    share: "Brag about how many you got — share your result with the group chat.",
  },
  {
    title: "Pop Box",
    tagline: "Match a celeb to each row × column",
    emoji: "🎬",
    bg: "#38BDF8",
    theme: "light",
    steps: [
      "You'll see a 3×3 grid with a category on each row and each column.",
      "Tap a square and name a celebrity who fits BOTH that row and column.",
      "Each square locks once you guess — right or wrong — so think before you submit.",
      "Fill all 9 squares to finish the board.",
    ],
    scoring:
      "Your score is how many of the 9 you got right. Each pick also gets a rarity score showing how unique your answer was — 95%+ is an Iconic Pick, 80%+ is a Rare Grab.",
    share: "Show off your iconic picks and rarity scores in the group chat.",
  },
  {
    title: "Pop or Drop",
    tagline: "Higher or lower — pop culture edition",
    emoji: "📈",
    bg: "#50C878",
    theme: "light",
    steps: [
      "You'll see two pop-culture items side by side comparing the same metric.",
      "The left card shows its real number. The right card is hidden behind ???.",
      "Tap HIGHER if you think the right item's number is bigger, LOWER if smaller.",
      "Get it right and the right card stays as the new left, with a fresh challenger on the right. One wrong answer ends the run instantly.",
    ],
    scoring:
      "Your streak is your score — see how many in a row you can chain. Trust your gut on the big numbers; the gaps are usually wider than you think.",
    share: "Post your streak and dare your friends to beat it.",
  },
  {
    title: "The Skinny",
    tagline: "Pop culture crossword",
    emoji: "🧩",
    bg: "#FF006E",
    theme: "dark",
    steps: [
      "Tap a square to start a word, then type your answers using the Across and Down clues.",
      "Letters that are correct as you type get a little pop animation as a confidence boost.",
      "When you think the grid is done, hit \"Check Grid\" to see if you've solved it.",
      "Beat the clock — there's a target time ticking down at the top of the puzzle.",
    ],
    scoring:
      "There are no hints, just you and the clues. Solving under the target time is the flex — partial fills don't count, so finish the whole grid.",
    share: "Finished it? Share your time and challenge a friend to beat it.",
  },
  {
    title: "Clock It",
    tagline: "3 pop culture hints — which year is it?",
    emoji: "📅",
    bg: "#9370DB",
    theme: "dark",
    steps: [
      "You'll see 3 pop-culture facts from the same year. The first hint is shown straight away.",
      "Type a year and submit — wrong guesses don't end the game, so you can keep trying.",
      "Need more help? Tap to reveal Hint 2, and then Hint 3, for more clues.",
      "Stuck? You can give up to reveal the year, but you'll score 0.",
    ],
    scoring:
      "Your score depends on how many hints had been revealed when you nailed the year: 3 points with only hint 1 showing, 2 with hint 2 revealed, 1 with hint 3. The year has to be exact — close doesn't count.",
    share: "Share your score and see who in your group has the best memory.",
  },
  {
    title: "Reel Connections",
    tagline: "Link 6 actors around the loop",
    emoji: "🎞️",
    bg: "#FF6B35",
    theme: "dark",
    steps: [
      "You'll see 6 actors arranged in a loop. Name a movie or TV show that connects each adjacent pair.",
      "There are 6 connections total — the last actor connects back to the first to close the loop.",
      "Type your answer and submit. Multiple valid titles are accepted for each pair, and close spellings count.",
      "You get 5 lives for the entire puzzle. Each wrong answer costs 1 life. Complete all 6 connections to win.",
    ],
    scoring:
      "Your score is how many of the 6 connections you nailed before running out of lives. Lose all 5 lives and the round ends — the remaining answers are revealed.",
    share: "Brag about your run — share your lives remaining and connections found.",
  },
];

export default function HowToPlay() {
  const [openTitle, setOpenTitle] = useState<string | null>(null);

  return (
    <div
      className="flex-1 flex flex-col w-full overflow-x-hidden"
      style={{ background: "#FFF5E7" }}
    >
      {/* ===== HERO ===== */}
      <header
        className="relative px-4 pt-6 md:pt-10 pb-12 md:pb-16 overflow-hidden"
        style={{ background: "#FFF5E7", borderBottom: "5px solid #000" }}
      >
        <NeoDoodles opacity={0.9} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="mb-8">
            <BackArrow href="/" label="Back to home" displayText="Back" />
          </div>

          {/* Title block — neo-brutalism speech card */}
          <div className="relative w-fit max-w-full mx-auto">
            <div
              className="bg-white px-5 py-5 md:px-8 md:py-7"
              style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span
                  className="px-3 py-1 font-mono font-black text-xs text-black uppercase"
                  style={{
                    background: "#FFD60A",
                    border: "3px solid #000",
                    boxShadow: "3px 3px 0 #000",
                    letterSpacing: "0.03em",
                  }}
                >
                  Rules
                </span>
                <h1
                  className="font-mono font-black text-black uppercase leading-none"
                  style={{
                    fontSize: "clamp(2rem, 7vw, 3.75rem)",
                    letterSpacing: "0.03em",
                  }}
                >
                  How to Play
                </h1>
              </div>
              <p
                className="font-mono font-bold text-black"
                style={{ letterSpacing: "0.03em" }}
              >
                Tap a game to see how it works. Six fresh pop culture puzzles every day.
              </p>
            </div>

            {/* Speech bubble tail */}
            <div
              aria-hidden
              className="absolute left-10 md:left-14"
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
              className="absolute left-[52px] md:left-[72px]"
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
      </header>

      {/* ===== GAME RULES ACCORDION ===== */}
      <section
        className="relative px-4 py-12 md:py-16"
        style={{ background: "#FFF5E7" }}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-5 md:gap-6 relative z-10">
          {GAMES.map((game) => (
            <GameRulesCard
              key={game.title}
              {...game}
              open={openTitle === game.title}
              onToggle={() =>
                setOpenTitle((cur) => (cur === game.title ? null : game.title))
              }
            />
          ))}
        </div>
      </section>

      {/* ===== FOOTER BACK ===== */}
      <footer
        className="px-4 py-10"
        style={{ background: "#FFF5E7", borderTop: "5px solid #000" }}
      >
        <div className="max-w-3xl mx-auto flex justify-center">
          <BackArrow href="/" label="Back to home" displayText="Back to Home" />
        </div>
      </footer>
    </div>
  );
}
