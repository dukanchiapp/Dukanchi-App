import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';
import { apiFetch, getSocketUrl, getSocketAuthOptions } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { FIcon } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 6 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. Socket.IO connection,
   message history fetch, reconnection-aware refetch, image upload, and the
   post-reference enquiry flow are all preserved verbatim. */

const POST_REF_PREFIX = '__POST_REF__:';

function encodePostRef(post: { id: string; imageUrl?: string; caption?: string; price?: number | null }) {
  return POST_REF_PREFIX + JSON.stringify(post);
}

function decodePostRef(text: string) {
  try { return JSON.parse(text.slice(POST_REF_PREFIX.length)); } catch { return null; }
}

function PostRefCard({ text, onTap }: { text: string; onTap: (post: any) => void }) {
  const post = decodePostRef(text);
  if (!post) return <p style={{ fontSize: 11, color: 'var(--f-text-3)', fontStyle: 'italic', margin: 0 }}>[Post]</p>;
  return (
    <button
      onClick={() => onTap(post)}
      style={{
        display: 'flex', alignItems: 'center', overflow: 'hidden', maxWidth: 230, textAlign: 'left',
        borderRadius: 14, border: '1px solid var(--f-glass-border-2)', background: 'rgba(0,0,0,0.28)',
        cursor: 'pointer', padding: 0,
      }}
    >
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ padding: '8px 12px', minWidth: 0, flex: 1 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4,
          background: 'var(--f-grad-primary)', borderRadius: 9999, padding: '2px 8px',
        }}>
          <FIcon name="tag" size={8} color="white" />
          <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'white' }}>Post</span>
        </span>
        {post.price && (
          <p style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1, color: '#fff', margin: 0 }}>₹{Number(post.price).toLocaleString()}</p>
        )}
        {post.caption && (
          <p style={{ fontSize: 11, lineHeight: 1.2, color: 'rgba(255,255,255,0.78)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>
        )}
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>Tap to preview</p>
      </div>
    </button>
  );
}

