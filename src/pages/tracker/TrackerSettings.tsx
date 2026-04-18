// src/pages/tracker/TrackerSettings.tsx
import React, { useState, useEffect } from "react";
import { useTrackerProfile, useUpsertProfile, useDeleteAllTrackerData } from "@/features/tracker/hooks/useTrackerProfile";
import { useTrackerGoal, useUpsertGoal } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import { useTrackerCalories } from "@/features/tracker/hooks/useTrackerJournal";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const GENDERS = [
  { value: "male",        label: "Male" },
  { value: "female",      label: "Female" },
  { value: "other",       label: "Other" },
  { value: "prefer_not",  label: "Prefer not to say" },
];

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(90,180,212,0.4)", marginBottom: "0.35rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "rgba(221,232,237,0.2)" }}>//</span>{eyebrow}
        </p>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 400, color: "#dde8ed" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function TrackerSettings() {
  const { data: profile, isLoading: profileLoading } = useTrackerProfile();
  const { data: goal } = useTrackerGoal();
  const { data: checkins = [] } = useTrackerCheckins(365);
  const { data: calories = [] } = useTrackerCalories(365);
  const upsertProfile = useUpsertProfile();
  const upsertGoal = useUpsertGoal();
  const deleteAll = useDeleteAllTrackerData();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    display_name: "", height_cm: "", age: "", gender: "", tdee: "2000",
  });
  const [goalForm, setGoalForm] = useState({
    goal_weight: "", weekly_target: "0.5",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // populate forms when data loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        display_name: profile.display_name ?? "",
        height_cm:    profile.height_cm?.toString() ?? "",
        age:          profile.age?.toString() ?? "",
        gender:       profile.gender ?? "",
        tdee:         profile.tdee?.toString() ?? "2000",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (goal) {
      setGoalForm({
        goal_weight:   goal.goal_weight?.toString() ?? "",
        weekly_target: goal.weekly_target?.toString() ?? "0.5",
      });
    }
  }, [goal]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
    });
  }, []);

  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfileForm(f => ({ ...f, [k]: e.target.value }));

  const handleProfileSave = async () => {
    try {
      await upsertProfile.mutateAsync({
        display_name: profileForm.display_name  || null,
        height_cm:    profileForm.height_cm     ? parseFloat(profileForm.height_cm)  : null,
        age:          profileForm.age           ? parseInt(profileForm.age)           : null,
        gender:       (profileForm.gender as any) || null,
        tdee:         profileForm.tdee          ? parseInt(profileForm.tdee)          : 2000,
      });
      toast.success("Profile saved.");
    } catch { toast.error("Failed to save profile."); }
  };

  const handleGoalSave = async () => {
    try {
      await upsertGoal.mutateAsync({
        goal_weight:   goalForm.goal_weight   ? parseFloat(goalForm.goal_weight)   : undefined,
        weekly_target: goalForm.weekly_target ? parseFloat(goalForm.weekly_target) : 0.5,
        start_weight:  checkins.length > 0 ? [...checkins].sort((a,b) => a.log_date.localeCompare(b.log_date))[0].weight : undefined,
      });
      toast.success("Goals saved.");
    } catch { toast.error("Failed to save goals."); }
  };

  // CSV export
  const handleExport = () => {
    const rows: string[] = [];

    // checkins
    rows.push("=== CHECK-INS ===");
    rows.push("date,weight,waist,chest,hips,arms,thighs,body_fat,notes");
    checkins.sort((a,b) => a.log_date.localeCompare(b.log_date)).forEach(c => {
      rows.push(`${c.log_date},${c.weight},${c.waist??''},${c.chest??''},${c.hips??''},${c.arms??''},${c.thighs??''},${c.body_fat??''},"${c.notes??''}"`);
    });

    // calories
    rows.push("");
    rows.push("=== CALORIES ===");
    rows.push("date,calories_in,tdee,deficit,protein_g,carbs_g,fat_g");
    calories.sort((a,b) => a.log_date.localeCompare(b.log_date)).forEach(c => {
      rows.push(`${c.log_date},${c.calories_in},${c.tdee},${c.deficit},${c.protein_g??''},${c.carbs_g??''},${c.fat_g??''}`);
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kordatracker-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported.");
  };

  const handleDeleteAll = async () => {
    if (deleteInput !== "DELETE") return toast.error('Type DELETE to confirm.');
    try {
      await deleteAll.mutateAsync();
      toast.success("All data deleted.");
      navigate("/tracker/dashboard");
    } catch { toast.error("Failed to delete data."); }
  };

  // BMI helper
  const bmi = profileForm.height_cm && checkins.length > 0
    ? (() => {
        const latest = [...checkins].sort((a,b) => b.log_date.localeCompare(a.log_date))[0];
        const h = parseFloat(profileForm.height_cm) / 100;
        return (latest.weight / (h * h)).toFixed(1);
      })()
    : null;

  if (profileLoading) return (
    <div style={{ color: "rgba(221,232,237,0.3)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
      loading...
    </div>
  );

  return (
    <div>
      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Settings</p>
        <h1 className="kt-page-title">Account <em>& preferences</em></h1>
      </div>

      {/* ── PROFILE ── */}
      <Section eyebrow="Profile" title="Your profile">
        <div className="kt-card">
          {userEmail && (
            <div style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid rgba(90,180,212,0.07)" }}>
              <p className="kt-card-label">Signed in as</p>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", color: "#5ab4d4" }}>{userEmail}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="kt-label">Display name</label>
              <input className="kt-input" type="text" placeholder="e.g. Alex" value={profileForm.display_name} onChange={setP("display_name")} />
            </div>
            <div>
              <label className="kt-label">Height (cm)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="e.g. 178" value={profileForm.height_cm} onChange={setP("height_cm")} />
            </div>
            <div>
              <label className="kt-label">Age</label>
              <input className="kt-input" type="number" placeholder="e.g. 28" value={profileForm.age} onChange={setP("age")} />
            </div>
            <div>
              <label className="kt-label">Gender</label>
              <select className="kt-input" value={profileForm.gender} onChange={setP("gender")}>
                <option value="">Select...</option>
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="kt-label">TDEE (maintenance kcal)</label>
              <input className="kt-input" type="number" placeholder="2000" value={profileForm.tdee} onChange={setP("tdee")} />
            </div>
          </div>

          {/* BMI display */}
          {bmi && (
            <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "rgba(90,180,212,0.05)", border: "1px solid rgba(90,180,212,0.1)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.2rem" }}>Current BMI</p>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.2rem", fontWeight: 500, color: "#5ab4d4" }}>{bmi}</p>
              </div>
              <p style={{ fontSize: "0.75rem", color: "rgba(221,232,237,0.35)" }}>
                {parseFloat(bmi) < 18.5 ? "Underweight" : parseFloat(bmi) < 25 ? "Healthy weight" : parseFloat(bmi) < 30 ? "Overweight" : "Obese"}
              </p>
            </div>
          )}

          <button className="kt-btn kt-btn-blue" onClick={handleProfileSave} disabled={upsertProfile.isPending}>
            {upsertProfile.isPending ? "Saving..." : "Save profile →"}
          </button>
        </div>
      </Section>

      {/* ── GOALS ── */}
      <Section eyebrow="Goals" title="Weight goals">
        <div className="kt-card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="kt-label">Target weight (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="e.g. 75" value={goalForm.goal_weight} onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
            <div>
              <label className="kt-label">Weekly loss target (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="0.5" value={goalForm.weekly_target} onChange={e => setGoalForm(f => ({ ...f, weekly_target: e.target.value }))} />
            </div>
          </div>

          {goalForm.goal_weight && goalForm.weekly_target && checkins.length > 0 && (
            <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "rgba(90,180,212,0.05)", border: "1px solid rgba(90,180,212,0.1)" }}>
              {(() => {
                const latest = [...checkins].sort((a,b) => b.log_date.localeCompare(a.log_date))[0];
                const remaining = latest.weight - parseFloat(goalForm.goal_weight);
                const weeks = remaining > 0 ? Math.ceil(remaining / parseFloat(goalForm.weekly_target)) : 0;
                const eta = new Date();
                eta.setDate(eta.getDate() + weeks * 7);
                return (
                  <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.2rem" }}>Remaining</p>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: remaining > 0 ? "#dde8ed" : "#5ad4a0" }}>{remaining > 0 ? `${remaining.toFixed(1)} kg` : "Goal reached! 🎯"}</p>
                    </div>
                    {remaining > 0 && (
                      <div>
                        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.2rem" }}>Estimated arrival</p>
                        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: "#5ab4d4" }}>
                          {eta.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <button className="kt-btn kt-btn-blue" onClick={handleGoalSave} disabled={upsertGoal.isPending}>
            {upsertGoal.isPending ? "Saving..." : "Save goals →"}
          </button>
        </div>
      </Section>

      {/* ── DATA MANAGEMENT ── */}
      <Section eyebrow="Data" title="Data management">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* export */}
          <div className="kt-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "#dde8ed", marginBottom: "0.3rem" }}>Export data as CSV</p>
                <p style={{ fontSize: "0.78rem", color: "rgba(221,232,237,0.35)", lineHeight: 1.6 }}>
                  Download all your check-ins and calorie logs as a CSV file.
                  {checkins.length > 0 && <span style={{ color: "rgba(90,180,212,0.6)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem" }}> {checkins.length} check-ins · {calories.length} calorie logs</span>}
                </p>
              </div>
              <button className="kt-btn kt-btn-outline" onClick={handleExport}>
                Export CSV →
              </button>
            </div>
          </div>

          {/* delete */}
          <div className="kt-card" style={{ borderTop: "1px solid rgba(212,112,90,0.3)" }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "#d4705a", marginBottom: "0.3rem" }}>Delete all data</p>
            <p style={{ fontSize: "0.78rem", color: "rgba(221,232,237,0.35)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Permanently delete all your check-ins, journals, calorie logs, photos, and profile. This cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", letterSpacing: "0.08em", background: "rgba(212,112,90,0.08)", border: "1px solid rgba(212,112,90,0.3)", color: "#d4705a", padding: "0.7rem 1.4rem", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,112,90,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,112,90,0.08)")}
              >
                Delete all data
              </button>
            ) : (
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(212,112,90,0.7)", marginBottom: "0.75rem" }}>
                  Type <strong style={{ color: "#d4705a" }}>DELETE</strong> to confirm:
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <input
                    className="kt-input"
                    type="text"
                    placeholder="DELETE"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    style={{ maxWidth: 200, borderColor: "rgba(212,112,90,0.3)" }}
                  />
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleteInput !== "DELETE" || deleteAll.isPending}
                    style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", letterSpacing: "0.08em", background: deleteInput === "DELETE" ? "rgba(212,112,90,0.15)" : "transparent", border: "1px solid rgba(212,112,90,0.3)", color: "#d4705a", padding: "0.7rem 1.4rem", cursor: deleteInput === "DELETE" ? "pointer" : "not-allowed", opacity: deleteInput === "DELETE" ? 1 : 0.5, transition: "all 0.2s" }}
                  >
                    {deleteAll.isPending ? "Deleting..." : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                    className="kt-btn kt-btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </Section>
    </div>
  );
}
