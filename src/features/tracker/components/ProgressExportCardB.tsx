// src/features/tracker/components/ProgressExportCardB.tsx
import { forwardRef } from "react";
import { type WeighIn, deriveProgress, dayMonthYear } from "@/features/tracker/lib/progress";

export interface ProgressExportCardBProps {
  before: WeighIn;
  after: WeighIn;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

/**
 * Fixed 1080×1350 export card — "Subtraction Ledger", no fat stat.
 *
 * Same props, same canvas and same forwardRef shape as ProgressExportCard, so
 * the two are drop-in alternates through one capture pipeline.
 *
 * The absence of a fat-mass figure is deliberate: this card's argument is the
 * subtraction itself, and its strip is body fat / average rate / elapsed.
 */
export const ProgressExportCardB = forwardRef<HTMLDivElement, ProgressExportCardBProps>(
  function ProgressExportCardB({ before, after, beforePhotoUrl, afterPhotoUrl }, ref) {
    const s = deriveProgress(before, after);

    // hero shows the weight delta: integer when whole, else 1 decimal, real minus
    const wd = s.weightDelta;
    const heroNum = Number.isInteger(wd) ? Math.abs(wd).toString() : Math.abs(wd).toFixed(1);
    const heroStr = (wd < 0 ? "−" : "") + heroNum;

    const bfBefore = Math.round(before.body_fat);
    const bfAfter = Math.round(after.body_fat);

    return (
      <div className="ktexportB" ref={ref}>
        <style>{css}</style>

        <div className="b-photos">
          <PhotoB url={beforePhotoUrl} fallback="before" />
          <PhotoB url={afterPhotoUrl} fallback="after" />
        </div>
        <div className="b-seam" />
        <div className="b-brand">KordaTracker</div>
        <div className="b-dt l">
          {dayMonthYear(before.log_date)}
          <small>BEFORE</small>
        </div>
        <div className="b-dt r">
          {dayMonthYear(after.log_date)}
          <small>AFTER</small>
        </div>

        <div className="b-ledger">
          <div className="b-eq">
            <span className="n">{before.weight.toFixed(1)}</span>
            <span className="op">−</span>
            <span className="n after">{after.weight.toFixed(1)}</span>
            <span className="op">=</span>
          </div>
          <div className="b-hero">
            {heroStr}
            <em>kg</em>
          </div>
          <div className="b-strip">
            <div className="s">
              <div className="v">
                {bfBefore} → {bfAfter}%
              </div>
              <div className="l">Body fat</div>
            </div>
            <div className="s">
              <div className="v c">{s.rate.toFixed(1)} kg/wk</div>
              <div className="l">Average</div>
            </div>
            <div className="s">
              <div className="v">{s.days} days</div>
              <div className="l">Elapsed</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

function PhotoB({ url, fallback }: { url?: string; fallback: string }) {
  return (
    <div className="photo" data-label={url ? undefined : fallback}>
      {url ? (
        <img className="ph-img" src={url} crossOrigin="anonymous" alt="" />
      ) : (
        <div className="silh" />
      )}
    </div>
  );
}

/* Approved "Subtraction Ledger" styles, scoped under .ktexportB.
   Requires "Space Grotesk", "JetBrains Mono" and "Anton" — all three come from
   the Google Fonts @import at the top of src/index.css. */
const css = `
.ktexportB{
  --hi:#eef2f5;--mid:#8a97a3;--dim:#5b6772;--cyan:#22d3ee;
  width:1080px;height:1350px;background:#07090c;color:var(--hi);position:relative;overflow:hidden;
  font-family:'Space Grotesk',system-ui,sans-serif;box-sizing:border-box;
}
.ktexportB *{box-sizing:border-box;margin:0;padding:0}
.ktexportB .b-photos{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.ktexportB .photo{position:relative;height:100%;overflow:hidden;background:
  radial-gradient(120% 90% at 30% 15%,rgba(120,140,160,.16),transparent 60%),
  linear-gradient(160deg,#1a2129 0%,#0c1015 100%)}
.ktexportB .photo::after{content:attr(data-label);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.25em;color:rgba(255,255,255,.16);text-transform:uppercase}
.ktexportB .ph-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ktexportB .silh{position:absolute;left:50%;bottom:0;width:46%;height:78%;transform:translateX(-50%);background:radial-gradient(60% 55% at 50% 22%,rgba(0,0,0,.35),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0));border-radius:50% 50% 0 0/60% 60% 0 0}
.ktexportB .b-seam{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.14);transform:translateX(-50%)}
.ktexportB .b-dt{position:absolute;top:34px;font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:.2em;color:rgba(255,255,255,.7)}
.ktexportB .b-dt.l{left:40px}.ktexportB .b-dt.r{right:40px;text-align:right}
.ktexportB .b-dt small{display:block;color:rgba(255,255,255,.45);font-size:11px;margin-top:4px;letter-spacing:.24em}
.ktexportB .b-brand{position:absolute;top:34px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.32em;color:rgba(255,255,255,.55);text-transform:uppercase}
.ktexportB .b-ledger{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(7,9,12,0),rgba(7,9,12,.82) 22%,#07090c 55%);padding:160px 60px 58px;text-align:center}
.ktexportB .b-eq{display:flex;align-items:baseline;justify-content:center;gap:26px;font-family:'JetBrains Mono',monospace}
.ktexportB .b-eq .n{font-size:56px;color:var(--mid);font-weight:500}
.ktexportB .b-eq .op{font-size:40px;color:var(--dim)}
.ktexportB .b-eq .n.after{color:var(--hi)}
.ktexportB .b-hero{font-family:'Anton',sans-serif;font-size:210px;line-height:.9;letter-spacing:.01em;margin-top:8px;color:#fff}
.ktexportB .b-hero em{font-style:normal;color:var(--cyan)}
.ktexportB .b-strip{display:flex;justify-content:center;gap:64px;margin-top:36px;padding-top:26px;border-top:1px solid rgba(255,255,255,.1)}
.ktexportB .b-strip .s .v{font-size:34px;font-weight:600}
.ktexportB .b-strip .s .v.c{color:var(--cyan)}
.ktexportB .b-strip .s .l{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim);letter-spacing:.16em;text-transform:uppercase;margin-top:6px}
`;
