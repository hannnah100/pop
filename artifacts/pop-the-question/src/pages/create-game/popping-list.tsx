import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch } from "@/lib/ownerId";
import { BackArrow } from "@/components/ui/BackArrow";

const SAFE_LETTERS = ["A","B","C","D","F","G","H","J","K","L","M","N","P","R","S","T","W"];
const CATEGORIES_PER_ROUND = 10;

interface PoppingRound {
  letter: string;
  categories: string[];
}

interface PoppingFormState {
  title: string;
  description: string;
  rounds: PoppingRound[];
}

function makeDefaultRound(): PoppingRound {
  return {
    letter: SAFE_LETTERS[Math.floor(Math.random() * SAFE_LETTERS.length)] ?? "A",
    categories: Array.from({ length: CATEGORIES_PER_ROUND }, () => ""),
  };
}

function makeDefaultState(): PoppingFormState {
  return {
    title: "",
    description: "",
    rounds: [makeDefaultRound(), makeDefaultRound(), makeDefaultRound()],
  };
}

interface FieldError {
  [key: string]: string;
}

function validateForm(form: PoppingFormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors["title"] = "Pack name is required.";
  if (form.rounds.length < 3) errors["rounds-count"] = "At least 3 rounds required.";
  if (form.rounds.length > 5) errors["rounds-count"] = "Maximum 5 rounds.";
  form.rounds.forEach((r, ri) => {
    if (!/^[A-Z]$/.test(r.letter)) errors[`round-${ri}-letter`] = "Letter must be a single A–Z.";
    r.categories.forEach((c, ci) => {
      if (!c.trim()) errors[`r${ri}-c${ci}`] = "Category required.";
    });
  });
  return errors;
}

