// src/features/tracker/components/ProgressExportCard.tsx
import { forwardRef } from "react";
import {
  type WeighIn,
  deriveProgress,
  signed1,
  abs1,
  dayMonth,
  dayMonthYear,
} from "@/features/tracker/lib/progress";

export interface ProgressExportCardProps {
  before: WeighIn;
  after: WeighIn;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

/**
 * Fixed 1080×1350 export card — "Clinical Readout".
 * Renders at true export size; scale the *parent* for on-screen preview,
 * and capture THIS node (via ref) at natural size for the PNG.
 */
export const ProgressExportCard = forwardRef<HTMLDivElement, ProgressExportCardProps>(
  function ProgressExportCard({ before, after, beforePhotoUrl, afterPhotoUrl }, ref) {
    const s = deriveProgress(before, after);

    const beforeFat = before.body_fat;
    const afterFat = after.body_fat;
    const round = (n: number) => Math.round(n);

    return (
      <div className="ktexport" ref={ref}>
        <style>{css}</style>

        <div className="a-top">
          <div>
            <div className="a-brand">
              Korda<span>Tracker</span>
            </div>
            <div className="a-eyebrow">Progress Report</div>
          </div>
          <div className="a-range">
            {dayMonth(before.log_date)}
            <br />→ <b>{dayMonthYear(after.log_date)}</b>
            <br />
            {Math.round(s.weeks)} weeks
          </div>
        </div>

        <div className="a-photos">
          <Photo
            url={beforePhotoUrl}
            fallback="before photo"
            weight={before.weight}
            date={`${dayMonth(before.log_date)} · ${beforeFat.toFixed(1)}% BF`}
          />
          <Photo
            url={afterPhotoUrl}
            fallback="after photo"
            weight={after.weight}
            date={`${dayMonth(after.log_date)} · ${afterFat.toFixed(1)}% BF`}
            after
          />
        </div>

        <div className="a-hero">
          <div>
            <div className="lab">Fat mass lost</div>
            <div className="big">
              <u>{signed1(s.fatLost)}</u>
              <span className="unit"> kg</span>
            </div>
          </div>
          <div className="sub">
            from <b>{abs1(s.fatBefore)} kg</b> fat
            <br />
            to <b>{abs1(s.fatAfter)} kg</b> fat
            <br />
            lean held near <b>{Math.round(s.leanAfter)} kg</b>
          </div>
        </div>

        <div className="a-comp">
          <CompRow tag="BEFORE" fatPct={beforeFat} weight={before.weight} round={round} />
          <CompRow tag="AFTER" fatPct={afterFat} weight={after.weight} round={round} />
          <div className="legend">
            <span>
              <i style={{ background: "var(--fat)" }} />
              Fat mass
            </span>
            <span>
              <i style={{ background: "var(--lean)" }} />
              Lean mass
            </span>
          </div>
        </div>

        <div className="a-metrics">
          <Metric value={signed1(s.weightDelta)} unit="kg" label="Bodyweight" />
          <Metric value={signed1(s.bfDelta)} unit="pts" label="Body fat" />
          <Metric value={s.rate.toFixed(1)} unit="kg/wk" label="Avg rate" accent />
          <Metric value={String(s.days)} unit="days" label="Elapsed" />
        </div>
      </div>
    );
  }
);

function Photo({
  url,
  fallback,
  weight,
  date,
  after,
}: {
  url?: string;
  fallback: string;
  weight: number;
  date: string;
  after?: boolean;
}) {
  return (
    <div className="photo" data-label={url ? undefined : fallback}>
      {url ? (
        <img className="ph-img" src={url} crossOrigin="anonymous" alt="" />
      ) : (
        <div className="silh" />
      )}
      <div className="scrim" />
      <div className={`a-plabel${after ? " after" : ""}`}>
        <div className="w">
          {weight.toFixed(1)}
          <span className="wu"> kg</span>
        </div>
        <div className="dt">{date}</div>
      </div>
    </div>
  );
}

function CompRow({
  tag,
  fatPct,
  weight,
  round,
}: {
  tag: string;
  fatPct: number;
  weight: number;
  round: (n: number) => number;
}) {
  const leanPct = 100 - fatPct;
  return (
    <div className="row">
      <div className="tag">{tag}</div>
      <div className="bar">
        <div className="seg fat" style={{ width: `${fatPct}%` }}>
          {round(fatPct)}%
        </div>
        <div className="seg lean" style={{ width: `${leanPct}%` }}>
          {round(leanPct)}%
        </div>
      </div>
      <div className="kg">{weight.toFixed(1)} kg</div>
    </div>
  );
}

function Metric({
  value,
  unit,
  label,
  accent,
}: {
  value: string;
  unit: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="m">
      <div className={`mv${accent ? " c" : ""}`}>
        {value}
        <span className="mu"> {unit}</span>
      </div>
      <div className="ml">{label}</div>
    </div>
  );
}

/* Approved "Clinical Readout" styles, scoped under .ktexport.
   Requires "Space Grotesk" and "JetBrains Mono" — both are loaded from the
   Google Fonts @import at the top of src/index.css. */
const css = `
.ktexport{
  --bg:#0a0e12;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.05);
  --hi:#eef2f5;--mid:#8a97a3;--dim:#5b6772;--cyan:#22d3ee;--fat:#f97316;--lean:#22d3ee;
  width:1080px;height:1350px;background:var(--bg);color:var(--hi);
  padding:44px;display:flex;flex-direction:column;overflow:hidden;
  font-family:'Space Grotesk',system-ui,sans-serif;box-sizing:border-box;
}
.ktexport *{box-sizing:border-box;margin:0;padding:0}
.ktexport .a-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px}
.ktexport .a-brand{font-weight:700;font-size:26px;letter-spacing:-.01em}
.ktexport .a-brand span{color:var(--cyan)}
.ktexport .a-eyebrow{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.3em;color:var(--mid);text-transform:uppercase;margin-top:6px}
.ktexport .a-range{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--dim);text-align:right;line-height:1.7}
.ktexport .a-range b{color:var(--hi);font-weight:500}
.ktexport .a-photos{display:grid;grid-template-columns:1fr 1fr;gap:3px;height:660px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--line)}
.ktexport .photo{position:relative;height:100%;overflow:hidden;background:
  radial-gradient(120% 90% at 30% 15%,rgba(120,140,160,.16),transparent 60%),
  linear-gradient(160deg,#1a2129 0%,#0c1015 100%)}
.ktexport .photo::after{content:attr(data-label);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.25em;color:rgba(255,255,255,.16);text-transform:uppercase}
.ktexport .ph-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ktexport .silh{position:absolute;left:50%;bottom:0;width:46%;height:78%;transform:translateX(-50%);background:radial-gradient(60% 55% at 50% 22%,rgba(0,0,0,.35),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0));border-radius:50% 50% 0 0/60% 60% 0 0}
.ktexport .scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(6,9,12,.72) 0%,rgba(6,9,12,0) 34%)}
.ktexport .a-plabel{position:absolute;left:20px;bottom:18px;font-family:'JetBrains Mono',monospace;z-index:2}
.ktexport .a-plabel .w{font-size:34px;font-weight:700;color:#fff;line-height:1}
.ktexport .a-plabel .wu{font-size:16px;color:rgba(255,255,255,.5)}
.ktexport .a-plabel .dt{font-size:13px;color:rgba(255,255,255,.65);margin-top:6px;letter-spacing:.08em}
.ktexport .a-plabel.after .w{color:var(--cyan)}
.ktexport .a-hero{display:flex;align-items:flex-end;justify-content:space-between;margin-top:34px;padding-bottom:24px;border-bottom:1px solid var(--line)}
.ktexport .a-hero .lab{font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:.24em;color:var(--mid);text-transform:uppercase}
.ktexport .a-hero .big{font-size:120px;font-weight:700;line-height:.86;letter-spacing:-.03em}
.ktexport .a-hero .big u{text-decoration:none;color:var(--fat)}
.ktexport .a-hero .unit{font-size:40px;color:var(--mid);font-weight:500}
.ktexport .a-hero .sub{text-align:right;font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--dim);line-height:1.7}
.ktexport .a-hero .sub b{color:var(--hi);font-weight:500}
.ktexport .a-comp{margin-top:30px}
.ktexport .a-comp .row{display:flex;align-items:center;gap:18px;margin-bottom:14px}
.ktexport .a-comp .tag{width:90px;font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--mid);letter-spacing:.1em}
.ktexport .a-comp .bar{flex:1;height:30px;border-radius:5px;overflow:hidden;display:flex;background:#0d1218}
.ktexport .a-comp .seg{height:100%;display:flex;align-items:center;padding:0 12px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;color:rgba(0,0,0,.75);white-space:nowrap}
.ktexport .a-comp .seg.fat{background:var(--fat)}
.ktexport .a-comp .seg.lean{background:var(--lean)}
.ktexport .a-comp .kg{width:104px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--hi)}
.ktexport .a-comp .legend{display:flex;gap:22px;margin-top:6px;margin-left:108px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim)}
.ktexport .a-comp .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:7px;vertical-align:middle}
.ktexport .a-metrics{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);padding-top:22px}
.ktexport .a-metrics .m{border-left:1px solid var(--line2);padding-left:16px}
.ktexport .a-metrics .m:first-child{border-left:none;padding-left:0}
.ktexport .a-metrics .mv{font-size:30px;font-weight:600;letter-spacing:-.02em}
.ktexport .a-metrics .mv.c{color:var(--cyan)}
.ktexport .a-metrics .mu{font-size:16px;color:var(--mid)}
.ktexport .a-metrics .ml{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.14em;margin-top:6px}
`;
