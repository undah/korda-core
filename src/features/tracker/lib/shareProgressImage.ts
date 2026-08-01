// src/features/tracker/lib/shareProgressImage.ts

const W = 1080;
const H = 1350;

// ── Layout constants ─────────────────────────────────────────────────────────
const HDR_H    = 88;
const LBL_H    = 54;
const PHOTO_Y  = HDR_H + LBL_H;            // 142
const PHOTO_H  = 640;
const STATS_Y  = PHOTO_Y + PHOTO_H;         // 782
const STATS_H  = 440;
const FOOTER_Y = STATS_Y + STATS_H;         // 1222
const COL_W    = W / 3;                     // 360 each

// Badge sits inside the photo area, drawn AFTER photos (painter's order)
const BADGE_W  = 228;
const BADGE_H  = 162;
const BADGE_X  = (W - BADGE_W) / 2;
const BADGE_Y  = PHOTO_Y + PHOTO_H - BADGE_H - 20; // 20px above photo bottom

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Body silhouette with bezier curves so heaviness is visually obvious
function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  color: string,
  heaviness: number,   // 0 = slim, 1 = heavy
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  const headR     = 19;
  const neckH     = 8;
  const shoulderW = 26 + heaviness * 12;   // 26 – 38 px
  const bellyOut  = heaviness * 30;         // 0 – 30 px lateral belly bulge
  const hipW      = 20 + heaviness * 20;   // 20 – 40 px
  const torsoH    = 72;
  const bodyTopY  = cy + headR + neckH;
  const bodyBotY  = bodyTopY + torsoH;

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.stroke();

  // Torso — bezier curves give belly bulge on the "heavy" figure
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, bodyTopY);
  ctx.bezierCurveTo(
    cx - shoulderW - bellyOut,       bodyTopY + torsoH * 0.35,
    cx - hipW      - bellyOut * 0.4, bodyTopY + torsoH * 0.70,
    cx - hipW,                       bodyBotY,
  );
  ctx.lineTo(cx + hipW, bodyBotY);
  ctx.bezierCurveTo(
    cx + hipW      + bellyOut * 0.4, bodyTopY + torsoH * 0.70,
    cx + shoulderW + bellyOut,       bodyTopY + torsoH * 0.35,
    cx + shoulderW, bodyTopY,
  );
  ctx.closePath();
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, bodyTopY + 8);
  ctx.lineTo(cx - shoulderW - 18 - heaviness * 10, bodyTopY + 52);
  ctx.moveTo(cx + shoulderW, bodyTopY + 8);
  ctx.lineTo(cx + shoulderW + 18 + heaviness * 10, bodyTopY + 52);
  ctx.stroke();

  // Legs
  const legSpread = hipW * 0.38;
  ctx.beginPath();
  ctx.moveTo(cx - legSpread, bodyBotY);
  ctx.lineTo(cx - legSpread - 6, bodyBotY + 58);
  ctx.moveTo(cx + legSpread, bodyBotY);
  ctx.lineTo(cx + legSpread + 6, bodyBotY + 58);
  ctx.stroke();

  ctx.restore();
}

// Footer icons drawn as canvas shapes — no unicode characters

function drawTargetIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy,  9, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy,  3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  const bw = 9, gap = 6;
  const totalW = 3 * bw + 2 * gap;
  const sx = cx - totalW / 2;
  const baseline = cy + 18;
  [16, 26, 36].forEach((h, i) => {
    ctx.fillRect(sx + i * (bw + gap), baseline - h, bw, h);
  });
  ctx.restore();
}

function drawCalendarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const w = 34, h = 30, x = cx - w / 2, y = cy - h / 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 9);          // header band
  // 2×3 grid of small squares
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillRect(x + 5 + col * 9, y + 14 + row * 8, 5, 5);
    }
  }
  ctx.restore();
}

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch { return d; }
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface ShareProgressInput {
  beforeUrl: string;
  afterUrl: string;
  beforeDate: string;
  afterDate: string;
  beforeWeight: number;
  afterWeight: number;
  beforeBodyFat?: number | null;
  afterBodyFat?: number | null;
  beforeWaist?: number | null;
  afterWaist?: number | null;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateShareImage(input: ShareProgressInput): Promise<Blob> {
  const [imgBefore, imgAfter] = await Promise.all([
    loadImage(input.beforeUrl),
    loadImage(input.afterUrl),
  ]);

  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const weightChange = +(input.afterWeight  - input.beforeWeight).toFixed(1);
  const bfChange     = input.beforeBodyFat != null && input.afterBodyFat != null
    ? +(input.afterBodyFat - input.beforeBodyFat).toFixed(1) : null;
  const waistChange  = input.beforeWaist   != null && input.afterWaist   != null
    ? +(input.afterWaist   - input.beforeWaist).toFixed(1)   : null;

  // ── 1. Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = "#0D0D0D";
  ctx.fillRect(0, 0, W, H);

  // top cyan accent bar
  ctx.fillStyle = "#00C8FF";
  ctx.fillRect(0, 0, W, 3);

  // ── 2. Header ───────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.font = "800 56px 'DM Sans', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("REAL PROGRESS COMPARISON", W / 2, 56);

  ctx.font = "400 20px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("Same Person. Real Results.", W / 2, 82);

  // ── 3. Photo labels (clearly above photos, no clipping) ─────────────────────
  ctx.textAlign = "left";
  ctx.font = "700 28px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fillText(`BEFORE – ${input.beforeWeight}KG`, 20, HDR_H + 30);

  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.fillText(formatDate(input.beforeDate), 20, HDR_H + 50);

  ctx.textAlign = "right";
  ctx.font = "700 28px 'DM Sans', sans-serif";
  ctx.fillStyle = "#00C8FF";
  ctx.fillText(`AFTER – ${input.afterWeight}KG`, W - 20, HDR_H + 30);

  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(0,200,255,0.40)";
  ctx.fillText(formatDate(input.afterDate), W - 20, HDR_H + 50);

  // ── 4. Photos ────────────────────────────────────────────────────────────────
  const PHOTO_HALF = (W - 4) / 2;  // 538 each, 4px gap
  drawCoverImage(ctx, imgBefore, 0,              PHOTO_Y, PHOTO_HALF, PHOTO_H);
  drawCoverImage(ctx, imgAfter,  PHOTO_HALF + 4, PHOTO_Y, PHOTO_HALF, PHOTO_H);

  // thin divider between photos
  ctx.fillStyle = "#0D0D0D";
  ctx.fillRect(PHOTO_HALF, PHOTO_Y, 4, PHOTO_H);

  // gradient fade on bottom 200px of photos (behind the badge)
  const photoGrad = ctx.createLinearGradient(0, PHOTO_Y + PHOTO_H - 200, 0, PHOTO_Y + PHOTO_H);
  photoGrad.addColorStop(0, "rgba(13,13,13,0)");
  photoGrad.addColorStop(1, "rgba(13,13,13,0.88)");
  ctx.fillStyle = photoGrad;
  ctx.fillRect(0, PHOTO_Y + PHOTO_H - 200, W, 200);

  // ── 5. Difference badge — drawn AFTER photos, BEFORE stats bg ───────────────
  // This guarantees it sits on top of photos but also on top of stats background.
  ctx.save();
  roundRect(ctx, BADGE_X, BADGE_Y, BADGE_W, BADGE_H, 14);
  ctx.fillStyle = "rgba(13,13,20,0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,200,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  const bCX = BADGE_X + BADGE_W / 2;
  ctx.textAlign = "center";

  ctx.font = "600 12px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#00C8FF";
  ctx.fillText("DIFFERENCE", bCX, BADGE_Y + 22);

  ctx.font = `800 52px 'DM Sans', sans-serif`;
  ctx.fillStyle = weightChange <= 0 ? "#22C55E" : "#EF4444";
  ctx.fillText(`${weightChange > 0 ? "+" : ""}${weightChange} KG`, bCX, BADGE_Y + 78);

  ctx.font = "400 14px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("Weight Lost", bCX, BADGE_Y + 100);

  // secondary badge metric: BF% if available, otherwise generic progress line
  if (bfChange != null) {
    ctx.font = "600 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Body Fat", bCX, BADGE_Y + 126);
    ctx.fillStyle = bfChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${bfChange > 0 ? "+" : ""}${bfChange}%`, bCX, BADGE_Y + 148);
  } else {
    ctx.font = "400 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#22C55E";
    ctx.fillText("Visible Fat Loss", bCX, BADGE_Y + 130);
    ctx.fillStyle = "rgba(255,185,0,0.65)";
    ctx.fillText("Keep going", bCX, BADGE_Y + 150);
  }

  // ── 6. Stats panel background ────────────────────────────────────────────────
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, STATS_Y, W, STATS_H);

  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.fillRect(0, STATS_Y, W, 1);             // top border
  ctx.fillRect(COL_W,     STATS_Y + 24, 1, STATS_H - 48); // col dividers
  ctx.fillRect(COL_W * 2, STATS_Y + 24, 1, STATS_H - 48);

  // ── 7. Stats: LEFT column (Before) ──────────────────────────────────────────
  const LEFT_CX = COL_W / 2;
  const SIL_CY  = STATS_Y + 82;
  drawSilhouette(ctx, LEFT_CX, SIL_CY, "#EF4444", 0.88);

  // Weight below silhouette
  // Silhouette bottom ≈ SIL_CY + headR(19) + neckH(8) + torsoH(72) + legs(58) − headR ≈ SIL_CY + 138
  let ly = SIL_CY + 152;

  ctx.textAlign = "center";
  ctx.font = "800 52px 'DM Sans', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${input.beforeWeight} KG`, LEFT_CX, ly);
  ly += 8;

  if (input.beforeBodyFat != null) {
    ly += 34;
    ctx.font = "600 24px 'DM Sans', sans-serif";
    ctx.fillStyle = "#EF4444";
    ctx.fillText(`(~${input.beforeBodyFat.toFixed(0)}% BF)`, LEFT_CX, ly);
  }

  const beforeBullets = [
    input.beforeWaist ? `Waist: ${input.beforeWaist} cm` : "Higher body fat",
    "Less muscle definition",
    "Heavier appearance",
  ];

  ctx.font = "400 18px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.textAlign = "left";
  const bBX = 20;
  ly += 36;
  for (const bullet of beforeBullets) {
    ctx.fillText(`• ${bullet}`, bBX, ly);
    ly += 28;
  }

  // ── 8. Stats: CENTER column ──────────────────────────────────────────────────
  const MID_CX = COL_W + COL_W / 2;
  let my = STATS_Y + 54;

  ctx.textAlign = "center";

  // BF% change
  if (bfChange != null) {
    ctx.font = "700 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText("BODY FAT", MID_CX, my);
    my += 46;
    ctx.font = "800 46px 'DM Sans', sans-serif";
    ctx.fillStyle = bfChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${bfChange > 0 ? "+" : ""}${bfChange}%`, MID_CX, my);
    my += 6;
    ctx.font = "400 16px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText("body fat change", MID_CX, my + 18);
    my += 56;
  } else {
    ctx.font = "700 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText("TOTAL CHANGE", MID_CX, my);
    my += 46;
    ctx.font = "800 52px 'DM Sans', sans-serif";
    ctx.fillStyle = weightChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${weightChange > 0 ? "+" : ""}${weightChange}`, MID_CX, my);
    my += 6;
    ctx.font = "400 16px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText("kg", MID_CX, my + 18);
    my += 56;
  }

  // Waist change
  if (waistChange != null) {
    ctx.font = "700 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText("WAIST", MID_CX, my);
    my += 44;
    ctx.font = "800 42px 'DM Sans', sans-serif";
    ctx.fillStyle = waistChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${waistChange > 0 ? "+" : ""}${waistChange} cm`, MID_CX, my);
    my += 6;
    ctx.font = "400 16px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText("waist change", MID_CX, my + 18);
    my += 52;
  }

  // Motivation — two short fixed lines, no wrapping
  const motY = Math.max(my + 28, STATS_Y + STATS_H - 110);
  ctx.font = "500 15px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,185,0,0.55)";
  ctx.fillText("Stronger foundation.", MID_CX, motY);
  ctx.fillText("For more progress.", MID_CX, motY + 22);

  // ── 9. Stats: RIGHT column (After) ──────────────────────────────────────────
  const RIGHT_CX = COL_W * 2 + COL_W / 2;
  drawSilhouette(ctx, RIGHT_CX, SIL_CY, "#22C55E", 0.14);

  let ry = SIL_CY + 152;

  ctx.textAlign = "center";
  ctx.font = "800 52px 'DM Sans', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${input.afterWeight} KG`, RIGHT_CX, ry);
  ry += 8;

  if (input.afterBodyFat != null) {
    ry += 34;
    ctx.font = "600 24px 'DM Sans', sans-serif";
    ctx.fillStyle = "#22C55E";
    ctx.fillText(`(~${input.afterBodyFat.toFixed(0)}% BF)`, RIGHT_CX, ry);
  }

  const afterBullets = [
    input.afterWaist ? `Waist: ${input.afterWaist} cm` : "Lower body fat",
    "More muscle definition",
    "Leaner overall look",
  ];

  ctx.font = "400 18px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.textAlign = "left";
  const aBX = COL_W * 2 + 20;
  ry += 36;
  for (const bullet of afterBullets) {
    ctx.fillText(`• ${bullet}`, aBX, ry);
    ry += 28;
  }

  // ── 10. Footer ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#0A0A10";
  ctx.fillRect(0, FOOTER_Y, W, H - FOOTER_Y);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, FOOTER_Y, W, 1);

  const footerDefs: {
    draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) => void;
    title: string;
    sub: string;
  }[] = [
    { draw: drawTargetIcon,   title: "CONSISTENT WORK",    sub: "Better habits. Better results." },
    { draw: drawBarIcon,      title: "REAL TRANSFORMATION", sub: "This is just the beginning."   },
    { draw: drawCalendarIcon, title: "STAY CONSISTENT",     sub: "The best version is coming."   },
  ];

  footerDefs.forEach((item, i) => {
    const fx  = COL_W * i + COL_W / 2;
    const icy = FOOTER_Y + 38;
    item.draw(ctx, fx, icy, "#22C55E");

    ctx.textAlign = "center";
    ctx.font = "700 15px 'DM Sans', sans-serif";
    ctx.fillStyle = "#22C55E";
    ctx.fillText(item.title, fx, icy + 30);

    ctx.font = "400 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.fillText(item.sub, fx, icy + 50);
  });

  // Branding
  ctx.textAlign = "center";
  ctx.font = "600 18px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(0,200,255,0.38)";
  ctx.fillText("KordaTracker", W / 2, H - 10);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Could not export image"))),
      "image/png",
    );
  });
}

// ── Share / download ──────────────────────────────────────────────────────────

export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav  = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?:    (d: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: "My progress" }); return; }
    catch (e) { if ((e as Error)?.name === "AbortError") return; }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
