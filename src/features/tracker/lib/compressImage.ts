// src/features/tracker/lib/compressImage.ts
//
// Progress photos were going into Supabase Storage at full phone resolution —
// 3–12MB each, up to 4 angles per date. Nothing in the app displays them above
// ~1000px, so that is bandwidth and storage spent on pixels nobody sees.

const MAX_EDGE = 1600;   // comfortably above the largest display size (1080px export)
const QUALITY = 0.85;
const SKIP_BELOW = 400 * 1024; // already small — re-encoding would only lose quality

export interface CompressResult {
  file: File;
  originalBytes: number;
  bytes: number;
}

/**
 * Downscale + re-encode to JPEG. Returns the original untouched if it is already
 * small, isn't an image, or if anything in the pipeline fails — compression is an
 * optimisation and must never block an upload.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const originalBytes = file.size;
  const unchanged = { file, originalBytes, bytes: originalBytes };

  if (!file.type.startsWith("image/")) return unchanged;
  if (file.size < SKIP_BELOW) return unchanged;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return unchanged;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(res, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= originalBytes) return unchanged;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return {
      file: new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }),
      originalBytes,
      bytes: blob.size,
    };
  } catch {
    return unchanged;
  }
}

/**
 * Decode respecting EXIF orientation. Phone cameras store portrait shots as
 * landscape pixels plus an orientation flag; drawing those to a canvas without
 * honouring the flag silently rotates every photo sideways.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari < 17 rejects the option — fall through to the <img> path, which
      // applies EXIF natively.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    // Revoked after decode; the bitmap data is already in memory.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;
