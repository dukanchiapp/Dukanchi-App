import { useEffect } from 'react';

/* ── Session 128.13 — Bright Skin motion layer ─────────────────────────────
   Ports the `enhance()` helper from dukanchi-bright-skin/bright.html into a
   reusable React hook. Three behaviours, all motion-safe:

     1. `.b-tilt`            — pointer-driven 3D rotateY/rotateX on cards/tiles
     2. `.b-tap, .b-btn-grad,
        .bnav .item, .b-ripple` — tactile ripple on press
     3. `[data-count]`       — count-up animation with easeOutCubic

   Each is gated by `prefers-reduced-motion: reduce` per the bright.html
   reference — taps still get the ripple (it's a tactile signal), but tilt
   and count-up are suppressed.

   Call it once per screen mount (or once per re-render that introduces new
   marked elements). The hook is idempotent: ripple bindings store a
   `data-rp="1"` flag on the element so re-runs don't double-bind.
   ─────────────────────────────────────────────────────────────────────── */

export function useEnhance(deps: unknown[] = []) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── 3D pointer tilt ────────────────────────────────────────────────────
    const tiltCleanups: Array<() => void> = [];
    if (!reduce) {
      document.querySelectorAll<HTMLElement>('.b-tilt').forEach(el => {
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateZ(6px)`;
        };
        const onLeave = () => { el.style.transform = ''; };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        tiltCleanups.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
    }

    // ── Tactile ripple ─────────────────────────────────────────────────────
    const rippleCleanups: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>('.b-tap, .b-btn-grad, .bnav .item').forEach(el => {
      if (el.dataset.rp === '1') return;
      el.dataset.rp = '1';
      el.classList.add('b-ripple');
      const onDown = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const d = Math.max(r.width, r.height);
        const s = document.createElement('span');
        s.className = 'rp';
        s.style.width = s.style.height = d + 'px';
        s.style.left = (e.clientX - r.left - d / 2) + 'px';
        s.style.top = (e.clientY - r.top - d / 2) + 'px';
        el.appendChild(s);
        setTimeout(() => s.remove(), 600);
      };
      el.addEventListener('pointerdown', onDown);
      rippleCleanups.push(() => el.removeEventListener('pointerdown', onDown));
    });

    // ── Count-up numbers ───────────────────────────────────────────────────
    const countFrames: number[] = [];
    if (!reduce) {
      document.querySelectorAll<HTMLElement>('[data-count]').forEach(el => {
        const end = parseInt(el.dataset.count ?? '', 10);
        if (Number.isNaN(end)) return;
        let t0: number | null = null;
        const dur = 900;
        const tick = (t: number) => {
          if (t0 == null) t0 = t;
          const k = Math.min((t - t0) / dur, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString('en-IN');
          if (k < 1) countFrames.push(requestAnimationFrame(tick));
        };
        countFrames.push(requestAnimationFrame(tick));
      });
    }

    return () => {
      tiltCleanups.forEach(fn => fn());
      rippleCleanups.forEach(fn => fn());
      countFrames.forEach(id => cancelAnimationFrame(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
