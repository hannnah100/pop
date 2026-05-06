import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch } from "@/lib/ownerId";
import { BackArrow } from "@/components/ui/BackArrow";

type RoundType = "multiple-choice" | "open-ended" | "true-false";

interface MCQuestion {
  type: "multiple-choice";
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  doublePoints: boolean;
}
interface OEQuestion {
  type: "open-ended";
  prompt: string;
  acceptedAnswers: string[];
  doublePoints: boolean;
}
interface TFQuestion {
  type: "true-false";
  prompt: string;
  answer: boolean;
  doublePoints: boolean;
}
type QuizQuestion = MCQuestion | OEQuestion | TFQuestion;

interface QuizRound {
  name: string;
  roundType: RoundType;
  questions: QuizQuestion[];
}

interface QuizFormState {
  title: string;
  description: string;
  rounds: QuizRound[];
}

function makeDefaultMCQ(): MCQuestion {
  return { type: "multiple-choice", prompt: "", options: ["", "", "", ""], correctIndex: 0, doublePoints: false };
}
function makeDefaultOEQ(): OEQuestion {
  return { type: "open-ended", prompt: "", acceptedAnswers: [""], doublePoints: false };
}
function makeDefaultTFQ(): TFQuestion {
  return { type: "true-false", prompt: "", answer: true, doublePoints: false };
}
function makeDefaultQuestion(type: RoundType): QuizQuestion {
  if (type === "multiple-choice") return makeDefaultMCQ();
  if (type === "open-ended") return makeDefaultOEQ();
  return makeDefaultTFQ();
}
function makeDefaultRound(): QuizRound {
  return { name: "", roundType: "multiple-choice", questions: Array.from({ length: 5 }, makeDefaultMCQ) };
}
function makeDefaultState(): QuizFormState {
  return { title: "", description: "", rounds: [makeDefaultRound(), makeDefaultRound(), makeDefaultRound()] };
}

interface FieldError { [key: string]: string }

function validateForm(form: QuizFormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors["title"] = "Quiz name is required.";
  if (form.rounds.length < 3) errors["rounds-count"] = "Minimum 3 rounds required.";
  if (form.rounds.length > 7) errors["rounds-count"] = "Maximum 7 rounds.";
  form.rounds.forEach((round, ri) => {
    if (!round.name.trim()) errors[`round-${ri}-name`] = "Round name required.";
    if (round.questions.length < 5) errors[`round-${ri}-q-count`] = "Min 5 questions per round.";
    if (round.questions.length > 20) errors[`round-${ri}-q-count`] = "Max 20 questions per round.";
    round.questions.forEach((q, qi) => {
      if (!q.prompt.trim()) errors[`r${ri}-q${qi}-prompt`] = "Question prompt required.";
      if (q.type === "multiple-choice") {
        q.options.forEach((opt, oi) => {
          if (!opt.trim()) errors[`r${ri}-q${qi}-opt${oi}`] = "Option required.";
        });
      }
      if (q.type === "open-ended") {
        if (!q.acceptedAnswers[0]?.trim()) errors[`r${ri}-q${qi}-ans0`] = "At least one accepted answer required.";
      }
    });
  });
  return errors;
}

