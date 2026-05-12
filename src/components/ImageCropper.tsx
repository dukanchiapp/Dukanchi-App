import { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Maximize2 } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onComplete: (croppedDataUrl: string) => void;
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

  // Target ratio 3:4
  const CANVAS_W = 300;
  const CANVAS_H = 400;

  useEffect(() => {
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

  const handleComplete = () => {
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

    onComplete(exportCanvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
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
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-colors ${
            mode === 'crop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Move size={12} /> <span>Crop & Adjust</span>
        </button>
        <button
          onClick={() => setMode('fit')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-colors ${
            mode === 'fit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Maximize2 size={12} /> <span>Fit (Black Bars)</span>
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-xl border-2 border-gray-200 bg-black"
          style={{ cursor: mode === 'crop' ? 'grab' : 'default', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {mode === 'crop' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur font-medium">
            Drag to adjust · Pinch to zoom
          </div>
        )}
      </div>

      {/* Zoom controls for crop mode */}
      {mode === 'crop' && (
        <div className="flex items-center justify-center space-x-3">
          <button onClick={() => handleZoom(-0.05)} className="w-8 h-8 bg-gray-100 rounded-full text-lg font-bold flex items-center justify-center hover:bg-gray-200">−</button>
          <span className="text-xs text-gray-500 font-medium">{Math.round(scale * 100)}%</span>
          <button onClick={() => handleZoom(0.05)} className="w-8 h-8 bg-gray-100 rounded-full text-lg font-bold flex items-center justify-center hover:bg-gray-200">+</button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button onClick={handleComplete} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
          Use This Image
        </button>
      </div>
    </div>
  );
}
