import { useState } from "react";
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
  const [pnl, setPnl] = useState("");
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
    setRiskReward("");
    setStrategy("");
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!pair.trim()) return;

    setLoading(true);

    // IMPORTANT: if your RLS policy uses user_id, you must insert user_id
   const { error } = await supabase.from("trades").insert([
  {
    user_id: user.id,
    account_type: accountType,              // ✅ REQUIRED
    trade_time: new Date().toISOString(),   // ✅ matches your DB column
    pair,
    side,
    entry: entry === "" ? null : Number(entry),
    exit: exit === "" ? null : Number(exit),
    pnl: pnl === "" ? 0 : Number(pnl),
    risk_reward: riskReward === "" ? null : Number(riskReward),
    strategy: strategy || null,
  },
]);


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
          <DialogTitle>Add trade</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Pair</Label>
            <Input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="EUR/USD" />
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
              <Label>PnL</Label>
              <Input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="420" />
            </div>
            <div className="grid gap-2">
              <Label>R:R</Label>
              <Input value={riskReward} onChange={(e) => setRiskReward(e.target.value)} placeholder="2.1" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Strategy</Label>
            <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="Breakout" />
          </div>
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
