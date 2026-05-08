import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut, Edit2, User, Loader2, CheckCircle2, Trash2, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";

export default function AccountPage() {
  const { user, firebaseUser, loading, signOut, updateUsername, deleteAccount, openAuthModal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(newUsername.trim());

  async function handleUsernameUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUsername(newUsername.trim());
      setEditingUsername(false);
      toast({ title: "Username updated!", description: `Now showing as @${newUsername.trim()}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Couldn't update username", description: msg, variant: "destructive" });
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

  if (!user || !firebaseUser) {
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

  const providerLabel = user.authProvider === "google" ? "Google" : user.authProvider === "apple" ? "Apple" : "Email";
  const creationDate = firebaseUser.metadata.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
      <BackArrow className="mb-8" />

      {/* Hero */}
      <div className="relative bg-[#FF1493] border-[4px] border-black shadow-[6px_6px_0_#000] px-6 py-6 mb-6 overflow-hidden">
        <StarDoodle className="absolute top-3 right-6 w-8 h-8 text-white opacity-40" />
        <LightningDoodle className="absolute bottom-3 right-14 w-6 h-10 text-[#FFD700] opacity-50" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#FFD700] border-[3px] border-black flex items-center justify-center shrink-0">
            {firebaseUser.photoURL ? (
              <img src={firebaseUser.photoURL} alt={user.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="font-display text-2xl font-black text-black uppercase">
                {user.username[0]}
              </span>
            )}
          </div>
          <div>
            <p className="font-display text-2xl font-black text-white uppercase tracking-tight">@{user.username}</p>
            <p className="text-white/70 font-sans text-sm">{user.email ?? firebaseUser.email ?? "No email"}</p>
            <p className="text-white/50 font-sans text-xs mt-0.5">Signed in with {providerLabel}</p>
          </div>
        </div>
      </div>

      {/* Username section */}
      <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-black uppercase">Username</h2>
          {!editingUsername && (
            <button
              onClick={() => { setNewUsername(user.username); setEditingUsername(true); }}
              className="flex items-center gap-1 text-sm font-bold text-[#FF1493] hover:underline"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {editingUsername ? (
          <form onSubmit={handleUsernameUpdate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-username" className="font-bold text-sm uppercase">New Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 font-mono text-sm">@</span>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="border-[2px] border-black pl-7 font-mono"
                />
              </div>
              <p className="text-xs text-black/50 font-sans">3–20 characters · Letters, numbers, _ and - only</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!isValid || saving} className="font-display text-sm uppercase">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingUsername(false)} className="font-display text-sm uppercase border-[2px] border-black">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg">@{user.username}</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
        )}
      </div>

      {/* Leaderboard info */}
      <div className="bg-[#FFF8E7] border-[3px] border-black shadow-[4px_4px_0_#000] p-4 mb-4">
        <h2 className="font-display text-base font-black uppercase mb-1">Leaderboard Name</h2>
        <p className="font-sans text-sm text-black/70">
          Your username <span className="font-bold text-black">@{user.username}</span> shows on all leaderboards —
          Three Flops, Pop Box, Clock It, and more.
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
