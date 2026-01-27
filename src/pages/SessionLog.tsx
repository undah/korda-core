import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

import { Calendar, Plus, Save } from "lucide-react";

type Mood = "great" | "okay" | "bad";

type SessionLogRow = {
  id: string;
  user_id: string;

  // ✅ matches your table
  log_date: string; // YYYY-MM-DD

  recap: string | null;
  lessons: string | null;

  // ✅ matches your table
  next_plan: string | null;

  mood: Mood | null;

  // optional columns (Supabase returns them if they exist)
  prompt_tags?: string[] | null;
  created_at?: string;
  updated_at?: string;

  // you mentioned you also have `day` in the table now; we ignore it in code
  day?: string | null;
};

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatUiDate(ymd: string) {
  // render as MM/DD/YYYY
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function toYmdFromUi(input: string) {
  // Accept YYYY-MM-DD (native date input), return same
  // If user somehow pastes MM/DD/YYYY, attempt convert
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(Number(m[1])).padStart(2, "0");
    const dd = String(Number(m[2])).padStart(2, "0");
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }
  return input;
}

const QUICK_PROMPTS = [
  { label: "Followed plan", text: "Followed plan. Stayed patient and waited for my A+ setups." },
  { label: "Overtraded", text: "Overtraded today. Took lower-quality setups and forced trades." },
  { label: "FOMO entries", text: "FOMO entries showed up. Entered late instead of waiting for confirmation." },
  { label: "Good risk management", text: "Risk management was solid. Kept risk consistent and respected stops." },
  { label: "Emotion after loss", text: "After a loss, emotions spiked. Need a reset rule before next trade." },
  { label: "A+ setups only", text: "A+ setups only. No trades outside my criteria." },
];

