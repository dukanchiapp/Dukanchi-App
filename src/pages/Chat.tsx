import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Send, Paperclip, X, Tag, ShoppingCart, AlertCircle } from 'lucide-react';
import { UploadingOverlay } from '../components/ui/UploadingOverlay';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';
import { apiFetch, getSocketUrl, getSocketAuthOptions } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { Sentry } from '../lib/sentry-frontend';
import { useToast } from '../context/ToastContext';
import { playNotificationSound } from '../utils/audio';

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
        borderRadius: 14, border: '1px solid var(--f-glass-border)', background: 'var(--f-bg-elev-2)',
        cursor: 'pointer', padding: 0,
      }}
    >
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ padding: '8px 12px', minWidth: 0, flex: 1 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4,
          background: 'var(--b-grad)', borderRadius: 9999, padding: '2px 8px',
        }}>
          <Tag size={8} color="var(--b-on-grad)" />
          <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--b-on-grad)' }}>Post</span>
        </span>
        {post.price && (
          <p style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1, color: 'var(--f-text-1)', margin: 0 }}>₹{Number(post.price).toLocaleString()}</p>
        )}
        {post.caption && (
          <p style={{ fontSize: 11, lineHeight: 1.2, color: 'var(--f-text-2)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>
        )}
        <p style={{ fontSize: 9, color: 'var(--f-text-3)', margin: '4px 0 0' }}>Tap to preview</p>
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
                <ShoppingCart size={40} color="var(--f-text-4)" />
              </div>
          }
          {post.price && (
            <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 12px' }}>
                <Tag size={12} color="var(--f-magenta-light)" />
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
            <X size={15} color="#fff" />
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
      background: 'var(--b-tint)', border: '1px solid rgba(234,154,0,0.40)', borderRadius: 16,
    }}>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12, flexShrink: 0, border: '1px solid rgba(234,154,0,0.40)' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--f-orange-light)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Enquiring about</p>
        {post.price && <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>₹{Number(post.price).toLocaleString()}</p>}
        {post.caption && <p style={{ fontSize: 12, color: 'var(--f-text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>}
      </div>
      <button onClick={onDismiss} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
        <X size={14} color="var(--f-text-3)" />
      </button>
    </div>
  );
}

export default function ChatPage() {
  const { userId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentUserId = user?.id || '';
  const referredPostFromState = (location.state as any)?.referredPost ?? null;
  const userNameFromState = (location.state as any)?.userName ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Session 128.58: full-screen lightbox for chat message attachments —
  // ESC closes, body scroll locked while open. Mirror of Messages.tsx
  // queries card lightbox shipped in #227.
  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxImage(null); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxImage]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [receiverName, setReceiverName] = useState(userNameFromState);
  const [receiverInitial, setReceiverInitial] = useState(userNameFromState.charAt(0).toUpperCase());
  const [receiverLogo, setReceiverLogo] = useState('');
  // Session 128.20: receiver-store meta — surfaced in header per founder ask
  // ("the header inside the chat should show all the details of store that
  // are on the message card also it should be clickable opening the store
  // profile"). null when peer doesn't own a store (customer ↔ customer chat).
  const [receiverStore, setReceiverStore] = useState<any>(null);
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
              setReceiverStore(storeData);
              return;
            }
          } catch (err) {
            console.error('fetchReceiverStore failed:', err);
            Sentry.captureException(err, { extra: { context: 'chat.fetchReceiverStore', userId } });
          }
        }
        setReceiverName(userData.name || 'User');
        setReceiverInitial((userData.name || 'U').charAt(0));
      })
      .catch((err) => {
        setReceiverName('User'); setReceiverInitial('U');
        Sentry.captureException(err, { extra: { context: 'chat.fetchReceiverUser', userId } });
      });
  }, [userId, currentUserId]);

  // Load message history once, then switch to Socket.IO for live updates
  useEffect(() => {
    if (!currentUserId || !userId) return;

    // Session 128.20: write a view-mark so the Messages list can suppress
    // the unread bubble for this thread on next render. WhatsApp-style
    // dismiss-on-open. Re-stamped on every Chat mount.
    try { localStorage.setItem(`dk-chat-viewed:${userId}`, new Date().toISOString()); } catch { /* storage quota / SSR */ }

    apiFetch(`/api/messages/${userId}`)
      .then(res => res.ok ? res.json() : { messages: [] })
      .then(data => setMessages((Array.isArray(data) ? data : (data.messages ?? [])) as Message[]))
      .catch((err) => {
        showToast('Chat load nahi ho paya. Please refresh.', { type: 'error' });
        Sentry.captureException(err, { extra: { context: 'chat.fetchHistory', userId } });
      });

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
          .catch((err) => {
            // Background reconcile on socket reconnect — no toast (existing
            // messages still visible). Sentry-only.
            Sentry.captureException(err, { extra: { context: 'chat.reconnectRefetch', userId } });
          });
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
      
      if (msg.senderId !== currentUserId) {
        playNotificationSound();
      }
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
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      const combined = [...imageFiles, ...newFiles].slice(0, 4);
      setImageFiles(combined);
      
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImagePreviews(combined.map(f => URL.createObjectURL(f)));
      setUploadError('');
    }
  };

  const removeImage = (index: number) => {
    const updatedFiles = [...imageFiles];
    updatedFiles.splice(index, 1);
    const updatedPreviews = [...imagePreviews];
    URL.revokeObjectURL(updatedPreviews[index]);
    updatedPreviews.splice(index, 1);
    
    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
    if (fileInputRef.current && updatedFiles.length === 0) fileInputRef.current.value = '';
  };

  const clearImagePreview = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews([]);
    setImageFiles([]);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendRaw = async (body: { receiverId?: string; message?: string; imageUrl?: string; imageUrls?: string[] }) => {
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
        has_image: !!body.imageUrl || !!body.imageUrls?.length,
        has_text: !!(body.message && body.message.trim()),
      });
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Send failed:', res.status, err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && imageFiles.length === 0) || isSending) return;

    setIsSending(true);
    let uploadedImageUrls: string[] = [];

    if (imageFiles.length > 0) {
      try {
        const uploadPromises = imageFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          const res = await apiFetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            return (await res.json()).url as string;
          }
          throw new Error('Upload failed');
        });
        
        uploadedImageUrls = await Promise.all(uploadPromises);
      } catch (err) {
        setUploadError('Image upload failed. Message sent without images.');
        Sentry.captureException(err, { extra: { context: 'chat.imageUpload' } });
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
      imageUrl: uploadedImageUrls[0] || undefined,
      imageUrls: uploadedImageUrls.length > 1 ? uploadedImageUrls : [],
    });

    setNewMessage('');
    clearImagePreview();
    setIsSending(false);
  };

  const sendDisabled = (!newMessage.trim() && imageFiles.length === 0) || isSending;

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column',
      position: 'relative', backgroundColor: 'var(--f-bg-deep)', backgroundImage: 'var(--f-page-bg)',
      fontFamily: 'var(--f-font)',
    }}>
      {previewPost && (
        <PostPreviewOverlay post={previewPost} onClose={() => setPreviewPost(null)} />
      )}

      {/* ── Session 128.14 — Bright Skin Chat peer header per ChatScreen.jsx
          lines 11-24: yellow gradient + b-head sheen + chip-back chevron +
          40×40 WHITE circle avatar with magenta-ink initial + peer name +
          (status / distance / category meta below — fed by upstream data). */}
      <header
        className="b-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 14px 14px',
          background: 'var(--b-grad)',
          zIndex: 5,
        }}
      >
        <Link
          to="/messages"
          className="b-tap"
          style={{
            background: 'var(--b-chip-bg)',
            border: '1px solid var(--b-chip-line)',
            borderRadius: 11,
            width: 36,
            height: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            textDecoration: 'none',
          }}
          aria-label="Back to messages"
        >
          <ChevronLeft size={19} color="var(--b-on-grad)" strokeWidth={2.4} />
        </Link>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: 'var(--b-magenta-ink)',
            flexShrink: 0,
            overflow: 'hidden',
            fontSize: 16,
          }}
        >
          {receiverLogo
            ? <img src={receiverLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (receiverInitial || '?')}
        </div>
        {/* Session 128.20: name + meta block. When the peer is a store
            owner, the whole block becomes a Link to /store/{store.id} so
            tapping the header opens the store profile (founder ask). For
            customer ↔ customer chats it's a plain div (no nav target). */}
        {receiverStore?.id ? (
          <Link
            to={`/store/${receiverStore.id}`}
            style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
            aria-label={`Open ${receiverName} store profile`}
          >
            <div style={{ color: 'var(--b-on-grad)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {receiverName || 'Loading…'}
            </div>
            {(receiverStore.category || receiverStore.city) && (
              <div style={{ fontSize: 11, color: 'var(--b-on-grad-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {[receiverStore.category, receiverStore.city].filter(Boolean).join(' · ')}
              </div>
            )}
          </Link>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--b-on-grad)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {receiverName || 'Loading…'}
            </div>
          </div>
        )}
      </header>

      {/* ── Messages ── */}
      {/* Session 128.21: doodle BG per founder ("ye image chat ka BG").
          backgroundAttachment: 'local' keeps the pattern scrolling with the
          content (iOS Safari ignores 'fixed' on overflowing containers, so
          'local' gives the most consistent behaviour cross-platform).
          The cream `--b-surface` underlay shows through warm transparent
          regions of the JPEG so the page tone stays consistent. */}
      <main
        style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
          backgroundColor: 'var(--b-surface)',
          backgroundImage: 'url(/chat-bg-pattern.png)',
          backgroundSize: '420px auto',
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top left',
          backgroundAttachment: 'local',
        }}
      >
        {messages.length === 0 && !referredPost && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--f-text-3)', fontSize: 13 }}>
            <p style={{ margin: 0 }}>No messages yet. Say hi! 👋</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          const isPostRef = typeof msg.message === 'string' && msg.message.startsWith(POST_REF_PREFIX);
          
          let showDate = false;
          let dateStr = '';
          if (msg.createdAt) {
            const date = new Date(msg.createdAt);
            dateStr = date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            if (idx === 0) {
              showDate = true;
            } else {
              const prevDate = new Date(messages[idx - 1].createdAt || Date.now());
              const prevDateStr = prevDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
              if (dateStr !== prevDateStr) {
                showDate = true;
              }
            }
          } else if (idx === 0 || !messages[idx - 1].createdAt) {
            // fallback if no createdAt
            showDate = true;
            dateStr = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
          }

          return (
            <React.Fragment key={msg.id || idx}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '16px 0 8px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--b-gray-3)',
                      background: '#fff',
                      border: '1px solid var(--b-line)',
                      padding: '3px 12px',
                      borderRadius: 9999,
                    }}
                  >
                    {dateStr}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex', flexDirection: 'column', maxWidth: '85%',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}
              >
              <div style={{
                padding: isPostRef ? 6 : '11px 15px', fontSize: 14, lineHeight: 1.45, fontWeight: 500,
                // Session 128.13 — Bright Skin chat bubble:
                //   isMe → green bg + white text (Send=green = my voice)
                //   incoming → white card + ink text + soft warm border
                color: isMe ? '#fff' : 'var(--b-ink)',
                background: isMe ? 'var(--b-green)' : '#fff',
                border: isMe ? 'none' : '1px solid var(--b-line)',
                borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                boxShadow: isMe ? '0 2px 8px rgba(12,131,31,0.20)' : 'var(--b-elev-card)',
              }}>
                {isPostRef ? (
                  <PostRefCard text={msg.message!} onTap={setPreviewPost} />
                ) : (
                  <>
                    {(((msg as any).imageUrls && (msg as any).imageUrls.length > 0) ? (msg as any).imageUrls : (msg.imageUrl ? [msg.imageUrl] : [])).length > 0 && (
                      <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(((msg as any).imageUrls && (msg as any).imageUrls.length > 0) ? (msg as any).imageUrls : (msg.imageUrl ? [msg.imageUrl] : [])).map((url: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setLightboxImage(url)}
                            aria-label={`View attached photo ${i + 1} fullscreen`}
                            style={{ flex: '1 1 45%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 10, overflow: 'hidden', lineHeight: 0 }}
                          >
                            <img src={url} alt={`attachment ${i + 1}`} loading="lazy" style={{ width: '100%', maxHeight: 192, objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,0.15)' }} />
                          </button>
                        ))}
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
            </React.Fragment>
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
            <AlertCircle size={14} color="#FF8FA3" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <X size={12} color="#FF8FA3" />
            </button>
          </div>
        )}

        {imagePreviews.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, padding: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--f-modal-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid var(--f-glass-border)', borderBottom: '1px solid var(--f-glass-border)',
            borderRadius: '14px 14px 0 0', zIndex: 20, overflowX: 'auto',
          }}>
            {imagePreviews.map((preview, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--f-glass-border-2)', flexShrink: 0 }}>
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {isSending && <UploadingOverlay label="" size={20} radius={10} />}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  disabled={isSending}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 2, border: 'none', cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', opacity: isSending ? 0.4 : 1, zIndex: 6 }}
                >
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Session 128.14 — Composer per ChatScreen.jsx lines 45-56:
            white surface, top border, attach + input + 44×44 green circle send. */}
        <form
          onSubmit={handleSend}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: '#fff',
            borderTop: '1px solid var(--b-line)',
            flexShrink: 0,
          }}
        >
          <label
            className="b-tap"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--b-surface)',
              border: '1px solid var(--b-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Paperclip size={20} color="var(--b-gray-1)" />
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={referredPost ? 'Ask about this post…' : 'Message likhein…'}
            style={{
              flex: 1,
              padding: '11px 16px',
              background: 'var(--b-surface)',
              border: '1px solid var(--b-line)',
              borderRadius: 9999,
              color: 'var(--b-ink)',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              fontWeight: 500,
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={sendDisabled}
            className="b-tap"
            aria-label="Send message"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              flexShrink: 0,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
              opacity: sendDisabled ? 0.5 : 1,
              background: 'var(--b-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSending
              ? <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }} />
              : <Send size={17} color="#fff" fill="#fff" />}
          </button>
        </form>
      </footer>

      {/* Session 128.58: full-screen image lightbox for message attachments.
          Backdrop click + ESC + X button all close. Body scroll locked. */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            padding: 16,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            aria-label="Close photo viewer"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={24} color="#fff" />
          </button>
          <img
            src={lightboxImage}
            alt="Full view"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </div>
  );
}
