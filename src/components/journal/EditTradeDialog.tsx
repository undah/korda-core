import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export type TradeForEdit = {
  id: string;
  pair: string;
  side: "buy" | "sell";
  strategy: string;

  // planned fields (already saved on creation)
  entry: number;
  exit: number;
  riskReward: number;

  // results fields (what we edit)
  pnl: number;
  duration?: string | null;

  // backtest extras
  notes?: string | null;
  chartUrl?: string | null;

  accountType: "live" | "backtest";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: TradeForEdit | null;
  onSaved?: () => void;

  // called after a successful delete (so parent refreshes)
  onDeleted: () => void;
};

function numOrZero(v: string) {
  const t = v.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: string) {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function EditTradeDialog({
  open,
  onOpenChange,
  trade,
  onSaved,
  onDeleted,
}: Props) {
  const [loading, setLoading] = useState(false);

  const [realizedPnl, setRealizedPnl] = useState("");
  const [duration, setDuration] = useState("");

  // ✅ NEW: allow editing Exit + R:R here
  const [exit, setExit] = useState("");
  const [riskReward, setRiskReward] = useState("");

  // backtest extras local state
  const [notes, setNotes] = useState("");
  const [chartUrl, setChartUrl] = useState("");

  useEffect(() => {
    if (!trade) return;

    setRealizedPnl(trade.pnl == null ? "" : String(trade.pnl));
    setDuration(trade.duration ?? "");

    // ✅ NEW prefill
    setExit(trade.exit == null ? "" : String(trade.exit));
    setRiskReward(trade.riskReward == null ? "" : String(trade.riskReward));

    // extras
    setNotes(trade.notes ?? "");
    setChartUrl(trade.chartUrl ?? "");
  }, [trade?.id]);

  const handleSave = async () => {
    if (!trade) return;

    setLoading(true);
    try {
      const payload: any = {
        pnl: numOrZero(realizedPnl),
        duration: duration.trim() || null,

        // ✅ NEW: update exit + risk_reward from this dialog
        exit: numOrNull(exit),
        risk_reward: numOrNull(riskReward),
      };

      // Only allow notes/chart editing for BACKTEST
      if (trade.accountType === "backtest") {
        payload.notes = notes.trim() || null;
        payload.chart_url = chartUrl.trim() || null;
      }

      const { error } = await supabase
        .from("trades")
        .update(payload)
        .eq("id", trade.id);

      if (error) {
        console.error("Update trade error:", error);
        alert(error.message);
        return;
      }

      onOpenChange(false);
      onSaved?.();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!trade) return;

    const ok = window.confirm(
      `Delete this trade plan for ${trade.pair}? This cannot be undone.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("trades").delete().eq("id", trade.id);

      if (error) {
        console.error("Delete trade error:", error);
        alert(error.message);
        return;
      }

      onOpenChange(false);
      onDeleted();
    } finally {
      setLoading(false);
    }
  };

  if (!trade) return null;

  const isLive = trade.accountType === "live";
  const isBacktest = trade.accountType === "backtest";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLive ? "Add trade result" : "Edit backtest result"}</DialogTitle>
        </DialogHeader>

        {/* Planned summary (read-only) */}
        <div className="grid gap-3 p-3 rounded-lg border border-border bg-secondary/30">
          <div className="flex items-center justify-between">
            <div className="font-medium">{trade.pair}</div>
            <span
              className={cn(
                "text-xs px-2 py-1 rounded-full border",
                trade.side === "buy"
                  ? "border-success/30 text-success"
                  : "border-destructive/30 text-destructive"
              )}
            >
              {trade.side.toUpperCase()}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            Planned: {trade.entry?.toFixed?.(4)} → {trade.exit?.toFixed?.(4)} • RR{" "}
            {Number.isFinite(trade.riskReward) ? trade.riskReward : "-"}{" "}
            {trade.strategy ? `• ${trade.strategy}` : ""}
          </div>

          {isLive && (
            <p className="text-xs text-muted-foreground">
              Live trades start as <b>Planned</b> (PnL = 0). Add the result here after execution.
            </p>
          )}
        </div>

        {/* Results */}
        <div className="grid gap-4 mt-2">
          {/* ✅ NEW: Exit + R:R inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Exit</Label>
              <Input
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                placeholder="2561"
              />
            </div>

            <div className="grid gap-2">
              <Label>R:R</Label>
              <Input
                value={riskReward}
                onChange={(e) => setRiskReward(e.target.value)}
                placeholder="2.1"
              />
            </div>
          </div>

          {/* existing PnL + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{isLive ? "Realized PnL" : "PnL"}</Label>
              <Input
                value={realizedPnl}
                onChange={(e) => setRealizedPnl(e.target.value)}
                placeholder="420"
              />
              {isLive && (
                <p className="text-xs text-muted-foreground">
                  Keep <b>0</b> if you want it to stay <b>Planned</b>.
                </p>
              )}
            </div>

            <div className="grid gap-2 justify-end">
  <Label>Duration</Label>
  <Input
    value={duration}
    onChange={(e) => setDuration(e.target.value)}
    placeholder="15m / 1h / 2d"
  />
  {/* spacer to visually align with PnL helper text */}
  {isLive && <div className="h-[18px]" />}
</div>

          </div>

          {/* Backtest-only: notes + chart */}
          {isBacktest && (
            <>
              <div className="grid gap-2">
                <Label>Chart link</Label>
                <Input
                  value={chartUrl}
                  onChange={(e) => setChartUrl(e.target.value)}
                  placeholder="https://www.tradingview.com/x/..."
                />
                <p className="text-xs text-muted-foreground">
                  Paste a TradingView link (or any URL) to the chart screenshot.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <textarea
                  className="min-h-[110px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you see? Why did you take it? What would you improve?"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
