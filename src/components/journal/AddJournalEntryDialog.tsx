import { useEffect, useMemo, useState } from "react";
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

function toSafeTagArray(tagsText: string): string[] | null {
  const tags =
    tagsText.trim().length === 0
      ? null
      : tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

  return tags && tags.length ? tags : null;
}

function uniqByName(files: File[]) {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of files) {
    const key = `${f.name}_${f.size}_${f.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
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

  // ✅ up to 3 chart images
  const [chartFiles, setChartFiles] = useState<File[]>([]);

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
    setChartFiles([]);
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

  // If dialog closes without saving, reset local state
  useEffect(() => {
    if (!open) return;
    return () => {
      // no-op (keeps state while open)
    };
  }, [open]);

  const remainingImages = useMemo(() => Math.max(0, 3 - chartFiles.length), [chartFiles.length]);

  const handleFilesPicked = (files: FileList | null) => {
    if (!files) return;

    const picked = Array.from(files).filter((f) => f.type?.startsWith("image/"));
    if (!picked.length) return;

    const merged = uniqByName([...chartFiles, ...picked]).slice(0, 3);
    setChartFiles(merged);
  };

  const removeFileAt = (idx: number) => {
    setChartFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadChartImages = async (): Promise<string[] | null> => {
    if (!user) return null;
    if (!chartFiles.length) return null;

    const bucket = "journal charts";

    const uploads = chartFiles.map(async (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl ?? null;
    });

    try {
      const urls = await Promise.all(uploads);
      const clean = urls.filter(Boolean) as string[];
      return clean.length ? clean : null;
    } catch (err: any) {
      console.error("Upload chart images error:", err);
      alert(err?.message ?? "Failed to upload images");
      return null;
    }
  };

  const handleCreate = async () => {
    if (!user) return;

    if (!pair.trim()) {
      alert("Pair is required");
      return;
    }

    if (chartFiles.length > 3) {
      alert("Max 3 images");
      return;
    }

    setLoading(true);

    const tags = toSafeTagArray(tagsText);
    const entryTimeIso = entryTime ? new Date(entryTime).toISOString() : new Date().toISOString();

    // ✅ Upload up to 3 images
    const tvImageUrls = await uploadChartImages();

    // Backward compat:
    // - tv_image_url stays as "first image" for existing UI that expects single image
    // - tv_image_urls is the new array you can use later (recommended)
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

      // ✅ NEW
      tv_image_urls: tvImageUrls || null,

      // ✅ legacy single-image field
      tv_image_url: (tvImageUrls && tvImageUrls.length ? tvImageUrls[0] : null) || null,
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
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
            <Label>Chart images (optional, up to 3)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFilesPicked(e.target.files)}
              disabled={chartFiles.length >= 3}
            />

            <div className="text-xs text-muted-foreground">
              {chartFiles.length === 0 ? "No images selected." : `${chartFiles.length} selected.`}
              {remainingImages > 0 ? ` You can add ${remainingImages} more.` : " Max reached."}
            </div>

            {chartFiles.length > 0 && (
              <div className="space-y-2">
                {chartFiles.map((f, idx) => (
                  <div
                    key={`${f.name}_${f.size}_${f.lastModified}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeFileAt(idx)}
                      disabled={loading}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Tip: hold <span className="font-medium">Ctrl/⌘</span> to pick multiple files at once.
            </div>
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
