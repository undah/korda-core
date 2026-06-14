// src/pages/tracker/TrackerSettings.tsx
import React, { useState, useEffect } from "react";
import { NOTIF_PREFS_KEY, NOTIF_LAST_KEY, type NotifPrefs } from "@/hooks/useNotificationCheck";
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

const ACTIVITY_LEVELS = [
  { value: "",      label: "Select to auto-calculate..." },
  { value: "1.2",   label: "Sedentary (desk job, little/no exercise)" },
  { value: "1.375", label: "Lightly active (1–3 days/week)" },
  { value: "1.55",  label: "Moderately active (3–5 days/week)" },
  { value: "1.725", label: "Very active (6–7 days/week)" },
  { value: "1.9",   label: "Extra active (athlete / physical job)" },
];

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

function calcTDEE(weight: number, heightCm: number, age: number, gender: string, activityFactor: number): number {
  const bmr = 10 * weight + 6.25 * heightCm - 5 * age + (gender === "female" ? -161 : 5);
  return Math.round(bmr * activityFactor);
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", color: C.accent, opacity: 0.55, marginBottom: "0.35rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: C.dim }}>//</span>{eyebrow}
        </p>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 400, color: C.text }}>{title}</h2>
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
    display_name: "", height_cm: "", age: "", gender: "", tdee: "2000", activity_level: "",
  });
  const [goalForm, setGoalForm] = useState({
    goal_weight: "", weekly_target: "0.5",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [notifForm, setNotifForm] = useState<NotifPrefs>(() => {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, time: "08:00" };
  });

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

  // Auto-compute TDEE whenever activity level or profile fields change
  useEffect(() => {
    const { activity_level, height_cm, age, gender } = profileForm;
    if (!activity_level || !height_cm || !age || !gender || checkins.length === 0) return;
    const latestWeight = [...checkins].sort((a, b) => b.log_date.localeCompare(a.log_date))[0].weight;
    const computed = calcTDEE(latestWeight, parseFloat(height_cm), parseInt(age), gender, parseFloat(activity_level));
    setProfileForm(f => ({ ...f, tdee: computed.toString() }));
  }, [profileForm.activity_level, profileForm.height_cm, profileForm.age, profileForm.gender, checkins]);

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

  const handleToggleNotif = async () => {
    const turning_on = !notifForm.enabled;
    if (turning_on) {
      if (typeof Notification === "undefined") {
        return toast.error("Notifications not supported in this browser.");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        return toast.error("Notification permission denied. Enable it in browser settings.");
      }
    }
    setNotifForm(f => ({ ...f, enabled: turning_on }));
  };

  const handleNotifSave = () => {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notifForm));
    localStorage.removeItem(NOTIF_LAST_KEY); // reset so it fires today if past the time
    toast.success(notifForm.enabled ? `Reminder set for ${notifForm.time} daily.` : "Reminder disabled.");
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
    <div style={{ color: C.dim, fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", paddingTop: "4rem", textAlign: "center" }}>
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
            <div style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: `1px solid ${C.border}` }}>
              <p className="kt-card-label">Signed in as</p>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", color: C.accent }}>{userEmail}</p>
            </div>
          )}

          <div className="kt-grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
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
              <label className="kt-label">TDEE (kcal)</label>
              <input className="kt-input" type="number" placeholder="2000" value={profileForm.tdee} onChange={setP("tdee")} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="kt-label">Activity level <span style={{ color: C.accent, opacity: 0.55, fontStyle: "normal" }}>— auto-fills TDEE</span></label>
              <select className="kt-input" value={profileForm.activity_level} onChange={setP("activity_level")}>
                {ACTIVITY_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* BMI display */}
          {bmi && (
            <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "var(--kt-accent-bg)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 10, display: "flex", alignItems: "center", gap: "1rem" }}>
              <div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", textTransform: "uppercase", color: C.dim, marginBottom: "0.2rem" }}>Current BMI</p>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.2rem", fontWeight: 500, color: C.accent }}>{bmi}</p>
              </div>
              <p style={{ fontSize: "0.75rem", color: C.muted }}>
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
          <div className="kt-grid-2" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="kt-label">Target weight (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="e.g. 75" value={goalForm.goal_weight} onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
            <div>
              <label className="kt-label">Weekly target (kg)</label>
              <input className="kt-input" type="number" step="0.1" placeholder="0.5" value={goalForm.weekly_target} onChange={e => setGoalForm(f => ({ ...f, weekly_target: e.target.value }))} />
            </div>
          </div>

          {goalForm.goal_weight && goalForm.weekly_target && checkins.length > 0 && (
            <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "var(--kt-accent-bg)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 10 }}>
              {(() => {
                const latest = [...checkins].sort((a,b) => b.log_date.localeCompare(a.log_date))[0];
                const remaining = latest.weight - parseFloat(goalForm.goal_weight);
                const days = remaining > 0 ? Math.round(remaining / parseFloat(goalForm.weekly_target) * 7) : 0;
                const eta = new Date();
                eta.setDate(eta.getDate() + days);
                return (
                  <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", textTransform: "uppercase", color: C.dim, marginBottom: "0.2rem" }}>Remaining</p>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: remaining > 0 ? C.text : C.green }}>{remaining > 0 ? `${remaining.toFixed(1)} kg` : "Goal reached! 🎯"}</p>
                    </div>
                    {remaining > 0 && (
                      <div>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", textTransform: "uppercase", color: C.dim, marginBottom: "0.2rem" }}>Estimated arrival</p>
                        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", color: C.accent }}>
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

      {/* ── NOTIFICATIONS ── */}
      <Section eyebrow="Notifications" title="Daily reminder">
        <div className="kt-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: notifForm.enabled ? "1.25rem" : 0 }}>
            <div>
              <p style={{ fontSize: "0.88rem", fontWeight: 500, color: C.text, marginBottom: "0.2rem" }}>Check-in reminder</p>
              <p style={{ fontSize: "0.75rem", color: C.muted, lineHeight: 1.5 }}>Get a daily notification to log your weight</p>
            </div>
            {/* Toggle */}
            <button
              onClick={handleToggleNotif}
              style={{ width: 46, height: 26, background: notifForm.enabled ? C.accent : "rgba(232,232,240,0.1)", border: "none", borderRadius: 13, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
              aria-label="Toggle reminder"
            >
              <span style={{ position: "absolute", top: 3, left: notifForm.enabled ? 23 : 3, width: 20, height: 20, background: notifForm.enabled ? C.card : "rgba(232,232,240,0.4)", borderRadius: "50%", transition: "left 0.2s", display: "block" }} />
            </button>
          </div>

          {notifForm.enabled && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label className="kt-label">Reminder time</label>
              <input
                className="kt-input"
                type="time"
                value={notifForm.time}
                onChange={e => setNotifForm(f => ({ ...f, time: e.target.value }))}
                style={{ maxWidth: 160 }}
              />
            </div>
          )}

          <button className="kt-btn kt-btn-blue" onClick={handleNotifSave} style={{ marginTop: notifForm.enabled ? 0 : "1.25rem" }}>
            Save reminder →
          </button>
        </div>
      </Section>

      {/* ── DATA MANAGEMENT ── */}
      <Section eyebrow="Data" title="Data management">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* export */}
          <div className="kt-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, color: C.text, marginBottom: "0.3rem" }}>Export data as CSV</p>
                <p style={{ fontSize: "0.78rem", color: C.muted, lineHeight: 1.6 }}>
                  Download all your check-ins and calorie logs as a CSV file.
                  {checkins.length > 0 && <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem" }}> {checkins.length} check-ins · {calories.length} calorie logs</span>}
                </p>
              </div>
              <button className="kt-btn kt-btn-outline" onClick={handleExport}>
                Export CSV →
              </button>
            </div>
          </div>

          {/* delete */}
          <div className="kt-card" style={{ borderTop: "1px solid rgba(239,68,68,0.3)" }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, color: C.red, marginBottom: "0.3rem" }}>Delete all data</p>
            <p style={{ fontSize: "0.78rem", color: C.muted, lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Permanently delete all your check-ins, journals, calorie logs, photos, and profile. This cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.72rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#EF4444", padding: "0.7rem 1.4rem", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
              >
                Delete all data
              </button>
            ) : (
              <div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.72rem", color: C.red, opacity: 0.8, marginBottom: "0.75rem" }}>
                  Type <strong style={{ color: C.red }}>DELETE</strong> to confirm:
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <input
                    className="kt-input"
                    type="text"
                    placeholder="DELETE"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    style={{ maxWidth: 200, borderColor: "rgba(239,68,68,0.3)" }}
                  />
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleteInput !== "DELETE" || deleteAll.isPending}
                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.72rem", background: deleteInput === "DELETE" ? "rgba(239,68,68,0.15)" : "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#EF4444", padding: "0.7rem 1.4rem", cursor: deleteInput === "DELETE" ? "pointer" : "not-allowed", opacity: deleteInput === "DELETE" ? 1 : 0.5, transition: "all 0.2s" }}
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
