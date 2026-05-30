import type { CSSProperties } from 'react';

/* ── Session 128.3 — skeleton placeholder for the Home feed PostCard ──
   Rendered while the first page of posts is fetching. Shape mirrors PostCard
   exactly (52×52 avatar + 2 text rows + 4:5 image canvas + 28px action bar)
   so the layout doesn't jump when real content lands. Uses the .dk-skeleton
   shimmer class from index.css. */

const card: CSSProperties = {
  overflow: 'hidden',
  background: 'var(--f-bg-elev)',
  border: '1px solid var(--f-glass-border)',
  borderRadius: 22,
  boxShadow: '0 2px 12px rgba(24,16,8,0.06)',
};

const header: CSSProperties = {
  padding: '14px 14px 12px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
};

const avatar: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  flexShrink: 0,
};

const textCol: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 };
const line = (width: string | number, height = 12): CSSProperties => ({ width, height, borderRadius: 6 });

const canvas: CSSProperties = {
  width: '100%',
  aspectRatio: '4/5',
  borderRadius: 0,
};

const actionBar: CSSProperties = {
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 22,
};

const actionDot: CSSProperties = { width: 22, height: 22, borderRadius: '50%' };

export function PostCardSkeleton() {
  return (
    <div style={card} aria-hidden="true">
      <div style={header}>
        <div className="dk-skeleton" style={avatar} />
        <div style={textCol}>
          <div className="dk-skeleton" style={line('55%', 14)} />
          <div className="dk-skeleton" style={line('80%', 11)} />
          <div className="dk-skeleton" style={line('45%', 11)} />
        </div>
      </div>
      <div className="dk-skeleton" style={canvas} />
      <div style={actionBar}>
        <div className="dk-skeleton" style={actionDot} />
        <div className="dk-skeleton" style={actionDot} />
        <div className="dk-skeleton" style={actionDot} />
        <span style={{ flex: 1 }} />
        <div className="dk-skeleton" style={actionDot} />
      </div>
    </div>
  );
}