function PostPreviewOverlay({ post, onClose }: {
  post: { id: string; imageUrl?: string; caption?: string; price?: number | null };
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', borderRadius: '28px 28px 0 0', overflow: 'hidden',
          background: 'var(--f-modal-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderTop: '1px solid var(--f-glass-border)', boxShadow: '0 -16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--f-text-4)' }} />
        </div>

        {/* Image with price overlay */}
        <div style={{ position: 'relative', margin: '8px 16px 0', borderRadius: 16, overflow: 'hidden', background: 'var(--f-bg-elev)' }}>
          {post.imageUrl
            ? <img src={post.imageUrl} alt="post" style={{ width: '100%', objectFit: 'cover', maxHeight: '42vh', display: 'block' }} />
            : <div style={{ width: '100%', height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FIcon name="cart" size={40} color="var(--f-text-4)" />
              </div>
          }
          {post.price && (
            <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 12px' }}>
                <FIcon name="tag" size={12} color="var(--f-magenta-light)" />
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>
                  ₹{Number(post.price).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {/* Close button over image */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FIcon name="x" size={15} color="#fff" />
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <div style={{ padding: '16px 20px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--f-magenta-light)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>Caption</p>
            <p style={{ fontSize: 14, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>{post.caption}</p>
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

// Pinned banner shown to customer while typing their first message
function ReferredPostBanner({ post, onDismiss }: {
  post: { id: string; imageUrl?: string; caption?: string; price?: number | null };
  onDismiss: () => void;
}) {
  return (
    <div style={{
      margin: '0 14px 8px', display: 'flex', alignItems: 'center', gap: 12, padding: 10,
      background: 'rgba(255,107,53,0.10)', border: '1px solid rgba(255,107,53,0.28)', borderRadius: 16,
    }}>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12, flexShrink: 0, border: '1px solid rgba(255,107,53,0.30)' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--f-orange-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Enquiring about</p>
        {post.price && <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>₹{Number(post.price).toLocaleString()}</p>}
        {post.caption && <p style={{ fontSize: 12, color: 'var(--f-text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>}
      </div>
      <button onClick={onDismiss} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
        <FIcon name="x" size={14} color="var(--f-text-3)" />
      </button>
    </div>
  );
}

export default function ChatPage() {
  const { userId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const referredPostFromState = (location.state as any)?.referredPost ?? null;
  const userNameFromState = (location.state as any)?.userName ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [receiverName, setReceiverName] = useState(userNameFromState);
  const [receiverInitial, setReceiverInitial] = useState(userNameFromState.charAt(0).toUpperCase());
  const [receiverLogo, setReceiverLogo] = useState('');
  // Referred post stays visible until first message is sent (then it becomes part of history)
  const [referredPost, setReferredPost] = useState<typeof referredPostFromState>(referredPostFromState);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reopenCountRef = useRef(0);

  // Fetch receiver info once
  useEffect(() => {
    if (!userId || !currentUserId) return;
    apiFetch(`/api/users/${userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(async (userData) => {
        if (!userData) return;
        if (['retailer', 'supplier', 'brand', 'manufacturer'].includes(userData.role)) {
          try {
            const storeRes = await apiFetch(`/api/users/${userId}/store`);
            const storeData = await storeRes.json();
            if (storeData?.storeName) {
              setReceiverName(storeData.storeName);
              setReceiverInitial(storeData.storeName.charAt(0));
              setReceiverLogo(storeData.logoUrl || '');
              return;
            }
          } catch (err) {
            console.error('fetchReceiverStore failed:', err);
          }
        }
        setReceiverName(userData.name || 'User');
        setReceiverInitial((userData.name || 'U').charAt(0));
      })
      .catch(() => { setReceiverName('User'); setReceiverInitial('U'); });
  }, [userId, currentUserId]);

  // Load message history once, then switch to Socket.IO for live updates
  useEffect(() => {
    if (!currentUserId || !userId) return;

    apiFetch(`/api/messages/${userId}`)
      .then(res => res.ok ? res.json() : { messages: [] })
      .then(data => setMessages((Array.isArray(data) ? data : (data.messages ?? [])) as Message[]))
      .catch(() => {});

    const socket = io(getSocketUrl(), getSocketAuthOptions());
    socketRef.current = socket;
    reopenCountRef.current = 0;

    const isDev = import.meta.env.DEV;
    socket.on('connect', () => {
      if (isDev) console.log('[SOCKET][Chat] connected', socket.id);
    });
    socket.on('connect_error', (err) => {
      console.warn('[SOCKET][Chat] connect_error:', err.message);
    });
    socket.on('disconnect', (reason) => {
      if (isDev) console.warn('[SOCKET][Chat] disconnect', reason);
    });

    // Reconnection-aware refetch: on transport re-open after a gap, refetch full thread
    // to recover any messages missed while the tab was backgrounded.
    const handleReopen = () => {
      reopenCountRef.current += 1;
      if (reopenCountRef.current > 1) {
        apiFetch(`/api/messages/${userId}`)
          .then(res => res.ok ? res.json() : { messages: [] })
          .then(data => {
            const fresh = (Array.isArray(data) ? data : (data.messages ?? [])) as Message[];
            setMessages(fresh);
          })
          .catch(() => {});
      }
    };
    socket.io.on('reconnect', handleReopen);
    socket.io.engine?.on('open', handleReopen);

    socket.on('newMessage', (msg: Message) => {
      const belongs =
        (msg.senderId === currentUserId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === currentUserId);
      if (!belongs) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });

    // Mobile foreground wakeup: ensure socket reconnects when tab becomes visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      socket.io.off('reconnect', handleReopen);
      socket.io.engine?.off('open', handleReopen);
      document.removeEventListener('visibilitychange', onVisibility);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(file));
      setUploadError('');
    }
  };

  const clearImagePreview = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
    setImageFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendRaw = async (body: { receiverId?: string; message?: string; imageUrl?: string }) => {
    const res = await apiFetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved: Message = await res.json();
      const msg: Message = { ...saved, senderId: saved.senderId || currentUserId };
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      // PostHog: chat_message_sent — metrics only (no message text), with
      // boolean flags for the two non-text fields callers can populate.
      captureEvent('chat_message_sent', {
        has_image: !!body.imageUrl,
        has_text: !!(body.message && body.message.trim()),
      });
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Send failed:', res.status, err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || isSending) return;

    setIsSending(true);
    let uploadedImageUrl: string | undefined;

    if (imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      try {
        const res = await apiFetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          uploadedImageUrl = (await res.json()).url;
        } else {
          setUploadError('Image upload failed. Message sent without image.');
        }
      } catch {
        setUploadError('Image upload failed. Message sent without image.');
      }
    }

    // If user came from a post (banner is showing), send the post reference first
    // so the retailer sees which post triggered this enquiry — regardless of prior history
    if (referredPost) {
      await sendRaw({ receiverId: userId, message: encodePostRef(referredPost) });
      setReferredPost(null); // banner no longer needed; it's now in chat history
    }

    await sendRaw({
      receiverId: userId,
      message: newMessage || undefined,
      imageUrl: uploadedImageUrl || undefined,
    });

    setNewMessage('');
    clearImagePreview();
    setIsSending(false);
  };

  const sendDisabled = (!newMessage.trim() && !imageFile) || isSending;

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column',
      position: 'relative', backgroundColor: 'var(--f-bg-deep)', backgroundImage: 'var(--f-page-bg)',
      fontFamily: 'var(--f-font)',
    }}>
      {previewPost && (
        <PostPreviewOverlay post={previewPost} onClose={() => setPreviewPost(null)} />
      )}

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px', zIndex: 5,
        background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--f-glass-border)',
      }}>
        <Link
          to="/messages"
          className="f-glass"
          style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
          aria-label="Back to messages"
        >
          <FIcon name="chevL" size={20} color="var(--f-text-1)" />
        </Link>
        <div className="f-glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 16, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
            background: 'var(--f-grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 14, boxShadow: '0 0 14px rgba(255,42,140,0.45)',
          }}>
            {receiverLogo
              ? <img src={receiverLogo} alt="receiver logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (receiverInitial || '?')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {receiverName || 'Loading...'}
            </div>
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
            background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)', padding: '4px 12px', borderRadius: 9999,
          }}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {messages.length === 0 && !referredPost && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--f-text-3)', fontSize: 13 }}>
            <p style={{ margin: 0 }}>No messages yet. Say hi! 👋</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          const isPostRef = typeof msg.message === 'string' && msg.message.startsWith(POST_REF_PREFIX);

          return (
            <div
              key={msg.id || idx}
              style={{
                display: 'flex', flexDirection: 'column', maxWidth: '85%',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                alignSelf: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                padding: isPostRef ? 6 : '10px 14px', fontSize: 13.5, lineHeight: 1.4,
                color: isMe ? '#fff' : 'var(--f-text-1)',
                background: isMe ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-3)',
                border: isMe ? 'none' : '1px solid var(--f-glass-border)',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                boxShadow: isMe ? '0 0 18px rgba(255,42,140,0.28)' : 'none',
                backdropFilter: isMe ? 'none' : 'blur(20px)',
                WebkitBackdropFilter: isMe ? 'none' : 'blur(20px)',
              }}>
                {isPostRef ? (
                  <PostRefCard text={msg.message!} onTap={setPreviewPost} />
                ) : (
                  <>
                    {msg.imageUrl && (
                      <div style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <img src={msg.imageUrl} alt="attachment" loading="lazy" style={{ width: '100%', maxHeight: 192, objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}
                    {msg.message && <p style={{ margin: 0 }}>{msg.message}</p>}
                  </>
                )}
              </div>
              <span className="f-mono" style={{ fontSize: 9, color: 'var(--f-text-4)', marginTop: 3, padding: '0 4px' }}>
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* ── Composer ── */}
      <footer
        className="pb-safe"
        style={{
          position: 'relative', background: 'var(--f-sticky-bg)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--f-glass-border)',
        }}
      >
        {/* Referred post banner — shown above input until first message is sent */}
        {referredPost && (
          <ReferredPostBanner post={referredPost} onDismiss={() => setReferredPost(null)} />
        )}

        {uploadError && (
          <div style={{
            margin: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.35)', borderRadius: 12,
            fontSize: 12, color: '#FF8FA3',
          }}>
            <FIcon name="alert" size={14} color="#FF8FA3" />
            <span style={{ flex: 1 }}>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <FIcon name="x" size={12} color="#FF8FA3" />
            </button>
          </div>
        )}

        {imagePreview && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, padding: 12, display: 'flex', alignItems: 'center',
            background: 'var(--f-modal-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid var(--f-glass-border)', borderBottom: '1px solid var(--f-glass-border)',
            borderRadius: '14px 14px 0 0', zIndex: 20,
          }}>
            <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--f-glass-border-2)' }}>
              <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={clearImagePreview}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 2, border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <FIcon name="x" size={12} color="#fff" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12 }}>
          <label className="f-glass" style={{ width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <FIcon name="paperclip" size={20} color="var(--f-text-2)" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={referredPost ? 'Ask about this post…' : 'Type a message...'}
            style={{
              flex: 1, padding: '12px 16px', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
              borderRadius: 9999, color: 'var(--f-text-1)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={sendDisabled}
            style={{
              width: 42, height: 42, borderRadius: 14, border: 'none', flexShrink: 0,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
              opacity: sendDisabled ? 0.5 : 1,
              background: 'var(--f-grad-primary)', boxShadow: '0 0 16px rgba(255,42,140,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isSending
              ? <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }} />
              : <FIcon name="send" size={16} color="#fff" fill="#fff" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
