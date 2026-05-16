import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUserLocation } from '../context/LocationContext';
import LocationPicker from '../components/LocationPicker';
import { useFeed } from '../hooks/useFeed';
import { usePageMeta } from '../hooks/usePageMeta';
import { Post, Interactions } from '../types';
import { apiFetch } from '../lib/api';
import { FIcon } from '../components/futuristic/FIcon';
import { FLogo } from '../components/futuristic/FLogo';
import { FLocationStrip } from '../components/futuristic/FLocationStrip';
import { FPostCard } from '../components/futuristic/FPostCard';

// Futuristic (v2) carousel chevron — glass circle. Shared L/R style.
const fChevBtn: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function HomePage() {
  usePageMeta({ title: 'Home' });
  const [feedType, setFeedType] = useState('global');
  const [locationRange, setLocationRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const { location: userLocCtx } = useUserLocation();
  const userLoc = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [imgRatios, setImgRatios] = useState<Record<string, number>>({});

  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { token, user } = useAuth();
  const { showToast } = useToast();

  // Interactions state — managed here, updated optimistically by handlers
  const [interactions, setInteractions] = useState<Interactions>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: [],
  });

  // Saved tab state — separate from paginated feed
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Feed hook — handles global/following pagination
  const { posts: feedPosts, loading: feedLoading, loadingMore, hasMore, loadMore } = useFeed({
    feedType,
    locationRange,
    lat: userLocCtx?.lat,
    lng: userLocCtx?.lng,
    enabled: !!token && feedType !== 'saved',
  });

  // Derived: use saved posts when on saved tab
  const posts = feedType === 'saved' ? savedPosts : feedPosts;
  const loading = feedType === 'saved' ? savedLoading : feedLoading;

  // Fetch interactions once when token is available
  useEffect(() => {
    if (!token) return;
    apiFetch('/api/me/interactions')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setInteractions(data as Interactions); })
      .catch(() => {});
  }, [token]);

  // Fetch saved posts when saved tab is active
  useEffect(() => {
    if (feedType !== 'saved' || !user?.id || !token) return;
    setSavedLoading(true);
    apiFetch(`/api/users/${user.id}/saved`)
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(data => setSavedPosts((Array.isArray(data.posts) ? data.posts : []) as Post[]))
      .catch(() => setSavedPosts([]))
      .finally(() => setSavedLoading(false));
  }, [feedType, user?.id, token]);

  // Carousel
  useEffect(() => {
    apiFetch('/api/app-settings')
      .then(r => r.json())
      .then(data => {
        setCarouselImages(
          data.carouselImages?.length > 0
            ? data.carouselImages
            : [
                'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop&q=80',
              ]
        );
      })
      .catch(() => {
        setCarouselImages([
          'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop&q=80',
          'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=400&fit=crop&q=80',
          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop&q=80',
        ]);
      });
  }, []);

  useEffect(() => {
    if (carouselImages.length <= 1) return;
    carouselTimer.current = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % carouselImages.length);
    }, 4000);
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [carouselImages]);

  const goCarousel = useCallback((dir: 'prev' | 'next') => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    setCarouselIdx(prev =>
      dir === 'next'
        ? (prev + 1) % carouselImages.length
        : (prev - 1 + carouselImages.length) % carouselImages.length
    );
    carouselTimer.current = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % carouselImages.length);
    }, 4000);
  }, [carouselImages]);

  // Sticky top bar height
  useEffect(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight);
  }, [userLoc, feedType, locationRange]);

  // IntersectionObserver — calls loadMore from useFeed when sentinel enters view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.5 });
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  const getDistance = (lat?: number | null, lng?: number | null): string | null => {
    if (!userLoc || !lat || !lng) return null;
    const R = 6371;
    const dLat = (lat - userLoc.lat) * (Math.PI / 180);
    const dLon = (lng - userLoc.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLoc.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  };

  const handleImgLoad = useCallback((postId: string, ratio: number) => {
    setImgRatios(prev => ({ ...prev, [postId]: ratio }));
  }, []);

  const toggleLike = useCallback(async (postId: string) => {
    let wasLiked = false;
    setInteractions(prev => {
      wasLiked = prev.likedPostIds.includes(postId);
      return {
        ...prev,
        likedPostIds: wasLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId],
      };
    });
    try {
      const res = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error(`Like failed: ${res.status}`);
    } catch (err) {
      showToast('Like nahi ho saka, dobara try karein', { type: 'error' });
      setInteractions(prev => ({
        ...prev,
        likedPostIds: wasLiked ? [...prev.likedPostIds, postId] : prev.likedPostIds.filter(id => id !== postId),
      }));
    }
  }, [showToast]);

  const toggleSave = useCallback(async (postId: string) => {
    let wasSaved = false;
    setInteractions(prev => {
      wasSaved = prev.savedPostIds.includes(postId);
      return {
        ...prev,
        savedPostIds: wasSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId],
      };
    });
    try {
      const res = await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    } catch (err) {
      showToast('Save nahi ho saka, dobara try karein', { type: 'error' });
      setInteractions(prev => ({
        ...prev,
        savedPostIds: wasSaved ? [...prev.savedPostIds, postId] : prev.savedPostIds.filter(id => id !== postId),
      }));
    }
  }, [showToast]);

  const toggleFollow = useCallback(async (storeId: string) => {
    let wasFollowed = false;
    setInteractions(prev => {
      wasFollowed = prev.followedStoreIds.includes(storeId);
      return {
        ...prev,
        followedStoreIds: wasFollowed ? prev.followedStoreIds.filter(id => id !== storeId) : [...prev.followedStoreIds, storeId],
      };
    });
    try {
      const res = await apiFetch(`/api/stores/${storeId}/follow`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
    } catch (err) {
      showToast(wasFollowed ? 'Unfollow nahi ho saka, dobara try karein' : 'Follow nahi ho saka, dobara try karein', { type: 'error' });
      setInteractions(prev => ({
        ...prev,
        followedStoreIds: wasFollowed ? [...prev.followedStoreIds, storeId] : prev.followedStoreIds.filter(id => id !== storeId),
      }));
    }
  }, [showToast]);

  const handleShare = useCallback(async (post: Post) => {
    const shareData = {
      title: post.store?.storeName || 'Check this out!',
      text: post.caption || `See this post from ${post.store?.storeName}`,
      url: window.location.origin + `/store/${post.storeId}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showToast('Link copied to clipboard!', { type: 'success' });
      }
    } catch (err) {
      console.error('handleShare failed:', err);
    }
  }, [showToast]);

  const getLikeCount = (post: Post) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  const tabs = [
    { key: 'global', label: 'For you' },
    { key: 'following', label: 'Following' },
    { key: 'saved', label: 'Saved' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--f-bg-deep)',
        backgroundImage: 'var(--f-page-bg)',
        paddingBottom: 80,
        fontFamily: 'var(--f-font)',
      }}
    >
      <div className="max-w-md mx-auto">

        {/* ── Sticky top block (Header + Location) ── */}
        <div
          ref={topBarRef}
          className="sticky top-0 z-30"
          style={{
            background: 'var(--f-sticky-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <div
            style={{
              padding: '14px 16px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FLogo size={36} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: 'var(--f-text-1)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  Dukanchi
                </span>
                <span style={{ fontSize: 10, color: 'var(--f-text-3)', lineHeight: 1.15 }}>
                  apna bazaar, apni dukaan
                </span>
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--f-glass-bg-2)',
                border: '1px solid var(--f-glass-border)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FIcon name="bell" size={18} color="#FFD96B" fill="#FFD96B" />
            </div>
          </div>
          <FLocationStrip
            name={userLocCtx ? userLocCtx.name : 'your area'}
            onChange={() => setShowLocationPicker(true)}
          />
        </div>

        {/* ── Carousel banner ── */}
        {carouselImages.length > 0 && (
          <div style={{ padding: '12px 14px' }}>
            <div
              style={{
                position: 'relative',
                borderRadius: 22,
                overflow: 'hidden',
                aspectRatio: '2.2 / 1',
                background: 'var(--f-bg-elev)',
                border: '1px solid rgba(255,42,140,0.30)',
                boxShadow:
                  '0 0 32px rgba(255,42,140,0.22), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  transition: 'transform 0.45s cubic-bezier(.4,0,.2,1)',
                  transform: `translateX(-${carouselIdx * 100}%)`,
                  height: '100%',
                }}
              >
                {carouselImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Banner ${i + 1}`}
                    loading={i === carouselIdx ? 'eager' : 'lazy'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0 }}
                    draggable={false}
                  />
                ))}
              </div>

              {carouselImages.length > 1 && (
                <>
                  <button onClick={() => goCarousel('prev')} style={{ ...fChevBtn, left: 8 }}>
                    <FIcon name="chevL" size={16} color="white" />
                  </button>
                  <button onClick={() => goCarousel('next')} style={{ ...fChevBtn, right: 8 }}>
                    <FIcon name="chevR" size={16} color="white" />
                  </button>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    {carouselImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (carouselTimer.current) clearInterval(carouselTimer.current);
                          setCarouselIdx(i);
                          carouselTimer.current = setInterval(() => {
                            setCarouselIdx(prev => (prev + 1) % carouselImages.length);
                          }, 4000);
                        }}
                        style={{
                          width: i === carouselIdx ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                          background: i === carouselIdx ? 'white' : 'rgba(255,255,255,0.4)',
                          transition: 'all 0.3s ease',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Tabs + distance filter ── */}
        <div
          className="sticky z-20"
          style={{
            top: topBarHeight,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--f-sticky-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--f-glass-border)',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {tabs.map(tab => {
              const active = feedType === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFeedType(tab.key)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: active ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-2)',
                    color: active ? 'white' : 'var(--f-text-2)',
                    border: active
                      ? '1px solid rgba(255,42,140,0.55)'
                      : '1px solid var(--f-glass-border)',
                    boxShadow: active ? '0 0 14px rgba(255,42,140,0.40)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                border: '1px solid var(--f-glass-border)',
                background: 'var(--f-glass-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <FIcon name="sliders" size={15} color="var(--f-text-1)" />
            </button>
            {showFilters && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 40,
                  width: 176,
                  borderRadius: 14,
                  padding: '8px 0',
                  zIndex: 30,
                  background: 'var(--f-modal-bg)',
                  border: '1px solid var(--f-glass-border-2)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    padding: '6px 14px',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    color: 'var(--f-text-3)',
                  }}
                >
                  Distance
                </div>
                {[
                  { key: 'all', label: 'Global' },
                  { key: '3', label: 'Within 3 km' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setLocationRange(opt.key); setShowFilters(false); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 16px',
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--f-text-1)',
                    }}
                  >
                    {opt.label}
                    {locationRange === opt.key && (
                      <FIcon name="check" size={14} color="#FF6BB4" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Feed ── */}
        <main style={{ padding: '14px 14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="f-glass" style={{ borderRadius: 22, overflow: 'hidden' }}>
                <div style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--f-glass-bg-2)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        width: '50%',
                        height: 11,
                        borderRadius: 6,
                        background: 'var(--f-glass-bg-2)',
                      }}
                    />
                    <div
                      style={{
                        width: '70%',
                        height: 9,
                        borderRadius: 6,
                        background: 'var(--f-glass-bg)',
                        marginTop: 6,
                      }}
                    />
                  </div>
                </div>
                <div style={{ aspectRatio: '4/5', background: 'var(--f-glass-bg)' }} />
              </div>
            ))
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <FIcon name="storeIc" size={44} color="var(--f-text-4)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-2)' }}>
                {feedType === 'saved' ? 'No saved posts yet.' : 'No posts found.'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--f-text-3)', marginTop: 4 }}>
                {feedType === 'saved'
                  ? 'Bookmark posts to see them here.'
                  : 'Try adjusting your filters or follow more stores.'}
              </p>
            </div>
          ) : (
            posts.map(post => (
              <FPostCard
                key={post.id}
                post={post}
                isLiked={interactions.likedPostIds.includes(post.id)}
                isSaved={interactions.savedPostIds.includes(post.id)}
                isFollowed={interactions.followedStoreIds.includes(post.storeId)}
                likeCount={getLikeCount(post)}
                distance={getDistance(post.store?.latitude, post.store?.longitude)}
                imgRatio={imgRatios[post.id]}
                onLike={toggleLike}
                onSave={toggleSave}
                onFollow={toggleFollow}
                onShare={handleShare}
                onImgLoad={handleImgLoad}
              />
            ))
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#FF2A8C',
                      boxShadow: '0 0 10px rgba(255,42,140,0.7)',
                      animation: 'pulse 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasMore && posts.length > 0 && !loadingMore && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '32px 0',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 20 }}>🎉</span>
              <p style={{ fontSize: 12, color: 'var(--f-text-3)' }}>Sab posts dekh liye!</p>
            </div>
          )}
        </main>
      </div>

      {showLocationPicker && (
        <LocationPicker onClose={() => setShowLocationPicker(false)} />
      )}
    </div>
  );
}
