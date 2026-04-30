import React from 'react';
import { Conversation } from '../types';

interface Props {
  conversation: Conversation;
  onClick: (userId: string, name: string) => void;
}

const ConversationRow = React.memo(function ConversationRow({ conversation: conv, onClick }: Props) {
  return (
    <div
      onClick={() => onClick(conv.userId, conv.name)}
      className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer"
      style={{ border: '0.5px solid var(--dk-border)' }}
    >
      <div className="relative flex-shrink-0">
        <div
          className="overflow-hidden"
          style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--dk-surface)' }}
        >
          {conv.logoUrl ? (
            <img src={conv.logoUrl} className="w-full h-full object-cover" alt="logo" loading="lazy" decoding="async" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-bold text-lg"
              style={{ color: 'var(--dk-accent)' }}
            >
              {conv.name?.charAt(0)}
            </div>
          )}
        </div>
        {conv.unread > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
            {conv.unread}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h3
            className="font-semibold truncate"
            style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}
          >
            {conv.name}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', flexShrink: 0, marginLeft: 8 }}>
            {conv.timestamp}
          </span>
        </div>
        <p
          className="truncate mt-0.5"
          style={{
            fontSize: 12,
            color: conv.unread > 0 ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)',
            fontWeight: conv.unread > 0 ? 600 : 400,
          }}
        >
          {conv.lastMessage}
        </p>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.conversation.userId === next.conversation.userId &&
  prev.conversation.lastMessage === next.conversation.lastMessage &&
  prev.conversation.unread === next.conversation.unread
);

export default ConversationRow;
