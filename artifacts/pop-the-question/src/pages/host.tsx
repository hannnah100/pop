import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom, CreateRoomRequestGameType } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Flame, Loader2, Bot, Beer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/motion";

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
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-12 md:py-24">
      <motion.header
        className="mb-10 text-center"
        variants={staggerContainer(0.1)}
        initial="hidden"
        animate="show"
      >
        <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-black font-display tracking-tight text-foreground mb-3">
          HOST A GAME
        </motion.h1>
        <motion.div variants={staggerItem} className="flex justify-center mb-4">
          <div className="heading-divider heading-divider--orange w-20 h-1" />
        </motion.div>
        <motion.p variants={staggerItem} className="text-lg text-muted-foreground">
          Put this screen on a TV. Players join on their phones.
        </motion.p>

        <motion.div
          variants={staggerItem}
          className="mt-6 inline-flex items-center gap-3 bg-card/70 backdrop-blur border border-border rounded-2xl px-5 py-3 surface-elevated"
        >
          <Bot className={`w-5 h-5 ${demoMode ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`font-medium text-sm ${demoMode ? "text-foreground" : "text-muted-foreground"}`}>
            Demo Mode (AI Players)
          </span>
          <button
            role="switch"
            aria-checked={demoMode}
            onClick={() => setDemoMode((d) => !d)}
            className={`relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary
              ${demoMode ? "bg-primary shadow-[0_0_18px_-2px_hsl(var(--primary))]" : "bg-muted"}`}
            data-testid="toggle-demo"
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${demoMode ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
          {demoMode && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">ON</Badge>
          )}
        </motion.div>

        {demoMode && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground mt-2"
          >
            🤖 5 AI players will join automatically — perfect for demos & testing
          </motion.p>
        )}
      </motion.header>

      <motion.div
        className="grid md:grid-cols-3 gap-8"
        variants={staggerContainer(0.12, 0.2)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <Card className="h-full flex flex-col border-2 border-primary/20 hover:border-primary/60 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.7)] transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent pointer-events-none group-hover:from-primary/25 transition-colors" />
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_24px_-4px_hsl(var(--primary))] transition-shadow">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">POP THE QUESTION</CardTitle>
              <div className="heading-divider heading-divider--pink mb-2" />
              <CardDescription className="text-base text-muted-foreground h-24">
                A voting game where you answer provocative pop culture questions about your friends. Who is most likely to survive a horror movie? Vote to find out.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full text-lg h-14 font-bold"
                onClick={() => handleCreateRoom("pop-the-question")}
                disabled={isCreating !== null}
                data-testid="btn-host-ptq"
              >
                {isCreating === "pop-the-question" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>
                ) : demoMode ? (
                  <><Bot className="w-5 h-5 mr-2" /> Demo: Pop the Question</>
                ) : "Host This Game"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full flex flex-col border-2 border-accent/20 hover:border-accent/60 hover:shadow-[0_20px_60px_-20px_hsl(var(--accent)/0.7)] transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/15 to-transparent pointer-events-none group-hover:from-accent/25 transition-colors" />
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_24px_-4px_hsl(var(--accent))] transition-shadow">
                <Flame className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">ROAST ROULETTE</CardTitle>
              <div className="heading-divider heading-divider--orange mb-2" />
              <CardDescription className="text-base text-muted-foreground h-24">
                A creative writing game. Everyone writes a brutal pop culture roast about someone else in the room. Guess who wrote what to score points.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full text-lg h-14 font-bold"
                onClick={() => handleCreateRoom("roast-roulette")}
                disabled={isCreating !== null}
                data-testid="btn-host-rr"
              >
                {isCreating === "roast-roulette" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>
                ) : demoMode ? (
                  <><Bot className="w-5 h-5 mr-2" /> Demo: Roast Roulette</>
                ) : "Host This Game"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full flex flex-col border-2 border-secondary/20 hover:border-secondary/60 hover:shadow-[0_20px_60px_-20px_hsl(var(--secondary)/0.7)] transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/15 to-transparent pointer-events-none group-hover:from-secondary/25 transition-colors" />
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_24px_-4px_hsl(var(--secondary))] transition-shadow">
                <Beer className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">PUB QUIZ</CardTitle>
              <div className="heading-divider heading-divider--green mb-2" />
              <CardDescription className="text-base text-muted-foreground h-24">
                Classic bar trivia, run from your couch. 5 packs, multiple choice, open-ended, and true/false rounds. First-correct gets a bonus.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full text-lg h-14 font-bold"
                onClick={() => handleCreateRoom("pub-quiz")}
                disabled={isCreating !== null}
                data-testid="btn-host-pq"
              >
                {isCreating === "pub-quiz" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>
                ) : demoMode ? (
                  <><Bot className="w-5 h-5 mr-2" /> Demo: Pub Quiz</>
                ) : "Host This Game"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="mt-12 text-center">
        <Button variant="ghost" onClick={() => setLocation("/")} data-testid="btn-back">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
