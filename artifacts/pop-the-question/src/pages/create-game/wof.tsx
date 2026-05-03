import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch } from "@/lib/ownerId";
import { BackArrow } from "@/components/ui/BackArrow";

const WOF_CATEGORIES = [
  "Phrase",
  "Person",
  "Place",
  "Thing",
  "Title",
  "TV Show",
  "Movie",
  "Song Title",
  "Event",
  "Food & Drink",
  "Around the House",
  "On the Map",
  "Fun & Games",
];

interface WofPuzzle {
  answer: string;
  category: string;
  hint: string;
}

interface WofFormState {
  title: string;
  description: string;
  puzzles: WofPuzzle[];
}

function makeDefaultPuzzle(): WofPuzzle {
  return { answer: "", category: "Phrase", hint: "" };
}

function makeDefaultState(): WofFormState {
  return {
    title: "",
    description: "",
    puzzles: Array.from({ length: 10 }, makeDefaultPuzzle),
  };
}

interface FieldError {
  [key: string]: string;
}

function validateForm(form: WofFormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors["title"] = "Pack name is required.";
  if (form.puzzles.length < 10) errors["puzzles-count"] = "You need at least 10 puzzles.";
  if (form.puzzles.length > 50) errors["puzzles-count"] = "Maximum 50 puzzles.";
  form.puzzles.forEach((p, i) => {
    if (!p.answer.trim()) errors[`puzzle-${i}-answer`] = "Puzzle phrase is required.";
    if (!p.category.trim()) errors[`puzzle-${i}-category`] = "Category is required.";
  });
  return errors;
}

function BlankTilePreview({ phrase }: { phrase: string }) {
  const upper = phrase.toUpperCase();
  const words = upper.split(" ");
  return (
    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
      {words.map((word, wi) => (
        <div key={wi} className="flex gap-0.5">
          {word.split("").map((letter, li) => (
            /[A-Z]/.test(letter) ? (
              <div
                key={li}
                className="w-7 h-7 border-[2px] border-black bg-[#1565C0] flex items-center justify-center text-white font-display font-black text-xs"
              >
                _
              </div>
            ) : (
              <div key={li} className="w-4 flex items-end justify-center pb-1">
                <span className="font-display font-black text-xs text-black/40">{letter}</span>
              </div>
            )
          ))}
        </div>
      ))}
    </div>
  );
}

