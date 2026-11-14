// src/features/tracker/lib/renderExportCard.ts
//
// Rasterises a progress export card to a PNG.
//
// Why not html-to-image's toBlob on its own: it serialises the node into an SVG
// <foreignObject>, inlines every <img> as a data URL, and draws that SVG onto a
// canvas. WebKit (so every browser on iOS) fires the SVG's load event before
// the images nested inside it are decoded, so the draw paints empty photo slots
// while text and gradients come out fine — progress reports without the photos.
//
// So the card is drawn in three layers instead:
//   1. the card's own background colour,
//   2. each photo, drawn straight from the on-screen <img> with drawImage
//      (object-fit and the clipping of overflow:hidden parents done by hand),
//   3. everything else, via html-to-image with the <img>s left out and the root
//      background cleared — a layer with holes where the photos sit.
// Layer 3 then holds no images at all, so there is nothing for WebKit to skip.
//
// Contract for cards rendered through this:
//   - the root background is a flat colour (it becomes layer 1);
//   - nothing between the root and a photo paints a background under it, or
//     layer 3 covers the photo. Empty slots may keep a placeholder background:
//     they have no <img>.

import { toCanvas } from "html-to-image";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Clip {
  box: Box;
  radius: number;
}

interface PhotoLayout {
  img: HTMLImageElement;
  box: Box;
  fit: string;
  position: string;
  clips: Clip[];
}

export interface RenderCardOptions {
  width: number;
  height: number;
}

export async function renderCardToBlob(
  node: HTMLElement,
  { width, height }: RenderCardOptions,
): Promise<Blob> {
  // Fonts must be resolved or the capture falls back to a system face.
  await document.fonts.ready;

  const layouts = measurePhotos(node);
  const photos = await Promise.all(
    layouts.map(async l => ({ ...l, source: await drawableSource(l.img) })),
  );
  if (photos.some(p => !p.source)) {
    throw new Error("Couldn't load a progress photo. Check your connection and try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render the image.");

  ctx.fillStyle = getComputedStyle(node).backgroundColor;
  ctx.fillRect(0, 0, width, height);

  for (const p of photos) {
    if (p.source) drawPhoto(ctx, p, p.source);
  }

  const overlay = await toCanvas(node, {
    width,
    height,
    pixelRatio: 1, // node is already at export size
    filter: el => el.tagName !== "IMG",
    style: {
      background: "transparent",
      // The preview wrapper is transformed; the clone must not inherit it.
      transform: "none",
      transformOrigin: "top left",
    },
  });
  ctx.drawImage(overlay, 0, 0, width, height);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error("Could not render the image."))),
      "image/png",
    ),
  );
}

/** Where each <img> sits on the card, in card pixels. The card may be shown
 *  scaled for preview, so viewport rects are divided by that scale. */
function measurePhotos(root: HTMLElement): PhotoLayout[] {
  const rootRect = root.getBoundingClientRect();
  const k = root.offsetWidth ? rootRect.width / root.offsetWidth : 1;
  const toCard = (r: DOMRect): Box => ({
    x: (r.left - rootRect.left) / k,
    y: (r.top - rootRect.top) / k,
    w: r.width / k,
    h: r.height / k,
  });

  return Array.from(root.querySelectorAll("img"))
    .filter(img => {
      const cs = getComputedStyle(img);
      return cs.display !== "none" && cs.visibility !== "hidden";
    })
    .map(img => {
      const cs = getComputedStyle(img);
      return {
        img,
        box: toCard(img.getBoundingClientRect()),
        fit: cs.objectFit,
        position: cs.objectPosition,
        clips: clipChain(img, root, toCard),
      };
    });
}

