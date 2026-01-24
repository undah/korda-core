
import { useEffect, useMemo, useState } from "react";
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
  X,
  ExternalLink,
  ImageOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TradesSection } from "@/components/journal/TradesSection";
import { AddJournalEntryDialog } from "@/components/journal/AddJournalEntryDialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

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
  tv_image_url?: string | null;
}

const emotionColors: Record<JournalEntry["emotion"], string> = {
  confident: "bg-success/20 text-success",
  fearful: "bg-warning/20 text-warning",
  neutral: "bg-muted text-muted-foreground",
  greedy: "bg-destructive/20 text-destructive",
};

export default function Journal() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("trades");

  // Journal data
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [notes, setNotes] = useState("");

  // Add entry dialog
  const [addJournalOpen, setAddJournalOpen] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  // Search UI
  const [search, setSearch] = useState("");

  // Fullscreen chart viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerHref, setViewerHref] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>("Chart");

  // Track broken images (prevents infinite broken thumbnails)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const openViewer = (opts: { src: string; href?: string | null; title?: string }) => {
    setViewerSrc(opts.src);
    setViewerHref(opts.href ?? null);
    setViewerTitle(opts.title ?? "Chart");
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerSrc(null);
    setViewerHref(null);
    setViewerTitle("Chart");
  };

  useEffect(() => {
    if (!viewerOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const tags = (e.tags ?? []).join(" ").toLowerCase();
      return (
        e.pair.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q) ||
        tags.includes(q) ||
        (e.emotion ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, search]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_time", { ascending: false });

      if (error) {
        console.error("Fetch journal entries error:", error);
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
        emotion: (["confident", "fearful", "neutral", "greedy"].includes(r.emotion)
          ? r.emotion
          : "neutral") as JournalEntry["emotion"],
        tv_url: r.tv_url ?? null,
        tv_image_url: r.tv_image_url ?? null,
      }));

      setEntries(mapped);

      // Maintain / set selection
      setSelectedEntry((prev) => {
        if (!prev) {
          const first = mapped[0] ?? null;
          setNotes(first?.notes ?? "");
          return first;
        }
        const updated = mapped.find((e) => e.id === prev.id);
        const next = updated ?? mapped[0] ?? null;
        setNotes(next?.notes ?? "");
        return next;
      });
    })();
  }, [user, journalRefreshKey]);

  const selectedDateLabel = selectedEntry?.entry_time
    ? new Date(selectedEntry.entry_time).toLocaleDateString()
    : "";

  return (
    <MainLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trade Journal</h1>
          <p className="text-muted-foreground">
            Document your trades and compare live vs backtest performance
          </p>
        </div>
      </div>

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
          <TradesSection />
        </TabsContent>

        <TabsContent value="journal" className="animate-fade-in">
          {/* Dialog mounted only in journal tab */}
          <AddJournalEntryDialog
            open={addJournalOpen}
            onOpenChange={setAddJournalOpen}
            onCreated={() => setJournalRefreshKey((k) => k + 1)}
          />

          {/* Search / Filter / Add */}
          <div className="flex gap-4 mb-6">
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

            <Button
              variant="glow"
              size="default"
              onClick={() => setAddJournalOpen(true)}
              className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>

            <Button variant="outline" size="default" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>

            <Button variant="outline" size="default" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Range
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Entry List */}
            <div className="space-y-4">
              {filteredEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No journal entries yet.</div>
              ) : (
                filteredEntries.map((entry) => {
                  const imgBroken = brokenImages[entry.id] === true;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setSelectedEntry(entry);
                        setNotes(entry.notes ?? "");
                      }}
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

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {entry.notes}
                      </p>

                      {/* ✅ SMALL PANEL chart preview (click opens fullscreen) */}
                      {entry.tv_image_url && !imgBroken && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewer({
                              src: entry.tv_image_url!,
                              href: entry.tv_url,
                              title: `${entry.pair} chart`,
                            });
                          }}
                          className="block w-full mt-3 overflow-hidden rounded-lg border border-border hover:border-primary/40 transition-colors"
                        >
                          <img
                            src={entry.tv_image_url}
                            alt="TradingView chart"
                            className="w-full h-32 object-cover"
                            loading="lazy"
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [entry.id]: true }))
                            }
                          />
                        </button>
                      )}

                      {entry.tv_image_url && imgBroken && (
                        <div className="mt-3 rounded-lg border border-border p-3 text-xs text-muted-foreground flex items-center gap-2">
                          <ImageOff className="w-4 h-4" />
                          Image not available
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">
                          {entry.entry_time ? new Date(entry.entry_time).toLocaleDateString() : ""}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-full capitalize",
                            emotionColors[entry.emotion]
                          )}
                        >
                          {entry.emotion}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Entry Details */}
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
                        <h2 className="text-xl font-semibold">{selectedEntry.pair}</h2>
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
                        {selectedEntry.side.toUpperCase()} Trade
                      </p>
                    </div>
                  </div>

                  {/* ✅ BIG PANEL chart actions */}
                  {(selectedEntry.tv_url || selectedEntry.tv_image_url) && (
                    <div className="flex items-center gap-2 mb-4">
                      {selectedEntry.tv_url && (
                        <a
                          href={selectedEntry.tv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex"
                        >
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Open TradingView
                          </Button>
                        </a>
                      )}
                      {selectedEntry.tv_image_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openViewer({
                              src: selectedEntry.tv_image_url!,
                              href: selectedEntry.tv_url,
                              title: `${selectedEntry.pair} chart`,
                            })
                          }
                          className="flex items-center gap-2"
                        >
                          View fullscreen
                        </Button>
                      )}
                    </div>
                  )}

                  {/* ✅ BIG PANEL chart image (click opens fullscreen) */}
                  {selectedEntry.tv_image_url && (
                    <button
                      type="button"
                      onClick={() =>
                        openViewer({
                          src: selectedEntry.tv_image_url!,
                          href: selectedEntry.tv_url,
                          title: `${selectedEntry.pair} chart`,
                        })
                      }
                      className="block w-full mb-6 overflow-hidden rounded-xl border border-border hover:border-primary/40 transition-colors"
                    >
                      <img
                        src={selectedEntry.tv_image_url}
                        alt="TradingView chart"
                        className="w-full max-h-[340px] object-cover"
                        loading="lazy"
                      />
                    </button>
                  )}

                  {/* Tags */}
                  <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {(selectedEntry.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    <button className="px-3 py-1 border border-dashed border-border text-muted-foreground text-sm rounded-full hover:border-primary/50 transition-colors">
                      + Add Tag
                    </button>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Trade Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Document your thoughts about this trade..."
                      className="min-h-[200px] bg-muted/50 border-border resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-4 mt-6">
                    <Button variant="outline">Cancel</Button>
                    <Button variant="glow">Save Changes</Button>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 text-sm text-muted-foreground">
                  Select an entry to view details.
                </div>
              )}
            </div>
          </div>

          {/* ✅ Fullscreen viewer overlay */}
          {viewerOpen && viewerSrc && (
            <div
              className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={closeViewer}
            >
              <div
                className="relative w-full max-w-6xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-muted-foreground">{viewerTitle}</div>
                  <div className="flex items-center gap-2">
                    {viewerHref && (
                      <a href={viewerHref} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Open
                        </Button>
                      </a>
                    )}
                    <Button variant="outline" size="sm" onClick={closeViewer}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-black">
                  <img
                    src={viewerSrc}
                    alt="Chart fullscreen"
                    className="w-full h-[80vh] object-contain"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
