// PostCard.jsx — the workhorse feed card
// props: shop = { name, avatar, verified, status, statusLabel, distance, category,
//                 area, pincode, image, caption, price, following }
import React from 'react';
import StatusPill from './StatusPill';
import Button from './Button';

export default function PostCard({ shop, onChat, onFollow, onOpen }) {
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  return (
    <div className="b-tilt" onClick={onOpen} style={{
      borderRadius: 22, overflow: 'hidden', background: '#fff',
      border: '1px solid #F1ECE4', boxShadow: 'var(--b-elev-card)', cursor: 'pointer',
    }}>
      {/* head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px' }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: shop.avatar, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>
          {shop.name?.[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--b-ink)', whiteSpace: 'nowrap',
              maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</span>
            {shop.verified && (
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="6.5" cy="6.5" r="6.5" fill="#0C831F" />
                <path d="M3.5 6.6l2 2 4-4.2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <StatusPill status={shop.status} label={shop.statusLabel} />
            <span style={{ color: 'var(--b-gray-2)', fontWeight: 600, flexShrink: 0 }}>{shop.distance}</span>
            <span style={{ color: 'var(--b-gray-3)', flexShrink: 0 }}>·</span>
            <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 700, flexShrink: 0 }}>{shop.category}</span>
          </div>
        </div>
        <Button variant={shop.following ? 'green-soft' : 'green'} style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12 }}
          onClick={(e) => { e.stopPropagation(); onFollow?.(); }}>
          {shop.following ? 'Following' : 'Follow'}
        </Button>
      </div>

      {/* product image (portrait) */}
      <div style={{ aspectRatio: '4/4.4', background: shop.image, width: '100%' }} />

      {/* body */}
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* actions: Like=red, Chat=blue, Share=green, Save=ink */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={(e) => { e.stopPropagation(); setLiked(v => !v); }} style={iconBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'var(--b-red)' : 'none'} stroke="var(--b-red)" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onChat?.(); }} style={{ ...iconBtn, gap: 5 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--b-blue)" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--b-blue)' }}>Chat</span>
            </button>
            <button style={{ ...iconBtn, gap: 5 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-green)" strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--b-green)' }}>Share</span>
            </button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setSaved(v => !v); }} style={iconBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'var(--b-ink)' : 'none'} stroke="var(--b-ink)" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 14, color: 'var(--b-gray-1)', lineHeight: 1.5 }}>{shop.caption}</div>
        {shop.price && <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{shop.price}</div>}
      </div>
    </div>
  );
}

const iconBtn = { display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
