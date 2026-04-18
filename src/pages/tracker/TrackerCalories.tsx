// src/pages/tracker/TrackerCalories.tsx
import React, { useState } from "react";
import { useTrackerCalories, useUpsertCalories, useDeleteCalories } from "@/features/tracker/hooks/useTrackerJournal";
import { toast } from "sonner";
import ConfirmDeleteModal from "@/components/tracker/ConfirmDeleteModal";

const today = () => new Date().toISOString().split("T")[0];
const isMobile = () => window.innerWidth <= 768;

export default function TrackerCalories() {
  const { data: entries = [], isLoading } = useTrackerCalories(30);
  const upsert = useUpsertCalories();
  const deleteCalorie = useDeleteCalories();

  const [form, setForm] = useState({
    log_date: today(), calories_in: "", protein_g: "", carbs_g: "", fat_g: "", tdee: "2000",
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mobile] = useState(isMobile);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const deficit = form.calories_in && form.tdee
    ? parseInt(form.tdee) - parseInt(form.calories_in) : null;

  const handleSubmit = async () => {
    if (!form.calories_in) return toast.error("Calories are required.");
    try {
      await upsert.mutateAsync({
        log_date: form.log_date, calories_in: parseInt(form.calories_in),
        protein_g: form.protein_g ? parseFloat(form.protein_g) : null,
        carbs_g:   form.carbs_g   ? parseFloat(form.carbs_g)   : null,
        fat_g:     form.fat_g     ? parseFloat(form.fat_g)     : null,
        tdee: parseInt(form.tdee),
      });
      toast.success("Calories logged.");
      setForm(f => ({ ...f, calories_in: "", protein_g: "", carbs_g: "", fat_g: "" }));
    } catch { toast.error("Failed to save."); }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    try {
      await deleteCalorie.mutateAsync(confirmId);
      toast.success("Entry deleted.");
      setConfirmId(null);
    } catch { toast.error("Failed to delete."); }
  };

  const sorted = [...entries].sort((a, b) => b.log_date.localeCompare(a.log_date));
  const last7 = sorted.slice(0, 7);
  const avgIntake     = last7.length ? Math.round(last7.reduce((s,e) => s + e.calories_in, 0) / last7.length) : null;
  const avgDeficit    = last7.length ? Math.round(last7.reduce((s,e) => s + e.deficit, 0) / last7.length) : null;
  const totalDeficit7 = last7.length ? last7.reduce((s,e) => s + e.deficit, 0) : null;
  const estFatLoss7   = totalDeficit7 ? +((totalDeficit7 / 7700) * 1000).toFixed(0) : null;

  return (
    <div>
      <ConfirmDeleteModal open={!!confirmId} label="this calorie log" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} loading={deleteCalorie.isPending} />

      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Nutrition</p>
        <h1 className="kt-page-title">Calories <em>& deficit</em></h1>
      </div>

      {/* 7d summary — 2x2 on all screens */}
      {last7.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: "1.5rem" }}>
          <div className="kt-card">
            <p className="kt-card-label">7d avg intake</p>
            <p className="kt-card-value">{avgIntake ?? "—"}</p>
            <p className="kt-card-sub">kcal / day</p>
          </div>
          <div className="kt-card">
            <p className="kt-card-label">7d avg deficit</p>
            <p className="kt-card-value" style={{ color: avgDeficit && avgDeficit > 0 ? "#5ad4a0" : "#d4705a" }}>
              {avgDeficit !== null ? (avgDeficit > 0 ? "-" : "+") + Math.abs(avgDeficit) : "—"}
            </p>
            <p className="kt-card-sub">kcal / day</p>
          </div>
          <div className="kt-card">
            <p className="kt-card-label">Total deficit (7d)</p>
            <p className="kt-card-value" style={{ color: "#5ad4a0" }}>{totalDeficit7 !== null ? totalDeficit7.toLocaleString() : "—"}</p>
            <p className="kt-card-sub">kcal</p>
          </div>
          <div className="kt-card">
            <p className="kt-card-label">Est. fat loss (7d)</p>
            <p className="kt-card-value">{estFatLoss7 !== null ? `${estFatLoss7}g` : "—"}</p>
            <p className="kt-card-sub">from deficit only</p>
          </div>
        </div>
      )}

      {/* LOG FORM */}
      <div className="kt-card" style={{ marginBottom: "2rem" }}>
        <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>Log calories</p>

        {/* date + tdee */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label className="kt-label">Date</label>
            <input className="kt-input" type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
          </div>
          <div>
            <label className="kt-label">TDEE</label>
            <input className="kt-input" type="number" placeholder="2000" value={form.tdee} onChange={set("tdee")} />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="kt-label">Calories consumed *</label>
          <input className="kt-input" type="number" placeholder="e.g. 1650" value={form.calories_in} onChange={set("calories_in")} style={{ fontSize: "1.1rem" }} />
        </div>

        {deficit !== null && (
          <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: deficit > 0 ? "rgba(90,212,160,0.07)" : "rgba(212,112,90,0.07)", border: `1px solid ${deficit > 0 ? "rgba(90,212,160,0.2)" : "rgba(212,112,90,0.2)"}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", color: deficit > 0 ? "#5ad4a0" : "#d4705a" }}>
            {deficit > 0 ? `↓ ${deficit} kcal deficit` : `↑ ${Math.abs(deficit)} kcal surplus`}
            {deficit > 0 && <span style={{ color: "rgba(221,232,237,0.3)", marginLeft: "1rem" }}>≈ {((deficit / 7700) * 1000).toFixed(0)}g fat</span>}
          </div>
        )}

        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.2)", marginBottom: "0.75rem" }}>Macros (optional)</p>

        {/* macros — 1 col on mobile, 3 col on desktop */}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div><label className="kt-label">Protein (g)</label><input className="kt-input" type="number" step="1" placeholder="—" value={form.protein_g} onChange={set("protein_g")} /></div>
          <div><label className="kt-label">Carbs (g)</label><input className="kt-input" type="number" step="1" placeholder="—" value={form.carbs_g} onChange={set("carbs_g")} /></div>
          <div style={{ gridColumn: mobile ? "1 / -1" : "auto" }}><label className="kt-label">Fat (g)</label><input className="kt-input" type="number" step="1" placeholder="—" value={form.fat_g} onChange={set("fat_g")} /></div>
        </div>

        <button className="kt-btn kt-btn-blue" onClick={handleSubmit} disabled={upsert.isPending} style={{ width: "100%" }}>
          {upsert.isPending ? "Saving..." : "Log calories →"}
        </button>
      </div>

      {/* HISTORY */}
      <div className="kt-card">
        <p className="kt-card-label" style={{ marginBottom: "1rem" }}>History</p>
        {isLoading ? (
          <p style={{ color: "rgba(221,232,237,0.2)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem" }}>Loading...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: "rgba(221,232,237,0.3)", fontSize: "0.85rem" }}>No calorie logs yet.</p>
        ) : mobile ? (
          /* MOBILE: card list */
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sorted.map(e => (
              <div key={e.id} style={{ padding: "0.75rem", background: "#0a0e12", borderLeft: "2px solid rgba(90,180,212,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "rgba(221,232,237,0.4)" }}>{e.log_date}</span>
                  <button onClick={() => setConfirmId(e.id)}
                    style={{ background: "none", border: "none", color: "rgba(212,112,90,0.4)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem" }}>
                    delete
                  </button>
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.9rem", fontWeight: 500, color: "#dde8ed" }}>{e.calories_in} kcal</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: e.deficit > 0 ? "#5ad4a0" : "#d4705a" }}>
                    {e.deficit > 0 ? "-" : "+"}{Math.abs(e.deficit)} deficit
                  </span>
                </div>
                {(e.protein_g || e.carbs_g || e.fat_g) && (
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.3rem" }}>
                    {e.protein_g && <span style={{ fontSize: "0.72rem", color: "rgba(221,232,237,0.35)" }}>P {e.protein_g}g</span>}
                    {e.carbs_g   && <span style={{ fontSize: "0.72rem", color: "rgba(221,232,237,0.35)" }}>C {e.carbs_g}g</span>}
                    {e.fat_g     && <span style={{ fontSize: "0.72rem", color: "rgba(221,232,237,0.35)" }}>F {e.fat_g}g</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* DESKTOP: table */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Date","Intake","TDEE","Deficit","Protein","Carbs","Fat",""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", borderBottom: "1px solid rgba(90,180,212,0.07)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(90,180,212,0.04)" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(221,232,237,0.4)", whiteSpace: "nowrap" }}>{e.log_date}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", color: "#dde8ed" }}>{e.calories_in}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{e.tdee}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, color: e.deficit > 0 ? "#5ad4a0" : "#d4705a" }}>{e.deficit > 0 ? "-" : "+"}{Math.abs(e.deficit)}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{e.protein_g ?? "—"}g</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{e.carbs_g ?? "—"}g</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "rgba(221,232,237,0.4)" }}>{e.fat_g ?? "—"}g</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <button onClick={() => setConfirmId(e.id)}
                      style={{ background: "none", border: "none", color: "rgba(212,112,90,0.35)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", transition: "color 0.2s" }}
                      onMouseEnter={ev => (ev.currentTarget.style.color = "rgba(212,112,90,0.8)")}
                      onMouseLeave={ev => (ev.currentTarget.style.color = "rgba(212,112,90,0.35)")}>
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
