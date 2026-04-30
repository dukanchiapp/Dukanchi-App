import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Clock, MessageCircle, ArrowLeft, Navigation, UserPlus, UserCheck, Share2, X, Star, Heart, Package, ExternalLink } from 'lucide-react';
import StarRating from '../components/StarRating';
import ReviewModal from '../components/ReviewModal';
import RefreshButton from '../components/RefreshButton';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
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
      fetch(`/api/me/interactions`, { credentials: 'include',   })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [currentUserId]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(i => i !== postId) : [...prev.likedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/like`, { credentials: 'include',  method: 'POST',  }); } catch (e) { console.error(e); }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(i => i !== postId) : [...prev.savedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/save`, { credentials: 'include',  method: 'POST',  }); } catch (e) { console.error(e); }
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
      const storeRes = await fetch(`/api/stores/${id}?userId=${currentUserId}`, { credentials: 'include' });
      if (!storeRes.ok) { setStore(null); setLoading(false); return; }
      const storeData = await storeRes.json();
      setStore(storeData);
      setIsFollowing(storeData.followers?.length > 0);
      setFollowersCount(storeData._count?.followers || 0);

      const productsRes = await fetch(`/api/products?storeId=${id}`, { credentials: 'include' });
      const productsData = await productsRes.json();
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products ?? []));

      const postsRes = await fetch(`/api/stores/${id}/posts`, { credentials: 'include' });
      const postsData = await postsRes.json();
      setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));

      const reviewsRes = await fetch(`/api/reviews/store/${id}`, { credentials: 'include' });
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
      const res = await fetch(`/api/stores/${id}/follow`, { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
      const data = await res.json();
      if (typeof data.following === 'boolean') {
        setIsFollowing(data.following);
      }
    } catch (err) {
      console.error('toggleFollow failed:', err);
      setIsFollowing(wasFollowing);
      setFollowersCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const filteredProducts = products.filter(p =>
    p.productName?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'white' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }} />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center" style={{ background: 'var(--dk-bg)' }}>
        <div className="flex items-center justify-center mb-4" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--dk-surface)', border: '1px solid var(--dk-border)' }}>
          <Package size={32} style={{ color: 'var(--dk-text-tertiary)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', marginBottom: 6 }}>Store not found</h2>
        <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', marginBottom: 24, maxWidth: 280 }}>
          This store may have been removed or the link is invalid.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--dk-accent)', color: 'white' }}
        >
          <ArrowLeft size={16} /> Go Back
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

  return (
    <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Cover + Logo ── */}
        <div className="relative" style={{ height: 200 }}>
          {/* Cover image */}
          <div className="absolute inset-0 overflow-hidden">
            {store.coverUrl ? (
              <img src={store.coverUrl} className="w-full h-full object-cover" alt="" />
            ) : store.logoUrl ? (
              <img
                src={store.logoUrl}
                className="w-full h-full object-cover"
                style={{ filter: 'blur(12px) brightness(0.55)', transform: 'scale(1.15)' }}
                alt=""
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6B35 0%, #FFA94D 100%)' }} />
            )}
          </div>

          {/* Floating back + refresh + share */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 z-10">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
            >
              <ArrowLeft size={18} color="white" />
            </button>
            <div className="flex items-center gap-2">
              <RefreshButton />
              <button
                onClick={() => {
                  const url = `${window.location.origin}/store/${store.id}`;
                  if (navigator.share) navigator.share({ title: store.storeName, url });
                  else { navigator.clipboard.writeText(url); showToast('Link copied!', { type: 'success' }); }
                }}
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
              >
                <Share2 size={18} color="white" />
              </button>
            </div>
          </div>

          {/* Logo overlapping cover bottom */}
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

        {/* ── Store info ── */}
        <div className="px-4 pt-10 pb-4">
          {/* Name + badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)', lineHeight: '1.2' }}>
                  {store.storeName}
                </h1>
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
                {store.owner?.role && store.owner.role !== 'customer' && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                  >
                    {store.owner.role === 'retailer' ? 'Retail' : store.owner.role}
                  </span>
                )}
                {store.category && (
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>{store.category}</span>
                )}
              </div>
              {store.description && (
                <p className="mt-1.5" style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>
                  {store.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats card */}
          <div
            className="flex mt-4 rounded-2xl overflow-hidden"
            style={{ border: '0.5px solid var(--dk-border)' }}
          >
            <div className="flex-1 flex flex-col items-center py-3" style={{ background: 'white' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
                {store._count?.posts || posts.length}
              </span>
              <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>Posts</span>
            </div>
            <div style={{ width: '0.5px', background: 'var(--dk-border)' }} />
            <div className="flex-1 flex flex-col items-center py-3" style={{ background: 'white' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>{followersCount}</span>
              <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>Followers</span>
            </div>
            {showReviews && (
              <>
                <div style={{ width: '0.5px', background: 'var(--dk-border)' }} />
                <div className="flex-1 flex flex-col items-center py-3" style={{ background: 'white' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
                    {store.averageRating ? store.averageRating.toFixed(1) : '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>Rating</span>
                </div>
              </>
            )}
          </div>

          {/* Details card */}
          <div
            className="mt-4 space-y-2 p-3 rounded-2xl"
            style={{ background: '#F5F5F5', border: '0.5px solid var(--dk-border)' }}
          >
            {/* Address */}
            {store.address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)', fontWeight: 500 }}>{store.address}</span>
              </div>
            )}
            {/* Postal + City/State */}
            {(store.postalCode || store.city || store.state) && (
              <div className="flex items-start gap-2" style={{ paddingLeft: 22 }}>
                <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>
                  {store.postalCode && <span>{store.postalCode}</span>}
                  {(store.city || store.state) && <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>}
                </span>
              </div>
            )}
            {/* Phone */}
            {store.phoneVisible !== false && store.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
                <a href={`tel:${store.phone}`} style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>{store.phone}</a>
              </div>
            )}
            {/* Open/Closed status */}
            {storeStatus && (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: statusColor(storeStatus.color), flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(storeStatus.color) }}>
                  {storeStatus.label}
                </span>
              </div>
            )}
            {/* Hours */}
            {(store.openingTime || store.closingTime) && !store.is24Hours && (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>
                  Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}
                </span>
              </div>
            )}
            {/* Working days */}
            {store.workingDays && (
              <div className="flex items-center gap-2">
                <MapPin size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0, opacity: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{store.workingDays}</span>
              </div>
            )}
            {/* Direction to Store */}
            {store.latitude && store.longitude && store.latitude !== 0 && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#1A1A1A',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 14,
                  padding: '12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  marginTop: 8,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                }}
              >
                <Navigation size={16} />
                Direction to Store
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {isOwner ? (
              <>
                <Link
                  to="/profile"
                  className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: '#1A1A1A', color: 'white' }}
                >
                  New Post
                </Link>
                <Link
                  to="/retailer/dashboard"
                  className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: 'var(--dk-bg-soft)', color: 'var(--dk-accent)', border: '0.5px solid var(--dk-border)' }}
                >
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm"
                  style={{
                    background: isFollowing ? 'var(--dk-surface)' : 'var(--dk-accent)',
                    color: isFollowing ? 'var(--dk-text-primary)' : 'white',
                    border: isFollowing ? '0.5px solid var(--dk-border)' : 'none',
                  }}
                >
                  {isFollowing ? <><UserCheck size={15} />Following</> : <><UserPlus size={15} />Follow</>}
                </button>
                {store.chatEnabled !== false && (
                  <Link
                    to={`/chat/${store.ownerId}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm"
                    style={{ background: '#1A1A1A', color: 'white' }}
                  >
                    <MessageCircle size={15} />Chat
                  </Link>
                )}
                {store.phone && store.phoneVisible !== false && (
                  <a
                    href={`tel:${store.phone}`}
                    className="flex items-center justify-center"
                    style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', flexShrink: 0 }}
                  >
                    <Phone size={18} style={{ color: 'var(--dk-text-secondary)' }} />
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div
          className="sticky z-10 flex border-b"
          style={{ top: 0, background: 'white', borderColor: 'var(--dk-border)' }}
        >
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1 py-3"
              style={{
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)',
                borderBottom: activeTab === tab.key ? '2px solid var(--dk-accent)' : '2px solid transparent',
              }}
            >
              {tab.label}
              <span
                className="px-1.5 py-0.5 rounded-full"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: activeTab === tab.key ? 'var(--dk-accent)' : 'var(--dk-surface)',
                  color: activeTab === tab.key ? 'white' : 'var(--dk-text-tertiary)',
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="min-h-72">

          {/* Posts grid */}
          {activeTab === 'posts' && (
            <div className="grid grid-cols-3 gap-0.5">
              {sortedPosts.map(post => (
                <div
                  key={post.id}
                  className="aspect-[3/4] relative cursor-pointer"
                  onClick={() => setSelectedPost(post)}
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption || 'Post'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                  {post.isPinned && (
                    <div
                      className="absolute top-1.5 right-1.5 flex items-center justify-center"
                      style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--dk-accent)' }}
                    >
                      <Star size={11} fill="white" color="white" strokeWidth={0} />
                    </div>
                  )}
                  {(post.product?.price || post.price) && (
                    <div
                      className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.65)', fontSize: 10, fontWeight: 600, color: 'white' }}
                    >
                      ₹{Number(post.product?.price || post.price).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {posts.length === 0 && (
                <div className="col-span-3 py-16 text-center">
                  <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>No posts yet</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && showReviews && (
            <div className="px-4 py-3">
              {/* Rating summary */}
              {store.averageRating ? (
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl mb-4"
                  style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}
                >
                  <div className="text-center">
                    <p style={{ fontSize: 40, fontWeight: 700, color: 'var(--dk-text-primary)', lineHeight: 1 }}>
                      {store.averageRating.toFixed(1)}
                    </p>
                    <StarRating rating={store.averageRating} size={14} />
                    <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 2 }}>{store.reviewCount} reviews</p>
                  </div>
                </div>
              ) : null}

              {!isOwner && currentUserRole === 'customer' && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="w-full mb-4 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'var(--dk-accent)', color: 'white' }}
                >
                  Write a Review
                </button>
              )}

              <div className="space-y-3">
                {reviews.map(review => (
                  <div key={review.id} className="p-4 rounded-xl" style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold" style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>{review.user.name}</span>
                        <div className="mt-0.5"><StarRating rating={review.rating} size={12} /></div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>{review.comment}</p>
                    )}
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="py-12 text-center">
                    <Star size={36} style={{ color: 'var(--dk-border-strong)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>No reviews yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Post detail modal ── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'white' }}>
          <header
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'white', borderBottom: '0.5px solid var(--dk-border)' }}
          >
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
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className="mb-3 scroll-mt-20"
                    style={{ background: 'white', borderBottom: '0.5px solid var(--dk-border)' }}
                  >
                    {/* Post header */}
                    <div className="flex items-center gap-3 p-3">
                      <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--dk-accent)', flexShrink: 0 }}>
                        <img src={store.logoUrl} className="w-full h-full object-cover" alt="store" loading="lazy" decoding="async" />
                      </div>
                      <div className="flex-1">
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-text-primary)' }}>{store.storeName}</p>
                        <p style={{ fontSize: 10, color: 'var(--dk-text-tertiary)' }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Image */}
                    <div style={{ background: 'black' }}>
                      <img src={post.imageUrl} alt={post.caption || 'Post'} className="w-full h-auto max-h-[500px] object-contain" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1">
                            <Heart size={22} fill={isLiked ? '#EF4444' : 'none'} color={isLiked ? '#EF4444' : 'var(--dk-text-primary)'} strokeWidth={isLiked ? 0 : 2} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{likeCount}</span>
                          </button>
                          {store.chatEnabled !== false && !isOwner && (
                            <Link to={`/chat/${store.ownerId}`}>
                              <MessageCircle size={22} style={{ color: 'var(--dk-text-primary)' }} />
                            </Link>
                          )}
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
