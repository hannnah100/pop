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
import { BackArrow } from "@/components/ui/BackArrow";
import {
  SpeechBubbleDoodle,
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
    <div className="flex-1 flex flex-col min-h-[100dvh] bg-[#FF6B35] relative overflow-hidden">
      {/* Subtle corner doodles — smaller on mobile so they don't crowd the card */}
      <StarDoodle className="absolute top-4 left-3 w-7 h-7 sm:w-10 sm:h-10 text-[#FFD700] opacity-70" />
      <LightningDoodle className="absolute top-5 right-4 w-6 h-9 sm:w-8 sm:h-12 text-[#FFD700] opacity-60" />
      <StarDoodle className="absolute bottom-6 right-5 w-6 h-6 sm:w-7 sm:h-7 text-[#00E5FF] opacity-70" />

      {/* Back arrow — top left, above the card */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
        <BackArrow />
      </div>

      {/* Center the card vertically */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-12">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Doodle accent above card */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <SpeechBubbleDoodle className="w-12 h-10 text-white opacity-80" />
          </div>

          <div className="bg-white border-[4px] border-black shadow-[6px_6px_0_#000]">
            {/* Color band */}
            <div className="h-3 sm:h-4 bg-[#FFD700] border-b-[3px] border-black" />

            <div className="p-5 sm:p-7">
              <h1
                className="font-display font-black text-center mb-1 uppercase comic-headline"
                style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
              >
                Join Game
              </h1>
              <div className="flex justify-center mb-5">
                <div className="h-1 w-12 bg-[#FF6B35] border-y border-black" />
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
                    className="space-y-4"
                  >
                    <div className="space-y-2 text-center">
                      <label className="text-xs font-bold text-black/60 uppercase tracking-widest font-sans block">
                        Room Code
                      </label>
                      <Shake trigger={shakeKey}>
                        <Input
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                          placeholder="ABCD"
                          inputMode="text"
                          autoCapitalize="characters"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="text-center text-5xl sm:text-6xl font-display h-20 sm:h-24 tracking-[0.5em] border-[3px] border-black bg-[#FFF8E7] focus-visible:ring-[#FF6B35] uppercase shadow-[inset_2px_2px_0_rgba(0,0,0,0.08)]"
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
                      {isChecking ? "Checking…" : "Find Game"} <ArrowRight className="w-5 h-5 ml-1" />
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
                    className="space-y-4"
                  >
                    {/* Room code confirmation chip */}
                    <div className="flex justify-center mb-2">
                      <div className="bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-5 py-2 font-display font-black text-black uppercase text-2xl tracking-[0.35em]">
                        {roomCode}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-black/60 uppercase tracking-widest font-sans block">
                        Your Nickname
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 w-5 h-5" />
                        <Input
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                          placeholder="Nickname"
                          autoComplete="nickname"
                          className="text-xl h-14 sm:h-16 pl-12 border-[3px] border-black bg-[#FFF8E7] focus-visible:ring-[#FF1493]"
                          autoFocus
                          data-testid="input-player-name"
                        />
                      </div>
                      <p className="text-xs text-black/40 font-sans text-right">{playerName.length}/15</p>
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
                      className="w-full text-black/60 hover:text-black font-display text-sm uppercase"
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
    </div>
  );
}
