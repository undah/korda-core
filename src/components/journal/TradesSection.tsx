import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TestTube,
  BarChart3,
  Pencil,
  Link as LinkIcon,
  StickyNote,
  BookOpen,
  ExternalLink,
  NotebookPen,
  Plus,
  Filter,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { AddTradeDialog } from "@/components/journal/AddTradeDialog";
import { AddJournalEntryDialog } from "@/components/journal/AddJournalEntryDialog";
import { EditTradeDialog } from "@/components/journal/EditTradeDialog"; // ✅ USE REAL FILE

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Trade {
  id: string;
  pair: string;
  side: "buy" | "sell";
  entry: number;
  exit: number;
  pnl: number;
  pnlPercent: number;
  date: string;
  riskReward: number;
  duration: string;
  strategy: string;
  accountType: "live" | "backtest";

  tradeTimeIso?: string | null;

  notes?: string | null;
  chartUrl?: string | null;
}

type LinkedJournalEntry = {
  id: string;
  pair: string;
  side: "buy" | "sell";
  entry_time: string;
  pnl: number | null;
  emotion: "confident" | "fearful" | "neutral" | "greedy" | null;
  notes: string | null;
  tv_url?: string | null;
  tv_image_url?: string | null;
};

interface TradeStats {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  avgRR: number;
  profitFactor: number;
}

type TradesSectionProps = {
  focusTradeId?: string | null;
  onClearFocus?: () => void;

  // lets TradesSection tell Journal.tsx to open a specific journal entry
  onOpenJournalEntry?: (entryId: string) => void;
};

const calculateStats = (trades: Trade[]): TradeStats => {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      avgRR: 0,
      profitFactor: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
  const avgPnl = totalPnl / trades.length;
  const avgRR = trades.reduce((acc, t) => acc + t.riskReward, 0) / trades.length;
  const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));

  return {
    totalTrades: trades.length,
    winRate: (wins.length / trades.length) * 100,
    avgPnl,
    totalPnl,
    avgRR,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
  };
};

