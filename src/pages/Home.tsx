import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Store as StoreIcon, SlidersHorizontal, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUserLocation } from '../context/LocationContext';
import LocationPicker from '../components/LocationPicker';
import { PostCardSkeleton } from '../components/Skeleton';
import { PostCard } from '../components/PostCard';
import { useFeed } from '../hooks/useFeed';
import { usePageMeta } from '../hooks/usePageMeta';
import { Post, Interactions } from '../types';

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
    fetch('/api/me/interactions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setInteractions(data as Interactions); })
      .catch(() => {});
  }, [token]);

  // Fetch saved posts when saved tab is active
  useEffect(() => {
    if (feedType !== 'saved' || !user?.id || !token) return;
    setSavedLoading(true);
    fetch(`/api/users/${user.id}/saved`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(data => setSavedPosts((Array.isArray(data.posts) ? data.posts : []) as Post[]))
      .catch(() => setSavedPosts([]))
      .finally(() => setSavedLoading(false));
  }, [feedType, user?.id, token]);

  // Carousel
  useEffect(() => {
    fetch('/api/app-settings', { credentials: 'include' })
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
      const res = await fetch(`/api/posts/${postId}/like`, { credentials: 'include', method: 'POST' });
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
      const res = await fetch(`/api/posts/${postId}/save`, { credentials: 'include', method: 'POST' });
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
      const res = await fetch(`/api/stores/${storeId}/follow`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Sticky top block (Header + Location) ── */}
        <div ref={topBarRef} className="sticky top-0 z-30" style={{ background: 'var(--dk-bg)' }}>
          <AppHeader />
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ background: 'var(--dk-bg-soft)' }}
          >
            <div className="flex items-center gap-1.5">
              <MapPin size={13} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>
                Showing stores near{' '}
                <strong style={{ color: 'var(--dk-text-primary)', fontWeight: 600 }}>
                  {userLocCtx ? userLocCtx.name : 'your area'}
                </strong>
              </span>
            </div>
            <button
              style={{ fontSize: 12, color: 'var(--dk-accent)', fontWeight: 600 }}
              onClick={() => setShowLocationPicker(true)}
            >
              Change
            </button>
          </div>
        </div>

        {/* ── Carousel banner ── */}
        {carouselImages.length > 0 && (
          <div className="px-4 py-2" style={{ background: 'var(--dk-bg)' }}>
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--dk-radius-xl)',
                overflow: 'hidden',
                aspectRatio: '2.2 / 1',
                background: '#e5e7eb',
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
                  <button
                    onClick={() => goCarousel('prev')}
                    style={{
                      position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.35)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => goCarousel('next')}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.35)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              {carouselImages.length > 1 && (
                <div
                  style={{
                    position: 'absolute', bottom: 8, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center', gap: 5,
                  }}
                >
                  {carouselImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (carouselTimer.current) clearInterval(carouselTimer.current);
                        setCarouselIdx(i);
                        carouselTimer.current = setInterval(() => { setCarouselIdx(prev => (prev + 1) % carouselImages.length); }, 4000);
                      }}
                      style={{
                        width: i === carouselIdx ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        background: i === carouselIdx ? 'white' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.3s ease',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tabs + distance filter ── */}
        <div
          className="sticky z-20 px-4 py-2.5 flex items-center justify-between"
          style={{ top: topBarHeight, background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}
        >
          <div className="flex p-0.5 rounded-full gap-0.5" style={{ background: 'var(--dk-surface)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFeedType(tab.key)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={
                  feedType === tab.key
                    ? { background: '#1A1A1A', color: 'white' }
                    : { background: 'transparent', color: '#555' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 rounded-full"
              style={{ color: 'var(--dk-text-secondary)' }}
            >
              <SlidersHorizontal size={16} />
            </button>
            {showFilters && (
              <div
                className="absolute right-0 top-9 w-44 bg-white shadow-xl rounded-xl py-2 z-30"
                style={{ border: '1px solid var(--dk-border)' }}
              >
                <div
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--dk-text-tertiary)' }}
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
                    className="w-full text-left px-4 py-2 text-sm flex justify-between items-center hover:bg-gray-50"
                    style={{ color: 'var(--dk-text-primary)' }}
                  >
                    {opt.label}
                    {locationRange === opt.key && (
                      <Check size={14} style={{ color: 'var(--dk-accent)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Feed ── */}
        <main className="px-4 pt-4 space-y-4">
          {loading ? (
            <div style={{ paddingTop: 8 }}>
              {[1, 2, 3].map(i => <PostCardSkeleton key={i} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <StoreIcon className="mx-auto mb-3" size={44} style={{ color: 'var(--dk-border-strong)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--dk-text-secondary)' }}>
                {feedType === 'saved' ? 'No saved posts yet.' : 'No posts found.'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--dk-text-tertiary)' }}>
                {feedType === 'saved'
                  ? 'Bookmark posts to see them here.'
                  : 'Try adjusting your filters or follow more stores.'}
              </p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
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
            <div className="flex justify-center py-6">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--dk-accent)',
                      animation: 'pulse 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasMore && posts.length > 0 && !loadingMore && (
            <div className="flex flex-col items-center py-8 gap-1">
              <span style={{ fontSize: 20 }}>🎉</span>
              <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>Sab posts dekh liye!</p>
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
