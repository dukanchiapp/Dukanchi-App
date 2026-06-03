// StoreProfile.jsx — storefront: banner + DP + info + stats + actions + posts/reviews tabs
import React from 'react';
import StatusPill from '../react-stubs/StatusPill';
import Button from '../react-stubs/Button';

export default function StoreProfile({ store, isOwner = false, onChat, onFollow, onBack, onDirections }) {
  const [tab, setTab] = React.useState('posts');
  const [expanded, setExpanded] = React.useState(false);
  const s = store || {};
  return (
    <div className="b-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--b-surface)' }}>
      {/* banner */}
      <div className="b-head" style={{ position: 'relative', aspectRatio: '16/8.5', background: s.banner || 'var(--b-grad)' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 50, left: 14, background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: 11, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ position: 'absolute', top: 50, right: 14, display: 'flex', gap: 8, zIndex: 2 }}>
          {[['bell', 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'], ['gear', '']].map(([k]) => (
            <button key={k} style={{ background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: 11, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {k === 'bell'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* DP overlaps banner */}
        <div style={{ marginTop: -40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ width: 86, height: 86, borderRadius: '50%', background: s.dp || 'var(--b-grad)', border: '4px solid var(--b-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 32, fontFamily: 'var(--b-display)' }}>{s.name?.[0] || 'S'}</div>
        </div>

        {/* name + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--b-display)', letterSpacing: '-0.02em' }}>{s.name || 'Sharma Electronics'}</h1>
          {s.rating && <span className="b-rating">★ {s.rating}</span>}
          {s.role && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--b-magenta-ink)', background: 'var(--b-tint)', borderRadius: 6, padding: '2px 7px', letterSpacing: 0.5 }}>{s.role}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 12 }}>
          <StatusPill status={s.status || 'open'} label={s.statusLabel || 'Open till 10pm'} />
          <span style={{ color: 'var(--b-gray-2)', fontWeight: 600 }}>{s.distance || '1.6 km'}</span>
          <span style={{ color: 'var(--b-gray-3)' }}>·</span>
          <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 700 }}>{s.category || 'Electronics'}</span>
        </div>

        {/* bio (read-more, max 3 lines) */}
        <p style={{ fontSize: 14, color: 'var(--b-gray-1)', lineHeight: 1.55, marginTop: 10,
          ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
          {s.bio || 'Sharma Electronics mein aapka swagat hai. Latest gadgets, best prices, aur full warranty ke saath. Aaj hi visit karein!'}
        </p>
        <span onClick={() => setExpanded(v => !v)} className="b-tap" style={{ color: 'var(--b-magenta-ink)', fontSize: 12.5, fontWeight: 700, display: 'inline-block', whiteSpace: 'nowrap', cursor: 'pointer' }}>{expanded ? 'Read less' : 'Read more'}</span>

        {/* info card */}
        <div style={{ marginTop: 14, borderRadius: 16, background: '#fff', border: '1px solid #F1ECE4', boxShadow: 'var(--b-elev-1)', padding: 14 }}>
          {[['📍', s.address || 'Shop 12, BKC Road, Bandra East · 400051'], ['📞', s.phone || '+91 98200 12345'], ['🕒', s.hours || 'Today: 9:00 AM – 10:00 PM']].map(([ic, val]) => (
            <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5, color: 'var(--b-gray-1)' }}>
              <span style={{ fontSize: 16 }}>{ic}</span><span>{val}</span>
            </div>
          ))}
          {/* Directions = blue (navigation) */}
          <Button variant="blue" onClick={onDirections} style={{ width: '100%', marginTop: 10, padding: 13 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
            Direction to Store
          </Button>
        </div>

        {/* stats */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {[[s.followers ?? 1284, 'Followers'], [s.posts ?? 47, 'Posts'], [s.reviews ?? 312, 'Reviews']].map(([v, l]) => (
            <div key={l} style={{ flex: 1, padding: '15px 8px', borderRadius: 16, background: '#fff', border: '1px solid #F1ECE4', boxShadow: 'var(--b-elev-1)', textAlign: 'center' }}>
              <div data-count={v} style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--b-display)' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--b-gray-2)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 5, fontWeight: 700 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, margin: '14px 0 16px' }}>
          {isOwner ? (
            <>
              <Button variant="out" style={{ flex: 1, padding: 14 }}>Edit Profile</Button>
              <Button variant="grad" style={{ flex: 1, padding: 14 }}>New Post</Button>
            </>
          ) : (
            <>
              {/* Follow = green (positive), Chat = blue (communication) */}
              <Button variant="green-soft" onClick={onFollow} style={{ flex: 1, padding: 14 }}>Follow</Button>
              <Button variant="blue" onClick={onChat} style={{ flex: 1, padding: 14 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Chat
              </Button>
            </>
          )}
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--b-line)' }}>
          {['posts', 'reviews'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 700, textTransform: 'capitalize',
              color: tab === t ? 'var(--b-ink)' : 'var(--b-gray-3)',
              borderBottom: tab === t ? '2.5px solid var(--b-orange)' : '2.5px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        {/* posts grid (3-col thumbnails) */}
        {tab === 'posts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: '4px 0 24px' }}>
            {(s.thumbs || Array.from({ length: 9 })).map((t, i) => (
              <div key={i} style={{ aspectRatio: '1', background: t || `linear-gradient(135deg,#E8F0FE,#FFF1EA)`, borderRadius: 4 }} />
            ))}
          </div>
        )}
        {tab === 'reviews' && (
          <div style={{ padding: '16px 0 24px', color: 'var(--b-gray-2)', fontSize: 14, textAlign: 'center' }}>Reviews yahan dikhenge.</div>
        )}
      </div>
    </div>
  );
}