export default function QuizCreator() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/create-game/quiz/:id");
  const editId = matchEdit ? paramsEdit?.id : undefined;

  const { toast } = useToast();
  const [form, setForm] = useState<QuizFormState>(makeDefaultState());
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [collapsedRounds, setCollapsedRounds] = useState<boolean[]>([true, true, true]);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!editId) return;
    customGamesFetch<{ payload: unknown }>(`/custom-games/quiz/${editId}`)
      .then((row) => {
        const p = row.payload as QuizFormState;
        setForm(p);
        setCollapsedRounds(Array(p.rounds.length).fill(true));
      })
      .catch(() => toast({ title: "Failed to load pack", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const updateForm = (updater: (prev: QuizFormState) => QuizFormState) => {
    setForm(updater);
  };

  const setRoundField = (ri: number, field: keyof QuizRound, value: unknown) => {
    updateForm((prev) => {
      const rounds = prev.rounds.map((r, idx) => {
        if (idx !== ri) return r;
        if (field === "roundType") {
          const newType = value as RoundType;
          return { ...r, roundType: newType, questions: r.questions.map(() => makeDefaultQuestion(newType)) };
        }
        return { ...r, [field]: value };
      });
      return { ...prev, rounds };
    });
    setErrors((prev) => { const n = { ...prev }; delete n[`round-${ri}-${String(field)}`]; return n; });
  };

  const setQuestionField = (ri: number, qi: number, updater: (q: QuizQuestion) => QuizQuestion) => {
    updateForm((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r, rIdx) =>
        rIdx !== ri ? r : { ...r, questions: r.questions.map((q, qIdx) => qIdx !== qi ? q : updater(q)) }
      ),
    }));
  };

  const addRound = () => {
    if (form.rounds.length >= 7) return;
    updateForm((prev) => ({ ...prev, rounds: [...prev.rounds, makeDefaultRound()] }));
    setCollapsedRounds((prev) => [...prev, false]);
  };

  const removeRound = (ri: number) => {
    if (form.rounds.length <= 1) return;
    updateForm((prev) => ({ ...prev, rounds: prev.rounds.filter((_, idx) => idx !== ri) }));
    setCollapsedRounds((prev) => prev.filter((_, idx) => idx !== ri));
  };

  const addQuestion = (ri: number) => {
    const round = form.rounds[ri]!;
    if (round.questions.length >= 20) return;
    setRoundField(ri, "questions", [...round.questions, makeDefaultQuestion(round.roundType)]);
  };

  const removeQuestion = (ri: number, qi: number) => {
    const round = form.rounds[ri]!;
    if (round.questions.length <= 1) return;
    setRoundField(ri, "questions", round.questions.filter((_, idx) => idx !== qi));
  };

  const handleSave = async () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setCollapsedRounds(Array(form.rounds.length).fill(false));
      toast({ title: "Please fix the errors below", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editId ? `custom-q-${editId}` : `custom-q-${Date.now()}`,
        title: form.title.trim(),
        description: form.description.trim() || `Custom Quiz: ${form.title.trim()}`,
        rounds: form.rounds.map((r) => ({
          name: r.name.trim(),
          roundType: r.roundType,
          questions: r.questions.map((q) => {
            if (q.type === "multiple-choice") return { type: q.type, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()) as [string,string,string,string], correctIndex: q.correctIndex, ...(q.doublePoints ? { doublePoints: true } : {}) };
            if (q.type === "open-ended") return { type: q.type, prompt: q.prompt.trim(), acceptedAnswers: q.acceptedAnswers.filter((a) => a.trim()), ...(q.doublePoints ? { doublePoints: true } : {}) };
            return { type: q.type, prompt: q.prompt.trim(), answer: q.answer, ...(q.doublePoints ? { doublePoints: true } : {}) };
          }),
        })),
      };
      if (editId) {
        await customGamesFetch(`/custom-games/quiz/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customGamesFetch("/custom-games/quiz", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editId ? "Quiz updated!" : "Quiz saved!", description: "Find it in My Custom Games." });
      setLocation("/my-games");
    } catch (e: unknown) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const ROUND_TYPE_COLORS: Record<RoundType, string> = {
    "multiple-choice": "#00C853",
    "open-ended": "#FF6B35",
    "true-false": "#1565C0",
  };

  const renderQuestion = (q: QuizQuestion, ri: number, qi: number) => {
    const hasPromptError = !!errors[`r${ri}-q${qi}-prompt`];
    return (
      <div key={qi} className="bg-white border-[2px] border-black shadow-[2px_2px_0_#000] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display font-black text-xs uppercase text-black/60">Q{qi + 1}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={(q as MCQuestion).doublePoints ?? false}
                onChange={(e) => setQuestionField(ri, qi, (prev) => ({ ...prev, doublePoints: e.target.checked } as QuizQuestion))}
                className="w-3.5 h-3.5 border-[2px] border-black"
              />
              <span className="text-xs font-bold text-[#FF6B35] uppercase">2x Points</span>
            </label>
            <button
              onClick={() => removeQuestion(ri, qi)}
              className="text-[#FF1493] hover:bg-[#FF1493]/10 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <textarea
          rows={2}
          placeholder="Question prompt…"
          className={`w-full border-[2px] px-2 py-1.5 font-sans text-sm resize-none focus:outline-none mb-2 ${hasPromptError ? "border-[#FF1493] bg-red-50" : "border-black"}`}
          value={q.prompt}
          onChange={(e) => setQuestionField(ri, qi, (prev) => ({ ...prev, prompt: e.target.value } as QuizQuestion))}
        />
        {hasPromptError && <p className="text-[#FF1493] text-xs font-bold mb-2">{errors[`r${ri}-q${qi}-prompt`]}</p>}

        {q.type === "multiple-choice" && (
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`r${ri}-q${qi}-correct`}
                  checked={q.correctIndex === oi}
                  onChange={() => setQuestionField(ri, qi, (prev) => ({ ...prev, correctIndex: oi as 0|1|2|3 } as QuizQuestion))}
                  className="w-4 h-4 border-[2px] border-black accent-green-600"
                />
                <input
                  className={`flex-1 border-[2px] px-2 py-1 font-sans text-xs focus:outline-none ${errors[`r${ri}-q${qi}-opt${oi}`] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                  placeholder={`Option ${oi + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...q.options] as [string,string,string,string];
                    newOpts[oi] = e.target.value;
                    setQuestionField(ri, qi, (prev) => ({ ...prev, options: newOpts } as QuizQuestion));
                    setErrors((prev) => { const n = { ...prev }; delete n[`r${ri}-q${qi}-opt${oi}`]; return n; });
                  }}
                />
                {q.correctIndex === oi && <span className="text-[#00C853] font-bold text-xs">✓ Correct</span>}
              </div>
            ))}
          </div>
        )}

        {q.type === "open-ended" && (
          <div className="space-y-1.5">
            <p className="text-xs text-black/50 font-sans">Accepted answers (one per line):</p>
            {q.acceptedAnswers.map((ans, ai) => (
              <div key={ai} className="flex items-center gap-2">
                <input
                  className={`flex-1 border-[2px] px-2 py-1 font-sans text-xs focus:outline-none ${errors[`r${ri}-q${qi}-ans${ai}`] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                  placeholder={`Accepted answer ${ai + 1}`}
                  value={ans}
                  onChange={(e) => {
                    const newAns = q.acceptedAnswers.map((a, idx) => idx === ai ? e.target.value : a);
                    setQuestionField(ri, qi, (prev) => ({ ...prev, acceptedAnswers: newAns } as QuizQuestion));
                    setErrors((prev) => { const n = { ...prev }; delete n[`r${ri}-q${qi}-ans${ai}`]; return n; });
                  }}
                />
                {q.acceptedAnswers.length > 1 && (
                  <button onClick={() => setQuestionField(ri, qi, (prev) => ({ ...prev, acceptedAnswers: (prev as OEQuestion).acceptedAnswers.filter((_, i) => i !== ai) } as QuizQuestion))}>
                    <Trash2 className="w-3.5 h-3.5 text-[#FF1493]" />
                  </button>
                )}
              </div>
            ))}
            {q.acceptedAnswers.length < 5 && (
              <button
                onClick={() => setQuestionField(ri, qi, (prev) => ({ ...prev, acceptedAnswers: [...(prev as OEQuestion).acceptedAnswers, ""] } as QuizQuestion))}
                className="text-xs font-bold text-[#FF6B35] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add alternate answer
              </button>
            )}
          </div>
        )}

        {q.type === "true-false" && (
          <div className="flex gap-4">
            {[true, false].map((val) => (
              <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`r${ri}-q${qi}-tf`}
                  checked={q.answer === val}
                  onChange={() => setQuestionField(ri, qi, (prev) => ({ ...prev, answer: val } as QuizQuestion))}
                  className="w-4 h-4 border-[2px] border-black"
                />
                <span className={`font-display font-black text-sm uppercase ${val ? "text-[#00C853]" : "text-[#FF1493]"}`}>
                  {val ? "True" : "False"}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
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
      <header className="relative bg-[#00C853] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            {editId ? "Edit Bar Trivia" : "Create Bar Trivia"}
          </h1>
          <p className="mt-2 text-sm font-bold text-black/70 font-sans">
            3–7 rounds · 5–20 questions each · multiple types
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5">
            <label className="block font-display font-black text-lg uppercase mb-2">
              Quiz Name <span className="text-[#FF1493]">*</span>
            </label>
            <input
              className={`w-full border-[3px] px-4 py-3 font-sans text-base focus:outline-none focus:border-[#00C853] ${errors["title"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
              placeholder="e.g. Friday Night Trivia"
              value={form.title}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, title: e.target.value }));
                setErrors((prev) => { const n = { ...prev }; delete n["title"]; return n; });
              }}
            />
            {errors["title"] && <p className="text-[#FF1493] text-sm font-bold mt-1">{errors["title"]}</p>}
          </div>

          {/* Rounds */}
          <div className="bg-[#00C853] border-[4px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-black text-2xl uppercase">
                📋 Rounds ({form.rounds.length}/7)
              </h2>
            </div>
            {errors["rounds-count"] && (
              <p className="text-[#FF1493] text-sm font-bold mb-3 bg-white/30 px-3 py-2">{errors["rounds-count"]}</p>
            )}

            <div className="space-y-3">
              <AnimatePresence>
                {form.rounds.map((round, ri) => {
                  const roundColor = ROUND_TYPE_COLORS[round.roundType];
                  const hasRoundError = errors[`round-${ri}-name`] || errors[`round-${ri}-q-count`] || round.questions.some((_, qi) => errors[`r${ri}-q${qi}-prompt`]);
                  return (
                    <motion.div
                      key={ri}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`bg-white border-[3px] ${hasRoundError ? "border-[#FF1493]" : "border-black"} shadow-[3px_3px_0_#000]`}
                    >
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FFF8E7] transition-colors"
                        onClick={() => setCollapsedRounds((prev) => prev.map((v, i) => i === ri ? !v : v))}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-8 h-8 border-[2px] border-black flex items-center justify-center font-display font-black text-sm text-white"
                            style={{ backgroundColor: roundColor }}
                          >
                            {ri + 1}
                          </span>
                          <div className="text-left">
                            <span className={`font-display font-black uppercase text-base ${round.name ? "text-black" : "text-black/40"}`}>
                              {round.name || `Round ${ri + 1}`}
                            </span>
                            <span className="ml-2 text-xs text-black/50 font-sans">
                              {round.roundType} · {round.questions.length}q
                            </span>
                          </div>
                          {hasRoundError && <span className="text-[#FF1493] text-sm font-bold">● Needs attention</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {form.rounds.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeRound(ri); }}
                              className="p-1 text-[#FF1493] hover:bg-[#FF1493]/10 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {collapsedRounds[ri] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </button>

                      {!collapsedRounds[ri] && (
                        <div className="border-t-[3px] border-black p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-display font-black text-sm uppercase mb-1">
                                Round Name <span className="text-[#FF1493]">*</span>
                              </label>
                              <input
                                className={`w-full border-[3px] px-3 py-2 font-sans text-sm focus:outline-none ${errors[`round-${ri}-name`] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                                placeholder="e.g. Movie Madness"
                                value={round.name}
                                onChange={(e) => setRoundField(ri, "name", e.target.value)}
                              />
                              {errors[`round-${ri}-name`] && <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`round-${ri}-name`]}</p>}
                            </div>
                            <div>
                              <label className="block font-display font-black text-sm uppercase mb-1">
                                Question Type
                              </label>
                              <select
                                className="w-full border-[3px] border-black px-3 py-2 font-sans text-sm bg-white focus:outline-none"
                                value={round.roundType}
                                onChange={(e) => setRoundField(ri, "roundType", e.target.value as RoundType)}
                              >
                                <option value="multiple-choice">Multiple Choice</option>
                                <option value="open-ended">Open-Ended</option>
                                <option value="true-false">True / False</option>
                              </select>
                            </div>
                          </div>

                          {errors[`round-${ri}-q-count`] && (
                            <p className="text-[#FF1493] text-sm font-bold">{errors[`round-${ri}-q-count`]}</p>
                          )}

                          <div className="space-y-2">
                            {round.questions.map((q, qi) => renderQuestion(q, ri, qi))}
                          </div>

                          {round.questions.length < 20 && (
                            <button
                              onClick={() => addQuestion(ri)}
                              className="w-full py-2 border-[2px] border-dashed border-black text-black/60 font-display font-black uppercase text-sm flex items-center justify-center gap-2 hover:bg-[#FFF8E7]"
                            >
                              <Plus className="w-4 h-4" /> Add Question ({round.questions.length}/20)
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {form.rounds.length < 7 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={addRound}
                className="mt-4 w-full py-3 border-[3px] border-black bg-[#FFD700] text-black font-display font-black uppercase text-base flex items-center justify-center gap-2 shadow-[3px_3px_0_#000]"
              >
                <Plus className="w-5 h-5" /> Add Round ({form.rounds.length}/7)
              </motion.button>
            )}
          </div>

          {/* Save + back */}
          <div className="flex gap-4 flex-wrap">
            <Button
              className="font-display font-black uppercase text-lg px-10 py-5 bg-[#00C853] text-black border-[3px] border-black shadow-[5px_5px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : <><Save className="w-5 h-5" /> Save Quiz</>}
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
