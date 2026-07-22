// src/features/tracker/lib/shareProgressImage.ts

const W = 1080;
const H = 1350;
const PHOTO_W = 500;
const PHOTO_H = 650;
const GAP = 20;
const TOP = 70;
const RADIUS = 16;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  roundRectPath(ctx, x, y, w, h, RADIUS);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

export interface ShareProgressInput {
  beforeUrl: string;
  afterUrl: string;
  beforeDate: string;
  afterDate: string;
  beforeWeight: number;
  afterWeight: number;
}

export async function generateShareImage(input: ShareProgressInput): Promise<Blob> {
  const [imgBefore, imgAfter] = await Promise.all([loadImage(input.beforeUrl), loadImage(input.afterUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#10101a");
  bg.addColorStop(1, "#0c0c14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const startX = (W - (PHOTO_W * 2 + GAP)) / 2;
  drawCoverImage(ctx, imgBefore, startX, TOP, PHOTO_W, PHOTO_H);
  drawCoverImage(ctx, imgAfter, startX + PHOTO_W + GAP, TOP, PHOTO_W, PHOTO_H);

  ctx.textAlign = "center";
  ctx.font = "600 22px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("BEFORE", startX + PHOTO_W / 2, TOP + PHOTO_H + 38);
  ctx.fillStyle = "#00C8FF";
  ctx.fillText("AFTER", startX + PHOTO_W + GAP + PHOTO_W / 2, TOP + PHOTO_H + 38);

  const change = +(input.afterWeight - input.beforeWeight).toFixed(1);
  ctx.font = "700 92px 'DM Sans', sans-serif";
  ctx.fillStyle = change <= 0 ? "#22C55E" : "#EF4444";
  ctx.fillText(`${change > 0 ? "+" : ""}${change} kg`, W / 2, TOP + PHOTO_H + 150);

  ctx.font = "500 34px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`${input.beforeWeight} kg  →  ${input.afterWeight} kg`, W / 2, TOP + PHOTO_H + 205);

  ctx.font = "400 24px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillText(`${input.beforeDate}  —  ${input.afterDate}`, W / 2, TOP + PHOTO_H + 245);

  ctx.font = "700 30px 'DM Sans', sans-serif";
  ctx.fillStyle = "#00C8FF";
  ctx.fillText("KordaTracker", W / 2, H - 56);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string }) => Promise<void> };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: "My progress" });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
