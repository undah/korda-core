// src/pages/tracker/TrackerPhotos.tsx
import React, { useState, useRef } from "react";
import { useTrackerPhotos, useUploadPhoto, useDeletePhoto } from "@/features/tracker/hooks/useTrackerJournal";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import type { TrackerPhoto } from "@/features/tracker/types";
import { toast } from "sonner";
import ConfirmDeleteModal from "@/components/tracker/ConfirmDeleteModal";

const today = () => new Date().toISOString().split("T")[0];
const ANGLES = ["front", "side", "back"] as const;
const isMobile = () => window.innerWidth <= 768;
type Tab = "timeline" | "compare";

function StatDiff({ label, from, to, unit = "", invert = false }: { label: string; from?: number | null; to?: number | null; unit?: string; invert?: boolean }) {
  if (!from || !to) return null;
  const diff = +(to - from).toFixed(1);
  const pct = Math.min(100, Math.abs(Math.round((diff / from) * 100)));
  const improved = invert ? diff < 0 : diff > 0;
  const color = diff === 0 ? "rgba(221,232,237,0.3)" : improved ? "#5ad4a0" : "#d4705a";
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.25rem" }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.3)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(221,232,237,0.4)" }}>{from}{unit} → {to}{unit}</span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", fontWeight: 500, color }}>{diff > 0 ? "+" : ""}{diff}{unit}</span>
        </div>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function TrackerPhotos() {
  const { data: photos = [], isLoading } = useTrackerPhotos();
  const { data: checkins = [] } = useTrackerCheckins(365);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mobile] = useState(isMobile);

  const [tab, setTab] = useState<Tab>("timeline");
  const [form, setForm] = useState({ log_date: today(), angle: "front" as "front" | "side" | "back", weight_at: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<TrackerPhoto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPhotoConflict, setShowPhotoConflict] = useState(false);
  const [compareAngle, setCompareAngle] = useState<"front" | "side" | "back">("front");
  const [dateA, setDateA] = useState("");
  const [dateB, setDateB] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const doUpload = async () => {
    if (!file) return;
    try {
      await uploadPhoto.mutateAsync({ file, angle: form.angle, log_date: form.log_date, weight_at: form.weight_at ? parseFloat(form.weight_at) : undefined });
      toast.success("Photo uploaded.");
      setFile(null); setPreview(null); setShowPhotoConflict(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch { toast.error("Upload failed."); }
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Select a photo first.");
    const existing = photos.find(p => p.log_date === form.log_date && p.angle === form.angle);
    if (existing) { setShowPhotoConflict(true); return; }
    await doUpload();
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deletePhoto.mutateAsync(confirmDeleteId);
      toast.success("Photo deleted.");
      setConfirmDeleteId(null);
      if (lightbox?.id === confirmDeleteId) setLightbox(null);
    } catch { toast.error("Failed to delete photo."); }
  };

  const byDate = photos.reduce<Record<string, TrackerPhoto[]>>((acc, p) => {
    acc[p.log_date] = acc[p.log_date] ?? [];
    acc[p.log_date].push(p);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const photoA = dateA ? byDate[dateA]?.find(p => p.angle === compareAngle) : null;
  const photoB = dateB ? byDate[dateB]?.find(p => p.angle === compareAngle) : null;
  const checkinA = dateA ? checkins.find(c => c.log_date === dateA) : null;
  const checkinB = dateB ? checkins.find(c => c.log_date === dateB) : null;

  const handleTabCompare = () => {
    if (dates.length >= 2 && !dateA && !dateB) {
      setDateA(dates[dates.length - 1]);
      setDateB(dates[0]);
    }
    setTab("compare");
  };

  return (
    <div>
      {/* PHOTO CONFLICT */}
      {showPhotoConflict && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,9,11,0.88)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: "1rem" }}>
          <div style={{ background: "#0c1217", border: "1px solid rgba(90,180,212,0.15)", borderTop: "1px solid rgba(90,180,212,0.5)", padding: "2rem", maxWidth: 420, width: "100%" }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(90,180,212,0.5)", marginBottom: "1rem" }}>// conflict detected</p>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", fontWeight: 400, color: "#dde8ed", marginBottom: "0.75rem" }}>Photo already exists</h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(221,232,237,0.45)", lineHeight: 1.75, marginBottom: "2rem" }}>
              You already have a <strong style={{ color: "#dde8ed", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", textTransform: "capitalize" }}>{form.angle}</strong> photo for{" "}
              <strong style={{ color: "#dde8ed", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem" }}>{form.log_date}</strong>. Replace it with your new photo, or cancel?
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="kt-btn kt-btn-blue" onClick={doUpload} disabled={uploadPhoto.isPending} style={{ flex: 1 }}>{uploadPhoto.isPending ? "Uploading..." : "Replace →"}</button>
              <button className="kt-btn kt-btn-outline" onClick={() => setShowPhotoConflict(false)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal open={!!confirmDeleteId} label="this photo" onConfirm={handleDelete} onCancel={() => setConfirmDeleteId(null)} loading={deletePhoto.isPending} />

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,9,11,0.95)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}>
            <img src={lightbox.url} alt={lightbox.angle} style={{ maxWidth: "85vw", maxHeight: "75vh", objectFit: "contain", display: "block" }} />
            <div style={{ marginTop: "1rem", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "rgba(221,232,237,0.4)", textTransform: "capitalize" }}>
                {lightbox.angle} · {lightbox.log_date}{lightbox.weight_at ? ` · ${lightbox.weight_at} kg` : ""}
              </span>
              <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(lightbox.id); }}
                style={{ background: "none", border: "1px solid rgba(212,112,90,0.3)", color: "rgba(212,112,90,0.6)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.3rem 0.8rem" }}>
                delete
              </button>
            </div>
            <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: -36, right: 0, background: "none", border: "none", color: "rgba(221,232,237,0.4)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", cursor: "pointer" }}>
              close ×
            </button>
          </div>
        </div>
      )}

      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Photos</p>
        <h1 className="kt-page-title">Progress <em>timeline</em></h1>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 2, marginBottom: "2rem" }}>
        {([["timeline", "Timeline"], ["compare", "Compare"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => t === "compare" ? handleTabCompare() : setTab(t)}
            style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", padding: "0.6rem 1.2rem", cursor: "pointer", border: "none", background: tab === t ? "#0c1217" : "transparent", color: tab === t ? "#5ab4d4" : "rgba(221,232,237,0.3)", borderBottom: tab === t ? "1px solid rgba(90,180,212,0.5)" : "1px solid rgba(90,180,212,0.08)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: "1px solid rgba(90,180,212,0.08)" }} />
      </div>

      {/* ── TIMELINE TAB ── */}
      {tab === "timeline" && (
        <>
          <div className="kt-card" style={{ marginBottom: "2rem" }}>
            <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>Upload photo</p>

            {/* date + weight — always stacked on mobile */}
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label className="kt-label">Date</label>
                <input className="kt-input" type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
              </div>
              <div>
                <label className="kt-label">Weight at time (kg)</label>
                <input className="kt-input" type="number" step="0.1" placeholder="optional" value={form.weight_at} onChange={e => setForm(f => ({ ...f, weight_at: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label className="kt-label">Angle</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {ANGLES.map(a => (
                  <button key={a} onClick={() => setForm(f => ({ ...f, angle: a }))}
                    style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "capitalize", padding: "0.5rem 0.9rem", cursor: "pointer", border: "1px solid", background: form.angle === a ? "rgba(90,180,212,0.1)" : "transparent", borderColor: form.angle === a ? "rgba(90,180,212,0.5)" : "rgba(221,232,237,0.1)", color: form.angle === a ? "#5ab4d4" : "rgba(221,232,237,0.3)", transition: "all 0.15s", flex: mobile ? 1 : "none" }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border: "1px dashed rgba(90,180,212,0.2)", padding: mobile ? "1.5rem" : "2.5rem", textAlign: "center", cursor: "pointer", marginBottom: "1.5rem", transition: "border-color 0.2s", background: preview ? "transparent" : "rgba(90,180,212,0.02)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(90,180,212,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(90,180,212,0.2)")}>
              {preview ? (
                <img src={preview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
              ) : (
                <>
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.75rem", color: "rgba(90,180,212,0.5)", marginBottom: "0.4rem" }}>tap to select photo</p>
                  <p style={{ fontSize: "0.72rem", color: "rgba(221,232,237,0.2)" }}>JPG, PNG, WEBP</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            <button className="kt-btn kt-btn-blue" onClick={handleUpload} disabled={!file || uploadPhoto.isPending} style={{ width: "100%" }}>
              {uploadPhoto.isPending ? "Uploading..." : "Upload photo →"}
            </button>
          </div>

          {isLoading ? (
            <p style={{ color: "rgba(221,232,237,0.2)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem" }}>Loading...</p>
          ) : dates.length === 0 ? (
            <p style={{ color: "rgba(221,232,237,0.3)", fontSize: "0.85rem" }}>No photos yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {dates.map(date => (
                <div key={date}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "rgba(221,232,237,0.4)" }}>{date}</span>
                    {byDate[date][0]?.weight_at && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "#5ab4d4" }}>{byDate[date][0].weight_at} kg</span>}
                    <div style={{ flex: 1, height: 1, background: "rgba(90,180,212,0.06)" }} />
                  </div>
                  {/* 3 col on desktop, scrollable row on mobile */}
                  <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(3, calc(33vw - 24px))" : "repeat(3,1fr)", gap: "0.5rem", overflowX: mobile ? "auto" : "visible" }}>
                    {ANGLES.map(angle => {
                      const photo = byDate[date].find(p => p.angle === angle);
                      return (
                        <div key={angle} style={{ position: "relative", aspectRatio: "3/4", background: "#0c1217", border: "1px solid rgba(90,180,212,0.08)", overflow: "hidden", flexShrink: 0 }}>
                          {photo ? (
                            <>
                              <img src={photo.url} alt={angle} onClick={() => setLightbox(photo)}
                                style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" }} />
                              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.4rem 0.5rem", background: "linear-gradient(transparent,rgba(7,9,11,0.85))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "capitalize", color: "rgba(221,232,237,0.5)" }}>{angle}</span>
                                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                                  style={{ background: "none", border: "none", color: "rgba(212,112,90,0.6)", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1, padding: "2px" }}>×</button>
                              </div>
                            </>
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.3rem" }}>
                              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", textTransform: "capitalize", color: "rgba(221,232,237,0.12)" }}>{angle}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── COMPARE TAB ── */}
      {tab === "compare" && (
        <div>
          {dates.length < 2 ? (
            <div className="kt-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "0.75rem" }}>Not enough photos.</p>
              <p style={{ color: "rgba(221,232,237,0.4)", fontSize: "0.88rem" }}>Need photos from at least 2 different dates.</p>
            </div>
          ) : (
            <>
              <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
                <p className="kt-card-label" style={{ marginBottom: "1.25rem" }}>Comparison settings</p>
                <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="kt-label">Before</label>
                    <select className="kt-input" value={dateA} onChange={e => setDateA(e.target.value)}>
                      <option value="">Select</option>
                      {dates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="kt-label">After</label>
                    <select className="kt-input" value={dateB} onChange={e => setDateB(e.target.value)}>
                      <option value="">Select</option>
                      {dates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: mobile ? "1 / -1" : "auto" }}>
                    <label className="kt-label">Angle</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {ANGLES.map(a => (
                        <button key={a} onClick={() => setCompareAngle(a)}
                          style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", textTransform: "capitalize", padding: "0.45rem 0.75rem", cursor: "pointer", border: "1px solid", background: compareAngle === a ? "rgba(90,180,212,0.1)" : "transparent", borderColor: compareAngle === a ? "rgba(90,180,212,0.5)" : "rgba(221,232,237,0.1)", color: compareAngle === a ? "#5ab4d4" : "rgba(221,232,237,0.3)", transition: "all 0.15s", flex: 1 }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {dateA && dateB ? (
                <>
                  {/* side by side — stacked on mobile */}
                  <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 2, marginBottom: 2 }}>
                    {[{ date: dateA, photo: photoA, label: "Before", checkin: checkinA }, { date: dateB, photo: photoB, label: "After", checkin: checkinB }].map(({ date, photo, label, checkin }) => (
                      <div key={date} style={{ background: "#0c1217", padding: "1.25rem", borderTop: `1px solid ${label === "Before" ? "rgba(221,232,237,0.1)" : "rgba(90,180,212,0.4)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: label === "Before" ? "rgba(221,232,237,0.3)" : "#5ab4d4" }}>// {label}</p>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "rgba(221,232,237,0.3)" }}>{date}</span>
                        </div>
                        {photo ? (
                          <div style={{ aspectRatio: "3/4", overflow: "hidden", marginBottom: "0.75rem", cursor: "pointer", maxHeight: mobile ? 280 : "none" }} onClick={() => setLightbox(photo)}>
                            <img src={photo.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </div>
                        ) : (
                          <div style={{ aspectRatio: "3/4", background: "#0a0e12", border: "1px dashed rgba(90,180,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem", maxHeight: mobile ? 280 : "none" }}>
                            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "rgba(221,232,237,0.15)" }}>no {compareAngle} photo</p>
                          </div>
                        )}
                        {checkin && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
                            {checkin.weight   && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "rgba(221,232,237,0.3)" }}>Weight</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: label === "After" ? "#5ab4d4" : "#dde8ed" }}>{checkin.weight} kg</span></div>}
                            {checkin.waist    && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "rgba(221,232,237,0.3)" }}>Waist</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.6)" }}>{checkin.waist}cm</span></div>}
                            {checkin.chest    && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "rgba(221,232,237,0.3)" }}>Chest</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.6)" }}>{checkin.chest}cm</span></div>}
                            {checkin.body_fat && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "rgba(221,232,237,0.3)" }}>BF</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "rgba(221,232,237,0.6)" }}>{checkin.body_fat}%</span></div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {(checkinA || checkinB) && (
                    <div className="kt-card">
                      <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>Progress breakdown</p>
                      <StatDiff label="Weight"   from={checkinA?.weight}   to={checkinB?.weight}   unit=" kg" invert />
                      <StatDiff label="Waist"    from={checkinA?.waist}    to={checkinB?.waist}    unit=" cm" invert />
                      <StatDiff label="Chest"    from={checkinA?.chest}    to={checkinB?.chest}    unit=" cm" />
                      <StatDiff label="Hips"     from={checkinA?.hips}     to={checkinB?.hips}     unit=" cm" invert />
                      <StatDiff label="Arms"     from={checkinA?.arms}     to={checkinB?.arms}     unit=" cm" />
                      <StatDiff label="Thighs"   from={checkinA?.thighs}   to={checkinB?.thighs}   unit=" cm" invert />
                      <StatDiff label="Body fat" from={checkinA?.body_fat} to={checkinB?.body_fat} unit="%" invert />

                      {checkinA?.weight && checkinB?.weight && (
                        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(90,180,212,0.07)", display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: "1rem" }}>
                          <div>
                            <p className="kt-card-label">Total change</p>
                            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.6rem", fontWeight: 400, color: checkinB.weight < checkinA.weight ? "#5ad4a0" : "#d4705a" }}>
                              {checkinB.weight < checkinA.weight ? "−" : "+"}{Math.abs(+(checkinB.weight - checkinA.weight).toFixed(1))} kg
                            </p>
                          </div>
                          <div>
                            <p className="kt-card-label">Time period</p>
                            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.95rem", color: "#dde8ed" }}>
                              {Math.round((new Date(dateB).getTime() - new Date(dateA).getTime()) / 86400000)} days
                            </p>
                          </div>
                          <div style={{ gridColumn: mobile ? "1 / -1" : "auto" }}>
                            <p className="kt-card-label">Avg per week</p>
                            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.95rem", color: "#dde8ed" }}>
                              {(Math.abs(checkinB.weight - checkinA.weight) / (Math.round((new Date(dateB).getTime() - new Date(dateA).getTime()) / 86400000) / 7)).toFixed(2)} kg
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="kt-card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                  <p style={{ color: "rgba(221,232,237,0.3)", fontSize: "0.88rem" }}>Select two dates above to compare.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
