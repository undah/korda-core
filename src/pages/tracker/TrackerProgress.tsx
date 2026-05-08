import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { useTrackerCheckins, useAddCheckin, useDeleteCheckin, useTrackerGoal, useUpsertGoal } from "@/features/tracker/hooks/useTrackerCheckins";
import type { TrackerCheckin } from "@/features/tracker/types";
import { toast } from "sonner";

const today = () => new Date().toISOString().split("T")[0];

const C = {
  accent: "#00C8FF", green: "#5ad4a0", red: "#d4705a",
  text: "#dde8ed", muted: "rgba(221,232,237,0.3)", dim: "rgba(221,232,237,0.15)",
  border: "rgba(0,200,255,0.08)", card: "#0D0D16",
};

// ── Custom weight input ───────────────────────────────────────────────────────

function WeightInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const adjust = (delta: number) => {
    const cur = parseFloat(value) || 0;
    onChange(Math.max(0, +(cur + delta).toFixed(1)).toString());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Quick-adjust chips */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {[-1, -0.5, +0.5, +1].map(d => (
          <button
            key={d} type="button" onClick={() => adjust(d)}
            style={{
              flex: 1, padding: "0.45rem 0",
              background: "rgba(0,200,255,0.04)",
              border: "1px solid rgba(0,200,255,0.1)",
              borderRadius: 8,
              color: d < 0 ? C.green : C.red,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem",
              cursor: "pointer", letterSpacing: "0.03em", transition: "background 0.12s",
              WebkitTapHighlightColor: "transparent",
            }}
            onTouchStart={e => (e.currentTarget.style.background = "rgba(0,200,255,0.12)")}
            onTouchEnd={e => (e.currentTarget.style.background = "rgba(0,200,255,0.04)")}
          >
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>

      {/* Main +/- input */}
      <div style={{ display: "flex", alignItems: "stretch", background: "#080810", border: "1px solid rgba(0,200,255,0.2)", borderRadius: 12, overflow: "hidden" }}>
        <button
          type="button" onClick={() => adjust(-0.1)}
          style={{ width: 64, background: "rgba(0,200,255,0.04)", border: "none", borderRight: "1px solid rgba(0,200,255,0.08)", color: "rgba(221,232,237,0.5)", fontSize: "1.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", WebkitTapHighlightColor: "transparent", transition: "background 0.1s" }}
          onTouchStart={e => (e.currentTarget.style.background = "rgba(0,200,255,0.14)")}
          onTouchEnd={e => (e.currentTarget.style.background = "rgba(0,200,255,0.04)")}
        >−</button>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.6rem 0 0.5rem" }}>
          <input
            type="number" inputMode="decimal" step={0.1}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="0.0"
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              color: value ? C.accent : "rgba(221,232,237,0.18)",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: "2.4rem", fontWeight: 500,
              textAlign: "center", padding: "0 0.5rem",
            }}
          />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.22)", letterSpacing: "0.12em" }}>kg</span>
        </div>

        <button
          type="button" onClick={() => adjust(+0.1)}
          style={{ width: 64, background: "rgba(0,200,255,0.04)", border: "none", borderLeft: "1px solid rgba(0,200,255,0.08)", color: "rgba(221,232,237,0.5)", fontSize: "1.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", WebkitTapHighlightColor: "transparent", transition: "background 0.1s" }}
          onTouchStart={e => (e.currentTarget.style.background = "rgba(0,200,255,0.14)")}
          onTouchEnd={e => (e.currentTarget.style.background = "rgba(0,200,255,0.04)")}
        >+</button>
      </div>
    </div>
  );
}

// ── Measurement row ───────────────────────────────────────────────────────────

