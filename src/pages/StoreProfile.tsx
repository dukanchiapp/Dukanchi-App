import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StarRating from '../components/StarRating';
import ReviewModal from '../components/ReviewModal';
import RefreshButton from '../components/RefreshButton';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { apiFetch } from '../lib/api';
import { FIcon } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 6 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. All store/post/review
   fetching, follow + like + share handlers, and the post-detail modal wiring
   are preserved verbatim from the production page. */

const coverFab: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'var(--f-fab-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--f-glass-border-2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const detailRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '5px 0',
};

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [store, setStore] = useState<any>(null);
  usePageMeta({ title: store?.storeName || 'Store' });
  const [, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || '';
  const currentUserRole = currentUser?.role || 'customer';

  const [interactions, setInteractions] = useState<{ likedPostIds: string[]; savedPostIds: string[]; followedStoreIds: string[] }>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: [],
  });

  useEffect(() => {
    if (currentUserId) {
      apiFetch(`/api/me/interactions`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [currentUserId]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(i => i !== postId) : [...prev.likedPostIds, postId] }));
    try { await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' }); } catch (e) { console.error(e); }
  };

  const handleShare = async (post: any) => {
    const url = `${window.location.origin}/store/${store?.id}`;
    try {
      if (navigator.share) await navigator.share({ title: store?.storeName, text: post.caption || '', url });
      else { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!', { type: 'success' }); }
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

  useEffect(() => { fetchStoreData(); }, [id]);

  useEffect(() => {
    if (selectedPost) {
      setTimeout(() => {
        document.getElementById(`post-${selectedPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedPost]);

  const fetchStoreData = async () => {
    try {
      const storeRes = await apiFetch(`/api/stores/${id}?userId=${currentUserId}`);
      if (!storeRes.ok) { setStore(null); setLoading(false); return; }
      const storeData = await storeRes.json();
      setStore(storeData);
      setIsFollowing(storeData.followers?.length > 0);
      setFollowersCount(storeData._count?.followers || 0);

      const productsRes = await apiFetch(`/api/products?storeId=${id}`);
      const productsData = await productsRes.json();
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products ?? []));

      const postsRes = await apiFetch(`/api/stores/${id}/posts`);
      const postsData = await postsRes.json();
      setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));

      const reviewsRes = await apiFetch(`/api/reviews/store/${id}`);
      const reviewsData = await reviewsRes.json();
      setReviews(Array.isArray(reviewsData) ? reviewsData : (reviewsData.reviews ?? []));

      setLoading(false);
    } catch (err) {
      console.error('fetchStoreData failed:', err);
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount(prev => !wasFollowing ? prev + 1 : Math.max(0, prev - 1));
    try {
      const res = await apiFetch(`/api/stores/${id}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
      const data = await res.json();
      if (typeof data.following === 'boolean') {
        setIsFollowing(data.following);
      }
    } catch (err) {
      showToast(wasFollowing ? 'Unfollow nahi ho saka, dobara try karein' : 'Follow nahi ho saka, dobara try karein', { type: 'error' });
      setIsFollowing(wasFollowing);
      setFollowersCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
    }
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

  if (!store) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center', background: 'var(--f-bg-deep)', backgroundImage: 'var(--f-page-bg)',
        fontFamily: 'var(--f-font)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
        }}>
          <FIcon name="storeIc" size={32} color="var(--f-text-3)" />
        </div>
        <h2 className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)', margin: '0 0 8px' }}>Store not found</h2>
        <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: '0 0 24px', maxWidth: 280 }}>
          This store may have been removed or the link is invalid.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none',
            cursor: 'pointer', background: 'var(--f-grad-primary)', color: 'white', fontSize: 14, fontWeight: 700,
            fontFamily: 'inherit', boxShadow: '0 0 20px rgba(255,42,140,0.4)',
          }}
        >
          <FIcon name="chevL" size={16} color="white" /> Go Back
        </button>
      </div>
    );
  }

  const isOwner = store.ownerId === currentUserId;
  const storeStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
  const showReviews = !store.hideRatings;
  const sortedPosts = [...posts].sort((a, b) => (b.isPinned === a.isPinned ? 0 : b.isPinned ? 1 : -1));

  const tabs = [
    { key: 'posts', label: 'Posts', count: posts.length },
    ...(showReviews ? [{ key: 'reviews', label: 'Reviews', count: reviews.length }] : []),
  ];

  const stats: { v: string | number; l: string }[] = [
    { v: store._count?.posts || posts.length, l: 'Posts' },
    { v: followersCount, l: 'Followers' },
    ...(showReviews ? [{ v: store.averageRating ? store.averageRating.toFixed(1) : '—', l: 'Rating' }] : []),
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
      {/* Aurora wash */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

        {/* ── Cover + Logo ── */}
        <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
          {store.coverUrl ? (
            <img src={store.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(12px) brightness(0.4)', transform: 'scale(1.15)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF2A8C 0%, #6B33FF 55%, #00E5FF 100%)' }} />
          )}

          {/* Glow + fade-to-deep overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 18% 25%, rgba(255,107,53,0.40), transparent 45%),
              radial-gradient(circle at 85% 15%, rgba(255,42,140,0.45), transparent 50%),
              linear-gradient(180deg, rgba(6,8,20,0.15) 0%, rgba(6,8,20,0.55) 60%, var(--f-bg-deep) 100%)`,
          }} />

          {/* Floating top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 14px 0',
          }}>
            <button onClick={() => navigate(-1)} style={coverFab} aria-label="Back">
              <FIcon name="chevL" size={18} color="white" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshButton />
              <button
                onClick={() => {
                  const url = `${window.location.origin}/store/${store.id}`;
                  if (navigator.share) navigator.share({ title: store.storeName, url });
                  else { navigator.clipboard.writeText(url); showToast('Link copied!', { type: 'success' }); }
                }}
                style={coverFab}
                aria-label="Share"
              >
                <FIcon name="share" size={16} color="white" />
              </button>
            </div>
          </div>

          {/* Logo overlapping cover bottom */}
          <div style={{
            position: 'absolute', bottom: -28, left: 18, width: 72, height: 72, borderRadius: 18, overflow: 'hidden',
            border: '3px solid var(--f-bg-deep)', background: 'var(--f-grad-primary)',
            boxShadow: '0 0 24px rgba(255,42,140,0.45), 0 8px 24px rgba(0,0,0,0.55)',
          }}>
            {store.logoUrl ? (
              <img src={store.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, color: 'white' }}>
                {store.storeName?.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* ── Store info ── */}
        <div style={{ padding: '40px 18px 16px' }}>
          {/* Name + rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 className="f-display" style={{ fontSize: 24, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StarRating rating={store.averageRating ?? 0} size={15} />
              {store.averageRating != null && store.averageRating > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--f-text-2)' }}>{store.averageRating.toFixed(1)}</span>
              )}
            </div>
          </div>

          {/* Role + category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: store.description ? 10 : 14 }}>
            {store.owner?.role && store.owner.role !== 'customer' && (
              <span style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                textTransform: 'uppercase', background: 'var(--f-grad-primary)', color: 'white',
                boxShadow: '0 0 12px rgba(255,42,140,0.45)',
              }}>
                {store.owner.role === 'retailer' ? 'Retail' : store.owner.role}
              </span>
            )}
            {store.category && <span style={{ fontSize: 12, color: 'var(--f-text-2)' }}>{store.category}</span>}
          </div>

          {store.description && (
            <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.55, margin: '0 0 14px' }}>{store.description}</p>
          )}

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {stats.map(stat => (
              <div key={stat.l} className="f-glass" style={{ flex: 1, padding: '13px 8px', borderRadius: 14, textAlign: 'center', background: 'var(--f-glass-bg)' }}>
                <div className="f-mono" style={{ fontSize: 21, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.02em' }}>{stat.v}</div>
                <div style={{ fontSize: 10, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>{stat.l}</div>
              </div>
            ))}
          </div>

          {/* Details card */}
          <div className="f-glass f-glass-edge" style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--f-glass-bg)' }}>
            {store.address && (
              <div style={detailRow}>
                <FIcon name="mapPin" size={14} color="var(--f-magenta-light)" />
                <span style={{ fontSize: 12.5, color: 'var(--f-text-1)', fontWeight: 500 }}>{store.address}</span>
              </div>
            )}
            {(store.postalCode || store.city || store.state) && (
              <div style={{ ...detailRow, paddingLeft: 24 }}>
                <span style={{ fontSize: 11, color: 'var(--f-text-3)' }}>
                  {store.postalCode && <span>{store.postalCode}</span>}
                  {(store.city || store.state) && <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>}
                </span>
              </div>
            )}
            {store.phoneVisible !== false && store.phone && (
              <div style={detailRow}>
                <FIcon name="phone" size={14} color="var(--f-magenta-light)" />
                <a href={`tel:${store.phone}`} style={{ fontSize: 12.5, color: 'var(--f-text-2)', textDecoration: 'none' }}>{store.phone}</a>
              </div>
            )}
            {storeStatus && (
              <div style={detailRow}>
                <FIcon name="clock" size={14} color={statusColor(storeStatus.color)} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: statusColor(storeStatus.color) }}>{storeStatus.label}</span>
              </div>
            )}
            {(store.openingTime || store.closingTime) && !store.is24Hours && (
              <div style={detailRow}>
                <FIcon name="clock" size={14} color="var(--f-text-3)" />
                <span style={{ fontSize: 12, color: 'var(--f-text-3)' }}>
                  Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}
                </span>
              </div>
            )}
            {store.workingDays && (
              <div style={{ ...detailRow, paddingLeft: 24 }}>
                <span style={{ fontSize: 12, color: 'var(--f-text-3)' }}>{store.workingDays}</span>
              </div>
            )}
            {store.latitude && store.longitude && store.latitude !== 0 && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
                  padding: '11px 14px', borderRadius: 12, background: 'rgba(255,107,53,0.14)',
                  border: '1px solid rgba(255,107,53,0.38)', color: 'var(--f-orange-light)', fontSize: 13,
                  fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 18px rgba(255,107,53,0.18)',
                }}
              >
                <FIcon name="navigation" size={14} color="var(--f-orange-light)" />
                Direction to Store
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {isOwner ? (
              <>
                <Link
                  to="/profile"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '11px 14px', borderRadius: 12, textDecoration: 'none', background: 'var(--f-grad-primary)',
                    color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 0 16px rgba(255,42,140,0.35)',
                  }}
                >
                  <FIcon name="plus" size={14} color="white" /> New Post
                </Link>
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
              </>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    border: isFollowing ? '1px solid var(--f-glass-border)' : 'none',
                    background: isFollowing ? 'var(--f-glass-bg-2)' : 'var(--f-grad-primary)',
                    color: isFollowing ? 'var(--f-text-1)' : 'white', fontSize: 13, fontWeight: 700,
                    boxShadow: isFollowing ? 'none' : '0 0 16px rgba(255,42,140,0.35)',
                  }}
                >
                  {isFollowing
                    ? <><FIcon name="check" size={15} color="var(--f-text-1)" />Following</>
                    : <><FIcon name="plus" size={15} color="white" />Follow</>}
                </button>
                {store.chatEnabled !== false && (
                  <Link
                    to={`/chat/${store.ownerId}`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 14px', borderRadius: 12, textDecoration: 'none', background: 'var(--f-glass-bg-2)',
                      border: '1px solid var(--f-glass-border-2)', color: 'var(--f-text-1)', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <FIcon name="msg" size={15} color="var(--f-magenta-light)" />Chat
                  </Link>
                )}
                {store.phone && store.phoneVisible !== false && (
                  <a
                    href={`tel:${store.phone}`}
                    style={{
                      width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12, background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)', flexShrink: 0,
                    }}
                    aria-label="Call store"
                  >
                    <FIcon name="phone" size={17} color="var(--f-text-2)" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, display: 'flex',
          background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--f-glass-border)',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0',
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: activeTab === tab.key ? '2px solid var(--f-orange)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--f-text-1)' : 'var(--f-text-3)',
                fontSize: 13.5, fontWeight: activeTab === tab.key ? 800 : 500,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9999,
                background: activeTab === tab.key ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-2)',
                color: activeTab === tab.key ? 'white' : 'var(--f-text-3)',
                boxShadow: activeTab === tab.key ? '0 0 8px rgba(255,42,140,0.4)' : 'none',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={{ minHeight: 280 }}>

          {/* Posts grid */}
          {activeTab === 'posts' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, padding: 3 }}>
              {sortedPosts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  style={{ position: 'relative', aspectRatio: '3/4', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', background: 'var(--f-bg-elev)' }}
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption || 'Post'}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {post.isPinned && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--f-grad-primary)', boxShadow: '0 0 10px rgba(255,42,140,0.5)',
                    }}>
                      <FIcon name="star" size={11} color="white" fill="white" />
                    </div>
                  )}
                  {(post.product?.price || post.price) && (
                    <div style={{
                      position: 'absolute', bottom: 6, left: 6, padding: '2px 7px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: 'white',
                    }}>
                      ₹{Number(post.product?.price || post.price).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {posts.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '56px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--f-text-3)' }}>No posts yet</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && showReviews && (
            <div style={{ padding: '14px 16px' }}>
              {store.averageRating ? (
                <div className="f-glass" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, marginBottom: 14, background: 'var(--f-glass-bg)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p className="f-mono" style={{ fontSize: 38, fontWeight: 800, color: 'var(--f-text-1)', lineHeight: 1, margin: 0 }}>
                      {store.averageRating.toFixed(1)}
                    </p>
                    <div style={{ marginTop: 4 }}><StarRating rating={store.averageRating} size={13} /></div>
                    <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 3 }}>{store.reviewCount} reviews</p>
                  </div>
                </div>
              ) : null}

              {!isOwner && currentUserRole === 'customer' && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  style={{
                    width: '100%', marginBottom: 14, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'var(--f-grad-primary)', color: 'white', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', boxShadow: '0 0 18px rgba(255,42,140,0.35)',
                  }}
                >
                  Write a Review
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviews.map(review => (
                  <div key={review.id} className="f-glass" style={{ padding: 14, borderRadius: 14, background: 'var(--f-glass-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>{review.user.name}</span>
                        <div style={{ marginTop: 3 }}><StarRating rating={review.rating} size={12} /></div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--f-text-3)' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                    {review.comment && (
                      <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>{review.comment}</p>
                    )}
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div style={{ padding: '44px 0', textAlign: 'center' }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                      <FIcon name="star" size={34} color="var(--f-text-4)" />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--f-text-3)' }}>No reviews yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Post detail modal ── */}
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
                const likeCount = getLikeCount(post);
                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    style={{ marginBottom: 8, scrollMarginTop: 80, borderBottom: '1px solid var(--f-glass-border)' }}
                  >
                    {/* Post header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--f-magenta)', flexShrink: 0 }}>
                        {store.logoUrl ? (
                          <img src={store.logoUrl} alt="store" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--f-grad-primary)', color: 'white', fontWeight: 800 }}>
                            {store.storeName?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</p>
                        <p style={{ fontSize: 10, color: 'var(--f-text-3)', margin: 0 }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Image */}
                    <div style={{ background: '#000' }}>
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'Post'}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: 'auto', maxHeight: 500, objectFit: 'contain', display: 'block' }}
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <button
                            onClick={() => toggleLike(post.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <FIcon name="heart" size={22} color={isLiked ? 'var(--f-danger)' : 'var(--f-text-1)'} fill={isLiked ? 'var(--f-danger)' : 'none'} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)' }}>{likeCount}</span>
                          </button>
                          {store.chatEnabled !== false && !isOwner && (
                            <Link to={`/chat/${store.ownerId}`} style={{ display: 'flex' }}>
                              <FIcon name="msg" size={22} color="var(--f-text-1)" />
                            </Link>
                          )}
                          <button
                            onClick={() => handleShare(post)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                          >
                            <FIcon name="share" size={21} color="var(--f-text-1)" />
                          </button>
                        </div>
                        {(post.product?.price || post.price) && (
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--f-text-1)' }}>
                            ₹{Number(post.product?.price || post.price).toLocaleString()}
                          </span>
                        )}
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

      {/* Review Modal */}
      {store && id && showReviews && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          targetId={id}
          targetType="store"
          targetName={store.storeName}
          onReviewSubmitted={fetchStoreData}
        />
      )}
    </div>
  );
}
