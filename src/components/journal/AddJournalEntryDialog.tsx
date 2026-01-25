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
import { Textarea } from "@/components/ui/textarea";

type TradePrefill = {
  id: string;
  pair: string;
  side: "buy" | "sell";
  tradeTimeIso?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;

  // ✅ NEW: when opened from a trade row
  trade?: TradePrefill | null;
};

// ✅ MUST match your DB constraint
const EMOTIONS = ["confident", "fearful", "neutral", "greedy"] as const;
type Emotion = (typeof EMOTIONS)[number];

function isoToDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function AddJournalEntryDialog({ open, onOpenChange, onCreated, trade }: Props) {
  const { user } = useAuth();

  const [pair, setPair] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [pnl, setPnl] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [tagsText, setTagsText] = useState("");
  const [notes, setNotes] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [tvUrl, setTvUrl] = useState("");

  // chart image upload
  const [chartFile, setChartFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const openedFromTrade = !!trade?.id;

  const reset = () => {
    setPair("");
    setSide("buy");
    setPnl("");
    setEmotion("neutral");
    setTagsText("");
    setNotes("");
    setEntryTime("");
    setTvUrl("");
    setChartFile(null);
  };

  // ✅ Prefill when opened from trade row
  useEffect(() => {
    if (!open) return;

    if (openedFromTrade && trade) {
      setPair((trade.pair ?? "").toUpperCase());
      setSide(trade.side ?? "buy");

      const baseIso = trade.tradeTimeIso ?? new Date().toISOString();
      setEntryTime(isoToDateTimeLocal(baseIso));
    }
  }, [open, openedFromTrade, trade?.id]);

  const uploadChartImage = async (): Promise<string | null> => {
    if (!chartFile || !user) return null;

    const ext = chartFile.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("journal charts")
      .upload(path, chartFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: chartFile.type || undefined,
      });

    if (uploadError) {
      console.error("Upload chart image error:", uploadError);
      alert(uploadError.message);
      return null;
    }

    // If bucket is public:
    const { data } = supabase.storage.from("journal charts").getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const handleCreate = async () => {
    if (!user) return;

    if (!pair.trim()) {
      alert("Pair is required");
      return;
    }

    setLoading(true);

    const tags =
      tagsText.trim().length === 0
        ? null
        : tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

    const entryTimeIso = entryTime ? new Date(entryTime).toISOString() : new Date().toISOString();

    const tvImageUrl = await uploadChartImage();

    const payload: any = {
      user_id: user.id,
      pair: pair.trim(),
      side,
      pnl: pnl === "" ? null : Number(pnl),
      notes: notes.trim() || null,
      tags,
      emotion,
      entry_time: entryTimeIso,
      tv_url: tvUrl.trim() || null,
      tv_image_url: tvImageUrl || null,
    };

    // ✅ link to trade if opened from trade row
    if (openedFromTrade && trade?.id) {
      payload.trade_id = trade.id;
    }

    const { error } = await supabase.from("journal_entries").insert([payload]);

    setLoading(false);

    if (error) {
      console.error("Insert journal entry error:", error);
      alert(error.message);
      return;
    }

    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {openedFromTrade ? "Add journal entry (linked to trade)" : "Add journal entry"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Pair</Label>
            <Input
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
              placeholder="EUR/USD"
              disabled={openedFromTrade}
            />
          </div>

          <div className="grid gap-2">
            <Label>Side</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={side === "buy" ? "default" : "outline"}
                onClick={() => setSide("buy")}
                disabled={openedFromTrade}
              >
                Buy
              </Button>
              <Button
                type="button"
                variant={side === "sell" ? "default" : "outline"}
                onClick={() => setSide("sell")}
                disabled={openedFromTrade}
              >
                Sell
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>PnL</Label>
              <Input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="420" />
            </div>

            <div className="grid gap-2">
              <Label>Emotion</Label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value as Emotion)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="confident">Confident</option>
                <option value="fearful">Fearful</option>
                <option value="neutral">Neutral</option>
                <option value="greedy">Greedy</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Tags (comma separated)</Label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="breakout, trend-following"
            />
          </div>

          <div className="grid gap-2">
            <Label>Entry time (optional)</Label>
            <Input
              type="datetime-local"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              disabled={openedFromTrade}
            />
          </div>

          <div className="grid gap-2">
            <Label>TradingView link (optional)</Label>
            <Input
              value={tvUrl}
              onChange={(e) => setTvUrl(e.target.value)}
              placeholder="https://www.tradingview.com/x/AbCdEf12/"
            />
          </div>

          <div className="grid gap-2">
            <Label>Chart image (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setChartFile(e.target.files?.[0] ?? null)}
            />
            {chartFile && <p className="text-xs text-muted-foreground">Selected: {chartFile.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? What did you do well? What to improve?"
              rows={5}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