function MeasureRow({ label, value, onChange, unit = "cm" }: { label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  const adjust = (delta: number) => {
    const cur = parseFloat(value) || 0;
    onChange(Math.max(0, +(cur + delta).toFixed(1)).toString());
  };

  const btnStyle: React.CSSProperties = {
    width: 44, height: 44, background: "none", border: "none",
    color: "rgba(221,232,237,0.4)", fontSize: "1.2rem",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, userSelect: "none", WebkitTapHighlightColor: "transparent",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0", borderBottom: "1px solid rgba(0,200,255,0.05)" }}>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, width: 56, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#080810", border: "1px solid rgba(0,200,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
        <button type="button" onClick={() => adjust(-0.1)} style={{ ...btnStyle, borderRight: "1px solid rgba(0,200,255,0.06)" }}>−</button>
        <input
          type="number" inputMode="decimal" step={0.1}
          value={value} onChange={e => onChange(e.target.value)} placeholder="—"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.88rem", textAlign: "center", padding: "0 0.25rem" }}
        />
        <button type="button" onClick={() => adjust(0.1)} style={{ ...btnStyle, borderLeft: "1px solid rgba(0,200,255,0.06)" }}>+</button>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: C.dim, width: 20, textAlign: "right", flexShrink: 0 }}>{unit}</span>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function Modal({ title, sub, accent, confirmLabel, onConfirm, onCancel, loading, children }: {
  title: string; sub?: string; accent: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,6,10,0.9)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: "1.25rem" }}>
      <div style={{ background: "#0c0c18", border: `1px solid ${accent}22`, borderTop: `2px solid ${accent}88`, borderRadius: 14, padding: "1.75rem", maxWidth: 420, width: "100%" }}>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.56rem", letterSpacing: "0.22em", textTransform: "uppercase", color: `${accent}80`, marginBottom: "0.85rem" }}>// confirm</p>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 400, color: C.text, marginBottom: "0.65rem" }}>{title}</h3>
        {sub && <p style={{ fontSize: "0.83rem", color: "rgba(221,232,237,0.4)", lineHeight: 1.7, marginBottom: "1.5rem" }}>{sub}</p>}
        {children}
        <div style={{ display: "flex", gap: "0.65rem", marginTop: "1.5rem" }}>
          <button className="kt-btn" onClick={onConfirm} disabled={loading} style={{ flex: 1, background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
            {loading ? "Working..." : confirmLabel}
          </button>
          <button className="kt-btn kt-btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  const resetForm = () => setForm(f => ({ ...f, weight: "", waist: "", chest: "", hips: "", arms: "", thighs: "", body_fat: "", notes: "" }));

  const handleSubmit = async () => {
    if (!form.weight) return toast.error("Weight is required.");
    const payload  = buildPayload();
    const existing = checkins.find(c => c.log_date === form.log_date);
    if (existing) { setPendingPayload(payload); setShowConflict(true); return; }
    try { await addCheckin.mutateAsync(payload); toast.success("Check-in saved."); resetForm(); }
    catch { toast.error("Failed to save."); }
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
        start_weight:  checkins.length > 0 ? [...checkins].sort((a,b) => a.log_date.localeCompare(b.log_date))[0].weight : undefined,
      });
      toast.success("Goal updated."); setShowGoal(false);
    } catch { toast.error("Failed."); }
  };

  const sorted = [...checkins].sort((a, b) => b.log_date.localeCompare(a.log_date));

  return (
    <div>
      {/* Conflict modal */}
      {showConflict && (
        <Modal
          title="Entry already exists"
          sub={`A check-in for ${pendingPayload?.log_date} already exists. Replace it with the new values?`}
          accent={C.accent} confirmLabel="Replace →"
          onConfirm={handleReplace} onCancel={() => { setShowConflict(false); setPendingPayload(null); }}
          loading={addCheckin.isPending}
        />
      )}

      {/* Delete modal */}
      {confirmDeleteId && (
        <Modal
          title="Delete this check-in?"
          sub="This action cannot be undone."
          accent={C.red} confirmLabel="Delete"
          onConfirm={handleDelete} onCancel={() => setConfirmDeleteId(null)}
          loading={deleteCheckin.isPending}
        />
      )}

      {/* Header */}
      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="kt-page-eyebrow">Progress</p>
          <h1 className="kt-page-title">Log <em>check-in</em></h1>
        </div>
        <button className="kt-btn kt-btn-outline" onClick={() => setShowGoal(v => !v)}>
          {showGoal ? "Hide goal" : "Set goal"}
        </button>
      </div>

      {/* Goal form */}
      {showGoal && (
        <div className="kt-card" style={{ marginBottom: "1.25rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Goal settings</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="kt-label">Target weight (kg)</label>
              <input className="kt-input" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 75"
                value={goalForm.goal_weight} onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
            <div>
              <label className="kt-label">Weekly target (kg)</label>
              <input className="kt-input" type="number" inputMode="decimal" step="0.1" placeholder="0.5"
                value={goalForm.weekly_target} onChange={e => setGoalForm(f => ({ ...f, weekly_target: e.target.value }))} />
            </div>
          </div>
          <button className="kt-btn kt-btn-blue" onClick={handleGoalSave} disabled={upsertGoal.isPending}>
            {upsertGoal.isPending ? "Saving..." : "Save goal"}
          </button>
        </div>
      )}

      {/* Check-in form */}
      <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1.25rem" }}>New check-in</p>

        {/* Date */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label className="kt-label">Date</label>
          <input className="kt-input" type="date" value={form.log_date}
            onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
        </div>

        {/* Weight */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label className="kt-label">Weight (kg) *</label>
          <WeightInput value={form.weight} onChange={setField("weight")} />
        </div>

        {/* Measurements toggle */}
        <button
          type="button"
          onClick={() => setShowMeasure(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "none", border: "none", color: showMeasure ? "rgba(221,232,237,0.45)" : "rgba(221,232,237,0.25)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", marginBottom: showMeasure ? "0.65rem" : "1.25rem", padding: 0, WebkitTapHighlightColor: "transparent", transition: "color 0.15s" }}
        >
          <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showMeasure ? "rotate(90deg)" : "rotate(0deg)", fontSize: "0.5rem" }}>▶</span>
          Measurements (optional)
        </button>

        {/* Measurement rows */}
        {showMeasure && (
          <div style={{ marginBottom: "1.25rem", background: "#0a0a14", border: "1px solid rgba(0,200,255,0.06)", borderRadius: 10, padding: "0.25rem 0.85rem" }}>
            {[
              { key: "waist",    label: "Waist",    unit: "cm" },
              { key: "chest",    label: "Chest",    unit: "cm" },
              { key: "hips",     label: "Hips",     unit: "cm" },
              { key: "arms",     label: "Arms",     unit: "cm" },
              { key: "thighs",   label: "Thighs",   unit: "cm" },
              { key: "body_fat", label: "Body fat", unit: "%" },
            ].map(({ key, label, unit }) => (
              <MeasureRow key={key} label={label} value={(form as Record<string,string>)[key]} onChange={setField(key)} unit={unit} />
            ))}
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label className="kt-label">Notes</label>
          <textarea className="kt-input" rows={3}
            placeholder="How are you feeling? Any context for today's weigh-in..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <button
          className="kt-btn kt-btn-blue"
          onClick={handleSubmit}
          disabled={addCheckin.isPending || !form.weight}
          style={{ width: "100%", opacity: !form.weight ? 0.45 : 1, fontSize: "0.78rem" }}
        >
          {addCheckin.isPending ? "Saving..." : "Save check-in →"}
        </button>
      </div>

      {/* History */}
      <div className="kt-card">
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Check-in history</p>
        {isLoading ? (
          <p style={{ color: C.dim, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem" }}>Loading...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: C.dim, fontSize: "0.85rem" }}>No check-ins yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {sorted.map((c: TrackerCheckin, i) => {
              const prev  = sorted[i + 1];
              const delta = prev ? +(c.weight - prev.weight).toFixed(1) : null;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0.9rem", background: "#0a0a14", borderLeft: "2px solid rgba(90,180,212,0.15)", borderRadius: "0 8px 8px 0" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: C.muted }}>
                        {format(parseISO(c.log_date), "EEE, MMM d yyyy")}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.9rem", fontWeight: 500, color: "#5ab4d4" }}>{c.weight} kg</span>
                      {delta !== null && (
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", color: delta <= 0 ? C.green : C.red }}>
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                      {c.waist    && <span style={{ fontSize: "0.68rem", color: "rgba(221,232,237,0.32)" }}>W {c.waist}</span>}
                      {c.chest    && <span style={{ fontSize: "0.68rem", color: "rgba(221,232,237,0.32)" }}>C {c.chest}</span>}
                      {c.hips     && <span style={{ fontSize: "0.68rem", color: "rgba(221,232,237,0.32)" }}>H {c.hips}</span>}
                      {c.body_fat && <span style={{ fontSize: "0.68rem", color: "rgba(221,232,237,0.32)" }}>BF {c.body_fat}%</span>}
                      {c.notes    && <span style={{ fontSize: "0.68rem", color: "rgba(221,232,237,0.2)", fontStyle: "italic" }}>{c.notes}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    style={{ width: 32, height: 32, background: "none", border: "1px solid rgba(212,112,90,0.15)", borderRadius: 8, color: "rgba(212,112,90,0.4)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}
                    onTouchStart={e => { (e.currentTarget.style.background = "rgba(212,112,90,0.12)"); (e.currentTarget.style.color = C.red); }}
                    onTouchEnd={e => { (e.currentTarget.style.background = "none"); (e.currentTarget.style.color = "rgba(212,112,90,0.4)"); }}
                    onMouseEnter={e => { (e.currentTarget.style.background = "rgba(212,112,90,0.1)"); (e.currentTarget.style.color = C.red); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = "none"); (e.currentTarget.style.color = "rgba(212,112,90,0.4)"); }}
                  >×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
