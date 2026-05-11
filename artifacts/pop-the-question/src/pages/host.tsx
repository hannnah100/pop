import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom, CreateRoomRequestGameType } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { MessageSquare, Flame, Loader2, Bot, Beer, Grid3x3, CircleDot, LayoutList, PenSquare, Star, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BackArrow } from "@/components/ui/BackArrow";
import { NeoDoodles } from "@/components/fx/NeoDoodles";

const GAME_CARDS = [
  {
    type: "pop-the-question" as CreateRoomRequestGameType,
    label: "Poll the Question",
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
    label: "Bar Trivia",
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
    label: "Pop Quiz",
    tagline: "Six categories. Daily Doubles. Final Round.",
    description:
      "Buzz in fast, judge bold wagers, and bet it all on the Final Round. Five hand-authored category packs of pure pop trivia.",
    Icon: Grid3x3,
    bg: "#38BDF8",
    accent: "#1565C0",
    testId: "btn-host-jp",
  },
  {
    type: "wheel-of-fortune" as CreateRoomRequestGameType,
    label: "Wheel of Fandom",
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
    label: "Popping List",
    tagline: "One letter. Multiple categories. Race the clock.",
    description:
      "Race the clock to fill in pop-culture categories starting with the same letter. Unique answers score — duplicates don't.",
    Icon: LayoutList,
    bg: "#FFC107",
    accent: "#FFD700",
    testId: "btn-host-scattergories",
  },
  {
    type: "read-the-room" as CreateRoomRequestGameType,
    label: "Read the Room",
    tagline: "Spill anonymous answers. Solve the matchup.",
    description:
      "Players drop anonymous takes. One Solver per round tries to match each answer to who said it. Spectators get one high-risk dart per game for bonus points.",
    Icon: Eye,
    bg: "#FF006E",
    accent: "#FFD60A",
    testId: "btn-host-rtr",
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
          if (gameType === "read-the-room") {
            setLocation(`/read-the-room/${room.roomCode}/host`);
          } else {
            setLocation(`/game/${room.roomCode}/host`);
          }
        },
        onError: () => {
          setIsCreating(null);
          toast({ title: "Failed to create room", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden relative" style={{ background: "#F5F0E6" }}>
      <NeoDoodles />

      {/* Header */}
      <header className="px-4 pt-8 pb-6 text-center relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col items-center">
          <h1
            className="font-mono font-black uppercase leading-none tracking-tight text-black"
            style={{ fontSize: "clamp(2.4rem, 8vw, 4.5rem)" }}
          >
            Host a Game
          </h1>
          <p className="mt-3 font-mono font-bold text-base md:text-lg uppercase text-black">
            Put this screen on a TV. Players join on their phones.
          </p>
        </div>
      </header>

      {/* Game cards */}
      <div className="flex-1 px-4 py-4 relative z-10">
        {/* Action strip — custom game, my games, demo toggle */}
        <div className="max-w-6xl mx-auto flex gap-3 flex-wrap items-center mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/create-game")}
            className="flex items-center gap-2 px-5 py-3 bg-cyan-300 text-black font-mono font-black uppercase text-sm"
            style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000" }}
            data-testid="btn-create-custom-game"
          >
            <PenSquare className="w-4 h-4" />
            Create Custom Game
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/my-games")}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black font-mono font-black uppercase text-sm"
            style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000" }}
            data-testid="btn-my-games"
          >
            <Star className="w-4 h-4 text-black fill-yellow-300" />
            My Custom Games
          </motion.button>

          {/* Demo mode toggle — grouped with the other action buttons */}
          <div
            className="inline-flex items-center gap-3 bg-white px-5 py-3"
            style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000" }}
          >
            <Bot className={`w-5 h-5 ${demoMode ? "text-black" : "text-black/40"}`} />
            <span className={`font-mono font-black uppercase text-sm ${demoMode ? "text-black" : "text-black/50"}`}>
              Demo Mode (AI Players)
            </span>
            <button
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode((d) => !d)}
              className={`relative w-12 h-6 transition-none ${demoMode ? "bg-lime-400" : "bg-white"}`}
              style={{ border: "3px solid #000" }}
              data-testid="toggle-demo"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-black transition-none
                  ${demoMode ? "left-6" : "left-0.5"}`}
              />
            </button>
          </div>

          {demoMode && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono font-bold uppercase text-sm text-black"
            >
              🤖 5 AI players will join automatically
            </motion.span>
          )}
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {GAME_CARDS.map((game) => {
            const { Icon } = game;
            const creating = isCreating === game.type;
            return (
              <div
                key={game.type}
                className="bg-white flex flex-col overflow-hidden relative"
                style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
              >
                {/* Color band */}
                <div
                  className="h-4 w-full"
                  style={{ backgroundColor: game.bg, borderBottom: "5px solid #000" }}
                />

                <div className="p-6 flex flex-col flex-1">
                  <div
                    className="w-14 h-14 flex items-center justify-center mb-4"
                    style={{ backgroundColor: game.bg, border: "4px solid #000", boxShadow: "4px 4px 0 #000" }}
                  >
                    <Icon className="w-7 h-7 text-black" />
                  </div>
                  <h2 className="font-mono text-2xl font-black text-black uppercase tracking-tight mb-2 leading-tight">
                    {game.label}
                  </h2>
                  <p className="font-mono text-xs font-black uppercase tracking-wide mb-3 text-black/70">
                    {game.tagline}
                  </p>
                  <p className="font-mono text-sm text-black/70 mb-6 flex-1">
                    {game.description}
                  </p>
                  <button
                    className="w-full font-mono font-black uppercase text-base px-4 py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: game.bg,
                      color: "#000",
                      border: "4px solid #000",
                      boxShadow: "5px 5px 0 #000",
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
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <BackArrow />
        </div>
      </div>
    </div>
  );
}
