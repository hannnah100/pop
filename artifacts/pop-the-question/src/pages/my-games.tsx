import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3x3, CircleDot, Beer, Edit2, Copy, Trash2, Play, Loader2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customGamesFetch, getOwnerId } from "@/lib/ownerId";
import { useCreateRoom } from "@workspace/api-client-react";
import { BackArrow } from "@/components/ui/BackArrow";
import {
  StarDoodle,
  ConfettiDoodle,
} from "@/components/fx/Doodles";

type GameKind = "jeopardy" | "wof" | "quiz";

interface CustomPack {
  id: number;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  kind: GameKind;
}

interface ConfirmState {
  id: number;
  kind: GameKind;
  title: string;
}

const KIND_META: Record<GameKind, { label: string; icon: typeof Grid3x3; bg: string; editPath: string; gameType: string }> = {
  jeopardy: { label: "Jeopardy", icon: Grid3x3, bg: "#FFC107", editPath: "/create-game/jeopardy", gameType: "jeopardy" },
  wof: { label: "Wheel of Fortune", icon: CircleDot, bg: "#B97AD7", editPath: "/create-game/wof", gameType: "wheel-of-fortune" },
  quiz: { label: "Pub Quiz", icon: Beer, bg: "#00C853", editPath: "/create-game/quiz", gameType: "pub-quiz" },
};

const TABS: { id: GameKind; label: string }[] = [
  { id: "jeopardy", label: "Jeopardy" },
  { id: "wof", label: "Wheel of Fortune" },
  { id: "quiz", label: "Pub Quiz" },
];

function packSummaryLine(pack: CustomPack): string {
  const p = pack.payload;
  if (pack.kind === "jeopardy") {
    const cats = (p.categories as unknown[])?.length ?? 0;
    return `${cats} categories`;
  }
  if (pack.kind === "wof") {
    const puzzles = (p.puzzles as unknown[])?.length ?? 0;
    return `${puzzles} puzzles`;
  }
  if (pack.kind === "quiz") {
    const rounds = (p.rounds as unknown[])?.length ?? 0;
    const questions = (p.rounds as Array<{ questions: unknown[] }>)?.reduce((acc, r) => acc + (r.questions?.length ?? 0), 0) ?? 0;
    return `${rounds} rounds · ${questions} questions`;
  }
  return "";
}

