import { useEffect, useRef, useState } from "react";
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

function toDatetimeLocalValue(d: Date) {
  // YYYY-MM-DDTHH:mm (local)
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToIso(value: string) {
  // value: "YYYY-MM-DDTHH:mm" in local time → convert to ISO
  const d = new Date(value);
  // If invalid, fallback to now
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AddTradeDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();

  const [pair, setPair] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [accountType, setAccountType] = useState<"live" | "backtest">("live");
  const [strategy, setStrategy] = useState("");

  // ✅ LIVE-only
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [riskReward, setRiskReward] = useState("");

  // ✅ BACKTEST-only
  const [tradeDateLocal, setTradeDateLocal] = useState<string>(() => toDatetimeLocalValue(new Date()));

  // Result
  const [risk, setRisk] = useState("1000"); // ✅ default 1000
  const [btPnl, setBtPnl] = useState("");
  const [btRr, setBtRr] = useState("");

  // Extras
  const [duration, setDuration] = useState("");
  const [chartUrl, setChartUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);

  // Track which field user edited last so we can auto-sync correctly
  const lastEditedRef = useRef<"rr" | "pnl" | null>(null);

  const reset = () => {
    setPair("");
    setSide("buy");
    setStrategy("");

    setEntry("");
    setExit("");
    setRiskReward("");

    setTradeDateLocal(toDatetimeLocalValue(new Date()));
    setRisk("1000");
    setBtPnl("");
    setBtRr("");

    setDuration("");
    setChartUrl("");
    setNotes("");

    lastEditedRef.current = null;
  };

  // ✅ When switching to LIVE, clear backtest fields
  useEffect(() => {
    if (accountType === "live") {
      setTradeDateLocal(toDatetimeLocalValue(new Date()));
      setRisk("1000");
      setBtPnl("");
      setBtRr("");
      setDuration("");
      setChartUrl("");
      setNotes("");
      lastEditedRef.current = null;
    }
  }, [accountType]);

  // ✅ Auto-calc + auto-sync between RR and PnL using Risk ($)
  useEffect(() => {
    if (accountType !== "backtest") return;

    const r = safeNum(risk);
    if (r === null || r === 0) return;

    const rrN = safeNum(btRr);
    const pnlN = safeNum(btPnl);

    // If user last edited RR -> compute PnL
    if (lastEditedRef.current === "rr") {
      if (rrN === null) return;
      const computed = rrN * r;
      // keep a nice string (avoid long floats)
      const next = Number.isInteger(computed) ? String(computed) : String(Number(computed.toFixed(2)));
      if (next !== btPnl) setBtPnl(next);
    }

    // If user last edited PnL -> compute RR
    if (lastEditedRef.current === "pnl") {
      if (pnlN === null) return;
      const computed = pnlN / r;
      const next = Number.isInteger(computed) ? String(computed) : String(Number(computed.toFixed(2)));
      if (next !== btRr) setBtRr(next);
    }

    // If nothing edited yet, but RR exists, compute PnL (nice default behavior)
    if (lastEditedRef.current === null && rrN !== null) {
      const computed = rrN * r;
      const next = Number.isInteger(computed) ? String(computed) : String(Number(computed.toFixed(2)));
      if (next !== btPnl) setBtPnl(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType, btRr, btPnl, risk]);

  const handleCreate = async () => {
    if (!user) return;

    const cleanPair = pair.trim().toUpperCase();
    if (!cleanPair) return;

    setLoading(true);

    const isBacktest = accountType === "backtest";

    const payload: any = {
      user_id: user.id,
      account_type: accountType,
      pair: cleanPair,
      side,
      strategy: strategy.trim() ? strategy.trim() : null,

      // trade_time:
      // live -> now
      // backtest -> picked date/time
      trade_time: isBacktest ? datetimeLocalToIso(tradeDateLocal) : new Date().toISOString(),

      // LIVE fields
      entry: !isBacktest ? (entry === "" ? null : Number(entry)) : null,
      exit: !isBacktest ? (exit === "" ? null : Number(exit)) : null,
      risk_reward: !isBacktest
        ? (riskReward === "" ? null : Number(riskReward))
        : (btRr === "" ? null : Number(btRr)),

      // Result logic:
      // LIVE is planned => pnl 0
      // BACKTEST => use btPnl (or 0)
      pnl: isBacktest ? (btPnl === "" ? 0 : Number(btPnl)) : 0,

      // Backtest extras
      duration: isBacktest ? (duration.trim() ? duration.trim() : null) : null,
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

  const title = accountType === "live" ? "Add trade plan (Live)" : "Add backtest trade";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Pair */}
          <div className="grid gap-2">
            <Label>Pair</Label>
            <Input
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
              placeholder="XAUUSD / GBPUSD / EURUSD"
            />
          </div>

          {/* Type */}
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

          {/* Account */}
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

          {/* ✅ LIVE: keep the exact layout like your 2nd image */}
          {accountType === "live" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Entry Target</Label>
                  <Input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="1.0850" />
                </div>
                <div className="grid gap-2">
                  <Label>Exit Target</Label>
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

              <p className="text-xs text-muted-foreground">
                Live trades are saved as <b>Planned</b> (PnL = 0). Add results later using the pencil edit button.
              </p>
            </>
          )}

          {/* ✅ BACKTEST: date + result (PnL+RR) + extras */}
          {accountType === "backtest" && (
            <>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="datetime-local"
                  value={tradeDateLocal}
                  onChange={(e) => setTradeDateLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Set the real date/time of this backtest trade.</p>
              </div>

              <div className="grid gap-2">
                <Label>Strategy</Label>
                <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="FVG / Breakout" />
              </div>

              {/* Result (single section, no switches) */}
              <div className="grid gap-2">
                

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Risk ($)</Label>
                    <Input
                      value={risk}
                      onChange={(e) => setRisk(e.target.value)}
                      placeholder="1000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to auto-calc PnL from RR.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>R:R</Label>
                    <Input
                      value={btRr}
                      onChange={(e) => {
                        lastEditedRef.current = "rr";
                        setBtRr(e.target.value);
                      }}
                      placeholder="2.1 (or -1)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Risk to reward
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>PnL</Label>
                  <Input
                    value={btPnl}
                    onChange={(e) => {
                      lastEditedRef.current = "pnl";
                      setBtPnl(e.target.value);
                    }}
                    placeholder="420 (or -1000)"
                  />
                  <p className="text-xs text-muted-foreground">
                    PnL ($)
                  </p>
                </div>
              </div>

              {/* Chart link (full width) */}
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

              {/* Duration (full width, not beside chart link) */}
              <div className="grid gap-2">
                <Label>Duration</Label>
                <Input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="15m / 1h / 2d"
                />
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
