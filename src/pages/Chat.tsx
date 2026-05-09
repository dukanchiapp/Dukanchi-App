import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send, Paperclip, X, Loader2, AlertCircle, ShoppingBag, Tag } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';
import { apiFetch, getSocketUrl, getSocketAuthOptions } from '../lib/api';

const POST_REF_PREFIX = '__POST_REF__:';

function encodePostRef(post: { id: string; imageUrl?: string; caption?: string; price?: number | null }) {
  return POST_REF_PREFIX + JSON.stringify(post);
}

function decodePostRef(text: string) {
  try { return JSON.parse(text.slice(POST_REF_PREFIX.length)); } catch { return null; }
}

function PostRefCard({ text, onTap }: { text: string; onTap: (post: any) => void }) {
  const post = decodePostRef(text);
  if (!post) return <p className="text-xs text-gray-400 italic">[Post]</p>;
  return (
    <button
      onClick={() => onTap(post)}
      className="group relative flex items-center overflow-hidden rounded-2xl border border-white/25 bg-white/15 max-w-[230px] text-left active:scale-95 transition-transform"
    >
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" className="w-16 h-16 object-cover flex-shrink-0" />
      )}
      <div className="px-3 py-2 min-w-0 flex-1">
        <span className="inline-flex items-center space-x-1 bg-white/20 rounded-full px-2 py-0.5 mb-1">
          <Tag size={8} className="opacity-80" />
          <span className="text-[8px] font-bold uppercase tracking-widest opacity-90">Post</span>
        </span>
        {post.price && (
          <p className="text-sm font-extrabold leading-tight">₹{Number(post.price).toLocaleString()}</p>
        )}
        {post.caption && (
          <p className="text-[11px] leading-tight truncate opacity-75 mt-0.5">{post.caption}</p>
        )}
        <p className="text-[9px] opacity-50 mt-1">Tap to preview</p>
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
      <div className="absolute inset-0 bg-black/70" />

      {/* Sheet */}
      <div
        className="relative rounded-t-[2rem] overflow-hidden bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Image with price overlay */}
        <div className="relative mx-4 mt-2 rounded-2xl overflow-hidden bg-gray-100">
          {post.imageUrl
            ? <img src={post.imageUrl} alt="post" className="w-full object-cover" style={{ maxHeight: '42vh' }} />
            : <div className="w-full h-48 flex items-center justify-center">
                <ShoppingBag size={40} className="text-gray-300" />
              </div>
          }
          {post.price && (
            <div className="absolute bottom-3 left-3">
              <div className="bg-black/70 backdrop-blur-sm text-white rounded-xl px-3 py-1.5 flex items-center space-x-1.5">
                <Tag size={12} className="text-indigo-300" />
                <span className="text-base font-extrabold tracking-tight">
                  ₹{Number(post.price).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {/* Close button over image */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:bg-black/70 transition-colors"
          >
            <X size={15} className="text-white" />
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Caption</p>
            <p className="text-sm text-gray-700 leading-relaxed">{post.caption}</p>
          </div>
        )}

        <div className="h-6" />
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
    <div className="mx-4 mb-2 flex items-center space-x-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-2.5">
      {post.imageUrl && (
        <img src={post.imageUrl} alt="post" className="w-12 h-12 object-cover rounded-xl flex-shrink-0 border border-indigo-100" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Enquiring about</p>
        {post.price && <p className="text-sm font-bold text-gray-900">₹{Number(post.price).toLocaleString()}</p>}
        {post.caption && <p className="text-xs text-gray-600 truncate">{post.caption}</p>}
      </div>
      <button onClick={onDismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
        <X size={14} />
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

    socket.on('newMessage', (msg: Message) => {
      const belongs =
        (msg.senderId === currentUserId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === currentUserId);
      if (!belongs) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });

    return () => {
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

  return (
    <div className="max-w-md mx-auto bg-gray-50 h-screen flex flex-col relative">
      {previewPost && (
        <PostPreviewOverlay post={previewPost} onClose={() => setPreviewPost(null)} />
      )}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <Link to="/messages" className="p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
              {receiverLogo
                ? <img src={receiverLogo} alt="receiver logo" className="w-full h-full object-cover" />
                : receiverInitial || '?'
              }
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">{receiverName || 'Loading...'}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center my-4">
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {messages.length === 0 && !referredPost && (
          <div className="text-center py-10 text-gray-400 text-sm">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          const isPostRef = typeof msg.message === 'string' && msg.message.startsWith(POST_REF_PREFIX);

          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                isMe
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
              } ${isPostRef ? 'px-2 py-2' : ''}`}>
                {isPostRef ? (
                  <PostRefCard text={msg.message!} onTap={setPreviewPost} />
                ) : (
                  <>
                    {msg.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                        <img src={msg.imageUrl} alt="attachment" className="w-full max-h-48 object-cover" loading="lazy" />
                      </div>
                    )}
                    {msg.message && <p>{msg.message}</p>}
                  </>
                )}
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white border-t border-gray-100 pb-safe relative">
        {/* Referred post banner — shown above input until first message is sent */}
        {referredPost && (
          <ReferredPostBanner post={referredPost} onDismiss={() => setReferredPost(null)} />
        )}

        {uploadError && (
          <div className="mx-4 mb-2 flex items-center space-x-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} className="ml-auto"><X size={12} /></button>
          </div>
        )}
        {imagePreview && (
          <div className="absolute bottom-full left-0 right-0 bg-white p-3 border-t border-gray-100 flex items-center shadow-lg rounded-t-xl z-20">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
              <img src={imagePreview} className="w-full h-full object-cover" />
              <button onClick={clearImagePreview} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors" type="button">
                <X size={12} className="text-white" />
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center space-x-2 p-4">
          <label className="p-2 text-gray-400 hover:bg-gray-50 rounded-full cursor-pointer transition-colors relative">
            <Paperclip size={24} />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={referredPost ? 'Ask about this post…' : 'Type a message...'}
            className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-3 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm"
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !imageFile) || isSending}
            className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
