import React, { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import ImageCropper from '../ImageCropper';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';
import { captureEvent } from '../../lib/posthog';
import { Sentry } from '../../lib/sentry-frontend';
import { FIcon } from '../futuristic';
import { UploadingOverlay } from '../ui/UploadingOverlay';

/* ── Futuristic v2 skin · Phase 8 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. Post pin/delete/edit,
   image upload + crop, AI photo→post + voice→post, and post creation are all
   preserved verbatim. */

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

const iconBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
};

const chipBase: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999,
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
};

function chip(bg: string, color: string): CSSProperties {
  return { ...chipBase, background: bg, color };
}

const sheetField: CSSProperties = {
  width: '100%', borderRadius: 12, fontSize: 13, outline: 'none',
  background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
  color: 'var(--f-text-1)', fontFamily: 'inherit',
};

const sheetWrap: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};

const sheetPanel: CSSProperties = {
  width: '100%', maxWidth: 480, borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto',
  background: 'var(--f-modal-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  borderTop: '1px solid var(--f-glass-border)',
};

const sheetPrimaryBtn: CSSProperties = {
  width: '100%', marginTop: 16, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', background: 'var(--b-grad)', color: 'white', fontSize: 14, fontWeight: 700,
  boxShadow: 'var(--b-elev-card)',
};

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
  // Session 128.10: cropper -> R2 upload progress (the cropper closes and the
  // POST /api/upload kicks off — previously this was a silent ~3-6s gap).
  const [postImageUploading, setPostImageUploading] = useState(false);

  // ── AI / voice state ────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ productName: string; category: string } | null>(null);

  // ── Edit post state ─────────────────────────────────────────────────────────
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const [editShowCropper, setEditShowCropper] = useState(false);
  const [editRawImageUrl, setEditRawImageUrl] = useState('');
  const [editImageUploading, setEditImageUploading] = useState(false);

  // ── Blob URL lifecycle (Session 114) ───────────────────────────────────────
  // The cropper takes a local blob: URL from URL.createObjectURL. These URLs
  // hold the file's bytes alive in memory until revoked. Effect cleanup runs
  // (a) when the URL changes — revoking the previous one before the new one
  // takes over, and (b) on component unmount — preventing the leak when the
  // modal closes while a blob URL is still set. We only revoke URLs WE own
  // (startsWith 'blob:') so any existing R2 URLs in edit-flow state aren't
  // accidentally killed.
  useEffect(() => {
    return () => {
      if (rawImageUrl.startsWith('blob:')) URL.revokeObjectURL(rawImageUrl);
    };
  }, [rawImageUrl]);
  useEffect(() => {
    return () => {
      if (editRawImageUrl.startsWith('blob:')) URL.revokeObjectURL(editRawImageUrl);
    };
  }, [editRawImageUrl]);

  // Session 128: hide the global BottomNav while a sheet is open (the nav was
  // overlapping the Publish button on the New Post sheet). Toggle a body class
  // — BottomNav has a CSS rule that hides itself when this class is present.
  useEffect(() => {
    const sheetOpen = showNewPostModal || !!editingPost;
    if (!sheetOpen) return undefined;
    document.body.classList.add('modal-open');
    return () => { document.body.classList.remove('modal-open'); };
  }, [showNewPostModal, editingPost]);

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
    } catch (err) {
      // High-frequency engagement — Sentry only, no toast spam.
      Sentry.captureException(err, { extra: { context: 'postsGrid.togglePin', postId } });
    }
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      const res = await apiFetch(`/api/posts/${postToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onPostsChange(prev => prev.filter(p => p.id !== postToDelete));
      if (selectedPost?.id === postToDelete) setSelectedPost(null);
    } catch (err) {
      showToast('Failed to delete post', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'postsGrid.delete', postId: postToDelete } });
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

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Session 114: cropper consumes a LOCAL blob: URL — no raw upload to R2
    // before crop. The cropped JPEG is uploaded post-crop (Session 113 path).
    // Net: ~3-7s lag (full-file upload + Gemini moderation round-trip on raw)
    // eliminated; cropper now appears in <100ms.
    if (editRawImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editRawImageUrl);
    }
    setEditRawImageUrl(URL.createObjectURL(file));
    setEditShowCropper(true);
    // Reset so the same file can be re-picked after cancel.
    e.target.value = '';
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
    } catch (err) {
      showToast('Failed to update post', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'postsGrid.update', postId: editingPost.id } });
    }
    setEditUploading(false);
  };

  const handlePostImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Session 114: cropper consumes a LOCAL blob: URL — no raw upload to R2
    // before crop. The cropped JPEG is uploaded post-crop (Session 113 path).
    // Net: ~3-7s lag (full-file upload + Gemini moderation round-trip on raw)
    // eliminated; cropper now appears in <100ms.
    if (rawImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawImageUrl);
    }
    setRawImageUrl(URL.createObjectURL(file));
    setShowCropper(true);
    // Reset so the same file can be re-picked after cancel.
    e.target.value = '';
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
    } catch (err) {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'postsGrid.aiPhotoToPost' } });
    } finally {
      setAiLoading(false);
    }
  };

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
    } catch (err) {
      showToast('Post create nahi ho paya. Try again.', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'postsGrid.create', storeId } });
    }
    setNewPostUploading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Action button — hidden, triggered via data-new-post-trigger from Profile */}
      <div style={{ display: 'none' }}>
        <button data-new-post-trigger onClick={() => setShowNewPostModal(true)} />
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, padding: 3 }}>
        {sortedPosts.map(post => (
          <div
            key={post.id}
            onClick={() => setSelectedPost(post)}
            style={{ position: 'relative', aspectRatio: '3/4', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', background: 'var(--f-bg-elev)' }}
          >
            <img src={post.imageUrl} alt={post.caption || 'Post'} referrerPolicy="no-referrer" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {post.isOpeningPost && (
              <div style={{
                position: 'absolute', top: 6, left: 6, padding: '2px 7px', borderRadius: 6,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', fontSize: 8, fontWeight: 800,
                color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Store
              </div>
            )}
            {!post.isOpeningPost && (
              <button
                onClick={(e) => handleTogglePin(e, post.id)}
                style={{
                  position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                  background: post.isPinned ? 'var(--b-grad)' : 'rgba(0,0,0,0.5)',
                  opacity: post.isPinned ? 1 : 0,
                  boxShadow: post.isPinned ? 'var(--b-elev-card)' : 'none',
                }}
              >
                <FIcon name="pin" size={12} color="white" fill={post.isPinned ? 'white' : 'none'} />
              </button>
            )}
            {post.product && (
              <div style={{
                position: 'absolute', bottom: 6, right: 6, padding: '2px 7px', borderRadius: 6,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: 'white',
              }}>
                ₹{Number(post.product.price).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        {sortedPosts.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '56px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <FIcon name="grid" size={40} color="var(--f-text-4)" />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)', marginTop: 8 }}>No recent posts</p>
            <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 4 }}>Posts in the last 30 days appear here</p>
            <button
              onClick={() => setShowNewPostModal(true)}
              style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--b-grad)', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: 'var(--b-elev-card)',
              }}
            >
              Create Post
            </button>
          </div>
        )}
      </div>

      {/* POST DETAIL MODAL */}
      {selectedPost && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--f-bg-deep)' }}>
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
            background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--f-glass-border)',
          }}>
            <button onClick={() => setSelectedPost(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }} aria-label="Close">
              <FIcon name="chevL" size={22} color="var(--f-text-1)" />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--f-text-1)' }}>{store.storeName}</span>
            <div style={{ width: 22 }} />
          </header>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              {sortedPosts.map(post => {
                const isLiked = interactions.likedPostIds.includes(post.id);
                const isSaved = interactions.savedPostIds.includes(post.id);
                const likeCount = getLikeCount(post);
                return (
                  <div key={post.id} id={`post-${post.id}`} style={{ marginBottom: 8, scrollMarginTop: 80, borderBottom: '1px solid var(--f-glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--f-magenta)', flexShrink: 0 }}>
                          {store.logoUrl
                            ? <img src={store.logoUrl} alt="store" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--b-grad)', color: 'white', fontWeight: 800, fontSize: 13 }}>{store.storeName?.charAt(0)}</div>}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</p>
                          <p style={{ fontSize: 10, color: 'var(--f-text-3)', margin: 0 }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => openEditModal(post)} style={chip('rgba(234,154,0,0.15)', 'var(--f-orange-light)')}>
                          <FIcon name="pencil" size={11} color="var(--f-orange-light)" /> Edit
                        </button>
                        {!post.isOpeningPost && (
                          <button
                            onClick={(e) => handleTogglePin(e, post.id)}
                            style={post.isPinned ? chip('var(--b-grad)', 'white') : chip('var(--f-glass-bg-2)', 'var(--f-text-2)')}
                          >
                            <FIcon name="pin" size={11} color={post.isPinned ? 'white' : 'var(--f-text-2)'} fill={post.isPinned ? 'white' : 'none'} /> {post.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {!post.isOpeningPost && (
                          <button onClick={() => setPostToDelete(post.id)} style={chip('rgba(255,77,106,0.14)', 'var(--f-danger)')}>
                            <FIcon name="trash" size={11} color="var(--f-danger)" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: '#000' }}>
                      <img src={post.imageUrl} alt={post.caption || 'Post'} referrerPolicy="no-referrer" loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', maxHeight: 500, objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <button onClick={() => onToggleLike(post.id)} style={iconBtn}>
                            <FIcon name="heart" size={22} color={isLiked ? 'var(--f-danger)' : 'var(--f-text-1)'} fill={isLiked ? 'var(--f-danger)' : 'none'} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)' }}>{likeCount}</span>
                          </button>
                          <button onClick={() => onShare(post)} style={iconBtn}>
                            <FIcon name="share" size={21} color="var(--f-text-1)" />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {(post.product?.price || post.price) && (
                            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--f-text-1)' }}>
                              ₹{Number(post.product?.price || post.price).toLocaleString()}
                            </span>
                          )}
                          <button onClick={() => onToggleSave(post.id)} style={iconBtn}>
                            <FIcon name="bookmark" size={22} color="var(--f-text-1)" fill={isSaved ? 'var(--f-text-1)' : 'none'} />
                          </button>
                        </div>
                      </div>
                      {post.caption && (
                        <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--f-text-1)', marginRight: 6 }}>{store.storeName}</span>
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
        <div style={sheetWrap}>
          <div style={sheetPanel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="f-display" style={{ fontSize: 18, color: 'var(--f-text-1)', margin: 0 }}>New Post</h3>
              <button
                onClick={() => { setShowNewPostModal(false); setNewPostImage(''); setNewPostCaption(''); setNewPostPrice(''); setAiSuggestion(null); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
              >
                <FIcon name="x" size={22} color="var(--f-text-3)" />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              {showCropper && rawImageUrl ? (
                <ImageCropper
                  imageUrl={rawImageUrl}
                  onComplete={async (blob) => {
                    // Session 113: blob arrives ready-to-upload from
                    // compressImage(). No data: URI round-trip.
                    // Session 128.10: close cropper immediately + show a
                    // placeholder + overlay so the upload feels acknowledged
                    // (was a silent 3-6s gap before the preview lit up).
                    setShowCropper(false); setRawImageUrl('');
                    setPostImageUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', blob, 'cropped-post.jpg');
                      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
                      if (res.ok) { const data = await res.json(); setNewPostImage(data.url); }
                      else { showToast('Image upload nahi ho paya. Try again.', { type: 'error' }); }
                    } catch (err) {
                      showToast('Image upload nahi ho paya. Try again.', { type: 'error' });
                      Sentry.captureException(err, { extra: { context: 'postsGrid.cropperUploadNew' } });
                    } finally {
                      setPostImageUploading(false);
                    }
                  }}
                  onCancel={() => { setShowCropper(false); setRawImageUrl(''); }}
                />
              ) : newPostImage ? (
                <div style={{ position: 'relative' }}>
                  <img src={newPostImage} alt="Preview" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                  <button
                    onClick={() => { setNewPostImage(''); setAiSuggestion(null); }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: 6, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    <FIcon name="x" size={14} color="white" />
                  </button>
                  <button
                    onClick={handleAiMagic}
                    disabled={aiLoading}
                    style={{
                      position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'var(--b-grad)', color: 'white', fontSize: 11, fontWeight: 800,
                      opacity: aiLoading ? 0.6 : 1, boxShadow: 'var(--b-elev-card)',
                    }}
                  >
                    <FIcon name="sparkles" size={12} color="white" />
                    {aiLoading ? 'AI soch raha hai...' : '✨ AI se caption banao'}
                  </button>
                </div>
              ) : postImageUploading ? (
                // Session 128.10: 3:4 placeholder + spinner while the cropped
                // blob is being POSTed to /api/upload. Same aspect-ratio so
                // the sheet doesn't jump when the preview lands.
                <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 12, background: 'var(--f-glass-bg)', border: '1.5px dashed var(--f-glass-border-2)' }}>
                  <UploadingOverlay label="Photo upload ho rahi hai…" size={32} radius={11} />
                </div>
              ) : (
                <label style={{
                  height: 192, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', borderRadius: 12, border: '1.5px dashed var(--f-glass-border-2)', background: 'var(--f-glass-bg)',
                }}>
                  <FIcon name="image" size={32} color="var(--f-text-3)" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-2)', marginTop: 8 }}>Image select karein</span>
                  <span style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 4 }}>3:4 ratio mein crop hokar post hogi</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePostImageUpload} />
                </label>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                style={{ ...sheetField, padding: 12, resize: 'none' }}
                rows={3} placeholder="Apne product ke baare mein batayein..."
                value={newPostCaption} onChange={(e) => setNewPostCaption(e.target.value)}
              />
            </div>
            {aiSuggestion && (aiSuggestion.productName || aiSuggestion.category) && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)' }}>
                <FIcon name="sparkles" size={13} color="var(--f-orange-light)" />
                <p style={{ fontSize: 11, color: 'var(--f-text-2)', margin: 0 }}>
                  <span style={{ fontWeight: 700 }}>AI suggestion — aap edit kar sakte ho</span>
                  {aiSuggestion.productName ? ` · ${aiSuggestion.productName}` : ''}
                  {aiSuggestion.category ? ` · ${aiSuggestion.category}` : ''}
                </p>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--f-text-3)', marginBottom: 4 }}>Price (optional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--f-text-3)', fontSize: 14 }}>₹</span>
                <input
                  type="text"
                  style={{ ...sheetField, padding: '10px 12px 10px 28px' }}
                  placeholder="e.g. 299 or 1,500"
                  value={newPostPrice} onChange={(e) => setNewPostPrice(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleCreatePost}
              disabled={newPostUploading || !newPostImage}
              style={{ ...sheetPrimaryBtn, opacity: (newPostUploading || !newPostImage) ? 0.5 : 1 }}
            >
              {newPostUploading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div style={sheetWrap}>
          <div style={sheetPanel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="f-display" style={{ fontSize: 18, color: 'var(--f-text-1)', margin: 0 }}>Edit Post</h3>
              <button onClick={() => setEditingPost(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                <FIcon name="x" size={22} color="var(--f-text-3)" />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              {editShowCropper && editRawImageUrl ? (
                <ImageCropper
                  imageUrl={editRawImageUrl}
                  onComplete={async (blob) => {
                    setEditShowCropper(false); setEditRawImageUrl('');
                    setEditImageUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', blob, 'edited-post.jpg');
                      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
                      if (res.ok) { const data = await res.json(); setEditImage(data.url); }
                      else { showToast('Image upload nahi ho paya. Try again.', { type: 'error' }); }
                    } catch (err) {
                      showToast('Image upload nahi ho paya. Try again.', { type: 'error' });
                      Sentry.captureException(err, { extra: { context: 'postsGrid.cropperUploadEdit' } });
                    } finally {
                      setEditImageUploading(false);
                    }
                  }}
                  onCancel={() => { setEditShowCropper(false); setEditRawImageUrl(''); }}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <img src={editImage} alt="Post" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                  {editImageUploading && <UploadingOverlay label="Photo upload ho rahi hai…" size={30} radius={12} />}
                  <label style={{
                    position: 'absolute', bottom: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, cursor: editImageUploading ? 'wait' : 'pointer',
                    background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                    opacity: editImageUploading ? 0.5 : 1, pointerEvents: editImageUploading ? 'none' : 'auto',
                  }}>
                    <FIcon name="pencil" size={12} color="white" /> Replace Photo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditImageUpload} disabled={editImageUploading} />
                  </label>
                </div>
              )}
            </div>
            <textarea
              style={{ ...sheetField, padding: 12, resize: 'none' }}
              rows={3} placeholder="Write a caption..."
              value={editCaption} onChange={(e) => setEditCaption(e.target.value)}
            />
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--f-text-3)', marginBottom: 4 }}>Price (optional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--f-text-3)', fontSize: 14 }}>₹</span>
                <input
                  type="text"
                  style={{ ...sheetField, padding: '10px 12px 10px 28px' }}
                  placeholder="e.g. 299"
                  value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleSaveEdit}
              disabled={editUploading || !editImage}
              style={{ ...sheetPrimaryBtn, opacity: (editUploading || !editImage) ? 0.5 : 1 }}
            >
              {editUploading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {postToDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPostToDelete(null)}
        >
          <div
            className="f-glass-strong"
            style={{ borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, background: 'var(--f-modal-bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', background: 'rgba(255,77,106,0.14)', border: '1px solid rgba(255,77,106,0.32)',
              }}>
                <FIcon name="trash" size={24} color="var(--f-danger)" />
              </div>
              <h3 className="f-display" style={{ fontSize: 18, color: 'var(--f-text-1)', margin: '0 0 8px' }}>Delete Post?</h3>
              <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: '0 0 24px' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setPostToDelete(null)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)',
                    color: 'var(--f-text-1)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePost}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: 'var(--f-danger)', color: 'white', fontSize: 13, fontWeight: 700,
                    boxShadow: 'var(--b-elev-card)',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
