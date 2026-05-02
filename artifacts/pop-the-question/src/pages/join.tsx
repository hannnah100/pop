import { useState } from "react";
import { useLocation } from "wouter";
import { useGetRoom } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Join() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'code' | 'name'>('code');
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length !== 4) return;
    
    setIsChecking(true);
    
    try {
      // In a real scenario we'd use the useGetRoom hook imperatively or standard fetch
      // Since it's a hook, we just do a direct fetch for simplicity in this handler
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (res.ok) {
        setStep('name');
      } else {
        toast({
          title: "Room not found",
          description: "Check the code on the host screen.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error connecting",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    
    setLocation(`/game/${roomCode}/player?name=${encodeURIComponent(playerName.trim())}`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        <Card className="p-8 border-2 border-primary/20 bg-card/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-accent to-cyan-400" />
          
          <h1 className="text-3xl font-bold font-display text-center mb-8">Join Game</h1>
          
          <AnimatePresence mode="wait">
            {step === 'code' ? (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleCheckCode}
                className="space-y-6"
              >
                <div className="space-y-2 text-center">
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Enter Room Code</label>
                  <Input 
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="ABCD"
                    className="text-center text-5xl font-display h-24 tracking-[0.5em] bg-background border-2 border-border focus-visible:border-primary uppercase"
                    autoFocus
                    data-testid="input-room-code"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  disabled={roomCode.length !== 4 || isChecking}
                  data-testid="btn-check-code"
                >
                  {isChecking ? "Checking..." : "Find Game"} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="name"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleJoin}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Enter Your Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6" />
                    <Input 
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                      placeholder="Nickname"
                      className="text-2xl h-16 pl-14 bg-background border-2 border-border focus-visible:border-primary"
                      autoFocus
                      data-testid="input-player-name"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                  disabled={!playerName.trim()}
                  data-testid="btn-join-game"
                >
                  Join Room {roomCode}
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                  onClick={() => setStep('code')}
                >
                  Change Code
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
