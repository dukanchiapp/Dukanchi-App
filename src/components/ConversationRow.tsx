import React from 'react';
import { Conversation } from '../types';
import { FIcon } from './futuristic';

/* Futuristic v2 skin · Phase 7 / feat/futuristic-redesign.
   Glass conversation row. Prop contract + React.memo comparator preserved. */

interface Props {
  conversation: Conversation;
  onClick: (userId: string, name: string) => void;
}

const ConversationRow = React.memo(function ConversationRow({ conversation: conv, onClick }: Props) {
  return (
    <div
      onClick={() => onClick(conv.userId, conv.name)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', cursor: 'pointer',
        borderRadius: 18, background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border-2)',
        backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)',
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
      <FIcon name="chevR" size={16} color="var(--f-text-3)" />
    </div>
  );
}, (prev, next) =>
  prev.conversation.userId === next.conversation.userId &&
  prev.conversation.lastMessage === next.conversation.lastMessage &&
  prev.conversation.unread === next.conversation.unread
);

export default ConversationRow;
