import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Conversation } from '../types';

/* Futuristic v3 skin · Session 120 / feat/reskin-messages-chat.
   Glass conversation row. Prop contract + React.memo comparator preserved.
   v3: var(--f-bg-elev) surface + hover (translateX + magenta border + glow). */

interface Props {
  conversation: Conversation;
  onClick: (userId: string, name: string) => void;
}

const ConversationRow = React.memo(function ConversationRow({ conversation: conv, onClick }: Props) {
  return (
    <div
      onClick={() => onClick(conv.userId, conv.name)}
      onMouseOver={e => {
        e.currentTarget.style.transform = 'translateX(2px)';
        e.currentTarget.style.borderColor = 'rgba(255,42,140,0.35)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,42,140,0.12)';
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
          background: 'var(--f-grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(255,42,140,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{
            fontSize: 14.5, fontWeight: 700, color: 'var(--f-text-1)', letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
          }}>
            {conv.name}
          </h3>
          <span className="f-mono" style={{ fontSize: 10, color: 'var(--f-text-3)', flexShrink: 0 }}>
            {conv.timestamp}
          </span>
        </div>
        <p style={{
          fontSize: 12.5, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: conv.unread > 0 ? 'var(--f-text-1)' : 'var(--f-text-3)',
          fontWeight: conv.unread > 0 ? 600 : 400, marginBottom: 0,
        }}>
          {conv.lastMessage}
        </p>
      </div>
      <ChevronRight size={16} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
    </div>
  );
}, (prev, next) =>
  prev.conversation.userId === next.conversation.userId &&
  prev.conversation.lastMessage === next.conversation.lastMessage &&
  prev.conversation.unread === next.conversation.unread
);

export default ConversationRow;
