import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUserLocation } from '../context/LocationContext';
import LocationPicker from '../components/LocationPicker';
import { useFeed } from '../hooks/useFeed';
import { usePageMeta } from '../hooks/usePageMeta';
import { Post, Interactions } from '../types';
import { apiFetch } from '../lib/api';
import { Sentry } from '../lib/sentry-frontend';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Check, Store, Bookmark, UserCheck } from 'lucide-react';
import { PostCardSkeleton } from '../components/feed/PostCardSkeleton';
import { haptic } from '../lib/haptics';
import { FLocationStrip } from '../components/futuristic/FLocationStrip';
import { PostCard } from '../components/PostCard';
import NotificationBell from '../components/NotificationBell';

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
  const { posts: feedPosts, loading: feedLoading, loadingMore, hasMore, loadMore, refresh } = useFeed({
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
      .catch((err) => {
        // Background hydration — optimistic UI carries on. Sentry-only.
        Sentry.captureException(err, { extra: { context: 'home.fetchInteractions' } });
      });
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
    // Session 128.2: drop the "away" suffix to match the mockup's compact
    // "1.6 km" / "320 m" PostCard header format.
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
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
    // Session 128.3: tactile feedback on Android WebView / Chrome.
    haptic('light');
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
    haptic('light');
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
    haptic('medium');
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
    haptic('light');
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

  // ── Pull-to-refresh (Session 128.3) ───────────────────────────────────────
  // Native-feel gesture: at scrollY=0, capture the touch start Y. Track the
  // downward drag in pullY (capped at PULL_MAX, eased with a /2 divisor). On
  // release past PULL_THRESHOLD, fire refresh() + medium haptic. Touch handlers
  // pass-through (capture phase off) — they do NOT block native scroll once
  // the user has scrolled away from the very top.
  const PULL_THRESHOLD = 70;
  const PULL_MAX = 120;
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartRef = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    // Only arm the pull when the user starts at the absolute top of the page.
    if (window.scrollY > 0) { pullStartRef.current = null; return; }
    pullStartRef.current = e.touches[0]?.clientY ?? null;
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (refreshing || pullStartRef.current === null) return;
    // If the user scrolled the page in the meantime, abort the pull.
    if (window.scrollY > 0) { pullStartRef.current = null; setPullY(0); return; }
    const delta = (e.touches[0]?.clientY ?? 0) - pullStartRef.current;
    if (delta <= 0) { setPullY(0); return; }
    // Soft cap with a /2 ease so the indicator slows as you pull further.
    setPullY(Math.min(PULL_MAX, delta / 2));
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (refreshing) return;
    const armed = pullY >= PULL_THRESHOLD;
    pullStartRef.current = null;
    if (!armed) { setPullY(0); return; }
    setRefreshing(true);
    haptic('medium');
    try { await refresh(); }
    finally { setRefreshing(false); setPullY(0); }
  }, [pullY, refreshing, refresh]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--f-bg-deep)',
        backgroundImage: 'var(--f-page-bg)',
        paddingBottom: 80,
        fontFamily: 'var(--f-font)',
      }}
    >
      {/* Pull-to-refresh indicator (Session 128.3) — pinned at the top, fades
          in with pullY, spins once refreshing. Sits at zIndex 40 so the sticky
          header (z30) doesn't cover it during the pull. */}
      {(pullY > 0 || refreshing) && (
        <div
          style={{
            position: 'fixed',
            top: `calc(env(safe-area-inset-top, 0px) + ${refreshing ? 18 : Math.max(0, pullY - 28)}px)`,
            left: 0, right: 0, zIndex: 40,
            display: 'flex', justifyContent: 'center', pointerEvents: 'none',
            transition: refreshing ? 'top 200ms ease' : 'none',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', border: '1px solid var(--b-line)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            transform: refreshing ? 'none' : `rotate(${Math.min(360, pullY * 4)}deg)`,
          }}>
            {refreshing ? (
              <div className="animate-spin" style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2.5px solid var(--b-tint)', borderTopColor: 'var(--b-magenta-ink)',
              }} />
            ) : (
              <ChevronRight
                size={18}
                color={pullY >= PULL_THRESHOLD ? 'var(--b-magenta-ink)' : 'var(--f-text-3)'}
                style={{ transform: 'rotate(90deg)' }}
              />
            )}
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto">

        {/* ── Sticky top block (gradient Header + Location) ── */}
        <div
          ref={topBarRef}
          className="sticky top-0 z-30"
        >
          {/* Session 128.10 — Blinkit-style yellow header. Yellow is the brand
              canvas (not just an accent). Dark "Dukanchi" text + dark tagline
              for high contrast (the Blinkit signature). Status-bar/notch tint
              by safe-area pad — the yellow fills it. */}
          <div
            style={{
              background: 'var(--b-yellow)',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
              borderBottom: '1px solid var(--b-yellow-dk)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.40) inset',
            }}
          >
            <div
              style={{
                padding: '0 16px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                {/* Session 128.10 — On yellow header the yellow FLogo would
                    disappear. Render a WHITE tile with dark "द" instead — the
                    Blinkit pattern (clean white surface on yellow brand canvas). */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  }}
                >
                  <span style={{ fontSize: 21, fontWeight: 800, color: 'var(--b-yellow-ink)', lineHeight: 1 }}>द</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      color: 'var(--b-yellow-ink)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                    }}
                  >
                    Dukanchi
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(26,26,26,0.70)', lineHeight: 1.1 }}>
                    apna bazaar, apni dukaan
                  </span>
                </div>
              </div>
              {/* Session 128.10 — Blinkit-style white circle on yellow header
                  (compare Blinkit's profile icon: clean white circle, dark
                  glyph). Pops against the yellow brand canvas. */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}
              >
                <NotificationBell color="var(--b-yellow-ink)" />
              </div>
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
                borderRadius: 18,
                overflow: 'hidden',
                aspectRatio: '2.2 / 1',
                background: 'var(--f-bg-elev)',
                boxShadow: '0 6px 18px rgba(230,185,46,0.22)',
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
                  <button onClick={() => goCarousel('prev')} style={{ ...fChevBtn, left: 8 }} aria-label="Previous">
                    <ChevronLeft size={16} color="white" />
                  </button>
                  <button onClick={() => goCarousel('next')} style={{ ...fChevBtn, right: 8 }} aria-label="Next">
                    <ChevronRight size={16} color="white" />
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
          {/* Session 128.10 — Blinkit underline-style tabs (see All/Vacations/
              Kids/Electronics/Beauty bar on the Blinkit Home). Active tab gets
              a thick dark underline + bold text; inactive tabs are gray. Much
              calmer than a pill background, and standard for top-nav category
              bars in IN commerce apps. */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
            {tabs.map(tab => {
              const active = feedType === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFeedType(tab.key)}
                  style={{
                    padding: '8px 0 10px',
                    fontSize: 13,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: 'none',
                    background: 'transparent',
                    color: active ? 'var(--b-yellow-ink)' : 'var(--f-text-3)',
                    borderBottom: active ? '3px solid var(--b-yellow-ink)' : '3px solid transparent',
                    transition: 'all 160ms var(--b-ease)',
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
              <SlidersHorizontal size={15} color="var(--f-text-1)" />
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
                  boxShadow: '0 12px 32px rgba(24,16,8,0.14)',
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
                      <Check size={14} color="#D11F75" />
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
            // Session 128.3: shimmery PostCardSkeleton (matches the real card's
            // 52×52 avatar + text rows + 4:5 canvas + action bar — no layout
            // jump when real content lands).
            [0, 1, 2].map(i => <PostCardSkeleton key={i} />)
          ) : posts.length === 0 ? (
            // Session 128.3: richer empty state — illustration glyph + headline
            // + sub-copy + a primary CTA that adapts to the active tab (saved →
            // browse feed; following → discover stores; for-you → expand radius).
            <div style={{
              textAlign: 'center', padding: '56px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 84, height: 84, borderRadius: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 6,
                background: 'var(--b-orange-bg)',
                border: '1px solid var(--b-tint)',
              }}>
                {feedType === 'saved' ? (
                  <Bookmark size={36} color="var(--b-orange)" strokeWidth={1.8} />
                ) : feedType === 'following' ? (
                  <UserCheck size={36} color="var(--b-orange)" strokeWidth={1.8} />
                ) : (
                  <Store size={36} color="var(--b-orange)" strokeWidth={1.8} />
                )}
              </div>
              <p className="f-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--f-text-1)', margin: 0 }}>
                {feedType === 'saved'
                  ? 'Koi saved post nahi'
                  : feedType === 'following'
                  ? 'Abhi kisi ko follow nahi kiya'
                  : 'Yahan koi post nahi'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
                {feedType === 'saved'
                  ? 'Posts pe bookmark dabaiye, yahan dikhenge — baad mein dhoondhna easy hoga.'
                  : feedType === 'following'
                  ? 'Pasandeeda stores ko Follow kariye — unke naye posts seedha yahan aayenge.'
                  : 'Filter badal ke ya nearby radius badha ke try kariye, ya naye stores follow kariye.'}
              </p>
              {feedType !== 'global' && (
                <button
                  onClick={() => setFeedType('global')}
                  style={{
                    marginTop: 10,
                    padding: '10px 18px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: 'var(--c-action-ink)',
                    // Session 128.10 — Blinkit ADD-green action CTA.
                    background: 'var(--c-action)',
                    boxShadow: '0 4px 14px rgba(12,131,31,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  {feedType === 'saved' ? 'Browse posts' : 'Discover stores'}
                </button>
              )}
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
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#F8CB46',
                      boxShadow: '0 0 10px rgba(230,185,46,0.8)',
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
