import { useState } from "react";
import { X, Mail, Eye, EyeOff, Loader2, Apple } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Tab = "choose" | "email-signin" | "email-signup";

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signInWithGoogle, signInWithApple, signInWithEmail, createEmailAccount } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!showAuthModal) return null;

  async function handle(fn: () => Promise<void>) {
    setLoading(true);
    try {
      await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Sign-in failed", description: friendlyError(msg), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function friendlyError(msg: string): string {
    if (msg.includes("popup-closed")) return "Sign-in window was closed.";
    if (msg.includes("canceled") || msg.includes("cancelled")) return "Sign-in was canceled.";
    if (msg.includes("apple") && msg.includes("not return")) return "Apple did not return credentials. Try again.";
    if (msg.includes("auth/invalid-email")) return "Invalid email address.";
    if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) return "Incorrect email or password.";
    if (msg.includes("auth/email-already-in-use")) return "An account with this email already exists.";
    if (msg.includes("auth/weak-password")) return "Password must be at least 6 characters.";
    if (msg.includes("auth/user-not-found")) return "No account found with that email.";
    return msg;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div
        className="relative w-full max-w-md bg-[#FFF8E7] border-[4px] border-black shadow-[8px_8px_0_#000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FF1493] border-b-[4px] border-black px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-black text-white uppercase tracking-wide">
            {tab === "email-signup" ? "Create Account" : tab === "email-signin" ? "Sign In" : "Sign Up / Log In"}
          </h2>
          <button
            onClick={closeAuthModal}
            className="w-8 h-8 flex items-center justify-center border-[2px] border-white text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          {tab === "choose" && (
            <>
              <p className="font-sans text-sm text-black/70">Save your username, sync scores, and access your custom games from any device.</p>

              {/* Apple — listed first per Apple HIG when Sign in with Apple is offered alongside other providers. */}
              <button
                onClick={() => handle(signInWithApple)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 border-[3px] border-black bg-black text-white hover:bg-zinc-900 shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-display font-black text-base uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Apple className="w-5 h-5" />}
                Continue with Apple
              </button>

              {/* Google */}
              <button
                onClick={() => handle(signInWithGoogle)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 border-[3px] border-black bg-white hover:bg-gray-50 shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-display font-black text-base uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-[2px] bg-black/20" />
                <span className="text-xs font-bold text-black/40 uppercase">or</span>
                <div className="flex-1 h-[2px] bg-black/20" />
              </div>

              {/* Email */}
              <button
                onClick={() => setTab("email-signin")}
                className="w-full flex items-center gap-3 px-4 py-3 border-[3px] border-black bg-[#FFD700] hover:bg-[#ffc800] shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-display font-black text-base uppercase tracking-wide"
              >
                <Mail className="w-5 h-5" />
                Continue with Email
              </button>

              <p className="text-center text-xs text-black/50 font-sans">
                By signing up, you agree to our terms of service.
              </p>
            </>
          )}

          {(tab === "email-signin" || tab === "email-signup") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tab === "email-signin") {
                  handle(() => signInWithEmail(email, password));
                } else {
                  handle(() => createEmailAccount(email, password));
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="auth-email" className="font-bold text-sm uppercase">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="border-[2px] border-black"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="auth-password" className="font-bold text-sm uppercase">Password</Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={tab === "email-signup" ? "new-password" : "current-password"}
                    className="border-[2px] border-black pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-display text-base uppercase tracking-wide"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {tab === "email-signin" ? "Sign In" : "Create Account"}
              </Button>

              <div className="flex items-center justify-between text-sm font-sans">
                <button type="button" onClick={() => setTab("choose")} className="text-black/50 hover:text-black underline">
                  ← Back
                </button>
                {tab === "email-signin" ? (
                  <button type="button" onClick={() => setTab("email-signup")} className="text-[#FF1493] hover:underline font-bold">
                    Create account →
                  </button>
                ) : (
                  <button type="button" onClick={() => setTab("email-signin")} className="text-[#FF1493] hover:underline font-bold">
                    Already have one →
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
