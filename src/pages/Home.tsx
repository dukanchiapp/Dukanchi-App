import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Store as StoreIcon, Heart, Bookmark, Share2, SlidersHorizontal, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUserLocation } from '../context/LocationContext';
import LocationPicker from '../components/LocationPicker';
import { PostCardSkeleton } from '../components/Skeleton';

const renderCaption = (caption: string) => {
  const m = caption.match(/^([^.!?]+[.!?])([\s\S]*)$/);
  if (!m) return <strong style={{ fontWeight: 600 }}>{caption}</strong>;
  return (
    <>
      <strong style={{ fontWeight: 600 }}>{m[1]}</strong>
      {m[2]}
    </>
  );
};

/**
 * Returns canvas/image styles based on the natural dimensions of the loaded image.
 *
 * Portrait  (ratio < 0.9)  → fixed 4:5 canvas, object-fit:contain, black bg
 * Square    (0.9–1.1)      → 1:1 canvas,        object-fit:cover
 * Landscape (ratio > 1.1)  → natural ratio canvas, object-fit:cover
 */
function getImageStyles(naturalRatio: number | undefined): {
  canvasStyle: React.CSSProperties;
  imgStyle: React.CSSProperties;
} {
  if (!naturalRatio || naturalRatio < 0.9) {
    return {
      canvasStyle: { aspectRatio: '4/5', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    };
  }
  if (naturalRatio <= 1.1) {
    return {
      canvasStyle: { aspectRatio: '1/1', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    };
  }
  // Landscape: let the image's own ratio define the canvas height
  return {
    canvasStyle: { aspectRatio: String(naturalRatio), background: 'black', overflow: 'hidden', position: 'relative' },
    imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  };
}

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<{
    likedPostIds: string[];
    savedPostIds: string[];
    followedStoreIds: string[];
  }>({ likedPostIds: [], savedPostIds: [], followedStoreIds: [] });
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState('global');
  const [locationRange, setLocationRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const { location: userLocCtx } = useUserLocation();
  const userLoc = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Sticky bar height calculation
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  // naturalWidth / naturalHeight ratio for each post's image
  const [imgRatios, setImgRatios] = useState<Record<string, number>>({});
  // Carousel
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { token, user, logout } = useAuth();
  const { showToast } = useToast();


  // Fetch carousel images from admin settings
  useEffect(() => {
    fetch('/api/app-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.carouselImages && data.carouselImages.length > 0) {
          setCarouselImages(data.carouselImages);
        } else {
          // Fallback banners when admin hasn't set any
          setCarouselImages([
            'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=400&fit=crop&q=80',
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop&q=80',
          ]);
        }
      })
      .catch(() => {
        setCarouselImages([
          'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop&q=80',
          'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=400&fit=crop&q=80',
          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop&q=80',
        ]);
      });
  }, []);

  // Auto-slide carousel
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

  const getDistance = (lat?: number, lng?: number): string | null => {
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

  const handleImgLoad =
    (postId: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImgRatios(prev => ({ ...prev, [postId]: naturalWidth / naturalHeight }));
      }
    };

  const isOwnPost = (post: any) => post.isOwnPost === true;
  const getStoreLink = (post: any) => (isOwnPost(post) ? '/profile' : `/store/${post.storeId}`);

  const fetchFeed = async (pageNum = 1) => {
    if (!token) return;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const intRes = await fetch('/api/me/interactions', { credentials: 'include' });
      if (intRes.status === 401 || intRes.status === 403) { logout(); return; }
      setInteractions(await intRes.json());

      if (feedType === 'saved') {
        const savedRes = await fetch(`/api/users/${user?.id}/saved`, { credentials: 'include' });
        if (savedRes.status === 401 || savedRes.status === 403) { logout(); return; }
        const savedData = await savedRes.json();
        setPosts(Array.isArray(savedData.posts) ? savedData.posts : []);
        setHasMore(false);
        return;
      }

      let lat = 0, lng = 0;
      if (locationRange !== 'all' && userLoc) {
        lat = userLoc.lat;
        lng = userLoc.lng;
      }
      const postsRes = await fetch(
        `/api/posts?feedType=${feedType}&locationRange=${locationRange}&lat=${lat}&lng=${lng}&page=${pageNum}&limit=15`,
        { credentials: 'include' }
      );
      if (postsRes.status === 401 || postsRes.status === 403) { logout(); return; }
      const postsData = await postsRes.json();
      const newPosts = Array.isArray(postsData.posts) ? postsData.posts : [];

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map((p: any) => p.id));
          return [...prev, ...newPosts.filter((p: any) => !existingIds.has(p.id))];
        });
      }
      setHasMore(pageNum < (postsData.pagination?.totalPages || 1));
    } catch {
      if (pageNum === 1) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchFeed(1);
  }, [token, feedType, locationRange, userLocCtx?.lat, userLocCtx?.lng]);

  // IntersectionObserver — triggers next page load when sentinel comes into view
  useEffect(() => {
    if (!sentinelRef.current) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchFeed(nextPage);
      }
    }, { threshold: 0.5 });

    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, page, feedType, locationRange]);

  // Update top sticky bar height for the tabs to stick just beneath it
  useEffect(() => {
    if (topBarRef.current) {
      setTopBarHeight(topBarRef.current.offsetHeight);
    }
  }, [userLoc, feedType, locationRange]); // Re-calculate if anything layout-changing happens in top bar

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      likedPostIds: isLiked
        ? prev.likedPostIds.filter(id => id !== postId)
        : [...prev.likedPostIds, postId],
    }));
    try {
      await fetch(`/api/posts/${postId}/like`, { credentials: 'include', 
        method: 'POST',
        
      });
    } catch {}
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      savedPostIds: isSaved
        ? prev.savedPostIds.filter(id => id !== postId)
        : [...prev.savedPostIds, postId],
    }));
    try {
      await fetch(`/api/posts/${postId}/save`, { credentials: 'include', 
        method: 'POST',
        
      });
    } catch {}
  };

  const toggleFollow = async (storeId: string) => {
    const isFollowed = interactions.followedStoreIds.includes(storeId);
    setInteractions(prev => ({
      ...prev,
      followedStoreIds: isFollowed
        ? prev.followedStoreIds.filter(id => id !== storeId)
        : [...prev.followedStoreIds, storeId],
    }));
    try {
      await fetch(`/api/stores/${storeId}/follow`, { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}
  };

  const handleShare = async (post: any) => {
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
    } catch {}
  };

  const getLikeCount = (post: any) => {
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

          {/* Location bar */}
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
              {/* Images */}
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
                    src={img.startsWith('http') ? img : img}
                    alt={`Banner ${i + 1}`}
                    loading={i === carouselIdx ? 'eager' : 'lazy'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                    draggable={false}
                  />
                ))}
              </div>

              {/* Prev / Next buttons */}
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

              {/* Dots */}
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

        {/* Tabs + distance filter */}
        <div
          className="sticky z-20 px-4 py-2.5 flex items-center justify-between"
          style={{ top: topBarHeight, background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}
        >
            <div
              className="flex p-0.5 rounded-full gap-0.5"
              style={{ background: 'var(--dk-surface)' }}
            >
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
              <StoreIcon
                className="mx-auto mb-3"
                size={44}
                style={{ color: 'var(--dk-border-strong)' }}
              />
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
            posts.map(post => {
              const isLiked = interactions.likedPostIds.includes(post.id);
              const isSaved = interactions.savedPostIds.includes(post.id);
              const isFollowed = interactions.followedStoreIds.includes(post.storeId);
              const likeCount = getLikeCount(post);
              const distance = getDistance(post.store?.latitude, post.store?.longitude);
              const status = getStoreStatus(
                post.store?.openingTime,
                post.store?.closingTime,
                post.store?.is24Hours,
                post.store?.workingDays
              );
              const { canvasStyle, imgStyle } = getImageStyles(imgRatios[post.id]);

              return (
                <div
                  key={post.id}
                  className="bg-white overflow-hidden"
                  style={{
                    border: '0.5px solid var(--dk-border)',
                    borderRadius: 'var(--dk-radius-xl)',
                  }}
                >
                  {/* ── Card header ── */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Link to={getStoreLink(post)} className="flex-shrink-0">
                        <img
                          src={post.store?.logoUrl || '/uploads/default-logo.png'}
                          alt={post.store?.storeName}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            border: '2px solid var(--dk-accent)',
                            objectFit: 'cover',
                          }}
                        />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <Link to={getStoreLink(post)}>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--dk-text-primary)',
                                lineHeight: '1.3',
                              }}
                            >
                              {post.store?.storeName}
                            </span>
                          </Link>
                          {post.store?.isVerified && (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <circle cx="6.5" cy="6.5" r="6.5" fill="var(--dk-success)" />
                              <path
                                d="M3.5 6.5l2 2 4-4"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Status row — single line: open/closed · distance · category */}
                        <div
                          className="flex items-center gap-1 flex-wrap"
                          style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}
                        >
                          <span
                            style={{
                              color: status ? statusColor(status.color) : 'var(--dk-success)',
                              fontWeight: 500,
                            }}
                          >
                            {status ? `● ${status.label}` : '● Open'}
                          </span>
                          {distance && (
                            <>
                              <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                              <span>{distance}</span>
                            </>
                          )}
                          {post.store?.category && (
                            <>
                              <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                              <span>{post.store.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isOwnPost(post) && (
                      <button
                        onClick={() => toggleFollow(post.storeId)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ml-2"
                        style={
                          isFollowed
                            ? { background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)' }
                            : { background: 'var(--dk-accent)', color: 'white' }
                        }
                      >
                        {isFollowed ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>

                  {/* ── Image canvas ─ aspect ratio adapts to photo dimensions ── */}
                  <div style={canvasStyle}>
                    <img
                      src={post.imageUrl || `https://picsum.photos/seed/${post.id}/800/800`}
                      alt={post.product?.productName || 'Post'}
                      style={imgStyle}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onLoad={handleImgLoad(post.id)}
                    />
                    {post.price && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 12,
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 700,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        ₹{Number(post.price).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* ── Action bar + caption ── */}
                  <div className="px-4 pt-3 pb-3">
                    <div className="flex items-center" style={{ gap: 16 }}>
                      {/* Like */}
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-1"
                      >
                        <Heart
                          size={21}
                          fill={isLiked ? '#FF4444' : 'none'}
                          color={isLiked ? '#FF4444' : 'var(--dk-text-primary)'}
                          strokeWidth={2}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--dk-text-secondary)',
                          }}
                        >
                          {likeCount}
                        </span>
                      </button>

                      {/* Chat */}
                      {!isOwnPost(post) && post.store?.chatEnabled !== false && (
                        <Link
                          to={`/chat/${post.store?.ownerId}`}
                          state={{
                            referredPost: {
                              id: post.id,
                              imageUrl: post.imageUrl,
                              caption: post.caption,
                              price: post.price,
                            },
                          }}
                          className="flex items-center gap-1"
                        >
                          <MessageCircle
                            size={21}
                            fill="none"
                            color="var(--dk-text-primary)"
                            strokeWidth={2}
                          />
                          <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>
                            Chat
                          </span>
                        </Link>
                      )}

                      {/* Share */}
                      <button
                        onClick={() => handleShare(post)}
                        className="flex items-center gap-1"
                      >
                        <Share2
                          size={19}
                          fill="none"
                          color="var(--dk-text-primary)"
                          strokeWidth={2}
                        />
                        <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>
                          Share
                        </span>
                      </button>

                      <div style={{ flex: 1 }} />

                      {/* Save */}
                      <button onClick={() => toggleSave(post.id)}>
                        <Bookmark
                          size={21}
                          fill={isSaved ? 'var(--dk-text-primary)' : 'none'}
                          color="var(--dk-text-primary)"
                          strokeWidth={2}
                        />
                      </button>
                    </div>

                    {/* Product name + price */}
                    {post.product && (
                      <div className="flex items-center justify-between mt-2">
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--dk-text-primary)',
                          }}
                        >
                          {post.product.productName}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-accent)' }}>
                          ₹{post.product.price?.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Caption */}
                    {post.caption && (
                      <p
                        className="line-clamp-3"
                        style={{
                          fontSize: 13,
                          color: 'var(--dk-text-primary)',
                          lineHeight: '1.45',
                          marginTop: 6,
                        }}
                      >
                        {renderCaption(post.caption)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {/* Loading more indicator */}
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

          {/* End of feed */}
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