export default function WofCreator() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/create-game/wof/:id");
  const editId = matchEdit ? paramsEdit?.id : undefined;

  const { toast } = useToast();
  const [form, setForm] = useState<WofFormState>(makeDefaultState());
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    customGamesFetch<{ id: number; payload: unknown }>(`/custom-games/wof/${editId}`)
      .then((row) => {
        const p = row.payload as { title: string; description: string; puzzles: WofPuzzle[] };
        setForm({ title: p.title, description: p.description, puzzles: p.puzzles });
      })
      .catch(() => toast({ title: "Failed to load pack", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const updatePuzzle = (i: number, field: keyof WofPuzzle, value: string) => {
    setForm((prev) => {
      const puzzles = prev.puzzles.map((p, idx) =>
        idx === i ? { ...p, [field]: field === "answer" ? value.toUpperCase() : value } : p
      );
      return { ...prev, puzzles };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`puzzle-${i}-${field}`];
      return next;
    });
  };

  const addPuzzle = () => {
    if (form.puzzles.length >= 50) return;
    setForm((prev) => ({ ...prev, puzzles: [...prev.puzzles, makeDefaultPuzzle()] }));
  };

  const removePuzzle = (i: number) => {
    if (form.puzzles.length <= 1) return;
    setForm((prev) => ({ ...prev, puzzles: prev.puzzles.filter((_, idx) => idx !== i) }));
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
        id: editId ? `custom-w-${editId}` : `custom-w-${Date.now()}`,
        title: form.title.trim(),
        description: form.description.trim() || `Custom WoF: ${form.title.trim()}`,
        puzzles: form.puzzles.map((p) => ({
          answer: p.answer.trim().toUpperCase(),
          category: p.category,
          ...(p.hint.trim() ? { hint: p.hint.trim() } : {}),
        })),
      };
      if (editId) {
        await customGamesFetch(`/custom-games/wof/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customGamesFetch("/custom-games/wof", { method: "POST", body: JSON.stringify(payload) });
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
      <header className="relative bg-[#7C3AED] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            {editId ? "Edit WoF Pack" : "Create WoF Pack"}
          </h1>
          <p className="mt-2 text-sm font-bold text-white/80 font-sans">
            10–50 puzzles · auto-uppercased · live tile preview
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Pack name */}
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5">
            <label className="block font-display font-black text-lg uppercase mb-2">
              Pack Name <span className="text-[#FF1493]">*</span>
            </label>
            <input
              className={`w-full border-[3px] px-4 py-3 font-sans text-base focus:outline-none focus:border-[#7C3AED] ${errors["title"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
              placeholder="e.g. TV Classics"
              value={form.title}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, title: e.target.value }));
                setErrors((prev) => { const n = { ...prev }; delete n["title"]; return n; });
              }}
            />
            {errors["title"] && <p className="text-[#FF1493] text-sm font-bold mt-1">{errors["title"]}</p>}
          </div>

          {/* Puzzles */}
          <div className="bg-[#7C3AED] border-[4px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-white text-2xl uppercase">
                🧩 Puzzles ({form.puzzles.length}/50)
              </h2>
              <span className={`text-sm font-bold px-3 py-1 border-[2px] border-white/50 ${form.puzzles.length < 10 ? "bg-[#FF1493] text-white" : "bg-white/20 text-white"}`}>
                Min 10 required
              </span>
            </div>
            {errors["puzzles-count"] && (
              <p className="text-[#FFD700] text-sm font-bold mb-3 bg-black/20 px-3 py-2">{errors["puzzles-count"]}</p>
            )}

            <div className="space-y-3">
              <AnimatePresence>
                {form.puzzles.map((puzzle, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`bg-white border-[3px] ${errors[`puzzle-${i}-answer`] || errors[`puzzle-${i}-category`] ? "border-[#FF1493]" : "border-black"} shadow-[3px_3px_0_#000]`}
                  >
                    <div className="flex items-center justify-between px-4 py-2 border-b-[2px] border-black bg-[#FFF8E7]">
                      <span className="font-display font-black text-sm uppercase">Puzzle {i + 1}</span>
                      <button
                        onClick={() => removePuzzle(i)}
                        disabled={form.puzzles.length <= 1}
                        className="p-1 text-[#FF1493] disabled:opacity-30 hover:bg-[#FF1493]/10 rounded"
                        title="Remove puzzle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase text-black/60 mb-1">
                            Category <span className="text-[#FF1493]">*</span>
                          </label>
                          <select
                            className={`w-full border-[2px] px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#7C3AED] ${errors[`puzzle-${i}-category`] ? "border-[#FF1493]" : "border-black"}`}
                            value={puzzle.category}
                            onChange={(e) => updatePuzzle(i, "category", e.target.value)}
                          >
                            {WOF_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase text-black/60 mb-1">
                            Optional Hint
                          </label>
                          <input
                            className="w-full border-[2px] border-black px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#7C3AED]"
                            placeholder="e.g. It's a 90s sitcom"
                            value={puzzle.hint}
                            onChange={(e) => updatePuzzle(i, "hint", e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-black/60 mb-1">
                          Puzzle Phrase <span className="text-[#FF1493]">*</span>
                        </label>
                        <input
                          className={`w-full border-[2px] px-3 py-2 font-sans text-sm uppercase font-bold focus:outline-none focus:border-[#7C3AED] ${errors[`puzzle-${i}-answer`] ? "border-[#FF1493] bg-red-50" : "border-black bg-white"}`}
                          placeholder="THE FRESH PRINCE OF BEL-AIR"
                          value={puzzle.answer}
                          onChange={(e) => updatePuzzle(i, "answer", e.target.value)}
                        />
                        {errors[`puzzle-${i}-answer`] && (
                          <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`puzzle-${i}-answer`]}</p>
                        )}
                        {/* Live blank tile preview */}
                        {puzzle.answer && (
                          <div className="mt-2 bg-[#1565C0] border-[2px] border-black p-3">
                            <p className="text-white/60 text-xs font-bold uppercase mb-1">Live Preview</p>
                            <BlankTilePreview phrase={puzzle.answer} />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {form.puzzles.length < 50 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={addPuzzle}
                className="mt-4 w-full py-3 border-[3px] border-[#FFD700] bg-[#FFD700] text-black font-display font-black uppercase text-base flex items-center justify-center gap-2 shadow-[3px_3px_0_#000]"
              >
                <Plus className="w-5 h-5" /> Add Puzzle ({form.puzzles.length}/50)
              </motion.button>
            )}
          </div>

          {/* Save + back */}
          <div className="flex gap-4 flex-wrap">
            <Button
              className="font-display font-black uppercase text-lg px-10 py-5 bg-[#7C3AED] text-white border-[3px] border-black shadow-[5px_5px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : <><Save className="w-5 h-5" /> Save Pack</>}
            </Button>
            <BackArrow href="/my-games" label="My Custom Games" />
          </div>
        </div>
      </div>
    </div>
  );
}
