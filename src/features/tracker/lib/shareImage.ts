// src/features/tracker/lib/shareImage.ts
// Hands a rendered PNG to the OS share sheet when available (iOS/Android),
// otherwise falls back to a plain download. Preserved from the previous
// canvas-based export — mobile share is the whole point of a share card.

export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: "My progress" });
      return;
    } catch (e) {
      // User dismissed the sheet — not an error worth surfacing.
      if ((e as Error)?.name === "AbortError") return;
      // Anything else: fall through to download.
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
