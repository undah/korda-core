import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentUI,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterUI,
  AlertDialogHeader as AlertDialogHeaderUI,
  AlertDialogTitle as AlertDialogTitleUI,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Calendar, Plus, Save, Sparkles, Target, NotebookPen, Trash2, Loader2 } from "lucide-react";

type Mood = "great" | "okay" | "bad";

type SessionLogRow = {
  id: string;
  user_id: string;

  log_date: string; // YYYY-MM-DD

  recap: string | null;
  lessons: string | null;
  next_plan: string | null;

  mood: Mood | null;

  prompt_tags?: string[] | null;
  created_at?: string;
  updated_at?: string;

  day?: string | null;
};

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatUiDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function toYmdFromUi(input: string) {
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

function moodUi(m: Mood | null | undefined) {
  if (m === "great")
    return {
      label: "Great",
      dot: "bg-emerald-500",
      text: "text-emerald-500",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
    };
  if (m === "okay")
    return {
      label: "Okay",
      dot: "bg-zinc-400",
      text: "text-zinc-300",
      border: "border-zinc-400/30",
      bg: "bg-zinc-400/10",
    };
  if (m === "bad")
    return {
      label: "Bad",
      dot: "bg-red-500",
      text: "text-red-500",
      border: "border-red-500/30",
      bg: "bg-red-500/10",
    };
  return {
    label: "—",
    dot: "bg-zinc-600",
    text: "text-muted-foreground",
    border: "border-border",
    bg: "bg-secondary/20",
  };
}

function pnlUi(pnl: number) {
  if (pnl > 0) return { text: "text-emerald-500", border: "border-emerald-500/30", bg: "bg-emerald-500/10" };
  if (pnl < 0) return { text: "text-red-500", border: "border-red-500/30", bg: "bg-red-500/10" };
  return { text: "text-muted-foreground", border: "border-border", bg: "bg-secondary/20" };
}

export default function SessionLog() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [days, setDays] = useState<SessionLogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [pnlByDay, setPnlByDay] = useState<Record<string, number>>({});

  const [dayYmd, setDayYmd] = useState<string>(todayYmd());
  const [mood, setMood] = useState<Mood>("great");
  const [recap, setRecap] = useState("");
  const [lessons, setLessons] = useState("");
  const [plan, setPlan] = useState("");

  const [focusField, setFocusField] = useState<FocusField>("recap");

  // ✅ delete session log state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currency = "USD";
  const locale = "en-US";

  const selected = useMemo(() => days.find((d) => d.id === selectedId) ?? null, [days, selectedId]);

  const selectedDayPnl = useMemo(() => {
    const key = toYmdFromUi(dayYmd);
    return pnlByDay[key] ?? 0;
  }, [pnlByDay, dayYmd]);

  const isDirty = useMemo(() => {
    const curDate = toYmdFromUi(dayYmd);

    if (!selected) {
      return !!recap.trim() || !!lessons.trim() || !!plan.trim() || mood !== "great" || curDate !== todayYmd();
    }

    const same =
      (selected.log_date ?? "") === curDate &&
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

  const loadPnLForDays = async (rows: SessionLogRow[]) => {
    if (!user) return;

    const dates = rows.map((r) => r.log_date).filter(Boolean);
    if (!dates.length) {
      setPnlByDay({});
      return;
    }

    const sorted = [...dates].sort();
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

      const day = iso.slice(0, 10);
      const pnl = safeNumber((t as any).pnl, 0);
      map[day] = (map[day] ?? 0) + pnl;
    }

    setPnlByDay(map);
  };

  const refreshDays = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("session_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("log_date", { ascending: false });

    if (error) {
      console.error("Refresh session logs error:", error);
      setDays([]);
      setPnlByDay({});
      hydrateNewDay();
      return;
    }

    const rows = (data ?? []) as SessionLogRow[];
    setDays(rows);
    await loadPnLForDays(rows);
  };

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

  const copyToFocused = async () => {
    const text = focusField === "lessons" ? lessons : focusField === "plan" ? plan : recap;
    try {
      await navigator.clipboard.writeText(text ?? "");
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
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

      await refreshDays();

      const currentLogDate = toYmdFromUi(dayYmd);
      const next =
        (selectedId ? days.find((r) => r.id === selectedId) : null) ??
        days.find((r) => r.log_date === currentLogDate) ??
        days[0] ??
        null;

      // after refreshDays, the `days` state updates async; pick from the freshly fetched list instead:
      const { data: refreshed } = await supabase
        .from("session_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false });

      const rows = (refreshed ?? []) as SessionLogRow[];
      const nextRow =
        (selectedId ? rows.find((r) => r.id === selectedId) : null) ??
        rows.find((r) => r.log_date === currentLogDate) ??
        rows[0] ??
        null;

      if (nextRow) hydrateFromRow(nextRow);
    } finally {
      setSaving(false);
    }
  };

  // ✅ delete selected session log
  const handleDeleteSelected = async () => {
    if (!user) return;
    if (!selectedId) {
      setDeleteOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const deletingRow = days.find((d) => d.id === selectedId) ?? null;

      const { error } = await supabase
        .from("session_logs")
        .delete()
        .eq("id", selectedId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Delete session log error:", error);
        alert(error.message);
        return;
      }

      setDeleteOpen(false);

      // fetch fresh list
      const { data, error: refreshErr } = await supabase
        .from("session_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false });

      if (refreshErr) {
        console.error("Refresh session logs error:", refreshErr);
        hydrateNewDay();
        setDays([]);
        setPnlByDay({});
        return;
      }

      const rows = (data ?? []) as SessionLogRow[];
      setDays(rows);
      await loadPnLForDays(rows);

      // choose next selection: same date (if exists) else first row else new day
      const deletedDate = deletingRow?.log_date ?? toYmdFromUi(dayYmd);
      const nextRow = rows.find((r) => r.log_date === deletedDate) ?? rows[0] ?? null;

      if (nextRow) hydrateFromRow(nextRow);
      else hydrateNewDay();
    } finally {
      setDeleting(false);
    }
  };

  const headerMood = moodUi(mood);
  const headerPnl = pnlUi(selectedDayPnl);

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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Session Log</h1>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                headerMood.border,
                headerMood.bg
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", headerMood.dot)} />
              <span className={cn("font-medium", headerMood.text)}>{headerMood.label}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono",
                headerPnl.border,
                headerPnl.bg,
                headerPnl.text
              )}
            >
              {formatCurrency(selectedDayPnl, currency, locale)}
            </span>
          </div>
          <p className="text-muted-foreground">Track how your day went — trades, emotions, and lessons learned.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => hydrateNewDay()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New day
          </Button>

          <Button
            variant="outline"
            onClick={copyToFocused}
            className="flex items-center gap-2"
            disabled={!recap && !lessons && !plan}
            title="Copy the focused textbox to clipboard"
          >
            <Sparkles className="h-4 w-4" />
            Copy focused
          </Button>

          {/* ✅ Delete session log (only when an existing log is selected) */}
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="flex items-center gap-2"
                disabled={!selectedId || saving || deleting}
                title={!selectedId ? "Select an existing day to delete" : "Delete this session log"}
              >
                <Trash2 className="h-4 w-4" />
                Delete log
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContentUI>
              <AlertDialogHeaderUI>
                <AlertDialogTitleUI>
                  Delete session log for {formatUiDate(toYmdFromUi(dayYmd))}?
                </AlertDialogTitleUI>
                <AlertDialogDescription>
                  This cannot be undone. This will permanently remove this day’s session log.
                </AlertDialogDescription>
              </AlertDialogHeaderUI>

              <AlertDialogFooterUI className="gap-2">
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteSelected();
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting…
                    </span>
                  ) : (
                    "Delete permanently"
                  )}
                </AlertDialogAction>
              </AlertDialogFooterUI>
            </AlertDialogContentUI>
          </AlertDialog>

          <Button variant="glow" onClick={handleSave} disabled={saving || !isDirty} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isDirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Days list (left) */}
        <div className="lg:col-span-3">
          <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Days</h3>
              </div>
              <span className="text-xs text-muted-foreground">{days.length}</span>
            </div>

            {days.length === 0 ? (
              <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                No session logs yet.
                <div className="mt-2 text-xs text-muted-foreground">
                  Hit <span className="font-medium">New day</span> to start your first log.
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                {days.map((d) => {
                  const active = d.id === selectedId;

                  const moodMeta = moodUi(d.mood);
                  const dayPnl = pnlByDay[d.log_date];
                  const hasPnl = Object.prototype.hasOwnProperty.call(pnlByDay, d.log_date);
                  const dayPnlMeta = pnlUi(dayPnl ?? 0);

                  const preview = (d.recap ?? d.lessons ?? d.next_plan ?? "").trim();
                  const hasNotes = !!preview;

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => hydrateFromRow(d)}
                      className={cn(
                        "group w-full text-left rounded-xl border px-3 py-2 transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{formatUiDate(d.log_date)}</div>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                                moodMeta.border,
                                moodMeta.bg
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", moodMeta.dot)} />
                              <span className={cn("font-medium", moodMeta.text)}>{moodMeta.label}</span>
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {hasNotes ? (
                              <span className="line-clamp-2">{preview}</span>
                            ) : (
                              <span className="opacity-70">No notes yet</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {hasPnl ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-mono",
                                dayPnlMeta.border,
                                dayPnlMeta.bg,
                                dayPnlMeta.text
                              )}
                              title="Total PnL for the day"
                            >
                              {formatCurrency(dayPnl ?? 0, currency, locale)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}

                          {active && <span className="text-[11px] text-primary/80">Selected</span>}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1", !hasNotes && "opacity-70")}>
                          <NotebookPen className="h-3.5 w-3.5" />
                          {hasNotes ? "Has notes" : "Empty"}
                        </span>
                        <span className="opacity-70">{d.updated_at ? "Updated" : ""}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main editor (right) */}
        <div className="space-y-6 lg:col-span-9">
          {/* Top row: Date + Mood + Quick prompts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Date */}
            <div className="glass-card p-5 lg:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Date</div>
                  <div className="text-xs text-muted-foreground mt-1">Pick a day, then log recap + lessons + plan.</div>
                </div>

                {/* Keep only this PnL badge (top-right) */}
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono",
                    headerPnl.border,
                    headerPnl.bg,
                    headerPnl.text
                  )}
                >
                  {formatCurrency(selectedDayPnl, currency, locale)}
                </span>
              </div>

              <div className="mt-4">
                <Input
                  type="date"
                  value={dayYmd}
                  onChange={(e) => setDayYmd(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">Keep it simple: one honest recap, one lesson, one rule for tomorrow.</div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              {/* Mood */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Mood</div>
                    <div className="text-xs text-muted-foreground mt-1">How did the session feel overall?</div>
                  </div>

                  <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", headerMood.border, headerMood.bg)}>
                    <span className={cn("h-2 w-2 rounded-full", headerMood.dot)} />
                    <span className={cn("font-medium", headerMood.text)}>{headerMood.label}</span>
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button type="button" variant={mood === "great" ? "glow" : "outline"} onClick={() => setMood("great")} className="rounded-lg">
                    Great
                  </Button>
                  <Button type="button" variant={mood === "okay" ? "glow" : "outline"} onClick={() => setMood("okay")} className="rounded-lg">
                    Okay
                  </Button>
                  <Button type="button" variant={mood === "bad" ? "destructive" : "outline"} onClick={() => setMood("bad")} className="rounded-lg">
                    Bad
                  </Button>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">Tip: keep mood honest — it helps you spot patterns.</div>
              </div>

              {/* Quick prompts */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Quick prompts</div>
                    <div className="text-xs text-muted-foreground mt-1">Tap one to paste into the focused textbox.</div>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    Focus:{" "}
                    <span className="font-medium">
                      {focusField === "recap" ? "Recap" : focusField === "lessons" ? "Lessons" : focusField === "plan" ? "Plan" : "—"}
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent/40 transition-colors"
                      onClick={() => applyQuickPrompt(p.text)}
                      title="Insert prompt"
                    >
                      <span className="text-muted-foreground">+</span>
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Pro tip: write one rule for tomorrow you can actually follow.</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 text boxes */}
          <div className="glass-card p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4 text-muted-foreground" />
                  <div className="font-semibold">How did today go?</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Quick recap of the session (what happened, what you felt, what mattered).</div>
              </div>

              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] text-muted-foreground",
                  focusField === "recap" ? "border-primary/40 bg-primary/10 text-primary/90" : "border-border bg-secondary/20"
                )}
              >
                Focused
              </span>
            </div>

            <Textarea
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              onFocus={() => setFocusField("recap")}
              placeholder="Example: Took 3 trades. First was clean, second was FOMO, third followed plan. Emotion shifted after the loss…"
              className={cn("min-h-[160px] bg-muted/30 border-border resize-none rounded-xl", focusField === "recap" && "ring-1 ring-primary/30")}
            />
          </div>

          <div className="glass-card p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <div className="font-semibold">Lessons</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">What did you learn today? What should you repeat or stop doing?</div>
              </div>

              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] text-muted-foreground",
                  focusField === "lessons" ? "border-primary/40 bg-primary/10 text-primary/90" : "border-border bg-secondary/20"
                )}
              >
                Focused
              </span>
            </div>

            <Textarea
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              onFocus={() => setFocusField("lessons")}
              placeholder="Example: Don’t trade right after a loss. Wait for A+ setups only…"
              className={cn("min-h-[160px] bg-muted/30 border-border resize-none rounded-xl", focusField === "lessons" && "ring-1 ring-primary/30")}
            />
          </div>

          <div className="glass-card p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div className="font-semibold">Plan for next session</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Simple rules for tomorrow so you stay consistent.</div>
              </div>

              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] text-muted-foreground",
                  focusField === "plan" ? "border-primary/40 bg-primary/10 text-primary/90" : "border-border bg-secondary/20"
                )}
              >
                Focused
              </span>
            </div>

            <Textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              onFocus={() => setFocusField("plan")}
              placeholder="Example: Max 2 trades. No entries outside London + NY killzone. Screenshot every setup…"
              className={cn("min-h-[160px] bg-muted/30 border-border resize-none rounded-xl", focusField === "plan" && "ring-1 ring-primary/30")}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
