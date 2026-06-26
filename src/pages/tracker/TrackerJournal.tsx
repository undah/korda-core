// src/pages/tracker/TrackerJournal.tsx
import React, { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useTrackerJournal, useUpsertJournal, useDeleteJournal } from "@/features/tracker/hooks/useTrackerJournal";
import type { TrackerJournal } from "@/features/tracker/types";
import { toast } from "sonner";
import ConfirmDeleteModal from "@/components/tracker/ConfirmDeleteModal";

const today = () => new Date().toISOString().split("T")[0];
const MOODS   = ["great","good","okay","low","bad"] as const;

const C = {
  accent: "var(--kt-accent)",
  green:  "var(--kt-green)",
  red:    "var(--kt-red)",
  text:   "var(--kt-text)",
  muted:  "var(--kt-muted)",
  dim:    "var(--kt-dim)",
  card:   "var(--kt-surface)",
  border: "var(--kt-border)",
};

function AutoTextarea({ value, onChange, placeholder, minRows = 3 }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="kt-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      style={{ resize: "none", overflow: "hidden", minHeight: `${minRows * 1.6}rem` }}
    />
  );
}
const ENERGYS = ["high","medium","low"] as const;
const moodColor = (m: string) => ({ great: "#22C55E", good: "#5ab4d4", okay: "rgba(232,232,240,0.5)", low: "#d4b45a", bad: "#EF4444" }[m] ?? "rgba(232,232,240,0.3)");

export default function TrackerJournal() {
  const { data: entries = [], isLoading } = useTrackerJournal(30);
  const upsert = useUpsertJournal();
  const deleteEntry = useDeleteJournal();

  const [form, setForm] = useState({
    log_date: today(), mood: "" as TrackerJournal["mood"] | "",
    energy: "" as TrackerJournal["energy"] | "",
    sleep_hrs: "", notes: "", wins: "", struggles: "",
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    try {
      await upsert.mutateAsync({
        log_date: form.log_date, mood: form.mood || null, energy: form.energy || null,
        sleep_hrs: form.sleep_hrs ? parseFloat(form.sleep_hrs) : null,
        notes: form.notes || null, wins: form.wins || null, struggles: form.struggles || null,
      });
      toast.success("Journal entry saved.");
      setForm(f => ({ ...f, mood: "", energy: "", sleep_hrs: "", notes: "", wins: "", struggles: "" }));
    } catch { toast.error("Failed to save entry."); }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    try {
      await deleteEntry.mutateAsync(confirmId);
      toast.success("Entry deleted.");
      setConfirmId(null);
    } catch { toast.error("Failed to delete entry."); }
  };

  const sorted = [...entries].sort((a, b) => b.log_date.localeCompare(a.log_date));

  return (
    <div>
      <ConfirmDeleteModal open={!!confirmId} label="this journal entry" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} loading={deleteEntry.isPending} />

      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Journal</p>
        <h1 className="kt-page-title">Daily <em>reflection</em></h1>
      </div>

      <div className="kt-card" style={{ marginBottom: "2rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>New entry</p>
        <div className="kt-grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label className="kt-label">Date</label>
            <div style={{ position: "relative" }}>
              <input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }} />
              <div className="kt-input" style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }}>
                {format(parseISO(form.log_date), "d MMM yyyy")}
              </div>
            </div>
          </div>
          <div>
            <label className="kt-label">Sleep (hours)</label>
            <input className="kt-input" type="number" step="0.5" placeholder="e.g. 7.5" value={form.sleep_hrs} onChange={set("sleep_hrs")} />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="kt-label">Mood</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {MOODS.map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, mood: m }))}
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", textTransform: "capitalize", padding: "0.4rem 1rem", cursor: "pointer", border: "1px solid", background: form.mood === m ? moodColor(m) + "22" : "transparent", borderColor: form.mood === m ? moodColor(m) : "rgba(232,232,240,0.1)", color: form.mood === m ? moodColor(m) : "rgba(232,232,240,0.3)", transition: "all 0.15s" }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="kt-label">Energy</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {ENERGYS.map(e => (
              <button key={e} onClick={() => setForm(f => ({ ...f, energy: e }))}
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", textTransform: "capitalize", padding: "0.4rem 1rem", cursor: "pointer", border: "1px solid", background: form.energy === e ? "var(--kt-accent-bg)" : "transparent", borderColor: form.energy === e ? "rgba(0,200,255,0.5)" : "rgba(232,232,240,0.1)", color: form.energy === e ? C.accent : C.dim, transition: "all 0.15s" }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="kt-label">Notes / how was your day?</label>
          <AutoTextarea value={form.notes} onChange={set("notes")} placeholder="How did today go?" minRows={3} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="kt-label">Wins today</label>
          <AutoTextarea value={form.wins} onChange={set("wins")} placeholder="What went well?" minRows={2} />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="kt-label">Struggles</label>
          <AutoTextarea value={form.struggles} onChange={set("struggles")} placeholder="What was hard?" minRows={2} />
        </div>

        <button className="kt-btn kt-btn-blue" onClick={handleSubmit} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving..." : "Save entry →"}
        </button>
      </div>

      <div>
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Past entries</p>
        {isLoading ? (
          <p style={{ color: C.dim, fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem" }}>Loading...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: C.dim, fontSize: "0.85rem" }}>No journal entries yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((entry) => (
              <JournalCard key={entry.id} entry={entry} onDelete={(id, e) => { e.stopPropagation(); setConfirmId(id); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JournalCard({ entry, onDelete }: { entry: TrackerJournal; onDelete: (id: string, e: React.MouseEvent) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="kt-card" style={{ cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(232,232,240,0.4)" }}>{entry.log_date}</span>
          {entry.mood && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.65rem", padding: "0.2rem 0.6rem", border: "1px solid", borderColor: moodColor(entry.mood) + "50", color: moodColor(entry.mood), background: moodColor(entry.mood) + "12", textTransform: "capitalize", borderRadius: 10 }}>{entry.mood}</span>}
          {entry.energy && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.65rem", color: "rgba(232,232,240,0.25)" }}>energy: {entry.energy}</span>}
          {entry.sleep_hrs && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "rgba(232,232,240,0.25)" }}>{entry.sleep_hrs}h sleep</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={(e) => onDelete(entry.id, e)}
            style={{ background: "none", border: "none", color: "rgba(239,68,68,0.35)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: "0.62rem", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(239,68,68,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.35)")}>
            delete
          </button>
          <span style={{ color: C.accent, opacity: 0.4, fontSize: "0.8rem", display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>→</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${C.border}` }}>
          {entry.notes && <p style={{ fontSize: "0.85rem", color: C.muted, lineHeight: 1.7, marginBottom: "1rem" }}>{entry.notes}</p>}
          <div className="kt-grid-2" style={{ gap: "1rem" }}>
            {entry.wins && <div><p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.6rem", color: C.green, textTransform: "uppercase", marginBottom: "0.4rem" }}>Wins</p><p style={{ fontSize: "0.82rem", color: C.muted, lineHeight: 1.6 }}>{entry.wins}</p></div>}
            {entry.struggles && <div><p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.6rem", color: C.red, textTransform: "uppercase", marginBottom: "0.4rem" }}>Struggles</p><p style={{ fontSize: "0.82rem", color: C.muted, lineHeight: 1.6 }}>{entry.struggles}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
