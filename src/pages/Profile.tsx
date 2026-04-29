import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Calendar, MessageCircle, ArrowLeft, Grid, Plus, Settings, LogOut, ChevronRight, History, Star, AlertTriangle, HelpCircle, Bookmark, UserCheck, Pin, X, Image as ImageIcon, Trash2, DollarSign, Navigation, ExternalLink, Store, Heart, Share2, Package, Pencil, Sparkles, Mic, MicOff } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import ImageCropper from '../components/ImageCropper';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import KYCForm from '../components/KYCForm';
import StarRating from '../components/StarRating';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';
import RefreshButton from '../components/RefreshButton';

export default function ProfilePage() {
  const [store, setStore] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showKYC, setShowKYC] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostUploading, setNewPostUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageUrl, setRawImageUrl] = useState('');
  const [chatCount, setChatCount] = useState(0);
  const [newPostPrice, setNewPostPrice] = useState('');
  // AI features state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ productName: string; category: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Edit post state
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const [editShowCropper, setEditShowCropper] = useState(false);
  const [editRawImageUrl, setEditRawImageUrl] = useState('');
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [kycNotes, setKycNotes] = useState('');
  const [kycStoreName, setKycStoreName] = useState('');
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast, showConfirm } = useToast();

  const currentUserId = user?.id;

  const [interactions, setInteractions] = useState<{likedPostIds: string[], savedPostIds: string[], followedStoreIds: string[]}>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: []
  });

  useEffect(() => {
    if (user) {
      fetch(`/api/me/interactions`, { credentials: 'include',   })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [user]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/like`, { credentials: 'include',  method: 'POST',  }); } catch (e) { console.error(e); }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/save`, { credentials: 'include',  method: 'POST',  }); } catch (e) { console.error(e); }
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: store?.storeName || 'Check this out!',
      text: post.caption || `See this post`,
      url: window.location.origin + `/store/${store?.id}`
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); showToast('Link copied to clipboard!', { type: 'success' }); }
    } catch (err) {
      console.error('handleShare failed:', err);
    }
  };

  const getLikeCount = (post: any) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  useEffect(() => {
    fetchStoreData();
    fetchChatCount();
  }, []);

  const fetchStoreData = async () => {
    try {
      // For business users, always check KYC status first
      if (user?.role && user.role !== 'customer') {
        try {
          const kycRes = await fetch('/api/kyc/status', { credentials: 'include', 
            
          });
          if (kycRes.ok) {
            const kycData = await kycRes.json();
            setKycStatus(kycData.kycStatus || 'none');
            setKycNotes(kycData.kycNotes || '');
            setKycStoreName(kycData.kycStoreName || '');
          }
        } catch (err) {
          console.error('fetchKycStatus failed:', err);
        }
      }

      const storeRes = await fetch(`/api/users/${currentUserId}/store`, { credentials: 'include' });
      let storeData = await storeRes.json();

      if (!storeData && user?.role === 'retailer') {
        storeData = {
          id: 'mock-store',
          ownerId: currentUserId,
          storeName: user?.name + "'s Store",
          category: 'General',
          description: 'Set up your store bio in Edit Profile.',
          address: 'Add your address',
          phone: '',
          phoneVisible: true,
          latitude: 0,
          longitude: 0,
          _count: { followers: 0, posts: 0 }
        };
      }

      if (storeData) {
        setStore(storeData);

        // Only fetch posts/reviews for real stores (not the placeholder)
        if (storeData.id !== 'mock-store') {
          const postsRes = await fetch(`/api/stores/${storeData.id}/posts`, { credentials: 'include' });
          if (postsRes.ok) {
            const postsData = await postsRes.json();
            setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));
          }

          const reviewsRes = await fetch(`/api/reviews/store/${storeData.id}`, { credentials: 'include' });
          if (reviewsRes.ok) {
            const revData = await reviewsRes.json();
            setReviews(Array.isArray(revData) ? revData : (revData.reviews ?? []));
          }
        }
      } else {
        setStore(null);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const fetchChatCount = async () => {
    try {
      const res = await fetch('/api/messages/conversations', { credentials: 'include' });
      if (res.ok) {
        const convos = await res.json();
        setChatCount(convos.length);
      }
    } catch (e) { /* silent */ }
  };

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      const res = await fetch(`/api/posts/${postToDelete}`, { credentials: 'include',  method: 'DELETE', });
      if (!res.ok) throw new Error('Failed to delete post');
      setPosts(posts.filter(p => p.id !== postToDelete));
      if (selectedPost?.id === postToDelete) setSelectedPost(null);
    } catch (e) {
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
      const res = await fetch('/api/upload', { credentials: 'include',  method: 'POST',  body: formData });
      if (res.ok) {
        const data = await res.json();
        setEditRawImageUrl(data.url);
        setEditShowCropper(true);
      }
    } catch (err) {
      console.error('handleImageChange upload failed:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setEditUploading(true);
    try {
      const res = await fetch(`/api/posts/${editingPost.id}`, { credentials: 'include', 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption: editCaption, imageUrl: editImage, price: editPrice || null })
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
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

  useEffect(() => {
    if (selectedPost) {
      setTimeout(() => {
        document.getElementById(`post-${selectedPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedPost]);

  const handleTogglePin = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/posts/${postId}/pin`, { credentials: 'include',  method: 'POST', });
      if (res.ok) {
        const updated = await res.json();
        setPosts(posts.map(p => p.id === postId ? updated : p));
      } else {
        const err = await res.json();
        showToast(err.error || 'Maximum 3 pinned posts allowed.', { type: 'error' });
      }
    } catch (err) {
      console.error("Pin failed", err);
    }
  };

  const handleCreatePost = async () => {
    if (!store || store.id === 'mock-store') {
      showToast('Please set up your store first.', { type: 'warning' });
      return;
    }
    if (!newPostImage) {
      showToast('Please upload an image for the post.', { type: 'warning' });
      return;
    }
    setNewPostUploading(true);
    try {
      const res = await fetch('/api/posts', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: store.id, caption: newPostCaption, imageUrl: newPostImage, ...(newPostPrice ? { price: parseFloat(newPostPrice) } : {}) })
      });
      if (res.ok) {
        const newPost = await res.json();
        setPosts([newPost, ...posts]);
        setShowNewPostModal(false);
        setNewPostCaption('');
        setNewPostImage('');
        setNewPostPrice('');
      } else {
        showToast('Failed to create post.', { type: 'error' });
      }
    } catch (e) {
      console.error(e);
    }
    setNewPostUploading(false);
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { credentials: 'include', 
        method: 'POST',
        
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setRawImageUrl(data.url);
        setShowCropper(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── AI helpers ────────────────────────────────────────────────────────────
  const compressImageToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    const res = await fetch(url);
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
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
        canvas.width = width;
        canvas.height = height;
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
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const { base64, mimeType } = await compressImageToBase64(newPostImage);
      const res = await fetch('/api/ai/analyze-image', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (data.caption) setNewPostCaption(data.caption);
      if (data.suggestedPrice) setNewPostPrice(String(data.suggestedPrice));
      if (data.productName || data.category) {
        setAiSuggestion({ productName: data.productName || '', category: data.category || '' });
      }
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
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
        setIsRecording(false);
        await processVoice(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      showToast('Microphone access nahi mila', { type: 'error' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
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
      const res = await fetch('/api/ai/transcribe-voice', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (data.caption) setNewPostCaption(data.caption);
      if (data.price) setNewPostPrice(String(data.price));
      if (data.productName || data.category) {
        setAiSuggestion({ productName: data.productName || '', category: data.category || '' });
      }
      showToast('Voice se capture hua — check karo', { type: 'success' });
    } catch {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
    } finally {
      setAiLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  // Filter: opening post and pinned posts are exempt from 30-day removal
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPosts = posts.filter(p =>
    p.isOpeningPost || p.isPinned || new Date(p.createdAt || new Date()) >= thirtyDaysAgo
  );
  // Order: opening post (store photo) → pinned → regular (newest first)
  const sortedPosts = [...recentPosts].sort((a, b) => {
    if (a.isOpeningPost && !b.isOpeningPost) return -1;
    if (!a.isOpeningPost && b.isOpeningPost) return 1;
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'white' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }} />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isBusinessAccount = user?.role !== 'customer';

  // ========================
  // CUSTOMER PROFILE VIEW
  // ========================
  if (!isBusinessAccount) {
    return (
      <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="max-w-md mx-auto">
          <div className="sticky top-0 z-20 px-4 pt-5 pb-3" style={{ background: 'white' }}>
            <div className="flex items-center justify-between">
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Profile</h1>
              <div className="flex items-center gap-2">
                <RefreshButton />
                <NotificationBell />
                <Link to="/settings">
                  <Settings size={20} style={{ color: 'var(--dk-text-primary)' }} />
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4">
            {/* Avatar card */}
            <div className="flex flex-col items-center py-6">
              <div
                className="flex items-center justify-center mb-3 font-bold"
                style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--dk-accent)', color: 'white', fontSize: 32 }}
              >
                {user?.name?.charAt(0)}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', marginBottom: 2 }}>{user?.name}</h2>
              {user?.email && <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>{user.email}</p>}
              <button
                onClick={() => navigate('/settings')}
                className="mt-4 px-6 py-2 rounded-full font-semibold text-sm"
                style={{ background: 'var(--dk-surface)', color: 'var(--dk-text-primary)', border: '0.5px solid var(--dk-border)' }}
              >
                Edit Details
              </button>
            </div>

            {/* Menu items */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '0.5px solid var(--dk-border)', background: 'white' }}>
              {[
                { icon: <UserCheck size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Following Stores', tab: 'settings' },
                { icon: <Bookmark size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Saved Posts & Stores', tab: 'settings' },
                { icon: <MapPin size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Saved Locations', tab: 'settings' },
                { icon: <History size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Search History', tab: 'settings' },
                { icon: <Star size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'My Reviews', tab: 'settings' },
              ].map((item, i, arr) => (
                <div
                  key={item.label}
                  onClick={() => navigate('/settings')}
                  className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
                  style={{ borderBottom: i < arr.length - 1 ? '0.5px solid var(--dk-border)' : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>{item.label}</span>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                </div>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '0.5px solid var(--dk-border)', background: 'white' }}>
              <div
                onClick={() => navigate('/support', { state: { activeTab: 'help' } })}
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
                style={{ borderBottom: '0.5px solid var(--dk-border)' }}
              >
                <div className="flex items-center gap-3">
                  <HelpCircle size={18} style={{ color: 'var(--dk-text-tertiary)' }} />
                  <span style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>Help & Feedback</span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
              </div>
              <div
                onClick={() => navigate('/support', { state: { activeTab: 'complaints' } })}
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                  <span style={{ fontSize: 14, color: '#EF4444' }}>Complaint Box</span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm mb-6"
              style={{ background: 'white', border: '0.5px solid #FECACA', color: '#EF4444' }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // NO STORE SETUP YET
  // ========================
  if (!store || store.id === 'mock-store') {
    // KYC form open
    if (showKYC) {
      return (
        <KYCForm
          onComplete={() => {
            fetchStoreData();
            navigate('/retailer/dashboard');
          }}
          onLogout={handleLogout}
          onBack={() => setShowKYC(false)}
        />
      );
    }

    // KYC pending approval
    if (kycStatus === 'pending') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
          <div className="absolute top-0 -left-6 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>
          <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-100 border border-white/40">
              <Clock size={40} className="text-amber-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Under Review</h2>
            {kycStoreName && <p className="text-indigo-600 font-semibold mb-2">{kycStoreName}</p>}
            <p className="text-gray-500 mb-6 text-sm px-4">Your KYC application has been submitted and is currently being reviewed by our team. We'll notify you once it's approved — this usually takes 1–2 business days.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-8 text-left">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm text-amber-800 font-medium">Pending Approval</p>
            </div>
            <button onClick={handleLogout} className="text-gray-500 font-semibold flex items-center mx-auto hover:text-gray-800 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
          </div>
        </div>
      );
    }

    // KYC approved but store not yet created — prompt to complete profile
    if (kycStatus === 'approved') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
          <div className="absolute top-0 -left-6 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>
          <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-100 border border-white/40">
              <Store size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">KYC Approved!</h2>
            <p className="text-gray-500 mb-8 text-sm px-4">Your business has been verified. Now complete your store profile to go live on the platform.</p>
            <button
              onClick={() => navigate('/retailer/dashboard')}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all mb-3"
            >
              Complete Your Store Profile
            </button>
            <button onClick={handleLogout} className="mt-3 text-gray-500 font-semibold flex items-center mx-auto hover:text-gray-800 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
          </div>
        </div>
      );
    }

    // KYC rejected — show reason and allow resubmission
    if (kycStatus === 'rejected') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
          <div className="absolute top-0 -left-6 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-rose-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>
          <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-100 border border-white/40">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Rejected</h2>
            <p className="text-gray-500 mb-4 text-sm px-4">Unfortunately your KYC application was not approved. Please review the reason below and resubmit.</p>
            {kycNotes && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-8 text-left">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-red-800">{kycNotes}</p>
              </div>
            )}
            <button
              onClick={() => setShowKYC(true)}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all mb-3"
            >
              Resubmit KYC Application
            </button>
            <button onClick={handleLogout} className="mt-3 text-gray-500 font-semibold flex items-center mx-auto hover:text-gray-800 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
          </div>
        </div>
      );
    }

    // kycStatus === 'none' — not submitted yet
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <div className="absolute top-0 -left-6 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>

        <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 border border-white/40">
               <Store size={40} className="text-indigo-600" />
            </div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-3">Business Profile Not Setup</h2>
            <p className="text-gray-500 mb-10 text-center text-sm px-4">You need to complete the Initial KYC to verify your business and open your digital storefront.</p>
            <button
               onClick={() => setShowKYC(true)}
               className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
               Set Up Your Store
            </button>
            <button onClick={handleLogout} className="mt-6 text-gray-500 font-semibold flex items-center mx-auto hover:text-gray-800 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
        </div>
      </div>
    );
  }

  // ========================
  // RETAILER PROFILE VIEW
  // ========================
  const hoursComplete = store.is24Hours || store.openingTime;
  const profileCompletionFields = [store.storeName, store.description, store.logoUrl, store.address, store.phone, hoursComplete, store.workingDays];
  const completedFields = profileCompletionFields.filter(Boolean).length;
  const completionPct = Math.round((completedFields / profileCompletionFields.length) * 100);
  const storeStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);

  return (
    <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Cover ── */}
        <div className="relative" style={{ height: 180 }}>
          <div className="absolute inset-0 overflow-hidden">
            {store.coverUrl ? (
              <img src={store.coverUrl} className="w-full h-full object-cover" alt="" />
            ) : store.logoUrl ? (
              <img src={store.logoUrl} className="w-full h-full object-cover" style={{ filter: 'blur(14px) brightness(0.5)', transform: 'scale(1.2)' }} alt="" />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6B35 0%, #FFA94D 100%)' }} />
            )}
          </div>
          {/* Floating controls */}
          <div className="absolute top-0 right-0 flex items-center gap-2 px-4 pt-12 z-10">
            <NotificationBell />
            <Link to="/settings" state={{ activeTab: 'bulk_upload' }}>
              <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
                <Settings size={18} color="white" />
              </div>
            </Link>
          </div>
          {/* Logo overlapping */}
          <div
            className="absolute"
            style={{ bottom: -28, left: 16, width: 72, height: 72, borderRadius: 18, overflow: 'hidden', border: '3px solid white', background: 'var(--dk-surface)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
          >
            {store.logoUrl ? (
              <img src={store.logoUrl} className="w-full h-full object-cover" alt="logo" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-2xl" style={{ color: 'var(--dk-accent)' }}>
                {store.storeName?.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* ── Store name + badge ── */}
        <div className="px-4 pt-10 pb-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', lineHeight: '1.2' }}>{store.storeName}</h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <StarRating rating={store.averageRating ?? 0} size={16} />
                  {store.averageRating != null && store.averageRating > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>
                      {store.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {user?.role && user.role !== 'customer' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--dk-accent)', color: 'white' }}>
                    {user.role === 'retailer' ? 'Retail' : user.role}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{store.category}</span>
              </div>
              {store.description && (
                <p className="mt-1.5" style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>{store.description}</p>
              )}
            </div>
          </div>

          {/* Profile completion card */}
          {completionPct < 100 && (
            <div
              className="flex items-center gap-3 mt-4 p-3 rounded-2xl"
              style={{ background: 'rgba(255,107,53,0.08)', border: '0.5px solid rgba(255,107,53,0.2)' }}
            >
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--dk-accent)' }}>
                <span style={{ fontSize: 18 }}>⚡</span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Profile {completionPct}% complete</p>
                <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>Complete your profile to get more customers</p>
              </div>
              <Link to="/retailer/dashboard" style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-accent)', flexShrink: 0 }}>Fix</Link>
            </div>
          )}

          {/* Store details card */}
          {(store.address || store.postalCode || store.city || store.state || store.phone || storeStatus || store.openingTime || store.closingTime || store.workingDays || (store.latitude && store.longitude && store.latitude !== 0)) && (
            <div className="mt-4 space-y-2 p-3 rounded-2xl" style={{ background: '#F5F5F5', border: '0.5px solid var(--dk-border)' }}>
              {store.address && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)', fontWeight: 500 }}>{store.address}</span>
                </div>
              )}
              {(store.postalCode || store.city || store.state) && (
                <div className="flex items-start gap-2" style={{ paddingLeft: 22 }}>
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>
                    {store.postalCode && <span>{store.postalCode}</span>}
                    {(store.city || store.state) && <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>}
                  </span>
                </div>
              )}
              {store.phoneVisible !== false && store.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
                  <a href={`tel:${store.phone}`} style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>{store.phone}</a>
                </div>
              )}
              {storeStatus && (
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: statusColor(storeStatus.color), flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(storeStatus.color) }}>
                    {storeStatus.label}
                  </span>
                </div>
              )}
              {(store.openingTime || store.closingTime) && !store.is24Hours && (
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>
                    Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}
                  </span>
                </div>
              )}
              {store.workingDays && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0, opacity: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{store.workingDays}</span>
                </div>
              )}
              {store.latitude && store.longitude && store.latitude !== 0 && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl mt-1"
                  style={{ background: 'rgba(255,107,53,0.1)', color: 'var(--dk-accent)', fontWeight: 600, fontSize: 13 }}
                >
                  <Navigation size={14} />
                  Direction to Store
                </a>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex mt-4 rounded-2xl overflow-hidden" style={{ border: '0.5px solid var(--dk-border)' }}>
            {[
              { label: 'Posts', value: sortedPosts.length },
              { label: 'Followers', value: store._count?.followers || 0 },
              { label: 'Chats', value: chatCount },
            ].map((stat, i, arr) => (
              <React.Fragment key={stat.label}>
                <div className="flex-1 flex flex-col items-center py-3" style={{ background: 'white' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>{stat.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>{stat.label}</span>
                </div>
                {i < arr.length - 1 && <div style={{ width: '0.5px', background: 'var(--dk-border)' }} />}
              </React.Fragment>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowNewPostModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              <Plus size={16} /> New Post
            </button>
            <Link
              to="/retailer/dashboard"
              className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--dk-bg-soft)', color: 'var(--dk-accent)', border: '0.5px solid var(--dk-border)' }}
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="sticky z-10 flex border-b" style={{ top: 0, background: 'white', borderColor: 'var(--dk-border)' }}>
          <button
            onClick={() => setActiveTab('posts')}
            className="flex-1 flex items-center justify-center gap-1 py-3"
            style={{
              fontSize: 13, fontWeight: activeTab === 'posts' ? 700 : 400,
              color: activeTab === 'posts' ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)',
              borderBottom: activeTab === 'posts' ? '2px solid var(--dk-accent)' : '2px solid transparent',
            }}
          >
            Posts
            <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, background: activeTab === 'posts' ? 'var(--dk-accent)' : 'var(--dk-surface)', color: activeTab === 'posts' ? 'white' : 'var(--dk-text-tertiary)' }}>
              {sortedPosts.length}
            </span>
          </button>
          {!store.hideRatings && (
            <button
              onClick={() => setActiveTab('reviews')}
              className="flex-1 flex items-center justify-center gap-1 py-3"
              style={{
                fontSize: 13, fontWeight: activeTab === 'reviews' ? 700 : 400,
                color: activeTab === 'reviews' ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)',
                borderBottom: activeTab === 'reviews' ? '2px solid var(--dk-accent)' : '2px solid transparent',
              }}
            >
              Reviews
              <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, background: activeTab === 'reviews' ? 'var(--dk-accent)' : 'var(--dk-surface)', color: activeTab === 'reviews' ? 'white' : 'var(--dk-text-tertiary)' }}>
                {reviews.length}
              </span>
            </button>
          )}
        </div>

        {/* ── Tab content ── */}
        <div className="min-h-72">
          {/* POSTS */}
          {activeTab === 'posts' && (
            <div>
              <div className="grid grid-cols-3 gap-0.5">
                {sortedPosts.map(post => (
                  <div
                    key={post.id}
                    className="aspect-[3/4] relative cursor-pointer group"
                    style={{ background: 'var(--dk-surface)' }}
                    onClick={() => setSelectedPost(post)}
                  >
                    <img src={post.imageUrl} alt={post.caption || 'Post'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {post.isOpeningPost && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</div>
                    )}
                    {!post.isOpeningPost && (
                      <button
                        onClick={(e) => handleTogglePin(e, post.id)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-full transition-all shadow-sm z-10"
                        style={{ background: post.isPinned ? 'var(--dk-accent)' : 'rgba(0,0,0,0.4)', opacity: post.isPinned ? 1 : 0 }}
                        title={post.isPinned ? 'Unpin' : 'Pin'}
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
            </div>
          )}

          {/* REVIEWS */}
          {activeTab === 'reviews' && !store.hideRatings && (
            <div className="px-4 py-3">
              {reviews.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center">
                  <Star size={40} style={{ color: 'var(--dk-border-strong)', marginBottom: 8 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>No reviews yet</p>
                  <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Customer reviews will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="p-4 rounded-xl" style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} size={13} style={{ color: star <= review.rating ? '#F59E0B' : 'var(--dk-border-strong)', fill: star <= review.rating ? '#F59E0B' : 'none' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--dk-text-tertiary)' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                      {review.comment && <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>{review.comment}</p>}
                      {review.user && <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 6 }}>— {review.user.name}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* POST DETAIL / MANAGE POST MODAL */}
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
                          <img src={store.logoUrl} className="w-full h-full object-cover" alt="store" />
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
                            onClick={() => handleDeletePost(post.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: '#FEF2F2', color: '#EF4444' }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: 'black' }}>
                      <img src={post.imageUrl} alt={post.caption || 'Post'} className="w-full h-auto max-h-[500px] object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1">
                            <Heart size={22} fill={isLiked ? '#EF4444' : 'none'} color={isLiked ? '#EF4444' : 'var(--dk-text-primary)'} strokeWidth={isLiked ? 0 : 2} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{likeCount}</span>
                          </button>
                          <button onClick={() => handleShare(post)}>
                            <Share2 size={22} style={{ color: 'var(--dk-text-primary)' }} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          {(post.product?.price || post.price) && (
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
                              ₹{Number(post.product?.price || post.price).toLocaleString()}
                            </span>
                          )}
                          <button onClick={() => toggleSave(post.id)}>
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
            
            {/* Image Upload */}
            <div className="mb-4">
              {showCropper && rawImageUrl ? (
                <ImageCropper
                  imageUrl={rawImageUrl}
                  onComplete={async (croppedDataUrl) => {
                    // Upload cropped image
                    try {
                      const blob = await fetch(croppedDataUrl).then(r => r.blob());
                      const formData = new FormData();
                      formData.append('file', blob, 'cropped-post.jpg');
                      const res = await fetch('/api/upload', { credentials: 'include', 
                        method: 'POST',
                        body: formData
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setNewPostImage(data.url);
                      }
                    } catch (e) { console.error(e); }
                    setShowCropper(false);
                    setRawImageUrl('');
                  }}
                  onCancel={() => { setShowCropper(false); setRawImageUrl(''); }}
                />
              ) : newPostImage ? (
                <div className="relative">
                  <img src={newPostImage} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  <button
                    onClick={() => { setNewPostImage(''); setAiSuggestion(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
                  >
                    <X size={14} />
                  </button>
                  {/* AI Magic button */}
                  <button
                    onClick={handleAiMagic}
                    disabled={aiLoading}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-60"
                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                  >
                    <Sparkles size={12} />
                    {aiLoading ? 'AI soch raha hai...' : '✨ AI se caption banao'}
                  </button>
                </div>
              ) : (
                <label className="h-48 flex flex-col items-center justify-center cursor-pointer rounded-xl" style={{ border: '1.5px dashed var(--dk-border-strong)', background: 'var(--dk-surface)' }}>
                  <ImageIcon size={32} style={{ color: 'var(--dk-text-tertiary)', marginBottom: 8 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>Tap to upload image</span>
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Will be cropped to 3:4 ratio</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePostImageUpload} />
                </label>
              )}
            </div>

            {/* Caption + Voice button */}
            <div className="relative">
              <textarea
                className="w-full p-3 pr-12 rounded-xl text-sm outline-none"
                style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                rows={3}
                placeholder="Write a caption..."
                value={newPostCaption}
                onChange={(e) => setNewPostCaption(e.target.value)}
              />
              {/* Voice record button */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={aiLoading}
                className="absolute top-2 right-2 p-2 rounded-full disabled:opacity-50"
                style={{ background: isRecording ? '#EF4444' : 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}
                title={isRecording ? 'Stop recording' : 'Record voice'}
              >
                {isRecording ? <MicOff size={15} color="white" /> : <Mic size={15} style={{ color: 'var(--dk-accent)' }} />}
              </button>
            </div>
            {isRecording && (
              <p className="text-xs mt-1 font-semibold" style={{ color: '#EF4444' }}>
                🔴 Recording... {recordingSeconds}s — Stop karne ke liye mic dabao
              </p>
            )}
            {/* AI suggestion info card */}
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

            {/* Optional Price */}
            <div className="mt-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 4 }}>Price (optional)</label>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dk-text-tertiary)' }} />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                  placeholder="e.g. 299 or 1,500"
                  value={newPostPrice}
                  onChange={(e) => setNewPostPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Post Button */}
            <button
              onClick={handleCreatePost}
              disabled={newPostUploading || !newPostImage}
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

            {/* Image */}
            <div className="mb-4">
              {editShowCropper && editRawImageUrl ? (
                <ImageCropper
                  imageUrl={editRawImageUrl}
                  onComplete={async (croppedDataUrl) => {
                    try {
                      const blob = await fetch(croppedDataUrl).then(r => r.blob());
                      const formData = new FormData();
                      formData.append('file', blob, 'edited-post.jpg');
                      const res = await fetch('/api/upload', { credentials: 'include',  method: 'POST',  body: formData });
                      if (res.ok) { const data = await res.json(); setEditImage(data.url); }
                    } catch (err) {
                      console.error('cropper upload failed:', err);
                    }
                    setEditShowCropper(false);
                    setEditRawImageUrl('');
                  }}
                  onCancel={() => { setEditShowCropper(false); setEditRawImageUrl(''); }}
                />
              ) : (
                <div className="relative">
                  <img src={editImage} alt="Post" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  <label className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-black/80 transition-colors">
                    <Pencil size={12} /> Replace Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImageUpload} />
                  </label>
                </div>
              )}
            </div>

            {/* Caption */}
            <textarea
              className="w-full p-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
              rows={3}
              placeholder="Write a caption..."
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
            />

            {/* Price */}
            <div className="mt-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 4 }}>Price (optional)</label>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dk-text-tertiary)' }} />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                  placeholder="e.g. 299"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleSaveEdit}
              disabled={editUploading || !editImage}
              className="w-full mt-4 py-3 rounded-xl font-bold disabled:opacity-50"
              style={{ background: '#1A1A1A', color: 'white' }}
            >
              {editUploading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* POST DELETE CONFIRMATION MODAL */}
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
    </div>
  );
}
