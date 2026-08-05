// src/features/tracker/components/PhotoFramingGuide.tsx
//
// Post-pick verification. Once a photo exists its framing is fixed, so the only
// job here is: did it line up, and is it worth retaking? A wipe answers that
// far better than a blend — you drag the seam across and watch whether the body
// edges continue across it or jump.
//
// Framing is actually *corrected* in PhotoCaptureGuide, against the live feed.
import { useRef, useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function PhotoFramingGuide({
  previewUrl,
  ghostUrl,
  ghostDate,
  angle,
  onRetake,
}: {
  previewUrl: string | null;
  ghostUrl?: string;
  ghostDate?: string;
  angle: string;
  onRetake?: () => void;
}) {
  // Nothing picked yet — show what this angle is being matched against.
  if (!previewUrl) {
    if (!ghostUrl) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.7rem 0.85rem", marginBottom: "1rem", background: "var(--kt-accent-bg)", border: "1px solid var(--kt-border)", borderRadius: "var(--kt-r-sm)" }}>
        <img src={ghostUrl} alt="" style={{ width: 38, height: 50, objectFit: "cover", borderRadius: 4, flexShrink: 0, opacity: 0.75 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", color: "var(--kt-muted)", margin: 0, lineHeight: 1.5 }}>
            Your last <strong style={{ color: "var(--kt-text)" }}>{angle}</strong> shot
          </p>
          <p className="kt-meta" style={{ marginTop: "0.15rem" }}>{ghostDate}</p>
        </div>
      </div>
    );
  }

  if (!ghostUrl) {
    return (
      <img src={previewUrl} alt="preview" style={{ maxHeight: 240, maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto", borderRadius: "var(--kt-r-sm)" }} />
    );
  }

  return <Wipe previewUrl={previewUrl} ghostUrl={ghostUrl} ghostDate={ghostDate} onRetake={onRetake} />;
}

function Wipe({
  previewUrl, ghostUrl, ghostDate, onRetake,
}: { previewUrl: string; ghostUrl: string; ghostDate?: string; onRetake?: () => void }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) move(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div onClick={e => e.stopPropagation()} style={{ cursor: "default" }}>
      <div
        ref={boxRef}
        onMouseDown={e => { dragging.current = true; move(e.clientX); }}
        onTouchStart={e => move(e.touches[0].clientX)}
        onTouchMove={e => { e.preventDefault(); move(e.touches[0].clientX); }}
        style={{ position: "relative", width: "100%", maxWidth: 260, aspectRatio: "3/4", margin: "0 auto", borderRadius: "var(--kt-r-sm)", overflow: "hidden", background: "var(--kt-surface2)", cursor: "col-resize", userSelect: "none", touchAction: "none" }}
      >
        {/* new photo underneath */}
        <img src={previewUrl} alt="new photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
        {/* previous shot, clipped to the left of the seam */}
        <img src={ghostUrl} alt="" aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`, pointerEvents: "none" }} />
        {/* seam */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "var(--kt-accent)", transform: "translateX(-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--kt-accent)", background: "rgba(7,9,11,0.55)", pointerEvents: "none" }} />
        {/* corner labels */}
        <span style={{ position: "absolute", top: 6, left: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: "var(--kt-fs-3xs)", color: "rgba(255,255,255,0.85)", background: "rgba(7,9,11,0.6)", padding: "2px 5px", borderRadius: 4, pointerEvents: "none" }}>{ghostDate}</span>
        <span style={{ position: "absolute", top: 6, right: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: "var(--kt-fs-3xs)", color: "var(--kt-accent)", background: "rgba(7,9,11,0.6)", padding: "2px 5px", borderRadius: 4, pointerEvents: "none" }}>new</span>
      </div>

      <p className="kt-meta" style={{ textAlign: "center", marginTop: "0.7rem", lineHeight: 1.6 }}>
        drag the seam — if your outline jumps across it, the framing drifted
      </p>

      {onRetake && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.6rem" }}>
          <button type="button" onClick={onRetake}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "transparent", border: "1px solid var(--kt-border)", borderRadius: "var(--kt-r-sm)", color: "var(--kt-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", padding: "0.35rem 0.8rem", cursor: "pointer" }}>
            <RefreshCw size={12} />
            Retake with guide
          </button>
        </div>
      )}
    </div>
  );
}
