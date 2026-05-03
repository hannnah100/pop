import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Grid3x3, CircleDot, Beer, ArrowLeft } from "lucide-react";
import { BackArrow } from "@/components/ui/BackArrow";
import {
  StarDoodle,
  ConfettiDoodle,
  LightningDoodle,
} from "@/components/fx/Doodles";

const GAME_TYPES = [
  {
    id: "jeopardy",
    label: "Jeopardy",
    tagline: "6 categories · 5 clues each · Final Jeopardy",
    description:
      "Build your own board with custom categories, clues, Daily Doubles, and a Final Jeopardy question.",
    Icon: Grid3x3,
    bg: "#FFC107",
    accent: "#1565C0",
    path: "/create-game/jeopardy",
  },
  {
    id: "wof",
    label: "Wheel of Fortune",
    tagline: "10–50 puzzles · categories · live preview",
    description:
      "Create a puzzle pack with phrases, categories, and optional hints. Watch tiles reveal as you type.",
    Icon: CircleDot,
    bg: "#7C3AED",
    accent: "#FFD700",
    path: "/create-game/wof",
  },
  {
    id: "quiz",
    label: "Pub Quiz",
    tagline: "3–7 rounds · multiple choice, open-ended, true/false",
    description:
      "Design trivia rounds with any mix of question types and optional double-point questions.",
    Icon: Beer,
    bg: "#00C853",
    accent: "#FFD700",
    path: "/create-game/quiz",
  },
];

export default function CreateGamePicker() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">
      <header className="relative bg-[#FF6B35] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <StarDoodle className="absolute top-3 left-4 w-9 h-9 text-[#FFD700]" />
        <ConfettiDoodle className="absolute top-2 right-4 w-12 h-12 opacity-70" />
        <LightningDoodle className="absolute bottom-2 left-10 w-6 h-9 text-white opacity-60" />
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline"
            style={{ fontSize: "clamp(2rem, 7vw, 4rem)" }}
          >
            Create Custom Game
          </h1>
          <p className="mt-2 text-base md:text-lg font-bold text-black/70 font-sans">
            Choose a game type to get started
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {GAME_TYPES.map((game) => {
            const { Icon } = game;
            return (
              <motion.button
                key={game.id}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation(game.path)}
                className="bg-white border-[3px] border-black shadow-[6px_6px_0_#000] flex flex-col overflow-hidden text-left w-full"
              >
                <div
                  className="h-3 w-full border-b-[3px] border-black"
                  style={{ backgroundColor: game.bg }}
                />
                <div className="p-6 flex flex-col flex-1">
                  <div
                    className="w-12 h-12 border-[3px] border-black flex items-center justify-center mb-4"
                    style={{ backgroundColor: game.bg }}
                  >
                    <Icon className="w-6 h-6 text-black" />
                  </div>
                  <h2 className="font-display text-2xl font-black text-black uppercase tracking-tight mb-1">
                    {game.label}
                  </h2>
                  <p
                    className="text-xs font-bold uppercase tracking-wide mb-3"
                    style={{ color: game.bg === "#00C853" ? "#008C3A" : game.bg === "#7C3AED" ? "#5B21B6" : game.bg }}
                  >
                    {game.tagline}
                  </p>
                  <p className="text-sm text-black/60 font-sans flex-1">
                    {game.description}
                  </p>
                  <div
                    className="mt-5 w-full py-3 border-[3px] border-black font-display font-black uppercase text-base text-center shadow-[3px_3px_0_#000]"
                    style={{ backgroundColor: game.bg, color: "#000" }}
                  >
                    Create {game.label}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <BackArrow />
        </div>
      </div>
    </div>
  );
}
