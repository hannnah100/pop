import { useState } from "react";
import { Loader2, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function UsernameSetupModal() {
  const { needsUsername, registerUsername, signOut, firebaseUser } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  if (!needsUsername || !firebaseUser) return null;

  const authProvider = (() => {
    const providerData = firebaseUser.providerData[0];
    if (!providerData) return "email";
    if (providerData.providerId === "google.com") return "google";
    if (providerData.providerId === "apple.com") return "apple";
    return "email";
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUsername(username.trim(), authProvider);
      toast({ title: "Welcome! 🎉", description: `You're signed in as @${username.trim()}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Couldn't set username", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(username.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-md bg-[#FFF8E7] border-[4px] border-black shadow-[8px_8px_0_#000]">
        {/* Header */}
        <div className="bg-[#FFD700] border-b-[4px] border-black px-6 py-4">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-black" />
            <h2 className="font-display text-2xl font-black text-black uppercase tracking-wide">Pick Your Username</h2>
          </div>
          <p className="font-sans text-sm text-black/70 mt-1">
            This appears on all leaderboards. Choose wisely!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username-input" className="font-bold text-sm uppercase">Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 font-mono text-sm">@</span>
              <Input
                id="username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="popstar99"
                maxLength={20}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="border-[2px] border-black pl-7 font-mono"
              />
            </div>
            <p className="text-xs text-black/50 font-sans">
              3–20 characters · Letters, numbers, _ and - only
            </p>
          </div>

          {username.trim().length > 0 && !isValid && (
            <div className="bg-red-50 border-[2px] border-red-400 px-3 py-2 text-sm text-red-700 font-sans">
              {username.trim().length < 3 ? "Too short — need at least 3 characters" :
               username.trim().length > 20 ? "Too long — max 20 characters" :
               "Only letters, numbers, _ and - are allowed"}
            </div>
          )}

          <Button
            type="submit"
            disabled={!isValid || loading}
            className="w-full font-display text-base uppercase tracking-wide"
            size="lg"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Set Username & Play
          </Button>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full text-sm text-black/40 hover:text-black font-sans underline"
          >
            Cancel sign-in
          </button>
        </form>
      </div>
    </div>
  );
}
