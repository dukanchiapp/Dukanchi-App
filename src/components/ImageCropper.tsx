import { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Maximize2 } from 'lucide-react';
import { compressImage } from '../lib/compressImage';

interface ImageCropperProps {
  imageUrl: string;
  /**
   * Receives the cropped image as a JPEG Blob. Session 113 changed this
   * signature from `(dataUrl: string)` to `(blob: Blob)` to eliminate the
   * downstream `fetch(dataUri).then(r => r.blob())` step in upload call
   * sites — the cropper now goes straight from canvas to Blob via
   * compressImage(). May be sync or async (caller awaits).
   */
  onComplete: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
}

export default function ImageCropper({ imageUrl, onComplete, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'crop' | 'fit'>('crop');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState(false);

  // Target ratio 3:4
  const CANVAS_W = 300;
  const CANVAS_H = 400;

  useEffect(() => {
    setLoadError(false);
    setImg(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      setImg(image);
      // Calculate initial scale to fill the 3:4 frame (crop mode)
      const scaleW = CANVAS_W / image.width;
      const scaleH = CANVAS_H / image.height;
      const fillScale = Math.max(scaleW, scaleH);
      setScale(fillScale);
      // Center
      setOffset({
        x: (CANVAS_W - image.width * fillScale) / 2,
        y: (CANVAS_H - image.height * fillScale) / 2
      });
    };
    // Session 114 — Anti-Silent-Failure Rule B: cropper used to sit forever
    // on a failed image load (corrupted file, dead URL, etc.). onerror flips
    // a state flag so the UI shows an explicit error + Cancel button.
    image.onerror = () => {
      setLoadError(true);
    };
    image.src = imageUrl;
  }, [imageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (mode === 'fit') {
      // Black background, fit image inside maintaining aspect ratio
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const fitScale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
      const w = img.width * fitScale;
      const h = img.height * fitScale;
      const x = (CANVAS_W - w) / 2;
      const y = (CANVAS_H - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    } else {
      // Crop mode: user-controlled position
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    }
  }, [img, mode, offset, scale]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'crop') return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || mode !== 'crop') return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleZoom = (delta: number) => {
    if (!img) return;
    const newScale = Math.max(0.1, scale + delta);
    // Adjust offset to zoom from center
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    setOffset(prev => ({
      x: cx - (cx - prev.x) * (newScale / scale),
      y: cy - (cy - prev.y) * (newScale / scale)
    }));
    setScale(newScale);
  };

  const handleComplete = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Export at higher resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 600;
    exportCanvas.height = 800;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx || !img) return;

    if (mode === 'fit') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 600, 800);
      const fitScale = Math.min(600 / img.width, 800 / img.height);
      const w = img.width * fitScale;
      const h = img.height * fitScale;
      ctx.drawImage(img, (600 - w) / 2, (800 - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 600, 800);
      const exportScale = 2; // 600/300 = 2x
      ctx.drawImage(img, offset.x * exportScale, offset.y * exportScale, img.width * scale * exportScale, img.height * scale * exportScale);
    }

    // Session 113: canvas → Blob direct via compressImage. The 1080×1440 cap
    // is a no-op for the current 600×800 export, but the JPEG re-encode at
    // 0.85 (vs the previous 0.9 toDataURL) saves ~20% bytes with no visible
    // quality loss. The Blob path eliminates the downstream
    //   fetch(dataUri).then(r => r.blob())
    // step in PostsGrid call sites and removes the data: connect-src
    // dependency on the upload pipeline.
    const blob = await compressImage(exportCanvas, 1080, 1440, 0.85);
    await onComplete(blob);
  };

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex rounded-xl p-1" style={{ background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)' }}>
        <button
          onClick={() => {
            setMode('crop');
            if (img) {
              const fillScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
              setScale(fillScale);
              setOffset({
                x: (CANVAS_W - img.width * fillScale) / 2,
                y: (CANVAS_H - img.height * fillScale) / 2
              });
            }
          }}
          className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
          style={mode === 'crop'
            ? { background: 'var(--b-grad)', color: 'white', boxShadow: '0 2px 8px rgba(199,126,0,0.30)' }
            : { background: 'transparent', color: 'var(--f-text-3)' }}
        >
          <Move size={12} /> <span>Crop</span>
        </button>
        <button
          onClick={() => setMode('fit')}
          className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
          style={mode === 'fit'
            ? { background: 'var(--b-grad)', color: 'white', boxShadow: '0 2px 8px rgba(199,126,0,0.30)' }
            : { background: 'transparent', color: 'var(--f-text-3)' }}
        >
          <Maximize2 size={12} /> <span>Fit</span>
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-xl"
          style={{ border: '1px solid var(--f-glass-border-2)', background: '#0a0612', cursor: mode === 'crop' ? 'grab' : 'default', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {/* Session 114: loading overlay during image decode. Blob URLs from
            createObjectURL decode in a few ms typically, so this flashes
            briefly on fast devices but rescues UX on slow ones / large files. */}
        {!img && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: 'var(--f-text-2)', background: 'var(--f-glass-bg-3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>Image load ho rahi hai...</span>
          </div>
        )}
        {/* Session 114: explicit error state — Rule B (no silent failure on
            image.onerror). User sees a clear message + Cancel below remains
            the way out. */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-center" style={{ color: 'var(--f-danger)', background: 'rgba(255,77,106,0.14)', border: '1px solid rgba(255,77,106,0.35)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>Image load nahi ho payi — Cancel karke dobara try karein</span>
          </div>
        )}
        {mode === 'crop' && img && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur font-medium">
            Drag karein · pinch zoom
          </div>
        )}
      </div>

      {/* Zoom controls for crop mode */}
      {mode === 'crop' && (
        <div className="flex items-center justify-center space-x-3">
          <button onClick={() => handleZoom(-0.05)} className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center" style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}>−</button>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--f-text-3)' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => handleZoom(0.05)} className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center" style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}>+</button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}>
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={!img || loadError}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'var(--b-grad)', border: 'none', boxShadow: 'var(--b-elev-card)' }}
        >
          Image use karein
        </button>
      </div>
    </div>
  );
}
