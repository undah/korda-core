// src/features/tracker/components/PhotoFramingGuide.tsx
//
// Ghosts your previous photo of the same angle over the one you just picked, so
// framing drift is visible *before* upload rather than months later in an export.
//
// The browser can't overlay during camera capture, so this is a check-and-retake
// step: pick a photo, see the misalignment, shoot again if it's off.
import { useState } from "react";
import { Layers, Eye, EyeOff } from "lucide-react";

export default function PhotoFramingGuide({
  previewUrl,
  ghostUrl,
  ghostDate,
  angle,
}: {
  previewUrl: string | null;
  ghostUrl?: string;
  ghostDate?: string;
  angle: string;
}) {
  const [ghostOn, setGhostOn] = useState(true);
  const [opacity, setOpacity] = useState(0.45);

  // Nothing picked yet — show what they're matching, if anything.
  if (!previewUrl) {
    if (!ghostUrl) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.7rem 0.85rem", marginBottom: "1rem", background: "var(--kt-accent-bg)", border: "1px solid var(--kt-border)", borderRadius: "var(--kt-r-sm)" }}>
        <img src={ghostUrl} alt="" style={{ width: 38, height: 50, objectFit: "cover", borderRadius: 4, flexShrink: 0, opacity: 0.75 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", color: "var(--kt-muted)", margin: 0, lineHeight: 1.5 }}>
            Match your last <strong style={{ color: "var(--kt-text)" }}>{angle}</strong> shot
          </p>
          <p className="kt-meta" style={{ marginTop: "0.15rem" }}>
            {ghostDate} · same distance, same light
          </p>
        </div>
      </div>
    );
  }

  // Picked, but no earlier shot at this angle to compare against.
  if (!ghostUrl) {
    return (
      <img src={previewUrl} alt="preview" style={{ maxHeight: 240, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto", borderRadius: "var(--kt-r-sm)" }} />
    );
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ cursor: "default" }}>
      {/* Both images use the same box + object-fit, so overlap is meaningful. */}
      <div style={{ position: "relative", width: "100%", maxWidth: 260, aspectRatio: "3/4", margin: "0 auto", borderRadius: "var(--kt-r-sm)", overflow: "hidden", background: "var(--kt-surface2)" }}>
        <img src={previewUrl} alt="new photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        {ghostOn && (
          <img
            src={ghostUrl}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity, mixBlendMode: "difference", pointerEvents: "none" }}
          />
        )}
        {/* Centre line — the cheapest alignment cue there is. */}
        {ghostOn && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--kt-accent)", opacity: 0.35, pointerEvents: "none" }} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setGhostOn(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: ghostOn ? "var(--kt-accent-bg)" : "transparent", border: `1px solid ${ghostOn ? "var(--kt-accent)" : "var(--kt-border)"}`, borderRadius: "var(--kt-r-sm)", color: ghostOn ? "var(--kt-accent)" : "var(--kt-dim)", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", padding: "0.35rem 0.7rem", cursor: "pointer" }}
        >
          {ghostOn ? <Eye size={13} /> : <EyeOff size={13} />}
          Overlay
        </button>

        {ghostOn && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 130px", maxWidth: 190 }}>
            <Layers size={13} style={{ color: "var(--kt-dim)", flexShrink: 0 }} />
            <input
              type="range" min={0.15} max={0.85} step={0.05} value={opacity}
              onChange={e => setOpacity(+e.target.value)}
              style={{ width: "100%", accentColor: "var(--kt-accent)", cursor: "pointer" }}
            />
          </label>
        )}
      </div>

      <p className="kt-meta" style={{ textAlign: "center", marginTop: "0.6rem", lineHeight: 1.6 }}>
        {ghostOn
          ? `edges cancel to black where you match ${ghostDate}`
          : "overlay off · showing your new photo"}
      </p>
    </div>
  );
}
