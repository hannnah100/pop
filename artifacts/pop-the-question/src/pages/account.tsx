import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut, Edit2, User, Loader2, CheckCircle2, Trash2, CalendarDays, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";

export default function AccountPage() {
  const { user, firebaseUser, loading, signOut, updateUsername, registerUsername, deleteAccount, openAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isValidUsername = /^[a-zA-Z0-9_-]{3,20}$/.test(usernameInput.trim());

  function getValidationError(value: string): string {
    const v = value.trim();
    if (v.length === 0) return "";
    if (v.length < 3) return "Too short — need at least 3 characters";
    if (v.length > 20) return "Too long — max 20 characters";
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return "Only letters, numbers, _ and - are allowed";
    return "";
  }

  function handleUsernameInputChange(value: string) {
    setUsernameInput(value);
    setUsernameError(getValidationError(value));
  }

  async function handleUsernameSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    const err = getValidationError(trimmed);
    if (err) { setUsernameError(err); return; }
    setSaving(true);
    setUsernameError("");
    try {
      if (!user) {
        const providerData = firebaseUser!.providerData?.[0];
        const authProvider = providerData?.providerId === "google.com" ? "google"
          : providerData?.providerId === "apple.com" ? "apple"
          : "email";
        await registerUsername(trimmed, authProvider);
        toast({ title: "Username set!", description: `Welcome, @${trimmed}!` });
      } else {
        await updateUsername(trimmed);
        setEditingUsername(false);
        toast({ title: "Username updated!", description: `Now showing as @${trimmed}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setUsernameError(msg.includes("taken") || msg.includes("exist") ? "That username is already taken" : msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setLocation("/");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      setLocation("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Couldn't delete account", description: msg, variant: "destructive" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF1493]" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <BackArrow className="mb-8" />
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-8 text-center space-y-4">
          <User className="w-12 h-12 text-black/30 mx-auto" />
          <h1 className="font-display text-3xl font-black uppercase">Your Account</h1>
          <p className="text-black/60 font-sans">Sign in to save your username, sync scores, and access your custom games from any device.</p>
          <Button onClick={openAuthModal} size="lg" className="font-display text-base uppercase tracking-wide">
            Sign Up / Log In
          </Button>
        </div>
      </div>
    );
  }

  const providerData = firebaseUser.providerData?.[0];
  const derivedProvider = providerData?.providerId === "google.com" ? "google"
    : providerData?.providerId === "apple.com" ? "apple"
    : "email";
  const providerLabel = (user?.authProvider ?? derivedProvider) === "google" ? "Google"
    : (user?.authProvider ?? derivedProvider) === "apple" ? "Apple"
    : "Email";
  const displayUsername = user?.username ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Player";
  const displayEmail = user?.email ?? firebaseUser.email ?? "";
  const displayPhoto = user?.photoURL ?? firebaseUser.photoURL;
  const creationDate = firebaseUser.metadata.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const showCreateForm = !user;
  const showEditForm = user && editingUsername;
  const showUsernameDisplay = user && !editingUsername;

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
      <BackArrow className="mb-8" />

      {/* Hero */}
      <div className="relative bg-[#FF1493] border-[4px] border-black shadow-[6px_6px_0_#000] px-6 py-6 mb-6 overflow-hidden">
        <StarDoodle className="absolute top-3 right-6 w-8 h-8 text-white opacity-40" />
        <LightningDoodle className="absolute bottom-3 right-14 w-6 h-10 text-[#FFD700] opacity-50" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#FFD700] border-[3px] border-black flex items-center justify-center shrink-0">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayUsername} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="font-display text-2xl font-black text-black uppercase">
                {displayUsername[0]}
              </span>
            )}
          </div>
          <div>
            <p className="font-display text-2xl font-black text-white uppercase tracking-tight">
              {user ? `@${user.username}` : firebaseUser.displayName ?? "New User"}
            </p>
            <p className="text-white/70 font-sans text-sm">{displayEmail || "No email"}</p>
            <p className="text-white/50 font-sans text-xs mt-0.5">Signed in with {providerLabel}</p>
          </div>
        </div>
      </div>

      {/* Username section */}
      <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-black uppercase">Username</h2>
          {showUsernameDisplay && (
            <button
              onClick={() => { setUsernameInput(user.username); setUsernameError(""); setEditingUsername(true); }}
              className="flex items-center gap-1 text-sm font-bold text-[#FF1493] hover:underline"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {showUsernameDisplay && (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg">@{user.username}</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
        )}

        {(showCreateForm || showEditForm) && (
          <form onSubmit={handleUsernameSave} className="space-y-3">
            {showCreateForm && (
              <p className="text-sm text-black/60 font-sans mb-2">
                Choose a username to appear on leaderboards and save your scores.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="username-input" className="font-bold text-sm uppercase">
                {showCreateForm ? "Choose a Username" : "New Username"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 font-mono text-sm">@</span>
                <Input
                  id="username-input"
                  value={usernameInput}
                  onChange={(e) => handleUsernameInputChange(e.target.value)}
                  placeholder={showCreateForm ? "popstar99" : ""}
                  maxLength={20}
                  autoFocus={showCreateForm}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="border-[2px] border-black pl-7 font-mono"
                />
              </div>
              <p className="text-xs text-black/50 font-sans">3–20 characters · Letters, numbers, _ and - only</p>
            </div>

            {usernameError && (
              <div className="flex items-center gap-2 bg-red-50 border-[2px] border-red-400 px-3 py-2 text-sm text-red-700 font-sans">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {usernameError}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={!isValidUsername || saving} className="font-display text-sm uppercase">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {showCreateForm ? "Set Username" : "Save"}
              </Button>
              {showEditForm && (
                <Button type="button" variant="outline" onClick={() => { setEditingUsername(false); setUsernameError(""); }} className="font-display text-sm uppercase border-[2px] border-black">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Leaderboard info — only once username is set */}
      {user && (
        <div className="bg-[#FFF8E7] border-[3px] border-black shadow-[4px_4px_0_#000] p-4 mb-4">
          <h2 className="font-display text-base font-black uppercase mb-1">Leaderboard Name</h2>
          <p className="font-sans text-sm text-black/70">
            Your username <span className="font-bold text-black">@{user.username}</span> shows on all leaderboards —
            Three Flops, Pop Box, Clock It, and more.
          </p>
        </div>
      )}

      {/* My scores / history shortcut */}
      <div
        className="bg-[#00E5FF] border-[3px] border-black shadow-[4px_4px_0_#000] p-4 mb-4 cursor-pointer hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        onClick={() => setLocation("/stats")}
      >
        <h2 className="font-display text-base font-black uppercase">My Scores / History</h2>
        <p className="font-sans text-sm text-black/70 mt-0.5">
          View your game history, streaks, and personal stats across all daily games.
        </p>
      </div>

      {/* My custom games shortcut */}
      <div
        className="bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-4 mb-6 cursor-pointer hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        onClick={() => setLocation("/my-games")}
      >
        <h2 className="font-display text-base font-black uppercase">My Custom Games</h2>
        <p className="font-sans text-sm text-black/70 mt-0.5">
          Your saved Pop Quiz, Wheel of Fandom, and Bar Trivia packs — accessible from any device.
        </p>
      </div>

      {/* Account created date */}
      {creationDate && (
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4 mb-4 flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-black/40 shrink-0" />
          <div>
            <p className="font-display text-sm font-black uppercase text-black/50">Member since</p>
            <p className="font-sans text-base font-bold text-black">{creationDate}</p>
          </div>
        </div>
      )}

      {/* Sign out */}
      <Button
        variant="outline"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full border-[3px] border-black font-display text-base uppercase tracking-wide hover:bg-red-50 hover:border-red-500 hover:text-red-600 mb-4"
      >
        {signingOut ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
        Sign Out
      </Button>

      {/* Danger zone */}
      <div className="border-[3px] border-red-500 shadow-[4px_4px_0_#ef4444] p-4">
        <h2 className="font-display text-base font-black uppercase text-red-600 mb-1">Danger Zone</h2>
        <p className="font-sans text-sm text-black/60 mb-3">Permanently deletes your account and all saved data. This cannot be undone.</p>
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="font-sans text-sm font-bold text-red-600">Are you absolutely sure? This will delete everything.</p>
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-red-600 text-white border-[2px] border-red-800 font-display text-sm uppercase hover:bg-red-700"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Yes, Delete Everything
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="font-display text-sm uppercase border-[2px] border-black"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="border-[2px] border-red-500 text-red-600 font-display text-sm uppercase hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        )}
      </div>
    </div>
  );
}
