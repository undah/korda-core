// src/features/tracker/components/ProgressExport.tsx
import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties } from "react";
import { toBlob } from "html-to-image";
import { useTrackerCheckins } from "@/features/tracker/hooks/useTrackerCheckins";
import { ProgressExportCard } from "./ProgressExportCard";
import { ProgressExportCardB } from "./ProgressExportCardB";
import { shareOrDownloadBlob } from "@/features/tracker/lib/shareImage";
import type { WeighIn } from "@/features/tracker/lib/progress";
import type { TrackerCheckin } from "@/features/tracker/types";

// ── SCHEMA NOTES ───────────────────────────────────────────────────────
// Table:   tracker_checkins  (RLS-scoped to the signed-in user)
// Columns: log_date, weight, body_fat, fat_mass_kg, lean_mass_kg
//          fat_mass_kg / lean_mass_kg are STORED generated columns
//          (supabase/migrate_body_composition.sql) — present in prod.
// Reads go through the existing useTrackerCheckins() react-query hook
// rather than a raw supabase call, so this shares the app's cache.
// Photos:  passed in as props — tracker_photos rows are per date AND per
//          angle, so the caller picks the pair (TrackerPhotos already does).
// CORS:    the `tracker-photos` bucket is public, which sends
//          Access-Control-Allow-Origin: * — required for canvas export.
// ───────────────────────────────────────────────────────────────────────

const PREVIEW_MAX = 460; // px

/** Both cards are 1080x1350, so the toggle only swaps which one renders into
 *  the shared capture pipeline. Backgrounds differ, hence the lookup. */
export type ExportFormat = "clinical" | "ledger";
const FORMATS: [ExportFormat, string][] = [
  ["clinical", "Clinical"],
  ["ledger", "Ledger"],
];
const BACKDROP: Record<ExportFormat, string> = {
  clinical: "#0a0e12",
  ledger: "#07090c",
};

/** A check-in only qualifies as an endpoint if it has a body-fat reading. */
function toWeighIn(c: TrackerCheckin): WeighIn | null {
  if (c.body_fat == null) return null;
  return {
    log_date: c.log_date,
    weight: c.weight,
    body_fat: c.body_fat,
    fat_mass_kg: c.fat_mass_kg ?? null,
    lean_mass_kg: c.lean_mass_kg ?? null,
  };
}

interface Props {
  /** Explicit endpoints. If omitted, falls back to first & latest rows with a body_fat value. */
  before?: WeighIn | null;
  after?: WeighIn | null;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  /** Rendered as a dismissable overlay when provided. */
  onClose?: () => void;
  defaultFormat?: ExportFormat;
}

export default function ProgressExport({
  before,
  after,
  beforePhotoUrl,
  afterPhotoUrl,
  onClose,
  defaultFormat = "clinical",
}: Props) {
  // Only hit the network when the caller didn't hand us an explicit pair.
  const needsFallback = !before || !after;
  const { data: checkins = [], isLoading } = useTrackerCheckins(1000, needsFallback);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);

  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(PREVIEW_MAX / 1080);

  const pair = useMemo(() => {
    if (before && after) return { before, after };
    const usable = checkins
      .map(toWeighIn)
      .filter((w): w is WeighIn => w !== null)
      .sort((a, b) => a.log_date.localeCompare(b.log_date));
    if (usable.length < 2) return null;
    return { before: usable[0], after: usable[usable.length - 1] };
  }, [before, after, checkins]);

  // Fit the 1080px-wide card into the viewport for preview.
  useEffect(() => {
    const fit = () => {
      const avail = Math.min(window.innerWidth - 32, PREVIEW_MAX);
      const byHeight = (window.innerHeight - 160) / 1350;
      setScale(Math.min(avail / 1080, byHeight));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [pair]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = useCallback(async () => {
    if (!cardRef.current || !pair) return;
    setBusy(true);
    setError(null);
    try {
      // Fonts must be resolved or the capture falls back to a system face.
      await document.fonts.ready;
      const blob = await toBlob(cardRef.current, {
        width: 1080,
        height: 1350,
        pixelRatio: 1, // node is already 1080×1350
        cacheBust: true,
        backgroundColor: BACKDROP[format],
        // The preview wrapper is transformed; the clone must not inherit it.
        style: { transform: "none", transformOrigin: "top left" },
      });
      if (!blob) throw new Error("Could not render the image.");
      await shareOrDownloadBlob(blob, `kordatracker-progress-${format}-${pair.after.log_date}.png`);
    } catch (e) {
      setError((e as Error)?.message ?? "Export failed.");
    } finally {
      setBusy(false);
    }
  }, [pair, format]);

  const body = (() => {
    if (needsFallback && isLoading)
      return <p style={msgStyle}>Loading check-ins…</p>;

    if (!pair)
      return (
        <p style={msgStyle}>
          Need at least two check-ins with a body-fat reading to build a progress card.
        </p>
      );

    return (
      <>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--kt-r-sm)", overflow: "hidden", flexShrink: 0 }}>
          {FORMATS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFormat(key)}
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: "var(--kt-fs-xs)",
                fontWeight: format === key ? 600 : 400,
                letterSpacing: "0.04em",
                padding: "0.4rem 1.1rem",
                background: format === key ? "var(--kt-accent)" : "transparent",
                color: format === key ? "#07090c" : "rgba(255,255,255,0.6)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            width: 1080 * scale,
            height: 1350 * scale,
            overflow: "hidden",
            borderRadius: "var(--kt-r-md)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
            flexShrink: 0,
          }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {format === "clinical" ? (
              <ProgressExportCard
                ref={cardRef}
                before={pair.before}
                after={pair.after}
                beforePhotoUrl={beforePhotoUrl}
                afterPhotoUrl={afterPhotoUrl}
              />
            ) : (
              <ProgressExportCardB
                ref={cardRef}
                before={pair.before}
                after={pair.after}
                beforePhotoUrl={beforePhotoUrl}
                afterPhotoUrl={afterPhotoUrl}
              />
            )}
          </div>
        </div>

        {error && (
          <p style={{ ...msgStyle, color: "#EF4444", maxWidth: 1080 * scale }}>{error}</p>
        )}

        <button
          className="kt-btn kt-btn-blue"
          onClick={download}
          disabled={busy}
          style={{ width: "100%", maxWidth: 1080 * scale }}
        >
          {busy ? "Rendering…" : "Save / share image →"}
        </button>
      </>
    );
  })();

  const stack = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
      {body}
    </div>
  );

  if (!onClose) return stack;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(7,9,11,0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ cursor: "default" }}>
        {stack}
        <button
          onClick={onClose}
          style={{
            display: "block",
            margin: "1rem auto 0",
            background: "none",
            border: "1px solid var(--kt-border)",
            borderRadius: "var(--kt-r-sm)",
            color: "var(--kt-dim)",
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: "var(--kt-fs-2xs)",
            letterSpacing: "0.1em",
            padding: "0.5rem 1.5rem",
          }}
        >
          close ×
        </button>
      </div>
    </div>
  );
}

const msgStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono',monospace",
  fontSize: "var(--kt-fs-sm)",
  color: "var(--kt-dim)",
  textAlign: "center",
  lineHeight: 1.7,
  padding: "1rem",
};
