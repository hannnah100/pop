import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch } from "@/lib/ownerId";
import { BackArrow } from "@/components/ui/BackArrow";

interface PollQuestion {
  question: string;
}

interface PollFormState {
  title: string;
  description: string;
  questions: PollQuestion[];
}

function makeDefaultQuestion(): PollQuestion {
  return { question: "" };
}

function makeDefaultState(): PollFormState {
  return {
    title: "",
    description: "",
    questions: Array.from({ length: 5 }, makeDefaultQuestion),
  };
}

interface FieldError {
  [key: string]: string;
}

function validateForm(form: PollFormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors["title"] = "Pack name is required.";
  if (form.questions.length < 3) errors["questions-count"] = "You need at least 3 questions.";
  if (form.questions.length > 60) errors["questions-count"] = "Maximum 60 questions.";
  form.questions.forEach((q, i) => {
    if (!q.question.trim()) errors[`question-${i}`] = "Question text is required.";
  });
  return errors;
}

export default function PollCreator() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/create-game/poll/:id");
  const editId = matchEdit ? paramsEdit?.id : undefined;

  const { toast } = useToast();
  const [form, setForm] = useState<PollFormState>(makeDefaultState());
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    customGamesFetch<{ id: number; payload: unknown }>(`/custom-games/poll/${editId}`)
      .then((row) => {
        const p = row.payload as { title: string; description: string; questions: PollQuestion[] };
        setForm({ title: p.title, description: p.description, questions: p.questions });
      })
      .catch(() => toast({ title: "Failed to load pack", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const updateQuestion = (i: number, value: string) => {
    setForm((prev) => {
      const questions = prev.questions.map((q, idx) =>
        idx === i ? { question: value } : q,
      );
      return { ...prev, questions };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`question-${i}`];
      return next;
    });
  };

  const addQuestion = () => {
    if (form.questions.length >= 60) return;
    setForm((prev) => ({ ...prev, questions: [...prev.questions, makeDefaultQuestion()] }));
  };

  const removeQuestion = (i: number) => {
    if (form.questions.length <= 1) return;
    setForm((prev) => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== i) }));
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
        id: editId ? `custom-poll-${editId}` : `custom-poll-${Date.now()}`,
        title: form.title.trim(),
        description: form.description.trim() || `Custom Poll: ${form.title.trim()}`,
        questions: form.questions.map((q) => ({ question: q.question.trim() })),
      };
      if (editId) {
        await customGamesFetch(`/custom-games/poll/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customGamesFetch("/custom-games/poll", { method: "POST", body: JSON.stringify(payload) });
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
      <header className="relative bg-[#FF1493] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            {editId ? "Edit Poll Pack" : "Create Poll Pack"}
          </h1>
          <p className="mt-2 text-sm font-bold text-white/80 font-sans">
            3–60 voting questions · "Most likely to…" prompts
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
              className={`w-full border-[3px] px-4 py-3 font-sans text-base focus:outline-none focus:border-[#FF1493] ${errors["title"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
              placeholder="e.g. Friend Group Roast"
              value={form.title}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, title: e.target.value }));
                setErrors((prev) => { const n = { ...prev }; delete n["title"]; return n; });
              }}
            />
            {errors["title"] && <p className="text-[#FF1493] text-sm font-bold mt-1">{errors["title"]}</p>}
          </div>

          {/* Questions */}
          <div className="bg-[#FF1493] border-[4px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-white text-2xl uppercase">
                🗳️ Questions ({form.questions.length}/60)
              </h2>
              <span className={`text-sm font-bold px-3 py-1 border-[2px] border-white/50 ${form.questions.length < 3 ? "bg-[#FFD700] text-black" : "bg-white/20 text-white"}`}>
                Min 3 required
              </span>
            </div>
            {errors["questions-count"] && (
              <p className="text-[#FFD700] text-sm font-bold mb-3 bg-black/20 px-3 py-2">{errors["questions-count"]}</p>
            )}

            <div className="space-y-3">
              <AnimatePresence>
                {form.questions.map((q, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`bg-white border-[3px] ${errors[`question-${i}`] ? "border-[#FFD700]" : "border-black"} shadow-[3px_3px_0_#000]`}
                  >
                    <div className="flex items-center justify-between px-4 py-2 border-b-[2px] border-black bg-[#FFF8E7]">
                      <span className="font-display font-black text-sm uppercase">Question {i + 1}</span>
                      <button
                        onClick={() => removeQuestion(i)}
                        disabled={form.questions.length <= 1}
                        className="p-1 text-[#FF1493] disabled:opacity-30 hover:bg-[#FF1493]/10 rounded"
                        title="Remove question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      <input
                        className={`w-full border-[2px] px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#FF1493] ${errors[`question-${i}`] ? "border-[#FFD700] bg-red-50" : "border-black bg-white"}`}
                        placeholder="Most likely to…"
                        value={q.question}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                      />
                      {errors[`question-${i}`] && (
                        <p className="text-[#FF1493] text-xs font-bold mt-1">{errors[`question-${i}`]}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {form.questions.length < 60 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={addQuestion}
                className="mt-4 w-full py-3 border-[3px] border-[#FFD700] bg-[#FFD700] text-black font-display font-black uppercase text-base flex items-center justify-center gap-2 shadow-[3px_3px_0_#000]"
              >
                <Plus className="w-5 h-5" /> Add Question ({form.questions.length}/60)
              </motion.button>
            )}
          </div>

          {/* Save + back */}
          <div className="flex gap-4 flex-wrap">
            <Button
              className="font-display font-black uppercase text-lg px-10 py-5 bg-[#FF1493] text-white border-[3px] border-black shadow-[5px_5px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
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