export default function PoppingListCreator() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/create-game/popping-list/:id");
  const editId = matchEdit ? paramsEdit?.id : undefined;

  const { toast } = useToast();
  const [form, setForm] = useState<PoppingFormState>(makeDefaultState());
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    customGamesFetch<{ id: number; payload: unknown }>(`/custom-games/scattergories/${editId}`)
      .then((row) => {
        const p = row.payload as { title: string; description: string; rounds: PoppingRound[] };
        setForm({ title: p.title, description: p.description, rounds: p.rounds });
      })
      .catch(() => toast({ title: "Failed to load pack", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const setRoundLetter = (ri: number, value: string) => {
    const upper = value.toUpperCase().slice(0, 1);
    setForm((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r, idx) => (idx === ri ? { ...r, letter: upper } : r)),
    }));
    setErrors((prev) => { const n = { ...prev }; delete n[`round-${ri}-letter`]; return n; });
  };

  const setCategory = (ri: number, ci: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r, idx) =>
        idx === ri ? { ...r, categories: r.categories.map((c, cIdx) => (cIdx === ci ? value : c)) } : r,
      ),
    }));
    setErrors((prev) => { const n = { ...prev }; delete n[`r${ri}-c${ci}`]; return n; });
  };

  const addRound = () => {
    if (form.rounds.length >= 5) return;
    setForm((prev) => ({ ...prev, rounds: [...prev.rounds, makeDefaultRound()] }));
  };

  const removeRound = (ri: number) => {
    if (form.rounds.length <= 1) return;
    setForm((prev) => ({ ...prev, rounds: prev.rounds.filter((_, idx) => idx !== ri) }));
  };

  const handleSave = async () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({ title: "Please fix the errors below", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editId ? `custom-scat-${editId}` : `custom-scat-${Date.now()}`,
        title: form.title.trim(),
        description: form.description.trim() || `Custom Popping List: ${form.title.trim()}`,
        rounds: form.rounds.map((r) => ({
          letter: r.letter.toUpperCase(),
          categories: r.categories.map((c) => c.trim()),
        })),
      };
      if (editId) {
        await customGamesFetch(`/custom-games/scattergories/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customGamesFetch("/custom-games/scattergories", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editId ? "Pack updated!" : "Pack saved!", description: "Find it in My Custom Games." });
      setLocation("/my-games");
    } catch (e: unknown) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8E7]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">
      <header className="relative bg-[#1565C0] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            {editId ? "Edit Popping List Pack" : "Create Popping List Pack"}
          </h1>
          <p className="mt-2 text-sm font-bold text-white/80 font-sans">
            3–5 rounds · 10 categories per round · pick a letter
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Pack name */}
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5">
            <label className="block font-display font-black text-lg uppercase mb-2">
              Pack Name <span className="text-[#1565C0]">*</span>
            </label>
            <input
              className={`w-full border-[3px] px-4 py-3 font-sans text-base focus:outline-none focus:border-[#1565C0] ${errors["title"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
              placeholder="e.g. Pop Culture Mix"
              value={form.title}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, title: e.target.value }));
                setErrors((prev) => { const n = { ...prev }; delete n["title"]; return n; });
              }}
            />
            {errors["title"] && <p className="text-[#FF1493] text-sm font-bold mt-1">{errors["title"]}</p>}
          </div>

          {/* Rounds */}
          <div className="bg-[#1565C0] border-[4px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-white text-2xl uppercase">
                📝 Rounds ({form.rounds.length}/5)
              </h2>
              <span className={`text-sm font-bold px-3 py-1 border-[2px] border-white/50 ${form.rounds.length < 3 ? "bg-[#FFD700] text-black" : "bg-white/20 text-white"}`}>
                Min 3 required
              </span>
            </div>
            {errors["rounds-count"] && (
              <p className="text-[#FFD700] text-sm font-bold mb-3 bg-black/20 px-3 py-2">{errors["rounds-count"]}</p>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {form.rounds.map((round, ri) => (
                  <motion.div
                    key={ri}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white border-[3px] border-black shadow-[3px_3px_0_#000]"
                  >
                    <div className="flex items-center justify-between px-4 py-2 border-b-[2px] border-black bg-[#FFF8E7]">
                      <span className="font-display font-black text-sm uppercase">Round {ri + 1}</span>
                      <button
                        onClick={() => removeRound(ri)}
                        disabled={form.rounds.length <= 1}
                        className="p-1 text-[#FF1493] disabled:opacity-30 hover:bg-[#FF1493]/10 rounded"
                        title="Remove round"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase text-black/60 mb-1">
                          Letter <span className="text-[#FF1493]">*</span>
                        </label>
                        <select
                          className={`w-24 border-[2px] px-3 py-2 font-display font-black text-2xl text-center bg-white focus:outline-none focus:border-[#1565C0] ${errors[`round-${ri}-letter`] ? "border-[#FF1493]" : "border-black"}`}
                          value={round.letter}
                          onChange={(e) => setRoundLetter(ri, e.target.value)}
                        >
                          {SAFE_LETTERS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                        {errors[`round-${ri}-letter`] && (
                          <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`round-${ri}-letter`]}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-black/60 mb-1">
                          Categories ({CATEGORIES_PER_ROUND}) <span className="text-[#FF1493]">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {round.categories.map((cat, ci) => (
                            <input
                              key={ci}
                              className={`border-[2px] px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#1565C0] ${errors[`r${ri}-c${ci}`] ? "border-[#FF1493] bg-red-50" : "border-black bg-white"}`}
                              placeholder={`Category ${ci + 1}`}
                              value={cat}
                              onChange={(e) => setCategory(ri, ci, e.target.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {form.rounds.length < 5 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={addRound}
                className="mt-4 w-full py-3 border-[3px] border-[#FFD700] bg-[#FFD700] text-black font-display font-black uppercase text-base flex items-center justify-center gap-2 shadow-[3px_3px_0_#000]"
              >
                <Plus className="w-5 h-5" /> Add Round ({form.rounds.length}/5)
              </motion.button>
            )}
          </div>

          {/* Save + back */}
          <div className="flex gap-4 flex-wrap">
            <Button
              className="font-display font-black uppercase text-lg px-10 py-5 bg-[#1565C0] text-white border-[3px] border-black shadow-[5px_5px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : <><Save className="w-5 h-5" /> Save Pack</>}
            </Button>
            <BackArrow href="/my-games" label="My Custom Games" />
            <Button
              variant="outline"
              className="font-display font-black uppercase text-base px-6 py-5 border-[3px] border-black bg-white text-black/60 shadow-[3px_3px_0_#000] hover:bg-[#FFF8E7] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              onClick={() => setLocation("/")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
