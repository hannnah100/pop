import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom, CreateRoomRequestGameType } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Flame, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Host() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const createRoom = useCreateRoom();

  const handleCreateRoom = (gameType: CreateRoomRequestGameType) => {
    setIsCreating(gameType);
    createRoom.mutate({
      data: { gameType }
    }, {
      onSuccess: (room) => {
        setLocation(`/game/${room.roomCode}/host`);
      },
      onError: (err) => {
        setIsCreating(null);
        toast({
          title: "Failed to create room",
          description: "Please try again later.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-12 md:py-24">
      <header className="mb-12 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold font-display text-primary mb-4"
        >
          Host a Game
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-muted-foreground"
        >
          Put this screen on a TV. Players join on their phones.
        </motion.p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full flex flex-col border-2 border-primary/20 hover:border-primary/50 transition-colors bg-card/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none group-hover:from-primary/20 transition-colors" />
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-3xl font-display">Pop the Question</CardTitle>
              <CardDescription className="text-base text-muted-foreground h-24">
                A voting game where you answer provocative pop culture questions about your friends. Who is most likely to survive a horror movie? Vote to find out.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto relative z-10">
              <Button 
                className="w-full text-lg h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                onClick={() => handleCreateRoom("pop-the-question")}
                disabled={isCreating !== null}
                data-testid="btn-host-ptq"
              >
                {isCreating === "pop-the-question" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>
                ) : "Host This Game"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full flex flex-col border-2 border-accent/20 hover:border-accent/50 transition-colors bg-card/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none group-hover:from-accent/20 transition-colors" />
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <Flame className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-3xl font-display">Roast Roulette</CardTitle>
              <CardDescription className="text-base text-muted-foreground h-24">
                A creative writing game. Everyone writes a brutal pop culture roast about someone else in the room. Guess who wrote what to score points.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto relative z-10">
              <Button 
                className="w-full text-lg h-14 bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                onClick={() => handleCreateRoom("roast-roulette")}
                disabled={isCreating !== null}
                data-testid="btn-host-rr"
              >
                {isCreating === "roast-roulette" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>
                ) : "Host This Game"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      <div className="mt-12 text-center">
        <Button variant="ghost" onClick={() => setLocation("/")} data-testid="btn-back">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