function StatComparison({
  label,
  live,
  backtest,
  format = "number",
  higherIsBetter = true,
}: {
  label: string;
  live: number;
  backtest: number;
  format?: "number" | "percent" | "currency" | "ratio";
  higherIsBetter?: boolean;
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "percent":
        return `${val.toFixed(1)}%`;
      case "currency":
        return `$${val.toFixed(0)}`;
      case "ratio":
        return val === Infinity ? "∞" : val.toFixed(2);
      default:
        return val.toFixed(1);
    }
  };

  const denom = Math.abs(backtest) > 0 ? Math.abs(backtest) : 1;
  const diff = ((live - backtest) / denom) * 100;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;

  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Live</p>
          <p className="text-lg font-mono font-semibold">{formatValue(live)}</p>
        </div>

        <div className="text-center">
          <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
            {diff > 0 ? "+" : ""}
            {diff.toFixed(0)}%
          </Badge>
        </div>

        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1">Backtest</p>
          <p className="text-lg font-mono font-semibold text-muted-foreground">
            {formatValue(backtest)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getTradeStatus(trade: Trade): "planned" | "completed" {
  return Number(trade.pnl ?? 0) !== 0 ? "completed" : "planned";
}

/** ---------- filtering helpers ---------- */
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

type SortMode =
  | "new_old"
  | "old_new"
  | "az"
  | "za"
  | "pnl_high_low"
  | "pnl_low_high"
  | "rr_high_low"
  | "rr_low_high";

const SORT_LABELS: Record<SortMode, string> = {
  new_old: "New → Old",
  old_new: "Old → New",
  az: "A → Z",
  za: "Z → A",
  pnl_high_low: "PnL High → Low",
  pnl_low_high: "PnL Low → High",
  rr_high_low: "R:R High → Low",
  rr_low_high: "R:R Low → High",
};

/** ---------- Notes Dialog ---------- */
function NotesDialog({
  open,
  onOpenChange,
  trade,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trade: Trade | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>

        {!trade ? (
          <div className="text-sm text-muted-foreground">No trade selected.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{trade.pair}</span>{" "}
              <span className="text-muted-foreground">•</span>{" "}
              <span className="uppercase">{trade.side}</span>{" "}
              <span className="text-muted-foreground">•</span>{" "}
              <span>{trade.date}</span>
            </div>

            <div className="rounded-lg border border-border bg-accent/30 p-3">
              <p className="whitespace-pre-wrap text-sm">
                {trade.notes?.trim() ? trade.notes.trim() : "No notes."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ---------- Linked Journal Entries Dialog ---------- */
function LinkedJournalDialog({
  open,
  onOpenChange,
  trade,
  loading,
  entries,
  onOpenEntry,
  onAddJournalForTrade,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trade: Trade | null;
  loading: boolean;
  entries: LinkedJournalEntry[];
  onOpenEntry: (entryId: string) => void;

  // add button inside modal
  onAddJournalForTrade: (t: Trade) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {trade ? `Journal entries for ${trade.pair}` : "Linked journal entries"}
          </DialogTitle>
        </DialogHeader>

        {!trade ? (
          <div className="text-sm text-muted-foreground">No trade selected.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No journal entries linked to this trade.
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {entries.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {e.entry_time ? new Date(e.entry_time).toLocaleString() : ""}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{e.pair}</span>
                      <span className="text-xs px-2 py-1 rounded-full border border-border uppercase">
                        {e.side}
                      </span>
                      {typeof e.pnl === "number" && (
                        <span
                          className={cn(
                            "text-xs font-mono",
                            e.pnl >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {e.pnl >= 0 ? "+" : ""}
                          {e.pnl}
                        </span>
                      )}
                      {e.emotion && (
                        <span className="text-xs text-muted-foreground">• {e.emotion}</span>
                      )}
                    </div>

                    {e.notes?.trim() ? (
                      <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {e.notes.trim()}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">No notes.</div>
                    )}

                    {(e.tv_url || e.tv_image_url) && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        {e.tv_url && (
                          <a
                            href={e.tv_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            TradingView
                          </a>
                        )}
                        {e.tv_image_url && !e.tv_url && (
                          <span className="text-muted-foreground">Chart image attached</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenEntry(e.id)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          {trade ? (
            <Button
              type="button"
              variant="glow"
              onClick={() => onAddJournalForTrade(trade)}
              className="flex items-center gap-2"
            >
              <NotebookPen className="w-4 h-4" />
              {entries.length === 0 ? "Create first entry" : "Link journal entry"}
            </Button>
          ) : (
            <div />
          )}

          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ---------- Row ---------- */
function TradeRow({
  trade,
  journalCount,
  highlight,
  onEdit,
  onOpenNotes,
  onViewLinkedJournals,
}: {
  trade: Trade;
  journalCount: number;
  highlight: boolean;
  onEdit: (t: Trade) => void;
  onOpenNotes: (t: Trade) => void;
  onViewLinkedJournals: (t: Trade) => void;
}) {
  const status = getTradeStatus(trade);

  return (
    <div
      id={`trade-row-${trade.id}`}
      className={cn(
        "p-4 hover:bg-accent/50 transition-colors border-b border-border last:border-0",
        highlight && "bg-primary/5 ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              trade.side === "buy" ? "bg-success/10" : "bg-destructive/10"
            )}
          >
            {trade.side === "buy" ? (
              <ArrowUpRight className="w-5 h-5 text-success" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-destructive" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{trade.pair}</p>

              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  status === "completed"
                    ? "bg-success/20 text-success border border-success/20"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {status === "completed" ? "Completed" : "Planned"}
              </Badge>

              {!!trade.strategy && (
                <Badge variant="outline" className="text-xs">
                  {trade.strategy}
                </Badge>
              )}

              {journalCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  Journal: {journalCount}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {Number.isFinite(trade.entry) ? trade.entry.toFixed(4) : "-"} →{" "}
              {Number.isFinite(trade.exit) ? trade.exit.toFixed(4) : "-"} •{" "}
              {trade.duration || "-"}
            </p>

            {trade.accountType === "backtest" && (trade.chartUrl || trade.notes) && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                {trade.chartUrl && (
                  <a
                    href={trade.chartUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    title="Open chart"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Chart
                  </a>
                )}

                {trade.notes && trade.notes.trim().length > 0 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNotes(trade);
                    }}
                    title="Open notes"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    Notes
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <p
              className={cn(
                "font-mono font-medium",
                trade.pnl >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {status === "planned" ? "—" : `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl}`}
            </p>
            <p className="text-sm text-muted-foreground">{trade.date}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onViewLinkedJournals(trade)}
            title={
              journalCount > 0
                ? `View journal entries (${journalCount})`
                : "View journal entries"
            }
          >
            <BookOpen className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onEdit(trade)}
            title="Edit trade"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** ---------- Main Section ---------- */
export function TradesSection({
  focusTradeId,
  onClearFocus,
  onOpenJournalEntry,
}: TradesSectionProps) {
  const [activeTab, setActiveTab] = useState("compare");
  const { user } = useAuth();

  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [backtestTrades, setBacktestTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTrade, setNotesTrade] = useState<Trade | null>(null);

  // add journal dialog state
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalTrade, setJournalTrade] = useState<Trade | null>(null);

  // linked journal entries state
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [linkedTrade, setLinkedTrade] = useState<Trade | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [linkedEntries, setLinkedEntries] = useState<LinkedJournalEntry[]>([]);

  // counts map: trade_id -> count
  const [journalCounts, setJournalCounts] = useState<Record<string, number>>({});

  // highlight after focusing from journal
  const [highlightId, setHighlightId] = useState<string | null>(null);

  /** ---------- NEW: filter/sort/date-range state ---------- */
  const [sortMode, setSortMode] = useState<SortMode>("new_old");

  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const [filterSide, setFilterSide] = useState<"all" | "buy" | "sell">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "planned" | "completed">("all");
  const [filterPair, setFilterPair] = useState<string>("");
  const [filterStrategy, setFilterStrategy] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterSide !== "all") n++;
    if (filterStatus !== "all") n++;
    if (filterPair.trim()) n++;
    if (filterStrategy.trim()) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    return n;
  }, [filterSide, filterStatus, filterPair, filterStrategy, dateFrom, dateTo]);

  const clearFilters = () => {
    setFilterSide("all");
    setFilterStatus("all");
    setFilterPair("");
    setFilterStrategy("");
    setDateFrom("");
    setDateTo("");
  };

  const allTrades = useMemo(
    () => [...liveTrades, ...backtestTrades],
    [liveTrades, backtestTrades]
  );

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch trades error:", error);
        setLoading(false);
        return;
      }

      const rows = data ?? [];

      const mapped: Trade[] = (rows ?? []).map((r: any) => {
        const iso = (r.trade_time ?? r.created_at ?? null) as string | null;

        return {
          id: r.id,
          pair: r.pair ?? "",
          side: (r.side ?? "buy") as "buy" | "sell",
          entry: Number(r.entry ?? 0),
          exit: Number(r.exit ?? 0),
          pnl: Number(r.pnl ?? 0),
          pnlPercent: Number(r.pnl_percent ?? 0),
          date: new Date(iso ?? new Date().toISOString()).toLocaleString(),
          riskReward: Number(r.risk_reward ?? 0),
          duration: r.duration ?? "-",
          strategy: r.strategy ?? "",
          accountType: (r.account_type ?? "live") as "live" | "backtest",
          tradeTimeIso: iso,

          notes: r.notes ?? null,
          chartUrl: r.chart_url ?? null,
        };
      });

      setLiveTrades(mapped.filter((t) => t.accountType === "live"));
      setBacktestTrades(mapped.filter((t) => t.accountType === "backtest"));

      setLoading(false);
    })();
  }, [user, refreshKey]);

  // fetch counts for linked journal entries
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, trade_id")
        .not("trade_id", "is", null);

      if (error) {
        console.error("Fetch journal trade_id counts error:", error);
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const tid = (row as any).trade_id as string | null;
        if (!tid) continue;
        counts[tid] = (counts[tid] ?? 0) + 1;
      }
      setJournalCounts(counts);
    })();
  }, [user, refreshKey]);

  // focus + scroll + highlight when coming from Journal "Go to trade"
  useEffect(() => {
    if (!focusTradeId) return;
    if (loading) return;
    if (allTrades.length === 0) return;

    const t = allTrades.find((x) => x.id === focusTradeId);
    if (!t) return;

    setActiveTab(t.accountType === "backtest" ? "backtest" : "live");

    const id = focusTradeId;
    setTimeout(() => {
      const el = document.getElementById(`trade-row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(id);
        setTimeout(() => {
          setHighlightId((prev) => (prev === id ? null : prev));
          onClearFocus?.();
        }, 2200);
      } else {
        onClearFocus?.();
      }
    }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTradeId, loading, allTrades.length]);

  const openEdit = (t: Trade) => {
    setEditingTrade(t);
    setEditOpen(true);
  };

  const openNotes = (t: Trade) => {
    setNotesTrade(t);
    setNotesOpen(true);
  };

  const openJournal = (t: Trade) => {
    setJournalTrade(t);
    setJournalOpen(true);
  };

  const openLinked = async (t: Trade) => {
    setLinkedTrade(t);
    setLinkedEntries([]);
    setLinkedOpen(true);
    setLinkedLoading(true);

    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, pair, side, entry_time, pnl, emotion, notes, tv_url, tv_image_url")
        .eq("trade_id", t.id)
        .order("entry_time", { ascending: false });

      if (error) {
        console.error("Fetch linked journal entries error:", error);
        setLinkedEntries([]);
        return;
      }

      const mapped: LinkedJournalEntry[] = (data ?? []).map((r: any) => ({
        id: r.id,
        pair: r.pair ?? "",
        side: (r.side ?? "buy") as "buy" | "sell",
        entry_time: r.entry_time ?? r.created_at,
        pnl: r.pnl ?? null,
        emotion: r.emotion ?? null,
        notes: r.notes ?? null,
        tv_url: r.tv_url ?? null,
        tv_image_url: r.tv_image_url ?? null,
      }));

      setLinkedEntries(mapped);
    } finally {
      setLinkedLoading(false);
    }
  };

  /** ---------- NEW: apply filters + sorting ---------- */
  const filterAndSort = (trades: Trade[]) => {
    const pairQ = filterPair.trim().toLowerCase();
    const stratQ = filterStrategy.trim().toLowerCase();
    const { fromMs, toMs } = dateRangeToMs(dateFrom || undefined, dateTo || undefined);

    const filtered = trades.filter((t) => {
      if (filterSide !== "all" && t.side !== filterSide) return false;

      const status = getTradeStatus(t);
      if (filterStatus !== "all" && status !== filterStatus) return false;

      if (pairQ && !(t.pair ?? "").toLowerCase().includes(pairQ)) return false;
      if (stratQ && !(t.strategy ?? "").toLowerCase().includes(stratQ)) return false;

      if (fromMs !== null || toMs !== null) {
        const ms = safeDateMs(t.tradeTimeIso ?? null);
        if (!Number.isFinite(ms)) return false;
        if (fromMs !== null && ms < fromMs) return false;
        if (toMs !== null && ms > toMs) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "new_old") {
        const ta = safeDateMs(a.tradeTimeIso ?? null);
        const tb = safeDateMs(b.tradeTimeIso ?? null);
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      }
      if (sortMode === "old_new") {
        const ta = safeDateMs(a.tradeTimeIso ?? null);
        const tb = safeDateMs(b.tradeTimeIso ?? null);
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      }
      if (sortMode === "az") return (a.pair ?? "").localeCompare(b.pair ?? "", undefined, { sensitivity: "base" });
      if (sortMode === "za") return (b.pair ?? "").localeCompare(a.pair ?? "", undefined, { sensitivity: "base" });
      if (sortMode === "pnl_high_low") return (b.pnl ?? 0) - (a.pnl ?? 0);
      if (sortMode === "pnl_low_high") return (a.pnl ?? 0) - (b.pnl ?? 0);
      if (sortMode === "rr_high_low") return (b.riskReward ?? 0) - (a.riskReward ?? 0);
      if (sortMode === "rr_low_high") return (a.riskReward ?? 0) - (b.riskReward ?? 0);
      return 0;
    });

    return sorted;
  };

  const visibleLiveTrades = useMemo(() => filterAndSort(liveTrades), [
    liveTrades,
    sortMode,
    filterSide,
    filterStatus,
    filterPair,
    filterStrategy,
    dateFrom,
    dateTo,
  ]);

  const visibleBacktestTrades = useMemo(() => filterAndSort(backtestTrades), [
    backtestTrades,
    sortMode,
    filterSide,
    filterStatus,
    filterPair,
    filterStrategy,
    dateFrom,
    dateTo,
  ]);

  const liveStats = useMemo(() => calculateStats(visibleLiveTrades), [visibleLiveTrades]);
  const backtestStats = useMemo(() => calculateStats(visibleBacktestTrades), [visibleBacktestTrades]);

  return (
    <div className="space-y-6">
      {loading && <div className="text-sm text-muted-foreground">Loading trades…</div>}

      {!loading && liveTrades.length === 0 && backtestTrades.length === 0 && (
        <div className="text-sm text-muted-foreground">No trade plans yet.</div>
      )}

      <div className="flex items-center justify-end">
        <Button
          variant="glow"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Add Trade Plan
        </Button>
      </div>

      {/* ✅ NEW: controls row (sort + filter + date range) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="flex items-center gap-2">
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
      </div>

      {filterOpen && (
        <div className="glass-card p-4">
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
              <p className="text-xs text-muted-foreground">Status</p>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
              >
                <option value="all">All</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
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
              <p className="text-xs text-muted-foreground">Strategy contains</p>
              <input
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                placeholder="e.g. fvg"
                className="bg-secondary text-white border border-border rounded-md px-2 py-1 text-sm w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium">
                {visibleLiveTrades.length + visibleBacktestTrades.length}
              </span>{" "}
              trades
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
        <div className="glass-card p-4">
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

      <AddTradeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <AddJournalEntryDialog
        open={journalOpen}
        onOpenChange={setJournalOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
        trade={
          journalTrade
            ? {
                id: journalTrade.id,
                pair: journalTrade.pair,
                side: journalTrade.side,
                tradeTimeIso: journalTrade.tradeTimeIso ?? null,
              }
            : null
        }
      />

      {/* ✅ NOW THIS USES YOUR REAL EditTradeDialog.tsx FILE */}
      <EditTradeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        trade={
          editingTrade
            ? {
                id: editingTrade.id,
                pair: editingTrade.pair,
                side: editingTrade.side,
                strategy: editingTrade.strategy ?? "",
                entry: editingTrade.entry ?? 0,
                exit: editingTrade.exit ?? 0,
                riskReward: editingTrade.riskReward ?? 0,
                pnl: editingTrade.pnl ?? 0,
                duration: editingTrade.duration ?? null,
                notes: editingTrade.notes ?? null,
                chartUrl: editingTrade.chartUrl ?? null,
                accountType: editingTrade.accountType,
              }
            : null
        }
        onSaved={() => setRefreshKey((k) => k + 1)}
        onDeleted={() => setRefreshKey((k) => k + 1)}
      />

      <NotesDialog open={notesOpen} onOpenChange={setNotesOpen} trade={notesTrade} />

      <LinkedJournalDialog
        open={linkedOpen}
        onOpenChange={setLinkedOpen}
        trade={linkedTrade}
        loading={linkedLoading}
        entries={linkedEntries}
        onOpenEntry={(entryId) => {
          setLinkedOpen(false);
          onOpenJournalEntry?.(entryId);
        }}
        onAddJournalForTrade={(t) => {
          setLinkedOpen(false);
          openJournal(t);
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="compare" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Live Trading
          </TabsTrigger>
          <TabsTrigger value="backtest" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Backtesting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatComparison label="Win Rate" live={liveStats.winRate} backtest={backtestStats.winRate} format="percent" />
            <StatComparison label="Total P&L" live={liveStats.totalPnl} backtest={backtestStats.totalPnl} format="currency" />
            <StatComparison label="Avg P&L" live={liveStats.avgPnl} backtest={backtestStats.avgPnl} format="currency" />
            <StatComparison label="Avg R:R" live={liveStats.avgRR} backtest={backtestStats.avgRR} format="ratio" />
            <StatComparison label="Total Trades" live={liveStats.totalTrades} backtest={backtestStats.totalTrades} />
            <StatComparison label="Profit Factor" live={liveStats.profitFactor} backtest={backtestStats.profitFactor} format="ratio" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <h4 className="font-semibold">Live Trades</h4>
                <Badge className="ml-auto">{visibleLiveTrades.length}</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {visibleLiveTrades.map((trade) => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    journalCount={journalCounts[trade.id] ?? 0}
                    highlight={highlightId === trade.id}
                    onEdit={openEdit}
                    onOpenNotes={openNotes}
                    onViewLinkedJournals={openLinked}
                  />
                ))}
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TestTube className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Backtest Trades</h4>
                <Badge variant="secondary" className="ml-auto">
                  {visibleBacktestTrades.length}
                </Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {visibleBacktestTrades.map((trade) => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    journalCount={journalCounts[trade.id] ?? 0}
                    highlight={highlightId === trade.id}
                    onEdit={openEdit}
                    onOpenNotes={openNotes}
                    onViewLinkedJournals={openLinked}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="live" className="animate-fade-in">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold">All Live Trades</h4>
              <Badge>{visibleLiveTrades.length}</Badge>
            </div>
            {visibleLiveTrades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                journalCount={journalCounts[trade.id] ?? 0}
                highlight={highlightId === trade.id}
                onEdit={openEdit}
                onOpenNotes={openNotes}
                onViewLinkedJournals={openLinked}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="backtest" className="animate-fade-in">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold">All Backtest Trades</h4>
              <Badge variant="secondary">{visibleBacktestTrades.length}</Badge>
            </div>
            {visibleBacktestTrades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                journalCount={journalCounts[trade.id] ?? 0}
                highlight={highlightId === trade.id}
                onEdit={openEdit}
                onOpenNotes={openNotes}
                onViewLinkedJournals={openLinked}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
