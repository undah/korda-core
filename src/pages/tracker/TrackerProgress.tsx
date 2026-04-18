// src/pages/tracker/TrackerProgress.tsx
import React, { useState } from "react";
import { useTrackerCheckins, useAddCheckin, useDeleteCheckin, useTrackerGoal, useUpsertGoal } from "@/features/tracker/hooks/useTrackerCheckins";
import type { TrackerCheckin } from "@/features/tracker/types";
import { toast } from "sonner";
import ConfirmDeleteModal from "@/components/tracker/ConfirmDeleteModal";

const today = () => new Date().toISOString().split("T")[0];

export default function TrackerProgress() {
  const { data: checkins = [], isLoading } = useTrackerCheckins(90);
  const { data: goal } = useTrackerGoal();
  const addCheckin = useAddCheckin();
  const deleteCheckin = useDeleteCheckin();
  const upsertGoal = useUpsertGoal();

  const [form, setForm] = useState({
    log_date: today(), weight: "", waist: "", chest: "", hips: "", arms: "", thighs: "", body_fat: "", notes: "",
  });
  const [goalForm, setGoalForm] = useState({
    goal_weight: goal?.goal_weight?.toString() ?? "",
    weekly_target: goal?.weekly_target?.toString() ?? "0.5",
  });
  const [showGoal, setShowGoal] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

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

  const resetForm = () =>
    setForm(f => ({ ...f, weight: "", waist: "", chest: "", hips: "", arms: "", thighs: "", body_fat: "", notes: "" }));

  const handleSubmit = async () => {
    if (!form.weight) return toast.error("Weight is required.");
    const payload = buildPayload();
    const existing = checkins.find(c => c.log_date === form.log_date);
    if (existing) { setPendingPayload(payload); setShowConflict(true); return; }
    try {
      await addCheckin.mutateAsync(payload);
      toast.success("Check-in saved.");
      resetForm();
    } catch { toast.error("Failed to save check-in."); }
  };

  const handleReplace = async () => {
    try {
      await addCheckin.mutateAsync(pendingPayload);
      toast.success("Check-in updated.");
      setShowConflict(false); setPendingPayload(null); resetForm();
    } catch { toast.error("Failed to update."); }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteCheckin.mutateAsync(confirmDeleteId);
      toast.success("Check-in deleted.");
      setConfirmDeleteId(null);
    } catch { toast.error("Failed to delete."); }
  };

  const handleGoalSave = async () => {
    try {
      await upsertGoal.mutateAsync({
        goal_weight:   goalForm.goal_weight   ? parseFloat(goalForm.goal_weight)   : undefined,
        weekly_target: goalForm.weekly_target ? parseFloat(goalForm.weekly_target) : 0.5,
        start_weight:  checkins.length > 0 ? [...checkins].sort((a,b) => a.log_date.localeCompare(b.log_date))[0].weight : undefined,
      });
      toast.success("Goal updated."); setShowGoal(false);
    } catch { toast.error("Failed to save goal."); }
  };

  const sorted = [...checkins].sort((a, b) => b.log_date.localeCompare(a.log_date));

  return (
    <div>
      {/* CONFLICT MODAL */}
      {showConflict && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,9,11,0.88)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#0c1217", border: "1px solid rgba(90,180,212,0.15)", borderTop: "1px solid rgba(90,180,212,0.5)", padding: "2.5rem", maxWidth: 420, width: "90%" }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(90,180,212,0.5)", marginBottom: "1rem" }}>// conflict detected</p>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", fontWeight: 400, color: "#dde8ed", marginBottom: "0.75rem" }}>Entry already exists</h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(221,232,237,0.45)", lineHeight: 1.75, marginBottom: "2rem" }}>
              You already have a check-in for <strong style={{ color: "#dde8ed", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem" }}>{pendingPayload?.log_date}</strong>. Replace it with your current input, or cancel?
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="kt-btn kt-btn-blue" onClick={handleReplace} disabled={addCheckin.isPending} style={{ flex: 1 }}>
                {addCheckin.isPending ? "Saving..." : "Replace →"}
              </button>
              <button className="kt-btn kt-btn-outline" onClick={() => { setShowConflict(false); setPendingPayload(null); }} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      <ConfirmDeleteModal open={!!confirmDeleteId} label="this check-in" onConfirm={handleDelete} onCancel={() => setConfirmDeleteId(null)} loading={deleteCheckin.isPending} />

      {/* HEADER */}
      <div className="kt-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="kt-page-eyebrow">Progress</p>
          <h1 className="kt-page-title">Log <em>check-in</em></h1>
        </div>
        <button className="kt-btn kt-btn-outline" onClick={() => setShowGoal(v => !v)}>
          {showGoal ? "Hide goal" : "Set goal"}
        </button>
      </div>

      {/* GOAL FORM */}
      {showGoal && (
        <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
          <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Goal settings</p>
          <div className="kt-grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="kt-label">Target weight (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder={goal?.goal_weight?.toString() ?? "e.g. 75"} value={goalForm.goal_weight} onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
            <div>
              <label className="kt-label">Weekly loss target (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="0.5" value={goalForm.weekly_target} onChange={e => setGoalForm(f => ({ ...f, weekly_target: e.target.value }))} />
            </div>
          </div>
          <button className="kt-btn kt-btn-blue" onClick={handleGoalSave} disabled={upsertGoal.isPending}>
            {upsertGoal.isPending ? "Saving..." : "Save goal"}
          </button>
        </div>
      )}

      {/* CHECK-IN FORM */}
      <div className="kt-card" style={{ marginBottom: "2rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>New check-in</p>
        <div className="kt-grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label className="kt-label">Date</label>
            <input className="kt-input" type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
          </div>
          <div>
            <label className="kt-label">Weight (kg) *</label>
            <input className="kt-input" type="number" step="0.1" placeholder="e.g. 82.4" value={form.weight} onChange={set("weight")} />
          </div>
        </div>

        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.2)", marginBottom: "0.75rem", marginTop: "0.5rem" }}>Measurements (optional)</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1rem" }}>
          {[{ key: "waist", label: "Waist (cm)" }, { key: "chest", label: "Chest (cm)" }, { key: "hips", label: "Hips (cm)" }, { key: "arms", label: "Arms (cm)" }, { key: "thighs", label: "Thighs (cm)" }, { key: "body_fat", label: "Body fat (%)" }].map(({ key, label }) => (
            <div key={key}>
              <label className="kt-label">{label}</label>
              <input className="kt-input" type="number" step="0.1" placeholder="—" value={(form as Record<string,string>)[key]} onChange={set(key)} />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="kt-label">Notes</label>
          <textarea className="kt-input" placeholder="How are you feeling? Any context for today's weight..." value={form.notes} onChange={set("notes")} />
        </div>

        <button className="kt-btn kt-btn-blue" onClick={handleSubmit} disabled={addCheckin.isPending}>
          {addCheckin.isPending ? "Saving..." : "Save check-in →"}
        </button>
      </div>

      {/* HISTORY TABLE */}
      <div className="kt-card">
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>Check-in history</p>
        {isLoading ? (
          <p style={{ color: "rgba(221,232,237,0.2)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem" }}>Loading...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: "rgba(221,232,237,0.2)", fontSize: "0.85rem" }}>No check-ins yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  {["Date","Weight","Waist","Chest","Hips","Body fat","Notes",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", borderBottom: "1px solid rgba(90,180,212,0.07)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c: TrackerCheckin) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(90,180,212,0.04)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(221,232,237,0.4)" }}>{c.log_date}</td>
                    <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: "#5ab4d4", fontWeight: 500 }}>{c.weight} kg</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{c.waist ?? "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{c.chest ?? "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{c.hips ?? "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{c.body_fat ? `${c.body_fat}%` : "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.3)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.notes ?? "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <button onClick={() => setConfirmDeleteId(c.id)}
                        style={{ background: "none", border: "none", color: "rgba(212,112,90,0.35)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.1em", transition: "color 0.2s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "rgba(212,112,90,0.8)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "rgba(212,112,90,0.35)")}>
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
