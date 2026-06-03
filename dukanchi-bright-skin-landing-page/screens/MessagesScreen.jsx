// MessagesScreen.jsx — chat list: conversation rows (avatar + name + last msg + time + unread)
// Shop conversations are richer: they show live status + distance + category + area.
import React from 'react';
import StatusPill from '../react-stubs/StatusPill';

export default function MessagesScreen({ conversations = [], onOpen }) {
  return (
    <>
      <div className="b-head" style={{ background: 'var(--b-grad)', padding: '52px 16px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--b-display)', color: 'var(--b-on-grad)', letterSpacing: '-0.03em' }}>Messages</h1>
      </div>

      <div className="b-scroll b-stagger" style={{ flex: 1, overflowY: 'auto', background: 'var(--b-surface)' }}>
        {conversations.map(c => (
          <button key={c.id} onClick={() => onOpen?.(c)} className="b-tap" style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
            background: 'none', border: 'none', borderBottom: '1px solid var(--b-line)', cursor: 'pointer', textAlign: 'left',
          }}>
            {/* avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: c.avatar || 'var(--b-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20 }}>{c.name?.[0]}</div>
              {c.isShop && c.status && (
                <span style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--b-surface)',
                  background: c.status === 'open' ? 'var(--b-green)' : c.status === 'closed' ? 'var(--b-red)' : 'var(--b-amber)' }} />
              )}
            </div>

            {/* text block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--b-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: 'var(--b-gray-3)', fontWeight: 600, flexShrink: 0 }}>{c.time}</span>
              </div>

              {/* richer meta row for shops */}
              {c.isShop && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <StatusPill status={c.status} label={c.statusLabel} />
                  <span style={{ color: 'var(--b-gray-2)', fontWeight: 600, flexShrink: 0 }}>{c.distance}</span>
                  <span style={{ color: 'var(--b-gray-3)', flexShrink: 0 }}>·</span>
                  <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 700, flexShrink: 0 }}>{c.category}</span>
                  {c.area && <><span style={{ color: 'var(--b-gray-3)', flexShrink: 0 }}>·</span><span style={{ color: 'var(--b-gray-2)', flexShrink: 0 }}>{c.area}</span></>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: c.unread ? 'var(--b-ink)' : 'var(--b-gray-2)', fontWeight: c.unread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastMessage}</span>
                {c.unread > 0 && (
                  <span style={{ flexShrink: 0, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 9999, background: 'var(--b-grad)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// Sample conversation shape:
// { id, name, avatar, isShop: true, status: 'open', statusLabel: 'Open till 10pm',
//   distance: '1.6 km', category: 'Electronics', area: 'BKC',
//   lastMessage: 'Haan bhai, stock mein hai', time: '2:14 PM', unread: 2 }
