/**
 * VoiceWaveform — canvas-driven gradient waveform for voice search / AI.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 *
 * Bars animate continuously; `active` controls amplitude (mic-active look).
 */
import { useEffect, useRef } from 'react';

interface VoiceWaveformProps {
  active?: boolean;
  bars?: number;
  height?: number;
}

export function VoiceWaveform({
  active = true,
  bars = 32,
  height = 56,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number>(0);
  const phases = useRef<number[]>(
    Array.from({ length: bars }, () => Math.random() * Math.PI * 2),
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const gap = 3;
      const barW = (w - gap * (bars - 1)) / bars;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#FF6B35');
      grad.addColorStop(0.5, '#FF2A8C');
      grad.addColorStop(1, '#00E5FF');
      ctx.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        const phase = phases.current[i];
        const center = (i - bars / 2) / (bars / 2);
        const envelope = active ? Math.cos(center * 1.1) * 0.9 + 0.2 : 0.1;
        const amp = active
          ? (Math.sin(t * 0.004 + phase) * 0.5 + 0.6) * envelope
          : 0.08 + Math.sin(t * 0.002 + phase) * 0.04;
        const bh = Math.max(2, amp * h * 0.95);
        const x = i * (barW + gap);
        const y = (h - bh) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, barW / 2);
        ctx.fill();
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, bars]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />
  );
}
