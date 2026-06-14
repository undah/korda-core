import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { useTrackerCheckins, useAddCheckin, useDeleteCheckin, useTrackerGoal, useUpsertGoal } from "@/features/tracker/hooks/useTrackerCheckins";
import type { TrackerCheckin } from "@/features/tracker/types";
import { toast } from "sonner";

const today = () => new Date().toISOString().split("T")[0];

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

// ── Weight input ──────────────────────────────────────────────────────────────

function WeightInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const adjust = (delta: number) => {
    const cur = parseFloat(value) || 0;
    onChange(Math.max(0, +(cur + delta).toFixed(1)).toString());
  };

  const btnBase: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "var(--kt-hover)", color: C.text, fontSize: "1.4rem",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, userSelect: "none", WebkitTapHighlightColor: "transparent", transition: "background 0.12s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ background: "var(--kt-input-bg)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "1.25rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button type="button" onClick={() => adjust(-0.1)} style={btnBase}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--kt-hover)")}>−</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <input
            type="number" inputMode="decimal" step={0.1} value={value}
            onChange={e => onChange(e.target.value)} placeholder="0.0"
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: value ? C.accent : "rgba(232,232,240,0.15)", fontFamily: "'DM Sans',sans-serif", fontSize: "clamp(2rem,6vw,2.8rem)", fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center" }}
          />
          <p style={{ fontSize: "0.72rem", color: C.dim, marginTop: "0.1rem", fontFamily: "'DM Sans',sans-serif" }}>kilograms</p>
        </div>
        <button type="button" onClick={() => adjust(+0.1)} style={btnBase}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--kt-hover)")}>+</button>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {[-1, -0.5, +0.5, +1].map(d => (
          <button key={d} type="button" onClick={() => adjust(d)}
            style={{ flex: 1, padding: "0.5rem 0", background: "var(--kt-border2)", border: "1px solid var(--kt-border)", borderRadius: 8, color: d < 0 ? C.green : C.red, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", transition: "background 0.12s", WebkitTapHighlightColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--kt-border)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--kt-border2)")}>
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function Modal({ title, sub, accent, confirmLabel, onConfirm, onCancel, loading }: {
  title: string; sub?: string; accent: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,4,10,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: "1.25rem" }}>
      <div style={{ background: "var(--kt-surface)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "2rem", maxWidth: 420, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 400, color: C.text, marginBottom: "0.6rem" }}>{title}</h3>
        {sub && <p style={{ fontSize: "0.83rem", color: C.muted, lineHeight: 1.7, marginBottom: "1.75rem" }}>{sub}</p>}
        <div style={{ display: "flex", gap: "0.65rem" }}>
          <button className="kt-btn" onClick={onConfirm} disabled={loading} style={{ flex: 1, background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}>
            {loading ? "Working..." : confirmLabel}
          </button>
          <button className="kt-btn kt-btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TrackerProgress() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(90);
  const { data: goal }   = useTrackerGoal();
  const addCheckin       = useAddCheckin();
  const deleteCheckin    = useDeleteCheckin();
  const upsertGoal       = useUpsertGoal();

  const [form, setForm] = useState({
    log_date: today(), weight: "",
    waist: "", chest: "", hips: "", arms: "", thighs: "", body_fat: "", notes: "",
  });
  const [goalForm, setGoalForm] = useState({
    goal_weight:   goal?.goal_weight?.toString()   ?? "",
    weekly_target: goal?.weekly_target?.toString() ?? "0.5",
  });
  const [showGoal, setShowGoal]               = useState(false);
  const [showMeasure, setShowMeasure]         = useState(false);
  const [showConflict, setShowConflict]       = useState(false);
  const [pendingPayload, setPendingPayload]   = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId]             = useState<string | null>(null);

  const setField = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const buildPayload = () => ({
    log_date: form.log_date, weight: parseFloat(form.weight),
    waist:    form.waist    ? parseFloat(form.waist)    : null,
    chest:    form.chest    ? parseFloat(form.chest)    : null,
    hips:     form.hips     ? parseFloat(form.hips)     : null,
    arms:     form.arms     ? parseFloat(form.arms)     : null,
    thighs:   form.thighs   ? parseFloat(form.thighs)   : null,
    body_fat: form.body_fat ? parseFloat(form.body_fat) : null,
    notes:    form.notes    || null,
  });

  const resetForm = () => {
    setForm(f => ({ ...f, weight: "", waist: "", chest: "", hips: "", arms: "", thighs: "", body_fat: "", notes: "" }));
    setEditingId(null);
  };

  const handleEdit = (c: TrackerCheckin) => {
    setForm({ log_date: c.log_date, weight: c.weight?.toString() ?? "", waist: c.waist?.toString() ?? "", chest: c.chest?.toString() ?? "", hips: c.hips?.toString() ?? "", arms: c.arms?.toString() ?? "", thighs: c.thighs?.toString() ?? "", body_fat: c.body_fat?.toString() ?? "", notes: c.notes ?? "" });
    setEditingId(c.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!form.weight) return toast.error("Weight is required.");
    const payload = buildPayload();
    if (!editingId) {
      const existing = checkins.find(c => c.log_date === form.log_date);
      if (existing) { setPendingPayload(payload); setShowConflict(true); return; }
    }
    try {
      await addCheckin.mutateAsync(payload);
      toast.success(editingId ? "Check-in updated." : "Check-in saved.");
      resetForm();
    } catch { toast.error("Failed to save."); }
  };

  const handleReplace = async () => {
    try { await addCheckin.mutateAsync(pendingPayload); toast.success("Updated."); setShowConflict(false); setPendingPayload(null); resetForm(); }
    catch { toast.error("Failed."); }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try { await deleteCheckin.mutateAsync(confirmDeleteId); toast.success("Deleted."); setConfirmDeleteId(null); }
    catch { toast.error("Failed to delete."); }
  };

  const handleGoalSave = async () => {
    try {
      await upsertGoal.mutateAsync({
        goal_weight:   goalForm.goal_weight   ? parseFloat(goalForm.goal_weight)   : undefined,
        weekly_target: goalForm.weekly_target ? parseFloat(goalForm.weekly_target) : 0.5,
        start_weight:  checkins.length > 0 ? [...checkins].sort((a, b) => a.log_date.localeCompare(b.log_date))[0].weight : undefined,
      });
      toast.success("Goal saved."); setShowGoal(false);
    } catch { toast.error("Failed."); }
  };

  const sorted = [...checkins].sort((a, b) => b.log_date.localeCompare(a.log_date));
  const measurements = [
    { key: "waist", label: "Waist", unit: "cm" },
    { key: "chest", label: "Chest", unit: "cm" },
    { key: "hips",  label: "Hips",  unit: "cm" },
    { key: "arms",  label: "Arms",  unit: "cm" },
    { key: "thighs", label: "Thighs", unit: "cm" },
    { key: "body_fat", label: "Body fat", unit: "%" },
  ] as const;

  return (
    <div>
      {showConflict && <Modal title="Entry already exists" sub={`A check-in for ${pendingPayload?.log_date} already exists. Replace it?`} accent={C.accent} confirmLabel="Replace" onConfirm={handleReplace} onCancel={() => { setShowConflict(false); setPendingPayload(null); }} loading={addCheckin.isPending} />}
      {confirmDeleteId && <Modal title="Delete this check-in?" sub="This cannot be undone." accent={C.red} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setConfirmDeleteId(null)} loading={deleteCheckin.isPending} />}

      {/* Header */}
      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="kt-page-eyebrow">Progress</p>
          <h1 className="kt-page-title">Log <em>check-in</em></h1>
        </div>
        <button className="kt-btn kt-btn-outline" onClick={() => setShowGoal(v => !v)} style={{ marginBottom: "0.25rem" }}>
          {showGoal ? "Cancel" : goal?.goal_weight ? `Goal: ${goal.goal_weight} kg` : "Set goal"}
        </button>
      </div>

      {/* Goal settings */}
      {showGoal && (
        <div className="kt-card" style={{ marginBottom: "1rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Goal settings</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1rem" }}>
            <div>
              <label className="kt-label">Goal weight (kg)</label>
              <input className="kt-input" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 85" value={goalForm.goal_weight} onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
            <div>
              <label className="kt-label">Weekly target (kg/wk)</label>
              <input className="kt-input" type="number" inputMode="decimal" step="0.1" placeholder="0.5" value={goalForm.weekly_target} onChange={e => setGoalForm(f => ({ ...f, weekly_target: e.target.value }))} />
            </div>
          </div>
          <button className="kt-btn kt-btn-blue" onClick={handleGoalSave} disabled={upsertGoal.isPending}>
            {upsertGoal.isPending ? "Saving..." : "Save goal"}
          </button>
        </div>
      )}

      {/* 2-column: form + history */}
      <div className="kt-progress-grid">

        {/* ── FORM ── */}
        <div className="kt-card" style={{ borderColor: editingId ? "rgba(0,200,255,0.2)" : C.border }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", fontWeight: 600, color: C.text, margin: 0 }}>
              {editingId ? "✎ Editing check-in" : "New check-in"}
            </p>
            {editingId && (
              <button onClick={resetForm} style={{ background: "none", border: "none", fontSize: "0.75rem", color: C.dim, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Cancel
              </button>
            )}
          </div>

          {/* Date */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="kt-label">Date</label>
            <div style={{ position: "relative" }}>
              <input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }} />
              <div className="kt-input" style={{ textAlign: "center", cursor: "pointer", userSelect: "none", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
                {format(parseISO(form.log_date), "EEEE, d MMMM yyyy")}
              </div>
            </div>
          </div>

          {/* Weight */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="kt-label">Weight <span style={{ color: C.accent, fontSize: "0.7rem" }}>required</span></label>
            <WeightInput value={form.weight} onChange={setField("weight")} />
          </div>

          {/* Measurements toggle */}
          <button type="button" onClick={() => setShowMeasure(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", color: showMeasure ? C.muted : C.dim, fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", marginBottom: showMeasure ? "0.85rem" : "1.25rem", padding: 0, transition: "color 0.15s" }}>
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showMeasure ? "rotate(90deg)" : "rotate(0deg)", fontSize: "0.6rem" }}>▶</span>
            Body measurements <span style={{ color: C.dim, fontWeight: 400 }}>(optional)</span>
          </button>

          {/* Measurements grid */}
          {showMeasure && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem", padding: "1rem", background: "var(--kt-input-bg)", borderRadius: 10, border: "1px solid var(--kt-border2)" }}>
              {measurements.map(({ key, label, unit }) => (
                <div key={key}>
                  <label className="kt-label">{label}</label>
                  <div style={{ position: "relative" }}>
                    <input className="kt-input" type="number" inputMode="decimal" step="0.1" placeholder="—"
                      value={(form as Record<string, string>)[key]}
                      onChange={e => setField(key)(e.target.value)}
                      style={{ paddingRight: "2rem" }} />
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: C.dim, fontSize: "0.72rem", pointerEvents: "none" }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="kt-label">Notes</label>
            <textarea className="kt-input" rows={3} placeholder="How are you feeling? Any context for today's weigh-in..."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <button className="kt-btn kt-btn-blue" onClick={handleSubmit} disabled={addCheckin.isPending || !form.weight}
            style={{ width: "100%", opacity: !form.weight ? 0.4 : 1, fontSize: "0.85rem" }}>
            {addCheckin.isPending ? "Saving..." : editingId ? "Update check-in" : "Save check-in"}
          </button>
        </div>

        {/* ── HISTORY ── */}
        <div className="kt-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", fontWeight: 600, color: C.text, margin: 0 }}>Check-in history</p>
            <span style={{ fontSize: "0.72rem", color: C.dim }}>{sorted.length} entries</span>
          </div>

          {isLoading ? (
            <p style={{ color: C.dim, fontSize: "0.85rem" }}>Loading...</p>
          ) : sorted.length === 0 ? (
            <p style={{ color: C.dim, fontSize: "0.85rem" }}>No check-ins yet. Log your first one →</p>
          ) : (
            <div>
              {sorted.map((c: TrackerCheckin, i) => {
                const prev  = sorted[i + 1];
                const delta = prev ? +(c.weight - prev.weight).toFixed(1) : null;
                const hasMeasures = c.waist || c.chest || c.hips || c.arms || c.thighs || c.body_fat;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.9rem 0", borderBottom: "1px solid var(--kt-border2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.78rem", color: C.dim, minWidth: 100 }}>
                          {format(parseISO(c.log_date), "EEE, d MMM yyyy")}
                        </span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "1rem", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                          {c.weight} kg
                        </span>
                        {delta !== null && (
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: delta <= 0 ? C.green : C.red, background: delta <= 0 ? "var(--kt-green-bg)" : "var(--kt-red-bg)", padding: "0.1rem 0.5rem", borderRadius: 20 }}>
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        )}
                        {hasMeasures && (
                          <span style={{ fontSize: "0.65rem", color: C.dim, background: "var(--kt-border2)", padding: "0.15rem 0.5rem", borderRadius: 6, fontFamily: "'DM Sans',sans-serif" }}>
                            {[c.waist && `W${c.waist}`, c.chest && `C${c.chest}`, c.body_fat && `BF${c.body_fat}%`].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p style={{ fontSize: "0.73rem", color: "rgba(232,232,240,0.28)", fontStyle: "italic", margin: 0 }}>{c.notes}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0, paddingTop: "0.1rem" }}>
                      <button onClick={() => handleEdit(c)} title="Edit"
                        style={{ width: 30, height: 30, background: editingId === c.id ? "var(--kt-accent-bg)" : "var(--kt-border2)", border: `1px solid ${editingId === c.id ? "rgba(0,200,255,0.35)" : "var(--kt-border)"}`, borderRadius: 8, color: editingId === c.id ? C.accent : C.dim, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
                        onMouseEnter={e => { if (editingId !== c.id) { (e.currentTarget.style.background = "var(--kt-accent-bg)"); (e.currentTarget.style.color = C.accent); } }}
                        onMouseLeave={e => { if (editingId !== c.id) { (e.currentTarget.style.background = "var(--kt-border2)"); (e.currentTarget.style.color = C.dim); } }}>
                        ✎
                      </button>
                      <button onClick={() => setConfirmDeleteId(c.id)}
                        style={{ width: 30, height: 30, background: "var(--kt-border2)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "rgba(239,68,68,0.4)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
                        onMouseEnter={e => { (e.currentTarget.style.background = "var(--kt-red-bg)"); (e.currentTarget.style.color = C.red); }}
                        onMouseLeave={e => { (e.currentTarget.style.background = "var(--kt-border2)"); (e.currentTarget.style.color = "rgba(239,68,68,0.4)"); }}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
