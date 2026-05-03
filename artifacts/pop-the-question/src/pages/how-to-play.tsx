import { BackArrow } from "@/components/ui/BackArrow";
import { RainbowText } from "@/components/fx";
import {
  StarDoodle,
  LightningDoodle,
  SmileyDoodle,
  ConfettiDoodle,
  FlowerDoodle,
} from "@/components/fx/Doodles";

interface GameRulesCardProps {
  title: string;
  tagline: string;
  emoji: string;
  bg: string;
  textColor?: string;
  steps: string[];
  scoring: string;
  share: string;
}

function GameRulesCard({
  title,
  tagline,
  emoji,
  bg,
  textColor = "#000",
  steps,
  scoring,
  share,
}: GameRulesCardProps) {
  return (
    <div
      className="relative border-[4px] border-black shadow-[6px_6px_0_#000] p-6 md:p-8 overflow-hidden"
      style={{ background: bg }}
    >
      <StarDoodle className="absolute top-3 right-4 w-8 h-8 text-black opacity-15" />

      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl md:text-5xl leading-none" aria-hidden="true">{emoji}</span>
        <h2
          className="font-display font-black uppercase tracking-tight comic-headline leading-none"
          style={{
            fontSize: "clamp(1.6rem, 5vw, 2.6rem)",
            color: "#fff",
            WebkitTextStroke: "2px #000",
            paintOrder: "stroke fill",
          }}
        >
          {title}
        </h2>
      </div>
      <p
        className="font-display font-bold uppercase text-sm md:text-base mb-5 tracking-wide"
        style={{ color: textColor, opacity: 0.85 }}
      >
        {tagline}
      </p>

      <div className="bg-white/95 border-[3px] border-black shadow-[3px_3px_0_#000] p-4 md:p-5 mb-4">
        <h3 className="font-display font-black text-black uppercase text-base md:text-lg mb-3 tracking-wide">
          How to play
        </h3>
        <ol className="space-y-2 font-sans text-black text-sm md:text-base">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-black text-white font-display font-black text-sm"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="leading-snug pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-black text-white border-[3px] border-black shadow-[3px_3px_0_#000] p-4 mb-4">
        <h3 className="font-display font-black uppercase text-sm md:text-base mb-1 tracking-wide text-[#FFD700]">
          Scoring &amp; tips
        </h3>
        <p className="font-sans text-sm md:text-base leading-snug">{scoring}</p>
      </div>

      <div
        className="border-[3px] border-black shadow-[3px_3px_0_#000] p-3 flex items-center gap-2"
        style={{ background: "#FFD700" }}
      >
        <span className="text-xl shrink-0" aria-hidden="true">📣</span>
        <p className="font-sans font-bold text-black text-sm md:text-base leading-snug">
          {share}
        </p>
      </div>
    </div>
  );
}

const GAMES: GameRulesCardProps[] = [
  {
    title: "Three Strikes",
    tagline: "3 misses and you're out",
    emoji: "⚡",
    bg: "#FF6B35",
    steps: [
      "You'll see a pop-culture category with a hidden list of correct answers.",
      "Type a guess and submit. Matches don't have to be exact — close spellings count.",
      "Anything that isn't on the list earns a strike. Repeating an answer you already found just shows \"Already found!\" — no strike.",
      "Find every answer to win, or hit 3 strikes and the round ends.",
    ],
    scoring:
      "Your score is how many correct answers you found. Stuck? Try a different angle — the list usually goes deeper than the obvious picks.",
    share: "Brag about how many you got — share your result with the group chat.",
  },
  {
    title: "The Skinny",
    tagline: "Pop culture quickie — fill in the grid",
    emoji: "🧩",
    bg: "#00E5FF",
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
    title: "Pop Box",
    tagline: "Match a celeb to each row × column",
    emoji: "🎬",
    bg: "#FF1493",
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
    tagline: "Higher or Lower — pop culture edition",
    emoji: "📈",
    bg: "#00C853",
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
    title: "Guess the Year",
    tagline: "3 pop culture hints — which year is it?",
    emoji: "📅",
    bg: "#FFD700",
    steps: [
      "You'll see 3 pop-culture facts from the same year. The first hint is shown straight away.",
      "Lock in a year if you're confident, or tap to reveal Hint 2 — and then Hint 3 — for more clues.",
      "You only need to enter one final answer: the exact year.",
      "Out of ideas? You can give up to reveal the year, but you'll score 0.",
    ],
    scoring:
      "3 points if you nail it after just hint 1, 2 points after hint 2, 1 point after hint 3. The year has to be exact — close doesn't count.",
    share: "Share your score and see who in your group has the best memory.",
  },
];

export default function HowToPlay() {
  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">
      {/* ===== HERO ===== */}
      <header className="relative bg-[#FFF8E7] border-b-[4px] border-black px-4 pt-6 pb-10 overflow-hidden">
        <StarDoodle className="absolute top-4 left-6 w-10 h-10 text-[#FF1493] opacity-80" />
        <LightningDoodle className="absolute top-8 right-8 w-8 h-12 text-[#FF6B35] opacity-70" />
        <SmileyDoodle className="absolute bottom-6 left-10 w-10 h-10 text-[#00E5FF] opacity-60" />
        <FlowerDoodle className="absolute bottom-4 right-6 w-12 h-12 text-[#FF1493] opacity-70" />
        <ConfettiDoodle className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-16 opacity-60" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="mb-6">
            <BackArrow href="/" label="Back to home" displayText="Back" />
          </div>

          <h1
            className="font-display font-black leading-none tracking-tight comic-headline text-center"
            style={{ fontSize: "clamp(2.4rem, 9vw, 5rem)" }}
          >
            <RainbowText
              text="HOW TO PLAY"
              palette={["#FF0054", "#FF6B35", "#FFD700", "#00C853", "#00E5FF", "#FF1493"]}
            />
          </h1>
          <p className="mt-4 text-center font-sans font-bold text-black/80 text-base md:text-lg max-w-xl mx-auto">
            Five fresh pop culture puzzles every day. Here's how each one works.
          </p>
        </div>
      </header>

      {/* ===== GAME RULES ===== */}
      <section className="relative bg-[#FFF8E7] px-4 py-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          {GAMES.map((game) => (
            <GameRulesCard key={game.title} {...game} />
          ))}
        </div>
      </section>

      {/* ===== FOOTER BACK ===== */}
      <footer className="bg-[#FFF8E7] border-t-[4px] border-black px-4 py-8">
        <div className="max-w-3xl mx-auto flex justify-center">
          <BackArrow href="/" label="Back to home" displayText="Back to home" />
        </div>
      </footer>
    </div>
  );
}
