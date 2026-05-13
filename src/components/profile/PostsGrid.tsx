import React, { useState, useRef } from 'react';
import {
  Grid, Plus, ArrowLeft, Heart, Share2, Bookmark, Pencil,
  Pin, Trash2, X, ImageIcon as ImageIconLucide, DollarSign,
  Sparkles, Mic, MicOff,
} from 'lucide-react';
import ImageCropper from '../ImageCropper';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';
import { captureEvent } from '../../lib/posthog';

interface PostsGridProps {
  sortedPosts: any[];
  store: any;
  storeId: string;
  token: string | null;
  interactions: { likedPostIds: string[]; savedPostIds: string[]; followedStoreIds: string[] };
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onShare: (post: any) => void;
  getLikeCount: (post: any) => number;
  onPostsChange: (updater: (prev: any[]) => any[]) => void;
}

export function PostsGrid({
  sortedPosts, store, storeId, token,
  interactions, onToggleLike, onToggleSave, onShare, getLikeCount,
  onPostsChange,
}: PostsGridProps) {
  const { showToast } = useToast();

  // ── Post view / manage state ────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  // ── New post state ──────────────────────────────────────────────────────────
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostPrice, setNewPostPrice] = useState('');
  const [newPostUploading, setNewPostUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageUrl, setRawImageUrl] = useState('');

  // ── AI / voice state ────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ productName: string; category: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Edit post state ─────────────────────────────────────────────────────────
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const [editShowCropper, setEditShowCropper] = useState(false);
  const [editRawImageUrl, setEditRawImageUrl] = useState('');

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleTogglePin = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/posts/${postId}/pin`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        onPostsChange(prev => prev.map(p => p.id === postId ? updated : p));
      } else {
        const err = await res.json();
        showToast(err.error || 'Maximum 3 pinned posts allowed.', { type: 'error' });
      }
    } catch { /* silent */ }
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      const res = await apiFetch(`/api/posts/${postToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onPostsChange(prev => prev.filter(p => p.id !== postToDelete));
      if (selectedPost?.id === postToDelete) setSelectedPost(null);
    } catch {
      showToast('Failed to delete post', { type: 'error' });
    } finally {
      setPostToDelete(null);
    }
  };

  const openEditModal = (post: any) => {
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditPrice(post.price ? String(post.price) : (post.product?.price ? String(post.product.price) : ''));
    setEditImage(post.imageUrl || '');
    setEditShowCropper(false);
    setEditRawImageUrl('');
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setEditRawImageUrl(data.url);
        setEditShowCropper(true);
      }
    } catch { /* silent */ }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setEditUploading(true);
    try {
      const res = await apiFetch(`/api/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption: editCaption, imageUrl: editImage, price: editPrice || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onPostsChange(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (selectedPost?.id === updated.id) setSelectedPost(updated);
        setEditingPost(null);
        showToast('Post updated', { type: 'success' });
      } else {
        showToast('Failed to update post', { type: 'error' });
      }
    } catch {
      showToast('Failed to update post', { type: 'error' });
    }
    setEditUploading(false);
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setRawImageUrl(data.url);
        setShowCropper(true);
      }
    } catch { /* silent */ }
  };

  const compressImageToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  };

  const handleAiMagic = async () => {
    if (!newPostImage) return;
    setAiLoading(true); setAiSuggestion(null);
    try {
      const { base64, mimeType } = await compressImageToBase64(newPostImage);
      const res = await apiFetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (data.caption) setNewPostCaption(data.caption);
      if (data.suggestedPrice) setNewPostPrice(String(data.suggestedPrice));
      if (data.productName || data.category) setAiSuggestion({ productName: data.productName || '', category: data.category || '' });
      // PostHog: ai_feature_used (photo→post). Only success path.
      captureEvent('ai_feature_used', { feature: 'photo_to_post', has_caption: !!data.caption });
    } catch {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
    } finally {
      setAiLoading(false);
    }
  };

  const processVoice = async (blob: Blob) => {
    setAiLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await apiFetch('/api/ai/transcribe-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (data.caption) setNewPostCaption(data.caption);
      if (data.price) setNewPostPrice(String(data.price));
      if (data.productName || data.category) setAiSuggestion({ productName: data.productName || '', category: data.category || '' });
      // PostHog: ai_feature_used (voice→post). Only success path.
      captureEvent('ai_feature_used', { feature: 'voice_to_post', has_caption: !!data.caption });
      showToast('Voice se capture hua — check karo', { type: 'success' });
    } catch {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
    } finally {
      setAiLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0); setIsRecording(false);
        await processVoice(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      showToast('Microphone access nahi mila', { type: 'error' });
    }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); };

  const handleCreatePost = async () => {
    if (!storeId) { showToast('Please set up your store first.', { type: 'warning' }); return; }
    if (!newPostImage) { showToast('Please upload an image for the post.', { type: 'warning' }); return; }
    setNewPostUploading(true);
    try {
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId, caption: newPostCaption, imageUrl: newPostImage, ...(newPostPrice ? { price: parseFloat(newPostPrice) } : {}) }),
      });
      if (res.ok) {
        const newPost = await res.json();
        // PostHog: post_created (explicit user action, NOT the auto "welcome"
        // post that RetailerDashboard creates on first-time store setup).
        captureEvent('post_created', {
          has_image: !!newPostImage,
          has_price: !!newPostPrice,
          caption_length: (newPostCaption || '').length,
        });
        onPostsChange(prev => [newPost, ...prev]);
        setShowNewPostModal(false);
        setNewPostCaption(''); setNewPostImage(''); setNewPostPrice(''); setAiSuggestion(null);
      } else {
        showToast('Failed to create post.', { type: 'error' });
      }
    } catch { /* silent */ }
    setNewPostUploading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Action button — hidden, triggered via data-new-post-trigger from Profile */}
      <div className="px-4 pb-2 pt-1" style={{ display: 'none' }}>
        <button
          data-new-post-trigger
          onClick={() => setShowNewPostModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm"
          style={{ background: '#1A1A1A', color: 'white' }}
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {sortedPosts.map(post => (
          <div
            key={post.id}
            className="aspect-[3/4] relative cursor-pointer group"
            style={{ background: 'var(--dk-surface)' }}
            onClick={() => setSelectedPost(post)}
          >
            <img src={post.imageUrl} alt={post.caption || 'Post'} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
            {post.isOpeningPost && (
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</div>
            )}
            {!post.isOpeningPost && (
              <button
                onClick={(e) => handleTogglePin(e, post.id)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full transition-all shadow-sm z-10"
                style={{ background: post.isPinned ? 'var(--dk-accent)' : 'rgba(0,0,0,0.4)', opacity: post.isPinned ? 1 : 0 }}
              >
                <Pin size={12} color="white" fill={post.isPinned ? 'white' : 'transparent'} />
              </button>
            )}
            {post.product && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.65)', fontSize: 10, fontWeight: 600, color: 'white' }}>
                ₹{Number(post.product.price).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        {sortedPosts.length === 0 && (
          <div className="col-span-3 py-16 text-center flex flex-col items-center">
            <Grid size={40} style={{ color: 'var(--dk-border-strong)', marginBottom: 8 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>No recent posts</p>
            <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Posts in the last 30 days appear here</p>
            <button
              onClick={() => setShowNewPostModal(true)}
              className="mt-4 px-5 py-2 rounded-xl font-semibold text-sm"
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              Create Post
            </button>
          </div>
        )}
      </div>

      {/* POST DETAIL MODAL */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'white' }}>
          <header className="flex items-center justify-between px-4 py-3" style={{ background: 'white', borderBottom: '0.5px solid var(--dk-border)' }}>
            <button onClick={() => setSelectedPost(null)}>
              <ArrowLeft size={22} style={{ color: 'var(--dk-text-primary)' }} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--dk-text-primary)' }}>{store.storeName}</span>
            <div style={{ width: 22 }} />
          </header>
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="max-w-md mx-auto">
              {sortedPosts.map(post => {
                const isLiked = interactions.likedPostIds.includes(post.id);
                const isSaved = interactions.savedPostIds.includes(post.id);
                const likeCount = getLikeCount(post);
                return (
                  <div key={post.id} id={`post-${post.id}`} className="mb-3 scroll-mt-20" style={{ background: 'white', borderBottom: '0.5px solid var(--dk-border)' }}>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--dk-accent)' }}>
                          <img src={store.logoUrl} className="w-full h-full object-cover" alt="store" loading="lazy" decoding="async" />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-text-primary)' }}>{store.storeName}</p>
                          <p style={{ fontSize: 10, color: 'var(--dk-text-tertiary)' }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(post)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: 'rgba(255,107,53,0.1)', color: 'var(--dk-accent)' }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        {!post.isOpeningPost && (
                          <button
                            onClick={(e) => handleTogglePin(e, post.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: post.isPinned ? 'var(--dk-accent)' : 'var(--dk-surface)', color: post.isPinned ? 'white' : 'var(--dk-text-secondary)' }}
                          >
                            <Pin size={11} fill={post.isPinned ? 'white' : 'none'} /> {post.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {!post.isOpeningPost && (
                          <button
                            onClick={() => setPostToDelete(post.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: '#FEF2F2', color: '#EF4444' }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: 'black' }}>
                      <img src={post.imageUrl} alt={post.caption || 'Post'} className="w-full h-auto max-h-[500px] object-contain" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <button onClick={() => onToggleLike(post.id)} className="flex items-center gap-1">
                            <Heart size={22} fill={isLiked ? '#EF4444' : 'none'} color={isLiked ? '#EF4444' : 'var(--dk-text-primary)'} strokeWidth={isLiked ? 0 : 2} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{likeCount}</span>
                          </button>
                          <button onClick={() => onShare(post)}>
                            <Share2 size={22} style={{ color: 'var(--dk-text-primary)' }} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          {(post.product?.price || post.price) && (
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
                              ₹{Number(post.product?.price || post.price).toLocaleString()}
                            </span>
                          )}
                          <button onClick={() => onToggleSave(post.id)}>
                            <Bookmark size={22} fill={isSaved ? 'var(--dk-text-primary)' : 'none'} style={{ color: 'var(--dk-text-primary)' }} strokeWidth={isSaved ? 0 : 2} />
                          </button>
                        </div>
                      </div>
                      {post.caption && (
                        <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>
                          <span style={{ fontWeight: 700, color: 'var(--dk-text-primary)', marginRight: 6 }}>{store.storeName}</span>
                          {post.caption}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* NEW POST MODAL */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-2xl p-5" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--dk-text-primary)' }}>New Post</h3>
              <button onClick={() => { setShowNewPostModal(false); setNewPostImage(''); setNewPostCaption(''); setNewPostPrice(''); setAiSuggestion(null); }}>
                <X size={22} style={{ color: 'var(--dk-text-tertiary)' }} />
              </button>
            </div>
            <div className="mb-4">
              {showCropper && rawImageUrl ? (
                <ImageCropper
                  imageUrl={rawImageUrl}
                  onComplete={async (croppedDataUrl) => {
                    try {
                      const blob = await fetch(croppedDataUrl).then(r => r.blob());
                      const formData = new FormData();
                      formData.append('file', blob, 'cropped-post.jpg');
                      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
                      if (res.ok) { const data = await res.json(); setNewPostImage(data.url); }
                    } catch { /* silent */ }
                    setShowCropper(false); setRawImageUrl('');
                  }}
                  onCancel={() => { setShowCropper(false); setRawImageUrl(''); }}
                />
              ) : newPostImage ? (
                <div className="relative">
                  <img src={newPostImage} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  <button onClick={() => { setNewPostImage(''); setAiSuggestion(null); }} className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full">
                    <X size={14} />
                  </button>
                  <button
                    onClick={handleAiMagic} disabled={aiLoading}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-60"
                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                  >
                    <Sparkles size={12} />
                    {aiLoading ? 'AI soch raha hai...' : '✨ AI se caption banao'}
                  </button>
                </div>
              ) : (
                <label className="h-48 flex flex-col items-center justify-center cursor-pointer rounded-xl" style={{ border: '1.5px dashed var(--dk-border-strong)', background: 'var(--dk-surface)' }}>
                  <ImageIconLucide size={32} style={{ color: 'var(--dk-text-tertiary)', marginBottom: 8 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>Tap to upload image</span>
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Will be cropped to 3:4 ratio</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePostImageUpload} />
                </label>
              )}
            </div>
            <div className="relative">
              <textarea
                className="w-full p-3 pr-12 rounded-xl text-sm outline-none"
                style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                rows={3} placeholder="Write a caption..."
                value={newPostCaption} onChange={(e) => setNewPostCaption(e.target.value)}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={aiLoading}
                className="absolute top-2 right-2 p-2 rounded-full disabled:opacity-50"
                style={{ background: isRecording ? '#EF4444' : 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}
              >
                {isRecording ? <MicOff size={15} color="white" /> : <Mic size={15} style={{ color: 'var(--dk-accent)' }} />}
              </button>
            </div>
            {isRecording && (
              <p className="text-xs mt-1 font-semibold" style={{ color: '#EF4444' }}>
                🔴 Recording... {recordingSeconds}s — Stop karne ke liye mic dabao
              </p>
            )}
            {aiSuggestion && (aiSuggestion.productName || aiSuggestion.category) && (
              <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}>
                <Sparkles size={13} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
                <p className="text-xs" style={{ color: 'var(--dk-text-secondary)' }}>
                  <span className="font-semibold">AI suggestion — aap edit kar sakte ho</span>
                  {aiSuggestion.productName ? ` · ${aiSuggestion.productName}` : ''}
                  {aiSuggestion.category ? ` · ${aiSuggestion.category}` : ''}
                </p>
              </div>
            )}
            <div className="mt-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 4 }}>Price (optional)</label>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dk-text-tertiary)' }} />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                  placeholder="e.g. 299 or 1,500"
                  value={newPostPrice} onChange={(e) => setNewPostPrice(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleCreatePost} disabled={newPostUploading || !newPostImage}
              className="w-full mt-4 py-3 rounded-xl font-bold disabled:opacity-50"
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              {newPostUploading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-md rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Edit Post</h3>
              <button onClick={() => setEditingPost(null)}><X size={22} style={{ color: 'var(--dk-text-tertiary)' }} /></button>
            </div>
            <div className="mb-4">
              {editShowCropper && editRawImageUrl ? (
                <ImageCropper
                  imageUrl={editRawImageUrl}
                  onComplete={async (croppedDataUrl) => {
                    try {
                      const blob = await fetch(croppedDataUrl).then(r => r.blob());
                      const formData = new FormData();
                      formData.append('file', blob, 'edited-post.jpg');
                      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
                      if (res.ok) { const data = await res.json(); setEditImage(data.url); }
                    } catch { /* silent */ }
                    setEditShowCropper(false); setEditRawImageUrl('');
                  }}
                  onCancel={() => { setEditShowCropper(false); setEditRawImageUrl(''); }}
                />
              ) : (
                <div className="relative">
                  <img src={editImage} alt="Post" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  <label className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer">
                    <Pencil size={12} /> Replace Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImageUpload} />
                  </label>
                </div>
              )}
            </div>
            <textarea
              className="w-full p-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
              rows={3} placeholder="Write a caption..."
              value={editCaption} onChange={(e) => setEditCaption(e.target.value)}
            />
            <div className="mt-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 4 }}>Price (optional)</label>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dk-text-tertiary)' }} />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                  placeholder="e.g. 299"
                  value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleSaveEdit} disabled={editUploading || !editImage}
              className="w-full mt-4 py-3 rounded-xl font-bold disabled:opacity-50"
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              {editUploading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {postToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPostToDelete(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FEF2F2' }}>
                <Trash2 size={24} style={{ color: '#EF4444' }} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--dk-text-primary)', marginBottom: 8 }}>Delete Post?</h3>
              <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', marginBottom: 24 }}>This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setPostToDelete(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: 'var(--dk-surface)', color: 'var(--dk-text-primary)', border: '0.5px solid var(--dk-border)' }}>Cancel</button>
                <button onClick={confirmDeletePost} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#EF4444', color: 'white' }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
