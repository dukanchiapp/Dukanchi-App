import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import KYCForm from '../components/KYCForm';
import StarRating from '../components/StarRating';
import { getStoreStatus } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';
import RefreshButton from '../components/RefreshButton';
import { usePageMeta } from '../hooks/usePageMeta';
import { StoreInfoCard } from '../components/profile/StoreInfoCard';
import { PostsGrid } from '../components/profile/PostsGrid';
import { ReviewsTab } from '../components/profile/ReviewsTab';
import { apiFetch } from '../lib/api';
import { FIcon } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 8 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. Store + KYC + posts +
   reviews fetching, like/save/share handlers, and the new-post trigger are
   all preserved verbatim from the production page. */

const kycLogout: CSSProperties = {
  marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--f-text-3)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};

const kycPrimaryBtn: CSSProperties = {
  width: '100%', padding: 15, borderRadius: 16, border: 'none', cursor: 'pointer',
  background: 'var(--f-grad-primary)', color: 'white', fontSize: 15, fontWeight: 700,
  fontFamily: 'inherit', boxShadow: '0 0 24px rgba(255,107,53,0.40)',
};

const coverFab: CSSProperties = {
  width: 36, height: 36, borderRadius: 12, background: 'var(--f-fab-bg)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--f-glass-border-2)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
};

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
      apiFetch(`/api/me/interactions`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [user]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId] }));
    try { await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' }); } catch { /* silent */ }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId] }));
    try { await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' }); } catch { /* silent */ }
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
          const kycRes = await apiFetch('/api/kyc/status');
          if (kycRes.ok) {
            const kycData = await kycRes.json();
            setKycStatus(kycData.kycStatus || 'none');
            setKycNotes(kycData.kycNotes || '');
            setKycStoreName(kycData.kycStoreName || '');
          }
        } catch { /* silent */ }
      }

      const storeRes = await apiFetch(`/api/users/${currentUserId}/store`);
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
          const postsRes = await apiFetch(`/api/stores/${storeData.id}/posts`);
          if (postsRes.ok) {
            const postsData = await postsRes.json();
            setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));
          }
          const reviewsRes = await apiFetch(`/api/reviews/store/${storeData.id}`);
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
      const res = await apiFetch('/api/messages/conversations');
      if (res.ok) { const convos = await res.json(); setChatCount(convos.length); }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--f-bg-deep)' }}>
        <div
          className="animate-spin"
          style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--f-glass-border-2)', borderTopColor: 'var(--f-magenta)' }}
        />
      </div>
    );
  }

  const handleLogout = () => { logout(); navigate('/login'); };
  const isBusinessAccount = user?.role !== 'customer';

  // ── CUSTOMER PROFILE VIEW ──────────────────────────────────────────────────
  if (!isBusinessAccount) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

          {/* Header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20, padding: '18px 16px 12px',
            background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h1 className="f-display" style={{ fontSize: 30, color: 'var(--f-text-1)', margin: 0 }}>Profile</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshButton />
              <NotificationBell />
              <Link to="/settings" style={coverFab} aria-label="Settings">
                <FIcon name="settings" size={18} color="var(--f-text-1)" />
              </Link>
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            {/* Identity */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, background: 'var(--f-grad-primary)', color: 'white', fontWeight: 800, fontSize: 32,
                boxShadow: '0 0 28px rgba(255,42,140,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
              }}>
                {user?.name?.charAt(0)}
              </div>
              <h2 className="f-display" style={{ fontSize: 21, color: 'var(--f-text-1)', margin: '0 0 2px' }}>{user?.name}</h2>
              {user?.email && <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: 0 }}>{user.email}</p>}
              <button
                onClick={() => navigate('/settings')}
                className="f-glass"
                style={{ marginTop: 16, padding: '8px 22px', borderRadius: 9999, background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Edit Details
              </button>
            </div>

            {/* Menu — account */}
            <div className="f-glass" style={{ borderRadius: 18, marginBottom: 12, background: 'var(--f-glass-bg)', overflow: 'hidden' }}>
              {([
                { icon: 'userCheck', label: 'Following Stores' },
                { icon: 'bookmark', label: 'Saved Posts & Stores' },
                { icon: 'mapPin', label: 'Saved Locations' },
                { icon: 'history', label: 'Search History' },
                { icon: 'star', label: 'My Reviews' },
              ] as const).map((item, i, arr) => (
                <div
                  key={item.label}
                  onClick={() => navigate('/settings')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--f-glass-border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FIcon name={item.icon} size={18} color="var(--f-magenta-light)" />
                    <span style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{item.label}</span>
                  </div>
                  <FIcon name="chevR" size={16} color="var(--f-text-3)" />
                </div>
              ))}
            </div>

            {/* Menu — support */}
            <div className="f-glass" style={{ borderRadius: 18, marginBottom: 16, background: 'var(--f-glass-bg)', overflow: 'hidden' }}>
              <div
                onClick={() => navigate('/support', { state: { activeTab: 'help' } })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--f-glass-border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FIcon name="help" size={18} color="var(--f-text-3)" />
                  <span style={{ fontSize: 14, color: 'var(--f-text-1)' }}>Help & Feedback</span>
                </div>
                <FIcon name="chevR" size={16} color="var(--f-text-3)" />
              </div>
              <div
                onClick={() => navigate('/support', { state: { activeTab: 'complaints' } })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FIcon name="alertTriangle" size={18} color="var(--f-danger)" />
                  <span style={{ fontSize: 14, color: 'var(--f-danger)' }}>Complaint Box</span>
                </div>
                <FIcon name="chevR" size={16} color="var(--f-text-3)" />
              </div>
            </div>

            {/* Log out */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 16, marginBottom: 24, cursor: 'pointer', fontFamily: 'inherit',
                background: 'rgba(255,77,106,0.10)', border: '1px solid rgba(255,77,106,0.32)',
                color: 'var(--f-danger)', fontSize: 13, fontWeight: 700,
              }}
            >
              <FIcon name="logout" size={16} color="var(--f-danger)" /> Log Out
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
        <div className="f-bg-aurora" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}>
          <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
              boxShadow: '0 0 36px rgba(255,107,53,0.30)',
            }}>
              <FIcon name="clock" size={40} color="var(--f-orange-light)" />
            </div>
            <h2 className="f-display" style={{ fontSize: 28, color: 'var(--f-text-1)', margin: '0 0 12px' }}>Application Under Review</h2>
            {kycStoreName && <p style={{ color: 'var(--f-magenta-light)', fontWeight: 700, margin: '0 0 8px' }}>{kycStoreName}</p>}
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 8px' }}>
              Your KYC application has been submitted and is currently being reviewed. This usually takes 1–2 business days.
            </p>
            <button onClick={handleLogout} style={kycLogout}>
              <FIcon name="logout" size={16} color="var(--f-text-3)" /> Log Out
            </button>
          </div>
        </div>
      );
    }
    if (kycStatus === 'approved') {
      return (
        <div className="f-bg-aurora" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}>
          <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
              boxShadow: '0 0 36px rgba(46,231,161,0.30)',
            }}>
              <FIcon name="storeIc" size={40} color="var(--f-success)" />
            </div>
            <h2 className="f-display" style={{ fontSize: 28, color: 'var(--f-text-1)', margin: '0 0 12px' }}>KYC Approved!</h2>
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 28px' }}>
              Your business has been verified. Complete your store profile to go live.
            </p>
            <button onClick={() => navigate('/retailer/dashboard')} style={kycPrimaryBtn}>Complete Your Store Profile</button>
            <button onClick={handleLogout} style={kycLogout}>
              <FIcon name="logout" size={16} color="var(--f-text-3)" /> Log Out
            </button>
          </div>
        </div>
      );
    }
    if (kycStatus === 'rejected') {
      return (
        <div className="f-bg-aurora" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}>
          <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
              boxShadow: '0 0 36px rgba(255,77,106,0.30)',
            }}>
              <FIcon name="alertTriangle" size={40} color="var(--f-danger)" />
            </div>
            <h2 className="f-display" style={{ fontSize: 28, color: 'var(--f-text-1)', margin: '0 0 12px' }}>Application Rejected</h2>
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 16px' }}>Please review the reason below and resubmit.</p>
            {kycNotes && (
              <div style={{
                background: 'rgba(255,77,106,0.10)', border: '1px solid rgba(255,77,106,0.32)', borderRadius: 16,
                padding: '14px 18px', marginBottom: 28, textAlign: 'left',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--f-danger)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Reason</p>
                <p style={{ fontSize: 13, color: '#FF8FA3', margin: 0 }}>{kycNotes}</p>
              </div>
            )}
            <button onClick={() => setShowKYC(true)} style={kycPrimaryBtn}>Resubmit KYC Application</button>
            <button onClick={handleLogout} style={kycLogout}>
              <FIcon name="logout" size={16} color="var(--f-text-3)" /> Log Out
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="f-bg-aurora" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
            boxShadow: '0 0 36px rgba(255,42,140,0.30)',
          }}>
            <FIcon name="storeIc" size={40} color="var(--f-magenta-light)" />
          </div>
          <h2 className="f-display f-grad-text" style={{ fontSize: 28, margin: '0 0 12px' }}>Business Profile Not Setup</h2>
          <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 32px' }}>
            Complete the Initial KYC to verify your business and open your digital storefront.
          </p>
          <button onClick={() => setShowKYC(true)} style={kycPrimaryBtn}>Set Up Your Store</button>
          <button onClick={handleLogout} style={kycLogout}>
            <FIcon name="logout" size={16} color="var(--f-text-3)" /> Log Out
          </button>
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

  const isProfileEmpty = !store.storeName || store.storeName === '' ||
    !store.description || store.description === '';

  if (isProfileEmpty && kycStatus === 'approved') {
    return (
      <div className="f-bg-aurora" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
            boxShadow: '0 0 36px rgba(46,231,161,0.30)',
          }}>
            <FIcon name="storeIc" size={40} color="var(--f-success)" />
          </div>
          <h2 className="f-display" style={{ fontSize: 28, color: 'var(--f-text-1)', margin: '0 0 12px' }}>KYC Approved! 🎉</h2>
          <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 28px' }}>
            Aapka business verify ho gaya hai. Ab apna store profile complete karein taaki customers aapko dhund saken.
          </p>
          <button onClick={() => navigate('/retailer/dashboard')} style={kycPrimaryBtn}>Complete Your Store Profile</button>
          <p style={{ fontSize: 11, color: 'var(--f-text-4)', marginTop: 16 }}>
            Profile complete karne ke baad aap posts daal sakte hain
          </p>
        </div>
      </div>
    );
  }

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
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

        {/* Cover */}
        <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
          {store.coverUrl ? (
            <img src={store.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : store.logoUrl ? (
            <img src={store.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px) brightness(0.4)', transform: 'scale(1.2)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF2A8C 0%, #6B33FF 55%, #00E5FF 100%)' }} />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 18% 25%, rgba(255,107,53,0.40), transparent 45%),
              radial-gradient(circle at 85% 15%, rgba(255,42,140,0.45), transparent 50%),
              linear-gradient(180deg, rgba(6,8,20,0.15) 0%, rgba(6,8,20,0.55) 60%, var(--f-bg-deep) 100%)`,
          }} />
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '48px 14px 0', zIndex: 2 }}>
            <NotificationBell />
            <Link to="/settings" state={{ activeTab: 'bulk_upload' }} style={coverFab} aria-label="Settings">
              <FIcon name="settings" size={18} color="white" />
            </Link>
          </div>
          <div style={{
            position: 'absolute', bottom: -28, left: 16, width: 72, height: 72, borderRadius: 18, overflow: 'hidden',
            border: '3px solid var(--f-bg-deep)', background: 'var(--f-grad-primary)',
            boxShadow: '0 0 24px rgba(255,42,140,0.45), 0 8px 24px rgba(0,0,0,0.55)',
          }}>
            {store.logoUrl
              ? <img src={store.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, color: 'white' }}>{store.storeName?.charAt(0)}</div>}
          </div>
        </div>

        {/* Store name + info */}
        <div style={{ padding: '40px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StarRating rating={store.averageRating ?? 0} size={15} />
              {store.averageRating != null && store.averageRating > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--f-text-2)' }}>{store.averageRating.toFixed(1)}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: store.description ? 8 : 0 }}>
            {user?.role && user.role !== 'customer' && (
              <span style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                textTransform: 'uppercase', background: 'var(--f-grad-primary)', color: 'white',
                boxShadow: '0 0 12px rgba(255,42,140,0.45)',
              }}>
                {user.role === 'retailer' ? 'Retail' : user.role}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--f-text-2)' }}>{store.category}</span>
          </div>
          {store.description && (
            <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>{store.description}</p>
          )}

          {/* Completion banner */}
          {completionPct < 100 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: 16,
              background: 'rgba(255,107,53,0.10)', border: '1px solid rgba(255,107,53,0.28)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--f-grad-primary)', boxShadow: '0 0 14px rgba(255,107,53,0.4)',
              }}>
                <FIcon name="zap" size={18} color="white" fill="white" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>Profile {completionPct}% complete</p>
                <p style={{ fontSize: 11, color: 'var(--f-text-3)', margin: '1px 0 0' }}>Complete your profile to get more customers</p>
              </div>
              <Link to="/retailer/dashboard" style={{ fontSize: 12, fontWeight: 700, color: 'var(--f-orange-light)', flexShrink: 0, textDecoration: 'none' }}>Fix</Link>
            </div>
          )}

          <StoreInfoCard store={store} storeStatus={storeStatus} />

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Posts', value: sortedPosts.length },
              { label: 'Followers', value: store._count?.followers || 0 },
              { label: 'Chats', value: chatCount },
            ].map(stat => (
              <div key={stat.label} className="f-glass" style={{ flex: 1, padding: '13px 8px', borderRadius: 14, textAlign: 'center', background: 'var(--f-glass-bg)' }}>
                <div className="f-mono" style={{ fontSize: 21, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.02em' }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Edit profile + New Post buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link
              to="/retailer/dashboard"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px',
                borderRadius: 12, textDecoration: 'none', background: 'var(--f-glass-bg-2)',
                border: '1px solid var(--f-glass-border)', color: 'var(--f-text-1)', fontSize: 13, fontWeight: 700,
              }}
            >
              Edit Profile
            </Link>
            <button
              onClick={() => {
                const btn = document.querySelector('[data-new-post-trigger]') as HTMLButtonElement;
                if (btn) btn.click();
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px',
                borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--f-grad-primary)', color: 'white', fontSize: 13, fontWeight: 700,
                boxShadow: '0 0 16px rgba(255,42,140,0.35)',
              }}
            >
              <FIcon name="plus" size={14} color="white" /> New Post
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, display: 'flex',
          background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--f-glass-border)',
        }}>
          <button
            onClick={() => setActiveTab('posts')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: activeTab === 'posts' ? '2px solid var(--f-orange)' : '2px solid transparent',
              color: activeTab === 'posts' ? 'var(--f-text-1)' : 'var(--f-text-3)',
              fontSize: 13.5, fontWeight: activeTab === 'posts' ? 800 : 500,
            }}
          >
            Posts
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9999,
              background: activeTab === 'posts' ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-2)',
              color: activeTab === 'posts' ? 'white' : 'var(--f-text-3)',
              boxShadow: activeTab === 'posts' ? '0 0 8px rgba(255,42,140,0.4)' : 'none',
            }}>
              {sortedPosts.length}
            </span>
          </button>
          {!store.hideRatings && (
            <button
              onClick={() => setActiveTab('reviews')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0',
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: activeTab === 'reviews' ? '2px solid var(--f-orange)' : '2px solid transparent',
                color: activeTab === 'reviews' ? 'var(--f-text-1)' : 'var(--f-text-3)',
                fontSize: 13.5, fontWeight: activeTab === 'reviews' ? 800 : 500,
              }}
            >
              Reviews
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9999,
                background: activeTab === 'reviews' ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-2)',
                color: activeTab === 'reviews' ? 'white' : 'var(--f-text-3)',
                boxShadow: activeTab === 'reviews' ? '0 0 8px rgba(255,42,140,0.4)' : 'none',
              }}>
                {reviews.length}
              </span>
            </button>
          )}
        </div>

        {/* Tab content */}
        <div style={{ minHeight: 280 }}>
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
