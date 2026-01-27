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
  ChevronLeft,
  ChevronRight,
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

  // ✅ NEW: multiple images
  tv_image_urls?: string[] | null;

  // ✅ link to trade
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

function getEntryImages(e: JournalEntry | null | undefined): string[] {
  if (!e) return [];
  const arr = Array.isArray(e.tv_image_urls) ? e.tv_image_urls.filter(Boolean) : [];
  if (arr.length) return arr;
  if (e.tv_image_url) return [e.tv_image_url];
  return [];
}

export default function Journal() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("trades");

  // ✅ trade focus when clicking "Go to trade"
  const [focusTradeId, setFocusTradeId] = useState<string | null>(null);

  // ✅ open a specific journal entry when coming from trade -> linked modal -> "Open"
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);

  // Journal data
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Add entry dialog
  const [addJournalOpen, setAddJournalOpen] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  // Search
  const [search, setSearch] = useState("");

  // Fullscreen image viewer
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ NEW: themed delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Editable draft fields
  const [draftPair, setDraftPair] = useState("");
  const [draftSide, setDraftSide] = useState<"buy" | "sell">("buy");
  const [draftPnl, setDraftPnl] = useState<string>("0");
  const [draftEmotion, setDraftEmotion] = useState<JournalEntry["emotion"]>("neutral");
  const [draftTags, setDraftTags] = useState<string>("");
  const [draftEntryTime, setDraftEntryTime] = useState<string>("");
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [draftTvUrl, setDraftTvUrl] = useState<string>("");
  const [draftTvImageUrl, setDraftTvImageUrl] = useState<string>("");

  const [newChartFile, setNewChartFile] = useState<File | null>(null);
  const [newChartPreviewUrl, setNewChartPreviewUrl] = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("new_old");

  const [filterSide, setFilterSide] = useState<"all" | "buy" | "sell">("all");
  const [filterEmotion, setFilterEmotion] = useState<"all" | JournalEntry["emotion"]>("all");
  const [filterPair, setFilterPair] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const stickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [showFloatingPreview, setShowFloatingPreview] = useState(false);

  // ✅ NEW: ensure the floating preview never shows on the Trades tab
  useEffect(() => {
    if (activeTab !== "journal") {
      setShowFloatingPreview(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const el = stickySentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingPreview(!entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );

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

  const selectedDateLabel = selectedEntry?.entry_time
    ? new Date(selectedEntry.entry_time).toLocaleDateString()
    : "";

  const selectedImages = useMemo(() => getEntryImages(selectedEntry), [selectedEntry]);
  const activeFullscreenUrl = selectedImages[activeImageIndex] ?? null;

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
      tv_image_url: selectedEntry.tv_image_url ?? "",
      entry_time: selectedEntry.entry_time ?? "",
    };

    const draft = {
      pair: draftPair.trim(),
      side: draftSide,
      pnl: safeNumber(draftPnl, 0),
      emotion: draftEmotion,
      tags: draftTags.trim(),
      notes: draftNotes,
      tv_url: draftTvUrl.trim(),
      tv_image_url: draftTvImageUrl.trim(),
      entry_time: draftEntryTime ? new Date(draftEntryTime).toISOString() : base.entry_time,
    };

    const same =
      base.pair === draft.pair &&
      base.side === draft.side &&
      base.pnl === draft.pnl &&
      base.emotion === draft.emotion &&
      base.tags === draft.tags &&
      base.notes === draft.notes &&
      base.tv_url === draft.tv_url &&
      base.tv_image_url === draft.tv_image_url &&
      base.entry_time === draft.entry_time;

    return !same || !!newChartFile;
  }, [
    selectedEntry,
    draftPair,
    draftSide,
    draftPnl,
    draftEmotion,
    draftTags,
    draftNotes,
    draftTvUrl,
    draftTvImageUrl,
    draftEntryTime,
    newChartFile,
  ]);

  const hydrateDraftFromEntry = (e: JournalEntry) => {
    setDraftPair(e.pair ?? "");
    setDraftSide((e.side ?? "buy") as "buy" | "sell");
    setDraftPnl(String(e.pnl ?? 0));
    setDraftEmotion((e.emotion ?? "neutral") as JournalEntry["emotion"]);
    setDraftTags((e.tags ?? []).join(", "));
    setDraftNotes(e.notes ?? "");
    setDraftTvUrl(e.tv_url ?? "");
    setDraftTvImageUrl(e.tv_image_url ?? "");

    try {
      const d = new Date(e.entry_time);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
      setDraftEntryTime(local);
    } catch {
      setDraftEntryTime("");
    }

    setNewChartFile(null);
    if (newChartPreviewUrl) URL.revokeObjectURL(newChartPreviewUrl);
    setNewChartPreviewUrl(null);

    // reset gallery
    setActiveImageIndex(0);
  };

  useEffect(() => {
    return () => {
      if (newChartPreviewUrl) URL.revokeObjectURL(newChartPreviewUrl);
    };
  }, [newChartPreviewUrl]);

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
        const next = prev
          ? mapped.find((x) => x.id === prev.id) ?? mapped[0] ?? null
          : mapped[0] ?? null;
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
  };

  // ✅ if TradesSection asks to open a specific entry, do it after entries exist
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

  const handleSave = async () => {
    if (!selectedEntry) return;
    setSaving(true);

    try {
      let nextImageUrl = draftTvImageUrl.trim() || null;
      if (newChartFile) {
        const uploaded = await uploadChartImage(newChartFile);
        if (uploaded) nextImageUrl = uploaded;
      }

      const payload: any = {
        pair: draftPair.trim(),
        side: draftSide,
        pnl: draftPnl.trim() === "" ? null : Number(draftPnl),
        emotion: draftEmotion,
        notes: draftNotes.trim() || null,
        tags: normalizeTags(draftTags),
        tv_url: draftTvUrl.trim() || null,
        tv_image_url: nextImageUrl,
        entry_time: draftEntryTime ? new Date(draftEntryTime).toISOString() : selectedEntry.entry_time,
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

  // ✅ NEW: themed confirm delete
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

  const openFullscreenAt = (idx: number) => {
    setActiveImageIndex(idx);
    setImageOpen(true);
  };

  const nextFullscreen = () => {
    if (!selectedImages.length) return;
    setActiveImageIndex((i) => (i + 1) % selectedImages.length);
  };

  const prevFullscreen = () => {
    if (!selectedImages.length) return;
    setActiveImageIndex((i) => (i - 1 + selectedImages.length) % selectedImages.length);
  };

  // keyboard: esc close, arrows nav
  useEffect(() => {
    if (!imageOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageOpen(false);
      if (e.key === "ArrowRight") nextFullscreen();
      if (e.key === "ArrowLeft") prevFullscreen();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageOpen, selectedImages.length]);

  const PreviewCard = ({ className }: { className?: string }) => {
    const images = getEntryImages(selectedEntry);
    if (!images.length || isEditing) return null;

    return (
      <div className={cn("mb-6", className)}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-semibold truncate">{selectedEntry?.pair}</div>

              <div
                className={cn(
                  "font-mono font-semibold",
                  (selectedEntry?.pnl ?? 0) >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {(selectedEntry?.pnl ?? 0) >= 0 ? "+" : "-"}${Math.abs(selectedEntry?.pnl ?? 0)}
              </div>

              <span className="text-xs px-2 py-1 rounded-full border border-border uppercase">
                {selectedEntry?.side}
              </span>

              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full capitalize",
                  selectedEntry ? emotionColors[selectedEntry.emotion] : ""
                )}
              >
                {selectedEntry?.emotion}
              </span>
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              {selectedEntry?.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : ""}
            </div>
          </div>

          {selectedEntry?.tv_url && (
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

        {/* Main image + thumbnails */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => openFullscreenAt(activeImageIndex)}
            className="block overflow-hidden rounded-xl border border-border hover:border-primary/40 transition-colors w-full"
            title="Open full screen"
          >
            <img
              src={images[activeImageIndex] ?? images[0]}
              alt="TradingView chart"
              className="w-full max-h-[520px] object-contain bg-black/20"
              loading="lazy"
            />
          </button>

          {images.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground mr-2">
                {activeImageIndex + 1}/{images.length}
              </div>
              <div className="flex gap-2 overflow-x-auto pr-1">
                {images.map((url, idx) => (
                  <button
                    key={`${url}_${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={cn(
                      "shrink-0 overflow-hidden rounded-lg border transition-colors",
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
      </div>
    );
  };

  const goToTrade = (tradeId: string) => {
    setShowFloatingPreview(false); // ✅ hides popup immediately when jumping to Trades
    setActiveTab("trades");
    setFocusTradeId(tradeId);
  };

  const EntryThumbGrid = ({
    images,
    onOpen,
    className,
  }: {
    images: string[];
    onOpen: (idx: number) => void;
    className?: string;
  }) => {
    if (!images.length) return null;

    // 1: single wide thumb
    if (images.length === 1) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(0);
          }}
          className={cn(
            "block w-full mt-3 overflow-hidden rounded-lg border border-border hover:border-primary/40 transition-colors",
            className
          )}
          title="Open full screen"
        >
          <img src={images[0]} alt="TradingView chart" className="w-full h-28 object-cover bg-black/20" loading="lazy" />
        </button>
      );
    }

    // 2-3: compact grid
   // single-image preview (first image only)
return (
  <div className={cn("mt-3 overflow-hidden rounded-lg border border-border", className)}>
    <img
      src={images[0]}
      alt="Chart preview"
      className="h-28 w-full object-cover bg-black/20"
      loading="lazy"
    />
  </div>
);

  };

  return (
    <MainLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trade Journal</h1>
          <p className="text-muted-foreground">Document your trades and compare live vs backtest performance</p>
        </div>
      </div>

      {/* Fullscreen viewer (supports multi images) */}
      {imageOpen && activeFullscreenUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setImageOpen(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 flex items-center gap-2">
              {selectedImages.length > 1 && (
                <>
                  <Button type="button" variant="outline" onClick={prevFullscreen}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Prev
                  </Button>
                  <Button type="button" variant="outline" onClick={nextFullscreen}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                  <div className="ml-2 text-xs text-muted-foreground">
                    {activeImageIndex + 1}/{selectedImages.length}
                  </div>
                </>
              )}
            </div>

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
              src={activeFullscreenUrl}
              alt="TradingView chart full screen"
              className="w-full max-h-[85vh] object-contain rounded-xl border border-border bg-black/20"
            />
          </div>
        </div>
      )}

      {/* ✅ CHANGED: popup only renders while on Journal Entries tab */}
      {activeTab === "journal" && showFloatingPreview && selectedEntry && !isEditing && (
        <div className="fixed right-6 bottom-6 z-[55] w-[760px] max-w-[calc(100vw-3rem)]">
          <div className="glass-card p-4 border border-border shadow-lg">
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

                  <span className="text-xs px-2 py-1 rounded-full border border-border uppercase">
                    {selectedEntry.side}
                  </span>

                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full capitalize",
                      emotionColors[selectedEntry.emotion]
                    )}
                  >
                    {selectedEntry.emotion}
                  </span>

                  {selectedEntry.trade_id && (
                    <button
                      type="button"
                      onClick={() => goToTrade(selectedEntry.trade_id!)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:border-primary/40"
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

            {getEntryImages(selectedEntry).length ? (
              <button
                type="button"
                onClick={() => openFullscreenAt(activeImageIndex)}
                className="block w-full overflow-hidden rounded-xl border border-border hover:border-primary/40 transition-colors"
                title="Open full screen"
              >
                <img
                  src={getEntryImages(selectedEntry)[activeImageIndex] ?? getEntryImages(selectedEntry)[0]}
                  alt="TradingView chart"
                  className="w-full max-h-[520px] object-contain bg-black/20"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="rounded-xl border border-border p-4 bg-secondary/30">
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

          <div className="flex gap-4 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries..."
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-10 rounded-md border border-border bg-secondary px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary/50"
              >
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="glow"
              size="default"
              onClick={() => setAddJournalOpen(true)}
              className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
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
          </div>

          {filterOpen && (
            <div className="glass-card p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Side</p>
                  <select
                    value={filterSide}
                    onChange={(e) => setFilterSide(e.target.value as any)}
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
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
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
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
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tag contains</p>
                  <input
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    placeholder="e.g. fvg"
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-medium">{visibleEntries.length}</span> entries
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
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
                  <p className="text-xs text-muted-foreground">From (YYYY-MM-DD)</p>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">To (YYYY-MM-DD)</p>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
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
            <div className="space-y-4">
              {visibleEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No journal entries found.</div>
              ) : (
                visibleEntries.map((entry) => {
                  const imgs = getEntryImages(entry);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => selectEntry(entry)}
                      className={cn(
                        "glass-card p-4 cursor-pointer transition-all hover:border-primary/30",
                        selectedEntry?.id === entry.id && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              entry.side === "buy" ? "bg-success/10" : "bg-destructive/10"
                            )}
                          >
                            {entry.side === "buy" ? (
                              <ArrowUpRight className="w-4 h-4 text-success" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                          <span className="font-medium">{entry.pair}</span>
                        </div>

                        <span
                          className={cn(
                            "font-mono font-medium",
                            entry.pnl >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {entry.pnl >= 0 ? "+" : ""}
                          {entry.pnl}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{entry.notes}</p>

                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.trade_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToTrade(entry.trade_id!);
                            }}
                            className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                            title="Go to trade"
                          >
                            <CornerUpRight className="w-3 h-3" />
                            Go to trade
                          </button>
                        )}

                        {entry.tv_url && (
                          <a
                            href={entry.tv_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open TradingView
                          </a>
                        )}

                        {!entry.tv_url && imgs.length > 0 && (
                          <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border border-border text-muted-foreground">
                            <ImageIcon className="w-3 h-3" />
                            {imgs.length === 1 ? "Chart image" : `${imgs.length} images`}
                          </span>
                        )}
                      </div>

                      {/* ✅ multi thumb grid */}
                      <EntryThumbGrid
                        images={imgs}
                        onOpen={(idx) => {
                          setSelectedEntry(entry);
                          setActiveImageIndex(idx);
                          setImageOpen(true);
                        }}
                      />

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">
                          {entry.entry_time ? new Date(entry.entry_time).toLocaleDateString() : ""}
                        </span>
                        <span className={cn("text-xs px-2 py-1 rounded-full capitalize", emotionColors[entry.emotion])}>
                          {entry.emotion}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:col-span-2">
              {selectedEntry ? (
                <div className="glass-card p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          selectedEntry.side === "buy" ? "bg-success/10" : "bg-destructive/10"
                        )}
                      >
                        {selectedEntry.side === "buy" ? (
                          <ArrowUpRight className="w-6 h-6 text-success" />
                        ) : (
                          <ArrowDownRight className="w-6 h-6 text-destructive" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          {isEditing ? (
                            <input
                              value={draftPair}
                              onChange={(e) => setDraftPair(e.target.value)}
                              className="bg-transparent border border-border rounded-md px-2 py-1 text-xl w-[220px]"
                            />
                          ) : (
                            selectedEntry.pair
                          )}
                        </h2>
                        <p className="text-sm text-muted-foreground">{selectedDateLabel}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={cn(
                          "text-2xl font-mono font-semibold",
                          selectedEntry.pnl >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {selectedEntry.pnl >= 0 ? "+" : ""}${Math.abs(selectedEntry.pnl)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(isEditing ? draftSide : selectedEntry.side).toUpperCase()} Trade
                      </p>
                    </div>
                  </div>

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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">TradingView URL</span>
                        <input
                          value={draftTvUrl}
                          onChange={(e) => setDraftTvUrl(e.target.value)}
                          placeholder="https://www.tradingview.com/x/AbCdEf12/"
                          className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-[420px] max-w-full"
                        />
                      </div>
                    ) : (
                      selectedEntry.tv_url && (
                        <a
                          href={selectedEntry.tv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border hover:border-primary/40 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open TradingView
                        </a>
                      )
                    )}
                  </div>

                  <div ref={stickySentinelRef} className="h-px w-full" />
                  <PreviewCard />

                  {/* Editing single-image flow stays as-is (legacy). Multi-image edit can be added later. */}
                  {isEditing && (
                    <div className="mb-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Chart image (legacy)
                        </p>
                        <div className="flex items-center gap-2">
                          {draftTvImageUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (draftTvImageUrl) {
                                  setActiveImageIndex(0);
                                  setImageOpen(true);
                                }
                              }}
                            >
                              View
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDraftTvImageUrl("");
                              setNewChartFile(null);
                              if (newChartPreviewUrl) URL.revokeObjectURL(newChartPreviewUrl);
                              setNewChartPreviewUrl(null);
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      {newChartPreviewUrl ? (
                        <div className="overflow-hidden rounded-xl border border-border">
                          <img
                            src={newChartPreviewUrl}
                            alt="New chart preview"
                            className="w-full max-h-[260px] object-cover bg-black/20"
                          />
                        </div>
                      ) : draftTvImageUrl ? (
                        <div className="overflow-hidden rounded-xl border border-border">
                          <img
                            src={draftTvImageUrl}
                            alt="Chart preview"
                            className="w-full max-h-[260px] object-cover bg-black/20"
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4">
                          No chart image set.
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-sm text-muted-foreground">Replace image:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (newChartPreviewUrl) URL.revokeObjectURL(newChartPreviewUrl);
                            setNewChartFile(file);
                            setNewChartPreviewUrl(file ? URL.createObjectURL(file) : null);
                          }}
                          className="text-sm"
                        />

                        {newChartFile && (
                          <>
                            <span className="text-xs text-muted-foreground">Selected: {newChartFile.name}</span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setNewChartFile(null);
                                if (newChartPreviewUrl) URL.revokeObjectURL(newChartPreviewUrl);
                                setNewChartPreviewUrl(null);
                              }}
                            >
                              Clear selected file
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Note: multi-image editing will be added next. Current editor updates the legacy single image field.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
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
                          className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-full"
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
                          className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-full"
                        >
                          {EMOTIONS.map((em) => (
                            <option key={em} value={em}>
                              {em}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex text-xs px-2 py-1 rounded-full capitalize",
                            emotionColors[selectedEntry.emotion]
                          )}
                        >
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
                          className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {selectedEntry.entry_time ? new Date(selectedEntry.entry_time).toLocaleString() : "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {isEditing ? (
                      <input
                        value={draftTags}
                        onChange={(e) => setDraftTags(e.target.value)}
                        placeholder="comma,separated,tags"
                        className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-full max-w-[520px]"
                      />
                    ) : (
                      (selectedEntry.tags ?? []).map((tag) => (
                        <span key={tag} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                          {tag}
                        </span>
                      ))
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Trade Notes</label>
                    <Textarea
                      value={isEditing ? draftNotes : selectedEntry.notes ?? ""}
                      onChange={(e) => isEditing && setDraftNotes(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Document your thoughts about this trade..."
                      className={cn("min-h-[200px] bg-muted/50 border-border resize-none", !isEditing && "opacity-90")}
                    />
                  </div>

                  <div className="flex justify-between gap-4 mt-6">
                    <div className="flex gap-2">
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
                              <Button
                                variant="destructive"
                                disabled={deleting}
                                className="flex items-center gap-2"
                              >
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

                    {!isEditing && getEntryImages(selectedEntry).length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openFullscreenAt(activeImageIndex)}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Fullscreen
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 text-sm text-muted-foreground">Select an entry to view details.</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