type FocusField = "recap" | "lessons" | "plan" | null;

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SessionLog() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [days, setDays] = useState<SessionLogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ day -> total pnl map (key: YYYY-MM-DD)
  const [pnlByDay, setPnlByDay] = useState<Record<string, number>>({});

  // Draft fields (right panel)
  const [dayYmd, setDayYmd] = useState<string>(todayYmd());
  const [mood, setMood] = useState<Mood>("great");
  const [recap, setRecap] = useState("");
  const [lessons, setLessons] = useState("");
  const [plan, setPlan] = useState("");

  const [focusField, setFocusField] = useState<FocusField>("recap");

  // ✅ IMPORTANT: your app uses settings in other pages; SessionLog doesn't.
  // To still use formatCurrency without adding new hooks, we pass defaults.
  // If you want, we can wire useProfileSettings() later.
  const currency = "USD";
  const locale = "en-US";

  const selected = useMemo(() => days.find((d) => d.id === selectedId) ?? null, [days, selectedId]);

  const selectedDayPnl = useMemo(() => {
    const key = toYmdFromUi(dayYmd); // YYYY-MM-DD
    return pnlByDay[key] ?? 0;
  }, [pnlByDay, dayYmd]);

  const isDirty = useMemo(() => {
    if (!selected) {
      return (
        !!recap.trim() ||
        !!lessons.trim() ||
        !!plan.trim() ||
        mood !== "great" ||
        dayYmd !== todayYmd()
      );
    }

    const same =
      (selected.log_date ?? "") === dayYmd &&
      (selected.mood ?? null) === mood &&
      (selected.recap ?? "") === recap &&
      (selected.lessons ?? "") === lessons &&
      (selected.next_plan ?? "") === plan;

    return !same;
  }, [selected, dayYmd, mood, recap, lessons, plan]);

  const hydrateFromRow = (row: SessionLogRow) => {
    setSelectedId(row.id);
    setDayYmd(row.log_date);
    setMood((row.mood ?? "great") as Mood);
    setRecap(row.recap ?? "");
    setLessons(row.lessons ?? "");
    setPlan(row.next_plan ?? "");
    setFocusField("recap");
  };

  const hydrateNewDay = (ymd?: string) => {
    setSelectedId(null);
    const d = ymd ?? todayYmd();
    setDayYmd(d);
    setMood("great");
    setRecap("");
    setLessons("");
    setPlan("");
    setFocusField("recap");
  };

  // ✅ load + compute daily pnl for the shown days
  const loadPnLForDays = async (rows: SessionLogRow[]) => {
    if (!user) return;

    const dates = rows.map((r) => r.log_date).filter(Boolean);
    if (!dates.length) {
      setPnlByDay({});
      return;
    }

    const sorted = [...dates].sort(); // asc
    const minDate = sorted[0];
    const maxDate = sorted[sorted.length - 1];

    const { data: tradeRows, error } = await supabase
      .from("trades")
      .select("pnl, trade_time")
      .eq("user_id", user.id)
      .not("pnl", "is", null)
      .gte("trade_time", `${minDate}T00:00:00.000Z`)
      .lte("trade_time", `${maxDate}T23:59:59.999Z`);

    if (error) {
      console.error("Fetch trades for daily pnl error:", error);
      setPnlByDay({});
      return;
    }

    const map: Record<string, number> = {};
    for (const t of tradeRows ?? []) {
      const iso = (t as any).trade_time as string | null;
      if (!iso) continue;

      // timestamptz ISO -> YYYY-MM-DD
      const day = iso.slice(0, 10);
      const pnl = safeNumber((t as any).pnl, 0);
      map[day] = (map[day] ?? 0) + pnl;
    }

    setPnlByDay(map);
  };

  // Initial load
  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("session_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("log_date", { ascending: false });

        if (error) {
          console.error("Fetch session_logs error:", error);
          setDays([]);
          setPnlByDay({});
          hydrateNewDay();
          return;
        }

        const rows = (data ?? []) as SessionLogRow[];
        setDays(rows);

        await loadPnLForDays(rows);

        if (rows.length) hydrateFromRow(rows[0]);
        else hydrateNewDay();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const applyQuickPrompt = (text: string) => {
    if (focusField === "lessons") setLessons((v) => (v ? `${v}\n${text}` : text));
    else if (focusField === "plan") setPlan((v) => (v ? `${v}\n${text}` : text));
    else setRecap((v) => (v ? `${v}\n${text}` : text));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        log_date: toYmdFromUi(dayYmd),
        mood,
        recap: recap.trim() || null,
        lessons: lessons.trim() || null,
        next_plan: plan.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (selectedId) {
        const { error } = await supabase.from("session_logs").update(payload).eq("id", selectedId);
        if (error) {
          console.error("Update session log error:", error);
          alert(error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("session_logs")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select("*")
          .single();

        if (error) {
          console.error("Insert session log error:", error);
          alert(error.message);
          return;
        }

        if (data?.id) setSelectedId(data.id);
      }

      // refresh list
      const { data: refreshed, error: refreshErr } = await supabase
        .from("session_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false });

      if (refreshErr) {
        console.error("Refresh session logs error:", refreshErr);
        return;
      }

      const rows = (refreshed ?? []) as SessionLogRow[];
      setDays(rows);

      await loadPnLForDays(rows);

      const currentLogDate = toYmdFromUi(dayYmd);

      const next =
        (selectedId ? rows.find((r) => r.id === selectedId) : null) ??
        rows.find((r) => r.log_date === currentLogDate) ??
        rows[0] ??
        null;

      if (next) hydrateFromRow(next);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-muted-foreground">Loading session log…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Session Log</h1>
          <p className="text-muted-foreground">Track how your day went — trades, emotions, and lessons learned.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => hydrateNewDay()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New day
          </Button>

          <Button
            variant="glow"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Days list (left) */}
        <div className="lg:col-span-3">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Days</h3>
              </div>
              <span className="text-xs text-muted-foreground">{days.length}</span>
            </div>

            {days.length === 0 ? (
              <div className="text-sm text-muted-foreground">No session logs yet.</div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {days.map((d) => {
                  const active = d.id === selectedId;

                  const moodLabel =
                    d.mood === "great"
                      ? "Great"
                      : d.mood === "okay"
                      ? "Okay"
                      : d.mood === "bad"
                      ? "Bad"
                      : "—";

                  const dayPnl = pnlByDay[d.log_date];
                  const hasPnl = Object.prototype.hasOwnProperty.call(pnlByDay, d.log_date);

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => hydrateFromRow(d)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-sm">{formatUiDate(d.log_date)}</div>

                        <div className="flex items-center gap-2">
                          {hasPnl && (
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border font-mono",
                                dayPnl >= 0 ? "border-success/30 text-success" : "border-destructive/30 text-destructive"
                              )}
                              title="Total PnL for the day"
                            >
                              {formatCurrency(dayPnl, currency, locale)}
                            </span>
                          )}

                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full border",
                              d.mood === "great" && "border-success/30 text-success",
                              d.mood === "okay" && "border-muted-foreground/30 text-muted-foreground",
                              d.mood === "bad" && "border-destructive/30 text-destructive",
                              !d.mood && "border-border text-muted-foreground"
                            )}
                          >
                            {moodLabel}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {(d.recap ?? d.lessons ?? d.next_plan ?? "").trim() || "No notes yet."}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main editor (right) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top row: Date + Mood + Quick prompts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Date + Daily PnL */}
            <div className="lg:col-span-7 glass-card p-4">
              <div className="text-sm font-semibold mb-2">Date</div>

              <Input
                type="date"
                value={dayYmd}
                onChange={(e) => setDayYmd(e.target.value)}
                className="bg-secondary border-border"
              />

              {/* Daily PnL */}
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Daily PnL</span>

                <span
                  className={cn(
                    "text-xs font-mono font-semibold",
                    selectedDayPnl > 0 && "text-success",
                    selectedDayPnl < 0 && "text-destructive",
                    selectedDayPnl === 0 && "text-muted-foreground"
                  )}
                >
                  {formatCurrency(selectedDayPnl, currency, locale)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Tip: pick a day, then write a quick recap + lessons + plan.
              </p>
            </div>

            <div className="lg:col-span-5 space-y-6">
              {/* Mood */}
              <div className="glass-card p-4">
                <div className="text-sm font-semibold mb-2">Mood</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" variant={mood === "great" ? "glow" : "outline"} onClick={() => setMood("great")}>
                    Great
                  </Button>
                  <Button type="button" variant={mood === "okay" ? "glow" : "outline"} onClick={() => setMood("okay")}>
                    Okay
                  </Button>
                  <Button type="button" variant={mood === "bad" ? "destructive" : "outline"} onClick={() => setMood("bad")}>
                    Bad
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Selected:{" "}
                  <span className="font-medium">{mood === "great" ? "Great" : mood === "okay" ? "Okay" : "Bad"}</span>
                </div>
              </div>

              {/* Quick prompts */}
              <div className="glass-card p-4">
                <div className="text-sm font-semibold mb-2">Quick prompts</div>
                <div className="text-xs text-muted-foreground mb-3">Tap one to paste into the focused textbox.</div>

                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent/40 transition-colors"
                      onClick={() => applyQuickPrompt(p.text)}
                      title="Insert prompt"
                    >
                      <span className="text-muted-foreground">+</span>
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Focus:{" "}
                  <span className="font-medium">
                    {focusField === "recap"
                      ? "How did today go?"
                      : focusField === "lessons"
                      ? "Lessons"
                      : focusField === "plan"
                      ? "Plan"
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 text boxes */}
          <div className="glass-card p-5">
            <div className="mb-2">
              <div className="font-semibold">How did today go?</div>
              <div className="text-xs text-muted-foreground">
                Quick recap of the session (what happened, what you felt, what mattered).
              </div>
            </div>
            <Textarea
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              onFocus={() => setFocusField("recap")}
              placeholder="Example: Took 3 trades. First was clean, second was FOMO, third followed plan. Emotion shifted after the loss…"
              className="min-h-[150px] bg-muted/30 border-border resize-none"
            />
          </div>

          <div className="glass-card p-5">
            <div className="mb-2">
              <div className="font-semibold">Lessons</div>
              <div className="text-xs text-muted-foreground">
                What did you learn today? What should you repeat or stop doing?
              </div>
            </div>
            <Textarea
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              onFocus={() => setFocusField("lessons")}
              placeholder="Example: Don’t trade right after a loss. Wait for A+ setups only…"
              className="min-h-[150px] bg-muted/30 border-border resize-none"
            />
          </div>

          <div className="glass-card p-5">
            <div className="mb-2">
              <div className="font-semibold">Plan for next session</div>
              <div className="text-xs text-muted-foreground">Simple rules for tomorrow so you stay consistent.</div>
            </div>
            <Textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              onFocus={() => setFocusField("plan")}
              placeholder="Example: Max 2 trades. No entries outside London + NY killzone. Screenshot every setup…"
              className="min-h-[150px] bg-muted/30 border-border resize-none"
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
