import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { ArrowRight, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Shake } from "@/components/fx";
import { useSfx } from "@/lib/sfx";
import { hapticWrong } from "@/lib/haptics";
import { BackArrow } from "@/components/ui/BackArrow";

export default function Join() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playWrong } = useSfx();

  const [step, setStep] = useState<'code' | 'name'>('code');
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [roomGameType, setRoomGameType] = useState<string>("");

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length !== 4) return;

    setIsChecking(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.gameType) setRoomGameType(body.gameType);
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
    const base = roomGameType === "read-the-room" ? "read-the-room" : "game";
    setLocation(`/${base}/${roomCode}/player?name=${encodeURIComponent(playerName.trim())}`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh] relative overflow-hidden" style={{ background: "#FFF5E7" }}>
      {/* Back arrow — top left */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
        <BackArrow />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-12">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div
            className="bg-white p-6 sm:p-8"
            style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
          >
            <h1 className="font-mono font-black text-center mb-6 uppercase text-4xl sm:text-5xl">
              Join Game
            </h1>

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
                  <div className="space-y-3 text-center">
                    <label className="font-mono font-black text-sm uppercase tracking-widest block">
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
                        className="text-center text-5xl sm:text-6xl font-mono font-black h-20 sm:h-24 tracking-[0.5em] bg-yellow-300 uppercase"
                        style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000", borderRadius: 0 }}
                        autoFocus
                        data-testid="input-room-code"
                      />
                    </Shake>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-lime-400 px-6 py-5 font-mono font-black text-2xl uppercase disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
                    disabled={roomCode.length !== 4 || isChecking}
                    data-testid="btn-check-code"
                  >
                    {isChecking ? "Checking…" : "Find Game"} <ArrowRight className="w-6 h-6" />
                  </button>
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
                  <div className="flex justify-center">
                    <div
                      className="bg-yellow-300 px-5 py-2 font-mono font-black text-black uppercase text-2xl tracking-[0.35em]"
                      style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000" }}
                    >
                      {roomCode}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-mono font-black text-sm uppercase tracking-widest block">
                      Your Nickname
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/60 w-5 h-5 z-10" />
                      <Input
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                        placeholder="Nickname"
                        autoComplete="nickname"
                        className="font-mono font-bold text-xl h-14 sm:h-16 pl-12 bg-yellow-50"
                        style={{ border: "5px solid #000", boxShadow: "5px 5px 0 #000", borderRadius: 0 }}
                        autoFocus
                        data-testid="input-player-name"
                      />
                    </div>
                    <p className="font-mono text-xs text-black/60 text-right">{playerName.length}/15</p>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-lime-400 px-6 py-5 font-mono font-black text-2xl uppercase disabled:bg-gray-300 disabled:cursor-not-allowed"
                    style={{ border: "5px solid #000", boxShadow: "8px 8px 0 #000" }}
                    disabled={!playerName.trim()}
                    data-testid="btn-join-game"
                  >
                    Jump In! →
                  </button>
                  <button
                    type="button"
                    className="w-full bg-white px-6 py-3 font-mono font-black text-sm uppercase"
                    style={{ border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
                    onClick={() => setStep('code')}
                  >
                    ← Change Code
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