/** Padding boxes of every overflow-clipping ancestor up to and including root. */
function clipChain(img: HTMLElement, root: HTMLElement, toCard: (r: DOMRect) => Box): Clip[] {
  const clips: Clip[] = [];
  for (let el = img.parentElement; el; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const b = toCard(el.getBoundingClientRect());
      const bl = parseFloat(cs.borderLeftWidth) || 0;
      const bt = parseFloat(cs.borderTopWidth) || 0;
      const br = parseFloat(cs.borderRightWidth) || 0;
      const bb = parseFloat(cs.borderBottomWidth) || 0;
      const box = { x: b.x + bl, y: b.y + bt, w: b.w - bl - br, h: b.h - bt - bb };
      const outer = parseRadius(cs.borderTopLeftRadius, b.w, b.h);
      clips.push({ box, radius: Math.max(0, outer - Math.max(bl, bt)) });
    }
    if (el === root) break;
  }
  return clips;
}

function parseRadius(v: string, w: number, h: number): number {
  const first = v.trim().split(/\s+/)[0] ?? "0";
  const n = parseFloat(first) || 0;
  return first.endsWith("%") ? (Math.min(w, h) * n) / 100 : n;
}

/** The loaded on-screen <img> when its pixels can go on an exportable canvas,
 *  otherwise a fresh CORS fetch of the same file. Null if neither works. */
async function drawableSource(img: HTMLImageElement): Promise<HTMLImageElement | null> {
  try {
    await img.decode();
  } catch {
    // Broken, or a decode() quirk — the checks below decide.
  }
  if (img.complete && img.naturalWidth > 0 && isReadable(img)) return img;

  // A copy of the file cached without CORS headers would taint the canvas and
  // make toBlob throw; fetching it again as a blob sidesteps that.
  const src = img.currentSrc || img.src;
  if (!src) return null;
  try {
    const res = await fetch(src, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    try {
      const fresh = new Image();
      fresh.src = url;
      await fresh.decode();
      return fresh;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function isReadable(img: HTMLImageElement): boolean {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d");
  if (!x) return false;
  try {
    x.drawImage(img, 0, 0, 1, 1);
    x.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

function drawPhoto(ctx: CanvasRenderingContext2D, p: PhotoLayout, source: HTMLImageElement) {
  ctx.save();
  for (const c of p.clips) {
    roundRectPath(ctx, c.box, c.radius);
    ctx.clip();
  }
  // object-fit content is clipped to the <img> box itself, too.
  ctx.beginPath();
  ctx.rect(p.box.x, p.box.y, p.box.w, p.box.h);
  ctx.clip();
  const d = fitRect(source.naturalWidth, source.naturalHeight, p.box, p.fit, p.position);
  ctx.drawImage(source, d.x, d.y, d.w, d.h);
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, b: Box, radius: number) {
  const r = Math.max(0, Math.min(radius, b.w / 2, b.h / 2));
  ctx.beginPath();
  ctx.moveTo(b.x + r, b.y);
  ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
  ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
  ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
  ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
  ctx.closePath();
}

/** The rect an image of iw×ih is drawn into for a CSS object-fit /
 *  object-position inside box (before clipping to box). */
export function fitRect(
  iw: number,
  ih: number,
  box: Box,
  fit = "cover",
  position = "50% 50%",
): Box {
  if (fit === "fill" || !iw || !ih) return { ...box };
  const contain = Math.min(box.w / iw, box.h / ih);
  const s =
    fit === "contain" ? contain
    : fit === "none" ? 1
    : fit === "scale-down" ? Math.min(1, contain)
    : Math.max(box.w / iw, box.h / ih); // cover
  const w = iw * s;
  const h = ih * s;
  const [px, py] = position.trim().split(/\s+/);
  return {
    x: box.x + offset(px, box.w - w),
    y: box.y + offset(py, box.h - h),
    w,
    h,
  };
}

function offset(v: string | undefined, free: number): number {
  if (!v || v === "center") return free / 2;
  if (v === "left" || v === "top") return 0;
  if (v === "right" || v === "bottom") return free;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return free / 2;
  return v.endsWith("%") ? (free * n) / 100 : n;
}
