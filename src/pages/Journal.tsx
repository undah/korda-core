import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  LineChart,
  ExternalLink,
  Trash2,
  Pencil,
  Image as ImageIcon,
  X,
  ArrowUpDown,
  CornerUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TradesSection } from "@/components/journal/TradesSection";
import { AddJournalEntryDialog } from "@/components/journal/AddJournalEntryDialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface JournalEntry {
  id: string;
  pair: string;
  side: "buy" | "sell";
  entry_time: string; // ISO string
  pnl: number;
  notes: string;
  tags: string[];
  emotion: "confident" | "fearful" | "neutral" | "greedy";
  tv_url?: string | null;

  // legacy single image
  tv_image_url?: string | null;

  // new multi-image field (text[])
  tv_image_urls?: string[] | null;

  // link to trade
  trade_id?: string | null;
}

const EMOTIONS: JournalEntry["emotion"][] = ["confident", "fearful", "neutral", "greedy"];

const emotionColors: Record<JournalEntry["emotion"], string> = {
  confident: "bg-success/20 text-success",
  fearful: "bg-warning/20 text-warning",
  neutral: "bg-muted text-muted-foreground",
  greedy: "bg-destructive/20 text-destructive",
};

function normalizeTags(input: string) {
  const arr = input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return arr.length ? arr : [];
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateMs(iso: string | null | undefined) {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

function dateRangeToMs(from?: string, to?: string) {
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  return { fromMs, toMs };
}

type SortMode = "new_old" | "old_new" | "az" | "za" | "pnl_high_low" | "pnl_low_high";

const SORT_LABELS: Record<SortMode, string> = {
  new_old: "New → Old",
  old_new: "Old → New",
  az: "A → Z",
  za: "Z → A",
  pnl_high_low: "PnL High → Low",
  pnl_low_high: "PnL Low → High",
};

function getEntryImages(entry: Pick<JournalEntry, "tv_image_urls" | "tv_image_url"> | null | undefined) {
  if (!entry) return [] as string[];
  const arr = Array.isArray(entry.tv_image_urls) ? entry.tv_image_urls.filter(Boolean) : [];
  if (arr.length) return arr.slice(0, 3);
  return entry.tv_image_url ? [entry.tv_image_url] : [];
}

function toLocalDatetimeValue(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  } catch {
    return "";
  }
}

export default function Journal() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("trades");

  // trade focus when clicking "Go to trade"
  const [focusTradeId, setFocusTradeId] = useState<string | null>(null);

  // open a specific journal entry when coming from trade -> linked modal -> "Open"
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);

  // data
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // add entry dialog
  const [addJournalOpen, setAddJournalOpen] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  // search
  const [search, setSearch] = useState("");

  // fullscreen viewer
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // themed delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // drafts
  const [draftPair, setDraftPair] = useState("");
  const [draftSide, setDraftSide] = useState<"buy" | "sell">("buy");
  const [draftPnl, setDraftPnl] = useState<string>("0");
  const [draftEmotion, setDraftEmotion] = useState<JournalEntry["emotion"]>("neutral");
  const [draftTags, setDraftTags] = useState<string>("");
  const [draftEntryTime, setDraftEntryTime] = useState<string>("");
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [draftTvUrl, setDraftTvUrl] = useState<string>("");

  // legacy single image (kept for backwards compatibility)
  const [draftTvImageUrl, setDraftTvImageUrl] = useState<string>("");

  // NEW: draft image slots (up to 3)
  const [draftImageSlots, setDraftImageSlots] = useState<(string | null)[]>([null, null, null]);

  // NEW: per-slot replacement files + previews
  const [newImageFiles, setNewImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState<(string | null)[]>([null, null, null]);
  const previewUrlsRef = useRef<(string | null)[]>([null, null, null]);

  // filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("new_old");

  const [filterSide, setFilterSide] = useState<"all" | "buy" | "sell">("all");
  const [filterEmotion, setFilterEmotion] = useState<"all" | JournalEntry["emotion"]>("all");
  const [filterPair, setFilterPair] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // floating preview
  const stickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [showFloatingPreview, setShowFloatingPreview] = useState(false);

  // ensure floating preview never shows on Trades tab
  useEffect(() => {
    if (activeTab !== "journal") setShowFloatingPreview(false);
  }, [activeTab]);

  useEffect(() => {
    const el = stickySentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => setShowFloatingPreview(!entry.isIntersecting), {
      root: null,
      threshold: 0,
    });

    io.observe(el);
    return () => io.disconnect();
  }, [selectedEntry?.id, isEditing]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterSide !== "all") n++;
    if (filterEmotion !== "all") n++;
    if (filterPair.trim()) n++;
    if (filterTag.trim()) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    return n;
  }, [filterSide, filterEmotion, filterPair, filterTag, dateFrom, dateTo]);

  const clearFilters = () => {
    setFilterSide("all");
    setFilterEmotion("all");
    setFilterPair("");
    setFilterTag("");
    setDateFrom("");
    setDateTo("");
  };

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pairQ = filterPair.trim().toLowerCase();
    const tagQ = filterTag.trim().toLowerCase();
    const { fromMs, toMs } = dateRangeToMs(dateFrom || undefined, dateTo || undefined);

    return entries.filter((e) => {
      if (q) {
        const tags = (e.tags ?? []).join(" ").toLowerCase();
        const matchesSearch =
          e.pair.toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q) ||
          tags.includes(q) ||
          (e.emotion ?? "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (filterSide !== "all" && e.side !== filterSide) return false;
      if (filterEmotion !== "all" && e.emotion !== filterEmotion) return false;
      if (pairQ && !e.pair.toLowerCase().includes(pairQ)) return false;

      if (tagQ) {
        const tagsJoined = (e.tags ?? []).join(" ").toLowerCase();
        if (!tagsJoined.includes(tagQ)) return false;
      }

      if (fromMs !== null || toMs !== null) {
        const t = safeDateMs(e.entry_time);
        if (!Number.isFinite(t)) return false;
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
      }

      return true;
    });
  }, [entries, search, filterSide, filterEmotion, filterPair, filterTag, dateFrom, dateTo]);

  const visibleEntries = useMemo(() => {
    const arr = [...filteredEntries];

    arr.sort((a, b) => {
      if (sortMode === "new_old") {
        const ta = safeDateMs(a.entry_time);
        const tb = safeDateMs(b.entry_time);
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      }
      if (sortMode === "old_new") {
        const ta = safeDateMs(a.entry_time);
        const tb = safeDateMs(b.entry_time);
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      }
      if (sortMode === "az") {
        return (a.pair ?? "").localeCompare(b.pair ?? "", undefined, { sensitivity: "base" });
      }
      if (sortMode === "za") {
        return (b.pair ?? "").localeCompare(a.pair ?? "", undefined, { sensitivity: "base" });
      }
      if (sortMode === "pnl_high_low") {
        return safeNumber(b.pnl, 0) - safeNumber(a.pnl, 0);
      }
      if (sortMode === "pnl_low_high") {
        return safeNumber(a.pnl, 0) - safeNumber(b.pnl, 0);
      }
      return 0;
    });

    return arr;
  }, [filteredEntries, sortMode]);

  const selectedDateLabel = selectedEntry?.entry_time ? new Date(selectedEntry.entry_time).toLocaleDateString() : "";

  const images = useMemo(
    () => getEntryImages(selectedEntry),
    [selectedEntry?.id, selectedEntry?.tv_image_url, selectedEntry?.tv_image_urls]
  );
  const activeImageUrl = images[activeImageIndex] ?? images[0] ?? null;

  // keep active index valid when entry changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedEntry?.id]);

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, []);

  const hydrateDraftFromEntry = (e: JournalEntry) => {
    setDraftPair(e.pair ?? "");
    setDraftSide((e.side ?? "buy") as "buy" | "sell");
    setDraftPnl(String(e.pnl ?? 0));
    setDraftEmotion((e.emotion ?? "neutral") as JournalEntry["emotion"]);
    setDraftTags((e.tags ?? []).join(", "));
    setDraftNotes(e.notes ?? "");
    setDraftTvUrl(e.tv_url ?? "");
    setDraftEntryTime(e.entry_time ? toLocalDatetimeValue(e.entry_time) : "");

    // legacy
    setDraftTvImageUrl(e.tv_image_url ?? "");

    // multi-image -> slots
    const imgs = getEntryImages(e);
    setDraftImageSlots([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);

    // reset files/previews
    setNewImageFiles([null, null, null]);
    setNewImagePreviewUrls((prev) => {
      prev.forEach((u) => u && URL.revokeObjectURL(u));
      previewUrlsRef.current = [null, null, null];
      return [null, null, null];
    });
  };

  // fetch entries
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_time", { ascending: false });

      if (error) {
        console.error("Fetch journal_entries error:", error);
        return;
      }

      const mapped: JournalEntry[] = (data ?? []).map((r: any) => ({
        id: r.id,
        pair: r.pair ?? "",
        side: (r.side ?? "buy") as "buy" | "sell",
        entry_time: r.entry_time ?? r.created_at,
        pnl: Number(r.pnl ?? 0),
        notes: r.notes ?? "",
        tags: Array.isArray(r.tags) ? r.tags : [],
        emotion: (EMOTIONS.includes(r.emotion) ? r.emotion : "neutral") as JournalEntry["emotion"],
        tv_url: r.tv_url ?? null,
        tv_image_url: r.tv_image_url ?? null,
        tv_image_urls: Array.isArray(r.tv_image_urls) ? r.tv_image_urls : null,
        trade_id: r.trade_id ?? null,
      }));

      setEntries(mapped);

      setSelectedEntry((prev) => {
        const next = prev ? mapped.find((x) => x.id === prev.id) ?? mapped[0] ?? null : mapped[0] ?? null;
        if (next) hydrateDraftFromEntry(next);
        return next;
      });

      if (!mapped.length) {
        setSelectedEntry(null);
        setIsEditing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, journalRefreshKey]);

  const selectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setIsEditing(false);
    hydrateDraftFromEntry(entry);
    setShowFloatingPreview(false);
    setActiveImageIndex(0);
  };

  // open specific entry requested by TradesSection
  useEffect(() => {
    if (!pendingEntryId) return;
    if (!entries.length) return;

    const found = entries.find((e) => e.id === pendingEntryId);
    if (found) {
      setActiveTab("journal");
      selectEntry(found);
    }
    setPendingEntryId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEntryId, entries]);

  const uploadChartImage = async (file: File): Promise<string | null> => {
    if (!user) return null;

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("journal charts").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      console.error("Upload chart image error:", uploadError);
      alert(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from("journal charts").getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const setSlotFile = (slotIndex: number, file: File | null) => {
    setNewImageFiles((prev) => {
      const next = [...prev];
      next[slotIndex] = file;
      return next;
    });

    setNewImagePreviewUrls((prev) => {
      const next = [...prev];
      const old = next[slotIndex];
      if (old) URL.revokeObjectURL(old);
      next[slotIndex] = file ? URL.createObjectURL(file) : null;
      previewUrlsRef.current = next;
      return next;
    });
  };

  const clearSlot = (slotIndex: number) => {
    setDraftImageSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    setSlotFile(slotIndex, null);
  };

  const isDirty = useMemo(() => {
    if (!selectedEntry) return false;

    const base = {
      pair: selectedEntry.pair ?? "",
      side: selectedEntry.side ?? "buy",
      pnl: safeNumber(selectedEntry.pnl ?? 0),
      emotion: selectedEntry.emotion ?? "neutral",
      tags: (selectedEntry.tags ?? []).join(", "),
      notes: selectedEntry.notes ?? "",
      tv_url: selectedEntry.tv_url ?? "",
      entry_time: selectedEntry.entry_time ?? "",
      images: getEntryImages(selectedEntry),
    };

    const draft = {
      pair: draftPair.trim(),
      side: draftSide,
      pnl: safeNumber(draftPnl, 0),
      emotion: draftEmotion,
      tags: draftTags.trim(),
      notes: draftNotes,
      tv_url: draftTvUrl.trim(),
      entry_time: draftEntryTime ? new Date(draftEntryTime).toISOString() : base.entry_time,
      images: (draftImageSlots.filter(Boolean).slice(0, 3) as string[]) ?? [],
    };

    const same =
      base.pair === draft.pair &&
      base.side === draft.side &&
      base.pnl === draft.pnl &&
      base.emotion === draft.emotion &&
      base.tags === draft.tags &&
      base.notes === draft.notes &&
      base.tv_url === draft.tv_url &&
      base.entry_time === draft.entry_time &&
      base.images.join("|") === draft.images.join("|");

    const hasNewFiles = newImageFiles.some(Boolean);
    return !same || hasNewFiles;
  }, [
    selectedEntry,
    draftPair,
    draftSide,
    draftPnl,
    draftEmotion,
    draftTags,
    draftNotes,
    draftTvUrl,
    draftEntryTime,
    draftImageSlots,
    newImageFiles,
  ]);

  const handleSave = async () => {
    if (!selectedEntry) return;
    setSaving(true);

    try {
      // start from current slots
      const nextSlots: (string | null)[] = [...draftImageSlots];

      // upload replacements per-slot
      for (let i = 0; i < 3; i++) {
        const f = newImageFiles[i];
        if (!f) continue;
        const uploaded = await uploadChartImage(f);
        if (uploaded) nextSlots[i] = uploaded;
      }

      // compact -> final image urls
      const finalImages = nextSlots.filter(Boolean).slice(0, 3) as string[];

      // keep legacy in sync (first image)
      const legacyFirst = finalImages[0] ?? null;

      const payload: any = {
        pair: draftPair.trim(),
        side: draftSide,
        pnl: draftPnl.trim() === "" ? null : Number(draftPnl),
        emotion: draftEmotion,
        notes: draftNotes.trim() || null,
        tags: normalizeTags(draftTags),
        tv_url: draftTvUrl.trim() || null,
        entry_time: draftEntryTime ? new Date(draftEntryTime).toISOString() : selectedEntry.entry_time,

        tv_image_urls: finalImages.length ? finalImages : null,
        tv_image_url: legacyFirst,
      };

      const { error } = await supabase.from("journal_entries").update(payload).eq("id", selectedEntry.id);

      if (error) {
        console.error("Update journal entry error:", error);
        alert(error.message);
        return;
      }

      setIsEditing(false);
      setJournalRefreshKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdits = () => {
    if (!selectedEntry) return;
    setIsEditing(false);
    hydrateDraftFromEntry(selectedEntry);
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedEntry) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("journal_entries").delete().eq("id", selectedEntry.id);

      if (error) {
        console.error("Delete journal entry error:", error);
        alert(error.message);
        return;
      }

      setDeleteOpen(false);
      setSelectedEntry(null);
      setIsEditing(false);
      setJournalRefreshKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  const goToTrade = (tradeId: string) => {
    setShowFloatingPreview(false);
    setActiveTab("trades");
    setFocusTradeId(tradeId);
  };

  const PreviewCard = ({ className }: { className?: string }) => {
    if (!selectedEntry) return null;
    const imgs = getEntryImages(selectedEntry);
    if (!imgs.length || isEditing) return null;

    const shown = imgs[activeImageIndex] ?? imgs[0];

    return (
      <div className={cn("mb-6", className)}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-semibold truncate">{selectedEntry.pair}</div>

              <div
                className={cn(
                  "font-mono font-semibold",
                  selectedEntry.pnl >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {selectedEntry.pnl >= 0 ? "+" : "-"}${Math.abs(selectedEntry.pnl)}
              </div>

              <span className="text-[11px] px-2 py-1 rounded-full border border-border uppercase">
                {selectedEntry.side}
              </span>

              <span className={cn("text-[11px] px-2 py-1 rounded-full capitalize", emotionColors[selectedEntry.emotion])}>
                {selectedEntry.emotion}
              </span>

              <span className="text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground">
                {imgs.length} image{imgs.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              {selectedEntry.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : ""}
            </div>
          </div>

          {selectedEntry.tv_url && (
            <a
              href={selectedEntry.tv_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border hover:border-primary/40 transition-colors shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              TradingView
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => setImageOpen(true)}
          className="group block overflow-hidden rounded-2xl border border-border hover:border-primary/40 transition-colors w-full"
          title="Open full screen"
        >
          <img
            src={shown}
            alt="TradingView chart"
            className="w-full max-h-[520px] object-contain bg-black/20"
            loading="lazy"
          />
          <div className="pointer-events-none h-0">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-y-10 px-4">
              <div className="inline-flex text-[11px] px-2 py-1 rounded-full border border-border bg-secondary/60 backdrop-blur">
                Click to open
              </div>
            </div>
          </div>
        </button>

        {imgs.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="text-xs text-muted-foreground mr-2">
              {activeImageIndex + 1}/{imgs.length}
            </div>
            <div className="flex gap-2 overflow-x-auto pr-1">
              {imgs.map((url, idx) => (
                <button
                  key={`${url}_${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImageIndex(idx);
                  }}
                  className={cn(
                    "shrink-0 overflow-hidden rounded-xl border transition-colors",
                    idx === activeImageIndex ? "border-primary/60" : "border-border hover:border-primary/40"
                  )}
                  title={`View image ${idx + 1}`}
                >
                  <img src={url} alt={`Chart ${idx + 1}`} className="h-16 w-28 object-cover bg-black/20" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const EntrySinglePreview = ({
    entry,
    className,
    onOpen,
  }: {
    entry: JournalEntry;
    className?: string;
    onOpen: (idx: number) => void;
  }) => {
    const imgs = getEntryImages(entry);
    if (!imgs.length) return null;

    // only show FIRST image in list card
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(0);
        }}
        className={cn(
          "mt-3 block w-full overflow-hidden rounded-xl border border-border hover:border-primary/40 transition-colors",
          className
        )}
        title="Open image"
      >
        <img src={imgs[0]} alt="Chart preview" className="h-24 w-full object-cover bg-black/20" loading="lazy" />
      </button>
    );
  };

  const PnlPill = ({ pnl }: { pnl: number }) => {
    const up = pnl >= 0;
    return (
      <span
        className={cn(
          "font-mono text-xs px-2.5 py-1 rounded-full border",
          up ? "text-success border-success/20 bg-success/10" : "text-destructive border-destructive/20 bg-destructive/10"
        )}
      >
        {up ? "+" : "-"}${Math.abs(pnl)}
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold mb-1">Trade Journal</h1>
          <p className="text-muted-foreground">
            Document your trades and compare live vs backtest performance
          </p>
        </div>

        {activeTab === "journal" && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span className="px-2 py-1 rounded-full border border-border bg-secondary/40">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"}
            </span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 rounded-full border border-border bg-secondary/40">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      {imageOpen && activeImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setImageOpen(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              className="absolute -top-12 right-0"
              onClick={() => setImageOpen(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>

            <img
              src={activeImageUrl}
              alt="TradingView chart full screen"
              className="w-full max-h-[85vh] object-contain rounded-2xl border border-border"
            />

            {images.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                {images.map((url, idx) => (
                  <button
                    key={`${url}_${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={cn(
                      "overflow-hidden rounded-xl border transition-colors",
                      idx === activeImageIndex ? "border-primary/60" : "border-border hover:border-primary/40"
                    )}
                    title={`View image ${idx + 1}`}
                  >
                    <img src={url} alt={`Chart ${idx + 1}`} className="h-16 w-24 object-cover bg-black/20" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating preview (only on Journal tab) */}
      {activeTab === "journal" && showFloatingPreview && selectedEntry && !isEditing && (
        <div className="fixed right-6 bottom-6 z-[55] w-[760px] max-w-[calc(100vw-3rem)]">
          <div className="glass-card p-4 border border-border shadow-lg">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-semibold truncate">{selectedEntry.pair}</div>
                  <PnlPill pnl={selectedEntry.pnl} />

                  <span className="text-[11px] px-2 py-1 rounded-full border border-border uppercase">
                    {selectedEntry.side}
                  </span>

                  <span className={cn("text-[11px] px-2 py-1 rounded-full capitalize", emotionColors[selectedEntry.emotion])}>
                    {selectedEntry.emotion}
                  </span>

                  {selectedEntry.trade_id && (
                    <button
                      type="button"
                      onClick={() => goToTrade(selectedEntry.trade_id!)}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/40"
                      title="Go to trade"
                    >
                      <CornerUpRight className="w-3.5 h-3.5" />
                      Go to trade
                    </button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  {selectedEntry.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedEntry.tv_url && (
                  <a
                    href={selectedEntry.tv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border hover:border-primary/40 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    TradingView
                  </a>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowFloatingPreview(false)}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {images.length ? (
              <button
                type="button"
                onClick={() => {
                  setActiveImageIndex(0);
                  setImageOpen(true);
                }}
                className="block w-full overflow-hidden rounded-2xl border border-border hover:border-primary/40 transition-colors"
                title="Open full screen"
              >
                <img
                  src={images[0]}
                  alt="TradingView chart"
                  className="w-full max-h-[320px] object-contain bg-black/20"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="rounded-2xl border border-border p-4 bg-secondary/30">
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {selectedEntry.notes?.trim() ? selectedEntry.notes : "No notes."}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="trades" className="flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Trades
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Journal Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="animate-fade-in">
          <TradesSection
            focusTradeId={focusTradeId}
            onClearFocus={() => setFocusTradeId(null)}
            onOpenJournalEntry={(entryId) => {
              setActiveTab("journal");
              setPendingEntryId(entryId);
            }}
          />
        </TabsContent>

        <TabsContent value="journal" className="animate-fade-in">
          <AddJournalEntryDialog
            open={addJournalOpen}
            onOpenChange={setAddJournalOpen}
            onCreated={() => setJournalRefreshKey((k) => k + 1)}
          />

          {/* POLISHED TOP TOOLBAR */}
          <div className="glass-card p-3 mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search pair, notes, tags, emotion..."
                    className="w-full pl-10 pr-10 py-2.5 bg-secondary/60 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-secondary/60 hover:border-primary/40 transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2 md:justify-end">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="h-10 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40 w-full md:w-auto"
                  >
                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="glow"
                    size="default"
                    onClick={() => setAddJournalOpen(true)}
                    className="flex items-center gap-2 transition-transform hover:scale-[1.01]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </Button>

                  <Button
                    variant="outline"
                    size="default"
                    className="flex items-center gap-2"
                    onClick={() => {
                      setFilterOpen((v) => !v);
                      setDateRangeOpen(false);
                    }}
                  >
                    <Filter className="w-4 h-4" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="default"
                    className="flex items-center gap-2"
                    onClick={() => {
                      setDateRangeOpen((v) => !v);
                      setFilterOpen(false);
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                    Date Range
                  </Button>

                  {activeFilterCount > 0 && (
                    <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
                      Clear filters
                    </Button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-medium">{visibleEntries.length}</span> of{" "}
                  <span className="font-medium">{entries.length}</span>
                </div>
              </div>
            </div>
          </div>

          {filterOpen && (
            <div className="glass-card p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Side</p>
                  <select
                    value={filterSide}
                    onChange={(e) => setFilterSide(e.target.value as any)}
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  >
                    <option value="all">All</option>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Emotion</p>
                  <select
                    value={filterEmotion}
                    onChange={(e) => setFilterEmotion(e.target.value as any)}
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  >
                    <option value="all">All</option>
                    {EMOTIONS.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pair contains</p>
                  <input
                    value={filterPair}
                    onChange={(e) => setFilterPair(e.target.value)}
                    placeholder="e.g. XAUUSD"
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tag contains</p>
                  <input
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    placeholder="e.g. fvg"
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Active filters: <span className="font-medium">{activeFilterCount}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearFilters}>
                    Reset
                  </Button>
                  <Button variant="outline" onClick={() => setFilterOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}

          {dateRangeOpen && (
            <div className="glass-card p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-secondary/60 text-white border border-border rounded-xl px-2 py-2 text-sm w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Clear
                  </Button>
                  <Button variant="outline" onClick={() => setDateRangeOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Date filter is inclusive (From 00:00 → To 23:59).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT LIST */}
            <div className="space-y-3">
              {visibleEntries.length === 0 ? (
                <div className="glass-card p-6">
                  <div className="text-sm text-muted-foreground">No journal entries found.</div>
                </div>
              ) : (
                visibleEntries.map((entry) => {
                  const entryImgs = getEntryImages(entry);
                  const dateLabel = entry.entry_time ? new Date(entry.entry_time).toLocaleDateString() : "";

                  const tags = (entry.tags ?? []).filter(Boolean);
                  const shownTags = tags.slice(0, 3);
                  const extraTagCount = Math.max(0, tags.length - shownTags.length);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => selectEntry(entry)}
                      className={cn(
                        "glass-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:-translate-y-[1px]",
                        selectedEntry?.id === entry.id && "border-primary/60 bg-primary/5 ring-1 ring-primary/25"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center border border-border bg-secondary/30",
                                entry.side === "buy" ? "text-success" : "text-destructive"
                              )}
                            >
                              {entry.side === "buy" ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">{entry.pair}</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-border uppercase text-muted-foreground">
                                  {entry.side}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">{dateLabel}</div>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <PnlPill pnl={entry.pnl} />
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.notes?.trim() ? entry.notes : "No notes."}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[11px] px-2 py-1 rounded-full capitalize", emotionColors[entry.emotion])}>
                            {entry.emotion}
                          </span>

                          {entryImgs.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground">
                              <ImageIcon className="w-3.5 h-3.5" />
                              {entryImgs.length}
                            </span>
                          )}

                          {shownTags.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground">
                              <Tag className="w-3.5 h-3.5" />
                              {shownTags.join(", ")}
                              {extraTagCount > 0 ? ` +${extraTagCount}` : ""}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {entry.trade_id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTrade(entry.trade_id!);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                              title="Go to trade"
                            >
                              <CornerUpRight className="w-3.5 h-3.5" />
                              Trade
                            </button>
                          )}

                          {entry.tv_url && (
                            <a
                              href={entry.tv_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                              title="Open TradingView"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              TV
                            </a>
                          )}
                        </div>
                      </div>

                      <EntrySinglePreview
                        entry={entry}
                        onOpen={() => {
                          setSelectedEntry(entry);
                          setActiveImageIndex(0);
                          setImageOpen(true);
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT PANEL */}
            <div className="lg:col-span-2">
              {selectedEntry ? (
                <div className="glass-card p-6 animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center border border-border bg-secondary/30",
                          selectedEntry.side === "buy" ? "text-success" : "text-destructive"
                        )}
                      >
                        {selectedEntry.side === "buy" ? (
                          <ArrowUpRight className="w-6 h-6" />
                        ) : (
                          <ArrowDownRight className="w-6 h-6" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                          {isEditing ? (
                            <input
                              value={draftPair}
                              onChange={(e) => setDraftPair(e.target.value)}
                              className="bg-transparent border border-border rounded-xl px-3 py-1 text-xl w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          ) : (
                            <span className="truncate">{selectedEntry.pair}</span>
                          )}

                          <span className="text-[11px] px-2 py-1 rounded-full border border-border uppercase text-muted-foreground">
                            {(isEditing ? draftSide : selectedEntry.side).toUpperCase()}
                          </span>

                          <span className={cn("text-[11px] px-2 py-1 rounded-full capitalize", emotionColors[selectedEntry.emotion])}>
                            {selectedEntry.emotion}
                          </span>
                        </h2>

                        <p className="text-sm text-muted-foreground">
                          {selectedEntry.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : selectedDateLabel}
                        </p>
                      </div>
                    </div>

                    <div className="text-left md:text-right shrink-0">
                      <PnlPill pnl={selectedEntry.pnl} />
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {selectedEntry.trade_id && !isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => goToTrade(selectedEntry.trade_id!)}
                        className="flex items-center gap-2"
                      >
                        <CornerUpRight className="w-4 h-4" />
                        Go to trade
                      </Button>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-wrap w-full">
                        <span className="text-xs text-muted-foreground">TradingView URL</span>
                        <input
                          value={draftTvUrl}
                          onChange={(e) => setDraftTvUrl(e.target.value)}
                          placeholder="https://www.tradingview.com/x/AbCdEf12/"
                          className="bg-transparent border border-border rounded-xl px-3 py-2 text-sm w-full md:w-[520px] max-w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    ) : (
                      selectedEntry.tv_url && (
                        <a
                          href={selectedEntry.tv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-border hover:border-primary/40 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open TradingView
                        </a>
                      )
                    )}
                  </div>

                  <div ref={stickySentinelRef} className="h-px w-full" />
                  <PreviewCard />

                  {/* Multi-image editor */}
                  {isEditing && (
                    <div className="mb-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Chart images (up to 3)
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {draftImageSlots.filter(Boolean).length}/3
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[0, 1, 2].map((slotIdx) => {
                          const url = draftImageSlots[slotIdx];
                          const preview = newImagePreviewUrls[slotIdx];
                          const file = newImageFiles[slotIdx];
                          const shown = preview || url;

                          return (
                            <div key={slotIdx} className="rounded-2xl border border-border bg-secondary/20 overflow-hidden">
                              <div className="p-3 flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">Image {slotIdx + 1}</div>
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-xl border border-border hover:border-primary/40 cursor-pointer">
                                    Replace
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        setSlotFile(slotIdx, f);
                                      }}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded-xl border border-border hover:border-destructive/50 hover:text-destructive transition-colors"
                                    onClick={() => clearSlot(slotIdx)}
                                    title="Remove this image"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {shown ? (
                                <div className="border-t border-border">
                                  <img
                                    src={shown}
                                    alt={`Slot ${slotIdx + 1}`}
                                    className="h-28 w-full object-cover bg-black/20"
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <div className="border-t border-border p-4 text-xs text-muted-foreground">
                                  Empty slot. Click “Replace” to add.
                                </div>
                              )}

                              {file && (
                                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                                  Selected: <span className="font-medium">{file.name}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* keep legacy draft around (backwards compat) */}
                      <div className="hidden">{draftTvImageUrl}</div>
                    </div>
                  )}

                  {/* Meta grid (polished) */}
                  <div className="rounded-2xl border border-border bg-secondary/20 p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Side</p>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={draftSide === "buy" ? "default" : "outline"}
                              onClick={() => setDraftSide("buy")}
                            >
                              Buy
                            </Button>
                            <Button
                              type="button"
                              variant={draftSide === "sell" ? "default" : "outline"}
                              onClick={() => setDraftSide("sell")}
                            >
                              Sell
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm font-medium uppercase">{selectedEntry.side}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">PnL</p>
                        {isEditing ? (
                          <input
                            value={draftPnl}
                            onChange={(e) => setDraftPnl(e.target.value)}
                            className="bg-transparent border border-border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                            placeholder="0"
                          />
                        ) : (
                          <p className="text-sm font-medium">{selectedEntry.pnl}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Emotion</p>
                        {isEditing ? (
                          <select
                            value={draftEmotion}
                            onChange={(e) => setDraftEmotion(e.target.value as JournalEntry["emotion"])}
                            className="bg-transparent border border-border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            {EMOTIONS.map((em) => (
                              <option key={em} value={em}>
                                {em}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={cn("inline-flex text-xs px-2 py-1 rounded-full capitalize", emotionColors[selectedEntry.emotion])}>
                            {selectedEntry.emotion}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Entry time</p>
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={draftEntryTime}
                            onChange={(e) => setDraftEntryTime(e.target.value)}
                            className="bg-transparent border border-border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        ) : (
                          <p className="text-sm font-medium">
                            {selectedEntry.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : "-"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      {isEditing ? (
                        <input
                          value={draftTags}
                          onChange={(e) => setDraftTags(e.target.value)}
                          placeholder="comma,separated,tags"
                          className="bg-transparent border border-border rounded-xl px-3 py-2 text-sm w-full md:w-[520px] max-w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <>
                          {(selectedEntry.tags ?? []).length ? (
                            (selectedEntry.tags ?? []).map((tag) => (
                              <span key={tag} className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/10">
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No tags</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Trade Notes</label>
                    <Textarea
                      value={isEditing ? draftNotes : selectedEntry.notes ?? ""}
                      onChange={(e) => isEditing && setDraftNotes(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Document your thoughts about this trade..."
                      className={cn(
                        "min-h-[220px] bg-muted/40 border-border resize-none rounded-2xl",
                        !isEditing && "opacity-90"
                      )}
                    />
                  </div>

                  {/* Footer actions */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-6">
                    <div className="flex gap-2 flex-wrap">
                      {!isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditing(true);
                              hydrateDraftFromEntry(selectedEntry);
                            }}
                            className="flex items-center gap-2"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </Button>

                          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={deleting} className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                {deleting ? "Deleting..." : "Delete"}
                              </Button>
                            </AlertDialogTrigger>

                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this journal entry?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This cannot be undone. This will permanently delete the entry for{" "}
                                  <span className="font-medium">{selectedEntry?.pair}</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteConfirmed();
                                  }}
                                  disabled={deleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleting ? "Deleting…" : "Delete permanently"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={handleCancelEdits}>
                            Cancel
                          </Button>

                          <Button variant="glow" onClick={handleSave} disabled={!isDirty || saving}>
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </>
                      )}
                    </div>

                    {!isEditing && images.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setImageOpen(true)}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Fullscreen
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 text-sm text-muted-foreground">
                  Select an entry to view details.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
