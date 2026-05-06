import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch } from "@/lib/ownerId";
import { BackArrow } from "@/components/ui/BackArrow";

const JEOPARDY_VALUES = [200, 400, 600, 800, 1000] as const;

interface JClue {
  value: number;
  question: string;
  answer: string;
  isDailyDouble: boolean;
}

interface JCategory {
  name: string;
  clues: JClue[];
}

interface JFinal {
  category: string;
  question: string;
  answer: string;
}

interface JFormState {
  title: string;
  description: string;
  categories: JCategory[];
  final: JFinal;
}

function makeDefaultClues(): JClue[] {
  return JEOPARDY_VALUES.map((v) => ({
    value: v,
    question: "",
    answer: "",
    isDailyDouble: false,
  }));
}

function makeDefaultCategory(): JCategory {
  return { name: "", clues: makeDefaultClues() };
}

function makeDefaultState(): JFormState {
  return {
    title: "",
    description: "",
    categories: Array.from({ length: 6 }, makeDefaultCategory),
    final: { category: "", question: "", answer: "" },
  };
}

interface FieldError {
  [key: string]: string;
}

function countDailyDoubles(form: JFormState): number {
  return form.categories.reduce((acc, cat) => acc + cat.clues.filter((c) => c.isDailyDouble).length, 0);
}

function validateForm(form: JFormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors["title"] = "Game title is required.";
  form.categories.forEach((cat, ci) => {
    if (!cat.name.trim()) errors[`cat-${ci}-name`] = "Category name required.";
    cat.clues.forEach((clue, qi) => {
      if (!clue.question.trim()) errors[`cat-${ci}-clue-${qi}-q`] = "Question required.";
      if (!clue.answer.trim()) errors[`cat-${ci}-clue-${qi}-a`] = "Answer required.";
    });
  });
  const ddCount = countDailyDoubles(form);
  if (ddCount !== 2) errors["dd-count"] = `Exactly 2 Daily Doubles required (currently ${ddCount}).`;
  if (!form.final.category.trim()) errors["final-cat"] = "Final Round category required.";
  if (!form.final.question.trim()) errors["final-q"] = "Final Round question required.";
  if (!form.final.answer.trim()) errors["final-a"] = "Final Round answer required.";
  return errors;
}

function formToPayload(form: JFormState, existingId?: string) {
  return {
    id: existingId ?? `custom-j-${Date.now()}`,
    title: form.title.trim(),
    description: form.description.trim() || `Custom Pop Quiz: ${form.title.trim()}`,
    categories: form.categories.map((cat) => ({
      name: cat.name.trim(),
      clues: cat.clues.map((c) => ({
        value: c.value,
        question: c.question.trim(),
        answer: c.answer.trim(),
        isDailyDouble: c.isDailyDouble,
      })),
    })),
    final: {
      category: form.final.category.trim(),
      question: form.final.question.trim(),
      answer: form.final.answer.trim(),
    },
  };
}