export default function MyGames() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createRoom = useCreateRoom();

  const [activeTab, setActiveTab] = useState<GameKind>("jeopardy");
  const [packs, setPacks] = useState<CustomPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [launching, setLaunching] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jPacks, wPacks, qPacks] = await Promise.all([
        customGamesFetch<Array<Omit<CustomPack, "kind">>>("/custom-games/jeopardy"),
        customGamesFetch<Array<Omit<CustomPack, "kind">>>("/custom-games/wof"),
        customGamesFetch<Array<Omit<CustomPack, "kind">>>("/custom-games/quiz"),
      ]);
      setPacks([
        ...jPacks.map((p) => ({ ...p, kind: "jeopardy" as GameKind })),
        ...wPacks.map((p) => ({ ...p, kind: "wof" as GameKind })),
        ...qPacks.map((p) => ({ ...p, kind: "quiz" as GameKind })),
      ]);
    } catch {
      toast({ title: "Failed to load games", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      await customGamesFetch(`/custom-games/${confirmDelete.kind}/${confirmDelete.id}`, { method: "DELETE" });
      setPacks((prev) => prev.filter((p) => !(p.id === confirmDelete.id && p.kind === confirmDelete.kind)));
      toast({ title: "Pack deleted." });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleDuplicate = async (pack: CustomPack) => {
    setDuplicating(pack.id);
    try {
      const newPayload = {
        ...pack.payload,
        id: `custom-${pack.kind}-${Date.now()}`,
        title: `${pack.title} (Copy)`,
      };
      await customGamesFetch(`/custom-games/${pack.kind}`, {
        method: "POST",
        body: JSON.stringify(newPayload),
      });
      toast({ title: "Pack duplicated!" });
      await fetchAll();
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handlePlay = (pack: CustomPack) => {
    setLaunching(pack.id);
    const meta = KIND_META[pack.kind];
    const customPackId = `custom-${pack.kind[0]}-${pack.id}`;
    createRoom.mutate(
      { data: { gameType: meta.gameType as "jeopardy" | "pub-quiz" | "wheel-of-fortune", demo: false, packId: customPackId } },
      {
        onSuccess: (room) => {
          setLocation(`/game/${room.roomCode}/host`);
        },
        onError: () => {
          setLaunching(null);
          toast({ title: "Failed to create room", variant: "destructive" });
        },
      }
    );
  };

  const tabPacks = packs.filter((p) => p.kind === activeTab);
  const meta = KIND_META[activeTab];
  const { icon: Icon } = meta;

  return (
    <div className="flex-1 flex flex-col w-full overflow-x-hidden">
      <header className="relative bg-[#00E5FF] border-b-[4px] border-black px-4 pt-8 pb-6 text-center overflow-hidden">
        <StarDoodle className="absolute top-3 left-4 w-9 h-9 text-[#FF1493]" />
        <ConfettiDoodle className="absolute top-2 right-4 w-12 h-12 opacity-70" />
        <div className="relative z-10">
          <h1
            className="font-display font-black uppercase leading-none comic-headline"
            style={{ fontSize: "clamp(2rem, 7vw, 4rem)" }}
          >
            My Custom Games
          </h1>
          <p className="mt-2 text-base font-bold text-black/70 font-sans">
            Create, edit, and play your own game packs
          </p>
        </div>
      </header>

      <div className="flex-1 bg-[#FFF8E7] px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Tab bar */}
          <div className="flex border-[3px] border-black shadow-[4px_4px_0_#000] mb-6 overflow-hidden">
            {TABS.map((tab) => {
              const m = KIND_META[tab.id];
              const count = packs.filter((p) => p.kind === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-2 font-display font-black uppercase text-sm border-r-[3px] border-black last:border-r-0 transition-colors
                    ${activeTab === tab.id ? "text-black" : "bg-white text-black/50 hover:bg-[#FFF8E7]"}`}
                  style={activeTab === tab.id ? { backgroundColor: m.bg } : {}}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="ml-1.5 text-xs bg-black text-white px-1.5 py-0.5">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action bar */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocation(`/create-game/${activeTab}`)}
              className="px-6 py-3 font-display font-black uppercase text-sm border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center gap-2"
              style={{ backgroundColor: meta.bg }}
            >
              <Star className="w-4 h-4" />
              New {meta.label} Pack
            </motion.button>
          </div>

          {/* Pack list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : tabPacks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 bg-white border-[3px] border-black shadow-[4px_4px_0_#000]"
            >
              <Icon className="w-12 h-12 mx-auto mb-4 text-black/20" />
              <p className="font-display font-black text-2xl uppercase text-black/40 mb-2">
                No {meta.label} packs yet
              </p>
              <p className="text-sm text-black/40 font-sans mb-6">
                Create your first custom {meta.label} pack to get started.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation(`/create-game/${activeTab}`)}
                className="px-8 py-3 font-display font-black uppercase border-[3px] border-black shadow-[4px_4px_0_#000]"
                style={{ backgroundColor: meta.bg }}
              >
                Create First Pack
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {tabPacks.map((pack) => (
                  <motion.div
                    key={`${pack.kind}-${pack.id}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white border-[3px] border-black shadow-[5px_5px_0_#000] flex flex-col overflow-hidden"
                  >
                    <div
                      className="h-2.5 w-full border-b-[3px] border-black"
                      style={{ backgroundColor: meta.bg }}
                    />
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start gap-2 mb-1">
                        <Star className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#FFD700] fill-[#FFD700]" />
                        <h3 className="font-display font-black text-black uppercase text-base leading-tight flex-1">
                          {pack.title}
                        </h3>
                      </div>
                      <p className="text-xs text-black/50 font-sans mb-4 flex-1">
                        {packSummaryLine(pack)}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handlePlay(pack)}
                          disabled={launching === pack.id}
                          className="flex items-center justify-center gap-1.5 py-2 font-display font-black uppercase text-xs border-[2px] border-black shadow-[2px_2px_0_#000] disabled:opacity-50"
                          style={{ backgroundColor: meta.bg }}
                        >
                          {launching === pack.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Play
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setLocation(`${meta.editPath}/${pack.id}`)}
                          className="flex items-center justify-center gap-1.5 py-2 font-display font-black uppercase text-xs border-[2px] border-black bg-white shadow-[2px_2px_0_#000]"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleDuplicate(pack)}
                          disabled={duplicating === pack.id}
                          className="flex items-center justify-center gap-1.5 py-2 font-display font-black uppercase text-xs border-[2px] border-black bg-white shadow-[2px_2px_0_#000] disabled:opacity-50"
                        >
                          {duplicating === pack.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                          Duplicate
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setConfirmDelete({ id: pack.id, kind: pack.kind, title: pack.title })}
                          className="flex items-center justify-center gap-1.5 py-2 font-display font-black uppercase text-xs border-[2px] border-[#FF1493] text-[#FF1493] bg-white shadow-[2px_2px_0_#FF1493]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <BackArrow />
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="bg-white border-[4px] border-black shadow-[8px_8px_0_#000] p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display font-black text-2xl uppercase mb-2">Delete Pack?</h2>
              <p className="text-sm font-sans text-black/70 mb-6">
                Are you sure you want to delete <strong>"{confirmDelete.title}"</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDelete}
                  disabled={deleting === confirmDelete.id}
                  className="flex-1 py-3 bg-[#FF1493] text-white font-display font-black uppercase text-sm border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleting === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-white font-display font-black uppercase text-sm border-[3px] border-black shadow-[3px_3px_0_#000]"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
