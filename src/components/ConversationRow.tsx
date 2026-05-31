import React from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { Conversation } from '../types';
import { getStoreStatus } from '../lib/storeUtils';
import { getLiveStatus } from '../lib/liveStatus';
import { useClosingSoon } from '../hooks/useClosingSoon';

/* Futuristic v3 skin · Session 120 / feat/reskin-messages-chat.
   Glass conversation row. Prop contract + React.memo comparator preserved.
   v3: var(--f-bg-elev) surface + hover (translateX + magenta border + glow).

   Session 126: rich store rows — when the other party owns a store
   (conv.store present) the row shows a live-status capsule + distance +
   category + area line, matching the design mockup. Plain user↔user chats
   keep the original compact layout (name + timestamp inline, last message). */

interface Props {
  conversation: Conversation;
  onClick: (userId: string, name: string) => void;
  /** Precomputed "1.2 km" / "300 m" string (Messages page owns user location). */
  distance?: string | null;
}

const ConversationRow = React.memo(function ConversationRow({ conversation: conv, onClick, distance }: Props) {
  const store = conv.store ?? null;
  // Hooks must run unconditionally — getStoreStatus(undefined…) → null when the
  // party has no store, so useClosingSoon(null) just no-ops (no timer).
  const status = getStoreStatus(
    store?.openingTime ?? undefined,
    store?.closingTime ?? undefined,
    store?.is24Hours ?? undefined,
    store?.workingDays ?? undefined,
  );
  const closingSoon = useClosingSoon(status?.minutesUntilClose ?? null);
  const live = store ? getLiveStatus({ closingSoon, status: status?.label ?? null }) : null;

  return (
    <div
      onClick={() => onClick(conv.userId, conv.name)}
      onMouseOver={e => {
        e.currentTarget.style.transform = 'translateX(2px)';
        e.currentTarget.style.borderColor = 'rgba(199,126,0,0.35)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(199,126,0,0.12)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.borderColor = 'var(--f-glass-border-2)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.30)';
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer',
        borderRadius: 18, background: 'var(--f-bg-elev)', border: '1px solid var(--f-glass-border-2)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.30)',
        transition: 'transform 200ms var(--f-ease), border-color 200ms, box-shadow 200ms',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, overflow: 'hidden',
          background: 'var(--b-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(199,126,0,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
        }}>
          {conv.logoUrl ? (
            <img src={conv.logoUrl} alt="logo" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{conv.name?.charAt(0)}</span>
          )}
        </div>
        {conv.unread > 0 && (
          <div style={{
            position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9999, background: 'var(--f-danger)', border: '2px solid var(--f-bg-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
            color: 'white', boxShadow: '0 0 10px rgba(255,77,106,0.6)',
          }}>
            {conv.unread}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name — timestamp sits inline only on plain rows (store rows move it
            down to the last-message line, matching the mockup). */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{
            fontSize: 14.5, fontWeight: 700, color: 'var(--f-text-1)', letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
          }}>
            {conv.name}
          </h3>
          {!store && (
            <span className="f-mono" style={{ fontSize: 10, color: 'var(--f-text-3)', flexShrink: 0 }}>
              {conv.timestamp}
            </span>
          )}
        </div>

        {/* Store meta — live status capsule + distance + category */}
        {store && (live || distance || store.category) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginTop: 4,
            fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            {live && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 9999,
                color: live.color, background: live.color + '1A', border: `1px solid ${live.color}40`,
                fontWeight: 700, flexShrink: 0, lineHeight: 1.2,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: live.color }} />
                {live.label}
              </span>
            )}
            {distance && <span style={{ color: 'var(--f-text-3)', fontWeight: 600, flexShrink: 0 }}>{distance}</span>}
            {store.category && (
              <>
                <span style={{ color: 'var(--f-text-4)', flexShrink: 0 }}>·</span>
                <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {store.category}
                </span>
              </>
            )}
          </div>
        )}

        {/* Area line */}
        {store?.city && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, marginTop: 3,
            fontSize: 10.5, color: 'var(--f-text-3)', whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            <MapPin size={10} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.city}</span>
          </div>
        )}

        {/* Last message (+ timestamp on this line for store rows) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: store ? 4 : 3 }}>
          <p style={{
            fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: conv.unread > 0 ? 'var(--f-text-1)' : 'var(--f-text-3)',
            fontWeight: conv.unread > 0 ? 600 : 400, margin: 0,
          }}>
            {conv.lastMessage}
          </p>
          {store && (
            <span className="f-mono" style={{ fontSize: 10, color: 'var(--f-text-3)', flexShrink: 0 }}>
              {conv.timestamp}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
    </div>
  );
}, (prev, next) =>
  prev.conversation.userId === next.conversation.userId &&
  prev.conversation.lastMessage === next.conversation.lastMessage &&
  prev.conversation.unread === next.conversation.unread &&
  prev.distance === next.distance
);

export default ConversationRow;
