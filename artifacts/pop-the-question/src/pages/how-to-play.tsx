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
      "You'll see a pop-culture category and need to name things that fit it.",
      "Type your answer and submit — correct guesses keep you alive.",
      "Each wrong or repeated guess is a strike. Three strikes and the round ends.",
      "Keep going as long as you can to rack up the longest streak.",
    ],
    scoring:
      "You're scored on how many correct answers you get before your third strike. Stuck? Take a breath — sometimes the obvious answer is the right one.",
    share: "Brag about your streak — share your result with the group chat.",
  },
  {
    title: "The Skinny",
    tagline: "Pop culture quickie — fill in the grid",
    emoji: "🧩",
    bg: "#00E5FF",
    steps: [
      "Tap a square to start filling in a word, then type your answer.",
      "Use the across and down clues to figure out each word.",
      "Cross-checking letters helps you crack the trickier ones.",
      "Fill every square correctly to finish the puzzle.",
    ],
    scoring:
      "Faster solves and fewer hints make for a better result. There's no penalty for trying — guess freely and back yourself.",
    share: "Finished it? Share your time and challenge a friend to beat it.",
  },
  {
    title: "Pop Box",
    tagline: "Match a celeb to each row × column",
    emoji: "🎬",
    bg: "#FF1493",
    steps: [
      "You'll see a 3×3 grid with a category on each row and column.",
      "Pick a square and name a celebrity who fits BOTH that row and column.",
      "Each celebrity can only be used once across the whole board.",
      "Fill all 9 squares to complete the box.",
    ],
    scoring:
      "Rarer picks score higher than the obvious ones — go off-script if you can. Aim to fill all 9 squares; partial boards still count.",
    share: "Show off your most original picks in the group chat.",
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
      "Get it right and the right card slides over and a new one appears. One wrong guess ends the run.",
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
      "You'll get up to 3 pop-culture hints from the same year.",
      "After each hint, lock in your best guess for the year.",
      "The fewer hints you need, the more points you score.",
      "Get it on the first hint for the perfect score.",
    ],
    scoring:
      "3 points for nailing it on hint one, 2 on hint two, 1 on hint three. Close-but-not-quite still earns partial credit on the final guess.",
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
