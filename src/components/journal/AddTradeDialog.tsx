import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export function AddTradeDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();

  const [pair, setPair] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");

  // ✅ Backtest-only inputs
  const [pnl, setPnl] = useState("");
  const [duration, setDuration] = useState("");

  // ✅ Backtest-only extras
  const [notes, setNotes] = useState("");
  const [chartUrl, setChartUrl] = useState("");

  const [riskReward, setRiskReward] = useState("");
  const [strategy, setStrategy] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"live" | "backtest">("live");

  const reset = () => {
    setPair("");
    setSide("buy");
    setEntry("");
    setExit("");
    setPnl("");
    setDuration("");
    setRiskReward("");
    setStrategy("");
    setNotes("");
    setChartUrl("");
  };

  // ✅ When switching to LIVE, force it to be a plan: no pnl/duration/notes/chart
  useEffect(() => {
    if (accountType === "live") {
      setPnl("");
      setDuration("");
      setNotes("");
      setChartUrl("");
    }
  }, [accountType]);

  const handleCreate = async () => {
    if (!user) return;

    const cleanPair = pair.trim().toUpperCase(); // ✅ enforce uppercase on save
    if (!cleanPair) return;

    setLoading(true);

    const isBacktest = accountType === "backtest";

    const payload: any = {
      user_id: user.id,
      account_type: accountType,
      trade_time: new Date().toISOString(),
      pair: cleanPair, // ✅ saved uppercase
      side,
      entry: entry === "" ? null : Number(entry),
      exit: exit === "" ? null : Number(exit),
      risk_reward: riskReward === "" ? null : Number(riskReward),
      strategy: strategy.trim() ? strategy.trim() : null,

      // ✅ RULE:
      // LIVE => planned until edited (pnl=0, duration=null)
      // BACKTEST => allow entering results now
      pnl: isBacktest ? (pnl === "" ? 0 : Number(pnl)) : 0,
      duration: isBacktest ? (duration.trim() ? duration.trim() : null) : null,

      // ✅ Backtest extras
      notes: isBacktest ? (notes.trim() ? notes.trim() : null) : null,
      chart_url: isBacktest ? (chartUrl.trim() ? chartUrl.trim() : null) : null,
    };

    const { error } = await supabase.from("trades").insert([payload]);

    setLoading(false);

    if (error) {
      console.error("Insert trade error:", error);
      return;
    }

    reset();
    setAccountType("live");
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {accountType === "live" ? "Add trade plan (Live)" : "Add backtest trade"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Pair</Label>
            <Input
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())} // ✅ uppercase while typing
              placeholder="EUR/USD"
            />
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={side === "buy" ? "default" : "outline"}
                onClick={() => setSide("buy")}
              >
                Buy
              </Button>
              <Button
                type="button"
                variant={side === "sell" ? "default" : "outline"}
                onClick={() => setSide("sell")}
              >
                Sell
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Account</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={accountType === "live" ? "default" : "outline"}
                onClick={() => setAccountType("live")}
              >
                Live
              </Button>
              <Button
                type="button"
                variant={accountType === "backtest" ? "default" : "outline"}
                onClick={() => setAccountType("backtest")}
              >
                Backtest
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Entry</Label>
              <Input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="1.0850" />
            </div>
            <div className="grid gap-2">
              <Label>Exit</Label>
              <Input value={exit} onChange={(e) => setExit(e.target.value)} placeholder="1.0892" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>R:R</Label>
              <Input value={riskReward} onChange={(e) => setRiskReward(e.target.value)} placeholder="2.1" />
            </div>
            <div className="grid gap-2">
              <Label>Strategy</Label>
              <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="FVG / Breakout" />
            </div>
          </div>

          {/* ✅ Backtest-only: allow immediate results */}
          {accountType === "backtest" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>PnL</Label>
                  <Input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="420" />
                </div>
                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="15m / 1h / 2d"
                  />
                </div>
              </div>

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
                  className="min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you see? Why did you take it? What would you improve?"
                />
              </div>
            </>
          )}

          {/* ✅ Live helper text */}
          {accountType === "live" && (
            <p className="text-xs text-muted-foreground">
              Live trades are saved as <b>Planned</b> (PnL = 0). Add results later using the pencil edit button.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
