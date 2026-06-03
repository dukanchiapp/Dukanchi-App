// ChatScreen.jsx — message thread: peer header + bubbles + composer
import React from 'react';
import StatusPill from '../react-stubs/StatusPill';

export default function ChatScreen({ peer, messages = [], onSend, onBack }) {
  const [text, setText] = React.useState('');
  function send() { if (!text.trim()) return; onSend?.(text); setText(''); }
  return (
    <>
      {/* peer header */}
      <div className="b-head" style={{ background: 'var(--b-grad)', padding: '52px 14px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <button onClick={onBack} style={{ background: 'var(--b-chip-bg)', border: '1px solid var(--b-chip-line)', borderRadius: 11, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" strokeWidth="2.4"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--b-magenta-ink)', flexShrink: 0 }}>{peer?.name?.[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--b-on-grad)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{peer?.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2, fontSize: 11, color: 'var(--b-on-grad-soft)' }}>
            {peer?.status ? <StatusPill status={peer.status} label={peer.statusLabel} /> : null}
            {peer?.distance && <span>· {peer.distance}</span>}
            {peer?.category && <span>· {peer.category}</span>}
          </div>
        </div>
      </div>

      {/* messages */}
      <div className="b-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--b-surface)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: 'var(--b-gray-3)', background: '#fff', border: '1px solid var(--b-line)', borderRadius: 9999, padding: '3px 12px', margin: '4px 0' }}>Aaj</div>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.out ? 'flex-end' : 'flex-start', maxWidth: '78%',
            background: m.out ? 'var(--b-grad)' : '#fff',
            color: m.out ? 'var(--b-on-grad)' : 'var(--b-ink)',
            border: m.out ? 'none' : '1px solid var(--b-line)',
            borderRadius: m.out ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '10px 13px', fontSize: 14, lineHeight: 1.45, boxShadow: 'var(--b-elev-1)',
          }}>
            {m.text}
            <span style={{ display: 'block', fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>{m.time}</span>
          </div>
        ))}
      </div>

      {/* composer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderTop: '1px solid var(--b-line)', flexShrink: 0 }}>
        <button style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--b-surface)', border: '1px solid var(--b-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-gray-1)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message likhein…"
          style={{ flex: 1, border: '1px solid var(--b-line)', borderRadius: 9999, padding: '11px 16px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--b-surface)' }} />
        {/* Send = green (positive action) */}
        <button onClick={send} className="b-tap" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--b-green)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </>
  );
}
