// src/pages/tracker/TrackerPhotos.tsx
import React, { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useTrackerPhotos, useUploadPhoto, useDeletePhoto } from "@/features/tracker/hooks/useTrackerJournal";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import type { TrackerPhoto } from "@/features/tracker/types";
import { toast } from "sonner";
import ConfirmDeleteModal from "@/components/tracker/ConfirmDeleteModal";

const today = () => new Date().toISOString().split("T")[0];
const ANGLES = ["front", "side", "back", "face"] as const;
type Tab = "timeline" | "compare" | "flipbook";
type Angle = typeof ANGLES[number];

function StatDiff({ label, from, to, unit = "", invert = false }: { label: string; from?: number | null; to?: number | null; unit?: string; invert?: boolean }) {
  if (!from || !to) return null;
  const diff = +(to - from).toFixed(1);
  const pct = Math.min(100, Math.abs(Math.round((diff / from) * 100)));
  const improved = invert ? diff < 0 : diff > 0;
  const color = diff === 0 ? "var(--kt-dim)" : improved ? "#22C55E" : "#EF4444";
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.25rem" }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--kt-dim)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "var(--kt-muted)" }}>{from}{unit} → {to}{unit}</span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", fontWeight: 500, color }}>{diff > 0 ? "+" : ""}{diff}{unit}</span>
        </div>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 10, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function CompareSlider({ urlA, urlB }: { urlA: string; urlB: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) updatePos(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", cursor: "col-resize", userSelect: "none", touchAction: "none", maxHeight: "clamp(320px, 65vw, 540px)" }}
      onMouseDown={e => { dragging.current = true; updatePos(e.clientX); }}
      onTouchStart={e => updatePos(e.touches[0].clientX)}
      onTouchMove={e => { e.preventDefault(); updatePos(e.touches[0].clientX); }}
    >
      {/* After — full base layer */}
      <img src={urlB} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", display: "block" }} />
      {/* Before — clipped to left */}
      <img src={urlA} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`, pointerEvents: "none", display: "block" }} />
      {/* Divider line */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "rgba(0,200,255,0.9)", transform: "translateX(-50%)", pointerEvents: "none" }} />
      {/* Handle */}
      <div style={{ position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%, -50%)", width: 38, height: 38, borderRadius: "50%", background: "#15151E", border: "2px solid #00C8FF", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", boxShadow: "0 0 16px rgba(0,200,255,0.35)" }}>
        <span style={{ color: "#00C8FF", fontSize: "0.85rem" }}>⇔</span>
      </div>
      {/* Corner labels */}
      <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", letterSpacing: "0.15em", color: "rgba(232,232,240,0.7)", background: "rgba(21,21,30,0.65)", padding: "0.2rem 0.45rem", pointerEvents: "none" }}>BEFORE</div>
      <div style={{ position: "absolute", top: "0.6rem", right: "0.6rem", fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", letterSpacing: "0.15em", color: "#00C8FF", background: "rgba(21,21,30,0.65)", padding: "0.2rem 0.45rem", pointerEvents: "none" }}>AFTER</div>
    </div>
  );
}

export default function TrackerPhotos() {
  const { data: photos = [], isLoading } = useTrackerPhotos();
  const { data: checkins = [] } = useTrackerCheckins(365);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("timeline");
  const [form, setForm] = useState({ log_date: today(), angle: "front" as Angle, weight_at: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [lightbox, setLightbox] = useState<TrackerPhoto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPhotoConflict, setShowPhotoConflict] = useState(false);
  const [compareAngle, setCompareAngle] = useState<Angle>("front");
  const [dateA, setDateA] = useState("");
  const [dateB, setDateB] = useState("");
  const [compareSelections, setCompareSelections] = useState<string[]>([]);
  const [lightboxCompareDate, setLightboxCompareDate] = useState("");
  const [sliderMode, setSliderMode] = useState(false);
  const [flipAngle, setFlipAngle] = useState<Angle>("front");
  const [flipIdx, setFlipIdx] = useState(0);
  const [flipPlaying, setFlipPlaying] = useState(false);
  const flipTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setFileKey(k => k + 1);
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

  const toggleCompareSelection = (date: string) => {
    setCompareSelections(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      if (prev.length >= 2) return [prev[1], date];
      return [...prev, date];
    });
  };

  const goCompare = () => {
    const [a, b] = compareSelections;
    setDateA(a < b ? a : b);
    setDateB(a < b ? b : a);
    setTab("compare");
    setCompareSelections([]);
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

  const flipPhotos = photos
    .filter(p => p.angle === flipAngle)
    .sort((a, b) => a.log_date.localeCompare(b.log_date));
  const safeFlipIdx = Math.min(flipIdx, Math.max(0, flipPhotos.length - 1));

  useEffect(() => {
    if (flipTimer.current) clearInterval(flipTimer.current);
    if (!flipPlaying || flipPhotos.length === 0) return;
    flipTimer.current = setInterval(() => {
      setFlipIdx(i => (i >= flipPhotos.length - 1 ? 0 : i + 1));
    }, 1200);
    return () => { if (flipTimer.current) clearInterval(flipTimer.current); };
  }, [flipPlaying, flipPhotos.length]);

  return (
    <div>
      {/* PHOTO CONFLICT */}
      {showPhotoConflict && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(21,21,30,0.88)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: "1rem" }}>
          <div style={{ background: "var(--kt-surface)", border: "1px solid var(--kt-border)", borderRadius: 12, padding: "2rem", maxWidth: 420, width: "100%" }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--kt-accent)", marginBottom: "1rem" }}>// conflict detected</p>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", fontWeight: 400, color: "#E8E8F0", marginBottom: "0.75rem" }}>Photo already exists</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--kt-muted)", lineHeight: 1.75, marginBottom: "2rem" }}>
              You already have a <strong style={{ color: "#E8E8F0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", textTransform: "capitalize" }}>{form.angle}</strong> photo for{" "}
              <strong style={{ color: "#E8E8F0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem" }}>{form.log_date}</strong>. Replace it with your new photo, or cancel?
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
      {lightbox && (() => {
        const cPhoto = lightboxCompareDate
          ? (byDate[lightboxCompareDate]?.find(p => p.angle === lightbox.angle) ?? null)
          : null;
        const dual = !!lightboxCompareDate;
        const closeLightbox = () => { setLightbox(null); setLightboxCompareDate(""); };
        return (
          <div onClick={closeLightbox} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(21,21,30,0.96)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "1rem" }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", maxWidth: "95vw" }}>
              <button onClick={closeLightbox} style={{ position: "absolute", top: -36, right: 0, background: "none", border: "none", color: "var(--kt-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", cursor: "pointer" }}>
                close ×
              </button>

              {/* Photo(s) */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                {/* Primary */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                  <img src={lightbox.url} alt={lightbox.angle} style={{ maxHeight: "72vh", maxWidth: dual ? "44vw" : "85vw", objectFit: "contain", display: "block" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-dim)", textTransform: "capitalize" }}>
                    {lightbox.angle} · {lightbox.log_date}{lightbox.weight_at ? ` · ${lightbox.weight_at} kg` : ""}
                  </span>
                </div>
                {/* Compare */}
                {dual && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    {cPhoto ? (
                      <img src={cPhoto.url} alt={lightbox.angle} style={{ maxHeight: "72vh", maxWidth: "44vw", objectFit: "contain", display: "block" }} />
                    ) : (
                      <div style={{ width: "44vw", height: "50vh", background: "var(--kt-surface2)", border: "1px dashed var(--kt-border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.68rem", color: "var(--kt-dim)", textAlign: "center", lineHeight: 1.8 }}>
                          no {lightbox.angle}<br />photo for<br />{lightboxCompareDate}
                        </p>
                      </div>
                    )}
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "#00C8FF" }}>{lightboxCompareDate}{cPhoto?.weight_at ? ` · ${cPhoto.weight_at} kg` : ""}</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--kt-dim)" }}>COMPARE WITH</span>
                  <select
                    value={lightboxCompareDate}
                    onChange={e => setLightboxCompareDate(e.target.value)}
                    style={{ background: "var(--kt-surface2)", border: "1px solid var(--kt-border)", borderRadius: 8, color: "var(--kt-text)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.68rem", padding: "0.3rem 0.5rem", cursor: "pointer" }}>
                    <option value="">— select date —</option>
                    {dates.filter(d => d !== lightbox.log_date).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {dual && (
                    <button onClick={() => setLightboxCompareDate("")} style={{ background: "none", border: "none", color: "var(--kt-dim)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1 }}>×</button>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(lightbox.id); }}
                  style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "rgba(239,68,68,0.6)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: "0.65rem", padding: "0.3rem 0.8rem" }}>
                  delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="kt-page-header">
        <p className="kt-page-eyebrow">Photos</p>
        <h1 className="kt-page-title">Progress <em>timeline</em></h1>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 2, marginBottom: "2rem" }}>
        {([["timeline", "Timeline"], ["compare", "Compare"], ["flipbook", "Flipbook"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => t === "compare" ? handleTabCompare() : setTab(t)}
            style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", padding: "0.6rem 1.2rem", cursor: "pointer", border: "none", background: tab === t ? "var(--kt-surface2)" : "transparent", color: tab === t ? "var(--kt-accent)" : "var(--kt-dim)", borderBottom: tab === t ? "1px solid var(--kt-accent)" : "1px solid var(--kt-border)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: "1px solid var(--kt-border)" }} />
      </div>

      {/* ── TIMELINE TAB ── */}
      {tab === "timeline" && (
        <>
          <div className="kt-card" style={{ marginBottom: "2rem" }}>
            <p className="kt-card-label" style={{ marginBottom: "1.5rem" }}>Upload photo</p>

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
                <label className="kt-label">Weight at time (kg)</label>
                <input className="kt-input" type="number" step="0.1" placeholder="optional" value={form.weight_at} onChange={e => setForm(f => ({ ...f, weight_at: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label className="kt-label">Angle</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {ANGLES.map(a => (
                  <button key={a} onClick={() => {
                    setForm(f => ({ ...f, angle: a }));
                    if (a !== form.angle) {
                      setFile(null);
                      if (preview) URL.revokeObjectURL(preview);
                      setPreview(null);
                      setFileKey(k => k + 1);
                    }
                  }}
                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", textTransform: "capitalize", padding: "0.5rem 0.9rem", cursor: "pointer", border: "1px solid", background: form.angle === a ? "var(--kt-accent-bg)" : "transparent", borderColor: form.angle === a ? "var(--kt-accent)" : "var(--kt-border)", color: form.angle === a ? "var(--kt-accent)" : "var(--kt-dim)", transition: "all 0.15s", flex: 1, borderRadius: 8 }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border: "1px dashed rgba(0,200,255,0.2)", borderRadius: 10, padding: "1.75rem 1rem", textAlign: "center", cursor: "pointer", marginBottom: "1.5rem", transition: "border-color 0.2s", background: preview ? "transparent" : "rgba(0,200,255,0.02)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,200,255,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,200,255,0.2)")}>
              {preview ? (
                <img src={preview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
              ) : (
                <>
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.75rem", color: "var(--kt-accent)", opacity: 0.7, marginBottom: "0.4rem" }}>tap to select photo</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--kt-dim)" }}>JPG, PNG, WEBP</p>
                </>
              )}
            </div>
            <input key={fileKey} ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            <button className="kt-btn kt-btn-blue" onClick={handleUpload} disabled={!file || uploadPhoto.isPending} style={{ width: "100%" }}>
              {uploadPhoto.isPending ? "Uploading..." : "Upload photo →"}
            </button>
          </div>

          {isLoading ? (
            <p style={{ color: "var(--kt-dim)", fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem" }}>Loading...</p>
          ) : dates.length === 0 ? (
            <p style={{ color: "var(--kt-dim)", fontSize: "0.85rem" }}>No photos yet.</p>
          ) : (
            <>
              {dates.length >= 2 && (
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.62rem", letterSpacing: "0.12em", color: "var(--kt-dim)", marginBottom: "1rem" }}>
                  // tap the circle next to a date to select it for comparison
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {dates.map(date => {
                  const selected = compareSelections.includes(date);
                  return (
                    <div key={date} style={{ borderLeft: selected ? "2px solid rgba(0,200,255,0.5)" : "2px solid transparent", paddingLeft: selected ? "0.75rem" : "0", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        {/* Selection circle */}
                        <button
                          onClick={() => toggleCompareSelection(date)}
                          title={selected ? "Deselect" : "Select for compare"}
                          style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${selected ? "#00C8FF" : "rgba(0,200,255,0.25)"}`, background: selected ? "rgba(0,200,255,0.18)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "all 0.15s" }}>
                          {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C8FF" }} />}
                        </button>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: selected ? "#00C8FF" : "var(--kt-muted)" }}>{date}</span>
                        {byDate[date][0]?.weight_at && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "#00C8FF" }}>{byDate[date][0].weight_at} kg</span>}
                        <div style={{ flex: 1, height: 1, background: "var(--kt-border)" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.5rem" }}>
                        {ANGLES.map(angle => {
                          const photo = byDate[date].find(p => p.angle === angle);
                          return (
                            <div key={angle} style={{ position: "relative", aspectRatio: "3/4", background: "var(--kt-surface2)", border: "1px solid var(--kt-border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                              {photo ? (
                                <>
                                  <img src={photo.url} alt={angle} onClick={() => setLightbox(photo)}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" }} />
                                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.4rem 0.5rem", background: "linear-gradient(transparent,rgba(21,21,30,0.85))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "capitalize", color: "var(--kt-muted)" }}>{angle}</span>
                                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                                      style={{ background: "none", border: "none", color: "rgba(239,68,68,0.6)", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1, padding: "2px" }}>×</button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.3rem" }}>
                                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.58rem", textTransform: "capitalize", color: "var(--kt-dim)", opacity: 0.5 }}>{angle}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Floating compare bar */}
          {compareSelections.length > 0 && (
            <div style={{ position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", background: "var(--kt-surface2)", border: "1px solid var(--kt-accent)", borderRadius: 10, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", zIndex: 100, boxShadow: "0 4px 32px rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}>
              {compareSelections.length === 1 ? (
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "var(--kt-muted)" }}>
                  <span style={{ color: "#00C8FF" }}>{compareSelections[0]}</span> — select one more date
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "var(--kt-muted)" }}>
                    {compareSelections[0]} <span style={{ color: "#00C8FF" }}>vs</span> {compareSelections[1]}
                  </span>
                  <button className="kt-btn kt-btn-blue" style={{ padding: "0.4rem 1rem", fontSize: "0.7rem" }} onClick={goCompare}>
                    Compare →
                  </button>
                </>
              )}
              <button onClick={() => setCompareSelections([])} style={{ background: "none", border: "none", color: "var(--kt-dim)", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: "2px 4px" }}>×</button>
            </div>
          )}
        </>
      )}

      {/* ── FLIPBOOK TAB ── */}
      {tab === "flipbook" && (
        <div>
          {/* Angle selector */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {ANGLES.map(a => (
              <button key={a} onClick={() => { setFlipAngle(a); setFlipIdx(0); setFlipPlaying(false); }}
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", textTransform: "capitalize", padding: "0.5rem 1rem", cursor: "pointer", border: "1px solid", background: flipAngle === a ? "var(--kt-accent-bg)" : "transparent", borderColor: flipAngle === a ? "var(--kt-accent)" : "var(--kt-border)", color: flipAngle === a ? "var(--kt-accent)" : "var(--kt-dim)", flex: 1, transition: "all 0.15s", borderRadius: 8 }}>
                {a}
              </button>
            ))}
          </div>

          {flipPhotos.length === 0 ? (
            <div className="kt-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "0.75rem" }}>No {flipAngle} photos yet.</p>
              <p style={{ color: "var(--kt-muted)", fontSize: "0.88rem" }}>Upload {flipAngle} photos to use the flipbook.</p>
            </div>
          ) : (
            <>
              {/* Current photo */}
              <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
                <img
                  src={flipPhotos[safeFlipIdx].url}
                  alt={flipAngle}
                  style={{ maxHeight: "55vh", maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }}
                />
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem", color: "var(--kt-muted)", marginTop: "0.75rem" }}>
                  {format(parseISO(flipPhotos[safeFlipIdx].log_date), "d MMM yyyy")}
                  {flipPhotos[safeFlipIdx].weight_at ? ` · ${flipPhotos[safeFlipIdx].weight_at} kg` : ""}
                </p>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", color: "var(--kt-dim)", marginTop: "0.2rem" }}>
                  {safeFlipIdx + 1} / {flipPhotos.length}
                </p>
              </div>

              {/* Scrubber */}
              <input type="range" min={0} max={flipPhotos.length - 1} value={safeFlipIdx}
                onChange={e => { setFlipPlaying(false); setFlipIdx(+e.target.value); }}
                style={{ width: "100%", accentColor: "#00C8FF", marginBottom: "1.25rem", cursor: "pointer" }}
              />

              {/* Controls */}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <button onClick={() => { setFlipPlaying(false); setFlipIdx(0); }} disabled={safeFlipIdx === 0}
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", padding: "0.5rem 0.85rem", border: "1px solid var(--kt-border)", borderRadius: 8, background: "transparent", color: "var(--kt-muted)", cursor: safeFlipIdx === 0 ? "not-allowed" : "pointer", opacity: safeFlipIdx === 0 ? 0.4 : 1 }}>⏮</button>
                <button onClick={() => { setFlipPlaying(false); setFlipIdx(i => Math.max(0, i - 1)); }} disabled={safeFlipIdx === 0}
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", padding: "0.5rem 1rem", border: "1px solid var(--kt-border)", borderRadius: 8, background: "transparent", color: "var(--kt-muted)", cursor: safeFlipIdx === 0 ? "not-allowed" : "pointer", opacity: safeFlipIdx === 0 ? 0.4 : 1 }}>‹ Prev</button>
                <button onClick={() => setFlipPlaying(p => !p)}
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", padding: "0.5rem 1.5rem", border: "1px solid rgba(0,200,255,0.35)", borderRadius: 8, background: flipPlaying ? "rgba(0,200,255,0.1)" : "transparent", color: "#00C8FF", cursor: "pointer" }}>
                  {flipPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <button onClick={() => { setFlipPlaying(false); setFlipIdx(i => Math.min(flipPhotos.length - 1, i + 1)); }} disabled={safeFlipIdx === flipPhotos.length - 1}
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", padding: "0.5rem 1rem", border: "1px solid var(--kt-border)", borderRadius: 8, background: "transparent", color: "var(--kt-muted)", cursor: safeFlipIdx === flipPhotos.length - 1 ? "not-allowed" : "pointer", opacity: safeFlipIdx === flipPhotos.length - 1 ? 0.4 : 1 }}>Next ›</button>
                <button onClick={() => { setFlipPlaying(false); setFlipIdx(flipPhotos.length - 1); }} disabled={safeFlipIdx === flipPhotos.length - 1}
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", padding: "0.5rem 0.85rem", border: "1px solid var(--kt-border)", borderRadius: 8, background: "transparent", color: "var(--kt-muted)", cursor: safeFlipIdx === flipPhotos.length - 1 ? "not-allowed" : "pointer", opacity: safeFlipIdx === flipPhotos.length - 1 ? 0.4 : 1 }}>⏭</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── COMPARE TAB ── */}
      {tab === "compare" && (
        <div>
          {dates.length < 2 ? (
            <div className="kt-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "0.75rem" }}>Not enough photos.</p>
              <p style={{ color: "var(--kt-muted)", fontSize: "0.88rem" }}>Need photos from at least 2 different dates.</p>
            </div>
          ) : (
            <>
              <div className="kt-card" style={{ marginBottom: "1.5rem" }}>
                <p className="kt-card-label" style={{ marginBottom: "1.25rem" }}>Comparison settings</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
                  <div>
                    <label className="kt-label">Before</label>
                    <select className="kt-input" value={dateA} onChange={e => { setDateA(e.target.value); if (dateB && e.target.value >= dateB) setDateB(""); }}>
                      <option value="">Select</option>
                      {dates.filter(d => !dateB || d < dateB).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="kt-label">After</label>
                    <select className="kt-input" value={dateB} onChange={e => { setDateB(e.target.value); if (dateA && e.target.value <= dateA) setDateA(""); }}>
                      <option value="">Select</option>
                      {dates.filter(d => !dateA || d > dateA).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="kt-label">Angle</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {ANGLES.map(a => (
                        <button key={a} onClick={() => setCompareAngle(a)}
                          style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.68rem", textTransform: "capitalize", padding: "0.45rem 0.75rem", cursor: "pointer", border: "1px solid", background: compareAngle === a ? "var(--kt-accent-bg)" : "transparent", borderColor: compareAngle === a ? "var(--kt-accent)" : "var(--kt-border)", color: compareAngle === a ? "var(--kt-accent)" : "var(--kt-dim)", transition: "all 0.15s", flex: 1, borderRadius: 8 }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {dateA && dateB ? (
                <>
                  {/* View mode toggle */}
                  <div style={{ display: "flex", gap: 2, marginBottom: "1.5rem" }}>
                    {([["side", "Side by side"], ["slider", "Slider"]] as const).map(([mode, label]) => {
                      const active = mode === "slider" ? sliderMode : !sliderMode;
                      return (
                        <button key={mode} onClick={() => setSliderMode(mode === "slider")}
                          style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.45rem 1rem", cursor: "pointer", border: "none", background: active ? "var(--kt-surface2)" : "transparent", color: active ? "var(--kt-accent)" : "var(--kt-dim)", borderBottom: active ? "1px solid var(--kt-accent)" : "1px solid var(--kt-border)", transition: "all 0.15s" }}>
                          {label}
                        </button>
                      );
                    })}
                    <div style={{ flex: 1, borderBottom: "1px solid var(--kt-border)" }} />
                  </div>

                  {sliderMode ? (
                    /* Drag slider */
                    <div style={{ maxWidth: 480, margin: "0 auto 1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-dim)" }}>{dateA}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-accent)" }}>{dateB}</span>
                      </div>
                      {photoA && photoB ? (
                        <CompareSlider urlA={photoA.url} urlB={photoB.url} />
                      ) : (
                        <div style={{ aspectRatio: "3/4", maxHeight: "clamp(320px, 65vw, 540px)", background: "var(--kt-surface2)", border: "1px dashed var(--kt-border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem" }}>
                          {!photoA && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "var(--kt-dim)" }}>no {compareAngle} photo for {dateA}</p>}
                          {!photoB && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "var(--kt-dim)" }}>no {compareAngle} photo for {dateB}</p>}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Side by side */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
                      {([{ date: dateA, photo: photoA, label: "Before", checkin: checkinA }, { date: dateB, photo: photoB, label: "After", checkin: checkinB }] as const).map(({ date, photo, label, checkin }) => (
                        <div key={label} style={{ background: "var(--kt-surface2)", padding: "1.25rem", borderRadius: 12, borderTop: label === "Before" ? "1px solid var(--kt-border)" : "2px solid var(--kt-accent)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: label === "Before" ? "var(--kt-dim)" : "var(--kt-accent)" }}>// {label}</p>
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", color: "var(--kt-dim)" }}>{date}</span>
                          </div>
                          {photo ? (
                            <div style={{ aspectRatio: "3/4", overflow: "hidden", marginBottom: "0.75rem", cursor: "pointer", maxHeight: "clamp(240px, 45vw, 400px)" }} onClick={() => setLightbox(photo)}>
                              <img src={photo.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            </div>
                          ) : (
                            <div style={{ aspectRatio: "3/4", background: "var(--kt-surface2)", border: "1px dashed var(--kt-border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem", maxHeight: "clamp(240px, 45vw, 400px)" }}>
                              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", color: "var(--kt-dim)" }}>no {compareAngle} photo</p>
                            </div>
                          )}
                          {checkin && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
                              {checkin.weight   && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "var(--kt-dim)" }}>Weight</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: label === "After" ? "var(--kt-accent)" : "var(--kt-text)" }}>{checkin.weight} kg</span></div>}
                              {checkin.waist    && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "var(--kt-dim)" }}>Waist</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--kt-muted)" }}>{checkin.waist}cm</span></div>}
                              {checkin.chest    && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "var(--kt-dim)" }}>Chest</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--kt-muted)" }}>{checkin.chest}cm</span></div>}
                              {checkin.body_fat && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.2rem 0" }}><span style={{ color: "var(--kt-dim)" }}>BF</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--kt-muted)" }}>{checkin.body_fat}%</span></div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats breakdown */}
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
                        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
                          <div>
                            <p className="kt-card-label">Total change</p>
                            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.6rem", fontWeight: 400, color: checkinB.weight < checkinA.weight ? "#22C55E" : "#EF4444" }}>
                              {checkinB.weight < checkinA.weight ? "−" : "+"}{Math.abs(+(checkinB.weight - checkinA.weight).toFixed(1))} kg
                            </p>
                          </div>
                          <div>
                            <p className="kt-card-label">Time period</p>
                            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.95rem", color: "#E8E8F0" }}>
                              {Math.round((new Date(dateB).getTime() - new Date(dateA).getTime()) / 86400000)} days
                            </p>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <p className="kt-card-label">Avg per week</p>
                            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.95rem", color: "#E8E8F0" }}>
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
                  <p style={{ color: "var(--kt-dim)", fontSize: "0.88rem" }}>Select two dates above to compare.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
