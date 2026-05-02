import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Shake } from "@/components/fx";
import { useSfx } from "@/lib/sfx";
import { hapticWrong } from "@/lib/haptics";
import {
  SpeechBubbleDoodle,
  ArrowDoodle,
  StarDoodle,
  LightningDoodle,
} from "@/components/fx/Doodles";

export default function Join() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playWrong } = useSfx();

  const [step, setStep] = useState<'code' | 'name'>('code');
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length !== 4) return;

    setIsChecking(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (res.ok) {
        setStep('name');
      } else {
        setShakeKey((k) => k + 1);
        playWrong();
        hapticWrong();
        toast({
          title: "Room not found",
          description: "Check the code on the host screen.",
          variant: "destructive",
        });
      }
    } catch {
      setShakeKey((k) => k + 1);
      playWrong();
      hapticWrong();
      toast({
        title: "Error connecting",
        description: "Please try again later.",
        variant: "destructive",
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
    <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh] bg-[#FF6B35] px-4 py-12 relative overflow-hidden">
      {/* Decorations */}
      <StarDoodle className="absolute top-6 left-4 w-10 h-10 text-[#FFD700] opacity-80" />
      <LightningDoodle className="absolute top-8 right-6 w-8 h-12 text-[#FFD700] opacity-70" />
      <StarDoodle className="absolute bottom-8 right-8 w-7 h-7 text-[#00E5FF] opacity-80" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Speech bubble doodle above the card */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <ArrowDoodle className="w-12 h-8 text-[#FFD700] rotate-180" />
          <SpeechBubbleDoodle className="w-16 h-14 text-white" />
          <ArrowDoodle className="w-12 h-8 text-[#FFD700]" />
        </div>

        <div className="bg-white border-[4px] border-black shadow-[8px_8px_0_#000]">
          {/* Color band */}
          <div className="h-4 bg-[#FFD700] border-b-[3px] border-black" />

          <div className="p-8">
            <h1
              className="font-display font-black text-black text-center mb-1 uppercase"
              style={{ fontSize: "clamp(2.2rem, 8vw, 3rem)", textShadow: "3px 3px 0 rgba(0,0,0,0.12)" }}
            >
              Join Game
            </h1>
            <div className="flex justify-center mb-6">
              <div className="h-1 w-16 bg-[#FF6B35] border-y border-black" />
            </div>

            <AnimatePresence mode="wait">
              {step === 'code' ? (
                <motion.form
                  key="code"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.15 }}
                  onSubmit={handleCheckCode}
                  className="space-y-5"
                >
                  <div className="space-y-2 text-center">
                    <label className="text-xs font-bold text-black/60 uppercase tracking-widest font-sans">Enter Room Code</label>
                    <Shake trigger={shakeKey}>
                      <Input
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                        placeholder="ABCD"
                        className="text-center text-5xl font-display h-24 tracking-[0.5em] border-[3px] border-black bg-[#FFF8E7] focus-visible:ring-[#FF6B35] uppercase shadow-[inset_2px_2px_0_rgba(0,0,0,0.08)]"
                        autoFocus
                        data-testid="input-room-code"
                      />
                    </Shake>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-14 font-display text-lg uppercase tracking-wide"
                    disabled={roomCode.length !== 4 || isChecking}
                    data-testid="btn-check-code"
                  >
                    {isChecking ? "Checking…" : "Find Game"} <ArrowRight className="w-5 h-5" />
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="name"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.15 }}
                  onSubmit={handleJoin}
                  className="space-y-5"
                >
                  <div className="text-center mb-2">
                    <span className="inline-block bg-[#FFD700] border-[2px] border-black px-3 py-1 font-display font-black text-black uppercase text-sm tracking-wider">
                      Room: {roomCode}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-black/60 uppercase tracking-widest font-sans">Your Nickname</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 w-5 h-5" />
                      <Input
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                        placeholder="Nickname"
                        className="text-xl h-16 pl-12 border-[3px] border-black bg-[#FFF8E7] focus-visible:ring-[#FF1493]"
                        autoFocus
                        data-testid="input-player-name"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-14 font-display text-lg uppercase tracking-wide"
                    disabled={!playerName.trim()}
                    data-testid="btn-join-game"
                  >
                    Jump In!
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-black/60 hover:text-black"
                    onClick={() => setStep('code')}
                  >
                    ← Change Code
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
