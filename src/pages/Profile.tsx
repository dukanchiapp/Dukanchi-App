import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ArrowLeft, Grid as GridIcon, Plus, Settings, LogOut, ChevronRight, History, Star, AlertTriangle, HelpCircle, Bookmark, UserCheck, Store, Heart, Share2, Package, X } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import KYCForm from '../components/KYCForm';
import StarRating from '../components/StarRating';
import { getStoreStatus } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';
import RefreshButton from '../components/RefreshButton';
import { usePageMeta } from '../hooks/usePageMeta';
import { StoreInfoCard } from '../components/profile/StoreInfoCard';
import { PostsGrid } from '../components/profile/PostsGrid';
import { ReviewsTab } from '../components/profile/ReviewsTab';

export default function ProfilePage() {
  usePageMeta({ title: 'My Profile' });
  const [store, setStore] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showKYC, setShowKYC] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [kycNotes, setKycNotes] = useState('');
  const [kycStoreName, setKycStoreName] = useState('');
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentUserId = user?.id;

  const [interactions, setInteractions] = useState<{ likedPostIds: string[]; savedPostIds: string[]; followedStoreIds: string[] }>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: [],
  });

  useEffect(() => {
    if (user) {
      fetch(`/api/me/interactions`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [user]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/like`, { credentials: 'include', method: 'POST' }); } catch { /* silent */ }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/save`, { credentials: 'include', method: 'POST' }); } catch { /* silent */ }
  };

  const handleShare = async (post: any) => {
    const shareData = { title: store?.storeName || 'Check this out!', text: post.caption || 'See this post', url: window.location.origin + `/store/${store?.id}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); showToast('Link copied to clipboard!', { type: 'success' }); }
    } catch { /* silent */ }
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
      if (user?.role && user.role !== 'customer') {
        try {
          const kycRes = await fetch('/api/kyc/status', { credentials: 'include' });
          if (kycRes.ok) {
            const kycData = await kycRes.json();
            setKycStatus(kycData.kycStatus || 'none');
            setKycNotes(kycData.kycNotes || '');
            setKycStoreName(kycData.kycStoreName || '');
          }
        } catch { /* silent */ }
      }

      const storeRes = await fetch(`/api/users/${currentUserId}/store`, { credentials: 'include' });
      let storeData = await storeRes.json();

      if (!storeData && user?.role === 'retailer') {
        storeData = {
          id: 'mock-store', ownerId: currentUserId,
          storeName: user?.name + "'s Store", category: 'General',
          description: 'Set up your store bio in Edit Profile.', address: 'Add your address',
          phone: '', phoneVisible: true, latitude: 0, longitude: 0,
          _count: { followers: 0, posts: 0 },
        };
      }

      if (storeData) {
        setStore(storeData);
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
      if (res.ok) { const convos = await res.json(); setChatCount(convos.length); }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'white' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }} />
      </div>
    );
  }

  const handleLogout = () => { logout(); navigate('/login'); };
  const isBusinessAccount = user?.role !== 'customer';

  // ── CUSTOMER PROFILE VIEW ──────────────────────────────────────────────────
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
                <Link to="/settings"><Settings size={20} style={{ color: 'var(--dk-text-primary)' }} /></Link>
              </div>
            </div>
          </div>
          <div className="px-4">
            <div className="flex flex-col items-center py-6">
              <div className="flex items-center justify-center mb-3 font-bold" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--dk-accent)', color: 'white', fontSize: 32 }}>
                {user?.name?.charAt(0)}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', marginBottom: 2 }}>{user?.name}</h2>
              {user?.email && <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>{user.email}</p>}
              <button onClick={() => navigate('/settings')} className="mt-4 px-6 py-2 rounded-full font-semibold text-sm" style={{ background: 'var(--dk-surface)', color: 'var(--dk-text-primary)', border: '0.5px solid var(--dk-border)' }}>
                Edit Details
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '0.5px solid var(--dk-border)', background: 'white' }}>
              {[
                { icon: <UserCheck size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Following Stores' },
                { icon: <Bookmark size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Saved Posts & Stores' },
                { icon: <MapPin size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Saved Locations' },
                { icon: <History size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'Search History' },
                { icon: <Star size={18} style={{ color: 'var(--dk-accent)' }} />, label: 'My Reviews' },
              ].map((item, i, arr) => (
                <div key={item.label} onClick={() => navigate('/settings')} className="flex items-center justify-between px-4 py-3.5 cursor-pointer" style={{ borderBottom: i < arr.length - 1 ? '0.5px solid var(--dk-border)' : 'none' }}>
                  <div className="flex items-center gap-3">{item.icon}<span style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>{item.label}</span></div>
                  <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                </div>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '0.5px solid var(--dk-border)', background: 'white' }}>
              <div onClick={() => navigate('/support', { state: { activeTab: 'help' } })} className="flex items-center justify-between px-4 py-3.5 cursor-pointer" style={{ borderBottom: '0.5px solid var(--dk-border)' }}>
                <div className="flex items-center gap-3"><HelpCircle size={18} style={{ color: 'var(--dk-text-tertiary)' }} /><span style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>Help & Feedback</span></div>
                <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
              </div>
              <div onClick={() => navigate('/support', { state: { activeTab: 'complaints' } })} className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                <div className="flex items-center gap-3"><AlertTriangle size={18} style={{ color: '#EF4444' }} /><span style={{ fontSize: 14, color: '#EF4444' }}>Complaint Box</span></div>
                <ChevronRight size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm mb-6" style={{ background: 'white', border: '0.5px solid #FECACA', color: '#EF4444' }}>
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NO STORE / KYC FLOW ───────────────────────────────────────────────────
  if (!store || store.id === 'mock-store') {
    if (showKYC) {
      return <KYCForm onComplete={() => { fetchStoreData(); navigate('/retailer/dashboard'); }} onLogout={handleLogout} onBack={() => setShowKYC(false)} />;
    }
    if (kycStatus === 'pending') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
          <div className="absolute top-0 -left-6 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000" />
          <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-100 border border-white/40">
              <Clock size={40} className="text-amber-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Under Review</h2>
            {kycStoreName && <p className="text-indigo-600 font-semibold mb-2">{kycStoreName}</p>}
            <p className="text-gray-500 mb-6 text-sm px-4">Your KYC application has been submitted and is currently being reviewed. This usually takes 1–2 business days.</p>
            <button onClick={handleLogout} className="text-gray-500 font-semibold flex items-center mx-auto"><LogOut size={18} className="mr-2" /> Log Out</button>
          </div>
        </div>
      );
    }
    if (kycStatus === 'approved') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-md px-6 py-12 text-center">
            <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"><Store size={40} className="text-emerald-600" /></div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">KYC Approved!</h2>
            <p className="text-gray-500 mb-8 text-sm px-4">Your business has been verified. Complete your store profile to go live.</p>
            <button onClick={() => navigate('/retailer/dashboard')} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg mb-3">Complete Your Store Profile</button>
            <button onClick={handleLogout} className="mt-3 text-gray-500 font-semibold flex items-center mx-auto"><LogOut size={18} className="mr-2" /> Log Out</button>
          </div>
        </div>
      );
    }
    if (kycStatus === 'rejected') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-md px-6 py-12 text-center">
            <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"><AlertTriangle size={40} className="text-red-500" /></div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Rejected</h2>
            <p className="text-gray-500 mb-4 text-sm px-4">Please review the reason below and resubmit.</p>
            {kycNotes && <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-8 text-left"><p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Reason</p><p className="text-sm text-red-800">{kycNotes}</p></div>}
            <button onClick={() => setShowKYC(true)} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg mb-3">Resubmit KYC Application</button>
            <button onClick={handleLogout} className="mt-3 text-gray-500 font-semibold flex items-center mx-auto"><LogOut size={18} className="mr-2" /> Log Out</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <div className="absolute top-0 -left-6 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob" />
        <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
          <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"><Store size={40} className="text-indigo-600" /></div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-3">Business Profile Not Setup</h2>
          <p className="text-gray-500 mb-10 text-sm px-4">Complete the Initial KYC to verify your business and open your digital storefront.</p>
          <button onClick={() => setShowKYC(true)} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg">Set Up Your Store</button>
          <button onClick={handleLogout} className="mt-6 text-gray-500 font-semibold flex items-center mx-auto"><LogOut size={18} className="mr-2" /> Log Out</button>
        </div>
      </div>
    );
  }

  // ── RETAILER PROFILE VIEW ─────────────────────────────────────────────────
  const hoursComplete = store.is24Hours || store.openingTime;
  const profileCompletionFields = [store.storeName, store.description, store.logoUrl, store.address, store.phone, hoursComplete, store.workingDays];
  const completedFields = profileCompletionFields.filter(Boolean).length;
  const completionPct = Math.round((completedFields / profileCompletionFields.length) * 100);
  const storeStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPosts = posts.filter(p => p.isOpeningPost || p.isPinned || new Date(p.createdAt || new Date()) >= thirtyDaysAgo);
  const sortedPosts = [...recentPosts].sort((a, b) => {
    if (a.isOpeningPost && !b.isOpeningPost) return -1;
    if (!a.isOpeningPost && b.isOpeningPost) return 1;
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* Cover */}
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
          <div className="absolute top-0 right-0 flex items-center gap-2 px-4 pt-12 z-10">
            <NotificationBell />
            <Link to="/settings" state={{ activeTab: 'bulk_upload' }}>
              <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
                <Settings size={18} color="white" />
              </div>
            </Link>
          </div>
          <div className="absolute" style={{ bottom: -28, left: 16, width: 72, height: 72, borderRadius: 18, overflow: 'hidden', border: '3px solid white', background: 'var(--dk-surface)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
            {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt="logo" /> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl" style={{ color: 'var(--dk-accent)' }}>{store.storeName?.charAt(0)}</div>}
          </div>
        </div>

        {/* Store name + info */}
        <div className="px-4 pt-10 pb-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', lineHeight: '1.2' }}>{store.storeName}</h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <StarRating rating={store.averageRating ?? 0} size={16} />
                  {store.averageRating != null && store.averageRating > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{store.averageRating.toFixed(1)}</span>
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
              {store.description && <p className="mt-1.5" style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>{store.description}</p>}
            </div>
          </div>

          {completionPct < 100 && (
            <div className="flex items-center gap-3 mt-4 p-3 rounded-2xl" style={{ background: 'rgba(255,107,53,0.08)', border: '0.5px solid rgba(255,107,53,0.2)' }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--dk-accent)' }}><span style={{ fontSize: 18 }}>⚡</span></div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Profile {completionPct}% complete</p>
                <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>Complete your profile to get more customers</p>
              </div>
              <Link to="/retailer/dashboard" style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-accent)', flexShrink: 0 }}>Fix</Link>
            </div>
          )}

          <StoreInfoCard store={store} storeStatus={storeStatus} />

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

          {/* Edit profile button */}
          <div className="flex gap-2 mt-4">
            <Link
              to="/retailer/dashboard"
              className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--dk-bg-soft)', color: 'var(--dk-accent)', border: '0.5px solid var(--dk-border)' }}
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky z-10 flex border-b" style={{ top: 0, background: 'white', borderColor: 'var(--dk-border)' }}>
          <button
            onClick={() => setActiveTab('posts')}
            className="flex-1 flex items-center justify-center gap-1 py-3"
            style={{ fontSize: 13, fontWeight: activeTab === 'posts' ? 700 : 400, color: activeTab === 'posts' ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)', borderBottom: activeTab === 'posts' ? '2px solid var(--dk-accent)' : '2px solid transparent' }}
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
              style={{ fontSize: 13, fontWeight: activeTab === 'reviews' ? 700 : 400, color: activeTab === 'reviews' ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)', borderBottom: activeTab === 'reviews' ? '2px solid var(--dk-accent)' : '2px solid transparent' }}
            >
              Reviews
              <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, background: activeTab === 'reviews' ? 'var(--dk-accent)' : 'var(--dk-surface)', color: activeTab === 'reviews' ? 'white' : 'var(--dk-text-tertiary)' }}>
                {reviews.length}
              </span>
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="min-h-72">
          {activeTab === 'posts' && (
            <PostsGrid
              sortedPosts={sortedPosts}
              store={store}
              storeId={store.id}
              token={token}
              interactions={interactions}
              onToggleLike={toggleLike}
              onToggleSave={toggleSave}
              onShare={handleShare}
              getLikeCount={getLikeCount}
              onPostsChange={setPosts}
            />
          )}
          {activeTab === 'reviews' && !store.hideRatings && (
            <ReviewsTab reviews={reviews} />
          )}
        </div>
      </div>
    </div>
  );
}
