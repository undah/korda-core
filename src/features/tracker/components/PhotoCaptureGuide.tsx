// src/features/tracker/components/PhotoCaptureGuide.tsx
//
// In-page camera with onion-skin. Your previous shot at this angle sits over the
// LIVE feed at adjustable opacity, so you move yourself and the phone until the
// two line up, then capture. That is the only moment framing can be corrected —
// once a photo exists it is too late to do anything but retake it.
//
// Plain alpha, not difference blending: onion-skinning is about seeing both
// images at once, and difference only reads as "cancellation" for near-identical
// frames, which two photos taken weeks apart never are.
import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, SwitchCamera, Layers } from "lucide-react";

const TARGET_W = 900;
const TARGET_H = 1200; // 3:4, matching how photos display everywhere else

type Facing = "user" | "environment";

export default function PhotoCaptureGuide({
  ghostUrl,
  ghostDate,
  angle,
  onCapture,
  onClose,
}: {
  ghostUrl?: string;
  ghostDate?: string;
  angle: string;
  onCapture: (file: File, previewUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [opacity, setOpacity] = useState(0.4);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)open the stream whenever the camera side changes.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    (async () => {
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, or use the file picker instead."
            : name === "NotFoundError"
            ? "No camera found on this device."
            : "Could not start the camera."
        );
      }
    })();
    return () => { cancelled = true; };
  }, [facing, stop]);

  // Never leave the camera light on.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { stop(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stop]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Crop the live frame to 3:4 the same way object-fit:cover displays it, so
    // the capture is exactly what was on screen.
    const vw = video.videoWidth, vh = video.videoHeight;
    const target = TARGET_W / TARGET_H;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (vw / vh > target) { sw = vh * target; sx = (vw - sw) / 2; }
    else                  { sh = vw / target; sy = (vh - sh) / 2; }

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The front-camera preview is mirrored; bake that in so the saved photo
    // matches what the user was looking at while they aligned.
    if (facing === "user") {
      ctx.translate(TARGET_W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `${angle}-${Date.now()}.jpg`, { type: "image/jpeg" });
      stop();
      onCapture(file, URL.createObjectURL(blob));
    }, "image/jpeg", 0.92);
  }, [angle, facing, onCapture, stop]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#07090b", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", flexShrink: 0 }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--kt-fs-xs)", color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>
          {angle}{ghostDate ? ` · matching ${ghostDate}` : ""}
        </span>
        <button onClick={() => { stop(); onClose(); }} aria-label="Close camera"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: "0 0.75rem" }}>
        {error ? (
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "var(--kt-fs-sm)", color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.7, maxWidth: 320 }}>
            {error}
          </p>
        ) : (
          <div style={{ position: "relative", width: "100%", maxWidth: 420, aspectRatio: "3/4", borderRadius: "var(--kt-r-md)", overflow: "hidden", background: "#000" }}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover",
                transform: facing === "user" ? "scaleX(-1)" : undefined,
              }}
            />
            {/* Onion skin — your previous shot, straight alpha */}
            {ghostUrl && (
              <img src={ghostUrl} alt="" aria-hidden
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity, pointerEvents: "none" }} />
            )}
            {/* Thirds grid + centre line to align against */}
            <svg viewBox="0 0 30 40" preserveAspectRatio="none" aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <line x1="10" y1="0" x2="10" y2="40" stroke="rgba(255,255,255,0.16)" strokeWidth="0.15" />
              <line x1="20" y1="0" x2="20" y2="40" stroke="rgba(255,255,255,0.16)" strokeWidth="0.15" />
              <line x1="0" y1="13.33" x2="30" y2="13.33" stroke="rgba(255,255,255,0.16)" strokeWidth="0.15" />
              <line x1="0" y1="26.67" x2="30" y2="26.67" stroke="rgba(255,255,255,0.16)" strokeWidth="0.15" />
              <line x1="15" y1="0" x2="15" y2="40" stroke="rgba(0,200,255,0.5)" strokeWidth="0.15" />
            </svg>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, padding: "1rem 1.25rem calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}>
        {ghostUrl && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", maxWidth: 420, margin: "0 auto 1rem" }}>
            <Layers size={14} style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
            <input type="range" min={0} max={0.85} step={0.05} value={opacity}
              onChange={e => setOpacity(+e.target.value)}
              aria-label="Overlay opacity"
              style={{ width: "100%", accentColor: "#00C8FF", cursor: "pointer" }} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "var(--kt-fs-3xs)", color: "rgba(255,255,255,0.45)", width: 30, textAlign: "right", flexShrink: 0 }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
          <button onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}
            aria-label="Switch camera"
            style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "var(--kt-r-full)", color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex", padding: 11 }}>
            <SwitchCamera size={18} />
          </button>

          <button onClick={capture} disabled={!ready || !!error} aria-label="Take photo"
            style={{
              width: 66, height: 66, borderRadius: "50%",
              background: ready && !error ? "#00C8FF" : "rgba(255,255,255,0.15)",
              border: "4px solid rgba(255,255,255,0.25)",
              cursor: ready && !error ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#07090b", flexShrink: 0,
            }}>
            <Camera size={24} />
          </button>

          {/* Spacer keeps the shutter optically centred. */}
          <div style={{ width: 40 }} />
        </div>

        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "var(--kt-fs-3xs)", color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: "0.9rem", lineHeight: 1.6 }}>
          {ghostUrl
            ? "move until you line up with the faded shot, then capture"
            : "first shot at this angle — it becomes the guide for next time"}
        </p>
      </div>
    </div>
  );
}
