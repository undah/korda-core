// src/features/tracker/lib/shareProgressImage.ts

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  radius = 0,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.save();
  if (radius > 0) { roundRectPath(ctx, x, y, w, h, radius); ctx.clip(); }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

// Simple stick-figure body silhouette. `heaviness` 0–1 controls width.
function drawSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, heaviness: number) {
  const bodyW = 26 + heaviness * 28;  // 26–54px wide
  const headR = 18;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";

  // head
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.stroke();

  // torso
  const torsoTop = cy + headR + 4;
  const torsoBot = torsoTop + 58 + heaviness * 14;
  const topHalf = bodyW * 0.9;
  const botHalf = bodyW * (heaviness > 0.5 ? 1.15 : 1.0);

  ctx.beginPath();
  ctx.moveTo(cx - topHalf / 2, torsoTop);
  ctx.lineTo(cx + topHalf / 2, torsoTop);
  ctx.lineTo(cx + botHalf / 2, torsoBot);
  ctx.lineTo(cx - botHalf / 2, torsoBot);
  ctx.closePath();
  ctx.stroke();

  // arms
  ctx.beginPath();
  ctx.moveTo(cx - topHalf / 2, torsoTop + 10);
  ctx.lineTo(cx - topHalf / 2 - 20 - heaviness * 6, torsoTop + 40);
  ctx.moveTo(cx + topHalf / 2, torsoTop + 10);
  ctx.lineTo(cx + topHalf / 2 + 20 + heaviness * 6, torsoTop + 40);
  ctx.stroke();

  // legs
  const legSpread = botHalf * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - legSpread, torsoBot);
  ctx.lineTo(cx - legSpread - 4, torsoBot + 54);
  ctx.moveTo(cx + legSpread, torsoBot);
  ctx.lineTo(cx + legSpread + 4, torsoBot + 54);
  ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineH: number): number {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, curY); curY += lineH; }
  return curY;
}

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
  displayName?: string | null;
}

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

  // ── Sizes & layout ──────────────────────────────────────────────────────
  const HEADER_H   = 96;
  const LABEL_H    = 50;
  const PHOTO_H    = 648;
  const PHOTO_Y    = HEADER_H + LABEL_H;
  const PHOTO_GAP  = 8;
  const PHOTO_W    = (W - PHOTO_GAP) / 2;          // 536px each
  const STATS_Y    = PHOTO_Y + PHOTO_H;             // 794
  const STATS_H    = 424;
  const FOOTER_Y   = STATS_Y + STATS_H;             // 1218
  const BADGE_H    = 170;
  const BADGE_Y    = STATS_Y - BADGE_H / 2 - 10;   // floats at boundary
  const BADGE_W    = 210;
  const BADGE_X    = (W - BADGE_W) / 2;

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = "#0D0D0D";
  ctx.fillRect(0, 0, W, H);

  // subtle noise texture via repeated tiny semitransparent rect (fast approximation)
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      if (Math.random() < 0.35) ctx.fillRect(x, y, 2, 2);
    }
  }

  // ── Header ───────────────────────────────────────────────────────────────
  // thin top accent line
  ctx.fillStyle = "#00C8FF";
  ctx.fillRect(0, 0, W, 3);

  ctx.textAlign = "center";
  ctx.font = `700 52px 'DM Sans', sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.letterSpacing = "0.06em";
  ctx.fillText("REAL PROGRESS COMPARISON", W / 2, 58);
  ctx.font = "400 22px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.letterSpacing = "0";
  ctx.fillText("Same Person. Real Results.", W / 2, 86);

  // ── Photo labels ─────────────────────────────────────────────────────────
  const formatDateLabel = (d: string) => {
    try {
      const [y, m, day] = d.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
    } catch { return d; }
  };

  // Before label
  ctx.textAlign = "left";
  ctx.font = "700 26px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`BEFORE – ${input.beforeWeight}KG`, 22, HEADER_H + 36);
  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillText(formatDateLabel(input.beforeDate), 22, HEADER_H + 56);

  // After label
  ctx.textAlign = "right";
  ctx.font = "700 26px 'DM Sans', sans-serif";
  ctx.fillStyle = "#00C8FF";
  ctx.fillText(`AFTER – ${input.afterWeight}KG`, W - 22, HEADER_H + 36);
  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(0,200,255,0.45)";
  ctx.fillText(formatDateLabel(input.afterDate), W - 22, HEADER_H + 56);

  // ── Photos ────────────────────────────────────────────────────────────────
  drawCoverImage(ctx, imgBefore, 0,               PHOTO_Y, PHOTO_W, PHOTO_H, 0);
  drawCoverImage(ctx, imgAfter,  PHOTO_W + PHOTO_GAP, PHOTO_Y, PHOTO_W, PHOTO_H, 0);

  // Dark gradient overlay on bottom of photos (so stats panel reads over them)
  const photoOverlay = ctx.createLinearGradient(0, PHOTO_Y + PHOTO_H - 120, 0, PHOTO_Y + PHOTO_H);
  photoOverlay.addColorStop(0, "rgba(13,13,13,0)");
  photoOverlay.addColorStop(1, "rgba(13,13,13,0.92)");
  ctx.fillStyle = photoOverlay;
  ctx.fillRect(0, PHOTO_Y + PHOTO_H - 120, W, 120);

  // ── Difference badge (floats at photo/stats boundary) ────────────────────
  const weightChange = +(input.afterWeight - input.beforeWeight).toFixed(1);
  const bfChange = input.beforeBodyFat != null && input.afterBodyFat != null
    ? +(input.afterBodyFat - input.beforeBodyFat).toFixed(1) : null;

  // badge background
  ctx.save();
  roundRectPath(ctx, BADGE_X, BADGE_Y, BADGE_W, BADGE_H, 12);
  ctx.fillStyle = "#111118";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,200,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  const bCX = BADGE_X + BADGE_W / 2;
  ctx.textAlign = "center";

  ctx.font = "600 13px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#00C8FF";
  ctx.fillText("DIFFERENCE", bCX, BADGE_Y + 24);

  ctx.font = `700 46px 'DM Sans', sans-serif`;
  ctx.fillStyle = weightChange <= 0 ? "#22C55E" : "#EF4444";
  ctx.fillText(`${weightChange > 0 ? "+" : ""}${weightChange} KG`, bCX, BADGE_Y + 74);

  ctx.font = "400 14px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText("Weight Lost", bCX, BADGE_Y + 96);

  if (bfChange != null) {
    ctx.font = "500 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(`Body Fat`, bCX, BADGE_Y + 122);
    ctx.fillStyle = bfChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${bfChange > 0 ? "+" : ""}${bfChange}%`, bCX, BADGE_Y + 142);
  } else {
    ctx.font = "400 12px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#22C55E";
    ctx.fillText("Visible Fat Loss", bCX, BADGE_Y + 122);
    ctx.fillStyle = "rgba(255,185,0,0.7)";
    ctx.fillText("For More Progress", bCX, BADGE_Y + 145);
  }

  // ── Stats panel background ────────────────────────────────────────────────
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, STATS_Y, W, STATS_H);
  // top separator line
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, STATS_Y, W, 1);

  const COL_W = W / 3;  // 360px per column
  // divider lines
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(COL_W,     STATS_Y + 20, 1, STATS_H - 40);
  ctx.fillRect(COL_W * 2, STATS_Y + 20, 1, STATS_H - 40);

  // ── Stats: LEFT column (Before) ──────────────────────────────────────────
  const LEFT_CX = COL_W / 2;
  const SIL_Y   = STATS_Y + 40;

  drawSilhouette(ctx, LEFT_CX, SIL_Y, "#EF4444", 0.85);

  let ly = SIL_Y + 175;
  ctx.textAlign = "center";
  ctx.font = `700 56px 'DM Sans', sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${input.beforeWeight} KG`, LEFT_CX, ly);
  ly += 10;

  if (input.beforeBodyFat != null) {
    ctx.font = "600 26px 'DM Sans', sans-serif";
    ctx.fillStyle = "#EF4444";
    ly += 36;
    ctx.fillText(`(~${input.beforeBodyFat.toFixed(0)}% BF)`, LEFT_CX, ly);
    ly += 10;
  }

  const beforeBullets: string[] = [];
  if (input.beforeWaist) beforeBullets.push(`Waist: ${input.beforeWaist} cm`);
  beforeBullets.push("Higher body fat");
  beforeBullets.push("Less muscle definition");
  if (beforeBullets.length < 3) beforeBullets.push("Heavier appearance");

  ctx.font = "400 19px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.textAlign = "left";
  const bBulletX = COL_W * 0.1;
  for (const b of beforeBullets.slice(0, 4)) {
    ly += 30;
    ctx.fillText(`• ${b}`, bBulletX, ly);
  }

  // ── Stats: CENTER column ─────────────────────────────────────────────────
  const MID_CX = COL_W + COL_W / 2;
  let my = STATS_Y + 56;

  ctx.textAlign = "center";
  ctx.font = "700 14px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("CHANGE", MID_CX, my);
  my += 44;

  ctx.font = `700 62px 'DM Sans', sans-serif`;
  ctx.fillStyle = weightChange <= 0 ? "#22C55E" : "#EF4444";
  ctx.fillText(`${weightChange > 0 ? "+" : ""}${weightChange}`, MID_CX, my);
  ctx.font = "400 20px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  my += 8;
  ctx.fillText("kg total", MID_CX, my + 20);
  my += 52;

  if (bfChange != null) {
    ctx.font = `700 42px 'DM Sans', sans-serif`;
    ctx.fillStyle = bfChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${bfChange > 0 ? "+" : ""}${bfChange}%`, MID_CX, my);
    ctx.font = "400 18px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    my += 4;
    ctx.fillText("body fat", MID_CX, my + 22);
    my += 52;
  }

  if (input.beforeWaist && input.afterWaist) {
    const waistChange = +(input.afterWaist - input.beforeWaist).toFixed(1);
    ctx.font = `700 38px 'DM Sans', sans-serif`;
    ctx.fillStyle = waistChange <= 0 ? "#22C55E" : "#EF4444";
    ctx.fillText(`${waistChange > 0 ? "+" : ""}${waistChange} cm`, MID_CX, my);
    ctx.font = "400 18px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    my += 4;
    ctx.fillText("waist", MID_CX, my + 22);
    my += 50;
  }

  // small motivation text
  ctx.font = "500 15px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,185,0,0.55)";
  wrapText(ctx, "Stronger foundation · for more progress", MID_CX - 90, my + 20, 180, 22);

  // ── Stats: RIGHT column (After) ──────────────────────────────────────────
  const RIGHT_CX = COL_W * 2 + COL_W / 2;

  drawSilhouette(ctx, RIGHT_CX, SIL_Y, "#22C55E", 0.25);

  let ry = SIL_Y + 175;
  ctx.textAlign = "center";
  ctx.font = `700 56px 'DM Sans', sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${input.afterWeight} KG`, RIGHT_CX, ry);
  ry += 10;

  if (input.afterBodyFat != null) {
    ctx.font = "600 26px 'DM Sans', sans-serif";
    ctx.fillStyle = "#22C55E";
    ry += 36;
    ctx.fillText(`(~${input.afterBodyFat.toFixed(0)}% BF)`, RIGHT_CX, ry);
    ry += 10;
  }

  const afterBullets: string[] = [];
  if (input.afterWaist) afterBullets.push(`Waist: ${input.afterWaist} cm`);
  afterBullets.push("Lower body fat");
  afterBullets.push("More muscle definition");
  if (afterBullets.length < 3) afterBullets.push("Leaner overall look");

  ctx.font = "400 19px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.textAlign = "left";
  const aBulletX = COL_W * 2 + COL_W * 0.1;
  for (const b of afterBullets.slice(0, 4)) {
    ry += 30;
    ctx.fillText(`• ${b}`, aBulletX, ry);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#0A0A10";
  ctx.fillRect(0, FOOTER_Y, W, H - FOOTER_Y);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, FOOTER_Y, W, 1);

  const footerItems: { icon: string; title: string; sub: string }[] = [
    { icon: "◎", title: "CONSISTENT WORK",       sub: "Better habits. Better results." },
    { icon: "▪",  title: "REAL TRANSFORMATION", sub: "This is just the beginning."    },
    { icon: "□",  title: "STAY CONSISTENT",      sub: "The best version is coming."   },
  ];

  footerItems.forEach((item, i) => {
    const fx = (W / 3) * i + (W / 3) / 2;
    const fy = FOOTER_Y + 42;
    ctx.textAlign = "center";
    ctx.font = "400 22px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#22C55E";
    ctx.fillText(item.icon, fx, fy);
    ctx.font = "700 16px 'DM Sans', sans-serif";
    ctx.fillStyle = "#22C55E";
    ctx.fillText(item.title, fx, fy + 30);
    ctx.font = "400 14px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillText(item.sub, fx, fy + 52);
  });

  // branding
  ctx.textAlign = "center";
  ctx.font = "600 18px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(0,200,255,0.4)";
  ctx.fillText("KordaTracker", W / 2, H - 12);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: "My progress" });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