export default function JeopardyCreator() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/create-game/jeopardy/:id");
  const editId = matchEdit ? paramsEdit?.id : undefined;

  const { toast } = useToast();
  const [form, setForm] = useState<JFormState>(makeDefaultState());
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [collapsed, setCollapsed] = useState<boolean[]>(Array(6).fill(true));

  useEffect(() => {
    if (!editId) return;
    customGamesFetch<{ id: number; title: string; payload: unknown }>(`/custom-games/jeopardy/${editId}`)
      .then((row) => {
        const p = row.payload as ReturnType<typeof formToPayload>;
        setForm({
          title: p.title,
          description: p.description,
          categories: p.categories.map((cat) => ({
            name: cat.name,
            clues: cat.clues.map((c) => ({
              value: c.value,
              question: c.question,
              answer: c.answer,
              isDailyDouble: (c as { isDailyDouble?: boolean }).isDailyDouble ?? false,
            })),
          })),
          final: { category: p.final.category, question: p.final.question, answer: p.final.answer },
        });
      })
      .catch(() => toast({ title: "Failed to load pack", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const setField = (path: string[], value: string | boolean) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as JFormState;
      if (path[0] === "title") next.title = value as string;
      else if (path[0] === "description") next.description = value as string;
      else if (path[0] === "final") {
        const f = next.final as unknown as Record<string, string>;
        f[path[1]!] = value as string;
      } else if (path[0] === "cat") {
        const ci = Number(path[1]);
        const cat = next.categories[ci]!;
        if (path[2] === "name") cat.name = value as string;
        else if (path[2] === "clue") {
          const qi = Number(path[3]);
          const clue = cat.clues[qi]!;
          if (path[4] === "question") clue.question = value as string;
          else if (path[4] === "answer") clue.answer = value as string;
          else if (path[4] === "dd") clue.isDailyDouble = value as boolean;
        }
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path.join("-")];
      return next;
    });
  };

  const handleSave = async () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setCollapsed(Array(6).fill(false));
      toast({ title: "Please fix the errors below", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form, editId ? `custom-j-${editId}` : undefined);
      if (editId) {
        await customGamesFetch(`/custom-games/jeopardy/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await customGamesFetch("/custom-games/jeopardy", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editId ? "Pack updated!" : "Pack saved!", description: "Find it in My Custom Games." });
      setLocation("/my-games");
    } catch (e: unknown) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleCollapse = (i: number) => {
    setCollapsed((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
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
      <header className="relative bg-[#FFC107] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            {editId ? "Edit Pop Quiz Pack" : "Create Pop Quiz Pack"}
          </h1>
          <p className="mt-2 text-sm font-bold text-black/70 font-sans">
            6 categories · 5 clues each · Final Round
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5">
            <label className="block font-display font-black text-lg uppercase mb-2">
              Game Title <span className="text-[#FF1493]">*</span>
            </label>
            <input
              className={`w-full border-[3px] px-4 py-3 font-sans text-base focus:outline-none focus:border-[#FFC107] ${errors["title"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
              placeholder="e.g. Movie Trivia Night"
              value={form.title}
              onChange={(e) => setField(["title"], e.target.value)}
            />
            {errors["title"] && <p className="text-[#FF1493] text-sm font-bold mt-1">{errors["title"]}</p>}
          </div>

          {/* Categories */}
          <div className="bg-[#1565C0] border-[4px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-display font-black text-white text-2xl uppercase">
                📋 Categories &amp; Clues
              </h2>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 font-display font-black text-sm uppercase border-[2px] ${countDailyDoubles(form) === 2 ? "bg-[#FFD700] border-[#FFD700] text-black" : "bg-[#FF1493] border-[#FF1493] text-white"}`}>
                <Star className="w-3.5 h-3.5" />
                {countDailyDoubles(form)}/2 Daily Doubles
              </div>
            </div>
            {errors["dd-count"] && (
              <div className="mb-3 bg-[#FF1493] text-white text-sm font-bold px-3 py-2 border-[2px] border-white">
                {errors["dd-count"]}
              </div>
            )}
            <div className="space-y-3">
              {form.categories.map((cat, ci) => {
                const hasError = errors[`cat-${ci}-name`] || cat.clues.some((_, qi) =>
                  errors[`cat-${ci}-clue-${qi}-q`] || errors[`cat-${ci}-clue-${qi}-a`]
                );
                return (
                  <div key={ci} className={`bg-white border-[3px] ${hasError ? "border-[#FF1493]" : "border-black"} shadow-[3px_3px_0_#000]`}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FFF8E7] transition-colors"
                      onClick={() => toggleCollapse(ci)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-[#FFC107] border-[2px] border-black flex items-center justify-center font-display font-black text-sm">
                          {ci + 1}
                        </span>
                        <span className={`font-display font-black uppercase text-base ${cat.name ? "text-black" : "text-black/40"}`}>
                          {cat.name || `Category ${ci + 1}`}
                        </span>
                        {hasError && <span className="text-[#FF1493] text-sm font-bold">● Needs attention</span>}
                      </div>
                      {collapsed[ci] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {!collapsed[ci] && (
                      <div className="border-t-[3px] border-black p-4 space-y-4">
                        <div>
                          <label className="block font-display font-black text-sm uppercase mb-1">
                            Category Name <span className="text-[#FF1493]">*</span>
                          </label>
                          <input
                            className={`w-full border-[3px] px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#FFC107] ${errors[`cat-${ci}-name`] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                            placeholder="e.g. 90s Movies"
                            value={cat.name}
                            onChange={(e) => setField(["cat", String(ci), "name"], e.target.value)}
                          />
                          {errors[`cat-${ci}-name`] && (
                            <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`cat-${ci}-name`]}</p>
                          )}
                        </div>

                        {cat.clues.map((clue, qi) => (
                          <div key={qi} className={`border-[2px] ${errors[`cat-${ci}-clue-${qi}-q`] || errors[`cat-${ci}-clue-${qi}-a`] ? "border-[#FF1493]" : "border-black"} p-3 bg-[#FFF8E7]`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="px-3 py-1 font-display font-black text-sm border-[2px] border-black"
                                style={{ backgroundColor: "#FFC107" }}
                              >
                                ${clue.value}
                              </span>
                              <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                                <input
                                  type="checkbox"
                                  checked={clue.isDailyDouble}
                                  onChange={(e) => setField(["cat", String(ci), "clue", String(qi), "dd"], e.target.checked)}
                                  className="w-4 h-4 border-[2px] border-black"
                                />
                                <span className="font-display font-black text-xs uppercase text-[#FF6B35]">
                                  Daily Double
                                </span>
                              </label>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs font-bold font-sans uppercase text-black/60 mb-1">
                                  Clue / Question <span className="text-[#FF1493]">*</span>
                                </label>
                                <textarea
                                  rows={2}
                                  className={`w-full border-[2px] px-3 py-2 font-sans text-sm resize-none focus:outline-none focus:border-[#FFC107] ${errors[`cat-${ci}-clue-${qi}-q`] ? "border-[#FF1493] bg-red-50" : "border-black bg-white"}`}
                                  placeholder="This actor played both Batman and Beetlejuice…"
                                  value={clue.question}
                                  onChange={(e) => setField(["cat", String(ci), "clue", String(qi), "question"], e.target.value)}
                                />
                                {errors[`cat-${ci}-clue-${qi}-q`] && (
                                  <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`cat-${ci}-clue-${qi}-q`]}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-bold font-sans uppercase text-black/60 mb-1">
                                  Answer <span className="text-[#FF1493]">*</span>
                                </label>
                                <input
                                  className={`w-full border-[2px] px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#FFC107] ${errors[`cat-${ci}-clue-${qi}-a`] ? "border-[#FF1493] bg-red-50" : "border-black bg-white"}`}
                                  placeholder="Who is Michael Keaton?"
                                  value={clue.answer}
                                  onChange={(e) => setField(["cat", String(ci), "clue", String(qi), "answer"], e.target.value)}
                                />
                                {errors[`cat-${ci}-clue-${qi}-a`] && (
                                  <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors[`cat-${ci}-clue-${qi}-a`]}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final Round */}
          <div className="bg-[#FF1493] border-[4px] border-black shadow-[6px_6px_0_#000] p-5">
            <h2 className="font-display font-black text-white text-2xl uppercase mb-4">
              ⭐ Final Round
            </h2>
            <div className="bg-white border-[3px] border-black p-4 space-y-3">
              <div>
                <label className="block font-display font-black text-sm uppercase mb-1">
                  Category <span className="text-[#FF1493]">*</span>
                </label>
                <input
                  className={`w-full border-[3px] px-3 py-2 font-sans text-sm focus:outline-none ${errors["final-cat"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                  placeholder="e.g. Pop Culture Icons"
                  value={form.final.category}
                  onChange={(e) => setField(["final", "category"], e.target.value)}
                />
                {errors["final-cat"] && <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors["final-cat"]}</p>}
              </div>
              <div>
                <label className="block font-display font-black text-sm uppercase mb-1">
                  Clue / Question <span className="text-[#FF1493]">*</span>
                </label>
                <textarea
                  rows={3}
                  className={`w-full border-[3px] px-3 py-2 font-sans text-sm resize-none focus:outline-none ${errors["final-q"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                  placeholder="In 2023, this pop star broke records with her Eras Tour…"
                  value={form.final.question}
                  onChange={(e) => setField(["final", "question"], e.target.value)}
                />
                {errors["final-q"] && <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors["final-q"]}</p>}
              </div>
              <div>
                <label className="block font-display font-black text-sm uppercase mb-1">
                  Answer <span className="text-[#FF1493]">*</span>
                </label>
                <input
                  className={`w-full border-[3px] px-3 py-2 font-sans text-sm focus:outline-none ${errors["final-a"] ? "border-[#FF1493] bg-red-50" : "border-black"}`}
                  placeholder="Who is Taylor Swift?"
                  value={form.final.answer}
                  onChange={(e) => setField(["final", "answer"], e.target.value)}
                />
                {errors["final-a"] && <p className="text-[#FF1493] text-xs font-bold mt-0.5">{errors["final-a"]}</p>}
              </div>
            </div>
          </div>

          {/* Save + back */}
          <div className="flex gap-4 flex-wrap">
            <Button
              className="font-display font-black uppercase text-lg px-10 py-5 bg-[#FFC107] text-black border-[3px] border-black shadow-[5px_5px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
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
