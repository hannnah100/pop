import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom, CreateRoomRequestGameType } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Flame, Loader2, Bot, Beer, Grid3x3, CircleDot, LayoutList, PenSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  StarDoodle,
  LightningDoodle,
  SmileyDoodle,
  ConfettiDoodle,
} from "@/components/fx/Doodles";
import { BackArrow } from "@/components/ui/BackArrow";

const GAME_CARDS = [
  {
    type: "pop-the-question" as CreateRoomRequestGameType,
    label: "Pop the Question",
    tagline: "Who is most likely to survive a horror movie?",
    description:
      "A voting game where you answer provocative pop culture questions about your friends. Vote to find out who your crew really is.",
    Icon: MessageSquare,
    bg: "#FF1493",
    accent: "#FFD700",
    testId: "btn-host-ptq",
  },
  {
    type: "roast-roulette" as CreateRoomRequestGameType,
    label: "Roast Roulette",
    tagline: "Write the roast. Guess the author.",
    description:
      "A creative writing game. Everyone writes a brutal pop culture roast about someone else in the room. Guess who wrote what to score points.",
    Icon: Flame,
    bg: "#FF6B35",
    accent: "#FFD700",
    testId: "btn-host-rr",
  },
  {
    type: "pub-quiz" as CreateRoomRequestGameType,
    label: "Pub Quiz",
    tagline: "5 packs. 3 round types. Pure trivia chaos.",
    description:
      "Classic bar trivia, run from your couch. Multiple choice, open-ended, and true/false rounds. First-correct gets a bonus.",
    Icon: Beer,
    bg: "#00C853",
    accent: "#FFD700",
    testId: "btn-host-pq",
  },
  {
    type: "jeopardy" as CreateRoomRequestGameType,
    label: "Jeopardy",
    tagline: "Six categories. Daily Doubles. Final Jeopardy.",
    description:
      "Buzz in fast, judge bold wagers, and bet it all on Final Jeopardy. Five hand-authored category packs of pure pop trivia.",
    Icon: Grid3x3,
    bg: "#FFC107",
    accent: "#1565C0",
    testId: "btn-host-jp",
  },
  {
    type: "wheel-of-fortune" as CreateRoomRequestGameType,
    label: "Wheel of Fortune",
    tagline: "Spin. Guess. Solve. Win.",
    description:
      "Spin the wheel to earn cash, guess letters, and race to solve the puzzle before anyone else. Three pop-culture puzzle packs.",
    Icon: CircleDot,
    bg: "#B97AD7",
    accent: "#FFD700",
    testId: "btn-host-wof",
  },
  {
    type: "scattergories" as CreateRoomRequestGameType,
    label: "Scattergories",
    tagline: "Name something famous starting with S.",
    description:
      "Race the clock to fill in pop-culture categories starting with the same letter. Unique answers score — duplicates don't.",
    Icon: LayoutList,
    bg: "#38BDF8",
    accent: "#FFD700",
    testId: "btn-host-scattergories",
  },
];

export default function Host() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const initialDemo =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "true";

  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(initialDemo);
  const createRoom = useCreateRoom();

  const handleCreateRoom = (gameType: CreateRoomRequestGameType) => {
    setIsCreating(gameType);
    createRoom.mutate(
      { data: { gameType, demo: demoMode } },
      {
        onSuccess: (room) => {
          setLocation(`/game/${room.roomCode}/host`);
        },
        onError: () => {
          setIsCreating(null);
          toast({ title: "Failed to create room", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">

      {/* Header */}
      <header className="relative bg-[#00E5FF] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <StarDoodle className="absolute top-3 left-4 w-9 h-9 text-[#FF1493]" />
        <ConfettiDoodle className="absolute top-2 right-4 w-12 h-12 opacity-70" />
        <LightningDoodle className="absolute bottom-2 left-10 w-6 h-9 text-[#FF6B35] opacity-70" />

        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline"
            style={{ fontSize: "clamp(2.4rem, 8vw, 4.5rem)" }}
          >
            Host a Game
          </h1>
          <p className="mt-2 text-base md:text-lg font-bold text-black/70 font-sans">
            Put this screen on a TV. Players join on their phones.
          </p>

          {/* Demo mode toggle */}
          <div className="mt-5 inline-flex items-center gap-3 bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-5 py-3">
            <Bot className={`w-5 h-5 ${demoMode ? "text-[#FF1493]" : "text-black/40"}`} />
            <span className={`font-bold text-sm ${demoMode ? "text-black" : "text-black/50"}`}>
              Demo Mode (AI Players)
            </span>
            <button
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode((d) => !d)}
              className={`relative w-12 h-6 border-[2px] border-black transition-none focus-visible:ring-2 focus-visible:ring-[#FF1493]
                ${demoMode ? "bg-[#FF1493]" : "bg-white"}`}
              data-testid="toggle-demo"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-black border border-white transition-none
                  ${demoMode ? "left-6" : "left-0.5"}`}
              />
            </button>
            {demoMode && (
              <Badge variant="default" className="text-xs">ON</Badge>
            )}
          </div>

          {demoMode && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold text-black/70 mt-2 font-sans"
            >
              🤖 5 AI players will join automatically
            </motion.p>
          )}
        </div>
      </header>

      {/* Game cards */}
      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        {/* Custom game action strip */}
        <div className="max-w-6xl mx-auto flex gap-3 flex-wrap mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/create-game")}
            className="flex items-center gap-2 px-5 py-3 bg-[#FF6B35] text-black font-display font-black uppercase text-sm border-[3px] border-black shadow-[4px_4px_0_#000]"
            data-testid="btn-create-custom-game"
          >
            <PenSquare className="w-4 h-4" />
            Create Custom Game
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/my-games")}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black font-display font-black uppercase text-sm border-[3px] border-black shadow-[4px_4px_0_#000]"
            data-testid="btn-my-games"
          >
            <Star className="w-4 h-4 text-[#FFD700] fill-[#FFD700]" />
            My Custom Games
          </motion.button>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {GAME_CARDS.map((game) => {
            const { Icon } = game;
            const creating = isCreating === game.type;
            return (
              <div
                key={game.type}
                className="bg-white border-[3px] border-black shadow-[6px_6px_0_#000] flex flex-col overflow-hidden relative"
              >
                {/* Color band */}
                <div
                  className="h-3 w-full border-b-[3px] border-black"
                  style={{ backgroundColor: game.bg }}
                />
                {/* Doodle accent */}
                <SmileyDoodle
                  className="absolute top-4 right-4 w-8 h-8 opacity-20"
                  style={{ color: game.bg }}
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
                    style={{ color: game.bg === "#00C853" ? "#008C3A" : game.bg }}
                  >
                    {game.tagline}
                  </p>
                  <p className="text-sm text-black/60 font-sans mb-6 flex-1">
                    {game.description}
                  </p>
                  <Button
                    className="w-full font-display uppercase tracking-wide text-base"
                    style={{
                      backgroundColor: game.bg,
                      color: "#000",
                    }}
                    onClick={() => handleCreateRoom(game.type)}
                    disabled={isCreating !== null}
                    data-testid={game.testId}
                  >
                    {creating ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Creating…</>
                    ) : demoMode ? (
                      <><Bot className="w-5 h-5" /> Demo: {game.label}</>
                    ) : "Host This Game"}
                  </Button>
                </div>
              </div>
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
