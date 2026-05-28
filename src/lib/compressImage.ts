/**
 * compressImage — Session 113 (Tier 5 perf).
 *
 * Resize a source canvas down to fit within maxW × maxH (preserving aspect
 * ratio) and re-encode as a JPEG Blob at the given quality. If the source
 * is already smaller than the cap, no resize happens — only the JPEG
 * re-encode runs.
 *
 * Used by ImageCropper.tsx in place of the older
 *   toDataURL → fetch(dataURI) → blob
 * chain. Eliminates a redundant fetch round-trip, the base64-decode step,
 * and the dependency on `data:` in CSP `connect-src`.
 *
 * Defaults (1080×1440 @ 0.85) chosen for the post-image flow: portrait 3:4
 * aspect, large enough for detail on retina displays, small enough that
 * typical phone-camera output (3–5 MB) ends up <500 KB after compression.
 *
 * Throws on:
 *   - missing 2D context (extremely rare; old browsers without Canvas2D)
 *   - canvas.toBlob() returning null (browser refused to encode — quota /
 *     security / unsupported MIME)
 */
export async function compressImage(
  sourceCanvas: HTMLCanvasElement,
  maxW = 1080,
  maxH = 1440,
  quality = 0.85,
): Promise<Blob> {
  // scale > 1 means the source is already under the cap — no resize.
  // Math.min over (maxW/w, maxH/h, 1) keeps us at 1× in that case.
  const scale = Math.min(
    maxW / sourceCanvas.width,
    maxH / sourceCanvas.height,
    1,
  );

  let finalCanvas = sourceCanvas;
  if (scale < 1) {
    finalCanvas = document.createElement('canvas');
    finalCanvas.width = Math.round(sourceCanvas.width * scale);
    finalCanvas.height = Math.round(sourceCanvas.height * scale);
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('compressImage: Canvas 2D context unavailable');
    }
    // High-quality downscale — costs ~1 frame on a phone but yields clean
    // edges. Cheaper than the alternative pyramid downscale because we only
    // do one resize step and the source is already cropper-bounded.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
  }

  return new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('compressImage: toBlob returned null'));
      },
      'image/jpeg',
      quality,
    );
  });
}
